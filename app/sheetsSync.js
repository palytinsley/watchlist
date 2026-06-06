// sheetsSync.js — Google Sheets sync layer. Attaches window.SheetsSync.
// localStorage (via Store) is always the primary store.
// This module optionally syncs to a GAS web app URL stored in Settings.
(function () {
  'use strict';

  // POST uses Content-Type: text/plain to avoid CORS preflight.
  // GAS returns Access-Control-Allow-Origin:* for deployed web apps.

  const LABELS = {
    local:   'Local only',
    syncing: 'Syncing…',
    synced:  'Synced',
    failed:  'Sync failed',
  };

  const DOT_COLORS = {
    local:   '#8a8a96',
    syncing: '#e8b84b',
    synced:  '#46a06f',
    failed:  '#d94a3d',
  };

  let _status = 'local';
  const subs = new Set();

  function getStatus()    { return _status; }
  function getStatusLabel()   { return LABELS[_status] || _status; }
  function getStatusDotColor(){ return DOT_COLORS[_status] || DOT_COLORS.local; }

  function _set(s) {
    _status = s;
    subs.forEach(fn => { try { fn(s); } catch (e) {} });
  }

  function onStatusChange(fn) { subs.add(fn); return () => subs.delete(fn); }

  const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbxk2ySezvns1qwzUfKtThwPfdWGXhql8l4WRJpaYZnt6zYmXao8Ld7y9v0YiEHoP_mhIw/exec';

  function gasUrl() {
    return (window.Store.getSettings().gasUrl || DEFAULT_GAS_URL).trim();
  }

  // ── public API ─────────────────────────────────────────────────────────

  async function testConnection() {
    const url = gasUrl();
    if (!url) return { ok: false, error: 'No URL configured' };
    try {
      const res = await fetch(url + '?action=getDatabase', { cache: 'no-store' });
      if (!res.ok) return { ok: false, error: 'HTTP ' + res.status };
      const json = await res.json();
      return json.ok ? { ok: true } : { ok: false, error: json.error || 'Server error' };
    } catch (e) {
      return { ok: false, error: e.message || 'Network error' };
    }
  }

  async function pull() {
    const url = gasUrl();
    if (!url) return { ok: false, error: 'No URL configured' };
    _set('syncing');
    try {
      const res = await fetch(url + '?action=getDatabase', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Server error');

      const remote = json.data || {};
      const remoteItems = remote.items || {};
      const remoteLists = remote.lists || [];

      // If sheet is empty, don't wipe local data
      if (!Object.keys(remoteItems).length && !remoteLists.length) {
        _set('synced');
        return { ok: true };
      }

      // Merge: remote is the base, local wins for any key that exists in both
      const local = JSON.parse(window.Store.exportJSON());
      const mergedItems = Object.assign({}, remoteItems, local.items || {});
      const remoteListIds = new Set(remoteLists.map(l => l.id));
      const mergedLists = [
        ...remoteLists.filter(l => !(local.lists || []).some(ll => ll.id === l.id)),
        ...(local.lists || []),
      ];
      const merged = {
        settings: Object.assign({}, remote.settings || {}, local.settings || {}),
        lists: mergedLists,
        items: mergedItems,
        recent: local.recent && local.recent.length ? local.recent : (remote.recent || []),
      };
      window.Store.importJSON(JSON.stringify(merged));
      _set('synced');
      return { ok: true };
    } catch (e) {
      _set('failed');
      return { ok: false, error: e.message || 'Network error' };
    }
  }

  async function push() {
    const url = gasUrl();
    if (!url) return { ok: false, error: 'No URL configured' };
    _set('syncing');
    try {
      const data = JSON.parse(window.Store.exportJSON());
      const slimData = Object.assign({}, data, {
        items: Object.fromEntries(
          Object.entries(data.items || {}).map(([k, it]) => {
            const { overview, backdrop, ...rest } = it;
            return [k, rest];
          })
        )
      });
      const payload = encodeURIComponent(JSON.stringify({ action: 'saveDatabase', data: slimData }));
      if (payload.length > 7500) {
        throw new Error('Payload too large for GAS URL (' + payload.length + ' chars)');
      }
      const res = await fetch(url + '?payload=' + payload, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Server error');
      _set('synced');
      return { ok: true };
    } catch (e) {
      _set('failed');
      return { ok: false, error: e.message || 'Network error' };
    }
  }

  // ── auto-push ──────────────────────────────────────────────────────────────

  let _autoPushTimer = null;

  function scheduleAutoPush() {
    if (!gasUrl()) return;
    clearTimeout(_autoPushTimer);
    _autoPushTimer = setTimeout(() => { push(); }, 2000);
  }

  // Hook into Store once it's available (Store loads before this script).
  if (window.Store && window.Store.subscribe) {
    window.Store.subscribe(scheduleAutoPush);
  }

  window.SheetsSync = {
    getStatus, getStatusLabel, getStatusDotColor,
    onStatusChange,
    testConnection, pull, push,
  };
})();
