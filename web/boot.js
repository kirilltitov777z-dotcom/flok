/* Flok boot — event delegation, files, init */
(function (FA) {
  "use strict";
  const { S, U } = window.FLOK;
  const ui = FA.ui;
  const $ = FA.$, $$ = FA.$$;

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const fn = FA.actions[el.dataset.act];
    if (!fn) return;
    if (el.tagName === "BUTTON" || el.getAttribute("role") === "button") e.preventDefault();
    try {
      const r = fn(el, e);
      if (r && typeof r.catch === "function") r.catch((err) => { console.error(err); FA.toast(err.message || "Что-то пошло не так", { emoji: "⚠️" }); });
    } catch (err) { console.error(err); FA.toast(err.message || "Что-то пошло не так", { emoji: "⚠️" }); }
  });

  document.addEventListener("submit", (e) => {
    const form = e.target;
    const fn = FA.submits[form.id];
    if (!fn) return;
    e.preventDefault();
    try {
      const r = fn(form);
      if (r && typeof r.catch === "function") r.catch((err) => { console.error(err); FA.toast(err.message || "Ошибка", { emoji: "⚠️" }); });
    } catch (err) { console.error(err); FA.toast(err.message || "Ошибка", { emoji: "⚠️" }); }
  });

  document.addEventListener("input", (e) => {
    const fn = FA.inputs[e.target.id];
    if (fn) fn(e.target.value, e.target);
  });

  document.addEventListener("change", async (e) => {
    const t = e.target;
    if (t.dataset.img === "chat" && t.files && t.files[0]) { await FA.handleImageFile(t.files[0]); t.value = ""; }
    if (t.dataset.img === "avatar" && t.files && t.files[0]) {
      try {
        const data = await FA.compressImage(t.files[0], 420);
        if (ui.edit) { ui.edit.image = data; ui.edit.emoji = ""; FA.refreshEditAva(); }
      } catch (err) { FA.toast("Не удалось обработать фото", { emoji: "⚠️" }); }
      t.value = "";
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if ($("#modal").classList.contains("open")) { FA.closeModal(); return; }
      if (ui.activeChat || ui.activeChannel) { FA.actions["close-layer"] && FA.actions["close-layer"](); }
      return;
    }
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches('[data-act="tap"]')) {
      e.preventDefault();
      e.target.click();
    }
  });

  if ("serviceWorker" in navigator && location.protocol === "https:" && !window.Capacitor) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => FA.init());
  else FA.init();
})(window.FA = window.FA || {});
