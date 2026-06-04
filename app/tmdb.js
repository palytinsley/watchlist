// tmdb.js — TMDB v3 client. Attaches window.TMDB.
// No build system, no modules. Plain global namespace.
(function () {
  'use strict';

  // User-provided key, preloaded for convenience. Overridable in Settings.
  const DEFAULT_API_KEY = '099e25725348f759ebde8fc8a15b809e';

  const BASE = 'https://api.themoviedb.org/3';
  const IMG = 'https://image.tmdb.org/t/p';

  // image helpers ----------------------------------------------------------
  function poster(path, size) {
    if (!path) return null;
    return `${IMG}/${size || 'w342'}${path}`;
  }
  function backdrop(path, size) {
    if (!path) return null;
    return `${IMG}/${size || 'w780'}${path}`;
  }
  function profile(path, size) {
    if (!path) return null;
    return `${IMG}/${size || 'w185'}${path}`;
  }

  function key() {
    try {
      const s = JSON.parse(localStorage.getItem('wl.v1') || '{}');
      return (s.settings && s.settings.apiKey) || DEFAULT_API_KEY;
    } catch (e) { return DEFAULT_API_KEY; }
  }

  async function get(path, params) {
    const url = new URL(BASE + path);
    url.searchParams.set('api_key', key());
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    });
    const res = await fetch(url.toString());
    if (!res.ok) {
      const err = new Error('TMDB ' + res.status);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  // Verify a key works (used by Settings "test").
  async function testKey(testApiKey) {
    const url = new URL(BASE + '/configuration');
    url.searchParams.set('api_key', testApiKey);
    const res = await fetch(url.toString());
    return res.ok;
  }

  // search (movies + tv only) ---------------------------------------------
  async function searchMulti(query) {
    if (!query || !query.trim()) return [];
    const data = await get('/search/multi', { query: query.trim(), include_adult: false, page: 1 });
    return (data.results || [])
      .filter(r => r.media_type === 'movie' || r.media_type === 'tv')
      .map(normalizeSearch);
  }

  async function trending() {
    const data = await get('/trending/all/week', {});
    return (data.results || [])
      .filter(r => r.media_type === 'movie' || r.media_type === 'tv')
      .map(normalizeSearch);
  }

  function normalizeSearch(r) {
    const type = r.media_type;
    const title = r.title || r.name || 'Untitled';
    const dateStr = r.release_date || r.first_air_date || '';
    const year = dateStr ? dateStr.slice(0, 4) : '';
    return {
      key: type + ':' + r.id,
      type, id: r.id, title, year,
      poster: r.poster_path || null,
      backdrop: r.backdrop_path || null,
      rating: r.vote_average ? Math.round(r.vote_average * 10) / 10 : null,
      overview: r.overview || '',
    };
  }

  // full details ----------------------------------------------------------
  async function details(type, id) {
    const data = await get(`/${type}/${id}`, { append_to_response: 'videos,credits' });
    const title = data.title || data.name || 'Untitled';
    const dateStr = data.release_date || data.first_air_date || '';
    const year = dateStr ? dateStr.slice(0, 4) : '';
    const genres = (data.genres || []).map(g => g.name);
    const cast = (data.credits && data.credits.cast || []).slice(0, 12).map(c => ({
      name: c.name, character: c.character, profile: c.profile_path || null,
    }));

    let crewLabel = '', crewName = '';
    if (type === 'movie') {
      const dir = (data.credits && data.credits.crew || []).find(c => c.job === 'Director');
      if (dir) { crewLabel = 'Director'; crewName = dir.name; }
    } else {
      const creator = (data.created_by || [])[0];
      if (creator) { crewLabel = 'Creator'; crewName = creator.name; }
    }

    // seasons (exclude season 0 specials by default but keep if it's the only one)
    let seasons = [];
    if (type === 'tv' && data.seasons) {
      seasons = data.seasons
        .filter(s => s.season_number > 0)
        .map(s => ({
          number: s.season_number,
          name: s.name,
          episodeCount: s.episode_count || 0,
          air: s.air_date || null,
          poster: s.poster_path || null,
        }));
    }

    return {
      key: type + ':' + id,
      type, id, title, year, genres,
      poster: data.poster_path || null,
      backdrop: data.backdrop_path || null,
      rating: data.vote_average ? Math.round(data.vote_average * 10) / 10 : null,
      overview: data.overview || '',
      runtime: type === 'movie' ? (data.runtime || null) : null,
      episodeRunTime: (data.episode_run_time || [])[0] || null,
      seasonsCount: type === 'tv' ? (data.number_of_seasons || seasons.length) : null,
      episodesCount: type === 'tv' ? (data.number_of_episodes || null) : null,
      status: data.status || null, // e.g. "Returning Series", "Ended"
      seasons,
      crewLabel, crewName,
      cast,
      trailer: pickTrailer(data.videos && data.videos.results),
      tagline: data.tagline || '',
    };
  }

  async function seasonEpisodes(tvId, seasonNumber) {
    const data = await get(`/tv/${tvId}/season/${seasonNumber}`, {});
    return (data.episodes || []).map(e => ({
      number: e.episode_number,
      name: e.name,
      overview: e.overview || '',
      air: e.air_date || null,
      runtime: e.runtime || null,
      still: e.still_path || null,
    }));
  }

  function pickTrailer(videos) {
    if (!videos || !videos.length) return null;
    const yt = videos.filter(v => v.site === 'YouTube');
    const score = v => {
      let s = 0;
      if (v.type === 'Trailer') s += 4;
      else if (v.type === 'Teaser') s += 2;
      if (v.official) s += 1;
      return s;
    };
    yt.sort((a, b) => score(b) - score(a));
    return yt.length ? { key: yt[0].key, name: yt[0].name } : null;
  }

  window.TMDB = {
    DEFAULT_API_KEY,
    poster, backdrop, profile,
    searchMulti, trending, details, seasonEpisodes, testKey,
  };
})();
