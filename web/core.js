/* Flok core — local-first store, auth, catalog helpers */
window.FLOK = (function () {
  "use strict";
  const C = window.FLOK_CATALOG;
  const KEY = "flok_state_v2";
  const DAY = 86400000;

  /* ---------- tiny utils ---------- */
  const uid = (p) => (p || "x") + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const fmt = (n) => Math.round(Number(n) || 0).toLocaleString("ru-RU");
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const dayKey = (ts) => { const d = new Date(ts || Date.now()); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const HHMM = (ts) => { const d = new Date(ts); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
  const timeAgo = (ts) => {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return "только что";
    if (s < 3600) return Math.floor(s / 60) + " мин назад";
    if (s < 86400) return Math.floor(s / 3600) + " ч назад";
    if (s < 172800) return "вчера";
    return new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  };
  const listTime = (ts) => {
    if (!ts) return "";
    const now = new Date();
    if (dayKey(ts) === dayKey(now)) return HHMM(ts);
    if (dayKey(ts) === dayKey(now - DAY)) return "вчера";
    return new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "2-digit" });
  };
  const dayLabel = (ts) => {
    const now = Date.now();
    if (dayKey(ts) === dayKey(now)) return "Сегодня";
    if (dayKey(ts) === dayKey(now - DAY)) return "Вчера";
    return new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  };
  const normalize = (s) => String(s || "").trim().toLowerCase().replace(/^@/, "");
  const onlyDigits = (s) => String(s || "").replace(/\D/g, "");
  const initial = (name) => (String(name || "?").trim()[0] || "?").toUpperCase();
  const giftById = (id) => C.GIFTS.find((g) => g.id === id);
  const bgById = (id) => C.BACKGROUNDS.find((b) => b.id === id);
  const rarityColor = (r) => (C.RARITIES[r] || C.RARITIES.common).color;
  const rarityLabel = (r) => (C.RARITIES[r] || C.RARITIES.common).label;
  const giftColors = (g) => {
    const map = {
      common: ["#8ff0d3", "#5ec8b5", "#2e6b63"],
      rare: ["#a9c9ff", "#6d8dff", "#3c4e9e"],
      epic: ["#dcb6ff", "#9b6bff", "#4e2c87"],
      legendary: ["#ffe6a8", "#ffb85c", "#8a5a1f"],
      halloween: ["#ffc18a", "#ff6b4a", "#5e1f2e"]
    };
    return map[g.rarity] || map.common;
  };
  const txIcon = (type) => ({ clicker: "✨", daily: "🎁", shop: "🛍", sale: "💰", market: "🛒", bg: "🌌", gift: "💝", upgrade: "⚡" }[type] || "◈");
  const BOT_MAP = {};
  C.BOTS.forEach((b) => { BOT_MAP[b.id] = b; });

  function hexHash(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
  }
  async function hashPass(pass, salt) {
    const txt = salt + ":" + pass;
    try {
      if (window.crypto && crypto.subtle) {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
        return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
      }
    } catch (e) { /* fallback */ }
    return hexHash(txt);
  }
  function store() {
    try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; }
  }
  function persist(db) {
    try { localStorage.setItem(KEY, JSON.stringify(db)); return true; }
    catch (e) { console.warn("Flok storage full", e); return false; }
  }
  function readFileAsDataURL(file) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  }

  /* ---------- seed helpers ---------- */
  function seedChannels() {
    const out = {};
    const now = Date.now();
    C.CHANNELS.forEach((c) => {
      out[c.id] = {
        id: c.id, name: c.name, handle: c.handle, about: c.about, emoji: c.emoji, color: c.color,
        official: !!c.official, subscribers: c.subscribers, ownerId: "bot_flok", createdAt: now - 40 * DAY,
        posts: c.posts.map((p, i) => ({ id: uid("p_"), text: p.text, ts: now - p.ago * 60000, views: p.views, authorId: c.id === "ch_news" ? "bot_flok" : pick(C.BOTS).id }))
      };
    });
    return out;
  }
  function seedListings(users) {
    const out = [];
    const pool = C.GIFTS.filter((g) => g.rarity !== "halloween");
    for (let i = 0; i < 9; i++) {
      const bot = C.BOTS[Math.floor(Math.random() * C.BOTS.length)];
      const g = pick(pool);
      const factor = rnd(0.82, 1.25);
      out.push({
        id: uid("l_"), giftId: g.id, serial: Math.floor(rnd(1, Math.max(2, Math.min(g.supply, 400)))),
        price: Math.round(g.price * factor / 10) * 10, sellerId: bot.id, ts: Date.now() - Math.floor(rnd(2, 300)) * 60000
      });
    }
    const hall = C.GIFTS.filter((g) => g.rarity === "halloween");
    hall.forEach((g) => out.push({ id: uid("l_"), giftId: g.id, serial: Math.floor(rnd(1, Math.max(2, g.supply))), price: Math.round(g.price * rnd(0.95, 1.15) / 10) * 10, sellerId: pick(C.BOTS).id, ts: Date.now() - Math.floor(rnd(5, 120)) * 60000 }));
    return out.slice(0, 12);
  }
  function defaultClicker() {
    return { tapLvl: 1, energyLvl: 1, autoLvl: 0, energy: 500, lastEnergy: Date.now(), lastAuto: Date.now(), autoCarry: 0, totalTaps: 0, totalEarned: 0 };
  }
  function freshDb() {
    const db = { v: 2, users: {}, session: null, chats: {}, listings: [], minted: {}, channels: seedChannels(), createdAt: Date.now() };
    db.listings = seedListings(db.users);
    return db;
  }

  /* ---------- store ---------- */
  class LocalStore {
    constructor() {
      this.mode = "local";
      this.db = store() || freshDb();
      if (!this.db.channels) this.db.channels = seedChannels();
      if (!this.db.listings) this.db.listings = [];
      if (!this.db.minted) this.db.minted = {};
      this.listeners = [];
      this.typing = {};
      this.activeChat = null;
    }
    on(fn) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter((f) => f !== fn); }; }
    emit(type, data) { this.listeners.forEach((f) => { try { f(type, data); } catch (e) { console.error(e); } }); }
    save() { persist(this.db); }
    saveSoon() { clearTimeout(this._t); this._t = setTimeout(() => this.save(), 700); }
    bot(id) { return BOT_MAP[id] || null; }
    botProfile(b) {
      const botBg = { bot_luna: "cosmos1", bot_kai: "cosmos3", bot_mira: "cosmos2", bot_alice: "rose", bot_max: "sunset" };
      return { id: b.id, username: b.username, name: b.name, bio: b.bio, avatar: { emoji: b.emoji, color: b.color }, bot: true, online: true, bg: botBg[b.id] || "default", gifts: [] };
    }
    localProfile(u) {
      const publicGifts = (u.gifts || []).map((o) => {
        const gift = giftById(o.giftId);
        return gift ? { uid: o.uid, giftId: o.giftId, serial: o.serial, gift, ts: o.ts, from: o.from || "" } : null;
      }).filter(Boolean);
      return {
        id: u.id, username: u.username, name: u.name, bio: u.bio, avatar: u.avatar, bot: false,
        email: u.email, phone: u.phone, createdAt: u.createdAt, online: true,
        bg: u.bg || "default", gifts: publicGifts
      };
    }
    profileOf(id) {
      if (BOT_MAP[id]) return this.botProfile(BOT_MAP[id]);
      const u = this.db.users[id];
      return u ? this.localProfile(u) : { id, username: "user", name: "Пользователь", avatar: {}, bot: false };
    }
    me() { return this.db.session ? this.db.users[this.db.session] : null; }
    chattersFor(id) { return this.db.users[id] || (BOT_MAP[id] ? this.botProfile(BOT_MAP[id]) : null); }

    async boot() {
      if (!this.me()) return { session: false };
      this.tickPassive(true);
      return { session: true };
    }
    async register({ username, name, email, password, phone }) {
      username = normalize(username).replace(/[^a-z0-9_]/g, "");
      if (username.length < 3) throw new Error("Ник — минимум 3 символа (a-z, 0-9, _)");
      if (username.length > 20) throw new Error("Ник — максимум 20 символов");
      if (BOT_MAP["bot_" + username] || C.BOTS.some((b) => b.username === username)) throw new Error("Этот ник уже занят");
      if (Object.values(this.db.users).some((u) => u.username === username)) throw new Error("Этот ник уже занят");
      if (!password || password.length < 4) throw new Error("Пароль — минимум 4 символа");
      if (email) {
        email = email.trim().toLowerCase();
        if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Похоже, e-mail с ошибкой");
        if (Object.values(this.db.users).some((u) => u.email === email)) throw new Error("Этот e-mail уже используется");
      }
      const salt = uid("s");
      const user = {
        id: uid("u"), username, name: (name || "").trim() || username, email: email || "", phone: onlyDigits(phone) || "",
        salt, passHash: await hashPass(password, salt), createdAt: Date.now(),
        avatar: { emoji: "", color: pick(C.AVATAR_COLORS), image: "" },
        bio: "Новичок в Flok 🫧", balance: 3000, gifts: [], bg: "default", ownedBgs: ["default"],
        chatIds: [], contacts: [], channelIds: ["ch_news"], tx: [], unread: {},
        clicker: defaultClicker(), daily: { last: "", streak: 0 }
      };
      this.db.users[user.id] = user;
      this.db.session = user.id;
      const welcome = this.ensureChat(user.id, "bot_flok");
      const bot = BOT_MAP["bot_flok"];
      welcome.messages = bot.starter.map((text, i) => ({ id: uid("m"), from: bot.id, text, ts: Date.now() - (bot.starter.length - i) * 60000 }));
      welcome.updatedAt = Date.now();
      user.unread[welcome.id] = 1;
      if (!user.chatIds.includes(welcome.id)) user.chatIds.push(welcome.id);
      this.db.channels["ch_news"] && (user.unread["ch_news"] = 1);
      this.save();
      return this.safeMe();
    }
    async login({ login, password }) {
      const q = normalize(login);
      const digits = onlyDigits(login);
      const u = Object.values(this.db.users).find((x) => x.username === q || (x.email && x.email === q) || (digits && x.phone === digits));
      if (!u) throw new Error("Аккаунт не найден");
      const h = await hashPass(password, u.salt);
      if (h !== u.passHash) throw new Error("Неверный пароль");
      this.db.session = u.id;
      this.tickPassive(true);
      this.save();
      return this.safeMe();
    }
    async logout() { this.db.session = null; this.save(); }
    safeMe() {
      const me = this.me();
      if (!me) return null;
      this.tickPassive(false);
      return me;
    }
    tickPassive(refresh) {
      const me = this.me();
      if (!me) return;
      const now = Date.now();
      const c = me.clicker || (me.clicker = defaultClicker());
      const maxE = 500 + (c.energyLvl - 1) * 150;
      const gained = Math.floor((now - (c.lastEnergy || now)) / 1000 * 2);
      if (gained > 0) { c.energy = Math.min(maxE, (c.energy || 0) + gained); c.lastEnergy = now; }
      if (refresh) c.lastEnergy = now;
      c.energy = clamp(c.energy, 0, maxE);
      const autoHour = (c.autoLvl || 0) * 120;
      if (autoHour > 0) {
        const ms = now - (c.lastAuto || now);
        const earn = (ms / 3600000) * autoHour;
        c.autoCarry = (c.autoCarry || 0) + earn;
        const whole = Math.floor(c.autoCarry);
        if (whole > 0) {
          c.autoCarry -= whole;
          me.balance += whole;
          c.totalEarned = (c.totalEarned || 0) + whole;
          if (whole >= 20) this.addTx(me, "daily", "Дроны-фармеры", whole, true, false);
        }
        c.lastAuto = now;
      }
      this.saveSoon();
    }
    addTx(me, type, title, amount, plus, save) {
      me.tx.unshift({ id: uid("t"), type, title, amount, plus, ts: Date.now() });
      if (me.tx.length > 120) me.tx.length = 120;
      if (save !== false) this.saveSoon();
    }

    ensureChat(meId, peerId) {
      const find = Object.values(this.db.chats).find((c) => c.type === "dm" && c.members.includes(meId) && c.members.includes(peerId));
      if (find) return find;
      const chat = { id: uid("c"), type: "dm", members: [meId, peerId], messages: [], updatedAt: Date.now() };
      this.db.chats[chat.id] = chat;
      [meId, peerId].forEach((id) => {
        const u = this.db.users[id];
        if (u && !u.chatIds.includes(chat.id)) u.chatIds.push(chat.id);
      });
      return chat;
    }
    async getChats() {
      const me = this.me();
      if (!me) return [];
      const list = [];
      me.chatIds.forEach((id) => {
        const c = this.db.chats[id];
        if (!c) return;
        const peerId = c.members.find((m) => m !== me.id);
        const last = c.messages[c.messages.length - 1];
        list.push({ id: c.id, peer: this.profileOf(peerId), last, unread: me.unread[c.id] || 0, updatedAt: last ? last.ts : c.updatedAt, typing: !!this.typing[c.id] });
      });
      return list.sort((a, b) => (b.unread ? 1 : 0) - (a.unread ? 1 : 0) || b.updatedAt - a.updatedAt);
    }
    async startChat(peerId) {
      const me = this.me();
      if (!me) throw new Error("Нужен вход");
      if (peerId === me.id) throw new Error("Это ты");
      if (!this.chattersFor(peerId)) throw new Error("Пользователь не найден");
      const chat = this.ensureChat(me.id, peerId);
      this.save();
      return chat.id;
    }
    async getChatMessages(chatId) {
      const c = this.db.chats[chatId];
      if (!c) return [];
      const me = this.me();
      if (me && me.unread[chatId]) { me.unread[chatId] = 0; this.saveSoon(); }
      this.activeChat = chatId;
      return c.messages.slice();
    }
    async sendMessage(chatId, payload) {
      const me = this.me();
      const c = this.db.chats[chatId];
      if (!me || !c) throw new Error("Чат не найден");
      const msg = { id: uid("m"), from: me.id, text: (payload.text || "").slice(0, 4000), img: payload.img || "", gift: payload.gift || null, ts: Date.now() };
      if (!msg.text && !msg.img && !msg.gift) return null;
      c.messages.push(msg);
      c.updatedAt = msg.ts;
      this.save();
      this.emit("message", { chatId, msg });
      const peerId = c.members.find((m) => m !== me.id);
      const bot = this.bot(peerId);
      if (bot) this.scheduleBotReply(chatId, bot);
      else if (peerId && this.db.users[peerId]) {
        const peer = this.db.users[peerId];
        peer.unread[chatId] = (peer.unread[chatId] || 0) + 1;
        peer.chatIds.includes(chatId) || peer.chatIds.push(chatId);
        this.save();
      }
      return msg;
    }
    scheduleBotReply(chatId, bot) {
      if (this.typing[chatId]) return;
      this.typing[chatId] = true;
      this.emit("typing", { chatId, on: true });
      setTimeout(() => {
        const c = this.db.chats[chatId];
        if (!c) { this.typing[chatId] = false; return; }
        const me = this.me();
        let text = pick(bot.replies);
        const lastMine = [...c.messages].reverse().find((m) => m.from === me.id && m.text);
        if (lastMine && /привет|хай|здоров|ку/i.test(lastMine.text)) text = pick(["Привет! Рад тебя видеть 🫧", "Хей! Как дела?", "Привет-привет! Что нового?"]);
        if (lastMine && /подар|гифт|маркет/i.test(lastMine.text)) text = pick(["Люблю маркет — там иногда попадаются редкие серии за смешные деньги 👀", "Совет: выставляй цену чуть ниже остальных, тогда купят быстрее.", "Хэллоуинская коллекция — самая красивая. Жалко, что лимитка."]);
        const msg = { id: uid("m"), from: bot.id, text, ts: Date.now() };
        c.messages.push(msg);
        c.updatedAt = msg.ts;
        this.typing[chatId] = false;
        const meNow = this.me();
        if (meNow && this.activeChat !== chatId) { meNow.unread[chatId] = (meNow.unread[chatId] || 0) + 1; }
        this.save();
        this.emit("message", { chatId, msg });
        this.emit("typing", { chatId, on: false });
      }, 1400 + Math.random() * 1900);
    }
    async addContact(query) {
      const me = this.me();
      const q = normalize(query);
      const digits = onlyDigits(query);
      if (!q) throw new Error("Введи ник, e-mail или телефон");
      let found = null;
      const bot = C.BOTS.find((b) => b.username === q || normalize(b.name) === q);
      if (bot) found = this.botProfile(bot);
      if (!found) {
        found = Object.values(this.db.users).find((u) => u.username === q || (u.email && u.email === q) || (digits && u.phone === digits)) || null;
        if (found) found = this.localProfile(found);
      }
      if (!found) throw new Error("Никого не нашли. Проверь ник или телефон.");
      if (found.id === me.id) throw new Error("Это твой собственный аккаунт 🙂");
      if (!me.contacts.includes(found.id)) me.contacts.push(found.id);
      this.save();
      return found;
    }
    async getContacts() {
      const me = this.me();
      const map = new Map();
      (me.contacts || []).forEach((id) => map.set(id, this.profileOf(id)));
      C.BOTS.forEach((b) => { if (b.id !== "bot_flok") map.set(b.id, this.botProfile(b)); });
      Object.values(this.db.users).forEach((u) => { if (u.id !== me.id) map.set(u.id, this.localProfile(u)); });
      return Array.from(map.values());
    }
    async searchPeople(q) {
      const s = normalize(q);
      const all = await this.getContacts();
      if (!s) return all;
      return all.filter((p) => normalize(p.username).includes(s) || normalize(p.name).includes(s) || (p.email && p.email.includes(s)) || (p.phone && p.phone.includes(onlyDigits(q))));
    }

    async getChannels() {
      const me = this.me();
      return Object.values(this.db.channels).map((c) => ({
        ...c, joined: me ? me.channelIds.includes(c.id) : false, isOwner: me ? c.ownerId === me.id : false,
        last: c.posts[c.posts.length - 1] || null
      })).sort((a, b) => (b.joined ? 1 : 0) - (a.joined ? 1 : 0) || b.subscribers - a.subscribers);
    }
    async getChannel(id) {
      const me = this.me();
      const c = this.db.channels[id];
      if (!c) throw new Error("Канал не найден");
      if (me && me.unread && me.unread[id]) { me.unread[id] = 0; this.saveSoon(); }
      return { ...c, joined: me.channelIds.includes(id), isOwner: c.ownerId === me.id, author: this.profileOf(c.ownerId) };
    }
    async joinChannel(id) {
      const me = this.me();
      const c = this.db.channels[id];
      if (!c) throw new Error("Канал не найден");
      if (!me.channelIds.includes(id)) { me.channelIds.push(id); c.subscribers++; this.save(); }
      return true;
    }
    async leaveChannel(id) {
      const me = this.me();
      const c = this.db.channels[id];
      if (!c) return;
      me.channelIds = me.channelIds.filter((x) => x !== id);
      c.subscribers = Math.max(0, c.subscribers - 1);
      this.save();
    }
    async createChannel({ name, about, emoji, color }) {
      const me = this.me();
      name = String(name || "").trim();
      if (name.length < 2) throw new Error("Название — минимум 2 символа");
      const id = uid("ch_");
      const channel = {
        id, name: name.slice(0, 40), handle: "@" + me.username, about: (about || "").slice(0, 160), emoji: emoji || "🫧",
        color: color || "#58e0bd", official: false, subscribers: 1, ownerId: me.id, createdAt: Date.now(),
        posts: [{ id: uid("p_"), text: "Канал создан. Здесь будет только важное ✨", ts: Date.now(), views: 1, authorId: me.id }]
      };
      this.db.channels[id] = channel;
      if (!me.channelIds.includes(id)) me.channelIds.push(id);
      this.save();
      return id;
    }
    async postChannel(id, text) {
      const me = this.me();
      const c = this.db.channels[id];
      if (!c) throw new Error("Канал не найден");
      if (c.ownerId !== me.id) throw new Error("Писать может только владелец");
      text = String(text || "").trim();
      if (!text) return;
      c.posts.unshift({ id: uid("p_"), text: text.slice(0, 3000), ts: Date.now(), views: 1, authorId: me.id });
      this.save();
      return true;
    }

    async getMarket() {
      const me = this.me();
      return this.db.listings.map((l) => {
        const g = giftById(l.giftId);
        return { ...l, gift: g, seller: this.profileOf(l.sellerId), mine: me ? l.sellerId === me.id : false };
      }).filter((l) => l.gift).sort((a, b) => b.ts - a.ts);
    }
    async getShopInfo() {
      const counts = {};
      C.GIFTS.forEach((g) => { counts[g.id] = this.db.minted[g.id] || 0; });
      return counts;
    }
    async buyGift(giftId) {
      const me = this.me();
      const g = giftById(giftId);
      if (!g) throw new Error("Подарок не найден");
      if (me.balance < g.price) throw new Error("Недостаточно Flok. Заработай в кликере или продай подарок.");
      const minted = this.db.minted[g.id] || 0;
      if (minted >= g.supply) throw new Error("Весь тираж раскуплен");
      this.db.minted[g.id] = minted + 1;
      me.balance -= g.price;
      const owned = { uid: uid("g"), giftId: g.id, serial: minted + 1, ts: Date.now() };
      me.gifts.push(owned);
      this.addTx(me, "shop", "Подарок: " + g.name, g.price, false);
      this.save();
      this.emit("market");
      return owned;
    }
    async getMyGifts() {
      const me = this.me();
      return me.gifts.map((o) => {
        const g = giftById(o.giftId);
        const listing = this.db.listings.find((l) => l.giftId === o.giftId && l.sellerId === me.id && l.serial === o.serial);
        return { ...o, gift: g, listing };
      }).filter((o) => o.gift).sort((a, b) => b.ts - a.ts);
    }
    async listGift(uidStr, price) {
      const me = this.me();
      const owned = me.gifts.find((g) => g.uid === uidStr);
      if (!owned) throw new Error("Подарок не найден");
      price = Math.round(Number(price));
      if (!price || price < 10) throw new Error("Минимальная цена — 10 Flok");
      if (price > 9999999) throw new Error("Слишком дорого даже для Flok");
      if (this.db.listings.some((l) => l.giftId === owned.giftId && l.serial === owned.serial && l.sellerId === me.id)) throw new Error("Подарок уже выставлен");
      const listing = { id: uid("l_"), giftId: owned.giftId, serial: owned.serial, price, sellerId: me.id, ts: Date.now(), cid: owned.uid };
      this.db.listings.push(listing);
      this.save();
      this.scheduleBotBuy(listing.id);
      this.emit("market");
      return listing;
    }
    scheduleBotBuy(listingId) {
      if (Math.random() > 0.62) return;
      setTimeout(() => {
        const l = this.db.listings.find((x) => x.id === listingId);
        if (!l) return;
        const seller = this.db.users[l.sellerId];
        if (!seller) return;
        const g = giftById(l.giftId);
        this.db.listings = this.db.listings.filter((x) => x.id !== listingId);
        const payout = Math.round(l.price * 0.95);
        seller.balance += payout;
        seller.gifts = seller.gifts.filter((x) => x.uid !== l.cid);
        this.addTx(seller, "sale", "Продажа: " + (g ? g.name : "подарок"), payout, true);
        this.save();
        this.emit("sold", { listing: l, buyer: this.profileOf(pick(C.BOTS).id), payout });
        this.emit("market");
      }, 16000 + Math.random() * 26000);
    }
    async cancelListing(id) {
      const me = this.me();
      const l = this.db.listings.find((x) => x.id === id);
      if (!l) throw new Error("Лот не найден");
      if (l.sellerId !== me.id) throw new Error("Это не твой лот");
      this.db.listings = this.db.listings.filter((x) => x.id !== id);
      this.save();
      this.emit("market");
    }
    async buyListing(id) {
      const me = this.me();
      const l = this.db.listings.find((x) => x.id === id);
      if (!l) throw new Error("Лот уже продан");
      if (l.sellerId === me.id) throw new Error("Нельзя купить свой лот");
      const g = giftById(l.giftId);
      if (me.balance < l.price) throw new Error("Недостаточно Flok");
      me.balance -= l.price;
      const owned = { uid: uid("g"), giftId: l.giftId, serial: l.serial, ts: Date.now(), from: l.sellerId };
      me.gifts.push(owned);
      this.db.listings = this.db.listings.filter((x) => x.id !== id);
      this.addTx(me, "market", "Покупка: " + g.name, l.price, false);
      const seller = this.db.users[l.sellerId];
      if (seller) {
        const payout = Math.round(l.price * 0.95);
        seller.balance += payout;
        if (l.cid) seller.gifts = seller.gifts.filter((x) => x.uid !== l.cid);
        this.addTx(seller, "sale", "Продажа: " + g.name, payout, true);
      }
      this.save();
      this.emit("market");
      return owned;
    }
    async quickSell(uidStr) {
      const me = this.me();
      const idx = me.gifts.findIndex((g) => g.uid === uidStr);
      if (idx < 0) throw new Error("Подарок не найден");
      if (this.db.listings.some((l) => l.cid === uidStr)) throw new Error("Сначала сними лот с маркета");
      const owned = me.gifts[idx];
      const g = giftById(owned.giftId);
      const amount = Math.round(g.price * 0.6);
      me.gifts.splice(idx, 1);
      me.balance += amount;
      this.addTx(me, "sale", "Мгновенная продажа: " + g.name, amount, true);
      this.save();
      this.emit("market");
      return { amount, gift: g };
    }
    async giftTo(uidStr, toId) {
      const me = this.me();
      const idx = me.gifts.findIndex((g) => g.uid === uidStr);
      if (idx < 0) throw new Error("Подарок не найден");
      if (this.db.listings.some((l) => l.cid === uidStr)) throw new Error("Сначала сними лот с маркета");
      const recipient = this.chattersFor(toId);
      if (!recipient) throw new Error("Получатель не найден");
      const owned = me.gifts[idx];
      const g = giftById(owned.giftId);
      me.gifts.splice(idx, 1);
      const target = this.db.users[toId];
      if (target) {
        target.gifts.push({ ...owned, from: me.id, ts: Date.now() });
        target.unread = target.unread || {};
        this.save();
      }
      this.addTx(me, "gift", "Подарок: " + g.name + " → " + (recipient.name || recipient.username), 0, false);
      const chat = this.ensureChat(me.id, toId);
      const msg = { id: uid("m"), from: me.id, gift: { giftId: g.id, serial: owned.serial, name: g.name, price: g.price }, ts: Date.now() };
      chat.messages.push(msg);
      chat.updatedAt = msg.ts;
      if (target) target.unread[chat.id] = (target.unread[chat.id] || 0) + 1;
      this.save();
      this.emit("message", { chatId: chat.id, msg });
      return { gift: g, recipient };
    }
    async getBackgrounds() {
      const me = this.me();
      return C.BACKGROUNDS.map((b) => ({ ...b, owned: b.price === 0 || me.ownedBgs.includes(b.id), selected: me.bg === b.id }));
    }
    async buyBackground(id) {
      const me = this.me();
      const b = bgById(id);
      if (!b) throw new Error("Фон не найден");
      if (b.price === 0 || me.ownedBgs.includes(id)) throw new Error("Этот фон уже твой");
      if (me.balance < b.price) throw new Error("Недостаточно Flok");
      me.balance -= b.price;
      me.ownedBgs.push(id);
      me.bg = id;
      this.addTx(me, "bg", "Фон профиля: " + b.name, b.price, false);
      this.save();
      return true;
    }
    async selectBackground(id) {
      const me = this.me();
      if (id !== "default" && !me.ownedBgs.includes(id)) throw new Error("Сначала купи фон");
      me.bg = id;
      this.save();
      return true;
    }
    async updateProfile(data) {
      const me = this.me();
      if (data.name != null) {
        const n = String(data.name).trim();
        if (n.length < 1) throw new Error("Имя не может быть пустым");
        me.name = n.slice(0, 40);
      }
      if (data.bio != null) me.bio = String(data.bio).slice(0, 160);
      if (data.avatar) me.avatar = { ...me.avatar, ...data.avatar };
      this.save();
      return this.safeMe();
    }
    async claimDaily() {
      const me = this.me();
      const today = dayKey();
      if (me.daily.last === today) throw new Error("Бонус уже получен. Приходи завтра 🌿");
      const yest = dayKey(Date.now() - DAY);
      me.daily.streak = me.daily.last === yest ? me.daily.streak + 1 : 1;
      me.daily.last = today;
      const amount = Math.min(900, 300 + (me.daily.streak - 1) * 75);
      me.balance += amount;
      this.addTx(me, "daily", "Ежедневный бонус · день " + me.daily.streak, amount, true);
      this.save();
      return { amount, streak: me.daily.streak };
    }
    async click(amount) {
      const me = this.me();
      const c = me.clicker;
      this.tickPassive(false);
      const maxE = 500 + (c.energyLvl - 1) * 150;
      if (c.energy < 1) throw new Error("Энергия закончилась — подожди немного");
      c.energy -= 1;
      c.totalTaps++;
      c.totalEarned += amount;
      me.balance += amount;
      this.saveSoon();
      return { balance: me.balance, energy: c.energy, maxE };
    }
    async upgrade(id) {
      const me = this.me();
      const c = me.clicker;
      const up = C.CLICKER_UPGRADES.find((u) => u.id === id);
      if (!up) throw new Error("Улучшение не найдено");
      const lvl = c[id + "Lvl"] || 0;
      const cost = Math.round(up.base * Math.pow(up.growth, lvl));
      if (me.balance < cost) throw new Error("Недостаточно Flok");
      me.balance -= cost;
      c[id + "Lvl"] = lvl + 1;
      if (id === "energy") c.energy = 500 + (c.energyLvl - 1) * 150;
      this.addTx(me, "upgrade", "Улучшение: " + up.name, cost, false);
      this.save();
      return { cost, lvl: lvl + 1 };
    }
    async getWallet() {
      const me = this.me();
      this.tickPassive(false);
      return { balance: me.balance, tx: me.tx.slice(0, 60), id: "FLK-" + me.id.slice(-6).toUpperCase(), clicker: me.clicker };
    }
  }

  return {
    C, U: { uid, esc, fmt, clamp, pick, rnd, dayKey, HHMM, timeAgo, listTime, dayLabel, normalize, onlyDigits, initial, giftById, bgById, rarityColor, rarityLabel, giftColors, txIcon, hashPass, readFileAsDataURL },
    S: new LocalStore()
  };
})();
