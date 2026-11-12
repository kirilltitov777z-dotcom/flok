/* Flok clicker + wallet */
(function (FA) {
  "use strict";
  const { C, U, S } = window.FLOK;
  const ui = FA.ui;
  const $ = FA.$, $$ = FA.$$, IC = FA.IC, coin = FA.coin;

  function maxEnergy(c) { return 500 + ((c.energyLvl || 1) - 1) * 150; }
  function upCost(id, lvl) {
    const u = C.CLICKER_UPGRADES.find((x) => x.id === id);
    return Math.round(u.base * Math.pow(u.growth, lvl));
  }
  function energyNow() {
    const c = S.me().clicker;
    return Math.floor(c.energy || 0);
  }
  function updateEnergyUI() {
    if (!S.me()) return;
    const c = S.me().clicker;
    const fill = $("#energyFill"), txt = $("#energyText");
    if (fill) fill.style.width = Math.min(100, (c.energy / maxEnergy(c)) * 100) + "%";
    if (txt) txt.innerHTML = `<b>${U.fmt(Math.floor(c.energy))}</b> / ${U.fmt(maxEnergy(c))}`;
    const nm = $("#energyNow"); if (nm) nm.textContent = U.fmt(Math.floor(c.energy));
    const rate = $("#autoRate"); if (rate) rate.textContent = U.fmt((c.autoLvl || 0) * 120);
    const total = $("#autoTotal"); if (total) total.textContent = U.fmt(Math.floor(c.autoCarry || 0));
  }
  function updateBalances() {
    if (!S.me()) return;
    $$(".js-balance").forEach((n) => { n.textContent = U.fmt(S.me().balance); });
  }
  FA.updateBalances = updateBalances;
  FA.updateEnergyUI = updateEnergyUI;

  function upgradeHTML(u) {
    const c = S.me().clicker;
    const lvl = c[u.id + "Lvl"] || 0;
    const cost = upCost(u.id, lvl);
    const can = S.me().balance >= cost;
    const val = u.id === "tap" ? `+${lvl + 1} за тап` : u.id === "energy" ? `+150 к резерву` : `+120 Flok/час`;
    return `<div class="upgrade-card">
      <span class="upg-icon">${u.icon}</span>
      <span class="grow"><span class="upg-name">${u.name} <span class="level-pill">Ур. ${lvl}</span></span><span class="upg-desc">${val}</span></span>
      <button class="upg-buy" data-act="upgrade" data-id="${u.id}" ${can ? "" : "disabled"}>${coin()} ${U.fmt(cost)}</button>
    </div>`;
  }

  async function renderClicker() {
    ui.me = S.me();
    const c = ui.me.clicker;
    const claimed = ui.me.daily.last === U.dayKey();
    const reward = 1 + ((c.energyLvl || 1) - 1);
    const screen = $("#screen");
    screen.innerHTML = `
      <div class="screen-head">
        <div><div class="eyebrow">Flok farm</div><h1>Кликер</h1></div>
        <span class="balance-chip">${coin()} <span class="js-balance">${U.fmt(ui.me.balance)}</span></span>
      </div>
      <div class="tap-zone" id="tapZone">
        <div class="tap-blob" data-act="tap" role="button" tabindex="0" aria-label="Заработать Flok">
          <div class="tap-core"><span class="flok-f">F</span></div>
        </div>
        <div class="tap-hint">тапай · зарабатывай · коллекционируй</div>
      </div>
      <div class="energy-wrap">
        <div class="energy"><div class="energy-fill" id="energyFill" style="width:${Math.min(100, (c.energy / maxEnergy(c)) * 100)}%"></div></div>
        <div class="energy-meta"><span>${IC("spark")} энергия &nbsp;<span id="energyText"><b>${U.fmt(Math.floor(c.energy))}</b> / ${U.fmt(maxEnergy(c))}</span></span><span>+2 в сек</span></div>
      </div>
      <div class="click-stats">
        <div class="stat-card"><div class="sv">${U.fmt(c.totalTaps)}</div><div class="sl">тапов</div></div>
        <div class="stat-card"><div class="sv">${U.fmt(ui.me.clicker.totalEarned)}</div><div class="sl">заработано</div></div>
        <div class="stat-card"><div class="sv" id="autoRate">${U.fmt((c.autoLvl || 0) * 120)}</div><div class="sl">Flok / час</div></div>
      </div>
      <div class="section-title"><h3>Прокачка</h3><span class="tiny faint">сильнее с каждым уровнем</span></div>
      ${C.CLICKER_UPGRADES.map(upgradeHTML).join("")}
      <div class="daily-card">
        <span class="daily-icon">🎁</span>
        <span class="grow"><span class="upg-name">Бонус дня <span class="level-pill">${ui.me.daily.streak || 0} дн.</span></span><span class="upg-desc">${claimed ? "Уже получен — приходи завтра" : "Заходи каждый день, серия растёт"}</span></span>
        <button class="daily-claim" data-act="daily" ${claimed ? "disabled" : ""}>${claimed ? "Завтра" : "Забрать"}</button>
      </div>
      <p class="market-footer-note">Flok — внутренняя валюта Flok. Её нельзя купить за деньги, только заработать в кликере, на маркете и бонусах.</p>`;
  }
  FA.screens.clicker = renderClicker;

  function fallbackReward(c) { return Math.max(1, Math.floor(c.tapLvl || 1)); }
  async function doTap(e, el) {
    const c = S.me().clicker;
    if (c.energy < 1) { toast("Энергия закончилась. Подожди пару секунд ⚡", { emoji: "⚡", ms: 1800 }); return; }
    const reward = fallbackReward(c);
    try {
      await S.click(reward);
    } catch (err) { toast(err.message, { emoji: "⚠️" }); return; }
    ui.me = S.me();
    updateBalances(); updateEnergyUI();
    const zone = $("#tapZone");
    if (zone) {
      const r = zone.getBoundingClientRect();
      const x = (e && e.clientX ? e.clientX : r.left + r.width / 2) - r.left;
      const y = (e && e.clientY ? e.clientY : r.top + r.height / 2) - r.top;
      const f = document.createElement("span");
      f.className = "plus-one"; f.textContent = "+" + reward;
      f.style.left = x + "px"; f.style.top = y + "px"; f.style.transform = "translate(-50%,-50%)";
      zone.appendChild(f); setTimeout(() => f.remove(), 900);
      for (let i = 0; i < 3; i++) {
        const sp = document.createElement("i");
        sp.className = "tap-spark";
        const a = Math.random() * Math.PI * 2, dist = 30 + Math.random() * 45;
        sp.style.left = x + "px"; sp.style.top = y + "px";
        sp.style.setProperty("--sx", Math.cos(a) * dist + "px");
        sp.style.setProperty("--sy", Math.sin(a) * dist + "px");
        zone.appendChild(sp); setTimeout(() => sp.remove(), 650);
      }
    }
    if (c.totalTaps % 3 === 0) FA.HAPT();
    const blob = $(".tap-blob");
    if (blob && blob.animate) blob.animate([{ transform: "scale(.94)" }, { transform: "scale(1)" }], { duration: 160, easing: "ease-out" });
    const st = $$(".click-stats .sv"); if (st[0]) st[0].textContent = U.fmt(S.me().clicker.totalTaps); if (st[1]) st[1].textContent = U.fmt(S.me().clicker.totalEarned);
  }
  FA.actions["tap"] = (el, e) => { doTap(e, el); };

  FA.actions["upgrade"] = async (el) => {
    try {
      const r = await S.upgrade(el.dataset.id);
      toast("Улучшение куплено · ур. " + r.lvl, { emoji: "⚡" });
      ui.me = S.me();
      renderClicker();
    } catch (e) { toast(e.message, { emoji: "⚠️" }); }
  };

  FA.actions["daily"] = async () => {
    try {
      const r = await S.claimDaily();
      toast("+" + U.fmt(r.amount) + " Flok · день " + r.streak, { emoji: "🎁", ms: 4000 });
      FA.HAPT();
      ui.me = S.me();
      if (ui.tab === "clicker") renderClicker();
      else if (ui.tab === "wallet") renderWallet();
      FA.updateBalances();
    } catch (e) { toast(e.message, { emoji: "🌿" }); }
  };

  /* ---------- wallet ---------- */
  async function renderWallet() {
    ui.me = S.me();
    const w = await S.getWallet();
    ui.wallet = w;
    const claimed = ui.me.daily.last === U.dayKey();
    const screen = $("#screen");
    screen.innerHTML = `
      <div class="screen-head">
        <div><div class="eyebrow">Flok wallet</div><h1>Кошелёк</h1></div>
        <button class="icon-btn" data-act="tab" data-tab="profile" aria-label="Профиль">${FA.avatarHTML(ui.me, "xs")}</button>
      </div>
      <div class="wallet-hero glass glass-edge">
        <div class="mh-label">${IC("coin")} доступно</div>
        <div class="balance-big"><span class="num">${U.fmt(w.balance)}</span><span class="cur">Flok</span></div>
        <div class="wallet-id">${IC("hash")} ${w.id} <button class="icon-btn sm plain" data-act="copy" data-text="${w.id}" aria-label="Скопировать ID">${IC("copy")}</button></div>
        <div class="wallet-actions">
          <button class="btn btn-primary" data-act="tab" data-tab="clicker">${IC("spark")} Заработать</button>
          <button class="btn btn-ghost" data-act="daily" ${claimed ? "disabled" : ""}>${claimed ? "Бонус завтра" : "Бонус дня"}</button>
        </div>
      </div>
      <div class="section-title"><h2>Как заработать</h2><span class="tiny faint">без вложений</span></div>
      <div class="earn-tips">
        <button class="tip-card" data-act="tab" data-tab="clicker"><span class="tip-ico">✨</span><span class="grow"><h4>Кликер</h4><p>Тапай по Flok-сфере и прокачивай силу</p></span>${IC("chevron")}</button>
        <button class="tip-card" data-act="tab" data-tab="market"><span class="tip-ico">🛍</span><span class="grow"><h4>Маркет</h4><p>Продавай подарки другим людям</p></span>${IC("chevron")}</button>
        <button class="tip-card" data-act="daily"><span class="tip-ico">🎁</span><span class="grow"><h4>Бонус дня</h4><p>Заходи каждый день — серия растёт</p></span>${IC("chevron")}</button>
      </div>
      <div class="section-title"><h2>История</h2><span class="tiny faint">${w.tx.length} операций</span></div>
      ${w.tx.length ? `<div class="tx-list">${w.tx.map((t) => `<div class="tx">
        <span class="tx-icon ${t.plus ? "in" : ""}">${U.txIcon(t.type)}</span>
        <span class="grow"><span class="tx-title">${U.esc(t.title)}</span><span class="tx-time">${U.timeAgo(t.ts)}</span></span>
        <span class="tx-amount ${t.plus ? "plus" : t.amount ? "minus" : ""}">${t.amount ? (t.plus ? "+" : "−") + U.fmt(t.amount) : "—"}</span>
      </div>`).join("")}</div>` : `<div class="empty"><div class="empty-art">📜</div><h3>Пока пусто</h3><p>Заработай первый Flok в кликере — история начнётся.</p><button class="btn btn-soft btn-sm" data-act="tab" data-tab="clicker">Открыть кликер</button></div>`}
      <p class="market-footer-note">Flok — не деньги и не криптовалюта. Это внутренние баллы приложения, которые нельзя обменять на реальные средства.</p>`;
  }
  FA.screens.wallet = renderWallet;

  FA.onTick = function () {
    if (!S.me()) return;
    updateBalances();
    if (ui.tab === "clicker") updateEnergyUI();
    if (ui.tab === "wallet" && ui.wallet) {
      const bal = S.me().balance;
      const heroNum = document.querySelector(".wallet-hero .num");
      if (heroNum && heroNum.textContent !== U.fmt(bal)) heroNum.textContent = U.fmt(bal);
    }
  };
})(window.FA = window.FA || {});
