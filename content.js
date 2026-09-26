// Blurr content script. Runs at document_start on web.whatsapp.com.
// Part 1 (sticker layer): one style sheet from the address book, active before WhatsApp draws.
// Part 2 (page helper): switches on <html> as data-blurr-* attributes, idle timer, hold key,
// presentation label, tab title. Never touches WhatsApp's own classes.
(function () {
  'use strict';
  const S = self.BlurrSettings;
  const A = self.BlurrSurfaces;
  const ROOT = document.documentElement;
  const KEYS = Object.keys(A.PARTS);

  // ---------- Part 1: style ----------
  function buildCss() {
    const on = 'html[data-blurr="on"]';
    const out = [];
    out.push(
      ':root{--blurr-amount:6px;--blurr-delay:0.3s}',
      // Hidden items: blur only. Never change size or remove (rule D6).
      '.blurr-banner{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:2147483647;' +
        'background:#1daa61;color:#fff;font:600 12px/1.2 system-ui,sans-serif;padding:6px 14px;border-radius:16px;' +
        'box-shadow:0 2px 8px rgba(0,0,0,.2);pointer-events:none}'
    );
    for (const k of KEYS) {
      const part = A.PARTS[k];
      if (part.script) continue;
      const sels = A.selectorsFor(k);
      const gate = on + '[data-blurr-' + k + '="1"] ';
      const list = (prefix, suffix) => sels.map((s) => prefix + s + (suffix || '')).join(',');
      if (part.hide) {
        out.push(list(gate) + '{visibility:hidden!important}');
        continue;
      }
      out.push(list(gate) + '{filter:blur(var(--blurr-amount)) grayscale(.4)!important;transition:filter .15s ease!important}');
      // Hover reveal: only this item, after the delay. Not in hold-key mode.
      out.push(
        list(on + '[data-blurr-' + k + '="1"]:not([data-blurr-reveal="key"]) ', ':hover') +
          '{filter:none!important;transition-delay:var(--blurr-delay)!important}'
      );
      // Hold-key reveal: only while the key is held.
      out.push(
        list(on + '[data-blurr-' + k + '="1"][data-blurr-reveal="key"][data-blurr-keydown="1"] ', ':hover') +
          '{filter:none!important}'
      );
      // Reveal all on window hover (blocked in presentation mode).
      out.push(
        list(on + '[data-blurr-' + k + '="1"][data-blurr-allhover="1"]:not([data-blurr-present="1"]) #app:hover ') +
          '{filter:none!important}'
      );
      // Safe fallback (layer 4): whole area, set by the finder when nothing matches.
      if (part.area) {
        const fb = '[data-blurr-fallback~="' + k + '"]';
        out.push(gate.trim() + ' ' + fb + '{filter:blur(var(--blurr-amount))!important}');
        // Hover reveals the area, never in presentation mode.
        out.push(on + '[data-blurr-' + k + '="1"]:not([data-blurr-present="1"]):not([data-blurr-reveal="key"]) ' + fb + ':hover{filter:none!important;transition-delay:var(--blurr-delay)!important}');
        out.push(on + '[data-blurr-' + k + '="1"]:not([data-blurr-present="1"])[data-blurr-reveal="key"][data-blurr-keydown="1"] ' + fb + ':hover{filter:none!important}');
      }
    }
    // Presentation mode: hide the whole chat list area (visibility keeps the layout).
    // The chat list is hidden. Settings (your own name and options) stays as it is (Ankit, 2026-09-27).
    out.push(
      [
        '#pane-side',
        '[data-blurr-leftcol]'
      ]
        .map((s) => on + '[data-blurr-present="1"] ' + s)
        .join(',') + '{visibility:hidden!important}'
    );
    // Idle blur: the whole app.
    out.push(on + '[data-blurr-idle="1"] #app{filter:blur(12px) grayscale(1)!important;transition:filter .2s!important}');
    return out.join('\n');
  }

  function injectStyle() {
    let el = document.getElementById('blurr-style');
    if (!el) {
      el = document.createElement('style');
      el.id = 'blurr-style';
      (document.head || ROOT).appendChild(el);
    }
    el.textContent = buildCss();
  }

  // ---------- Part 2: switches ----------
  let current = S.clone(S.DEFAULTS);

  function effectiveParts(st) {
    const p = Object.assign({}, st.parts);
    if (st.present) for (const k of KEYS) p[k] = true; // presentation forces every part on
    return p;
  }

  function setAttr(name, value) {
    if (value === null || value === undefined) ROOT.removeAttribute(name);
    else if (ROOT.getAttribute(name) !== String(value)) ROOT.setAttribute(name, String(value));
  }

  function apply(st) {
    current = st;
    if (!st.master) {
      setAttr('data-blurr', null); // no trace when off (M2)
      for (const k of KEYS) setAttr('data-blurr-' + k, null);
      ['data-blurr-present', 'data-blurr-reveal', 'data-blurr-allhover', 'data-blurr-idle', 'data-blurr-keydown'].forEach((a) =>
        setAttr(a, null)
      );
      ROOT.style.removeProperty('--blurr-amount');
      ROOT.style.removeProperty('--blurr-delay');
      if (!ROOT.getAttribute('style')) ROOT.removeAttribute('style');
      stopIdle();
      stopTitle();
      showBanner(false);
      return;
    }
    setAttr('data-blurr', 'on');
    const parts = effectiveParts(st);
    for (const k of KEYS) setAttr('data-blurr-' + k, parts[k] ? '1' : null);
    setAttr('data-blurr-present', st.present ? '1' : null);
    setAttr('data-blurr-reveal', st.reveal.mode === 'key' ? 'key' : null);
    setAttr('data-blurr-allhover', st.reveal.allOnHover ? '1' : null);
    ROOT.style.setProperty('--blurr-amount', S.STRENGTH_PX[st.strength] || '6px');
    ROOT.style.setProperty('--blurr-delay', S.DELAY_S[st.reveal.delay] || '0.3s');
    if (st.idle > 0) startIdle(st.idle);
    else stopIdle();
    if (parts.tab) startTitle();
    else stopTitle();
    showBanner(!!st.present);
  }

  // ---------- Presentation label ----------
  let banner = null;
  function showBanner(show) {
    if (show) {
      if (!banner) {
        banner = document.createElement('div');
        banner.className = 'blurr-banner';
        banner.textContent = 'Presentation mode on. Press Alt+P to exit';
      }
      if (!banner.isConnected) ROOT.appendChild(banner);
    } else if (banner && banner.isConnected) {
      banner.remove();
    }
  }

  // ---------- Hold-key reveal (Ctrl alone) ----------
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Control' && current.master && current.reveal.mode === 'key') setAttr('data-blurr-keydown', '1');
      else if (e.key !== 'Control') setAttr('data-blurr-keydown', null); // Ctrl+C, Ctrl+V: no reveal
    },
    true
  );
  window.addEventListener('keyup', (e) => {
    if (e.key === 'Control') setAttr('data-blurr-keydown', null);
  }, true);
  window.addEventListener('blur', () => setAttr('data-blurr-keydown', null));

  // ---------- Idle blur ----------
  const IDLE_EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'focus'];
  let idleMs = 0;
  let idleTimer = null;
  function onActivity() {
    setAttr('data-blurr-idle', null);
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => setAttr('data-blurr-idle', '1'), idleMs);
  }
  function startIdle(seconds) {
    const ms = seconds * 1000;
    if (idleMs === ms) return;
    stopIdle();
    idleMs = ms;
    IDLE_EVENTS.forEach((ev) => window.addEventListener(ev, onActivity, { capture: true, passive: true }));
    document.addEventListener('visibilitychange', onVisibility);
    onActivity();
  }
  function onVisibility() {
    if (document.hidden) {
      clearTimeout(idleTimer);
      setAttr('data-blurr-idle', '1');
    }
  }
  function stopIdle() {
    if (!idleMs) return;
    IDLE_EVENTS.forEach((ev) => window.removeEventListener(ev, onActivity, { capture: true, passive: true }));
    document.removeEventListener('visibilitychange', onVisibility);
    clearTimeout(idleTimer);
    idleTimer = null;
    idleMs = 0;
    setAttr('data-blurr-idle', null);
  }

  // ---------- Tab title count ----------
  const COUNT = /^\(\d+\)\s*/;
  let titleObserver = null;
  let lastRealTitle = null;
  function cleanTitle() {
    const t = document.title;
    if (COUNT.test(t)) {
      lastRealTitle = t;
      document.title = t.replace(COUNT, '');
    }
  }
  function startTitle() {
    if (titleObserver) return;
    const target = document.head || ROOT;
    titleObserver = new MutationObserver(cleanTitle);
    titleObserver.observe(target, { subtree: true, childList: true, characterData: true });
    cleanTitle();
  }
  function stopTitle() {
    if (!titleObserver) return;
    titleObserver.disconnect();
    titleObserver = null;
    // WhatsApp writes the count again on its next title update. We do not restore an old count.
    lastRealTitle = null;
  }

  // ---------- Start ----------
  // Fail closed: apply defaults now, before storage answers (rule D1).
  injectStyle();
  apply(current);

  S.load().then(apply);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.blurr) S.load().then(apply);
  });

  // WhatsApp may replace <head> content while loading. Keep our style present.
  document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('blurr-style')) injectStyle();
  });

  // Health and shape detection (layers 3 to 5) arrive in build loop B3.
  self.BlurrPage = { apply, get: () => current };
})();
