// Blurr background worker (control room): defaults on install, keyboard shortcuts,
// toolbar state, and the latest health report from the WhatsApp tab.
importScripts('settings.js');

const S = self.BlurrSettings;
const RED = '#ea0038';

const FRESH_MS = 30000;
async function getHealth() {
  const res = await chrome.storage.local.get('blurrHealth');
  const h = res.blurrHealth;
  return h && Date.now() - h.at < FRESH_MS ? h : null;
}

async function refreshIcon() {
  const st = await S.load();
  const health = await getHealth();
  const vals = Object.values((health && health.states) || {});
  const hasRed = vals.includes('red');
  const hasAmber = vals.includes('amber');
  let text = '';
  let color = '#667781';
  let title = 'Blurr: on';
  if (!st.master) {
    text = 'OFF';
    title = 'Blurr: off (Alt+B to turn on)';
  } else if (hasRed) {
    text = '!';
    color = RED;
    title = 'Blurr: a part is not found on this WhatsApp version. Its whole area is blurred. Open for details';
  } else if (hasAmber) {
    text = '!';
    color = '#d98e04';
    title = 'Blurr: safe mode. WhatsApp changed something, whole areas are blurred until an update';
  } else if (st.present) {
    text = 'P';
    color = '#1daa61';
    title = 'Blurr: presentation mode on (Alt+P to exit)';
  }
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setBadgeText({ text });
  await chrome.action.setTitle({ title });
}

chrome.runtime.onInstalled.addListener(async (details) => {
  const st = await S.load(); // merges any stored values over defaults
  await S.save(st);
  await refreshIcon();
  if (details.reason === 'install') chrome.tabs.create({ url: 'welcome.html' });
});

chrome.runtime.onStartup.addListener(refreshIcon);

chrome.storage.onChanged.addListener((changes, area) => {
  if ((area === 'sync' && changes.blurr) || (area === 'local' && changes.blurrHealth)) refreshIcon();
});

chrome.commands.onCommand.addListener(async (command) => {
  const st = await S.load();
  if (command === 'toggle-master') {
    st.master = !st.master;
  } else if (command === 'toggle-present') {
    st.present = !st.present;
    if (st.present) st.master = true;
  } else {
    return;
  }
  await S.save(st);
});
