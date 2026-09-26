// Runs in the page's own context only to read WhatsApp Web's version number.
// It reads nothing else and changes nothing.
(function () {
  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    const v = window.Debug && window.Debug.VERSION;
    if (v || tries > 30) {
      clearInterval(timer);
      window.postMessage({ blurrWaVersion: String(v || '') }, location.origin);
    }
  }, 2000);
})();
