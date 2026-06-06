// icons.js — inline SVG icons in Tabler's outline style. Attaches window.ICONS.
// Replaces the webfont (which desyncs on CDN). 24x24 viewBox, stroke=currentColor.
(function () {
  'use strict';

  // filled icons render with fill=currentColor, stroke=none
  const FILLED = new Set(['player-play-filled', 'star-filled', 'bookmark-filled', 'dots', 'grip-vertical']);

  const ICONS = {
    'chevron-right': '<path d="M9 6l6 6l-6 6"/>',
    'chevron-left': '<path d="M15 6l-6 6l6 6"/>',
    'plus': '<path d="M12 5v14M5 12h14"/>',
    'x': '<path d="M18 6L6 18M6 6l12 12"/>',
    'check': '<path d="M5 12l5 5l10 -10"/>',
    'checks': '<path d="M7 12l5 5l10 -10"/><path d="M2 12l5 5m5 -5l1 -1"/>',
    'minus': '<path d="M5 12h14"/>',
    'search': '<circle cx="10" cy="10" r="7"/><path d="M21 21l-6 -6"/>',
    'compass': '<circle cx="12" cy="12" r="9"/><path d="M16.5 7.5l-5 5m0 0l-2 4.5l4.5 -2m-2.5 -2.5l5 -5"/>',
    'tv-2': '<path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9z"/><path d="M8 21l8 0"/><path d="M10 17l0 4"/><path d="M14 17l0 4"/>',
    'external-link': '<path d="M11 7h-5a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-5"/><path d="M10 14l10 -10"/><path d="M15 4l5 0l0 5"/>',
    'settings': '<path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z"/><circle cx="12" cy="12" r="3"/>',
    'stack-2': '<path d="M12 4l-8 4l8 4l8 -4l-8 -4"/><path d="M4 12l8 4l8 -4"/><path d="M4 16l8 4l8 -4"/>',
    'chart-histogram': '<path d="M3 3v18h18"/><path d="M20 18v-7"/><path d="M16 18v-10"/><path d="M12 18v-4"/><path d="M8 18v-6"/>',
    'movie': '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 4v16M16 4v16M4 8h4M4 16h4M4 12h16M16 8h4M16 16h4"/>',
    'history': '<path d="M12 8l0 4l2 2"/><path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"/>',
    'mood-empty': '<circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01M9.5 15h5"/>',
    'arrows-sort': '<path d="M3 9l4 -4l4 4M7 5v14"/><path d="M21 15l-4 4l-4 -4M17 5v14"/>',
    'dots': '<circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/>',
    'grip-vertical': '<circle cx="9" cy="5" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="9" cy="19" r="1.4"/><circle cx="15" cy="5" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="15" cy="19" r="1.4"/>',
    'pencil': '<path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4"/><path d="M13.5 6.5l4 4"/>',
    'trash': '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>',
    'download': '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/><path d="M7 11l5 5l5 -5"/><path d="M12 4v12"/>',
    'upload': '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/><path d="M7 9l5 -5l5 5"/><path d="M12 4v12"/>',
    'cloud-off': '<path d="M3 3l18 18"/><path d="M6.657 7.657a4 4 0 0 0 .343 7.343h9a3.5 3.5 0 0 0 .57 -6.955"/>',
    'wifi-off': '<path d="M3 3l18 18"/><path d="M9.172 15.172a4 4 0 0 1 5.656 0"/><path d="M6.343 12.343a8 8 0 0 1 2.357 -1.567"/><path d="M3.515 9.515a12 12 0 0 1 3.985 -2.644"/><path d="M16.5 11.5a8 8 0 0 1 1.157 .643"/><path d="M19.07 6.93a12 12 0 0 1 1.43 1.085"/><path d="M12 20l.01 0"/>',
    'star-filled': '<path d="M12 2l3.09 6.26l6.91 1l-5 4.87l1.18 6.88l-6.18 -3.25l-6.18 3.25l1.18 -6.88l-5 -4.87l6.91 -1z"/>',
    'bookmark': '<path d="M9 4h6a2 2 0 0 1 2 2v14l-5 -3l-5 3v-14a2 2 0 0 1 2 -2z"/>',
    'bookmark-filled': '<path d="M9 4h6a2 2 0 0 1 2 2v14l-5 -3l-5 3v-14a2 2 0 0 1 2 -2z"/>',
    'player-play-filled': '<path d="M7 4v16l13 -8z"/>',
    'user': '<circle cx="12" cy="8" r="4"/><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"/>',
    'alert-triangle': '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.24 3.957l-8.422 14.06a1.989 1.989 0 0 0 1.7 2.983h16.845a1.989 1.989 0 0 0 1.7 -2.983l-8.423 -14.06a1.989 1.989 0 0 0 -3.4 0z"/>',
    'alert-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',
    'wifi': '<path d="M12 18l.01 0"/><path d="M9.172 15.172a4 4 0 0 1 5.656 0"/><path d="M6.343 12.343a8 8 0 0 1 11.314 0"/><path d="M3.515 9.515a12 12 0 0 1 16.97 0"/>',
    'cloud-download': '<path d="M19 18a3.5 3.5 0 0 0 0 -7h-1a5 4.5 0 0 0 -11 -2a4.6 4.4 0 0 0 -2.1 8.4"/><path d="M12 13l0 9"/><path d="M9 19l3 3l3 -3"/>',
    'cloud-upload': '<path d="M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7"/><path d="M9 15l3 -3l3 3"/><path d="M12 12l0 9"/>',
    'refresh': '<path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/>',
  };

  function svg(name) {
    const inner = ICONS[name];
    if (!inner) return '<svg class="ti" viewBox="0 0 24 24" width="1em" height="1em"></svg>';
    const filled = FILLED.has(name);
    return `<svg class="ti ti-${name}" viewBox="0 0 24 24" width="1em" height="1em" ` +
      `fill="${filled ? 'currentColor' : 'none'}" stroke="${filled ? 'none' : 'currentColor'}" ` +
      `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ` +
      `style="display:inline-block;vertical-align:-0.14em;flex:none">${inner}</svg>`;
  }

  window.ICONS = { svg, FILLED, map: ICONS };
})();
