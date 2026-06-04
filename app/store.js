// store.js — localStorage data layer. Attaches window.Store.
// Schema version wl.v1. Single object persisted as JSON.
(function () {
  'use strict';

  const LS_KEY = 'wl.v1';

  const DEFAULTS = {
    settings: { apiKey: '', theme: 'dark' },
    lists: [],   // { id, name, color, note, createdAt, order }
    items: {},   // key "type:id" -> item
    recent: [],  // recent search queries
  };

  const COLORS = ['#d94a3d', '#e8b84b', '#3a8d6b', '#4a6bd6', '#9b6ad0', '#e87a3e', '#cf5a8a', '#5aa6c9'];

  let state = load();
  const subs = new Set();

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      return {
        settings: Object.assign({}, DEFAULTS.settings, raw.settings),
        lists: raw.lists || [],
        items: raw.items || {},
        recent: raw.recent || [],
      };
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULTS));
    }
  }

  function persist() {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    subs.forEach(fn => { try { fn(); } catch (e) {} });
  }

  function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function today() { return new Date().toISOString().slice(0, 10); }

  // ── settings ────────────────────────────────────────────────────────────
  function getSettings() { return Object.assign({}, state.settings); }
  function setSetting(k, v) { state.settings[k] = v; persist(); }
  function hasApiKey() { return !!state.settings.apiKey || !!(window.TMDB && window.TMDB.DEFAULT_API_KEY); }
  function isUsingDefaultKey() { return !state.settings.apiKey; }

  // ── lists ────────────────────────────────────────────────────────────────
  function getLists() {
    return state.lists.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  function getList(id) { return state.lists.find(l => l.id === id) || null; }

  function createList(name, color, note) {
    const list = {
      id: uid(),
      name: (name || 'New List').trim(),
      color: color || COLORS[state.lists.length % COLORS.length],
      note: note || '',
      createdAt: Date.now(),
      order: state.lists.length,
    };
    state.lists.push(list);
    persist();
    return list;
  }
  function updateList(id, patch) {
    const l = getList(id);
    if (l) { Object.assign(l, patch); persist(); }
  }
  function deleteList(id) {
    state.lists = state.lists.filter(l => l.id !== id);
    // remove list ref from items; if item ends up in no list, keep it (orphan) — still in library
    Object.values(state.items).forEach(it => {
      it.lists = (it.lists || []).filter(x => x !== id);
    });
    persist();
  }
  function reorderLists(orderedIds) {
    orderedIds.forEach((id, i) => { const l = getList(id); if (l) l.order = i; });
    persist();
  }

  // ── items ──────────────────────────────────────────────────────────────
  function getItem(key) { return state.items[key] || null; }
  function allItems() { return Object.values(state.items); }

  function itemsInList(listId) {
    return allItems()
      .filter(it => (it.lists || []).includes(listId))
      .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  }
  function itemsByStatus(status) {
    return allItems().filter(it => it.status === status);
  }

  // Add a (search-normalized or detail) object to a list. Creates/merges item.
  function addToList(obj, listId) {
    const k = obj.key;
    let it = state.items[k];
    if (!it) {
      it = {
        key: k, type: obj.type, id: obj.id, title: obj.title, year: obj.year,
        poster: obj.poster || null, backdrop: obj.backdrop || null,
        rating: obj.rating ?? null, overview: obj.overview || '',
        genres: obj.genres || [], runtime: obj.runtime || null,
        seasonsCount: obj.seasonsCount || null, episodesCount: obj.episodesCount || null,
        episodeRunTime: obj.episodeRunTime || null,
        addedAt: Date.now(),
        status: 'want',
        watchedDate: null,
        userRating: 0,
        lists: [],
        seasons: {}, // { [n]: { total, watched: [epNums] } }
      };
      state.items[k] = it;
    } else {
      // enrich with any richer fields present
      ['poster', 'backdrop', 'overview', 'rating', 'runtime', 'seasonsCount',
       'episodesCount', 'episodeRunTime'].forEach(f => {
        if ((it[f] == null || it[f] === '' || (Array.isArray(it[f]) && !it[f].length)) && obj[f] != null) it[f] = obj[f];
      });
      if ((!it.genres || !it.genres.length) && obj.genres) it.genres = obj.genres;
    }
    if (listId && !it.lists.includes(listId)) it.lists.push(listId);
    persist();
    return it;
  }

  // Enrich an existing item from full details (keeps user fields intact)
  function enrichItem(key, det) {
    const it = state.items[key];
    if (!it) return null;
    ['poster', 'backdrop', 'rating', 'overview', 'runtime', 'seasonsCount',
     'episodesCount', 'episodeRunTime', 'genres'].forEach(f => {
      if (det[f] != null && det[f] !== '') it[f] = det[f];
    });
    persist();
    return it;
  }

  function removeItem(key) { delete state.items[key]; persist(); }

  function setItemLists(key, listIds) {
    const it = state.items[key];
    if (it) { it.lists = listIds.slice(); persist(); }
  }
  function toggleItemList(key, listId) {
    const it = state.items[key];
    if (!it) return;
    if (it.lists.includes(listId)) it.lists = it.lists.filter(x => x !== listId);
    else it.lists.push(listId);
    persist();
  }

  // ── status ──────────────────────────────────────────────────────────────
  function setStatus(key, status) {
    const it = state.items[key];
    if (!it) return;
    it.status = status;
    if (status === 'watched' && !it.watchedDate) it.watchedDate = today();
    if (status !== 'watched') { it.watchedDate = null; }
    persist();
  }
  function setWatchedDate(key, date) { const it = state.items[key]; if (it) { it.watchedDate = date; persist(); } }
  function setUserRating(key, n) { const it = state.items[key]; if (it) { it.userRating = n; persist(); } }

  // ── TV season / episode progress ─────────────────────────────────────────
  function ensureSeason(it, n, total) {
    if (!it.seasons) it.seasons = {};
    if (!it.seasons[n]) it.seasons[n] = { total: total || 0, watched: [] };
    if (total) it.seasons[n].total = total;
    return it.seasons[n];
  }
  function toggleEpisode(key, seasonNum, epNum, total) {
    const it = state.items[key];
    if (!it) return;
    const s = ensureSeason(it, seasonNum, total);
    const i = s.watched.indexOf(epNum);
    if (i >= 0) s.watched.splice(i, 1);
    else s.watched.push(epNum);
    recomputeTVStatus(it);
    persist();
  }
  function setSeasonWatched(key, seasonNum, total, watched) {
    const it = state.items[key];
    if (!it) return;
    const s = ensureSeason(it, seasonNum, total);
    s.total = total;
    s.watched = watched ? Array.from({ length: total }, (_, i) => i + 1) : [];
    recomputeTVStatus(it);
    persist();
  }
  function markUpToEpisode(key, seasonNum, epNum, total) {
    const it = state.items[key];
    if (!it) return;
    const s = ensureSeason(it, seasonNum, total);
    s.watched = Array.from({ length: epNum }, (_, i) => i + 1);
    recomputeTVStatus(it);
    persist();
  }
  function seasonProgress(it, seasonNum) {
    const s = it.seasons && it.seasons[seasonNum];
    if (!s) return { watched: 0, total: 0 };
    return { watched: s.watched.length, total: s.total };
  }
  function recomputeTVStatus(it) {
    if (it.type !== 'tv') return;
    const totalWatched = Object.values(it.seasons || {}).reduce((a, s) => a + s.watched.length, 0);
    const totalEps = it.episodesCount || Object.values(it.seasons || {}).reduce((a, s) => a + (s.total || 0), 0);
    if (totalWatched === 0) {
      if (it.status === 'watching') it.status = 'want';
    } else if (totalEps && totalWatched >= totalEps) {
      it.status = 'watched';
      if (!it.watchedDate) it.watchedDate = today();
    } else {
      it.status = 'watching';
      it.watchedDate = null;
    }
  }

  // ── derived: log + stats ──────────────────────────────────────────────────
  function watchedLog() {
    const entries = allItems()
      .filter(it => it.watchedDate)
      .sort((a, b) => (a.watchedDate < b.watchedDate ? 1 : -1));
    return entries;
  }

  function stats() {
    const watched = allItems().filter(it => it.status === 'watched' || it.watchedDate);
    const films = watched.filter(it => it.type === 'movie');
    const shows = watched.filter(it => it.type === 'tv');

    // screen time (minutes): movies runtime; tv: watched episodes * episodeRunTime||42
    let minutes = 0;
    films.forEach(it => { minutes += it.runtime || 0; });
    allItems().filter(it => it.type === 'tv').forEach(it => {
      const epLen = it.episodeRunTime || 42;
      const w = Object.values(it.seasons || {}).reduce((a, s) => a + s.watched.length, 0);
      minutes += w * epLen;
    });

    // per-month (last 12 months) from watchedDate
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleString('en', { month: 'short' }), count: 0 });
    }
    const mIndex = {};
    months.forEach((m, i) => mIndex[m.key] = i);
    watched.forEach(it => {
      if (!it.watchedDate) return;
      const k = it.watchedDate.slice(0, 7);
      if (k in mIndex) months[mIndex[k]].count++;
    });

    // genres
    const genreCount = {};
    watched.forEach(it => (it.genres || []).forEach(g => { genreCount[g] = (genreCount[g] || 0) + 1; }));
    const topGenres = Object.entries(genreCount).sort((a, b) => b[1] - a[1]).slice(0, 6);

    // this month
    const thisMonthKey = now.toISOString().slice(0, 7);
    const thisMonth = watched.filter(it => it.watchedDate && it.watchedDate.slice(0, 7) === thisMonthKey).length;

    // this year
    const yr = now.getFullYear().toString();
    const thisYear = watched.filter(it => it.watchedDate && it.watchedDate.slice(0, 4) === yr).length;

    return {
      total: watched.length,
      films: films.length,
      shows: shows.length,
      minutes,
      hours: Math.round(minutes / 60),
      months,
      maxMonth: Math.max(1, ...months.map(m => m.count)),
      topGenres,
      thisMonth,
      thisYear,
    };
  }

  // counts per status across library
  function statusCounts() {
    const c = { all: 0, want: 0, watching: 0, watched: 0 };
    allItems().forEach(it => { c.all++; if (c[it.status] != null) c[it.status]++; });
    return c;
  }

  // ── recents ──────────────────────────────────────────────────────────────
  function pushRecent(q) {
    q = q.trim();
    if (!q) return;
    state.recent = [q, ...state.recent.filter(x => x.toLowerCase() !== q.toLowerCase())].slice(0, 8);
    persist();
  }
  function getRecent() { return state.recent.slice(); }
  function clearRecent() { state.recent = []; persist(); }

  // ── data export / import / clear ──────────────────────────────────────────
  function exportJSON() { return JSON.stringify(state, null, 2); }
  function importJSON(json) {
    const obj = JSON.parse(json);
    state = {
      settings: Object.assign({}, DEFAULTS.settings, obj.settings),
      lists: obj.lists || [],
      items: obj.items || {},
      recent: obj.recent || [],
    };
    persist();
  }
  function clearAll() {
    const keepKey = state.settings.apiKey, keepTheme = state.settings.theme;
    state = JSON.parse(JSON.stringify(DEFAULTS));
    state.settings.apiKey = keepKey; state.settings.theme = keepTheme;
    persist();
  }

  window.Store = {
    COLORS, subscribe,
    getSettings, setSetting, hasApiKey, isUsingDefaultKey,
    getLists, getList, createList, updateList, deleteList, reorderLists,
    getItem, allItems, itemsInList, itemsByStatus,
    addToList, enrichItem, removeItem, setItemLists, toggleItemList,
    setStatus, setWatchedDate, setUserRating,
    toggleEpisode, setSeasonWatched, markUpToEpisode, seasonProgress, ensureSeason,
    watchedLog, stats, statusCounts,
    pushRecent, getRecent, clearRecent,
    exportJSON, importJSON, clearAll,
  };
})();
