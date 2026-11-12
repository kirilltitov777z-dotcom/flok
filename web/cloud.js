/* Flok cloud store — real accounts and chats through a Flok server */
(function (FLOK) {
  "use strict";
  const { C, U } = FLOK;
  const TOKEN_KEY = "flok_cloud_token";
  const TOKEN_SERVER = "flok_cloud_token_server";
  const botBg = { bot_luna: "cosmos1", bot_kai: "cosmos3", bot_mira: "cosmos2", bot_alice: "rose", bot_max: "sunset" };

  function botProfile(b) {
    return {
      id: b.id, username: b.username, name: b.name, bio: b.bio,
      avatar: { emoji: b.emoji, color: b.color }, bot: true, online: true,
      bg: botBg[b.id] || "default", gifts: [], email: "", phone: ""
    };
  }
  function publicFromMe(me) {
    return {
      id: me.id, username: me.username, name: me.name, bio: me.bio, avatar: me.avatar,
      bot: false, online: true, email: me.email || "", phone: me.phone || "",
      createdAt: me.createdAt, bg: me.bg, gifts: []
    };
  }

  class CloudStore {
    constructor(base) {
      this.mode = "cloud";
      this.base = String(base || "").replace(/\/+$/, "");
      this.token = "";
      this._me = null;
      this.listeners = [];
      this.profileCache = new Map();
      this.activeChat = null;
      this._ws = null;
      this._reconnect = null;
      this._closing = false;
      try {
        const savedFor = localStorage.getItem(TOKEN_SERVER) || "";
        if (savedFor === this.base) this.token = localStorage.getItem(TOKEN_KEY) || "";
        else { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TOKEN_SERVER); }
      } catch (e) {}
    }

    /* ---------- transport ---------- */
    async api(path, opts) {
      opts = opts || {};
      const headers = { "Content-Type": "application/json" };
      if (this.token) headers.Authorization = "Bearer " + this.token;
      let res;
      try {
        res = await fetch(this.base + path, {
          method: opts.method || "GET",
          headers,
          body: opts.body == null ? undefined : JSON.stringify(opts.body)
        });
      } catch (e) {
        throw new Error("Нет связи с Flok-сервером. Проверь адрес сети.");
      }
      let data = {};
      try { data = await res.json(); } catch (e) {}
      if (!res.ok) {
        if (res.status === 401) this._sessionLost();
        throw new Error(data.error || ("Ошибка сервера " + res.status));
      }
      this._absorb(data);
      return data;
    }
    _absorb(data) {
      if (!data || typeof data !== "object") return;
      if (data.user) this._me = data.user;
      if (data.profile) this._cache(data.profile);
      if (data.peer) this._cache(data.peer);
      if (data.seller) this._cache(data.seller);
      if (Array.isArray(data.chats)) data.chats.forEach((c) => this._cache(c.peer));
      if (Array.isArray(data.contacts)) data.contacts.forEach((p) => this._cache(p));
      if (Array.isArray(data.listings)) data.listings.forEach((l) => this._cache(l.seller));
      if (data.channel && data.channel.author) this._cache(data.channel.author);
      if (data.recipient) this._cache(data.recipient);
      if (data.buyer) this._cache(data.buyer);
    }
    _cache(p) {
      if (p && p.id) this.profileCache.set(p.id, p);
    }
    _storeSession(token) {
      this.token = token;
      try { localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(TOKEN_SERVER, this.base); } catch (e) {}
      this._connect();
    }
    _sessionLost() {
      this.token = "";
      this._me = null;
      try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TOKEN_SERVER); } catch (e) {}
      this._closeWs();
    }
    _closeWs() {
      this._closing = true;
      if (this._reconnect) { clearTimeout(this._reconnect); this._reconnect = null; }
      if (this._ws) { try { this._ws.close(); } catch (e) {} this._ws = null; }
    }
    _connect() {
      if (!this.token || typeof WebSocket === "undefined") return;
      this._closeWs();
      this._closing = false;
      let url;
      try {
        const u = new URL(this.base);
        u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
        u.pathname = u.pathname.replace(/\/+$/, "") + "/ws";
        u.search = "?token=" + encodeURIComponent(this.token);
        url = u.toString();
      } catch (e) { return; }
      let ws;
      try { ws = new WebSocket(url); } catch (e) { return; }
      this._ws = ws;
      ws.onmessage = (event) => {
        if (this._ws !== ws) return;
        let pack;
        try { pack = JSON.parse(event.data); } catch (e) { return; }
        if (!pack || !pack.type) return;
        if (pack.data) {
          if (pack.data.user) this._me = pack.data.user;
          this._cache(pack.data.peer);
          if (pack.data.listing && pack.data.listing.seller) this._cache(pack.data.listing.seller);
          if (pack.data.buyer) this._cache(pack.data.buyer);
        }
        this.emit(pack.type, pack.data || {});
      };
      ws.onclose = () => {
        if (this._ws !== ws) return;
        this._ws = null;
        if (this._closing || !this.token) return;
        if (this._reconnect) clearTimeout(this._reconnect);
        this._reconnect = setTimeout(() => { this._reconnect = null; this._connect(); }, 4000);
      };
      ws.onerror = () => {};
    }

    /* ---------- lifecycle / auth ---------- */
    async boot() {
      if (!this.token) return { session: false };
      try {
        const r = await this.api("/api/me");
        this._me = r.user;
        this._connect();
        this.tickPassive(false);
        return { session: true };
      } catch (e) {
        if (e.message && /войти/i.test(e.message)) this._sessionLost();
        return { session: false, error: e.message };
      }
    }
    async register(data) {
      const r = await this.api("/api/register", { method: "POST", body: data });
      this._storeSession(r.token);
      this._me = r.user;
      return this.safeMeCopy();
    }
    async login(data) {
      const r = await this.api("/api/login", { method: "POST", body: data });
      this._storeSession(r.token);
      this._me = r.user;
      return this.safeMeCopy();
    }
    async logout() {
      try { await this.api("/api/logout", { method: "POST" }); } catch (e) {}
      this._sessionLost();
      this._me = null;
    }
    me() { return this._me; }
    safeMeCopy() { return this._me; }
    save() {}
    saveSoon() {}
    on(fn) {
      this.listeners.push(fn);
      return () => { this.listeners = this.listeners.filter((f) => f !== fn); };
    }
    emit(type, data) {
      this.listeners.forEach((fn) => { try { fn(type, data); } catch (e) { console.error(e); } });
    }
    profileOf(id) {
      if (id && String(id).startsWith("bot_")) {
        const b = C.BOTS.find((x) => x.id === id);
        if (b) return botProfile(b);
      }
      if (this._me && id === this._me.id) return publicFromMe(this._me);
      return this.profileCache.get(id) || { id, username: "user", name: "Пользователь", bio: "", avatar: {}, bot: false, online: false, bg: "default", gifts: [] };
    }
    chattersFor(id) { return this.profileOf(id); }
    tickPassive() {
      const me = this._me;
      if (!me || !me.clicker) return;
      const c = me.clicker;
      const now = Date.now();
      const maxE = 500 + ((c.energyLvl || 1) - 1) * 150;
      const gained = Math.floor((now - (c.lastEnergy || now)) / 1000 * 2);
      if (gained > 0) { c.energy = Math.min(maxE, (c.energy || 0) + gained); c.lastEnergy = now; }
      c.energy = U.clamp(c.energy, 0, maxE);
    }

    /* ---------- chats ---------- */
    async getChats() {
      const r = await this.api("/api/chats");
      return r.chats || [];
    }
    async startChat(peerId) {
      const r = await this.api("/api/chats", { method: "POST", body: { peerId } });
      return r.chatId;
    }
    async getChatMessages(chatId) {
      const r = await this.api("/api/chats/" + encodeURIComponent(chatId) + "/messages");
      this.activeChat = chatId;
      return r.messages || [];
    }
    async sendMessage(chatId, payload) {
      const body = { text: (payload && payload.text) || "", img: (payload && payload.img) || "" };
      const r = await this.api("/api/chats/" + encodeURIComponent(chatId) + "/messages", { method: "POST", body });
      return r.message;
    }
    async addContact(query) {
      const r = await this.api("/api/contacts", { method: "POST", body: { query } });
      return r.profile;
    }
    async getContacts() {
      const r = await this.api("/api/contacts");
      return r.contacts || [];
    }
    async searchPeople(q) {
      const r = await this.api("/api/search?q=" + encodeURIComponent(q || ""));
      return r.people || [];
    }

    /* ---------- channels ---------- */
    async getChannels() {
      const r = await this.api("/api/channels");
      return r.channels || [];
    }
    async getChannel(id) {
      const r = await this.api("/api/channels/" + encodeURIComponent(id));
      if (r.channel && r.channel.author) this._cache(r.channel.author);
      return r.channel;
    }
    async joinChannel(id) {
      await this.api("/api/channels/" + encodeURIComponent(id) + "/join", { method: "POST" });
      return true;
    }
    async leaveChannel(id) {
      await this.api("/api/channels/" + encodeURIComponent(id) + "/leave", { method: "POST" });
      return true;
    }
    async createChannel(data) {
      const r = await this.api("/api/channels", { method: "POST", body: data });
      return r.id;
    }
    async postChannel(id, text) {
      await this.api("/api/channels/" + encodeURIComponent(id) + "/posts", { method: "POST", body: { text } });
      return true;
    }

    /* ---------- market ---------- */
    async getMarket() {
      const r = await this.api("/api/market");
      return r.listings || [];
    }
    async getShopInfo() {
      const r = await this.api("/api/shop");
      return r.shop || {};
    }
    async buyGift(giftId) {
      const r = await this.api("/api/shop/buy", { method: "POST", body: { giftId } });
      return r.owned;
    }
    async getMyGifts() {
      const r = await this.api("/api/gifts");
      return r.gifts || [];
    }
    async listGift(uid, price) {
      const r = await this.api("/api/market/list", { method: "POST", body: { uid, price } });
      return r.listing;
    }
    async cancelListing(id) {
      await this.api("/api/market/cancel", { method: "POST", body: { id } });
      return true;
    }
    async buyListing(id) {
      const r = await this.api("/api/market/buy", { method: "POST", body: { id } });
      return r.owned;
    }
    async quickSell(uid) {
      const r = await this.api("/api/gifts/quick-sell", { method: "POST", body: { uid } });
      return { amount: r.amount, gift: r.gift };
    }
    async giftTo(uid, toId) {
      const r = await this.api("/api/gifts/gift", { method: "POST", body: { uid, toId } });
      return { gift: r.gift, recipient: r.recipient };
    }

    /* ---------- backgrounds / profile ---------- */
    async getBackgrounds() {
      const r = await this.api("/api/backgrounds");
      return r.backgrounds || [];
    }
    async buyBackground(id) {
      await this.api("/api/backgrounds/buy", { method: "POST", body: { id } });
      return true;
    }
    async selectBackground(id) {
      await this.api("/api/backgrounds/select", { method: "POST", body: { id } });
      return true;
    }
    async updateProfile(data) {
      const r = await this.api("/api/profile", { method: "PATCH", body: data });
      return r.user;
    }

    /* ---------- daily / clicker / wallet ---------- */
    async claimDaily() {
      const r = await this.api("/api/daily", { method: "POST" });
      return { amount: r.amount, streak: r.streak };
    }
    async click() {
      const r = await this.api("/api/click", { method: "POST" });
      return { balance: r.balance, energy: r.energy, maxE: r.maxE };
    }
    async upgrade(id) {
      const r = await this.api("/api/upgrade", { method: "POST", body: { id } });
      return { cost: r.cost, lvl: r.lvl };
    }
    async getWallet() {
      const r = await this.api("/api/wallet");
      return { balance: r.balance, tx: r.tx, id: r.id, clicker: r.clicker };
    }
  }

  FLOK.CloudStore = CloudStore;
  const server = (() => { try { return localStorage.getItem("flok_server") || ""; } catch (e) { return ""; } })();
  if (server) FLOK.S = new CloudStore(server);
})(window.FLOK);
