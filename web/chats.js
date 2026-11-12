/* Flok chats, people and channels */
(function (FA) {
  "use strict";
  const { C, U, S } = window.FLOK;
  const ui = FA.ui;
  const $ = FA.$, $$ = FA.$$, IC = FA.IC, coin = FA.coin;
  const avatar = FA.avatarHTML, giftArt = FA.giftArtHTML;

  async function reloadChatData() {
    ui.me = S.me();
    ui.chats = await S.getChats();
    ui.contacts = await S.getContacts();
    ui.channels = await S.getChannels();
    FA.renderNav();
  }
  function previewOf(chat) {
    const m = chat.last;
    if (!m) return "Начни разговор";
    if (m.gift) return "🎁 Подарок · " + m.gift.name;
    if (m.img && !m.text) return "📷 Фото";
    const prefix = m.from === (ui.me && ui.me.id) ? "Вы: " : "";
    return prefix + (m.text || "Фото");
  }
  function chatItemHTML(c) {
    const mine = ui.me && (c.last && c.last.from === ui.me.id);
    return `<button class="chat-item ${c.unread ? "unread" : ""}" data-act="open-chat" data-id="${c.id}">
      ${avatar(c.peer)}
      <span class="chat-main">
        <span class="chat-top"><span class="chat-name">${U.esc(c.peer.name)}</span>${c.peer.bot && c.peer.id === "bot_flok" ? `<span class="chat-tag official">team</span>` : ""}</span>
        <span class="chat-prev">${c.typing ? `<span class="chat-typing">печатает…</span>` : `${mine && c.last && !c.last.gift ? IC("checks") : ""}${U.esc(previewOf(c))}`}</span>
      </span>
      <span class="chat-side">
        <span class="time">${U.listTime(c.updatedAt)}</span>
        ${c.unread ? `<span class="badge">${c.unread > 99 ? "99+" : c.unread}</span>` : c.typing ? `<span class="dot-live"></span>` : ""}
      </span>
    </button>`;
  }
  function channelCardHTML(ch) {
    const last = ch.posts && ch.posts[0];
    return `<button class="channel-card" data-act="open-channel" data-id="${ch.id}">
      <span class="channel-ava" style="--ac:${U.esc(ch.color)}">${ch.emoji}</span>
      <span class="grow">
        <span class="chat-top"><span class="chat-name">${U.esc(ch.name)}</span>${ch.official ? `<span class="chat-tag official">official</span>` : ""}</span>
        <span class="channel-sub">${IC("user")} ${U.fmt(ch.subscribers)} подписчиков ${ch.joined ? "· вы с нами" : ""}</span>
        <span class="channel-last">${last ? U.esc(last.text.replace(/\n/g, " ")) : "Пока тихо"}</span>
      </span>
      ${IC("chevron", "chat-side")}
    </button>`;
  }
  function personHTML(p) {
    return `<div class="person-card">
      ${avatar(p)}
      <span class="grow">
        <span class="chat-name">${U.esc(p.name)}</span>
        <span class="channel-sub">@${U.esc(p.username)} ${p.online ? "· в сети" : ""}</span>
        <span class="person-bio">${U.esc(p.bio || "Без описания")}</span>
      </span>
      <button class="btn btn-soft btn-xs" data-act="start-chat" data-id="${p.id}">Написать</button>
    </div>`;
  }
  function filteredChats() {
    const q = U.normalize(ui.search);
    if (!q) return ui.chats;
    return ui.chats.filter((c) => U.normalize(c.peer.name).includes(q) || U.normalize(c.peer.username).includes(q) || U.normalize(previewOf(c)).includes(q));
  }
  function filteredChannels() {
    const q = U.normalize(ui.search);
    if (!q) return ui.channels;
    return ui.channels.filter((c) => U.normalize(c.name).includes(q) || U.normalize(c.handle).includes(q) || U.normalize(c.about).includes(q));
  }
  function filteredPeople() {
    const q = U.normalize(ui.peopleQ);
    const all = ui.contacts || [];
    if (!q) return all;
    return all.filter((p) => U.normalize(p.name).includes(q) || U.normalize(p.username).includes(q) || U.normalize(p.bio).includes(q));
  }
  function paneHTML() {
    if (ui.chatTab === "channels") {
      const list = filteredChannels();
      return `<div class="channel-grid">
        ${list.map(channelCardHTML).join("")}
        <button class="create-channel" data-act="new-channel">${IC("plus")} Создать свой канал</button>
      </div>`;
    }
    if (ui.chatTab === "people") {
      const list = filteredPeople();
      return `<div class="contact-add">
          <div class="field">${IC("search")}<input id="contactQuery" placeholder="@ник, e-mail или телефон" autocapitalize="none"></div>
          <button class="btn btn-primary btn-sm" data-act="add-contact">${IC("plus")}</button>
        </div>
        <div class="searchbar" style="margin-top:8px">${IC("search")}<input id="peopleSearch" placeholder="Поиск людей" value="${U.esc(ui.peopleQ)}"></div>
        <div class="section-title"><h3>Люди Flok</h3><span class="tiny faint">${list.length}</span></div>
        ${list.length ? list.map(personHTML).join("") : `<div class="empty"><div class="empty-art">🔎</div><h3>Никого не нашли</h3><p>Попробуй другой ник или добавь человека по e-mail / номеру.</p></div>`}`;
    }
    const list = filteredChats();
    return list.length ? list.map(chatItemHTML).join("") : `<div class="empty"><div class="empty-art">💬</div><h3>${ui.search ? "Ничего не нашлось" : "Пока пусто"}</h3><p>${ui.search ? "Попробуй другое имя или сообщение." : "Найди людей во вкладке «Люди» — или начни с Flok Team."}</p><button class="btn btn-soft btn-sm" data-act="chat-tab" data-sub="people">Найти людей</button></div>`;
  }

  async function renderChats() {
    const screen = $("#screen");
    const token = ++ui.renderToken;
    screen.innerHTML = `<div class="screen-head"><div><div class="eyebrow">Flok</div><h1>Чаты</h1></div><div class="head-actions"><span class="balance-chip">${coin()} <span class="js-balance">${U.fmt((S.me() || {}).balance || 0)}</span></span></div></div><div class="skeleton" style="height:78px;margin-bottom:12px"></div><div class="skeleton" style="height:280px"></div>`;
    try { await reloadChatData(); } catch (e) { screen.innerHTML = `<div class="empty"><h3>Не удалось загрузить</h3><p>${U.esc(e.message)}</p></div>`; return; }
    if (token !== ui.renderToken || ui.tab !== "chats") return;
    screen.innerHTML = `
      <div class="screen-head">
        <div><div class="eyebrow">Flok · ${ui.chats.reduce((n, c) => n + (c.unread || 0), 0) || "все прочитано"}</div><h1>Чаты</h1></div>
        <div class="head-actions">
          <button class="icon-btn" data-act="chat-tab" data-sub="people" aria-label="Новый чат">${IC("plus")}</button>
          ${avatar(ui.me, "sm")}
        </div>
      </div>
      <div class="searchbar">${IC("search")}<input id="chatSearch" placeholder="Поиск по чатам" value="${U.esc(ui.search)}" autocomplete="off"><span class="kbd">flok</span></div>
      <div class="seg tabs">
        <button class="seg-btn ${ui.chatTab === "chats" ? "active" : ""}" data-act="chat-tab" data-sub="chats">Чаты ${ui.chats.length ? `· ${ui.chats.length}` : ""}</button>
        <button class="seg-btn ${ui.chatTab === "channels" ? "active" : ""}" data-act="chat-tab" data-sub="channels">Каналы</button>
        <button class="seg-btn ${ui.chatTab === "people" ? "active" : ""}" data-act="chat-tab" data-sub="people">Люди</button>
      </div>
      <div id="chats-pane">${paneHTML()}</div>`;
    if (ui.search && $("#chatSearch")) { const inp = $("#chatSearch"); inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  }
  FA.screens.chats = renderChats;

  FA.actions["chat-tab"] = (el) => {
    ui.chatTab = el.dataset.sub || "chats";
    ui.search = "";
    if (el.dataset.sub === "channels") ui.peopleQ = "";
    renderChats();
  };
  FA.actions["new-chat"] = () => { ui.chatTab = "people"; renderChats(); };
  FA.inputs.chatSearch = (v) => {
    ui.search = v;
    const pane = $("#chats-pane");
    if (pane) pane.innerHTML = paneHTML();
  };
  FA.inputs.peopleSearch = (v) => {
    ui.peopleQ = v;
    const pane = $("#chats-pane");
    if (pane) { pane.innerHTML = paneHTML(); const inp = $("#peopleSearch"); if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); } }
  };
  FA.actions["add-contact"] = async () => {
    const q = ($("#contactQuery") || {}).value || "";
    try {
      const p = await S.addContact(q);
      toast("Контакт добавлен: " + p.name, { emoji: "👤" });
      const chatId = await S.startChat(p.id);
      await reloadChatData();
      openChat(chatId);
    } catch (e) { toast(e.message, { emoji: "⚠️" }); }
  };
  FA.actions["start-chat"] = async (el) => {
    try {
      const id = await S.startChat(el.dataset.id);
      await reloadChatData();
      openChat(id);
    } catch (e) { toast(e.message, { emoji: "⚠️" }); }
  };

  /* ---------- chat page ---------- */
  function pushLayer() {
    if (!ui.layerPushed) {
      try { history.pushState({ flokLayer: 1 }, ""); ui.layerPushed = true; } catch (e) {}
    }
    $("#layer").classList.remove("hidden");
    ui.modalPushed = false;
  }
  function closeLayer() {
    const layer = $("#layer");
    layer.classList.add("hidden");
    layer.innerHTML = "";
    ui.activeChat = null; ui.activePeer = null; ui.activeChannel = null;
    ui.pendingImg = "";
    S.activeChat = null;
    ui.layerPushed = false;
    FA.renderNav();
    if (ui.tab === "chats") renderChats();
    else if (ui.tab === "profile") FA.renderScreen();
  }
  FA.doCloseLayer = closeLayer;
  FA.actions["close-layer"] = () => {
    if (ui.layerPushed) { try { history.back(); } catch (e) { closeLayer(); } }
    else closeLayer();
  };

  function chatMessagesHTML(chatId, peer) {
    const msgs = ui.messages || [];
    const me = ui.me;
    let out = "";
    if (!msgs.length) {
      out += `<div class="chat-welcome">
        ${avatar(peer, "lg")}
        <h3>${U.esc(peer.name)}</h3>
        <p>${U.esc(peer.bio || "Это начало вашей переписки. Скажи привет!")}</p>
        <div class="pill-row center" style="justify-content:center;margin-top:14px">
          ${["Привет! 👋", "Как дела?", "Что нового?"].map((t) => `<button class="chip" data-act="quick-send" data-text="${t}">${t}</button>`).join("")}
        </div>
      </div>`;
    }
    let lastDay = "";
    msgs.forEach((m) => {
      const dk = U.dayKey(m.ts);
      if (dk !== lastDay) { lastDay = dk; out += `<div class="msg-day">${U.dayLabel(m.ts)}</div>`; }
      const mine = m.from === me.id;
      const from = mine ? me : peer;
      let body = "";
      if (m.gift) {
        const g = U.giftById(m.gift.giftId) || { name: m.gift.name, emoji: "🎁", rarity: "epic" };
        const c = U.giftColors(g);
        body += `<div class="gift-msg">${giftArt(g, m.gift.serial, "gift-thumb")}<span class="grow"><span class="gm-name">${U.esc(g.name)}</span><span class="gm-sub">Подарок · серия #${m.gift.serial}</span><span class="price" style="display:flex">${coin()} ${U.fmt(m.gift.price || g.price)}</span></span></div>`;
      }
      if (m.img) body += `<img src="${m.img}" alt="Фото" style="width:100%;border-radius:13px;margin-bottom:${m.text ? "5px" : "0"}">`;
      if (m.text) body += `<span class="txt">${U.esc(m.text).replace(/\n/g, "<br>")}</span>`;
      out += `<div class="msg-row ${mine ? "me" : ""}">
        ${mine ? "" : avatar(from, "msg-ava")}
        <div class="bubble ${mine ? "me" : ""} ${m.gift ? "bubble-gift" : ""}">${body}
          <span class="meta">${U.HHMM(m.ts)} ${mine ? IC("checks") : ""}</span>
        </div>
      </div>`;
    });
    if (ui.typing[chatId]) {
      out += `<div class="msg-row">${avatar(peer, "msg-ava")}<div class="bubble typing"><i></i><i></i><i></i></div></div>`;
    }
    return out;
  }
  function chatPageHTML(peer) {
    return `<div class="chat-page">
      <div class="chat-top">
        <button class="icon-btn plain" data-act="close-layer" aria-label="Назад">${IC("back")}</button>
        <button class="chat-peer" data-act="peer-info">
          ${avatar(peer, "sm")}
          <span class="grow"><span class="chat-peer-name">${U.esc(peer.name)}</span>
          <span class="chat-status ${ui.typing[ui.activeChat] ? "" : "off"}" id="chatStatus">${ui.typing[ui.activeChat] ? "печатает…" : peer.online ? "в сети" : "был(а) недавно"}</span></span>
        </button>
        <button class="icon-btn plain" data-act="peer-info" aria-label="О собеседнике">${IC("more")}</button>
      </div>
      <div class="chat-scroll" id="chatScroll">${chatMessagesHTML(ui.activeChat, peer)}</div>
      <div class="composer-wrap">
        <div id="attachPreview"></div>
        <div class="emoji-row">
          ${C.EMOJIS.slice(0, 10).map((e) => `<button class="emoji-chip" data-act="emoji" data-e="${e}">${e}</button>`).join("")}
          <button class="emoji-chip" data-act="emoji-more" aria-label="Все эмодзи">＋</button>
        </div>
        <form class="composer" id="chatForm">
          <button type="button" class="icon-btn sm plain" data-act="attach" aria-label="Прикрепить фото">${IC("image")}</button>
          <input name="msg" id="msgInput" placeholder="Сообщение" autocomplete="off" maxlength="4000">
          <button class="send-btn" type="submit" aria-label="Отправить">${IC("send")}</button>
        </form>
        <input type="file" id="chatImageInput" accept="image/*" hidden data-img="chat">
      </div>
    </div>`;
  }
  async function openChat(chatId) {
    const chat = (ui.chats || []).find((c) => c.id === chatId);
    const peer = chat ? chat.peer : S.profileOf("bot_flok");
    ui.activeChat = chatId; ui.activePeer = peer; ui.activeChannel = null; ui.typing = ui.typing || {};
    pushLayer();
    const layer = $("#layer");
    layer.innerHTML = chatPageHTML(peer);
    try {
      ui.messages = await S.getChatMessages(chatId);
    } catch (e) { ui.messages = []; toast(e.message, { emoji: "⚠️" }); }
    const scroll = $("#chatScroll");
    if (scroll) scroll.innerHTML = chatMessagesHTML(chatId, peer);
    scrollBottom();
    const inp = $("#msgInput"); if (inp) inp.focus();
    reloadChatData().then(() => { if (ui.activeChat === chatId) { const item = (ui.chats || []).find((c) => c.id === chatId); if (item && item.peer) ui.activePeer = item.peer; } });
  }
  FA.openChat = openChat;
  FA.actions["open-chat"] = (el) => openChat(el.dataset.id);

  function scrollBottom() {
    requestAnimationFrame(() => { const sc = $("#chatScroll"); if (sc) sc.scrollTop = sc.scrollHeight; });
  }
  async function refreshChat() {
    if (!ui.activeChat) return;
    const chat = (ui.chats || []).find((c) => c.id === ui.activeChat);
    const peer = chat ? chat.peer : ui.activePeer;
    if (!peer) return;
    try { ui.messages = await S.getChatMessages(ui.activeChat); } catch (e) {}
    const sc = $("#chatScroll");
    if (sc) { sc.innerHTML = chatMessagesHTML(ui.activeChat, peer); scrollBottom(); }
    const st = $("#chatStatus");
    if (st) { const t = !!ui.typing[ui.activeChat]; st.textContent = t ? "печатает…" : peer.online ? "в сети" : "был(а) недавно"; st.classList.toggle("off", !t && !peer.online); }
  }
  FA.refreshChat = refreshChat;

  FA.submits["chatForm"] = async (form) => {
    if (!ui.activeChat) return;
    const text = (form.elements.msg.value || "").trim();
    const img = ui.pendingImg;
    if (!text && !img) return;
    form.elements.msg.value = "";
    ui.pendingImg = "";
    renderAttach();
    try {
      await S.sendMessage(ui.activeChat, { text, img });
      await refreshChat();
    } catch (e) { toast(e.message, { emoji: "⚠️" }); }
  };
  FA.actions["quick-send"] = async (el) => {
    if (!ui.activeChat) return;
    try { await S.sendMessage(ui.activeChat, { text: el.dataset.text }); await refreshChat(); }
    catch (e) { toast(e.message, { emoji: "⚠️" }); }
  };
  FA.actions["emoji"] = (el) => {
    const inp = $("#msgInput");
    if (inp) { inp.value += el.dataset.e; inp.focus(); }
    else if (FA.ui.activeChannel) { const pin = $("#postInput"); if (pin) { pin.value += el.dataset.e; pin.focus(); } }
  };
  FA.actions["emoji-more"] = () => {
    FA.sheet("Эмодзи", `<div class="emoji-grid">${C.EMOJIS.map((e) => `<button data-act="pick-emoji" data-e="${e}">${e}</button>`).join("")}</div>`);
  };
  FA.actions["pick-emoji"] = (el) => {
    const inp = $("#msgInput") || $("#postInput");
    if (inp) inp.value += el.dataset.e;
    FA.closeModal();
  };
  FA.actions["attach"] = () => { const f = $("#chatImageInput"); if (f) f.click(); };
  function renderAttach() {
    const box = $("#attachPreview");
    if (!box) return;
    box.innerHTML = ui.pendingImg ? `<div class="attach-preview"><img src="${ui.pendingImg}" alt=""><span class="grow tiny muted">Фото готово к отправке</span><button class="icon-btn sm plain" data-act="remove-attach" aria-label="Убрать">${IC("close")}</button></div>` : "";
  }
  FA.renderAttachPreview = renderAttach;
  FA.actions["remove-attach"] = () => { ui.pendingImg = ""; renderAttach(); };

  FA.actions["peer-info"] = () => {
    if (!ui.activePeer) return;
    const peer = S.profileOf(ui.activePeer.id) || ui.activePeer;
    const bg = U.bgById(peer.bg) || C.BACKGROUNDS[0];
    const gifts = (peer.gifts || []).filter((o) => o.gift);
    FA.sheet(U.esc(peer.name), `<div class="public-profile">
      <div class="profile-cover" style="height:126px;margin-bottom:-36px">
        <span class="cover-art" style="background:${bg.css}"></span>
        <span class="cover-label">${IC("image")} фон профиля · ${U.esc(bg.name)}</span>
      </div>
      <div class="center" style="position:relative;z-index:3">${avatar(peer, "xl ring")}</div>
      <h3 class="gd-name" style="margin-top:12px">${U.esc(peer.name)}</h3>
      <div class="profile-handle center">@${U.esc(peer.username)}</div>
      <p class="gd-desc" style="margin-top:10px">${U.esc(peer.bio || "Без описания")}</p>
      <div class="tag">${peer.bot ? "аккаунт Flok" : "пользователь Flok"}</div>
      <div class="section-title" style="margin-top:18px"><h3>Витрина</h3><span class="tiny faint">${gifts.length} подарков</span></div>
      ${gifts.length ? `<div class="shelf">${gifts.slice(0, 6).map((o) => `<div class="gift-card">
        ${giftArt(o.gift, o.serial)}<div class="gift-name"><span class="ellipsis">${U.esc(o.gift.name)}</span></div>
        <div class="rarity" style="--rc:${U.rarityColor(o.gift.rarity)}">${U.rarityLabel(o.gift.rarity)}</div>
      </div>`).join("")}</div>` : `<p class="tiny faint center" style="margin:8px 0 0">Витрина пока пустая</p>`}
      <div class="gd-actions" style="margin-top:18px">
        <button class="btn btn-ghost" data-act="close-modal">${IC("chat")} Вернуться в чат</button>
      </div>
    </div>`);
  };

  /* ---------- channels ---------- */
  function channelPageHTML(ch) {
    const isOwner = ch.isOwner;
    return `<div class="chat-page">
      <div class="chat-top">
        <button class="icon-btn plain" data-act="close-layer" aria-label="Назад">${IC("back")}</button>
        <span class="grow"><span class="chat-peer-name">${U.esc(ch.name)}</span><span class="chat-status off">${U.fmt(ch.subscribers)} подписчиков</span></span>
        <button class="icon-btn plain" data-act="channel-info" aria-label="О канале">${IC("more")}</button>
      </div>
      <div class="ch-posts" id="channelPosts">
        <div class="channel-cover" style="--ac:${U.esc(ch.color)}">
          <div class="ch-big">${ch.emoji}</div>
          <h2>${U.esc(ch.name)}</h2>
          <div class="handle">${U.esc(ch.handle)} ${ch.official ? "· official" : ""}</div>
          <div class="about">${U.esc(ch.about || "Канал без описания")}</div>
          <div class="ch-stats"><span><b>${U.fmt(ch.subscribers)}</b> подписчиков</span><span><b>${ch.posts.length}</b> постов</span></div>
          <div class="mt12">
            ${isOwner ? `<span class="tag">${IC("edit")} твой канал</span>` : ch.joined ? `<button class="btn btn-ghost btn-sm" data-act="leave-channel" data-id="${ch.id}">Вы подписаны</button>` : `<button class="btn btn-primary btn-sm" data-act="join-channel" data-id="${ch.id}">${IC("plus")} Подписаться</button>`}
          </div>
        </div>
        <div class="section-title"><h3>Публикации</h3><span class="tiny faint">${ch.official ? "официальный" : "канал"}</span></div>
        ${ch.posts.map((p) => `<div class="post">
          <div class="post-top"><span class="channel-ava" style="--ac:${U.esc(ch.color)};width:28px;height:28px;border-radius:9px;font-size:14px">${ch.emoji}</span><span class="grow"><div class="post-name">${U.esc(ch.name)}</div><div class="post-time">${U.timeAgo(p.ts)}</div></span></div>
          <div class="post-text">${U.esc(p.text).replace(/\n/g, "<br>")}</div>
          <div class="post-views">${IC("eye")} ${U.fmt(p.views)}</div>
        </div>`).join("") || `<div class="empty"><div class="empty-art">📝</div><h3>Постов пока нет</h3><p>${isOwner ? "Напиши первый пост ниже." : "Загляни позже."}</p></div>`}
        <div style="height:10px"></div>
      </div>
      ${isOwner ? `<div class="composer-wrap"><form class="composer" id="channelPostForm"><input name="post" id="postInput" placeholder="Новый пост в канал…" maxlength="3000" autocomplete="off"><button class="send-btn" type="submit" aria-label="Опубликовать">${IC("send")}</button></form></div>` : ""}
    </div>`;
  }
  async function openChannel(channelId) {
    ui.activeChannel = channelId; ui.activeChat = null; ui.activePeer = null;
    pushLayer();
    const layer = $("#layer");
    layer.innerHTML = `<div class="loading-line"><i></i><i></i><i></i></div>`;
    try {
      const ch = await S.getChannel(channelId);
      ui.activeChannel = channelId;
      layer.innerHTML = channelPageHTML(ch);
      if (S.me() && S.me().unread && S.me().unread[channelId]) { S.me().unread[channelId] = 0; S.save && S.save(); }
    } catch (e) { layer.innerHTML = `<div class="empty" style="margin:20px"><h3>Канал не найден</h3><p>${U.esc(e.message)}</p><button class="btn btn-ghost btn-sm" data-act="close-layer">Назад</button></div>`; }
  }
  FA.openChannel = openChannel;
  async function refreshChannel() {
    if (!ui.activeChannel) return;
    try { const ch = await S.getChannel(ui.activeChannel); const layer = $("#layer"); if (layer) layer.innerHTML = channelPageHTML(ch); }
    catch (e) { toast(e.message, { emoji: "⚠️" }); }
  }
  FA.refreshChannel = refreshChannel;
  FA.actions["open-channel"] = (el) => openChannel(el.dataset.id);
  FA.actions["join-channel"] = async (el) => {
    try { await S.joinChannel(el.dataset.id); toast("Ты подписан ✨", { emoji: "✨" }); await refreshChannel(); await reloadChatData(); }
    catch (e) { toast(e.message, { emoji: "⚠️" }); }
  };
  FA.actions["leave-channel"] = async (el) => {
    try { await S.leaveChannel(el.dataset.id); toast("Подписка отменена"); await refreshChannel(); await reloadChatData(); }
    catch (e) { toast(e.message, { emoji: "⚠️" }); }
  };
  FA.actions["channel-info"] = () => { toast("Канал создан в Flok. Посты видят все подписчики", { emoji: "🫧" }); };
  FA.submits["channelPostForm"] = async (form) => {
    try {
      await S.postChannel(ui.activeChannel, form.elements.post.value);
      form.elements.post.value = "";
      await refreshChannel();
      toast("Опубликовано ✨", { emoji: "✨" });
    } catch (e) { toast(e.message, { emoji: "⚠️" }); }
  };
  FA.actions["new-channel"] = () => {
    ui.chDraft = { emoji: "🫧", color: "#58e0bd" };
    FA.sheet("Новый канал", `<p class="sheet-lead">Канал — это твоя сцена. Подписчики видят посты, а писать можешь только ты.</p>
      <form id="createChannelForm" class="form-stack">
        <div class="field">${IC("hash")}<input name="name" placeholder="Название канала" maxlength="40" required></div>
        <div class="field">${IC("edit")}<input name="about" placeholder="О чём канал?" maxlength="160"></div>
        <div><div class="tiny faint mb8">Аватар канала</div><div class="pill-row" id="chEmojiRow">${["🫧", "✨", "🌌", "🎁", "🪐", "🔥", "🍀", "🎧"].map((e) => `<button type="button" class="chip ${e === "🫧" ? "active" : ""}" data-act="ch-emoji" data-e="${e}">${e}</button>`).join("")}</div></div>
        <div><div class="tiny faint mb8">Цвет</div><div class="color-grid" id="chColorRow">${C.AVATAR_COLORS.slice(0, 8).map((c, i) => `<button type="button" class="color-dot ${i === 0 ? "active" : ""}" style="--ac:${c}" data-act="ch-color" data-c="${c}" aria-label="Цвет"></button>`).join("")}</div></div>
        <button class="btn btn-primary btn-block" type="submit">${IC("plus")} Создать канал</button>
      </form>`);
  };
  FA.actions["ch-emoji"] = (el) => {
    ui.chDraft.emoji = el.dataset.e;
    $$("#chEmojiRow .chip").forEach((x) => x.classList.toggle("active", x === el));
  };
  FA.actions["ch-color"] = (el) => {
    ui.chDraft.color = el.dataset.c;
    $$("#chColorRow .color-dot").forEach((x) => x.classList.toggle("active", x === el));
  };
  FA.submits["createChannelForm"] = async (form) => {
    try {
      const id = await S.createChannel({ name: form.elements.name.value, about: form.elements.about.value, emoji: ui.chDraft.emoji, color: ui.chDraft.color });
      FA.closeModal();
      await reloadChatData();
      await openChannel(id);
      toast("Канал создан. Теперь у тебя есть сцена ✨", { emoji: "✨" });
    } catch (e) { toast(e.message, { emoji: "⚠️" }); }
  };

  /* ---------- store events ---------- */
  FA.onStoreEvent = function (type, data) {
    if (type === "message" && data) {
      if (ui.activeChat === data.chatId) { refreshChat(); }
      else if (ui.tab === "chats" && document.activeElement !== $("#chatSearch")) {
        reloadChatData().then(() => { const pane = $("#chats-pane"); if (pane && ui.tab === "chats") pane.innerHTML = paneHTML(); });
      }
      if (data.msg && data.msg.from !== (ui.me && ui.me.id) && ui.activeChat !== data.chatId) {
        const who = (ui.contacts || []).find((p) => p.id === data.msg.from) || (data.msg.from ? S.profileOf(data.msg.from) : null);
        const txt = data.msg.gift ? "🎁 " + data.msg.gift.name : (data.msg.text || "Фото").slice(0, 60);
        if (who) toast(who.name + ": " + txt, { emoji: who.avatar.emoji || "💬" });
      }
    }
    if (type === "typing" && data) {
      ui.typing[data.chatId] = data.on;
      if (ui.activeChat === data.chatId) {
        const st = $("#chatStatus");
        if (st) st.textContent = data.on ? "печатает…" : "в сети";
        refreshChat();
      }
    }
    if (type === "sold" && data) {
      toast("Твой лот купили! +" + U.fmt(data.payout) + " Flok", { emoji: "💰", ms: 5000 });
      if (ui.tab === "market" || ui.tab === "wallet" || ui.tab === "profile") FA.renderScreen();
    }
    if (type === "market") {
      if (ui.tab === "market" && !$("#modal").classList.contains("open")) FA.renderScreen();
    }
  };
})(window.FA = window.FA || {});
