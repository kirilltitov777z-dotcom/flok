/* Flok server — accounts, chats, channels, market, clicker and realtime events */
"use strict";

const path = require("path");
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");
const express = require("express");
const { WebSocketServer } = require("ws");
const C = require("../web/catalog.js");

const ROOT = path.join(__dirname, "..");
const WEB = path.join(ROOT, "web");
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "data.json");
const PORT = Number(process.env.PORT) || 8787;
const HOST = process.env.HOST || "0.0.0.0";
const DAY = 86400000;

const uid = (prefix) => (prefix || "x") + crypto.randomBytes(7).toString("hex");
const esc = (s) => String(s == null ? "" : s);
const clamp = (n, a, b) => Math.max(a, Math.min(b, Number(n) || 0));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rnd = (a, b) => a + Math.random() * (b - a);
const normalize = (s) => String(s || "").trim().toLowerCase().replace(/^@/, "");
const onlyDigits = (s) => String(s || "").replace(/\D/g, "");
const dayKey = (ts) => {
  const d = new Date(ts || Date.now());
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
const giftById = (id) => C.GIFTS.find((g) => g.id === id);
const bgById = (id) => C.BACKGROUNDS.find((b) => b.id === id);
const botById = (id) => C.BOTS.find((b) => b.id === id);
const botBg = { bot_luna: "cosmos1", bot_kai: "cosmos3", bot_mira: "cosmos2", bot_alice: "rose", bot_max: "sunset" };

/* ---------- passwords ---------- */
function newSalt() { return crypto.randomBytes(16).toString("hex"); }
function hashPassword(password, salt) {
  return crypto.createHash("sha256").update(salt + ":" + password).digest("hex");
}

/* ---------- persistence ---------- */
function seedChannels() {
  const now = Date.now();
  const out = {};
  C.CHANNELS.forEach((c) => {
    out[c.id] = {
      id: c.id, name: c.name, handle: c.handle, about: c.about, emoji: c.emoji, color: c.color,
      official: !!c.official, subscribers: c.subscribers, ownerId: "bot_flok", createdAt: now - 40 * DAY,
      posts: c.posts.map((p) => ({
        id: uid("p_"), text: p.text, ts: now - p.ago * 60000, views: p.views,
        authorId: c.id === "ch_news" ? "bot_flok" : pick(C.BOTS).id
      })).sort((a, b) => b.ts - a.ts)
    };
  });
  return out;
}

function seedListings() {
  const out = [];
  const pool = C.GIFTS.filter((g) => g.rarity !== "halloween");
  for (let i = 0; i < 9; i++) {
    const bot = pick(C.BOTS);
    const g = pick(pool);
    const factor = rnd(0.82, 1.25);
    out.push({
      id: uid("l_"), giftId: g.id,
      serial: Math.floor(rnd(1, Math.max(2, Math.min(g.supply, 400)))),
      price: Math.round(g.price * factor / 10) * 10,
      sellerId: bot.id, ts: Date.now() - Math.floor(rnd(2, 300)) * 60000
    });
  }
  C.GIFTS.filter((g) => g.rarity === "halloween").forEach((g) => {
    out.push({
      id: uid("l_"), giftId: g.id,
      serial: Math.floor(rnd(1, Math.max(2, g.supply))),
      price: Math.round(g.price * rnd(0.95, 1.15) / 10) * 10,
      sellerId: pick(C.BOTS).id, ts: Date.now() - Math.floor(rnd(5, 120)) * 60000
    });
  });
  return out.slice(0, 12);
}

function freshDb() {
  return {
    v: 1,
    users: {},
    sessions: {},
    chats: {},
    listings: seedListings(),
    minted: {},
    channels: seedChannels(),
    createdAt: Date.now()
  };
}

function loadDb() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const db = JSON.parse(raw);
    if (!db.users) db.users = {};
    if (!db.sessions) db.sessions = {};
    if (!db.chats) db.chats = {};
    if (!db.listings) db.listings = [];
    if (!db.minted) db.minted = {};
    if (!db.channels || !Object.keys(db.channels).length) db.channels = seedChannels();
    return db;
  } catch (e) {
    if (e.code !== "ENOENT") {
      try { fs.renameSync(DATA_FILE, DATA_FILE + ".broken-" + Date.now()); } catch (_) {}
    }
    return freshDb();
  }
}

let db = loadDb();
let saveTimer = null;
function writeDb() {
  saveTimer = null;
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    const tmp = DATA_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, DATA_FILE);
  } catch (e) {
    console.error("Flok storage error:", e.message);
  }
}
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(writeDb, 160);
}
function saveNow() { if (saveTimer) clearTimeout(saveTimer); writeDb(); }

/* ---------- profiles ---------- */
function botProfile(b) {
  return {
    id: b.id, username: b.username, name: b.name, bio: b.bio,
    avatar: { emoji: b.emoji, color: b.color }, bot: true, online: true,
    bg: botBg[b.id] || "default", gifts: [], email: "", phone: ""
  };
}
function userGifts(u) {
  return (u.gifts || []).map((o) => {
    const gift = giftById(o.giftId);
    return gift ? { ...o, gift } : null;
  }).filter(Boolean);
}
function publicProfile(id) {
  const bot = botById(id);
  if (bot) return botProfile(bot);
  const u = db.users[id];
  if (!u) return null;
  return {
    id: u.id, username: u.username, name: u.name, bio: u.bio, avatar: u.avatar,
    bot: false, online: true, email: u.email || "", phone: u.phone || "",
    createdAt: u.createdAt, bg: u.bg || "default", gifts: userGifts(u)
  };
}
function safeMe(u) {
  return {
    id: u.id, username: u.username, name: u.name, email: u.email || "", phone: u.phone || "",
    avatar: u.avatar, bio: u.bio, createdAt: u.createdAt, balance: u.balance,
    gifts: u.gifts.slice(), bg: u.bg, ownedBgs: u.ownedBgs.slice(), chatIds: u.chatIds.slice(),
    contacts: u.contacts.slice(), channelIds: u.channelIds.slice(), tx: u.tx.slice(0, 120),
    unread: { ...u.unread }, clicker: { ...u.clicker }, daily: { ...u.daily }
  };
}
function fallbackProfile(id) {
  return { id, username: "user", name: "Пользователь", bio: "", avatar: {}, bot: false, online: false, bg: "default", gifts: [] };
}

/* ---------- chats ---------- */
function isMember(chat, userId) { return !!chat && Array.isArray(chat.members) && chat.members.includes(userId); }
function findDm(a, b) {
  return Object.values(db.chats).find((c) => c.type === "dm" && c.members.includes(a) && c.members.includes(b));
}
function ensureChat(a, b) {
  let chat = findDm(a, b);
  if (chat) return chat;
  chat = { id: uid("c_"), type: "dm", members: [a, b], messages: [], updatedAt: Date.now() };
  db.chats[chat.id] = chat;
  for (const id of [a, b]) {
    const u = db.users[id];
    if (u && !u.chatIds.includes(chat.id)) u.chatIds.push(chat.id);
  }
  save();
  return chat;
}

function tickUser(u) {
  const now = Date.now();
  const c = u.clicker;
  const maxE = 500 + ((c.energyLvl || 1) - 1) * 150;
  const gained = Math.floor((now - (c.lastEnergy || now)) / 1000 * 2);
  if (gained > 0) {
    c.energy = Math.min(maxE, (c.energy || 0) + gained);
    c.lastEnergy = now;
  }
  if (!c.lastEnergy) c.lastEnergy = now;
  c.energy = clamp(c.energy, 0, maxE);
  const autoHour = (c.autoLvl || 0) * 120;
  if (autoHour > 0) {
    const ms = now - (c.lastAuto || now);
    const earn = (ms / 3600000) * autoHour;
    c.autoCarry = (c.autoCarry || 0) + earn;
    const whole = Math.floor(c.autoCarry);
    if (whole > 0) {
      c.autoCarry -= whole;
      u.balance += whole;
      c.totalEarned = (c.totalEarned || 0) + whole;
      if (whole >= 20) addTx(u, "daily", "Дроны-фармеры", whole, true);
    }
    c.lastAuto = now;
  } else {
    c.lastAuto = now;
  }
}

function addTx(u, type, title, amount, plus) {
  u.tx.unshift({ id: uid("t_"), type, title, amount, plus, ts: Date.now() });
  if (u.tx.length > 120) u.tx.length = 120;
}

function maxEnergy(c) { return 500 + ((c.energyLvl || 1) - 1) * 150; }

/* ---------- websocket ---------- */
const sockets = new Map();
const typingTimers = new Map();
function wsSend(userId, type, data) {
  const set = sockets.get(userId);
  if (!set) return;
  const raw = JSON.stringify({ type, data });
  set.forEach((ws) => { if (ws.readyState === 1) { try { ws.send(raw); } catch (_) {} } });
}
function broadcast(type, data) {
  const raw = JSON.stringify({ type, data });
  for (const set of sockets.values()) {
    set.forEach((ws) => { if (ws.readyState === 1) { try { ws.send(raw); } catch (_) {} } });
  }
}

function scheduleBotReply(userId, chat, bot) {
  const key = chat.id;
  if (typingTimers.has(key)) return;
  wsSend(userId, "typing", { chatId: chat.id, on: true });
  const timer = setTimeout(() => {
    typingTimers.delete(key);
    const fresh = db.chats[chat.id];
    if (!fresh) return;
    const me = db.users[userId];
    if (!me) return;
    const lastMine = [...fresh.messages].reverse().find((m) => m.from === userId && m.text);
    let text = pick(bot.replies);
    if (lastMine && /привет|хай|здоров|ку/i.test(lastMine.text)) {
      text = pick(["Привет! Рад тебя видеть 🫧", "Хей! Как дела?", "Привет-привет! Что нового?"]);
    }
    if (lastMine && /подар|гифт|маркет/i.test(lastMine.text)) {
      text = pick([
        "Люблю маркет — там иногда попадаются редкие серии за смешные деньги 👀",
        "Совет: выставь цену чуть ниже остальных, тогда купят быстрее.",
        "Хэллоуинская коллекция — самая красивая. Жалко, что лимитка."
      ]);
    }
    const msg = { id: uid("m_"), from: bot.id, text, ts: Date.now() };
    fresh.messages.push(msg);
    fresh.updatedAt = msg.ts;
    me.unread[fresh.id] = (me.unread[fresh.id] || 0) + 1;
    save();
    wsSend(userId, "message", { chatId: fresh.id, msg, peer: botProfile(bot) });
    wsSend(userId, "typing", { chatId: fresh.id, on: false });
  }, 1400 + Math.random() * 1900);
  typingTimers.set(key, timer);
}

function botAutoBuy(listingId) {
  if (Math.random() > 0.62) return;
  setTimeout(() => {
    const l = db.listings.find((x) => x.id === listingId);
    if (!l) return;
    const seller = db.users[l.sellerId];
    if (!seller) return;
    const g = giftById(l.giftId);
    db.listings = db.listings.filter((x) => x.id !== listingId);
    const payout = Math.round(l.price * 0.95);
    seller.balance += payout;
    seller.gifts = seller.gifts.filter((x) => x.uid !== l.cid);
    addTx(seller, "sale", "Продажа: " + (g ? g.name : "подарок"), payout, true);
    saveNow();
    wsSend(seller.id, "sold", {
      listing: { ...l, gift: g, seller: publicProfile(seller.id) },
      buyer: publicProfile(pick(C.BOTS).id), payout
    });
    broadcast("market", {});
  }, 16000 + Math.random() * 26000);
}

/* ---------- app ---------- */
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "6mb" }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "Flok", version: "1.0.0", users: Object.keys(db.users).length, now: Date.now() });
});

app.post("/api/register", (req, res) => {
  const body = req.body || {};
  let username = normalize(body.username).replace(/[^a-z0-9_]/g, "");
  const name = String(body.name || "").trim().slice(0, 40);
  const email = String(body.email || "").trim().toLowerCase();
  const phone = onlyDigits(body.phone);
  const password = String(body.password || "");
  if (username.length < 3) return res.status(400).json({ error: "Ник — минимум 3 символа (a-z, 0-9, _)" });
  if (username.length > 20) return res.status(400).json({ error: "Ник — максимум 20 символов" });
  if (C.BOTS.some((b) => b.username === username)) return res.status(400).json({ error: "Этот ник уже занят" });
  if (Object.values(db.users).some((u) => u.username === username)) return res.status(400).json({ error: "Этот ник уже занят" });
  if (password.length < 4) return res.status(400).json({ error: "Пароль — минимум 4 символа" });
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "Похоже, e-mail с ошибкой" });
  if (email && Object.values(db.users).some((u) => u.email === email)) return res.status(400).json({ error: "Этот e-mail уже используется" });
  if (phone && Object.values(db.users).some((u) => u.phone === phone)) return res.status(400).json({ error: "Этот телефон уже используется" });

  const salt = newSalt();
  const user = {
    id: uid("u_"), username, name: name || username, email, phone, salt,
    passHash: hashPassword(password, salt), createdAt: Date.now(),
    avatar: { emoji: "", color: pick(C.AVATAR_COLORS), image: "" },
    bio: "Новичок в Flok 🫧", balance: 3000, gifts: [], bg: "default", ownedBgs: ["default"],
    chatIds: [], contacts: [], channelIds: [], tx: [], unread: {},
    clicker: {
      tapLvl: 1, energyLvl: 1, autoLvl: 0, energy: 500,
      lastEnergy: Date.now(), lastAuto: Date.now(), autoCarry: 0, totalTaps: 0, totalEarned: 0
    },
    daily: { last: "", streak: 0 }
  };
  db.users[user.id] = user;
  if (db.channels["ch_news"]) { user.channelIds.push("ch_news"); user.unread["ch_news"] = 1; }

  const welcome = ensureChat(user.id, "bot_flok");
  const bot = botById("bot_flok");
  if (!welcome.messages.length) {
    welcome.messages = bot.starter.map((text, i) => ({
      id: uid("m_"), from: bot.id, text, ts: Date.now() - (bot.starter.length - i) * 60000
    }));
    welcome.updatedAt = Date.now();
  }
  user.unread[welcome.id] = 1;
  const token = crypto.randomBytes(24).toString("hex");
  db.sessions[token] = user.id;
  saveNow();
  res.json({ token, user: safeMe(user) });
});

app.post("/api/login", (req, res) => {
  const body = req.body || {};
  const q = normalize(body.login);
  const digits = onlyDigits(body.login);
  const u = Object.values(db.users).find((x) =>
    x.username === q || (x.email && x.email === q) || (digits && x.phone === digits)
  );
  if (!u) return res.status(401).json({ error: "Аккаунт не найден" });
  if (hashPassword(String(body.password || ""), u.salt) !== u.passHash) {
    return res.status(401).json({ error: "Неверный пароль" });
  }
  tickUser(u);
  const token = crypto.randomBytes(24).toString("hex");
  db.sessions[token] = u.id;
  saveNow();
  res.json({ token, user: safeMe(u) });
});

app.use("/api", (req, res, next) => {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const userId = db.sessions[token];
  const user = userId && db.users[userId];
  if (!user) return res.status(401).json({ error: "Нужно войти в аккаунт" });
  req.user = user;
  req.token = token;
  tickUser(user);
  save();
  next();
});

app.post("/api/logout", (req, res) => {
  delete db.sessions[req.token];
  saveNow();
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  res.json({ user: safeMe(req.user) });
});

/* ---------- chats ---------- */
function chatListFor(user) {
  const out = [];
  for (const id of user.chatIds) {
    const c = db.chats[id];
    if (!c) continue;
    const peerId = c.members.find((m) => m !== user.id);
    const peer = publicProfile(peerId) || fallbackProfile(peerId);
    const last = c.messages[c.messages.length - 1] || null;
    out.push({
      id: c.id, peer, last, unread: user.unread[c.id] || 0,
      updatedAt: last ? last.ts : c.updatedAt
    });
  }
  return out.sort((a, b) => (b.unread ? 1 : 0) - (a.unread ? 1 : 0) || b.updatedAt - a.updatedAt);
}
function chatPeer(user, chat) {
  const peerId = chat.members.find((m) => m !== user.id);
  return publicProfile(peerId) || fallbackProfile(peerId);
}

app.get("/api/chats", (req, res) => {
  res.json({ chats: chatListFor(req.user), user: safeMe(req.user) });
});

app.post("/api/chats", (req, res) => {
  const peerId = String((req.body || {}).peerId || "");
  if (!peerId || peerId === req.user.id) return res.status(400).json({ error: "Это ты" });
  if (!publicProfile(peerId)) return res.status(404).json({ error: "Пользователь не найден" });
  const chat = ensureChat(req.user.id, peerId);
  saveNow();
  res.json({ chatId: chat.id, user: safeMe(req.user) });
});

app.get("/api/chats/:id/messages", (req, res) => {
  const chat = db.chats[req.params.id];
  if (!isMember(chat, req.user.id)) return res.status(404).json({ error: "Чат не найден" });
  req.user.unread[chat.id] = 0;
  save();
  res.json({ messages: chat.messages.slice(), peer: chatPeer(req.user, chat), user: safeMe(req.user) });
});

app.post("/api/chats/:id/messages", (req, res) => {
  const chat = db.chats[req.params.id];
  if (!isMember(chat, req.user.id)) return res.status(404).json({ error: "Чат не найден" });
  const body = req.body || {};
  const text = String(body.text || "").slice(0, 4000);
  const img = typeof body.img === "string" ? body.img : "";
  if (!text.trim() && !img) return res.status(400).json({ error: "Пустое сообщение" });
  if (img.length > 5_500_000) return res.status(413).json({ error: "Фото слишком большое" });
  const msg = { id: uid("m_"), from: req.user.id, text, img, ts: Date.now() };
  chat.messages.push(msg);
  chat.updatedAt = msg.ts;
  const peerId = chat.members.find((m) => m !== req.user.id);
  const bot = botById(peerId);
  if (bot) {
    scheduleBotReply(req.user.id, chat, bot);
  } else if (db.users[peerId]) {
    db.users[peerId].unread[chat.id] = (db.users[peerId].unread[chat.id] || 0) + 1;
    wsSend(peerId, "message", { chatId: chat.id, msg, peer: publicProfile(req.user.id) });
  }
  saveNow();
  res.json({ message: msg, user: safeMe(req.user) });
});
app.post("/api/chat/read", (req, res) => {
  const id = String((req.body || {}).chatId || "");
  if (req.user.unread[id]) { req.user.unread[id] = 0; save(); }
  res.json({ ok: true });
});

/* ---------- people ---------- */
app.get("/api/contacts", (req, res) => {
  const seen = new Set();
  const out = [];
  C.BOTS.forEach((b) => { seen.add(b.id); out.push(botProfile(b)); });
  Object.values(db.users).forEach((u) => {
    if (u.id === req.user.id || seen.has(u.id)) return;
    seen.add(u.id);
    out.push(publicProfile(u.id));
  });
  res.json({ contacts: out, user: safeMe(req.user) });
});

app.post("/api/contacts", (req, res) => {
  const q = normalize((req.body || {}).query);
  const digits = onlyDigits((req.body || {}).query);
  if (!q) return res.status(400).json({ error: "Введи ник, e-mail или телефон" });
  const bot = C.BOTS.find((b) => b.username === q || normalize(b.name) === q);
  if (bot) return res.json({ profile: botProfile(bot), user: safeMe(req.user) });
  const found = Object.values(db.users).find((u) =>
    u.username === q || (u.email && u.email === q) || (digits && u.phone === digits)
  );
  if (!found) return res.status(404).json({ error: "Никого не нашли. Проверь ник или телефон." });
  if (found.id === req.user.id) return res.status(400).json({ error: "Это твой собственный аккаунт 🙂" });
  if (!req.user.contacts.includes(found.id)) req.user.contacts.push(found.id);
  saveNow();
  res.json({ profile: publicProfile(found.id), user: safeMe(req.user) });
});

app.get("/api/search", (req, res) => {
  const q = normalize(req.query.q);
  const digits = onlyDigits(req.query.q);
  const out = [];
  C.BOTS.forEach((b) => out.push(botProfile(b)));
  Object.values(db.users).forEach((u) => { if (u.id !== req.user.id) out.push(publicProfile(u.id)); });
  const list = !q ? out : out.filter((p) =>
    normalize(p.username).includes(q) || normalize(p.name).includes(q) ||
    (p.email && p.email.includes(q)) || (digits && p.phone && p.phone.includes(digits))
  );
  res.json({ people: list });
});

/* ---------- channels ---------- */
function channelView(c, user) {
  return {
    ...c, joined: user.channelIds.includes(c.id), isOwner: c.ownerId === user.id,
    last: c.posts[c.posts.length - 1] || null
  };
}
app.get("/api/channels", (req, res) => {
  const list = Object.values(db.channels).map((c) => channelView(c, req.user))
    .sort((a, b) => (b.joined ? 1 : 0) - (a.joined ? 1 : 0) || b.subscribers - a.subscribers);
  res.json({ channels: list, user: safeMe(req.user) });
});
app.get("/api/channels/:id", (req, res) => {
  const c = db.channels[req.params.id];
  if (!c) return res.status(404).json({ error: "Канал не найден" });
  if (req.user.unread[c.id]) { req.user.unread[c.id] = 0; save(); }
  res.json({ channel: { ...channelView(c, req.user), author: publicProfile(c.ownerId) || fallbackProfile(c.ownerId) }, user: safeMe(req.user) });
});
app.post("/api/channels/:id/join", (req, res) => {
  const c = db.channels[req.params.id];
  if (!c) return res.status(404).json({ error: "Канал не найден" });
  if (!req.user.channelIds.includes(c.id)) { req.user.channelIds.push(c.id); c.subscribers++; save(); }
  res.json({ ok: true, user: safeMe(req.user) });
});
app.post("/api/channels/:id/leave", (req, res) => {
  const c = db.channels[req.params.id];
  if (!c) return res.status(404).json({ error: "Канал не найден" });
  req.user.channelIds = req.user.channelIds.filter((x) => x !== c.id);
  c.subscribers = Math.max(0, c.subscribers - 1);
  saveNow();
  res.json({ ok: true, user: safeMe(req.user) });
});
app.post("/api/channels", (req, res) => {
  const body = req.body || {};
  const name = String(body.name || "").trim();
  if (name.length < 2) return res.status(400).json({ error: "Название — минимум 2 символа" });
  const id = uid("ch_");
  const channel = {
    id, name: name.slice(0, 40), handle: "@" + req.user.username,
    about: String(body.about || "").slice(0, 160), emoji: String(body.emoji || "🫧").slice(0, 8),
    color: String(body.color || "#58e0bd").slice(0, 20), official: false, subscribers: 1,
    ownerId: req.user.id, createdAt: Date.now(),
    posts: [{ id: uid("p_"), text: "Канал создан. Здесь будет только важное ✨", ts: Date.now(), views: 1, authorId: req.user.id }]
  };
  db.channels[id] = channel;
  if (!req.user.channelIds.includes(id)) req.user.channelIds.push(id);
  saveNow();
  res.json({ id, user: safeMe(req.user) });
});
app.post("/api/channels/:id/posts", (req, res) => {
  const c = db.channels[req.params.id];
  if (!c) return res.status(404).json({ error: "Канал не найден" });
  if (c.ownerId !== req.user.id) return res.status(403).json({ error: "Писать может только владелец" });
  const text = String((req.body || {}).text || "").trim();
  if (!text) return res.status(400).json({ error: "Пустой пост" });
  c.posts.unshift({ id: uid("p_"), text: text.slice(0, 3000), ts: Date.now(), views: 1, authorId: req.user.id });
  saveNow();
  res.json({ ok: true, user: safeMe(req.user) });
});

/* ---------- market ---------- */
function listingView(l, user) {
  const gift = giftById(l.giftId);
  if (!gift) return null;
  return { ...l, gift, seller: publicProfile(l.sellerId) || fallbackProfile(l.sellerId), mine: l.sellerId === user.id };
}
app.get("/api/market", (req, res) => {
  const listings = db.listings.map((l) => listingView(l, req.user)).filter(Boolean)
    .sort((a, b) => b.ts - a.ts);
  res.json({ listings, user: safeMe(req.user) });
});
app.get("/api/shop", (req, res) => {
  const counts = {};
  C.GIFTS.forEach((g) => { counts[g.id] = db.minted[g.id] || 0; });
  res.json({ shop: counts, user: safeMe(req.user) });
});
app.post("/api/shop/buy", (req, res) => {
  const g = giftById(String((req.body || {}).giftId || ""));
  if (!g) return res.status(404).json({ error: "Подарок не найден" });
  if (req.user.balance < g.price) return res.status(400).json({ error: "Недостаточно Flok. Заработай в кликере или продай подарок." });
  const minted = db.minted[g.id] || 0;
  if (minted >= g.supply) return res.status(400).json({ error: "Весь тираж раскуплен" });
  db.minted[g.id] = minted + 1;
  req.user.balance -= g.price;
  const owned = { uid: uid("g_"), giftId: g.id, serial: minted + 1, ts: Date.now() };
  req.user.gifts.push(owned);
  addTx(req.user, "shop", "Подарок: " + g.name, g.price, false);
  saveNow();
  res.json({ owned, user: safeMe(req.user) });
});
app.get("/api/gifts", (req, res) => {
  const gifts = userGifts(req.user).map((o) => {
    const listing = db.listings.find((l) => l.cid === o.uid || (l.giftId === o.giftId && l.serial === o.serial && l.sellerId === req.user.id));
    return { ...o, listing: listing || null };
  }).sort((a, b) => b.ts - a.ts);
  res.json({ gifts, user: safeMe(req.user) });
});
app.post("/api/market/list", (req, res) => {
  const body = req.body || {};
  const owned = req.user.gifts.find((g) => g.uid === String(body.uid || ""));
  if (!owned) return res.status(404).json({ error: "Подарок не найден" });
  let price = Math.round(Number(body.price));
  if (!price || price < 10) return res.status(400).json({ error: "Минимальная цена — 10 Flok" });
  if (price > 9999999) return res.status(400).json({ error: "Слишком дорого даже для Flok" });
  if (db.listings.some((l) => l.cid === owned.uid)) return res.status(400).json({ error: "Подарок уже выставлен" });
  const listing = { id: uid("l_"), giftId: owned.giftId, serial: owned.serial, price, sellerId: req.user.id, ts: Date.now(), cid: owned.uid };
  db.listings.push(listing);
  saveNow();
  botAutoBuy(listing.id);
  broadcast("market", {});
  res.json({ listing, user: safeMe(req.user) });
});
app.post("/api/market/cancel", (req, res) => {
  const id = String((req.body || {}).id || "");
  const l = db.listings.find((x) => x.id === id);
  if (!l) return res.status(404).json({ error: "Лот не найден" });
  if (l.sellerId !== req.user.id) return res.status(403).json({ error: "Это не твой лот" });
  db.listings = db.listings.filter((x) => x.id !== id);
  saveNow();
  broadcast("market", {});
  res.json({ ok: true, user: safeMe(req.user) });
});
app.post("/api/market/buy", (req, res) => {
  const id = String((req.body || {}).id || "");
  const l = db.listings.find((x) => x.id === id);
  if (!l) return res.status(404).json({ error: "Лот уже продан" });
  if (l.sellerId === req.user.id) return res.status(400).json({ error: "Нельзя купить свой лот" });
  const g = giftById(l.giftId);
  if (!g) return res.status(404).json({ error: "Подарок не найден" });
  if (req.user.balance < l.price) return res.status(400).json({ error: "Недостаточно Flok" });
  req.user.balance -= l.price;
  const owned = { uid: uid("g_"), giftId: l.giftId, serial: l.serial, ts: Date.now(), from: l.sellerId };
  req.user.gifts.push(owned);
  db.listings = db.listings.filter((x) => x.id !== id);
  addTx(req.user, "market", "Покупка: " + g.name, l.price, false);
  const seller = db.users[l.sellerId];
  if (seller) {
    const payout = Math.round(l.price * 0.95);
    seller.balance += payout;
    if (l.cid) seller.gifts = seller.gifts.filter((x) => x.uid !== l.cid);
    addTx(seller, "sale", "Продажа: " + g.name, payout, true);
    wsSend(seller.id, "sold", { listing: listingView(l, seller), buyer: publicProfile(req.user.id), payout });
  }
  saveNow();
  broadcast("market", {});
  res.json({ owned, user: safeMe(req.user) });
});
app.post("/api/gifts/quick-sell", (req, res) => {
  const uidStr = String((req.body || {}).uid || "");
  const idx = req.user.gifts.findIndex((g) => g.uid === uidStr);
  if (idx < 0) return res.status(404).json({ error: "Подарок не найден" });
  if (db.listings.some((l) => l.cid === uidStr)) return res.status(400).json({ error: "Сначала сними лот с маркета" });
  const owned = req.user.gifts[idx];
  const g = giftById(owned.giftId);
  const amount = Math.round(g.price * 0.6);
  req.user.gifts.splice(idx, 1);
  req.user.balance += amount;
  addTx(req.user, "sale", "Мгновенная продажа: " + g.name, amount, true);
  saveNow();
  broadcast("market", {});
  res.json({ amount, gift: g, user: safeMe(req.user) });
});
app.post("/api/gifts/gift", (req, res) => {
  const body = req.body || {};
  const uidStr = String(body.uid || "");
  const toId = String(body.toId || "");
  const idx = req.user.gifts.findIndex((g) => g.uid === uidStr);
  if (idx < 0) return res.status(404).json({ error: "Подарок не найден" });
  if (db.listings.some((l) => l.cid === uidStr)) return res.status(400).json({ error: "Сначала сними лот с маркета" });
  const recipient = publicProfile(toId);
  if (!recipient) return res.status(404).json({ error: "Получатель не найден" });
  const owned = req.user.gifts[idx];
  const g = giftById(owned.giftId);
  req.user.gifts.splice(idx, 1);
  const target = db.users[toId];
  if (target) {
    target.gifts.push({ ...owned, from: req.user.id, ts: Date.now() });
    target.unread = target.unread || {};
  }
  addTx(req.user, "gift", "Подарок: " + g.name + " → " + (recipient.name || recipient.username), 0, false);
  const chat = ensureChat(req.user.id, toId);
  const msg = { id: uid("m_"), from: req.user.id, gift: { giftId: g.id, serial: owned.serial, name: g.name, price: g.price }, ts: Date.now() };
  chat.messages.push(msg);
  chat.updatedAt = msg.ts;
  if (target) target.unread[chat.id] = (target.unread[chat.id] || 0) + 1;
  saveNow();
  wsSend(toId, "message", { chatId: chat.id, msg, peer: publicProfile(req.user.id) });
  broadcast("market", {});
  res.json({ gift: g, recipient, user: safeMe(req.user) });
});

/* ---------- backgrounds ---------- */
app.get("/api/backgrounds", (req, res) => {
  const backgrounds = C.BACKGROUNDS.map((b) => ({
    ...b,
    owned: b.price === 0 || req.user.ownedBgs.includes(b.id),
    selected: req.user.bg === b.id
  }));
  res.json({ backgrounds, user: safeMe(req.user) });
});
app.post("/api/backgrounds/buy", (req, res) => {
  const b = bgById(String((req.body || {}).id || ""));
  if (!b) return res.status(404).json({ error: "Фон не найден" });
  if (b.price === 0 || req.user.ownedBgs.includes(b.id)) return res.status(400).json({ error: "Этот фон уже твой" });
  if (req.user.balance < b.price) return res.status(400).json({ error: "Недостаточно Flok" });
  req.user.balance -= b.price;
  req.user.ownedBgs.push(b.id);
  req.user.bg = b.id;
  addTx(req.user, "bg", "Фон профиля: " + b.name, b.price, false);
  saveNow();
  res.json({ ok: true, user: safeMe(req.user) });
});
app.post("/api/backgrounds/select", (req, res) => {
  const id = String((req.body || {}).id || "");
  if (id !== "default" && !req.user.ownedBgs.includes(id)) return res.status(400).json({ error: "Сначала купи фон" });
  if (!bgById(id)) return res.status(404).json({ error: "Фон не найден" });
  req.user.bg = id;
  saveNow();
  res.json({ ok: true, user: safeMe(req.user) });
});

/* ---------- profile / daily / clicker ---------- */
app.patch("/api/profile", (req, res) => {
  const data = req.body || {};
  if (data.name != null) {
    const n = String(data.name).trim();
    if (!n) return res.status(400).json({ error: "Имя не может быть пустым" });
    req.user.name = n.slice(0, 40);
  }
  if (data.bio != null) req.user.bio = String(data.bio).slice(0, 160);
  if (data.avatar && typeof data.avatar === "object") {
    const image = typeof data.avatar.image === "string" ? data.avatar.image : "";
    if (image.length > 4_500_000) return res.status(413).json({ error: "Фото слишком большое" });
    req.user.avatar = {
      ...req.user.avatar,
      emoji: String(data.avatar.emoji || "").slice(0, 16),
      color: String(data.avatar.color || "#58e0bd").slice(0, 24),
      image
    };
  }
  saveNow();
  res.json({ user: safeMe(req.user) });
});

app.post("/api/daily", (req, res) => {
  const today = dayKey();
  if (req.user.daily.last === today) return res.status(400).json({ error: "Бонус уже получен. Приходи завтра 🌿" });
  const yest = dayKey(Date.now() - DAY);
  req.user.daily.streak = req.user.daily.last === yest ? req.user.daily.streak + 1 : 1;
  req.user.daily.last = today;
  const amount = Math.min(900, 300 + (req.user.daily.streak - 1) * 75);
  req.user.balance += amount;
  addTx(req.user, "daily", "Ежедневный бонус · день " + req.user.daily.streak, amount, true);
  saveNow();
  res.json({ amount, streak: req.user.daily.streak, user: safeMe(req.user) });
});

app.post("/api/click", (req, res) => {
  const c = req.user.clicker;
  if (c.energy < 1) return res.status(400).json({ error: "Энергия закончилась — подожди немного" });
  const reward = Math.max(1, c.tapLvl || 1);
  c.energy -= 1;
  c.totalTaps++;
  c.totalEarned += reward;
  req.user.balance += reward;
  save();
  res.json({ balance: req.user.balance, energy: c.energy, maxE: maxEnergy(c), user: safeMe(req.user) });
});

app.post("/api/upgrade", (req, res) => {
  const id = String((req.body || {}).id || "");
  const up = C.CLICKER_UPGRADES.find((u) => u.id === id);
  if (!up) return res.status(404).json({ error: "Улучшение не найдено" });
  const c = req.user.clicker;
  const lvl = c[id + "Lvl"] || 0;
  const cost = Math.round(up.base * Math.pow(up.growth, lvl));
  if (req.user.balance < cost) return res.status(400).json({ error: "Недостаточно Flok" });
  req.user.balance -= cost;
  c[id + "Lvl"] = lvl + 1;
  if (id === "energy") c.energy = maxEnergy(c);
  addTx(req.user, "upgrade", "Улучшение: " + up.name, cost, false);
  saveNow();
  res.json({ cost, lvl: lvl + 1, user: safeMe(req.user) });
});

app.get("/api/wallet", (req, res) => {
  res.json({
    balance: req.user.balance, tx: req.user.tx.slice(0, 60),
    id: "FLK-" + req.user.id.slice(-6).toUpperCase(), clicker: { ...req.user.clicker },
    user: safeMe(req.user)
  });
});

/* ---------- websocket ---------- */
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, "http://flok.local");
  if (url.pathname !== "/ws") { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
});

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, "http://flok.local");
  const token = url.searchParams.get("token") || "";
  const userId = db.sessions[token];
  const user = userId && db.users[userId];
  if (!user) { ws.close(4001, "unauthorized"); return; }
  if (!sockets.has(userId)) sockets.set(userId, new Set());
  sockets.get(userId).add(ws);
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });
  ws.on("close", () => {
    const set = sockets.get(userId);
    if (set) { set.delete(ws); if (!set.size) sockets.delete(userId); }
  });
  ws.on("error", () => {});
  ws.send(JSON.stringify({ type: "hello", data: { user: safeMe(user) } }));
});

const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    try { ws.ping(); } catch (_) {}
  });
}, 30000);

/* ---------- static web ---------- */
app.get("/", (req, res, next) => {
  fs.readFile(path.join(WEB, "index.html"), "utf8", (err, html) => {
    if (err) return next();
    const inject = `<script>try{if(!localStorage.getItem("flok_server"))localStorage.setItem("flok_server",location.origin)}catch(e){}</script>`;
    res.type("html").send(html.replace("<head>", "<head>" + inject));
  });
});
app.use(express.static(WEB, { extensions: ["html"], maxAge: "1h" }));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(WEB, "index.html"));
});

app.use((req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Не найдено" });
  res.status(404).send("Not found");
});
app.use((err, _req, res, _next) => {
  console.error("Flok server error:", err);
  res.status(500).json({ error: "Внутренняя ошибка сервера" });
});

server.listen(PORT, HOST, () => {
  console.log("Flok server: http://" + HOST + ":" + PORT);
  console.log("Data: " + DATA_FILE);
});

function shutdown() {
  clearInterval(heartbeat);
  saveNow();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2500).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
