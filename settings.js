// Blurr settings: one object, saved whole, merged over defaults on every read.
// Shared by the content script, the popup and the background worker.
(function (root) {
  const SCHEMA = 1;

  const DEFAULTS = {
    schema: SCHEMA,
    master: true,
    present: false,
    parts: {
      msg: true,
      prev: true,
      name: false,
      pic: true,
      media: true,
      gal: true,
      input: false,
      badge: false,
      tab: false
    },
    strength: 'medium',
    reveal: { mode: 'hover', delay: 'short', allOnHover: false },
    idle: 0,
    hideList: []
  };

  const STRENGTH_PX = { light: '3px', medium: '6px', strong: '12px' };
  const DELAY_S = { instant: '0s', short: '0.3s', long: '1s' };

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  // Deep merge of stored values over defaults. Unknown keys are kept, missing keys get defaults.
  function merge(base, over) {
    const out = clone(base);
    if (!over || typeof over !== 'object') return out;
    for (const k of Object.keys(over)) {
      const b = out[k];
      const v = over[k];
      if (b && typeof b === 'object' && !Array.isArray(b) && v && typeof v === 'object' && !Array.isArray(v)) {
        out[k] = merge(b, v);
      } else if (v !== undefined) {
        out[k] = v;
      }
    }
    out.schema = SCHEMA;
    return out;
  }

  function load() {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get('blurr', (res) => {
          resolve(merge(DEFAULTS, res && res.blurr));
        });
      } catch (e) {
        resolve(clone(DEFAULTS));
      }
    });
  }

  function save(settings) {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ blurr: merge(DEFAULTS, settings) }, () => resolve());
    });
  }

  root.BlurrSettings = { SCHEMA, DEFAULTS, STRENGTH_PX, DELAY_S, merge, load, save, clone };
})(typeof self !== 'undefined' ? self : this);
