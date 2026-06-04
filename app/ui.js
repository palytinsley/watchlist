// ui.js — shared rendering helpers. Attaches window.UI.
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // build a DOM node from an HTML string (first element)
  function node(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function ti(name) { return window.ICONS ? window.ICONS.svg(name) : ''; }

  function formatRuntime(mins) {
    if (!mins) return '';
    const h = Math.floor(mins / 60), m = mins % 60;
    return h ? `${h}h${m ? ' ' + m + 'm' : ''}` : `${m}m`;
  }

  function typeLabel(t) { return t === 'tv' ? 'TV' : 'Film'; }

  const STATUS = {
    want:     { label: 'Want',     icon: 'bookmark',      color: 'var(--want)' },
    watching: { label: 'Watching', icon: 'player-play-filled', color: 'var(--watching)' },
    watched:  { label: 'Watched',  icon: 'check',         color: 'var(--watched)' },
  };

  // poster image or placeholder
  function posterImg(path, title, size) {
    const url = window.TMDB.poster(path, size);
    if (url) return `<img src="${url}" alt="" loading="lazy">`;
    return `<div class="poster__ph">${esc(title || 'No image')}</div>`;
  }

  // shelf poster card (expects an item from store, with optional progress)
  function posterCard(it) {
    let badge = '';
    if (it.status === 'watching') badge = `<div class="poster__badge poster__badge--watching">${ti('player-play-filled')}</div>`;
    else if (it.status === 'watched') badge = `<div class="poster__badge poster__badge--watched">${ti('check')}</div>`;

    let prog = '';
    if (it.type === 'tv' && it.status === 'watching') {
      const p = tvProgressPct(it);
      if (p > 0) prog = `<div class="poster__prog"><span style="width:${p}%"></span></div>`;
    }

    return `
      <div class="poster" style="width:112px;aspect-ratio:2/3" data-action="open-detail" data-key="${esc(it.key)}">
        ${posterImg(it.poster, it.title)}
        ${badge}
      </div>`;
  }

  function tvProgressPct(it) {
    if (it.type !== 'tv') return 0;
    const watched = Object.values(it.seasons || {}).reduce((a, s) => a + s.watched.length, 0);
    const total = it.episodesCount || Object.values(it.seasons || {}).reduce((a, s) => a + (s.total || 0), 0);
    if (!total) return 0;
    return Math.round((watched / total) * 100);
  }
  function tvWatchedCount(it) {
    return Object.values(it.seasons || {}).reduce((a, s) => a + s.watched.length, 0);
  }

  function prettyDate(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function monthLabel(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en', { month: 'long', year: 'numeric' });
  }
  function dayNum(iso) {
    const d = new Date(iso + 'T00:00:00');
    return d.getDate();
  }

  // ── toast ────────────────────────────────────────────────────────────
  let toastTimer;
  function toast(msg, icon) {
    let t = document.querySelector('.toast');
    if (!t) { t = node('<div class="toast"></div>'); document.body.appendChild(t); }
    t.innerHTML = (icon ? ti(icon) : '') + `<span>${esc(msg)}</span>`;
    requestAnimationFrame(() => t.setAttribute('data-show', 'true'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.setAttribute('data-show', 'false'), 2200);
  }

  // ── sheet ────────────────────────────────────────────────────────────
  function openSheet(innerHTML, onMount) {
    closeSheet(true);
    const scrim = node('<div class="scrim" data-sheet-scrim></div>');
    const sheet = node(`<div class="sheet" role="dialog"><div class="sheet__grip"></div>${innerHTML}</div>`);
    document.body.appendChild(scrim);
    document.body.appendChild(sheet);
    requestAnimationFrame(() => { scrim.setAttribute('data-show', 'true'); sheet.setAttribute('data-show', 'true'); });
    scrim.addEventListener('click', () => closeSheet());
    if (onMount) onMount(sheet);
    return sheet;
  }
  function closeSheet(instant) {
    const scrim = document.querySelector('[data-sheet-scrim]');
    const sheet = document.querySelector('.sheet');
    if (!sheet) return;
    if (instant) { scrim && scrim.remove(); sheet.remove(); return; }
    scrim && scrim.setAttribute('data-show', 'false');
    sheet.setAttribute('data-show', 'false');
    setTimeout(() => { scrim && scrim.remove(); sheet.remove(); }, 320);
  }

  // ── trailer modal ────────────────────────────────────────────────────
  function openTrailer(youtubeKey, name) {
    closeTrailer();
    const m = node(`
      <div class="trailer">
        <button class="trailer__close" aria-label="Close" data-action="close-trailer">${ti('x')}</button>
        <div class="trailer__inner">
          <iframe src="https://www.youtube.com/embed/${esc(youtubeKey)}?autoplay=1&rel=0" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>
        </div>
      </div>`);
    document.body.appendChild(m);
    requestAnimationFrame(() => m.setAttribute('data-show', 'true'));
    m.addEventListener('click', (e) => { if (e.target === m) closeTrailer(); });
  }
  function closeTrailer() {
    const m = document.querySelector('.trailer');
    if (m) { m.setAttribute('data-show', 'false'); setTimeout(() => m.remove(), 250); }
  }

  // ── context menu ─────────────────────────────────────────────────────
  function openMenu(x, y, items) {
    closeMenu();
    const menu = node('<div class="ctx"></div>');
    items.forEach(it => {
      const b = node(`<button ${it.danger ? 'data-danger="true"' : ''}>${ti(it.icon)}<span>${esc(it.label)}</span></button>`);
      b.addEventListener('click', (e) => { e.stopPropagation(); closeMenu(); it.onClick(); });
      menu.appendChild(b);
    });
    document.body.appendChild(menu);
    // position within viewport
    const mw = 200, mh = items.length * 45 + 4;
    let px = Math.min(x, window.innerWidth - mw - 10);
    let py = Math.min(y, window.innerHeight - mh - 10);
    menu.style.left = Math.max(10, px) + 'px';
    menu.style.top = Math.max(10, py) + 'px';
    setTimeout(() => document.addEventListener('click', closeMenu, { once: true }), 0);
  }
  function closeMenu() { const m = document.querySelector('.ctx'); if (m) m.remove(); }

  window.UI = {
    esc, node, ti, formatRuntime, typeLabel, STATUS,
    posterImg, posterCard, tvProgressPct, tvWatchedCount,
    prettyDate, monthLabel, dayNum,
    toast, openSheet, closeSheet, openTrailer, closeTrailer, openMenu, closeMenu,
  };
})();
