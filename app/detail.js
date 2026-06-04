// detail.js — window.Views: detail, seasons/episodes, add-to-list sheet,
// watched log, stats, item context menu. Relies on App, UI, Store, TMDB.
(function () {
  'use strict';
  const U = window.UI, S = window.Store, T = window.TMDB;
  const App = () => window.App;

  // ── open detail (push + lazy fetch) ──────────────────────────────────────
  function openDetail(key) {
    App().push({ type: 'detail', key });
  }

  function baseInfo(key) {
    return S.getItem(key) || App().searchCache[key] || null;
  }

  function renderDetail(view) {
    const key = view.key;
    const stored = S.getItem(key);
    const det = App().detailCache[key];
    const base = stored || App().searchCache[key] || {};
    const title = base.title || 'Loading…';
    const backdrop = (det && det.backdrop) || base.backdrop;
    const poster = (det && det.poster) || base.poster;
    const type = base.type;

    const metaLine = det
      ? [det.year, type === 'tv'
          ? (det.seasonsCount ? det.seasonsCount + (det.seasonsCount > 1 ? ' seasons' : ' season') : 'TV')
          : U.formatRuntime(det.runtime),
         (det.genres || []).slice(0, 2).join(', ')].filter(Boolean).join(' · ')
      : [base.year, U.typeLabel(type)].filter(Boolean).join(' · ');

    const ratingHTML = (det && det.rating) || base.rating
      ? `<span class="detail__rating">${U.ti('star-filled')} ${(det && det.rating) || base.rating}</span>` : '';

    const trailerBtn = det && det.trailer
      ? `<button class="btn btn--primary btn--sm detail__trailerbtn" data-action="play-trailer" data-key="${key}">${U.ti('player-play-filled')} Trailer</button>`
      : '';

    return `
      <div class="view view--push">
        <div class="detail__backdrop">
          ${backdrop ? `<img src="${T.backdrop(backdrop, 'w780')}" alt="">` : ''}
          <div class="detail__nav">
            <button class="iconbtn" data-action="back">${U.ti('chevron-left')}</button>
            <div class="detail__navgroup">
              <button class="iconbtn" data-action="add-open" data-key="${key}">${U.ti(stored && stored.lists.length ? 'bookmark-filled' : 'bookmark')}</button>
            </div>
          </div>
          ${trailerBtn}
        </div>

        <div class="detail__head">
          <div class="detail__poster">${U.posterImg(poster, title, 'w342')}</div>
          <div class="detail__heading">
            <div class="detail__title">${U.esc(title)}</div>
            <div class="detail__meta">${U.esc(metaLine)} ${ratingHTML ? '· ' + ratingHTML : ''}</div>
          </div>
        </div>

        <div class="detail__body">
          ${statusSeg(key, stored)}
          ${watchedBlock(key, stored, type)}
          <div id="detail-rest">${det ? detailRest(key, stored, det) : restSkeleton()}</div>
        </div>
        <div style="height:20px"></div>
      </div>`;
  }

  function statusSeg(key, stored) {
    const cur = stored && stored.status;
    const btn = (s, icon, label) => `<button data-s="${s}" data-on="${cur === s}" data-action="set-status" data-key="${key}" data-status="${s}">${U.ti(icon)} ${label}</button>`;
    return `<div class="statusseg">
      ${btn('want', 'bookmark', 'Want')}
      ${btn('watching', 'player-play-filled', 'Watching')}
      ${btn('watched', 'check', 'Watched')}
    </div>`;
  }

  function watchedBlock(key, stored, type) {
    if (!stored || stored.status !== 'watched') return '';
    const date = stored.watchedDate;
    const rating = stored.userRating || 0;
    const stars = Array.from({ length: 5 }, (_, i) =>
      `<span class="star ${i < rating ? 'on' : ''}" data-action="rate" data-key="${key}" data-n="${i + 1}">${U.ti('star-filled')}</span>`).join('');
    return `
      <div class="watchedbar">
        <div class="watchedbar__left">Watched <b data-action="edit-date" data-key="${key}" style="cursor:pointer;border-bottom:1px dashed var(--text-faint)">${date ? U.prettyDate(date) : 'set date'}</b></div>
        <div class="stars">${stars}</div>
      </div>`;
  }

  function restSkeleton() {
    return `<div style="margin-top:18px"><div class="sk" style="height:14px;width:80%;border-radius:6px"></div>
      <div class="sk" style="height:14px;width:95%;border-radius:6px;margin-top:8px"></div>
      <div class="sk" style="height:14px;width:70%;border-radius:6px;margin-top:8px"></div></div>`;
  }

  function detailRest(key, stored, det) {
    let html = '';

    // overview
    if (det.overview) {
      html += `<div class="detail__overview clamp" id="ov-${key}">${U.esc(det.overview)}</div>
        <span class="detail__more" data-action="toggle-overview" data-key="${key}">Read more</span>`;
    }

    // facts
    const facts = [];
    if (det.crewName) facts.push(`${det.crewLabel}: ${det.crewName}`);
    if (det.type === 'movie' && det.runtime) facts.push(U.formatRuntime(det.runtime));
    if (det.type === 'tv' && det.episodesCount) facts.push(det.episodesCount + ' episodes');
    if (det.type === 'tv' && det.status) facts.push(det.status);
    if (facts.length) html += `<div class="facts">${facts.map(f => `<span class="fact">${U.esc(f)}</span>`).join('')}</div>`;

    // in lists
    if (stored && stored.lists.length) {
      const chips = stored.lists.map(id => S.getList(id)).filter(Boolean)
        .map(l => `<span class="listchip"><span class="listchip__dot" style="background:${l.color}"></span>${U.esc(l.name)}</span>`).join('');
      html += `<div class="label" style="padding:0;margin:20px 0 8px">In your lists</div><div class="detail__inlists">${chips}<button class="btn btn--sm btn--dashed" data-action="add-open" data-key="${key}">${U.ti('plus')} List</button></div>`;
    }

    // seasons (tv)
    if (det.type === 'tv' && det.seasons && det.seasons.length) {
      const totalEps = det.episodesCount || det.seasons.reduce((a, s) => a + s.episodeCount, 0);
      const watched = stored ? U.tvWatchedCount(stored) : 0;
      html += `<div class="label" style="padding:0;margin:22px 0 4px;display:flex;justify-content:space-between"><span>Seasons</span><span style="text-transform:none;letter-spacing:0;color:var(--text-dim)">${watched} / ${totalEps} episodes</span></div>`;
      html += `<div class="seasons">${det.seasons.map(s => seasonRow(key, stored, s)).join('')}</div>`;
    }

    // cast
    if (det.cast && det.cast.length) {
      html += `<div class="label" style="padding:0;margin:22px 0 10px">Cast</div>
        <div class="cast">${det.cast.map(c => `
          <div class="castmember">
            <div class="castmember__img">${c.profile ? `<img src="${T.profile(c.profile)}" alt="" loading="lazy">` : U.ti('user')}</div>
            <div class="castmember__name">${U.esc(c.name)}</div>
            <div class="castmember__role">${U.esc(c.character || '')}</div>
          </div>`).join('')}</div>`;
    }

    return html;
  }

  function seasonRow(key, stored, s) {
    const prog = stored ? S.seasonProgress(stored, s.number) : { watched: 0, total: 0 };
    const total = s.episodeCount;
    const watched = prog.watched;
    const full = total > 0 && watched >= total;
    const partial = watched > 0 && !full;
    const upcoming = total === 0;
    const pips = total > 0 && total <= 14
      ? `<div class="season__pips">${Array.from({ length: total }, (_, i) => `<span class="pip" data-on="${i < watched}"></span>`).join('')}</div>`
      : (total > 14 ? `<div class="season__sub">${watched}/${total}</div>` : '');
    return `
      <div class="season" data-done="${full}" data-upcoming="${upcoming}" data-action="open-season" data-key="${key}" data-season="${s.number}" data-total="${total}">
        <div class="season__check" data-on="${full}" data-partial="${partial}" data-action="toggle-season" data-key="${key}" data-season="${s.number}" data-total="${total}" data-full="${full}">
          ${full ? U.ti('check') : (partial ? U.ti('minus') : '')}
        </div>
        <div class="season__body">
          <div class="season__name">${U.esc(s.name || 'Season ' + s.number)}${upcoming ? ' · soon' : ''}</div>
          ${!upcoming ? `<div class="season__sub">${watched} of ${total} watched</div>` : `<div class="season__sub">Not aired yet</div>`}
        </div>
        ${pips}
        ${!upcoming ? `<span class="season__chev">${U.ti('chevron-right')}</span>` : ''}
      </div>`;
  }

  // fetch details after render
  async function afterDetail(view) {
    const key = view.key;
    if (App().detailCache[key]) return;
    const base = baseInfo(key);
    if (!base) return;
    try {
      const det = await T.details(base.type, base.id);
      App().detailCache[key] = det;
      // enrich stored item if present
      if (S.getItem(key)) S.enrichItem(key, det);
      // only patch if still on this detail
      const top = App().state.stack[App().state.stack.length - 1];
      if (top && top.type === 'detail' && top.key === key) {
        const rest = document.getElementById('detail-rest');
        if (rest) rest.innerHTML = detailRest(key, S.getItem(key), det);
        // backdrop / poster may have been missing
        App().render();
      }
    } catch (e) { App().handleApiError(e); }
  }

  // ── seasons / episodes ───────────────────────────────────────────────────
  function getOrCreateItem(key) {
    let it = S.getItem(key);
    if (it) return it;
    const base = App().searchCache[key];
    const det = App().detailCache[key];
    const obj = Object.assign({}, base, det);
    it = S.addToList(obj, null); // library, no list
    return it;
  }

  async function openSeason(key, seasonNum, total) {
    const base = baseInfo(key);
    U.openSheet(`<div class="center-load"><div class="spinner"></div></div>`);
    try {
      const eps = await T.seasonEpisodes(base.id, seasonNum);
      renderEpisodeSheet(key, seasonNum, eps);
    } catch (e) { U.closeSheet(); App().handleApiError(e); }
  }

  function renderEpisodeSheet(key, seasonNum, eps) {
    const it = S.getItem(key);
    const watched = it && it.seasons[seasonNum] ? it.seasons[seasonNum].watched : [];
    const total = eps.length;
    const nextIdx = eps.findIndex(e => !watched.includes(e.number));
    const rows = eps.map((e) => {
      const on = watched.includes(e.number);
      const isNext = !on && e.number === (eps[nextIdx] && eps[nextIdx].number);
      return `
        <div class="eprow" data-next="${isNext}" data-action="ep-upto" data-key="${key}" data-season="${seasonNum}" data-ep="${e.number}" data-total="${total}">
          <div class="eprow__check" data-on="${on}" data-action="ep-toggle" data-key="${key}" data-season="${seasonNum}" data-ep="${e.number}" data-total="${total}">${on ? U.ti('check') : ''}</div>
          <div class="eprow__n">E${e.number}</div>
          <div class="eprow__t">${U.esc(e.name || 'Episode ' + e.number)}</div>
          ${isNext ? `<span class="eprow__next">next</span>` : ''}
        </div>`;
    }).join('');
    const wc = watched.length;
    const html = `
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <div class="sheet__title">Season ${seasonNum}</div>
        <div class="muted" style="font-size:13px">${wc} / ${total} watched</div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn--sm" data-action="season-all" data-key="${key}" data-season="${seasonNum}" data-total="${total}">${U.ti('checks')} Mark all</button>
        <button class="btn btn--sm" data-action="season-none" data-key="${key}" data-season="${seasonNum}" data-total="${total}">Clear</button>
      </div>
      <div class="muted" style="font-size:12px;margin-top:10px">Tap a row to mark everything up to it.</div>
      <div style="margin-top:6px">${rows}</div>`;
    U.openSheet(html);
  }

  function refreshSeasonSheetAndDetail(key, seasonNum) {
    const det = App().detailCache[key];
    const rest = document.getElementById('detail-rest');
    if (rest && det) rest.innerHTML = detailRest(key, S.getItem(key), det);
  }

  // ── add-to-list sheet ────────────────────────────────────────────────────
  function openAddSheet(key) {
    const base = baseInfo(key);
    if (!base) return;
    const stored = S.getItem(key);
    const inLists = stored ? stored.lists.slice() : [];
    const lists = S.getLists();
    const poster = (App().detailCache[key] && App().detailCache[key].poster) || base.poster;

    let listRows = lists.length ? lists.map(l => `
      <div class="lrow" data-action="toggle-add-list" data-key="${key}" data-list="${l.id}">
        <div class="lrow__check" data-on="${inLists.includes(l.id)}">${inLists.includes(l.id) ? U.ti('check') : ''}</div>
        <span class="lrow__dot" style="background:${l.color}"></span>
        <span class="lrow__name">${U.esc(l.name)}</span>
        <span class="lrow__count">${S.itemsInList(l.id).length}</span>
      </div>`).join('') : `<div class="muted" style="padding:16px 0;font-size:14px">No lists yet — create your first one.</div>`;

    const html = `
      <div style="display:flex;gap:12px;align-items:center">
        <div style="width:48px;height:72px;border-radius:7px;overflow:hidden;background:var(--surface-2);flex:0 0 auto">${U.posterImg(poster, base.title, 'w185')}</div>
        <div><div class="sheet__title" style="font-size:18px">${U.esc(base.title)}</div><div class="muted" style="font-size:12.5px;margin-top:2px">Add to which list?</div></div>
      </div>
      <div style="margin-top:14px">${listRows}</div>
      <div style="display:flex;gap:10px;margin-top:18px;align-items:center">
        <button class="btn btn--dashed" data-action="add-newlist" data-key="${key}">${U.ti('plus')} New list</button>
        <div style="flex:1"></div>
        <button class="btn btn--primary" data-action="close-sheet">Done</button>
      </div>`;
    U.openSheet(html);
  }

  // ── item context menu (long-press) ───────────────────────────────────────
  function openItemMenu(key, x, y) {
    const it = S.getItem(key);
    if (!it) return;
    const items = [
      { icon: 'player-play-filled', label: it.status === 'watching' ? 'Mark not watching' : 'Mark watching', onClick: () => { S.setStatus(key, it.status === 'watching' ? 'want' : 'watching'); App().render(); U.toast('Updated', 'check'); } },
      { icon: 'check', label: it.status === 'watched' ? 'Mark unwatched' : 'Mark watched', onClick: () => { S.setStatus(key, it.status === 'watched' ? 'want' : 'watched'); App().render(); U.toast('Updated', 'check'); } },
      { icon: 'bookmark', label: 'Add to list…', onClick: () => openAddSheet(key) },
      { icon: 'trash', label: 'Remove from library', danger: true, onClick: () => { S.removeItem(key); App().render(); U.toast('Removed', 'trash'); } },
    ];
    U.openMenu(x, y, items);
  }

  // ════════════════════════════════════════════════════════════════════════
  // ACTIVITY: LOG + STATS
  // ════════════════════════════════════════════════════════════════════════
  function renderActivity() {
    const tab = App().state.activityTab;
    return `
      <div class="view">
        <div class="topbar"><div class="topbar__title">Activity</div></div>
        <div class="segrow" style="margin-top:4px">
          <button class="chip" data-on="${tab === 'log'}" data-action="activity-tab" data-atab="log">Watched log</button>
          <button class="chip" data-on="${tab === 'stats'}" data-action="activity-tab" data-atab="stats">Stats</button>
        </div>
        <div style="margin-top:8px">${tab === 'log' ? logContent() : statsContent()}</div>
      </div>`;
  }

  function logContent() {
    const entries = S.watchedLog();
    if (!entries.length) {
      return `<div class="empty"><div class="empty__art">${U.ti('history')}</div><div class="empty__title">Nothing logged yet</div><div class="empty__text">Mark something as watched and it'll show up here with the date and your rating.</div></div>`;
    }
    // group by month
    const groups = {};
    entries.forEach(it => { const m = it.watchedDate.slice(0, 7); (groups[m] = groups[m] || []).push(it); });
    const keys = Object.keys(groups).sort().reverse();
    return keys.map(m => {
      const rows = groups[m].map(it => {
        const stars = it.userRating ? `${'★'.repeat(it.userRating)}${'<span style="color:var(--surface-3)">' + '★'.repeat(5 - it.userRating) + '</span>'}` : '';
        return `
          <div class="logrow">
            <div class="logrow__date"><div class="logrow__d">${U.dayNum(it.watchedDate)}</div></div>
            <div class="logrow__poster" data-action="open-detail" data-key="${it.key}">${U.posterImg(it.poster, it.title, 'w185')}</div>
            <div class="logrow__body" data-action="open-detail" data-key="${it.key}">
              <div class="logrow__title">${U.esc(it.title)}</div>
              <div class="logrow__sub">${U.typeLabel(it.type)}${it.type === 'movie' && it.runtime ? ' · ' + U.formatRuntime(it.runtime) : ''}</div>
            </div>
            <div style="font-size:12px;letter-spacing:0.5px;color:var(--star)">${stars}</div>
          </div>`;
      }).join('');
      return `<div class="logmonth">${U.monthLabel(m + '-01')}</div>${rows}`;
    }).join('');
  }

  function statsContent() {
    const st = S.stats();
    if (!st.total) {
      return `<div class="empty"><div class="empty__art">${U.ti('chart-histogram')}</div><div class="empty__title">No stats yet</div><div class="empty__text">As you mark things watched, your screen time, genres and monthly rhythm build up here.</div></div>`;
    }
    const filmsPct = st.total ? Math.round((st.films / (st.films + st.shows)) * 100) : 50;
    const tvPct = 100 - filmsPct;
    const maxG = st.topGenres.length ? st.topGenres[0][1] : 1;

    return `
      <div class="statgrid">
        <div class="statcard statcard--hl"><div class="statcard__n">${st.total}</div><div class="statcard__l">watched</div></div>
        <div class="statcard"><div class="statcard__n">${st.hours}h</div><div class="statcard__l">screen time</div></div>
        <div class="statcard"><div class="statcard__n">${st.thisMonth}</div><div class="statcard__l">this month</div></div>
      </div>

      ${(st.films + st.shows) ? `
      <div class="label">Films vs shows</div>
      <div class="split">
        ${st.films ? `<div class="split__films" style="width:${filmsPct}%">${st.films} film${st.films !== 1 ? 's' : ''}</div>` : ''}
        ${st.shows ? `<div class="split__tv" style="width:${tvPct}%">${st.shows} TV</div>` : ''}
      </div>` : ''}

      <div class="label">Watched per month</div>
      <div class="bars" id="stat-bars">
        ${st.months.map(m => `<div class="bar" data-h="${Math.round((m.count / st.maxMonth) * 100)}" data-hl="${m.count === st.maxMonth && m.count > 0}" style="height:3px" title="${m.label}: ${m.count}"></div>`).join('')}
      </div>
      <div class="barlabels">${st.months.map(m => `<span>${m.label[0]}</span>`).join('')}</div>

      ${st.topGenres.length ? `
      <div class="label">Top genres</div>
      ${st.topGenres.map(([g, n], i) => `
        <div class="genrebar">
          <span class="genrebar__name">${U.esc(g)}</span>
          <div class="genrebar__track"><div class="genrebar__fill" data-hl="${i === 0}" style="width:${Math.round((n / maxG) * 100)}%"></div></div>
          <span class="genrebar__n">${n}</span>
        </div>`).join('')}` : ''}
      <div style="height:14px"></div>`;
  }

  function afterStats() {
    requestAnimationFrame(() => {
      document.querySelectorAll('#stat-bars .bar').forEach(b => {
        const h = b.dataset.h; b.style.height = Math.max(3, h) + '%';
      });
    });
  }

  // ── detail-specific action handler (called by app.js fallthrough) ─────────
  function handleAction(a, D, t, e) {
    switch (a) {
      case 'set-status': {
        getOrCreateItem(D.key);
        S.setStatus(D.key, D.status);
        App().render();
        U.toast(U.STATUS[D.status].label, U.STATUS[D.status].icon);
        break;
      }
      case 'rate': S.setUserRating(D.key, +D.n); App().render(); break;
      case 'edit-date': editWatchedDate(D.key); break;
      case 'toggle-overview': {
        const ov = document.getElementById('ov-' + D.key);
        if (ov) { ov.classList.toggle('clamp'); t.textContent = ov.classList.contains('clamp') ? 'Read more' : 'Read less'; }
        break;
      }
      case 'play-trailer': { const det = App().detailCache[D.key]; if (det && det.trailer) U.openTrailer(det.trailer.key, det.trailer.name); break; }
      case 'open-season': openSeason(D.key, +D.season, +D.total); break;
      case 'toggle-season': {
        e.stopPropagation();
        getOrCreateItem(D.key);
        S.setSeasonWatched(D.key, +D.season, +D.total, D.full !== 'true');
        refreshSeasonSheetAndDetail(D.key); App().render();
        break;
      }
      case 'ep-toggle': {
        e.stopPropagation();
        getOrCreateItem(D.key);
        S.toggleEpisode(D.key, +D.season, +D.ep, +D.total);
        reopenSeason(D.key, +D.season); break;
      }
      case 'ep-upto': {
        getOrCreateItem(D.key);
        S.markUpToEpisode(D.key, +D.season, +D.ep, +D.total);
        reopenSeason(D.key, +D.season); break;
      }
      case 'season-all': getOrCreateItem(D.key); S.setSeasonWatched(D.key, +D.season, +D.total, true); reopenSeason(D.key, +D.season); break;
      case 'season-none': S.setSeasonWatched(D.key, +D.season, +D.total, false); reopenSeason(D.key, +D.season); break;
      case 'toggle-add-list': {
        const it = getOrCreateItem(D.key);
        S.toggleItemList(D.key, D.list);
        const row = t.closest('.lrow'); const chk = row.querySelector('.lrow__check');
        const on = S.getItem(D.key).lists.includes(D.list);
        chk.setAttribute('data-on', on); chk.innerHTML = on ? U.ti('check') : '';
        break;
      }
      case 'add-newlist': U.closeSheet(); App().push({ type: 'newlist', returnAdd: D.key }); break;
      case 'activity-tab': App().state.activityTab = D.atab; App().render(); break;
      default: break;
    }
  }

  async function reopenSeason(key, seasonNum) {
    const base = baseInfo(key);
    try { const eps = await T.seasonEpisodes(base.id, seasonNum); renderEpisodeSheet(key, seasonNum, eps); }
    catch (e) {}
    refreshSeasonSheetAndDetail(key);
  }

  function editWatchedDate(key) {
    const it = S.getItem(key);
    const input = document.createElement('input');
    input.type = 'date';
    input.value = it.watchedDate || new Date().toISOString().slice(0, 10);
    input.max = new Date().toISOString().slice(0, 10);
    input.style.position = 'fixed'; input.style.opacity = '0'; input.style.left = '-100px';
    document.body.appendChild(input);
    input.addEventListener('change', () => { S.setWatchedDate(key, input.value); App().render(); input.remove(); });
    input.addEventListener('blur', () => setTimeout(() => input.remove(), 300));
    input.focus(); input.click();
    if (input.showPicker) try { input.showPicker(); } catch (e) {}
  }

  window.Views = {
    openDetail, renderDetail, afterDetail,
    openAddSheet, openItemMenu,
    renderActivity, renderLogFull: renderActivity, afterStats,
    handleAction,
  };
})();
