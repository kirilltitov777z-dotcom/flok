/* Flok market — shop, listings, gift details */
(function (FA) {
  "use strict";
  const { C, U, S } = window.FLOK;
  const ui = FA.ui;
  const $ = FA.$, $$ = FA.$$, IC = FA.IC, coin = FA.coin;
  const avatar = FA.avatarHTML, giftArt = FA.giftArtHTML, rarity = FA.rarityHTML, price = FA.priceHTML;

  const FILTERS = [["all", "Все"], ["common", "Обычные"], ["rare", "Редкие"], ["epic", "Эпические"], ["legendary", "Легенды"], ["halloween", "Хэллоуин 🎃"]];
  const matches = (g) => ui.filter === "all" || g.rarity === ui.filter;

  function listingsHTML() {
    const list = (ui.listings || []).filter((l) => l.gift && matches(l.gift));
    if (!list.length) return `<div class="empty"><div class="empty-art">🧺</div><h3>Лотов пока нет</h3><p>Выставь свой подарок первым — рынок любит смелых.</p><button class="btn btn-soft btn-sm" data-act="market-tab" data-sub="mine">Мои подарки</button></div>`;
    return `<div class="gift-grid">${list.map((l) => {
      const g = l.gift;
      return `<div class="gift-card" data-act="gift-open" data-kind="listing" data-id="${l.id}" role="button" tabindex="0">
        ${giftArt(g, l.serial)}
        <div class="gift-name"><span class="ellipsis">${U.esc(g.name)}</span></div>
        <div class="gift-card-foot"><span class="price">${coin()} ${U.fmt(l.price)}</span>
          <span class="seller-mini">${l.mine ? "твой лот" : `${avatar(l.seller, "xs")}<span>${U.esc(l.seller.name)}</span>`}</span>
        </div>
      </div>`;
    }).join("")}</div>`;
  }
  function shopHTML() {
    const list = C.GIFTS.filter(matches);
    return `<div class="gift-grid">${list.map((g) => {
      const minted = ui.shop[g.id] || 0;
      const sold = minted >= g.supply;
      const left = Math.max(0, g.supply - minted);
      return `<div class="gift-card ${sold ? "locked" : ""}" data-act="gift-open" data-kind="shop" data-id="${g.id}" role="button" tabindex="0">
        ${giftArt(g)}
        <div class="gift-name"><span class="ellipsis">${U.esc(g.name)}</span></div>
        <div class="gift-card-foot"><span class="price">${coin()} ${U.fmt(g.price)}</span><span class="stock ${left < 50 ? "warn" : ""}">${sold ? "распродано" : "осталось " + U.fmt(left)}</span></div>
      </div>`;
    }).join("")}</div>`;
  }
  function myGiftsHTML() {
    const list = ui.myGifts || [];
    if (!list.length) return `<div class="empty"><div class="empty-art">🎁</div><h3>Коллекция ждёт</h3><p>Купи первый подарок в магазине — он станет твоим навсегда.</p><button class="btn btn-primary btn-sm" data-act="market-tab" data-sub="shop">Открыть магазин</button></div>`;
    return `<div class="gift-grid">${list.map((o) => {
      const g = o.gift;
      return `<div class="gift-card" data-act="gift-open" data-kind="owned" data-id="${o.uid}" role="button" tabindex="0">
        ${giftArt(g, o.serial)}
        <div class="gift-name"><span class="ellipsis">${U.esc(g.name)}</span></div>
        <div class="gift-card-foot"><span class="price">${coin()} ${U.fmt(g.price)}</span>${o.listing ? `<span class="tiny" style="color:var(--peach)">на маркете</span>` : `<span class="tiny faint">твой</span>`}</div>
      </div>`;
    }).join("")}</div>`;
  }
  function paneHTML() {
    if (ui.marketTab === "shop") return `<div class="chips">${FILTERS.map(([id, label]) => `<button class="chip ${ui.filter === id ? "active" : ""}" data-act="market-filter" data-f="${id}">${label}</button>`).join("")}</div>${shopHTML()}<div class="market-footer-note">Подарки лимитированы и получают <b>серийный номер</b>. Один подарок — одна серия.</div>`;
    if (ui.marketTab === "mine") return `${myGiftsHTML()}<div class="market-footer-note">Хочешь продать? Открой подарок → <b>Выставить на маркет</b>. Комиссия 5%.</div>`;
    return `<div class="chips">${FILTERS.map(([id, label]) => `<button class="chip ${ui.filter === id ? "active" : ""}" data-act="market-filter" data-f="${id}">${label}</button>`).join("")}</div>${listingsHTML()}<div class="market-footer-note">Настоящие лоты от коллекционеров Flok. Продавец получает <b>95%</b> — 5% остаётся маркету.</div>`;
  }
  async function renderMarket() {
    const screen = $("#screen");
    const token = ++ui.renderToken;
    screen.innerHTML = `<div class="skeleton" style="height:60px;margin-bottom:12px"></div><div class="skeleton" style="height:180px"></div>`;
    try {
      ui.me = S.me();
      ui.listings = await S.getMarket();
      ui.shop = await S.getShopInfo();
      ui.myGifts = await S.getMyGifts();
      if (ui.cloud) ui.channels = await S.getChannels();
    } catch (e) { toast(e.message, { emoji: "⚠️" }); }
    if (token !== ui.renderToken || ui.tab !== "market") return;
    FA.renderNav();
    screen.innerHTML = `
      <div class="screen-head">
        <div><div class="eyebrow">Flok market</div><h1>Маркет</h1></div>
        <span class="balance-chip" data-act="tab" data-tab="wallet">${coin()} <span class="js-balance">${U.fmt(ui.me.balance)}</span></span>
      </div>
      <div class="market-hero glass glass-edge">
        <div class="mh-label">${IC("coin")} твой баланс</div>
        <div class="balance-big"><span class="num">${U.fmt(ui.me.balance)}</span><span class="cur">Flok</span></div>
        <div class="hero-actions">
          <button class="btn btn-primary" data-act="tab" data-tab="clicker">${IC("spark")} Заработать</button>
          <button class="btn btn-ghost" data-act="market-tab" data-sub="shop">${IC("bag")} Магазин</button>
        </div>
        <div class="glass-orb">F</div>
      </div>
      <div class="seg tabs market-tabs">
        <button class="seg-btn ${ui.marketTab === "market" ? "active" : ""}" data-act="market-tab" data-sub="market">Маркет</button>
        <button class="seg-btn ${ui.marketTab === "shop" ? "active" : ""}" data-act="market-tab" data-sub="shop">Магазин</button>
        <button class="seg-btn ${ui.marketTab === "mine" ? "active" : ""}" data-act="market-tab" data-sub="mine">Мои · ${ui.myGifts.length}</button>
      </div>
      <div id="market-pane">${paneHTML()}</div>`;
  }
  FA.screens.market = renderMarket;

  FA.actions["market-tab"] = (el) => { ui.marketTab = el.dataset.sub || "market"; renderMarket(); };
  FA.actions["market-filter"] = (el) => {
    ui.filter = el.dataset.f;
    $$("#market-pane .chip").forEach((c) => c.classList.toggle("active", c === el));
    const pane = $("#market-pane");
    if (pane) pane.innerHTML = paneHTML();
  };

  /* ---------- gift detail ---------- */
  async function openGift(kind, id) {
    try {
      if (kind === "shop") {
        const g = U.giftById(id);
        if (!g) throw new Error("Подарок не найден");
        const minted = ui.shop[g.id] || 0;
        const sold = minted >= g.supply;
        FA.sheet("Подарок", `<div class="gift-detail">
          <div class="gd-art">${giftArt(g)}</div>
          <h3 class="gd-name">${U.esc(g.name)}</h3>
          <div class="gd-rarity">${rarity(g.rarity)}</div>
          <p class="gd-desc">${U.esc(g.desc)}</p>
          <div class="gd-price">${coin("lg")} ${U.fmt(g.price)} <span class="tiny faint" style="font-weight:600">Flok</span></div>
          <div class="gd-stock">${sold ? "Тираж раскуплен — ищи на маркете" : `Выпущено ${U.fmt(minted)} из ${U.fmt(g.supply)} · осталось ${U.fmt(g.supply - minted)}`}</div>
          <div class="gd-actions">
            <button class="btn btn-primary" data-act="buy-gift" data-id="${g.id}" ${sold ? "disabled" : ""}>${IC("bag")} ${sold ? "Распродано" : "Купить за " + U.fmt(g.price)}</button>
          </div>
          <div class="sheet-note" style="width:100%">После покупки подарок можно <b>оставить себе</b>, <b>выставить на маркет</b> или <b>подарить другу</b>. У каждого подарка свой серийный номер.</div>
        </div>`);
      } else if (kind === "listing") {
        const l = (ui.listings || []).find((x) => x.id === id);
        if (!l) throw new Error("Лот уже продан");
        const g = l.gift;
        FA.sheet("Лот на маркете", `<div class="gift-detail">
          <div class="gd-art">${giftArt(g, l.serial)}</div>
          <h3 class="gd-name">${U.esc(g.name)}</h3>
          <div class="gd-rarity">${rarity(g.rarity)}</div>
          <p class="gd-desc">${U.esc(g.desc)}</p>
          <div class="gd-price">${coin("lg")} ${U.fmt(l.price)} <span class="tiny faint" style="font-weight:600">Flok</span></div>
          <div class="gd-owner">${avatar(l.seller, "xs")} продаёт <b>${U.esc(l.mine ? "ты" : l.seller.name)}</b> · серия #${l.serial}</div>
          <div class="gd-actions" style="margin-top:14px">
            ${l.mine
              ? `<button class="btn btn-danger" data-act="cancel-listing" data-id="${l.id}">${IC("trash")} Снять с маркета</button>`
              : `<button class="btn btn-primary" data-act="buy-listing" data-id="${l.id}">${IC("bag")} Купить за ${U.fmt(l.price)}</button>`}
          </div>
        </div>`);
      } else {
        const o = (ui.myGifts || []).find((x) => x.uid === id);
        if (!o) throw new Error("Подарок не найден");
        const g = o.gift;
        const quick = Math.round(g.price * 0.6);
        FA.sheet("Твой подарок", `<div class="gift-detail">
          <div class="gd-art">${giftArt(g, o.serial)}</div>
          <h3 class="gd-name">${U.esc(g.name)}</h3>
          <div class="gd-rarity">${rarity(g.rarity)}</div>
          <p class="gd-desc">${U.esc(g.desc)}</p>
          <div class="gd-price">${coin("lg")} ${U.fmt(g.price)} <span class="tiny faint" style="font-weight:600">оценка</span></div>
          <div class="gd-stock">Серия #${o.serial} · у тебя с ${new Date(o.ts).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}${o.listing ? " · уже на маркете" : ""}</div>
          <div class="gd-actions">
            ${o.listing
              ? `<button class="btn btn-ghost" data-act="cancel-listing" data-id="${o.listing.id}">${IC("close")} Снять с маркета</button>`
              : `<button class="btn btn-primary" data-act="list-gift" data-id="${o.uid}">${IC("tag")} Выставить на маркет</button>
                 <button class="btn btn-ghost" data-act="quick-sell" data-id="${o.uid}">${IC("coin")} Продать сразу · ${U.fmt(quick)}</button>`}
            <button class="btn btn-ghost" data-act="gift-to" data-id="${o.uid}" ${o.listing ? "disabled" : ""}>${IC("gift")} Подарить другу</button>
          </div>
        </div>`);
      }
    } catch (e) { toast(e.message, { emoji: "⚠️" }); }
  }
  FA.actions["gift-open"] = (el) => openGift(el.dataset.kind, el.dataset.id);

  FA.actions["buy-gift"] = (el) => {
    const g = U.giftById(el.dataset.id);
    if (!g) return;
    FA.confirmSheet({
      emoji: g.emoji, title: "Купить «" + g.name + "»?",
      text: `Спишется <b>${U.fmt(g.price)} Flok</b>. Подарок с серийным номером сразу появится в профиле.`,
      ok: "Купить", onConfirm: async () => {
        await S.buyGift(g.id);
        ui.me = S.me();
        toast("Подарок твой: " + g.name, { emoji: "🎁" });
        await loadMarketData();
        if (ui.tab === "market") renderMarket();
        if (ui.tab === "profile") FA.renderScreen();
      }
    });
  };
  FA.actions["buy-listing"] = (el) => {
    const l = (ui.listings || []).find((x) => x.id === el.dataset.id);
    if (!l) return;
    FA.confirmSheet({
      emoji: l.gift.emoji, title: "Купить лот?",
      text: `«${U.esc(l.gift.name)}» серия #${l.serial} за <b>${U.fmt(l.price)} Flok</b>. Продавец получит 95%.`,
      ok: "Купить", onConfirm: async () => {
        await S.buyListing(l.id);
        ui.me = S.me();
        toast("Лот твой: " + l.gift.name + " #" + l.serial, { emoji: "🎉" });
        await loadMarketData();
        if (ui.tab === "market") renderMarket();
        if (ui.tab === "profile") FA.renderScreen();
      }
    });
  };
  FA.actions["list-gift"] = (el) => {
    const o = (ui.myGifts || []).find((x) => x.uid === el.dataset.id);
    if (!o) return;
    ui.listUid = el.dataset.id;
    const suggested = Math.max(10, Math.round(o.gift.price / 10) * 10);
    FA.sheet("Выставить на маркет", `<p class="sheet-lead">Назначь цену. Маркет возьмёт 5% — ты получишь остальное, когда лот купят.</p>
      <form id="listGiftForm" class="form-stack">
        <div class="field">${IC("coin")}<input name="price" type="number" min="10" step="10" value="${suggested}" inputmode="numeric" required></div>
        <div class="sheet-note">Ориентир: магазинная цена <b>${U.fmt(o.gift.price)} Flok</b>. Можно поставить выше — если подарок редкий.</div>
        <button class="btn btn-primary btn-block" type="submit">${IC("tag")} Выставить за <span id="listPriceHint">${U.fmt(suggested)}</span> Flok</button>
      </form>
      <p class="sheet-note">Подсказка: лоты дешевле магазина уходят за минуты. Иногда их покупают прямо во время твоего клика.</p>`);
    const inp = $("#listGiftForm input[name=price]");
    if (inp) inp.addEventListener("input", () => { const h = $("#listPriceHint"); if (h) h.textContent = U.fmt(Math.max(0, Number(inp.value) || 0)); });
  };
  FA.submits["listGiftForm"] = async (form) => {
    try {
      const price = Number(form.elements.price.value);
      await S.listGift(ui.listUid, price);
      ui.listUid = null;
      FA.closeModal();
      toast("Лот выставлен. Ждём покупателя 👀", { emoji: "👀" });
      await loadMarketData();
      ui.marketTab = "market";
      if (ui.tab === "market") renderMarket();
    } catch (e) { toast(e.message, { emoji: "⚠️" }); }
  };
  FA.actions["quick-sell"] = (el) => {
    const o = (ui.myGifts || []).find((x) => x.uid === el.dataset.id);
    if (!o) return;
    const amount = Math.round(o.gift.price * 0.6);
    FA.confirmSheet({
      emoji: "⚡", title: "Продать сразу?",
      text: `Мгновенная продажа «${U.esc(o.gift.name)}» за <b>${U.fmt(amount)} Flok</b>. Это 60% оценки — без ожидания покупателя.`,
      ok: "Продать", danger: true, onConfirm: async () => {
        const r = await S.quickSell(o.uid);
        ui.me = S.me();
        toast("+" + U.fmt(r.amount) + " Flok", { emoji: "💰" });
        await loadMarketData();
        if (ui.tab === "market") renderMarket();
        if (ui.tab === "profile") FA.renderScreen();
      }
    });
  };
  FA.actions["cancel-listing"] = (el) => {
    FA.confirmSheet({
      emoji: "↩️", title: "Снять лот?",
      text: "Подарок вернётся в твою коллекцию. Выставить снова можно в любой момент.",
      ok: "Снять", onConfirm: async () => {
        await S.cancelListing(el.dataset.id);
        toast("Лот снят");
        await loadMarketData();
        if (ui.tab === "market") renderMarket();
        if (ui.tab === "profile") FA.renderScreen();
      }
    });
  };
  FA.actions["gift-to"] = (el) => {
    const uid = el.dataset.id;
    const people = (ui.contacts || []).filter((p) => p.id !== (ui.me && ui.me.id));
    FA.sheet("Подарить подарок", `<p class="sheet-lead">Выбери человека. Подарок перейдёт ему навсегда, а в чате появится красивая открытка.</p>
      <div class="recipient-list">${people.map((p) => `<button class="recipient" data-act="send-gift-to" data-uid="${uid}" data-id="${p.id}">
        ${avatar(p, "sm")}<span class="grow"><span class="r-name">${U.esc(p.name)}</span><span class="r-sub">@${U.esc(p.username)}${p.bot ? " · аккаунт Flok" : ""}</span></span>${IC("arrow", "faint")}
      </button>`).join("")}</div>
      <div class="sheet-note">Подаренные подарки нельзя вернуть. Но это же приятно 💝</div>`);
  };
  FA.actions["send-gift-to"] = async (el) => {
    try {
      const r = await S.giftTo(el.dataset.uid, el.dataset.id);
      FA.closeModal();
      toast("Подарок отправлен: " + r.recipient.name, { emoji: "💝" });
      ui.me = S.me();
      await loadMarketData();
      if (ui.tab === "market") renderMarket();
      if (ui.tab === "profile") FA.renderScreen();
    } catch (e) { toast(e.message, { emoji: "⚠️" }); }
  };

  async function loadMarketData() {
    ui.listings = await S.getMarket();
    ui.shop = await S.getShopInfo();
    ui.myGifts = await S.getMyGifts();
    ui.me = S.me();
  }
  FA.loadMarketData = loadMarketData;
})(window.FA = window.FA || {});
