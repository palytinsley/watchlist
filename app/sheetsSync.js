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

      // Preserve device-local settings that should never be overwritten by a pull
      const localGasUrl = window.Store.getSettings().gasUrl;
      window.Store.importJSON(JSON.stringify(json.data));
      if (localGasUrl) window.Store.setSetting('gasUrl', localGasUrl);

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
      // GAS POST redirects strip CORS headers, so use no-cors (fire-and-forget).
      // We verify success with a follow-up GET and compare updatedAt timestamps.
      const sentAt = Date.now();
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'saveDatabase', data }),
      });
      // Confirm the write landed by reading back updatedAt from the sheet.
      const check = await fetch(url + '?action=getDatabase', { cache: 'no-store' });
      if (!check.ok) throw new Error('HTTP ' + check.status);
      const json = await check.json();
      if (!json.ok) throw new Error(json.error || 'Server error');
      if (!json.data || json.data.updatedAt < sentAt - 30000) {
        throw new Error('Save may not have landed — try again');
      }
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
