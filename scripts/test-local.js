const http = require("http");
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("/data/data/cat.narezany.margycode/cache/tmp/floktest/node_modules/jsdom");

const ROOT = path.join(__dirname, "..", "web");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const file = path.join(ROOT, p);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end("no"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => errors.push("JSDOM: " + e.message));
  vc.on("error", (...e) => errors.push("console.error: " + e.join(" ")));
  const dom = await JSDOM.fromURL(`http://127.0.0.1:${port}/index.html`, {
    runScripts: "dangerously", resources: "usable", pretendToBeVisual: true, virtualConsole: vc
  });
  const { window } = dom;
  const doc = window.document;
  await wait(1800);
  const log = (...a) => console.log(...a);
  log("FA?", !!window.FA, "S?", !!window.FLOK, "auth visible:", !doc.querySelector("#auth").classList.contains("hidden"));
  log("boot exists:", !!doc.querySelector("#boot"));

  const demo = doc.querySelector('[data-act="demo"]');
  if (!demo) throw new Error("no demo button");
  demo.click();
  await wait(900);
  log("after demo: app visible:", !doc.querySelector("#app").classList.contains("hidden"), "me:", window.FLOK.S.me() && window.FLOK.S.me().username);
  log("nav tabs:", doc.querySelectorAll(".nav-btn").length, "chat items:", doc.querySelectorAll(".chat-item").length);

  const chat = doc.querySelector(".chat-item");
  if (!chat) throw new Error("no chat");
  chat.click();
  await wait(600);
  log("chat open:", !!doc.querySelector(".chat-page"), "messages:", doc.querySelectorAll(".bubble").length);
  const form = doc.querySelector("#chatForm");
  form.querySelector("[name=msg]").value = "Привет! Как дела?";
  form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await wait(4000);
  log("after send bubbles:", doc.querySelectorAll(".bubble").length, "typing:", !!doc.querySelector(".typing"));
  const bubbles = [...doc.querySelectorAll(".bubble .txt")].map((b) => b.textContent);
  log("last:", bubbles[bubbles.length - 1]);

  window.FA.actions["close-layer"]();
  await wait(600);

  window.FA.actions["tab"]({ dataset: { tab: "market" } });
  await wait(700);
  log("market rendered:", !!doc.querySelector(".market-hero"), "listings:", doc.querySelectorAll(".gift-grid .gift-card").length);
  window.FA.actions["market-tab"]({ dataset: { sub: "shop" } });
  await wait(500);
  log("shop cards:", doc.querySelectorAll(".gift-grid .gift-card").length);
  const shopCard = doc.querySelector(".gift-grid .gift-card");
  shopCard.click();
  await wait(400);
  log("gift sheet:", !!doc.querySelector('[data-act="buy-gift"]'));
  const buyBtn = doc.querySelector('[data-act="buy-gift"]');
  if (buyBtn) {
    buyBtn.click();
    await wait(300);
    log("confirm:", !!doc.querySelector('[data-act="confirm-yes"]'));
    doc.querySelector('[data-act="confirm-yes"]').click();
    await wait(900);
    log("me gifts after buy:", window.FLOK.S.me().gifts.length, "balance:", window.FLOK.S.me().balance);
  }

  window.FA.actions["tab"]({ dataset: { tab: "clicker" } });
  await wait(500);
  log("clicker blob:", !!doc.querySelector(".tap-blob"), "energy:", window.FLOK.S.me().clicker.energy);
  const before = window.FLOK.S.me().balance;
  doc.querySelector(".tap-blob").click();
  await wait(300);
  log("tap +:", window.FLOK.S.me().balance - before, "taps:", window.FLOK.S.me().clicker.totalTaps);

  window.FA.actions["tab"]({ dataset: { tab: "profile" } });
  await wait(700);
  log("profile:", !!doc.querySelector(".profile-cover"), "shelf gifts:", doc.querySelectorAll(".shelf .gift-card").length, "bgs:", doc.querySelectorAll(".bg-card").length);

  window.FA.actions["tab"]({ dataset: { tab: "wallet" } });
  await wait(500);
  log("wallet:", !!doc.querySelector(".wallet-hero"), "tx:", doc.querySelectorAll(".tx").length);

  window.FA.actions["tab"]({ dataset: { tab: "chats" } });
  await wait(500);
  log("chats again:", doc.querySelectorAll(".chat-item").length);
  log("errors:", errors.slice(0, 8));
  server.close();
  process.exit(0);
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
