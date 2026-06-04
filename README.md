# Watchlist

Personal movie and TV watchlist app. Runs as a static site on GitHub Pages. Uses `localStorage` as primary storage with optional Google Sheets sync via a Google Apps Script backend.

---

## Quick start (local)

Open `Movie Watchlist.html` directly in a browser. No build step needed.

---

## Google Sheets sync setup

### 1. Create the Apps Script project

**Option A — Container-bound (inside the spreadsheet):**
1. Open the spreadsheet in Google Sheets.
2. Go to **Extensions → Apps Script**.
3. Replace any existing code with the contents of `gas/Code.gs`.
4. Set the `appsscript.json` manifest: go to **Project Settings → Show "appsscript.json"**, then paste the contents of `gas/appsscript.json`.

**Option B — Standalone project (via clasp):**
1. Run `npm install -g @google/clasp` if not installed.
2. Run `clasp login` to authenticate.
3. `cd gas` then run `clasp create --type standalone --title "Watchlist Sync"`.
4. Copy the printed Script ID into `gas/.clasp.json`.
5. Run `clasp push` to upload `Code.gs` and `appsscript.json`.

### 2. Deploy as a web app

1. In the Apps Script editor, click **Deploy → New deployment**.
2. Choose type: **Web app**.
3. Set **Execute as**: Me.
4. Set **Who has access**: Anyone (no sign-in required).
5. Click **Deploy** and copy the web app URL.

> The URL looks like: `https://script.google.com/macros/s/AKfy.../exec`

### 3. Paste the URL into the app

1. Open the Watchlist app.
2. Go to **Settings → Google Sheets → Set web app URL**.
3. Paste the URL and tap **Test** to verify the connection.
4. Tap **Save URL**.

### 4. Spreadsheet tabs created automatically

When the backend first runs it creates these tabs if they don't exist:

| Tab | Columns |
|-----|---------|
| `Settings` | `key`, `value` |
| `Lists` | `id`, `name`, `color`, `note`, `createdAt`, `order` |
| `Items` | `key`, `type`, `id`, `title`, `year`, `poster`, `backdrop`, `rating`, `overview`, `genresJson`, `runtime`, `seasonsCount`, `episodesCount`, `episodeRunTime`, `addedAt`, `status`, `watchedDate`, `userRating`, `listsJson`, `seasonsJson` |
| `Recent` | `query`, `addedAt` |
| `Activity` | `id`, `itemKey`, `action`, `valueJson`, `createdAt` |

Row 1 headers are stable — do not rename them.

---

## Sync behavior

- The app always loads from `localStorage` immediately on start.
- If a web app URL is saved, the app does a background pull on startup.
- **Pull from Google Sheets** — fetches all data from the spreadsheet and replaces local state (last-write-wins).
- **Push local data to Sheets** — sends the current local state to the spreadsheet.
- The web app URL is device-local and is never written to the spreadsheet.
- Sync status shows in **Settings**: *Local only / Syncing… / Synced / Sync failed*.

---

## GitHub Pages deployment

1. Push to the `master` branch of your GitHub repo.
2. In repo **Settings → Pages**, set source to `master` branch, root `/`.
3. The `.nojekyll` file at the repo root ensures GitHub Pages does not run Jekyll.

---

## TMDB API key

A demo key is bundled so the app works out of the box. To use your own quota, add a free v3 API key from [themoviedb.org](https://www.themoviedb.org/settings/api) in **Settings → TMDB API → Add your own key**.
