/* Flok UI core — components, auth, shell, modals, routing */
(function (FA) {
  "use strict";
  const { C, U, S } = window.FLOK;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const IC = (n, c) => `<svg class="ic ${c || ""}" aria-hidden="true"><use href="#i-${n}"></use></svg>`;
  const coin = (cls) => `<span class="coin ${cls || ""}">F</span>`;
  const HAPT = () => { try { if (localStorage.getItem("flok_haptics") !== "0" && navigator.vibrate) navigator.vibrate(7); } catch (e) {} };
  const money = (n) => U.fmt(n);
  const ui = {
    tab: "chats", chatTab: "chats", marketTab: "market", filter: "all", search: "", peopleQ: "",
    activeChat: null, activePeer: null, activeChannel: null, typing: {}, pendingImg: "",
    chats: [], contacts: [], channels: [], listings: [], myGifts: [], shop: {}, wallet: null, me: null,
    layerPushed: false, modalPushed: false, busy: false, booted: false, edit: null, connectOnly: false, renderToken: 0
  };
  FA.ui = ui;
  FA.screens = FA.screens || {};
  FA.actions = FA.actions || {};
  FA.submits = FA.submits || {};
  FA.inputs = FA.inputs || {};
  FA.IC = IC; FA.coin = coin; FA.$ = $; FA.$$ = $$; FA.HAPT = HAPT; FA.money = money;

  /* ---------- components ---------- */
  function avatarHTML(p, cls) {
    if (!p) p = { name: "?", avatar: {} };
    const a = p.avatar || {};
    const color = a.color || "#58e0bd";
    const inner = a.image ? `<img src="${U.esc(a.image)}" alt="">` : `<span>${U.esc(a.emoji || U.initial(p.name || p.username))}</span>`;
    return `<span class="avatar ${cls || ""}" style="--ac:${U.esc(color)}">${inner}<i class="presence"></i></span>`;
  }
  function giftArtHTML(g, serial, cls) {
    const c = U.giftColors(g);
    return `<div class="gift-art ${cls || ""}" style="--g1:${c[0]};--g2:${c[1]};--g3:${c[2]}">
      <span class="halo"></span><span class="halo h2"></span>
      ${serial ? `<span class="gift-serial">#${serial}</span>` : ""}
      <span class="gift-seal">✦</span>
      <span class="gift-emoji">${g.emoji}</span>
    </div>`;
  }
  function rarityHTML(r) { return `<span class="rarity" style="--rc:${U.rarityColor(r)}">${U.rarityLabel(r)}</span>`; }
  function priceHTML(n) { return `<span class="price">${coin()} ${money(n)}</span>`; }
  function giftCardHTML(g, opts) {
    opts = opts || {};
    const active = opts.owned;
    return `<button class="gift-card" data-act="${opts.act || "gift-open"}" data-kind="${opts.kind || "shop"}" data-id="${U.esc(opts.id || g.id)}" aria-label="${U.esc(g.name)}">
      ${giftArtHTML(g, opts.serial)}
      <div class="gift-name"><span class="ellipsis">${U.esc(g.name)}</span></div>
      <div class="gift-card-foot">
        ${opts.foot || `<span class="price">${coin()} ${money(opts.price != null ? opts.price : g.price)}</span>`}
        ${active ? `<span class="tiny" style="color:var(--mint)">твой</span>` : ""}
      </div>
    </button>`;
  }
  FA.avatarHTML = avatarHTML; FA.giftArtHTML = giftArtHTML; FA.rarityHTML = rarityHTML;
  FA.priceHTML = priceHTML; FA.giftCardHTML = giftCardHTML;

  function toast(text, opt) {
    opt = opt || {};
    const root = $("#toasts");
    if (!root) return;
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = `${opt.emoji ? `<span class="t-emoji">${opt.emoji}</span>` : `<span class="t-ic">${IC(opt.icon || "check")}</span>`}<span class="grow">${U.esc(text)}</span>`;
    root.appendChild(el);
    setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 320); }, opt.ms || 3300);
  }
  FA.toast = toast;

  /* ---------- modal system ---------- */
  function mountModal(html, cls) {
    const root = $("#modal");
    const already = root.classList.contains("open");
    root.innerHTML = `<div class="modal-backdrop" data-act="close-modal"></div>${html}`;
    if (!already) {
      requestAnimationFrame(() => root.classList.add("open"));
      if (!ui.modalPushed) {
        try { history.pushState({ flokModal: 1 }, ""); ui.modalPushed = true; } catch (e) {}
      }
    }
  }
  function sheet(title, body, opt) {
    opt = opt || {};
    mountModal(`<div class="sheet" role="dialog" aria-modal="true">
      <div class="sheet-grab"></div>
      <div class="sheet-head"><h2>${title}</h2><button class="icon-btn sm plain" data-act="close-modal" aria-label="Закрыть">${IC("close")}</button></div>
      <div class="sheet-body">${body}</div>
    </div>`);
  }
  function confirmSheet(opts) {
    ui.confirmAction = opts.onConfirm;
    mountModal(`<div class="confirm" role="dialog" aria-modal="true">
      <div class="confirm-art">${opts.emoji || IC("check")}</div>
      <h3>${U.esc(opts.title)}</h3>
      <p>${opts.text || ""}</p>
      <div class="confirm-actions">
        <button class="btn btn-ghost" data-act="close-modal">Отмена</button>
        <button class="btn ${opts.danger ? "btn-danger" : "btn-primary"}" data-act="confirm-yes">${U.esc(opts.ok || "Да")}</button>
      </div>
    </div>`);
  }
  function doCloseModal() {
    const root = $("#modal");
    root.classList.remove("open");
    setTimeout(() => { if (!root.classList.contains("open")) root.innerHTML = ""; }, 330);
  }
  function closeModal() {
    if (ui.modalPushed) { ui.modalPushed = false; try { history.back(); } catch (e) { doCloseModal(); } }
    else doCloseModal();
  }
  FA.sheet = sheet; FA.confirmSheet = confirmSheet; FA.closeModal = closeModal; FA.doCloseModal = doCloseModal;
  FA.mountModal = mountModal;

  /* ---------- auth ---------- */
  function serverInfo() {
    try { return localStorage.getItem("flok_server") || ""; } catch (e) { return ""; }
  }
  function renderAuth() {
    const mode = ui.authMode || "login";
    const isReg = mode === "register";
    $("#app").classList.add("hidden");
    const auth = $("#auth");
    auth.classList.remove("hidden");
    const server = serverInfo();
    const net = S.mode === "cloud";
    const down = net && !!ui.bootError;
    auth.innerHTML = `<div class="auth-wrap">
      <div class="auth-brand">
        <span class="logo-orb">${IC("chat")}</span>
        <div class="wordmark">flok</div>
        <div class="tagline">люди · подарки · flok</div>
      </div>
      <div class="glass glass-edge auth-card">
        <div class="seg">
          <button class="seg-btn ${!isReg ? "active" : ""}" data-act="auth-mode" data-mode="login">Вход</button>
          <button class="seg-btn ${isReg ? "active" : ""}" data-act="auth-mode" data-mode="register">Создать</button>
        </div>
        <p class="auth-sub">${isReg ? "Ник и пароль — всё, что нужно. <b>E-mail по желанию</b>, чтобы не потерять аккаунт." : (down ? "Flok-сервер не отвечает. Проверь адрес сети или вернись в локальный режим." : net ? "Вход на сервере Flok — здесь реальные люди." : "С возвращением. Твои подарки и Flok на месте.")}</p>
        <form id="authForm" data-mode="${mode}" class="form-stack" autocomplete="on">
          ${isReg ? `<div class="field">${IC("user")}<input name="name" placeholder="Как тебя зовут" maxlength="40" autocomplete="nickname"></div>` : ""}
          <div class="field">
            ${IC("hash")}
            <input name="username" placeholder="${isReg ? "@username" : "@username или e-mail"}" required autocomplete="username" autocapitalize="none" spellcheck="false">
          </div>
          ${isReg ? `<div class="field">${IC("mail")}<input name="email" type="email" placeholder="E-mail (не обязательно)" autocomplete="email" autocapitalize="none"></div>
          <div class="field">${IC("user")}<input name="phone" type="tel" placeholder="Телефон (не обязательно)" autocomplete="tel" inputmode="tel"></div>` : ""}
          <div class="field">
            ${IC("lock")}
            <input name="password" type="password" placeholder="Пароль" required minlength="4" autocomplete="${isReg ? "new-password" : "current-password"}">
            <button type="button" class="field-action" data-act="toggle-pass" aria-label="Показать пароль">${IC("eye")}</button>
          </div>
          <button class="btn btn-primary btn-block" type="submit">${isReg ? "Создать аккаунт" : "Войти"} ${IC("arrow")}</button>
        </form>
        <div class="auth-foot">
          <button class="mini-link" data-act="demo">Попробовать без регистрации ${IC("arrow", "sm")}</button>
          <button class="server-pill ${net ? (down ? "down" : "online") : ""}" data-act="server-sheet"><i></i>${net ? (down ? "Сервер недоступен" : "Сеть Flok подключена") : "Локальный режим · данные на устройстве"}</button>
          <div class="auth-note">${net ? "Flok-сервер: " + U.esc(server.replace(/^https?:\/\//, "")) : "Демо-режим: аккаунты, чаты и маркет работают на этом устройстве. Подключи сервер, чтобы общаться с реальными людьми."}</div>
        </div>
      </div>
      <div class="center" style="margin-top:16px"><span class="tiny faint">Flok 1.0 · сделано с заботой о людях</span></div>
    </div>`;
  }
  FA.renderAuth = renderAuth;

  function showAuth() {
    $("#app").classList.add("hidden");
    $("#auth").classList.remove("hidden");
    renderAuth();
  }
  FA.showAuth = showAuth;
  function showApp() {
    $("#auth").classList.add("hidden");
    $("#app").classList.remove("hidden");
    ui.me = S.me();
    renderNav();
    FA.setTab(ui.tab || "chats", true);
  }
  FA.showApp = showApp;

  /* ---------- nav / shell ---------- */
  function renderNav() {
    const items = [["chats", "Чаты", "chat"], ["market", "Маркет", "bag"], ["clicker", "Кликер", "spark"], ["wallet", "Кошелёк", "coin"], ["profile", "Профиль", "user"]];
    const unread = (ui.chats || []).reduce((s, c) => s + (c.unread || 0), 0);
    $("#nav").innerHTML = items.map(([id, label, icon]) => `<button class="nav-btn ${ui.tab === id ? "active" : ""}" data-act="tab" data-tab="${id}" aria-label="${label}">
      <span class="nav-ic">${IC(icon)}</span><span class="nav-label">${label}</span>
      ${id === "chats" && unread ? `<span class="nav-dot"></span>` : ""}
    </button>`).join("");
    const active = $(`#nav .nav-btn[data-tab="${ui.tab}"]`);
    if (active) active.classList.add("pop");
  }
  FA.renderNav = renderNav;

  function setTab(tab, first) {
    if (!["chats", "market", "clicker", "wallet", "profile"].includes(tab)) tab = "chats";
    ui.tab = tab;
    ui.search = "";
    ui.peopleQ = "";
    renderNav();
    const screen = $("#screen");
    screen.classList.remove("enter");
    void screen.offsetWidth;
    screen.classList.add("enter");
    const render = FA.screens[tab];
    if (render) render();
    try { window.scrollTo(0, 0); screen.scrollTop = 0; } catch (e) {}
    HAPT();
  }
  FA.setTab = setTab;

  function renderScreen() {
    if (!S.me()) { showAuth(); return; }
    const render = FA.screens[ui.tab];
    if (render) render();
    renderNav();
  }
  FA.renderScreen = renderScreen;

  /* ---------- boot ---------- */
  async function init() {
    const boot = $("#boot");
    let bootError = "";
    try {
      const result = await S.boot();
      if (result && result.error) {
        bootError = /войти/i.test(result.error) ? "Сессия истекла — войди снова" : result.error;
        if (!/Сессия истекла/.test(bootError)) ui.bootError = bootError;
      }
    } catch (e) { bootError = e.message; console.error(e); }
    ui.booted = true;
    setTimeout(() => {
      boot.classList.add("out");
      setTimeout(() => boot.remove(), 500);
      if (S.me()) showApp();
      else {
        ui.authMode = "login";
        showAuth();
        if (bootError) setTimeout(() => toast("Flok-сервер недоступен: " + bootError, { emoji: "📡", ms: 6000 }), 700);
      }
    }, 450);
    S.on(function (type, data) { if (FA.onStoreEvent) FA.onStoreEvent(type, data); });
    setInterval(() => {
      if (!S.me()) return;
      try { S.tickPassive(false); } catch (e) {}
      if (FA.onTick) FA.onTick();
    }, 1600);
    window.addEventListener("popstate", () => {
      const modalOpen = $("#modal").classList.contains("open");
      if (modalOpen) { ui.modalPushed = false; doCloseModal(); return; }
      if (ui.layerPushed) { ui.layerPushed = false; if (FA.doCloseLayer) FA.doCloseLayer(); }
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && S.me()) { try { S.tickPassive(false); } catch (e) {} if (FA.onTick) FA.onTick(); }
    });
  }
  FA.init = init;

  /* ---------- actions: shared ---------- */
  FA.actions["auth-mode"] = (el) => { ui.authMode = el.dataset.mode; renderAuth(); };
  FA.actions["toggle-pass"] = (el) => {
    const input = el.parentElement.querySelector("input");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    el.innerHTML = IC(show ? "eye-off" : "eye");
  };
  FA.actions["demo"] = async () => {
    try {
      const n = "guest" + Math.floor(1000 + Math.random() * 9000);
      await S.register({ username: n, name: "Гость", password: "flok" + n, email: "" });
      enterApp();
      toast("Добро пожаловать в Flok! Начни с Маркета 🫧", { emoji: "🫧" });
    } catch (e) { toast(e.message, { emoji: "⚠️" }); }
  };
  function enterApp() {
    ui.me = S.me();
    ui.tab = "chats";
    $("#auth").classList.add("hidden");
    $("#app").classList.remove("hidden");
    showApp();
  }
  FA.enterApp = enterApp;

  FA.actions["tab"] = (el) => { setTab(el.dataset.tab); };
  FA.actions["close-modal"] = () => closeModal();
  FA.actions["confirm-yes"] = async () => {
    const fn = ui.confirmAction;
    ui.confirmAction = null;
    if (!fn) return;
    try { await fn(); closeModal(); } catch (e) { toast(e.message, { emoji: "⚠️" }); }
  };
  FA.actions["copy"] = async (el) => {
    const text = el.dataset.text || "";
    try { await navigator.clipboard.writeText(text); toast("Скопировано"); }
    catch (e) {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); toast("Скопировано"); } catch (e2) { toast("Не получилось скопировать", { emoji: "⚠️" }); }
      ta.remove();
    }
  };
  FA.actions["server-sheet"] = () => {
    const cur = serverInfo();
    sheet("Сеть Flok", `<p class="sheet-lead">Введи адрес Flok-сервера, чтобы общаться с реальными людьми, торговать на общем маркете и заходить с других устройств.</p>
      <form id="serverForm" class="form-stack">
        <div class="field">${IC("hash")}<input name="url" placeholder="https://flok.example.com" value="${U.esc(cur)}" autocapitalize="none"></div>
        <button class="btn btn-primary btn-block" type="submit">${IC("check")} Подключиться</button>
      </form>
      <p class="sheet-note">Сервер лежит в папке <b>server</b> проекта. Запусти его на Node-хостинге и вставь адрес сюда. Без сервера всё работает локально — данные остаются на устройстве.</p>
      ${cur ? `<button class="btn btn-ghost btn-block mt12" data-act="server-off">Вернуться в локальный режим</button>` : ""}`);
  };
  FA.actions["server-off"] = () => {
    localStorage.removeItem("flok_server");
    toast("Локальный режим"); location.reload();
  };
  FA.submits["serverForm"] = (form) => {
    let url = form.elements.url.value.trim().replace(/\/+$/, "");
    if (!/^https?:\/\//.test(url)) url = "https://" + url;
    if (!/^https?:\/\/[^\s]+$/.test(url)) { toast("Похоже, адрес с ошибкой", { emoji: "⚠️" }); return; }
    localStorage.setItem("flok_server", url);
    toast("Подключаемся…");
    setTimeout(() => location.reload(), 400);
  };

  /* ---------- auth form ---------- */
  FA.submits["authForm"] = async (form) => {
    if (ui.busy) return;
    const btn = form.querySelector('button[type="submit"]');
    const old = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = `<span class="typing" style="padding:0"><i></i><i></i><i></i></span>`;
    ui.busy = true;
    try {
      const isReg = form.dataset.mode === "register";
      const username = form.elements.username.value;
      const password = form.elements.password.value;
      if (isReg) {
        await S.register({ username, name: form.elements.name.value, email: form.elements.email.value, phone: form.elements.phone.value, password });
      } else {
        await S.login({ login: username, password });
      }
      enterApp();
      toast(isReg ? "Аккаунт создан. Добро пожаловать 🫧" : "С возвращением ✨", { emoji: "🫧" });
    } catch (e) {
      toast(e.message || "Что-то пошло не так", { emoji: "⚠️" });
      btn.disabled = false; btn.innerHTML = old;
    } finally { ui.busy = false; }
  };

  /* ---------- image helper ---------- */
  window.addEventListener("paste", (e) => {
    if (!ui.activeChat) return;
    const item = Array.from(e.clipboardData && e.clipboardData.items || []).find((i) => i.type.startsWith("image/"));
    if (!item) return;
    handleImageFile(item.getAsFile());
  });
  async function handleImageFile(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { toast("Это не картинка", { emoji: "⚠️" }); return; }
    try {
      const data = await compressImage(file);
      ui.pendingImg = data;
      if (FA.renderAttachPreview) FA.renderAttachPreview();
    } catch (e) { toast("Не удалось обработать фото", { emoji: "⚠️" }); }
  }
  FA.handleImageFile = handleImageFile;
  function compressImage(file, maxSide) {
    return new Promise(async (resolve, reject) => {
      try {
        const src = await U.readFileAsDataURL(file);
        const img = new Image();
        img.onload = () => {
          const max = maxSide || 900;
          const k = Math.min(1, max / Math.max(img.width, img.height));
          const cv = document.createElement("canvas");
          cv.width = Math.max(1, Math.round(img.width * k));
          cv.height = Math.max(1, Math.round(img.height * k));
          const ctx = cv.getContext("2d");
          ctx.drawImage(img, 0, 0, cv.width, cv.height);
          resolve(cv.toDataURL("image/jpeg", 0.72));
        };
        img.onerror = () => resolve(src);
        img.src = src;
      } catch (e) { reject(e); }
    });
  }
  FA.compressImage = compressImage;
})(window.FA = window.FA || {});
