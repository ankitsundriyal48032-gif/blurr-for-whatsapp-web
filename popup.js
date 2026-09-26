// Blurr popup: reads the whole settings object, writes the whole object back (rule D7).
(function () {
  'use strict';
  const S = self.BlurrSettings;
  const A = self.BlurrSurfaces;
  const $ = (id) => document.getElementById(id);
  let st = S.clone(S.DEFAULTS);
  let partButtons = {};
  let partDots = {};
  let health = null;

  function buildParts() {
    const box = $('parts');
    for (const k of Object.keys(A.PARTS)) {
      const row = document.createElement('div');
      row.className = 'row';
      const dot = document.createElement('span');
      dot.className = 'dot off';
      dot.setAttribute('role', 'img');
      const label = document.createElement('span');
      label.className = 'l';
      label.textContent = A.PARTS[k].label;
      const tag = document.createElement('span');
      tag.className = 'tag';
      const sw = document.createElement('button');
      sw.className = 'sw';
      sw.setAttribute('role', 'switch');
      sw.setAttribute('aria-label', A.PARTS[k].label);
      sw.addEventListener('click', () => {
        st.parts[k] = !st.parts[k];
        save();
      });
      row.append(dot, label, tag, sw);
      box.appendChild(row);
      partButtons[k] = sw;
      partDots[k] = { dot, tag };
    }
  }

  function render() {
    $('master').setAttribute('aria-checked', String(st.master));
    const pres = $('present');
    pres.setAttribute('aria-pressed', String(st.present));
    pres.textContent = st.present ? 'Presentation mode ON (Alt+P to exit)' : 'Presentation mode (Alt+P)';
    for (const k in partButtons) {
      const on = st.present ? true : !!st.parts[k];
      partButtons[k].setAttribute('aria-checked', String(on));
      partButtons[k].disabled = st.present || !st.master;
    }
    $('reveal-mode').value = st.reveal.mode;
    $('reveal-delay').value = st.reveal.delay;
    $('allhover').setAttribute('aria-checked', String(st.reveal.allOnHover));
    $('strength').value = st.strength;
    $('idle').value = String(st.idle);
    renderHealth();
  }

  const LIGHT = {
    green: ['Hiding', 'Found on this page and hidden'],
    amber: ['Safe mode', 'WhatsApp changed this part. Its whole area is blurred and a backup method is used. Hover to read. An update is coming'],
    red: ['Area blurred', 'Not found on this WhatsApp version. Its whole area is blurred to keep you safe'],
    grey: ['Nothing to check', 'This part is not on screen right now'],
    off: ['Off', 'You turned this part off']
  };

  function renderHealth() {
    const states = (health && health.states) || {};
    let red = 0;
    for (const k in partDots) {
      const tab = A.PARTS[k].script;
      const wanted = st.master && (st.present || !!st.parts[k]);
      let s;
      if (!wanted) s = 'off';
      else if (tab) s = 'green';
      else s = (health && states[k]) || 'grey';
      if (s === 'red') red += 1;
      const [label, help] = LIGHT[s] || LIGHT.grey;
      partDots[k].dot.className = 'dot ' + s;
      partDots[k].dot.title = label + ': ' + help;
      // Text only when something needs attention. Green, grey and off show just the dot.
      partDots[k].tag.textContent = s === 'amber' || s === 'red' ? label : '';
      partDots[k].tag.className = 'tag' + (s === 'amber' ? ' attn' : s === 'red' ? ' alert' : '');
      partDots[k].tag.title = help;
    }
    $('status').textContent = !st.master
      ? 'Off. Nothing is hidden'
      : !health
        ? 'Open WhatsApp Web to check'
        : red
          ? red + (red === 1 ? ' part' : ' parts') + ' not found. Area blurred to keep you safe'
          : Object.values(states).includes('amber')
            ? 'Safe mode: WhatsApp changed. Areas blurred'
          : st.present
            ? 'Presentation mode on'
            : 'Hiding your chosen parts';
    $('wa').textContent = health && health.wa ? 'WhatsApp Web ' + health.wa : '';
    $('openwa').hidden = !!health || !st.master;
    $('report').hidden = !(red || Object.values(states).includes('amber'));
  }

  function fetchHealth() {
    chrome.storage.local.get('blurrHealth', (res) => {
      const h = res && res.blurrHealth;
      health = h && Date.now() - h.at < 30000 ? h : null;
      renderHealth();
    });
  }

  function copyReport() {
    const states = (health && health.states) || {};
    const lines = [
      'Blurr problem report',
      'Blurr version: ' + chrome.runtime.getManifest().version,
      'WhatsApp Web: ' + ((health && health.wa) || 'unknown'),
      'Browser: ' + navigator.userAgent,
      'Parts: ' + Object.keys(states).map((k) => k + '=' + states[k]).join(', ')
    ];
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      $('report').textContent = 'Copied. It has no chat content';
      setTimeout(() => { $('report').textContent = 'Copy problem report'; }, 2500);
    });
  }

  function save() {
    render();
    S.save(st);
  }

  buildParts();
  $('master').addEventListener('click', () => { st.master = !st.master; save(); });
  $('present').addEventListener('click', () => { st.present = !st.present; if (st.present) st.master = true; save(); });
  $('allhover').addEventListener('click', () => { st.reveal.allOnHover = !st.reveal.allOnHover; save(); });
  $('reveal-mode').addEventListener('change', (e) => { st.reveal.mode = e.target.value; save(); });
  $('reveal-delay').addEventListener('change', (e) => { st.reveal.delay = e.target.value; save(); });
  $('strength').addEventListener('change', (e) => { st.strength = e.target.value; save(); });
  $('idle').addEventListener('change', (e) => { st.idle = Number(e.target.value); save(); });
  $('version').textContent = 'v' + chrome.runtime.getManifest().version;

  $('report').addEventListener('click', copyReport);
  // Remember whether "More settings" was left open (this viewer only).
  const more = document.querySelector('.more');
  try { if (localStorage.getItem('blurr-more-open') === '1') more.open = true; } catch (e) { /* ignore */ }
  more.addEventListener('toggle', () => { try { localStorage.setItem('blurr-more-open', more.open ? '1' : '0'); } catch (e) { /* ignore */ } });
  $('openwa').addEventListener('click', () => { chrome.tabs.create({ url: 'https://web.whatsapp.com/' }); window.close(); });
  S.load().then((loaded) => { st = loaded; render(); });
  fetchHealth();
  setInterval(fetchHealth, 1000);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.blurr) S.load().then((loaded) => { st = loaded; render(); });
  });
})();
