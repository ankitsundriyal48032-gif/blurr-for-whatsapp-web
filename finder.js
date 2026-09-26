// Blurr finder and inspector (layers 3 to 5, DEC-17).
// For each switched-on part: layer 1 labels, layer 2 structure. If both find nothing,
// layer 3 shape detection marks items with [data-blurr-part], and if a part should be on
// screen but still nothing is found, layer 4 blurs its whole area with [data-blurr-fallback].
// Reads no chat content: only element types, sizes, positions and counts.
(function () {
  'use strict';
  const A = self.BlurrSurfaces;
  const ROOT = document.documentElement;
  const KEYS = Object.keys(A.PARTS).filter((k) => !A.PARTS[k].script);
  const MIN_GAP_MS = 700;

  const isOn = (k) => ROOT.getAttribute('data-blurr') === 'on' && ROOT.getAttribute('data-blurr-' + k) === '1';
  const any = (sels, root) => {
    for (const s of sels) {
      try {
        if ((root || document).querySelector(s)) return true;
      } catch (e) { /* bad selector: skip */ }
    }
    return false;
  };
  const visible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  // ---------- Area detection without labels ----------
  function scrollableAncestor(el, minHeightRatio) {
    const vh = window.innerHeight || 1;
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight && n.clientHeight > vh * minHeightRatio) return n;
    }
    return null;
  }
  // Climb to the first ancestor that is a big panel (by size only, no labels).
  function bigAncestor(el, minW, minH) {
    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;
    for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      const r = n.getBoundingClientRect();
      if (r.width >= vw * minW && r.height >= vh * minH) return n;
    }
    return null;
  }
  function atPoint(xRatio, yRatio) {
    const x = Math.round((window.innerWidth || 0) * xRatio);
    const y = Math.round((window.innerHeight || 0) * yRatio);
    const el = document.elementFromPoint(x, y);
    return el && !el.closest('.blurr-banner') ? el : null;
  }
  function chatListArea() {
    const byId = document.getElementById('pane-side');
    if (visible(byId)) return byId;
    const grid = document.querySelector('[role="grid"]');
    if (visible(grid) && grid.getBoundingClientRect().left < window.innerWidth * 0.4) return grid;
    const p = atPoint(0.2, 0.55);
    const cand = p ? bigAncestor(p, 0.2, 0.9) || scrollableAncestor(p, 0.4) : null;
    // Only a panel that looks like a list of people (several pictures) counts.
    // Settings and other menus do not, so they never raise a false alarm.
    return cand && cand.querySelectorAll('img').length >= 3 ? cand : null;
  }
  function convArea() {
    const byId = document.getElementById('main');
    if (visible(byId)) return byId;
    const app = document.querySelector('[role="application"]');
    if (visible(app)) return app;
    // The conversation is a full-height column on the right: header, messages, typing box.
    const p = atPoint(0.68, 0.5);
    const cand = p ? bigAncestor(p, 0.35, 0.9) : null;
    // Only an open chat (it has a typing box) counts.
    return cand && cand.querySelector('[contenteditable="true"]') ? cand : null;
  }
  function convScroller(area) {
    if (!area) return null;
    let best = null;
    let bestH = 0;
    for (const el of area.querySelectorAll('div')) {
      if (el.clientHeight > bestH && el.scrollHeight > el.clientHeight + 4) {
        const cs = getComputedStyle(el);
        if (/(auto|scroll)/.test(cs.overflowY)) { best = el; bestH = el.clientHeight; }
      }
    }
    return best;
  }
  function convHeader(area) {
    if (!area) return null;
    const h = area.querySelector('header');
    if (visible(h)) return h;
    const top = area.getBoundingClientRect().top;
    for (const c of area.children) {
      const r = c.getBoundingClientRect();
      if (r.height >= 30 && r.height <= 140 && Math.abs(r.top - top) < 8) return c;
    }
    return null;
  }
  function inputBox(area) {
    if (!area) return null;
    const eds = [...area.querySelectorAll('[contenteditable="true"]')].filter(visible);
    return eds.length ? eds[eds.length - 1] : null;
  }

  // ---------- Layer 3: shape detection ----------
  const TIME = /^\s*(\d{1,2}[:.]\d{2}(\s?[ap]\.?m\.?)?|yesterday|today)\s*$/i;
  function textLeaves(root) {
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const t = n.textContent;
      if (!t || !t.trim()) continue;
      const el = n.parentElement;
      if (!el || el.closest('[contenteditable="true"]') || !visible(el)) continue;
      if (TIME.test(t)) continue; // time labels are not private
      out.push(el);
    }
    return out;
  }
  function rowsOf(list) {
    let rows = [...list.querySelectorAll('[role="row"], [role="listitem"]')];
    if (rows.length) return rows;
    // Fallback: the repeated children of the biggest block inside the list.
    let block = list;
    while (block.children.length === 1) block = block.children[0];
    return [...block.children].filter((c) => c.getBoundingClientRect().height > 30);
  }
  function linesOfRow(row) {
    const leaves = textLeaves(row);
    const lines = [];
    for (const el of leaves) {
      const top = Math.round(el.getBoundingClientRect().top);
      let line = lines.find((l) => Math.abs(l.top - top) < 6);
      if (!line) lines.push((line = { top, els: [] }));
      line.els.push(el);
    }
    return lines.sort((a, b) => a.top - b.top);
  }
  const DETECT = {
    name() {
      const list = chatListArea();
      if (!list) return [];
      return rowsOf(list).flatMap((r) => (linesOfRow(r)[0] || { els: [] }).els);
    },
    prev() {
      const list = chatListArea();
      if (!list) return [];
      return rowsOf(list).flatMap((r) => (linesOfRow(r)[1] || { els: [] }).els);
    },
    pic() {
      const out = [];
      const scopes = [chatListArea(), convArea()].filter(Boolean);
      for (const s of scopes) {
        for (const el of s.querySelectorAll('img, svg')) {
          const r = el.getBoundingClientRect();
          if (r.width >= 24 && r.width <= 72 && Math.abs(r.width - r.height) < 6) out.push(el);
        }
      }
      return out;
    },
    msg() {
      const a = convArea();
      const sc = convScroller(a) || a;
      if (!sc) return [];
      const head = a && a.querySelector('header');
      return textLeaves(sc).filter((el) => !(head && head.contains(el)));
    },
    media() {
      const a = convArea();
      const sc = convScroller(a) || a;
      if (!sc) return [];
      return [...sc.querySelectorAll('img, video, canvas')].filter((el) => el.getBoundingClientRect().width >= 80);
    },
    input() {
      const box = inputBox(convArea());
      return box ? [box] : [];
    }
  };
  // Where each part lives, for the safe fallback (layer 4). Found by size and position, no labels.
  const AREA = {
    msg: () => { const a = convArea(); return [convScroller(a) || a]; },
    prev: () => [chatListArea()],
    name: () => [chatListArea(), convHeader(convArea())],
    pic: () => [chatListArea(), convHeader(convArea())],
    input: () => [inputBox(convArea())]
  };
  const hasContent = (el) => visible(el) && (el.textContent.trim().length > 0 || !!el.querySelector('img, svg, video'));

  // ---------- Marks ----------
  function mark(attr, key, els) {
    for (const el of els) {
      const cur = (el.getAttribute(attr) || '').split(' ').filter(Boolean);
      if (!cur.includes(key)) el.setAttribute(attr, cur.concat(key).join(' '));
    }
  }
  function unmark(attr, key) {
    for (const el of document.querySelectorAll('[' + attr + '~="' + key + '"]')) {
      const rest = el.getAttribute(attr).split(' ').filter((x) => x && x !== key);
      if (rest.length) el.setAttribute(attr, rest.join(' '));
      else el.removeAttribute(attr);
    }
  }

  // ---------- Presentation: find the left column by size (works whatever panel is open) ----------
  function leftColumn() {
    // Only needed if WhatsApp renames the chat list. Uses the same "looks like a list of
    // people" test, so Settings (one picture) is never hidden.
    if (document.getElementById('pane-side')) return null;
    const col = chatListArea();
    return col && col.getBoundingClientRect().width < (window.innerWidth || 1) * 0.6 ? col : null;
  }
  function markLeftColumn() {
    const present = ROOT.getAttribute('data-blurr') === 'on' && ROOT.getAttribute('data-blurr-present') === '1';
    const old = document.querySelectorAll('[data-blurr-leftcol]');
    if (!present) {
      old.forEach((el) => el.removeAttribute('data-blurr-leftcol'));
      return;
    }
    if (old.length && [...old].every((el) => el.isConnected)) return;
    // Measure with the column visible, then mark it.
    old.forEach((el) => el.removeAttribute('data-blurr-leftcol'));
    const col = leftColumn();
    if (col) col.setAttribute('data-blurr-leftcol', '');
  }

  // ---------- Inspector ----------
  let last = '';
  function check() {
    markLeftColumn();
    const states = {};
    for (const k of KEYS) {
      const part = A.PARTS[k];
      if (!isOn(k)) {
        unmark('data-blurr-part', k);
        unmark('data-blurr-fallback', k);
        states[k] = 'off';
        continue;
      }
      if (part.l1.length && any(part.l1)) {
        unmark('data-blurr-part', k);
        unmark('data-blurr-fallback', k);
        states[k] = 'green';
        continue;
      }
      // Labels are gone for this part. From here on, never fail open:
      // mark what the backup methods find, and blur the whole area the part lives in.
      const l2found = part.l2.length > 0 && any(part.l2);
      const found = DETECT[k] ? DETECT[k]() : [];
      unmark('data-blurr-part', k);
      if (found.length) mark('data-blurr-part', k, found);
      const areas = AREA[k] ? AREA[k]().filter((a) => a && hasContent(a)) : [];
      unmark('data-blurr-fallback', k);
      if (areas.length) mark('data-blurr-fallback', k, areas);
      const backup = l2found || found.length > 0;
      states[k] = areas.length ? (backup ? 'amber' : 'red') : backup ? 'amber' : 'grey';
    }
    const report = JSON.stringify(states) + waVersion;
    // Write when something changed, and every 10 s as a heartbeat so the popup knows the tab is alive.
    if (report !== last || Date.now() - lastWrite > 10000) {
      last = report;
      write({ states, wa: waVersion, at: Date.now() });
    }
  }

  let lastWrite = 0;
  function write(health) {
    lastWrite = Date.now();
    try { chrome.storage.local.set({ blurrHealth: health }); } catch (e) { /* extension reloaded: ignore */ }
  }
  // Tab closing or navigating away: clear the report so no stale warning stays.
  window.addEventListener('pagehide', () => write(null));
  setInterval(schedule, 10000);

  // ---------- Scheduling (at most every 700 ms, only after changes) ----------
  let timer = null;
  let lastRun = 0;
  function schedule() {
    if (timer) return;
    const wait = Math.max(0, MIN_GAP_MS - (Date.now() - lastRun));
    timer = setTimeout(() => {
      timer = null;
      lastRun = Date.now();
      try { check(); } catch (e) { /* never break the page */ }
    }, wait);
  }

  // WhatsApp version: read from the page by main.js and passed by a window message.
  let waVersion = '';
  window.addEventListener('message', (e) => {
    if (e.source === window && e.data && typeof e.data.blurrWaVersion === 'string') {
      waVersion = e.data.blurrWaVersion;
      last = '';
      schedule();
    }
  });

  function start() {
    new MutationObserver(schedule).observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-blurr', 'data-blurr-present', ...KEYS.map((k) => 'data-blurr-' + k)]
    });
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
