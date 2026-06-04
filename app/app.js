// app.js — core router, bottom nav, and views: home, search, list, new-list,
// manage, settings. Attaches window.App. Loads UI, Store, TMDB, Views(detail.js).
(function () {
  'use strict';
  const U = window.UI, S = window.Store, T = window.TMDB;

  const App = {
    state: {
      tab: 'home',          // home | search | activity | settings
      stack: [],            // pushed overlay views
      homeFilter: 'all',    // all | watching | want | watched
      activityTab: 'log',   // log | stats
    },
    searchCache: {},        // key -> normalized search obj (for items not yet stored)
    detailCache: {},        // key -> full details
  };

  const root = () => document.getElementById('view-root');

  // ── navigation ─────────────────────────────────────────────────────────
  function setTab(tab) {
    App.state.tab = tab;
    App.state.stack = [];
    render();
    window.scrollTo(0, 0);
  }
  function push(view) {
    App.state.stack.push(view);
    render();
    window.scrollTo(0, 0);
  }
  function back() {
    App.state.stack.pop();
    render();
  }
  function replaceTop(view) {
    App.state.stack[App.state.stack.length - 1] = view;
    render();
  }

  // ── master render ──────────────────────────────────────────────────────
  function render() {
    const r = root();
    if (!r) return;
    const stack = App.state.stack;
    let html = '';
    if (stack.length) {
      const top = stack[stack.length - 1];
      html = renderOverlay(top);
    } else {
      html = renderTab(App.state.tab);
    }
    r.innerHTML = html;
    renderNav();
    // post-render hooks
    if (stack.length) {
      const top = stack[stack.length - 1];
      if (top.type === 'detail') window.Views.afterDetail(top);
    } else {
      if (App.state.tab === 'search') afterSearch();
      if (App.state.tab === 'activity' && App.state.activityTab === 'stats') window.Views.afterStats();
    }
  }

  function renderTab(tab) {
    switch (tab) {
      case 'home': return renderHome();
      case 'search': return renderSearch();
      case 'activity': return window.Views.renderActivity();
      case 'settings': return renderSettings();
    }
    return '';
  }
  function renderOverlay(view) {
    switch (view.type) {
      case 'detail': return window.Views.renderDetail(view);
      case 'list': return renderListView(view);
      case 'newlist': return renderNewList(view);
      case 'manage': return renderManage();
      case 'log': return window.Views.renderLogFull();
    }
    return '';
  }

  // ── bottom nav ─────────────────────────────────────────────────────────
  function renderNav() {
    let nav = document.querySelector('.nav');
    const tabs = [
      ['home', 'stack-2', 'Lists'],
      ['search', 'search', 'Search'],
      ['activity', 'chart-histogram', 'Activity'],
      ['settings', 'settings', 'Settings'],
    ];
    const onRoot = App.state.stack.length === 0;
    const html = tabs.map(([k, icon, label]) =>
      `<button class="navbtn" data-on="${onRoot && App.state.tab === k}" data-action="tab" data-tab="${k}">
        ${U.ti(icon)}<span>${label}</span>
      </button>`).join('');
    if (!nav) {
      nav = U.node(`<nav class="nav">${html}</nav>`);
      document.body.appendChild(nav);
    } else {
      nav.innerHTML = html;
    }
    // FAB on home only
    let fab = document.querySelector('.fab');
    if (onRoot && App.state.tab === 'home' && S.getLists().length) {
      if (!fab) { fab = U.node(`<button class="fab" data-action="fab-add">${U.ti('plus')}</button>`); document.body.appendChild(fab); }
    } else if (fab) { fab.remove(); }
  }

  // ════════════════════════════════════════════════════════════════════════
  // HOME
  // ════════════════════════════════════════════════════════════════════════
  function renderHome() {
    const lists = S.getLists();
    const counts = S.statusCounts();

    if (!lists.length && !S.allItems().length) return homeEmpty();

    const filter = App.state.homeFilter;
    const seg = statusFilterRow(filter, counts);

    let body;
    if (filter === 'watching') {
      body = watchingView();
    } else {
      body = lists.map(l => shelfHTML(l, filter)).join('') || emptyFiltered(filter);
      // orphan items (in library but no list) — show under "Unsorted"
      const orphans = S.allItems().filter(it => !(it.lists || []).length && matchFilter(it, filter));
      if (orphans.length) {
        body += shelfRaw({ name: 'Unsorted', color: 'var(--text-faint)', id: '__orphan' }, orphans);
      }
    }

    return `
      <div class="view">
        <div class="topbar">
          <div class="topbar__title">Watchlist</div>
          <div class="topbar__spacer"></div>
          <button class="iconbtn iconbtn--ghost" data-action="tab" data-tab="search">${U.ti('search')}</button>
          <button class="iconbtn iconbtn--ghost" data-action="tab" data-tab="settings">${U.ti('settings')}</button>
        </div>
        ${seg}
        <div style="margin-top:6px">${body}</div>
        <div style="height:20px"></div>
      </div>`;
  }

  function statusFilterRow(filter, counts) {
    const chip = (k, label, variant) => `
      <button class="chip" data-on="${filter === k}" ${variant ? `data-variant="${variant}"` : ''}
        data-action="home-filter" data-filter="${k}">
        ${variant === 'watching' ? U.ti('player-play-filled') : ''}${label}
        <span class="chip__count">${counts[k] || 0}</span>
      </button>`;
    return `<div class="segrow">
      ${chip('all', 'All')}
      ${chip('watching', 'Watching', 'watching')}
      ${chip('want', 'Want')}
      ${chip('watched', 'Watched')}
    </div>`;
  }

  function matchFilter(it, filter) { return filter === 'all' || it.status === filter; }

  function shelfHTML(list, filter) {
    let items = S.itemsInList(list.id);
    if (filter !== 'all') items = items.filter(it => it.status === filter);
    return shelfRaw(list, items, true);
  }
  function shelfRaw(list, items, openable) {
    if (!items.length) return '';
    const posters = items.map(U.posterCard).join('');
    const headAction = openable && list.id !== '__orphan' ? `data-action="open-list" data-list="${list.id}"` : '';
    return `
      <div class="shelf">
        <div class="shelf__head" ${headAction} style="${openable ? 'cursor:pointer' : ''}">
          <span class="shelf__dot" style="background:${list.color}"></span>
          <span class="shelf__name">${U.esc(list.name)}</span>
          <span class="shelf__count">${items.length}</span>
          <span class="shelf__spacer"></span>
          ${openable && list.id !== '__orphan' ? `<span class="shelf__more">${U.ti('chevron-right')}</span>` : ''}
        </div>
        <div class="shelf__rail">${posters}</div>
      </div>`;
  }

  function watchingView() {
    const items = S.itemsByStatus('watching').sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    if (!items.length) return emptyFiltered('watching');
    const rows = items.map(it => {
      const pct = U.tvProgressPct(it);
      let sub, bar = '';
      if (it.type === 'tv') {
        const w = U.tvWatchedCount(it);
        sub = `${w} of ${it.episodesCount || '?'} episodes`;
        bar = `<div class="wrow__bar"><span style="width:${pct}%"></span></div>`;
      } else {
        sub = `${U.formatRuntime(it.runtime) || 'Film'} · in progress`;
      }
      return `
        <div class="wrow" data-action="open-detail" data-key="${it.key}">
          <div class="wrow__poster">${U.posterImg(it.poster, it.title)}</div>
          <div class="wrow__body">
            <div class="wrow__title">${U.esc(it.title)}</div>
            <div class="wrow__sub">${U.esc(sub)}</div>
            ${bar}
          </div>
          <button class="wrow__play" data-action="open-detail" data-key="${it.key}">${U.ti('player-play-filled')}</button>
        </div>`;
    }).join('');
    return `<div class="label">${items.length} in progress · across all lists</div>${rows}`;
  }

  function emptyFiltered(filter) {
    const map = { watching: 'Nothing in progress yet.', want: 'Nothing on the want list.', watched: 'Nothing marked watched yet.' };
    return `<div class="empty" style="padding:50px 36px">
      <div class="empty__art">${U.ti('movie')}</div>
      <div class="empty__text">${map[filter] || 'Nothing here yet.'}</div>
    </div>`;
  }

  function homeEmpty() {
    return `
      <div class="view">
        <div class="topbar"><div class="topbar__title">Watchlist</div></div>
        <div class="empty">
          <div class="empty__art">${U.ti('movie')}</div>
          <div class="empty__title">No lists yet</div>
          <div class="empty__text">Lists group what you want to watch — by mood, by who you're with, whatever works.</div>
          <div class="empty__actions">
            <button class="btn btn--primary" data-action="fab-add">${U.ti('plus')} New list</button>
            <button class="btn" data-action="tab" data-tab="search">${U.ti('search')} Find something</button>
          </div>
          <div style="margin-top:26px;font-size:13px" class="muted">e.g. Weekend Queue · Date Night · To Show Mom</div>
        </div>
      </div>`;
  }

  // ════════════════════════════════════════════════════════════════════════
  // SEARCH
  // ════════════════════════════════════════════════════════════════════════
  let searchTimer = null, lastQuery = '', trendingCache = null;

  function renderSearch() {
    return `
      <div class="view">
        <div class="searchbar">
          <div class="searchbox">
            ${U.ti('search')}
            <input id="search-input" type="text" placeholder="Search movies &amp; shows…" autocomplete="off"
              value="${U.esc(lastQuery)}">
            <button class="iconbtn iconbtn--ghost hide" id="search-clear" style="width:24px;height:24px" data-action="search-clear">${U.ti('x')}</button>
          </div>
        </div>
        <div id="search-results"></div>
      </div>`;
  }

  function afterSearch() {
    const input = document.getElementById('search-input');
    if (!input) return;
    input.addEventListener('input', onSearchInput);
    if (!lastQuery) setTimeout(() => input.focus(), 100);
    if (lastQuery) doSearch(lastQuery);
    else showSearchIdle();
    toggleClear();
  }

  function toggleClear() {
    const c = document.getElementById('search-clear');
    if (c) c.classList.toggle('hide', !lastQuery);
  }

  function onSearchInput(e) {
    lastQuery = e.target.value;
    toggleClear();
    clearTimeout(searchTimer);
    if (!lastQuery.trim()) { showSearchIdle(); return; }
    searchTimer = setTimeout(() => doSearch(lastQuery), 280);
  }

  function clearSearch() {
    lastQuery = '';
    const input = document.getElementById('search-input');
    if (input) { input.value = ''; input.focus(); }
    toggleClear();
    showSearchIdle();
  }

  async function showSearchIdle() {
    const box = document.getElementById('search-results');
    if (!box) return;
    const recent = S.getRecent();
    let html = '';
    if (recent.length) {
      html += `<div class="label">Recent</div><div class="tagrow">` +
        recent.map(q => `<button class="tag" data-action="search-recent" data-q="${U.esc(q)}">${U.ti('history')}${U.esc(q)}</button>`).join('') +
        `</div>`;
    }
    html += `<div class="label">Trending this week</div><div class="pgrid" id="trending-grid">`;
    html += skeletonPosters(6);
    html += `</div>`;
    box.innerHTML = html;

    try {
      if (!trendingCache) trendingCache = await T.trending();
      const grid = document.getElementById('trending-grid');
      if (grid) grid.innerHTML = trendingCache.slice(0, 9).map(r => searchPoster(r)).join('');
    } catch (e) { handleApiError(e); }
  }

  function searchPoster(r) {
    App.searchCache[r.key] = r;
    const stored = S.getItem(r.key);
    let badge = '';
    if (stored) badge = `<div class="poster__badge poster__badge--watched" style="background:rgba(70,160,111,0.92)">${U.ti('check')}</div>`;
    return `<div class="poster" style="aspect-ratio:2/3" data-action="open-detail" data-key="${r.key}">
      ${U.posterImg(r.poster, r.title)}${stored ? badge : ''}
    </div>`;
  }

  async function doSearch(q) {
    const box = document.getElementById('search-results');
    if (!box) return;
    box.innerHTML = `<div class="center-load"><div class="spinner"></div></div>`;
    try {
      const results = await T.searchMulti(q);
      S.pushRecent(q);
      if (!results.length) {
        box.innerHTML = `<div class="empty" style="padding:50px"><div class="empty__art">${U.ti('mood-empty')}</div><div class="empty__text">No results for "${U.esc(q)}"</div></div>`;
        return;
      }
      box.innerHTML = `<div class="label">${results.length} result${results.length > 1 ? 's' : ''} · TMDB</div>` +
        results.map(resultRow).join('');
    } catch (e) { handleApiError(e); box.innerHTML = apiErrorHTML(); }
  }

  function resultRow(r) {
    App.searchCache[r.key] = r;
    const stored = S.getItem(r.key);
    const inLists = stored ? (stored.lists || []).map(id => S.getList(id)).filter(Boolean) : [];
    const inLine = inLists.length
      ? `<span class="result__in">${U.ti('check')} in ${U.esc(inLists.map(l => l.name).join(', '))}</span>` : '';
    return `
      <div class="result">
        <div class="result__poster" data-action="open-detail" data-key="${r.key}">${U.posterImg(r.poster, r.title, 'w185')}</div>
        <div class="result__body" data-action="open-detail" data-key="${r.key}">
          <div class="result__title">${U.esc(r.title)}</div>
          <div class="result__sub"><span class="result__pill">${U.typeLabel(r.type)}</span>${U.esc([r.year, r.rating ? '★ ' + r.rating : ''].filter(Boolean).join(' · '))}</div>
          ${inLine}
        </div>
        <button class="result__add" data-added="${!!stored}" data-action="add-open" data-key="${r.key}">
          ${stored ? U.ti('check') : U.ti('plus')}
        </button>
      </div>`;
  }

  function skeletonPosters(n) {
    return Array.from({ length: n }, () => `<div class="sk" style="aspect-ratio:2/3"></div>`).join('');
  }

  // ════════════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ════════════════════════════════════════════════════════════════════════
  function renderListView(view) {
    const list = S.getList(view.id);
    if (!list) { back(); return ''; }
    const all = S.itemsInList(list.id);
    const filter = view.filter || 'all';
    const sort = view.sort || 'added';
    let items = filter === 'all' ? all.slice() : all.filter(it => it.status === filter);
    items = sortItems(items, sort);
    const counts = { all: all.length, want: 0, watching: 0, watched: 0 };
    all.forEach(it => counts[it.status] != null && counts[it.status]++);

    const totalRuntime = all.reduce((a, it) => a + (it.type === 'movie' ? (it.runtime || 0) : 0), 0);
    const sub = [`${all.length} title${all.length !== 1 ? 's' : ''}`, totalRuntime ? U.formatRuntime(totalRuntime) : '', counts.watching ? `${counts.watching} watching` : '']
      .filter(Boolean).join(' · ');

    const grid = items.length
      ? `<div class="pgrid">${items.map(it => listPoster(it)).join('')}</div>`
      : emptyFiltered(filter);

    return `
      <div class="view view--push">
        <div class="backbar">
          <button class="iconbtn iconbtn--ghost" data-action="back">${U.ti('chevron-left')}</button>
          <div class="topbar__spacer"></div>
          <button class="iconbtn iconbtn--ghost" data-action="list-sort" data-list="${list.id}">${U.ti('arrows-sort')}</button>
          <button class="iconbtn iconbtn--ghost" data-action="list-menu" data-list="${list.id}">${U.ti('dots')}</button>
        </div>
        <div class="safe">
          <div style="display:flex;align-items:center;gap:9px">
            <span class="shelf__dot" style="background:${list.color};width:11px;height:11px"></span>
            <div class="topbar__title" style="font-size:27px">${U.esc(list.name)}</div>
          </div>
          <div class="detail__meta" style="margin-top:6px">${U.esc(sub)}</div>
          ${list.note ? `<div class="detail__overview" style="margin-top:10px;font-size:13px">${U.esc(list.note)}</div>` : ''}
        </div>
        <div class="segrow" style="margin-top:14px">
          ${listChip(list.id, 'all', 'All ' + counts.all, filter, sort)}
          ${listChip(list.id, 'want', 'Want ' + counts.want, filter, sort)}
          ${listChip(list.id, 'watching', 'Watching ' + counts.watching, filter, sort)}
          ${listChip(list.id, 'watched', 'Watched ' + counts.watched, filter, sort)}
        </div>
        <div style="margin-top:14px">${grid}</div>
      </div>`;
  }

  function listChip(listId, k, label, active, sort) {
    return `<button class="chip" data-on="${active === k}" data-action="list-filter" data-list="${listId}" data-filter="${k}" data-sort="${sort}">${U.esc(label)}</button>`;
  }

  function listPoster(it) {
    let badge = '';
    if (it.status === 'watching') badge = `<div class="poster__badge poster__badge--watching">${U.ti('player-play-filled')}</div>`;
    else if (it.status === 'watched') badge = `<div class="poster__badge poster__badge--watched">${U.ti('check')}</div>`;
    const len = it.type === 'tv' ? (it.seasonsCount ? 'S' + it.seasonsCount : 'TV') : U.formatRuntime(it.runtime);
    return `
      <div>
        <div class="poster" style="aspect-ratio:2/3" data-action="open-detail" data-key="${it.key}"
          data-longpress="item" data-key2="${it.key}">
          ${U.posterImg(it.poster, it.title)}${badge}
        </div>
        <div class="poster__meta"><div class="poster__meta-row"><span>${it.rating ? '★ ' + it.rating : ''}</span><span>${len}</span></div></div>
      </div>`;
  }

  function sortItems(items, sort) {
    const s = items.slice();
    switch (sort) {
      case 'title': s.sort((a, b) => a.title.localeCompare(b.title)); break;
      case 'rating': s.sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
      case 'year': s.sort((a, b) => (b.year || '').localeCompare(a.year || '')); break;
      case 'runtime': s.sort((a, b) => (b.runtime || 0) - (a.runtime || 0)); break;
      default: s.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    }
    return s;
  }

  function openSortSheet(listId) {
    const view = App.state.stack[App.state.stack.length - 1];
    const cur = view.sort || 'added';
    const opts = [['added', 'Date added'], ['title', 'Title A–Z'], ['rating', 'Rating'], ['year', 'Release year'], ['runtime', 'Runtime']];
    const html = `<div class="sheet__title">Sort by</div><div style="margin-top:10px">` +
      opts.map(([k, l]) => `
        <div class="lrow" data-action="set-sort" data-sort="${k}">
          <div class="lrow__check" data-on="${cur === k}" style="border-radius:50%">${cur === k ? U.ti('check') : ''}</div>
          <div class="lrow__name">${l}</div>
        </div>`).join('') + `</div>`;
    U.openSheet(html);
  }

  function openListMenu(listId, x, y) {
    U.openMenu(x, y, [
      { icon: 'pencil', label: 'Rename / edit', onClick: () => push({ type: 'newlist', editId: listId }) },
      { icon: 'plus', label: 'Add titles', onClick: () => setTab('search') },
      { icon: 'trash', label: 'Delete list', danger: true, onClick: () => confirmDeleteList(listId) },
    ]);
  }

  function confirmDeleteList(listId) {
    const list = S.getList(listId);
    const html = `
      <div class="sheet__title">Delete "${U.esc(list.name)}"?</div>
      <div class="detail__overview" style="margin-top:8px">The titles stay in your library and any other lists — only this list is removed.</div>
      <div style="display:flex;gap:10px;margin-top:20px">
        <button class="btn btn--full" data-action="close-sheet">Cancel</button>
        <button class="btn btn--full btn--primary" data-action="do-delete-list" data-list="${listId}">Delete</button>
      </div>`;
    U.openSheet(html);
  }

  // ════════════════════════════════════════════════════════════════════════
  // NEW / EDIT LIST
  // ════════════════════════════════════════════════════════════════════════
  function renderNewList(view) {
    const editing = view.editId ? S.getList(view.editId) : null;
    const name = editing ? editing.name : '';
    const color = editing ? editing.color : S.COLORS[S.getLists().length % S.COLORS.length];
    const note = editing ? editing.note : '';
    return `
      <div class="view view--push">
        <div class="backbar">
          <button class="iconbtn iconbtn--ghost" data-action="back">${U.ti('chevron-left')}</button>
        </div>
        <div class="safe">
          <div class="topbar__title" style="font-size:27px">${editing ? 'Edit list' : 'New list'}</div>
          <div class="field">
            <div class="field__label">Name</div>
            <input type="text" id="nl-name" placeholder="e.g. Sunday Marathon" value="${U.esc(name)}" maxlength="40">
          </div>
          <div class="field">
            <div class="field__label">Color</div>
            <div class="colorpick" id="nl-colors">
              ${S.COLORS.map(c => `<button class="swatch" data-on="${c === color}" style="background:${c}" data-action="pick-color" data-color="${c}"></button>`).join('')}
            </div>
          </div>
          <div class="field">
            <div class="field__label">Note (optional)</div>
            <textarea id="nl-note" placeholder="What's this list for?" maxlength="140">${U.esc(note)}</textarea>
          </div>
          <div style="display:flex;gap:10px;margin-top:26px">
            <button class="btn btn--primary btn--full" data-action="save-list" ${view.editId ? `data-edit="${view.editId}"` : ''}>${editing ? 'Save' : 'Create list'}</button>
          </div>
        </div>
      </div>`;
  }

  // ════════════════════════════════════════════════════════════════════════
  // MANAGE LISTS
  // ════════════════════════════════════════════════════════════════════════
  function renderManage() {
    const lists = S.getLists();
    return `
      <div class="view view--push">
        <div class="backbar">
          <button class="iconbtn iconbtn--ghost" data-action="back">${U.ti('chevron-left')}</button>
        </div>
        <div class="safe"><div class="topbar__title" style="font-size:27px">Manage lists</div>
          <div class="detail__meta" style="margin-top:6px">Reorder or remove. Titles stay in your library.</div>
        </div>
        <div class="mlist">
          ${lists.map((l, i) => `
            <div class="mrow" draggable="true" data-list="${l.id}" data-idx="${i}">
              <span class="mrow__handle" data-drag-handle>${U.ti('grip-vertical')}</span>
              <span class="mrow__dot" style="background:${l.color}"></span>
              <div class="mrow__body">
                <div class="mrow__name">${U.esc(l.name)}</div>
                <div class="mrow__sub">${S.itemsInList(l.id).length} titles</div>
              </div>
              <button class="iconbtn iconbtn--ghost" data-action="open-newlist-edit" data-list="${l.id}">${U.ti('pencil')}</button>
              <button class="iconbtn iconbtn--ghost" data-action="confirm-delete-list" data-list="${l.id}" style="color:var(--accent)">${U.ti('trash')}</button>
            </div>`).join('')}
        </div>
        <div class="safe" style="margin-top:18px">
          <button class="btn btn--dashed btn--full" data-action="fab-add">${U.ti('plus')} New list</button>
        </div>
      </div>`;
  }

  // ════════════════════════════════════════════════════════════════════════
  // SETTINGS
  // ════════════════════════════════════════════════════════════════════════
  function renderSettings() {
    const st = S.getSettings();
    const usingDefault = S.isUsingDefaultKey();
    const masked = usingDefault ? 'Using built-in demo key' : '•••• •••• ' + st.apiKey.slice(-4);

    const SS = window.SheetsSync;
    const gasUrl = st.gasUrl || '';
    const syncStatus    = SS ? SS.getStatus()        : 'local';
    const syncLabel     = SS ? SS.getStatusLabel()   : 'Local only';
    const syncDotColor  = SS ? SS.getStatusDotColor(): '#8a8a96';
    const gasUrlDisplay = gasUrl
      ? (gasUrl.length > 32 ? '…' + gasUrl.slice(-30) : gasUrl)
      : 'Not configured';

    return `
      <div class="view">
        <div class="topbar"><div class="topbar__title">Settings</div></div>

        <div class="label label--tight">TMDB API</div>
        <div class="setgroup">
          <div class="setrow">
            <div>
              <div class="setrow__l">API key</div>
              <div class="setrow__r" style="margin-top:3px;font-family:var(--mono);font-size:12.5px">${U.esc(masked)}</div>
            </div>
            <div class="setrow__r"><span class="statusdot"></span> ${usingDefault ? 'demo' : 'connected'}</div>
          </div>
          <div class="setrow setrow--btn" data-action="edit-key">
            <div class="setrow__l">${usingDefault ? 'Add your own key' : 'Change key'}</div>
            <div class="setrow__r">${U.ti('chevron-right')}</div>
          </div>
        </div>
        <div class="safe" style="margin-top:8px"><div class="muted" style="font-size:12px;line-height:1.5">A key is preloaded so the app works right away. Add your own free key from themoviedb.org to use your own quota.</div></div>

        <div class="label">Appearance</div>
        <div class="setgroup">
          <div class="setrow">
            <div class="setrow__l">Theme</div>
            <div class="toggle">
              <button data-on="${st.theme === 'dark'}" data-action="set-theme" data-theme="dark">Dark</button>
              <button data-on="${st.theme === 'light'}" data-action="set-theme" data-theme="light">Light</button>
            </div>
          </div>
        </div>

        <div class="label">Lists</div>
        <div class="setgroup">
          <div class="setrow setrow--btn" data-action="open-manage">
            <div class="setrow__l">Manage lists</div>
            <div class="setrow__r">${S.getLists().length} ${U.ti('chevron-right')}</div>
          </div>
        </div>

        <div class="label">Google Sheets</div>
        <div class="setgroup">
          <div class="setrow">
            <div>
              <div class="setrow__l">Sync status</div>
              <div class="setrow__r" style="margin-top:3px;font-family:var(--mono);font-size:11px;word-break:break-all">${U.esc(gasUrlDisplay)}</div>
            </div>
            <div class="setrow__r" style="white-space:nowrap"><span class="statusdot" style="background:${syncDotColor}"></span> ${U.esc(syncLabel)}</div>
          </div>
          <div class="setrow setrow--btn" data-action="edit-gas-url">
            <div class="setrow__l">${gasUrl ? 'Change web app URL' : 'Set web app URL'}</div>
            <div class="setrow__r">${U.ti('chevron-right')}</div>
          </div>
          ${gasUrl ? `
          <div class="setrow setrow--btn" data-action="test-sheets">
            <div class="setrow__l">Test connection</div>
            <div class="setrow__r">${U.ti('wifi')}</div>
          </div>
          <div class="setrow setrow--btn" data-action="pull-sheets">
            <div class="setrow__l">Pull from Google Sheets</div>
            <div class="setrow__r">${U.ti('cloud-download')}</div>
          </div>
          <div class="setrow setrow--btn" data-action="push-sheets">
            <div class="setrow__l">Push local data to Sheets</div>
            <div class="setrow__r">${U.ti('cloud-upload')}</div>
          </div>` : ''}
        </div>
        <div class="safe" style="margin-top:8px"><div class="muted" style="font-size:12px;line-height:1.5">Paste your deployed Google Apps Script web app URL to enable sync. Data stays in localStorage; Sheets is an optional backup.</div></div>

        <div class="label">Data</div>
        <div class="setgroup">
          <div class="setrow setrow--btn" data-action="export-data"><div class="setrow__l">Export library (JSON)</div><div class="setrow__r">${U.ti('download')}</div></div>
          <div class="setrow setrow--btn" data-action="import-data"><div class="setrow__l">Import from file</div><div class="setrow__r">${U.ti('upload')}</div></div>
          <div class="setrow setrow--btn setrow--danger" data-action="clear-data"><div class="setrow__l">Clear all data</div><div class="setrow__r">${U.ti('chevron-right')}</div></div>
        </div>

        <div class="appfoot">Watchlist · ${gasUrl ? U.esc(syncLabel) : 'local only'}<br>${S.allItems().length} titles · ${S.getLists().length} lists</div>
      </div>`;
  }

  function openKeySheet() {
    const st = S.getSettings();
    const html = `
      <div class="sheet__title">TMDB API key</div>
      <div class="detail__overview" style="margin-top:8px;font-size:13.5px">Paste your v3 API key from themoviedb.org. It's stored only on this device.</div>
      <div class="field">
        <input type="text" id="key-input" class="input--mono input" placeholder="your api key…" value="${U.esc(st.apiKey)}">
      </div>
      <div id="key-status" class="muted" style="font-size:12.5px;margin-top:8px;min-height:16px"></div>
      <div style="display:flex;gap:10px;margin-top:14px">
        <button class="btn" data-action="test-key">Test</button>
        <button class="btn btn--primary btn--full" data-action="save-key">Save key</button>
      </div>
      <div style="margin-top:14px"><button class="btn btn--ghost btn--sm" data-action="use-default-key">Use built-in demo key instead</button></div>`;
    U.openSheet(html, () => setTimeout(() => { const i = document.getElementById('key-input'); if (i) i.focus(); }, 150));
  }

  // ── error handling ─────────────────────────────────────────────────────
  function handleApiError(e) {
    if (e && e.status === 401) {
      U.toast('Invalid API key', 'alert-triangle');
      setTab('settings');
      setTimeout(openKeySheet, 400);
    } else {
      U.toast('Network error — try again', 'wifi-off');
    }
  }
  function apiErrorHTML() {
    return `<div class="empty" style="padding:50px"><div class="empty__art">${U.ti('cloud-off')}</div><div class="empty__text">Couldn't reach TMDB. Check your connection or API key.</div></div>`;
  }

  // ════════════════════════════════════════════════════════════════════════
  // EVENT DELEGATION
  // ════════════════════════════════════════════════════════════════════════
  let lpTimer = null, lpTarget = null;

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const a = t.dataset.action;
    const D = t.dataset;
    switch (a) {
      case 'tab': setTab(D.tab); break;
      case 'back': back(); break;
      case 'home-filter': App.state.homeFilter = D.filter; render(); break;
      case 'open-list': push({ type: 'list', id: D.list }); break;
      case 'open-detail': window.Views.openDetail(D.key); break;
      case 'fab-add': push({ type: 'newlist' }); break;
      case 'pick-color': document.querySelectorAll('#nl-colors .swatch').forEach(s => s.setAttribute('data-on', s.dataset.color === D.color)); break;
      case 'save-list': saveList(D.edit); break;
      case 'open-manage': push({ type: 'manage' }); break;
      case 'open-newlist-edit': push({ type: 'newlist', editId: D.list }); break;
      case 'confirm-delete-list': confirmDeleteList(D.list); break;
      case 'do-delete-list': S.deleteList(D.list); U.closeSheet(); render(); U.toast('List deleted', 'trash'); break;
      case 'list-filter': replaceTop({ type: 'list', id: D.list, filter: D.filter, sort: D.sort }); break;
      case 'list-sort': openSortSheet(D.list); break;
      case 'set-sort': { const v = App.state.stack[App.state.stack.length - 1]; U.closeSheet(); replaceTop({ type: 'list', id: v.id, filter: v.filter, sort: D.sort }); } break;
      case 'list-menu': openListMenu(D.list, e.clientX, e.clientY); break;
      case 'search-clear': clearSearch(); break;
      case 'search-recent': { lastQuery = D.q; const i = document.getElementById('search-input'); if (i) i.value = D.q; toggleClear(); doSearch(D.q); } break;
      case 'add-open': window.Views.openAddSheet(D.key); break;
      case 'edit-key': openKeySheet(); break;
      case 'save-key': saveKey(); break;
      case 'test-key': testKey(); break;
      case 'use-default-key': S.setSetting('apiKey', ''); U.closeSheet(); render(); U.toast('Using demo key', 'check'); break;
      case 'set-theme': applyTheme(D.theme); render(); break;
      case 'export-data': exportData(); break;
      case 'import-data': importData(); break;
      case 'clear-data': confirmClear(); break;
      case 'do-clear': S.clearAll(); U.closeSheet(); setTab('home'); U.toast('All data cleared', 'check'); break;
      case 'edit-gas-url': openGasUrlSheet(); break;
      case 'save-gas-url': saveGasUrl(); break;
      case 'test-gas-inline': testGasInline(); break;
      case 'clear-gas-url': S.setSetting('gasUrl', ''); U.closeSheet(); render(); U.toast('Sheets URL removed', 'check'); break;
      case 'test-sheets': testSheets(); break;
      case 'pull-sheets': pullSheets(); break;
      case 'push-sheets': pushSheets(); break;
      case 'close-sheet': U.closeSheet(); break;
      case 'close-trailer': U.closeTrailer(); break;
      default: if (window.Views.handleAction) window.Views.handleAction(a, D, t, e);
    }
  });

  // long-press for list posters → context menu
  document.addEventListener('pointerdown', (e) => {
    const t = e.target.closest('[data-longpress="item"]');
    if (!t) return;
    lpTarget = t;
    lpTimer = setTimeout(() => {
      lpTimer = null;
      navigator.vibrate && navigator.vibrate(8);
      window.Views.openItemMenu(t.dataset.key2, e.clientX || 200, e.clientY || 300);
    }, 480);
  });
  document.addEventListener('pointerup', () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } });
  document.addEventListener('pointermove', () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } });

  // ── actions impl ────────────────────────────────────────────────────────
  function saveList(editId) {
    const name = (document.getElementById('nl-name').value || '').trim();
    const color = (document.querySelector('#nl-colors .swatch[data-on="true"]') || {}).dataset?.color || S.COLORS[0];
    const note = (document.getElementById('nl-note').value || '').trim();
    if (!name) { U.toast('Give it a name', 'alert-circle'); return; }
    if (editId) { S.updateList(editId, { name, color, note }); U.toast('List updated', 'check'); back(); }
    else { const l = S.createList(name, color, note); App.state.stack.pop(); push({ type: 'list', id: l.id }); U.toast('List created', 'check'); }
  }

  function saveKey() {
    const v = (document.getElementById('key-input').value || '').trim();
    if (!v) { U.toast('Paste a key first', 'alert-circle'); return; }
    S.setSetting('apiKey', v);
    U.closeSheet(); render(); U.toast('Key saved', 'check');
  }
  async function testKey() {
    const v = (document.getElementById('key-input').value || '').trim();
    const st = document.getElementById('key-status');
    if (!v) { st.textContent = 'Paste a key to test.'; return; }
    st.textContent = 'Testing…';
    try { const ok = await T.testKey(v); st.innerHTML = ok ? '<span style="color:var(--watched)">✓ Key works</span>' : '<span style="color:var(--accent)">✗ Key rejected</span>'; }
    catch (e) { st.innerHTML = '<span style="color:var(--accent)">✗ Could not verify</span>'; }
  }

  // ── Google Sheets sync ─────────────────────────────────────────────────
  function openGasUrlSheet() {
    const current = S.getSettings().gasUrl || '';
    const html = `
      <div class="sheet__title">Google Apps Script URL</div>
      <div class="detail__overview" style="margin-top:8px;font-size:13.5px">Paste the web app URL from your deployed Apps Script. Stored only on this device — never synced to the sheet.</div>
      <div class="field">
        <input type="url" id="gas-url-input" class="input--mono input" placeholder="https://script.google.com/macros/s/…/exec" value="${U.esc(current)}">
      </div>
      <div id="gas-url-status" class="muted" style="font-size:12.5px;margin-top:8px;min-height:16px"></div>
      <div style="display:flex;gap:10px;margin-top:14px">
        <button class="btn" data-action="test-gas-inline">Test</button>
        <button class="btn btn--primary btn--full" data-action="save-gas-url">Save URL</button>
      </div>
      ${current ? '<div style="margin-top:14px"><button class="btn btn--ghost btn--sm" data-action="clear-gas-url">Remove URL</button></div>' : ''}`;
    U.openSheet(html, () => setTimeout(() => { const i = document.getElementById('gas-url-input'); if (i) i.focus(); }, 150));
  }

  function saveGasUrl() {
    const v = (document.getElementById('gas-url-input').value || '').trim();
    if (!v) { U.toast('Paste a URL first', 'alert-circle'); return; }
    S.setSetting('gasUrl', v);
    U.closeSheet(); render(); U.toast('URL saved', 'check');
  }

  async function testGasInline() {
    const v = (document.getElementById('gas-url-input').value || '').trim();
    const st = document.getElementById('gas-url-status');
    if (!v) { st.textContent = 'Paste a URL to test.'; return; }
    st.textContent = 'Testing…';
    try {
      const res = await fetch(v + '?action=getDatabase', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      st.innerHTML = json.ok
        ? '<span style="color:var(--watched)">✓ Connected — Sheets backend found</span>'
        : '<span style="color:var(--accent)">✗ ' + U.esc(json.error || 'Server returned an error') + '</span>';
    } catch (e) {
      st.innerHTML = '<span style="color:var(--accent)">✗ ' + U.esc(e.message || 'Could not connect') + '</span>';
    }
  }

  async function testSheets() {
    if (!window.SheetsSync) return;
    U.toast('Testing connection…', 'wifi');
    const result = await window.SheetsSync.testConnection();
    render();
    U.toast(result.ok ? 'Connected to Sheets' : 'Connection failed: ' + result.error, result.ok ? 'check' : 'alert-triangle');
  }

  async function pullSheets() {
    if (!window.SheetsSync) return;
    U.toast('Pulling from Sheets…', 'refresh');
    render();
    const result = await window.SheetsSync.pull();
    render();
    U.toast(result.ok ? 'Pulled from Google Sheets' : 'Pull failed: ' + result.error, result.ok ? 'check' : 'alert-triangle');
  }

  async function pushSheets() {
    if (!window.SheetsSync) return;
    U.toast('Pushing to Sheets…', 'refresh');
    render();
    const result = await window.SheetsSync.push();
    render();
    U.toast(result.ok ? 'Pushed to Google Sheets' : 'Push failed: ' + result.error, result.ok ? 'check' : 'alert-triangle');
  }

  function applyTheme(theme) {
    S.setSetting('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }

  function exportData() {
    const blob = new Blob([S.exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'watchlist-export.json'; a.click();
    URL.revokeObjectURL(url);
    U.toast('Library exported', 'download');
  }
  function importData() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/json';
    input.onchange = () => {
      const file = input.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { try { S.importJSON(reader.result); setTab('home'); U.toast('Library imported', 'check'); } catch (e) { U.toast('Invalid file', 'alert-triangle'); } };
      reader.readAsText(file);
    };
    input.click();
  }
  function confirmClear() {
    U.openSheet(`
      <div class="sheet__title">Clear all data?</div>
      <div class="detail__overview" style="margin-top:8px">This removes all lists and titles from this device. Your API key and theme are kept. This can't be undone.</div>
      <div style="display:flex;gap:10px;margin-top:20px">
        <button class="btn btn--full" data-action="close-sheet">Cancel</button>
        <button class="btn btn--full btn--primary" data-action="do-clear">Clear everything</button>
      </div>`);
  }

  // ── drag reorder (manage) ───────────────────────────────────────────────
  let dragEl = null;
  document.addEventListener('dragstart', (e) => { const r = e.target.closest('.mrow'); if (r) { dragEl = r; r.style.opacity = '0.4'; } });
  document.addEventListener('dragend', (e) => { const r = e.target.closest('.mrow'); if (r) r.style.opacity = ''; dragEl = null; commitOrder(); });
  document.addEventListener('dragover', (e) => {
    if (!dragEl) return; e.preventDefault();
    const r = e.target.closest('.mrow'); if (!r || r === dragEl) return;
    const rect = r.getBoundingClientRect();
    const after = (e.clientY - rect.top) > rect.height / 2;
    r.parentNode.insertBefore(dragEl, after ? r.nextSibling : r);
  });
  function commitOrder() {
    const ids = [...document.querySelectorAll('.mrow')].map(r => r.dataset.list);
    if (ids.length) { S.reorderLists(ids); }
  }

  // ── boot ────────────────────────────────────────────────────────────────
  function init() {
    const st = S.getSettings();
    document.documentElement.setAttribute('data-theme', st.theme || 'dark');
    render();
    // Background pull on startup if a Sheets URL is configured
    if (st.gasUrl && window.SheetsSync) {
      window.SheetsSync.pull().then(result => {
        if (result.ok) { render(); U.toast('Synced from Sheets', 'check'); }
      }).catch(() => {});
    }
  }

  App.setTab = setTab; App.push = push; App.back = back; App.render = render;
  App.openKeySheet = openKeySheet; App.handleApiError = handleApiError;
  App.openItemMenuDelegate = true;
  window.App = App;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
