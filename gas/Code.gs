// Code.gs — Watchlist Google Apps Script backend.
// Reads and writes watchlist data to/from a Google Sheet.
// Deploy as a web app: Execute as "Me", Access "Anyone".

const SS_ID = '1T465xS6I2eYX00eHcv1N2aHAusdFFPq77fqpxp0oDVc';

const HEADERS = {
  Settings: ['key', 'value'],
  Lists:    ['id', 'name', 'color', 'note', 'createdAt', 'order'],
  Items: [
    'key', 'type', 'id', 'title', 'year', 'poster', 'backdrop', 'rating',
    'overview', 'genresJson', 'runtime', 'seasonsCount', 'episodesCount',
    'episodeRunTime', 'addedAt', 'status', 'watchedDate', 'userRating',
    'listsJson', 'seasonsJson',
  ],
  Recent:   ['query', 'addedAt'],
  Activity: ['id', 'itemKey', 'action', 'valueJson', 'createdAt'],
};

// ── HTTP handlers ──────────────────────────────────────────────────────────

function doGet(e) {
  try {
    const payload = e && e.parameter && e.parameter.payload;
    if (payload) {
      // Requires redeployment after any change to this file
      const lock = LockService.scriptLock();
      lock.waitLock(15000);
      try {
        const parsed = JSON.parse(decodeURIComponent(payload));
        if (parsed.action === 'saveDatabase') {
          writeDatabase(parsed.data);
          return respond({ ok: true });
        }
        return respond({ ok: false, error: 'Unknown action: ' + parsed.action });
      } finally {
        lock.releaseLock();
      }
    }
    const action = (e && e.parameter && e.parameter.action) || 'getDatabase';
    if (action === 'getDatabase') return respond({ ok: true, data: readDatabase() });
    return respond({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return respond({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  const lock = LockService.scriptLock();
  lock.waitLock(15000);
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    if (action === 'saveDatabase') {
      writeDatabase(payload.data);
      return respond({ ok: true });
    }
    return respond({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return respond({ ok: false, error: String(err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Sheet helpers ──────────────────────────────────────────────────────────

function getOrCreateSheet(ss, name) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]);
  }
  return sh;
}

function sheetToObjects(sh, name) {
  const headers = HEADERS[name];
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const data = sh.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return data.map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

function clearDataRows(sh) {
  const lastRow = sh.getLastRow();
  if (lastRow >= 2) sh.deleteRows(2, lastRow - 1);
}

// ── READ ───────────────────────────────────────────────────────────────────

function readDatabase() {
  const ss = SpreadsheetApp.openById(SS_ID);
  Object.keys(HEADERS).forEach(name => getOrCreateSheet(ss, name));
  return {
    settings: readSettings(ss),
    lists:    readLists(ss),
    items:    readItems(ss),
    recent:   readRecent(ss),
    updatedAt: Date.now(),
  };
}

function readSettings(ss) {
  const sh = getOrCreateSheet(ss, 'Settings');
  const obj = {};
  sheetToObjects(sh, 'Settings').forEach(r => {
    if (r.key) obj[String(r.key)] = r.value;
  });
  return obj;
}

function readLists(ss) {
  const sh = getOrCreateSheet(ss, 'Lists');
  return sheetToObjects(sh, 'Lists')
    .filter(r => r.id)
    .map(r => ({
      id:        String(r.id),
      name:      String(r.name || ''),
      color:     String(r.color || '#4a6bd6'),
      note:      String(r.note || ''),
      createdAt: Number(r.createdAt) || 0,
      order:     Number(r.order) || 0,
    }));
}

function readItems(ss) {
  const sh = getOrCreateSheet(ss, 'Items');
  const items = {};
  sheetToObjects(sh, 'Items')
    .filter(r => r.key)
    .forEach(r => {
      let genres = []; try { genres = JSON.parse(String(r.genresJson) || '[]'); } catch (e) {}
      let lists  = []; try { lists  = JSON.parse(String(r.listsJson)  || '[]'); } catch (e) {}
      let seasons = {}; try { seasons = JSON.parse(String(r.seasonsJson) || '{}'); } catch (e) {}

      const key = String(r.key);
      items[key] = {
        key,
        type:          String(r.type || 'movie'),
        id:            Number(r.id)  || 0,
        title:         String(r.title || ''),
        year:          String(r.year || ''),
        poster:        r.poster   !== '' ? String(r.poster)   : null,
        backdrop:      r.backdrop !== '' ? String(r.backdrop) : null,
        rating:        (r.rating !== '' && r.rating != null) ? Number(r.rating) : null,
        overview:      String(r.overview || ''),
        genres,
        runtime:       (r.runtime      !== '' && r.runtime      != null) ? Number(r.runtime)      : null,
        seasonsCount:  (r.seasonsCount  !== '' && r.seasonsCount  != null) ? Number(r.seasonsCount)  : null,
        episodesCount: (r.episodesCount !== '' && r.episodesCount != null) ? Number(r.episodesCount) : null,
        episodeRunTime:(r.episodeRunTime!== '' && r.episodeRunTime!= null) ? Number(r.episodeRunTime): null,
        addedAt:       Number(r.addedAt) || 0,
        status:        String(r.status || 'want'),
        watchedDate:   (r.watchedDate !== '' && r.watchedDate != null) ? String(r.watchedDate) : null,
        userRating:    Number(r.userRating) || 0,
        lists,
        seasons,
      };
    });
  return items;
}

function readRecent(ss) {
  const sh = getOrCreateSheet(ss, 'Recent');
  return sheetToObjects(sh, 'Recent')
    .filter(r => r.query)
    .map(r => String(r.query));
}

// ── WRITE ──────────────────────────────────────────────────────────────────

function writeDatabase(data) {
  const ss = SpreadsheetApp.openById(SS_ID);
  if (data.settings) writeSettings(ss, data.settings);
  if (data.lists)    writeLists(ss, data.lists);
  if (data.items)    writeItems(ss, data.items);
  if (Array.isArray(data.recent)) writeRecent(ss, data.recent);
}

function writeSettings(ss, settings) {
  const sh = getOrCreateSheet(ss, 'Settings');
  clearDataRows(sh);
  // gasUrl is device-local — never sync it to the spreadsheet
  const rows = Object.entries(settings)
    .filter(([k]) => k !== 'gasUrl')
    .map(([k, v]) => [k, v == null ? '' : v]);
  if (rows.length) sh.getRange(2, 1, rows.length, 2).setValues(rows);
}

function writeLists(ss, lists) {
  const sh = getOrCreateSheet(ss, 'Lists');
  clearDataRows(sh);
  if (!lists.length) return;
  const rows = lists.map(l => [
    l.id, l.name || '', l.color || '', l.note || '',
    l.createdAt || 0, l.order || 0,
  ]);
  sh.getRange(2, 1, rows.length, HEADERS.Lists.length).setValues(rows);
}

function writeItems(ss, items) {
  const sh = getOrCreateSheet(ss, 'Items');
  clearDataRows(sh);
  const vals = Object.values(items);
  if (!vals.length) return;
  const rows = vals.map(it => [
    it.key,    it.type,  it.id,    it.title, it.year,
    it.poster   || '', it.backdrop || '',
    it.rating   != null ? it.rating   : '',
    it.overview || '',
    JSON.stringify(it.genres  || []),
    it.runtime      != null ? it.runtime      : '',
    it.seasonsCount  != null ? it.seasonsCount  : '',
    it.episodesCount != null ? it.episodesCount : '',
    it.episodeRunTime!= null ? it.episodeRunTime: '',
    it.addedAt   || '',
    it.status    || 'want',
    it.watchedDate || '',
    it.userRating || 0,
    JSON.stringify(it.lists   || []),
    JSON.stringify(it.seasons || {}),
  ]);
  sh.getRange(2, 1, rows.length, HEADERS.Items.length).setValues(rows);
}

function writeRecent(ss, recent) {
  const sh = getOrCreateSheet(ss, 'Recent');
  clearDataRows(sh);
  if (!recent.length) return;
  const now = Date.now();
  const rows = recent.map((q, i) => [String(q), now - i]);
  sh.getRange(2, 1, rows.length, 2).setValues(rows);
}
