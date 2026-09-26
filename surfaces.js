// Blurr address book: where each private part sits on WhatsApp Web.
// Pure data. Every address here has a row in docs/reference/SELECTOR-MAP.md (not shipped).
// Layer 1 = WhatsApp's internal labels. Layer 2 = structure (ids, roles, element types).
// Layer 3 = our own mark [data-blurr-part~="key"], set by shape detection when layers 1 and 2 fail.
// Verified on WhatsApp Web 2.3000.1048567512 on 2026-09-26 unless marked "candidate".
(function (root) {
  const PARTS = {
    msg: {
      label: 'Messages',
      l1: [
        '#main [data-testid="msg-container"] [data-testid~="selectable-text"]',
        '#main [data-testid="quoted-message"]',
        '#main [data-testid="recalled"]'
      ],
      l2: [
        '#main [data-pre-plain-text] .copyable-text',
        '#main [role="row"] .selectable-text'
      ],
      // A chat must be open for messages to exist.
      expect: '#main',
      area: '#main [data-testid="conversation-panel-messages"], #main [role="application"]'
    },
    prev: {
      label: 'Chat previews',
      l1: [
        '#pane-side [data-testid="cell-frame-secondary"] > div:first-child',
        '#pane-side [data-testid="last-msg-status"]'
      ],
      l2: ['#pane-side [role="row"] [role="gridcell"] + div > div:first-child'],
      expect: '#pane-side [role="row"]',
      area: '#pane-side'
    },
    name: {
      label: 'Names and status line',
      l1: [
        '#pane-side [data-testid="cell-frame-title"]',
        '[data-testid="conversation-info-header-chat-title"]',
        '[data-testid="chat-subtitle"]',
        '#main [data-testid="author"]'
      ],
      l2: [
        '#pane-side [role="row"] span[title][dir="auto"]',
        '#main header span[dir="auto"]',
        '#main header span[title]',
        '#main [data-pre-plain-text] span[role="button"][dir="auto"]'
      ],
      expect: '#pane-side [role="row"]',
      area: '#pane-side, #main header'
    },
    pic: {
      label: 'Profile pictures',
      l1: [
        '#pane-side [data-testid="cell-frame-container"] > div:first-child',
        '[data-testid="conversation-header"] [role="button"][title]:not([data-testid])',
        '#main [data-testid="group-chat-profile-picture"]'
      ],
      l2: [
        '#pane-side img[referrerpolicy]',
        '#main header img',
        '#main header svg'
      ],
      expect: '#pane-side [role="row"]',
      area: '#pane-side, #main header'
    },
    media: {
      label: 'Media in chat',
      l1: [
        '#main [data-testid="image-thumb"]',
        '#main [data-testid="media-url-provider"]',
        '#main [data-testid="audio-file"]'
      ],
      l2: [
        '#main [role="row"] img[src^="blob:"]',
        '#main [role="row"] img[src^="data:"]',
        '#main [role="row"] video',
        '#main [role="row"] canvas'
      ],
      expect: null, // Only exists when a chat with media is open. Checked by health (loop B3).
      area: null
    },
    gal: {
      label: 'Media gallery',
      l1: [
        '[data-testid="drawer-right"] img',
        '[data-testid="drawer-right"] video'
      ],
      l2: ['[data-testid="drawer-right"] [style*="background-image"]'],
      expect: null,
      area: null
    },
    input: {
      label: 'Typing box',
      l1: ['[data-testid="conversation-compose-box-input"]'],
      l2: ['#main footer [contenteditable="true"]'],
      expect: '#main footer',
      area: '#main footer'
    },
    badge: {
      label: 'Unread badges',
      // candidate: not yet seen with unread chats during a probe.
      l1: ['#pane-side [data-testid="cell-frame-secondary"] [role="gridcell"] [aria-label]'],
      l2: [],
      expect: null,
      area: null,
      hide: true // hidden fully, not blurred
    },
    tab: {
      label: 'Unread count in tab title',
      l1: [],
      l2: [],
      expect: null,
      area: null,
      script: true // handled by content.js, not by style
    }
  };

  function selectorsFor(key) {
    const p = PARTS[key];
    return p.l1.concat(p.l2, ['[data-blurr-part~="' + key + '"]']);
  }

  root.BlurrSurfaces = { PARTS, selectorsFor };
})(typeof self !== 'undefined' ? self : this);
