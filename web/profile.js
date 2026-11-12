/* Flok profile, backgrounds, edits and settings */
(function (FA) {
  "use strict";
  const { C, U, S } = window.FLOK;
  const ui = FA.ui;
  const $ = FA.$, $$ = FA.$$, IC = FA.IC, coin = FA.coin;
  const avatar = FA.avatarHTML, giftArt = FA.giftArtHTML, rarity = FA.rarityHTML;

  function bestRarity(gifts) {
    const order = { common: 1, rare: 2, epic: 3, legendary: 4, halloween: 5 };
    let best = null;
    (gifts || []).forEach((o) => {
      const g = o.gift;
      if (!g) return;
      if (!best || (order[g.rarity] || 0) > (order[best.rarity] || 0)) best = g;
    });
    return best;
  }
  function shelfHTML(gifts) {
    if (!gifts.length) return `<button class="empty shelf-empty" data-act="market-tab" data-sub="shop" style="width:100%">
      <div class="empty-art">🎁</div><h3>Витрина пустая</h3><p>Купи первый подарок — профиль сразу станет интереснее.</p><span class="btn btn-soft btn-sm">Открыть магазин</span>
    </button>`;
    return gifts.slice(0, 9).map((o) => `<button class="gift-card" data-act="gift-open" data-kind="owned" data-id="${o.uid}">
      ${giftArt(o.gift, o.serial)}
      <div class="gift-name"><span class="ellipsis">${U.esc(o.gift.name)}</span></div>
      <div class="rarity" style="--rc:${U.rarityColor(o.gift.rarity)}">${U.rarityLabel(o.gift.rarity)}</div>
    </button>`).join("");
  }
  function bgCardHTML(b) {
    return `<button class="bg-card ${b.selected ? "selected" : ""} ${b.owned ? "" : "locked"}" data-act="bg-click" data-id="${b.id}">
      <span class="bg-art" style="background:${b.css}"></span>
      ${b.selected ? `<span class="bg-check">${IC("check")}</span>` : !b.owned ? `<span class="bg-lock">${IC("lock")}</span>` : ""}
      <span class="bg-info"><span class="bg-name">${U.esc(b.name)}</span><span class="bg-price">${b.owned ? (b.selected ? "выбран" : "применить") : `${coin()} ${U.fmt(b.price)}`}</span></span>
    </button>`;
  }

  async function renderProfile() {
    ui.me = S.me();
    const token = ++ui.renderToken;
    let gifts = [], bgs = [];
    try { gifts = await S.getMyGifts(); bgs = await S.getBackgrounds(); }
    catch (e) { toast(e.message, { emoji: "⚠️" }); }
    if (token !== ui.renderToken || ui.tab !== "profile") return;
    ui.myGifts = gifts;
    const me = ui.me;
    const bg = U.bgById(me.bg) || C.BACKGROUNDS[0];
    const best = bestRarity(gifts);
    const screen = $("#screen");
    screen.innerHTML = `
      <div class="screen-head">
        <div><div class="eyebrow">Flok id</div><h1>Профиль</h1></div>
        <div class="head-actions">
          <button class="icon-btn" data-act="settings" aria-label="Настройки">${IC("settings")}</button>
          <button class="icon-btn" data-act="edit-profile" aria-label="Редактировать">${IC("edit")}</button>
        </div>
      </div>
      <div class="profile-cover">
        <span class="cover-art" style="background:${bg.css}"></span>
        <span class="cover-label">${IC("image")} ${U.esc(bg.name)} · фон профиля</span>
      </div>
      <div class="profile-head">
        <div class="profile-ava">
          ${avatar(me, "xl ring")}
          <button class="icon-btn sm" data-act="edit-profile" aria-label="Изменить фото">${IC("camera")}</button>
        </div>
        <h2 class="profile-name">${U.esc(me.name)}</h2>
        <div class="profile-handle">@${U.esc(me.username)}</div>
        <div class="profile-id-row">${IC("hash")} FLK-${me.id.slice(-6).toUpperCase()} <button class="icon-btn sm plain" data-act="copy" data-text="FLK-${me.id.slice(-6).toUpperCase()}" aria-label="Скопировать">${IC("copy")}</button></div>
        <p class="profile-bio">${U.esc(me.bio || "Пока без описания. Самое время сказать миру пару слов.")}</p>
        <div class="profile-actions">
          <button class="btn btn-soft" data-act="edit-profile">${IC("edit")} Редактировать</button>
          <button class="btn btn-ghost" data-act="bg-shop">${IC("image")} Фоны</button>
        </div>
        <div class="profile-stats">
          <div class="stat-card"><div class="sv">${gifts.length}</div><div class="sl">подарков</div></div>
          <div class="stat-card"><div class="sv">${best ? U.rarityLabel(best.rarity) : "—"}</div><div class="sl">лучшая редкость</div></div>
          <div class="stat-card"><div class="sv">${coin()} ${U.fmt(me.balance)}</div><div class="sl">баланс</div></div>
        </div>
      </div>
      <div class="section-title"><h2>Витрина</h2><button class="link" data-act="market-tab" data-sub="mine">Все подарки ${IC("chevron")}</button></div>
      <div class="shelf">${shelfHTML(gifts)}</div>
      <div class="section-title" id="bgSection"><h2>Фон профиля</h2><span class="tiny faint">видят все</span></div>
      <p class="tiny faint" style="margin:-6px 4px 10px">Купи фон за Flok — он навсегда останется в коллекции и будет виден в профиле.</p>
      <div class="bg-scroller">${bgs.map(bgCardHTML).join("")}</div>
      <div class="section-title"><h2>Аккаунт</h2><span class="tiny faint">${new Date(me.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}</span></div>
      <div class="menu-list">
        <button class="menu-item" data-act="edit-profile"><span class="menu-ic">${IC("user")}</span><span class="grow"><h4>Личные данные</h4><p>Имя, аватар, описание</p></span>${IC("chevron", "chev")}</button>
        <button class="menu-item" data-act="bg-shop"><span class="menu-ic">${IC("image")}</span><span class="grow"><h4>Магазин фонов</h4><p>${bgs.filter((b) => b.owned).length} из ${bgs.length} открыто</p></span>${IC("chevron", "chev")}</button>
        <button class="menu-item" data-act="settings"><span class="menu-ic">${IC("settings")}</span><span class="grow"><h4>Настройки</h4><p>Сеть, анимации, выход</p></span>${IC("chevron", "chev")}</button>
        <button class="menu-item" data-act="about"><span class="menu-ic">${IC("gift")}</span><span class="grow"><h4>О Flok</h4><p>Версия 1.0 · сделано на телефоне</p></span>${IC("chevron", "chev")}</button>
      </div>
      <p class="market-footer-note">Flok · люди, подарки и немного космоса. Данные профиля видны другим людям в твоей сети.</p>`;
  }
  FA.screens.profile = renderProfile;

  FA.actions["bg-shop"] = () => {
    if (ui.tab !== "profile") { FA.setTab("profile"); setTimeout(() => { const s = $("#bgSection"); if (s) s.scrollIntoView({ behavior: "smooth", block: "start" }); }, 350); }
    else { const s = $("#bgSection"); if (s) s.scrollIntoView({ behavior: "smooth", block: "start" }); }
  };
  FA.actions["bg-click"] = async (el) => {
    const id = el.dataset.id;
    const b = U.bgById(id);
    const me = S.me();
    if (me.bg === id) { toast("Этот фон уже стоит на профиле"); return; }
    if (me.ownedBgs.includes(id) || b.price === 0) {
      try { await S.selectBackground(id); ui.me = S.me(); toast("Фон обновлён: " + b.name, { emoji: "🌌" }); renderProfile(); }
      catch (e) { toast(e.message, { emoji: "⚠️" }); }
      return;
    }
    FA.confirmSheet({
      emoji: "🌌", title: "Открыть фон?",
      text: `«${b.name}» — ${U.esc(b.desc)}<br><br>Спишется <b>${U.fmt(b.price)} Flok</b>. Фон останется у тебя навсегда.`,
      ok: "Купить", onConfirm: async () => {
        await S.buyBackground(id);
        ui.me = S.me();
        toast("Фон твой: " + b.name, { emoji: "✨" });
        renderProfile();
      }
    });
  };

  /* ---------- edit profile ---------- */
  function editAvaHTML() {
    return avatar({ name: S.me().name || "?", avatar: { emoji: ui.edit.emoji, color: ui.edit.color, image: ui.edit.image } }, "lg ring");
  }
  FA.actions["edit-profile"] = () => {
    const me = S.me();
    ui.edit = { name: me.name, bio: me.bio, emoji: me.avatar.emoji || "", color: me.avatar.color || "#58e0bd", image: me.avatar.image || "" };
    FA.sheet("Редактировать профиль", `<div class="center mb16"><span id="editAvaWrap">${editAvaHTML()}</span>
        <div class="mt12"><button type="button" class="btn btn-ghost btn-sm" data-act="edit-photo">${IC("camera")} Фото</button>
        ${ui.edit.image ? `<button type="button" class="btn btn-ghost btn-sm" data-act="edit-remove-photo" style="margin-left:6px">Убрать</button>` : ""}</div>
      </div>
      <form id="editProfileForm" class="form-stack">
        <div class="field">${IC("user")}<input name="name" value="${U.esc(ui.edit.name)}" placeholder="Имя" maxlength="40" required></div>
        <div class="field">${IC("edit")}<input name="bio" value="${U.esc(ui.edit.bio)}" placeholder="О себе" maxlength="160"></div>
        <div><div class="tiny faint mb8">Эмодзи-аватар</div><div class="emoji-grid" id="editEmojiGrid">${C.AVATAR_EMOJI.map((e) => `<button type="button" data-act="edit-emoji" data-e="${e}" class="${ui.edit.emoji === e ? "active" : ""}" style="${ui.edit.emoji === e ? "background:rgba(126,231,199,.14)" : ""}">${e}</button>`).join("")}</div></div>
        <div><div class="tiny faint mb8">Цвет</div><div class="color-grid" id="editColorGrid">${C.AVATAR_COLORS.map((c) => `<button type="button" class="color-dot ${ui.edit.color === c ? "active" : ""}" style="--ac:${c}" data-act="edit-color" data-c="${c}" aria-label="Цвет"></button>`).join("")}</div></div>
        <button class="btn btn-primary btn-block" type="submit">${IC("check")} Сохранить</button>
      </form>
      <input type="file" id="avatarInput" accept="image/*" hidden data-img="avatar">
      <p class="sheet-note">Ник @${U.esc(me.username)} изменить нельзя — он твой адрес в Flok.</p>`);
  };
  function refreshEditAva() {
    const w = $("#editAvaWrap");
    if (w) w.innerHTML = editAvaHTML();
  }
  FA.refreshEditAva = refreshEditAva;
  FA.actions["edit-emoji"] = (el) => {
    ui.edit.emoji = el.dataset.e;
    ui.edit.image = "";
    $$("#editEmojiGrid button").forEach((b) => { b.style.background = "transparent"; });
    el.style.background = "rgba(126,231,199,.14)";
    refreshEditAva();
  };
  FA.actions["edit-color"] = (el) => {
    ui.edit.color = el.dataset.c;
    $$("#editColorGrid .color-dot").forEach((b) => b.classList.toggle("active", b === el));
    refreshEditAva();
  };
  FA.actions["edit-photo"] = () => { const f = $("#avatarInput"); if (f) f.click(); };
  FA.actions["edit-remove-photo"] = () => { ui.edit.image = ""; refreshEditAva(); toast("Фото убрано"); };
  FA.submits["editProfileForm"] = async (form) => {
    try {
      await S.updateProfile({ name: form.elements.name.value, bio: form.elements.bio.value, avatar: { emoji: ui.edit.emoji, color: ui.edit.color, image: ui.edit.image } });
      FA.closeModal();
      ui.me = S.me();
      renderProfile();
      toast("Профиль обновлён ✨", { emoji: "✨" });
    } catch (e) { toast(e.message, { emoji: "⚠️" }); }
  };

  /* ---------- settings ---------- */
  function hapticsOn() { try { return localStorage.getItem("flok_haptics") !== "0"; } catch (e) { return true; } }
  FA.actions["settings"] = () => {
    const me = S.me();
    const net = S.mode === "cloud";
    const server = (() => { try { return localStorage.getItem("flok_server") || ""; } catch (e) { return ""; } })();
    FA.sheet("Настройки", `<div class="menu-list">
      <button class="menu-item" data-act="server-sheet"><span class="menu-ic">${IC("hash")}</span><span class="grow"><h4>Сеть Flok</h4><p>${net ? "подключено · " + U.esc(server.replace(/^https?:\/\//, "")) : "локальный режим"}</p></span><span class="tag">${net ? "online" : "local"}</span></button>
      <button class="menu-item" data-act="toggle-haptics"><span class="menu-ic">${IC("spark")}</span><span class="grow"><h4>Вибрация</h4><p>лёгкий отклик при действиях</p></span><span class="chat-tag">${hapticsOn() ? "вкл" : "выкл"}</span></button>
      <button class="menu-item" data-act="about"><span class="menu-ic">${IC("gift")}</span><span class="grow"><h4>О Flok</h4><p>версия 1.0.0</p></span>${IC("chevron", "chev")}</button>
    </div>
    <div class="section-title"><h3>Аккаунт</h3></div>
    <div class="menu-list">
      <button class="menu-item" data-act="copy" data-text="@${U.esc(me.username)}"><span class="menu-ic">${IC("copy")}</span><span class="grow"><h4>@${U.esc(me.username)}</h4><p>${U.esc(me.email || "e-mail не указан")} · ${U.esc(me.phone || "телефон не указан")}</p></span>${IC("copy", "chev")}</button>
      <button class="menu-item danger" data-act="logout"><span class="menu-ic">${IC("logout")}</span><span class="grow"><h4>Выйти</h4><p>вернуться на экран входа</p></span>${IC("chevron", "chev")}</button>
    </div>
    <p class="sheet-note">Аккаунт хранится ${net ? "на сервере Flok" : "на этом устройстве"}. ${net ? "Пароль и e-mail никуда не передаются." : "Очистка данных приложения удалит аккаунт и подарки."}</p>`);
  };
  FA.actions["toggle-haptics"] = () => {
    const on = !hapticsOn();
    try { localStorage.setItem("flok_haptics", on ? "1" : "0"); } catch (e) {}
    toast(on ? "Вибрация включена" : "Вибрация выключена", { emoji: on ? "✨" : "🌙" });
    FA.actions["settings"]();
  };
  FA.actions["about"] = () => {
    FA.sheet("О Flok", `<div class="gift-detail">
      <span class="logo-orb" style="width:76px;height:76px">${IC("chat")}</span>
      <h3 class="gd-name" style="margin-top:14px">Flok</h3>
      <div class="gd-rarity"><span class="tag">версия 1.0.0</span></div>
      <p class="gd-desc" style="max-width:330px">Мессенджер с органическим стеклом, подарками, маркетом и собственной валютой. 30 подарков и 3 хэллоуинские лимитки — каждый с серийным номером.</p>
      <div class="pill-row" style="justify-content:center">
        <span class="tag">🫧 чаты</span><span class="tag">📣 каналы</span><span class="tag">🎁 подарки</span><span class="tag">🛍 маркет</span><span class="tag">✨ кликер</span><span class="tag">🌌 фоны</span>
      </div>
      <p class="sheet-note" style="margin-top:16px">Flok — демо-проект. Внутренняя валюта не имеет денежной стоимости. Пожалуйста, будь добр к людям по ту сторону экрана.</p>
    </div>`);
  };
  FA.actions["logout"] = () => {
    FA.confirmSheet({
      emoji: "👋", title: "Выйти из Flok?",
      text: "Аккаунт, подарки и Flok останутся на месте. Вернуться можно по нику и паролю.",
      ok: "Выйти", danger: true, onConfirm: async () => {
        await S.logout();
        location.reload();
      }
    });
  };
})(window.FA = window.FA || {});
