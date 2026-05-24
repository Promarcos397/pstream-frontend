import { useMemo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MICRO_GENRES, DAY_STREAMS,
  GENRES,
  TIME_STREAMS, SEASON_STREAMS, HOLIDAY_STREAMS, ADJACENT_GENRES,
} from '../data/genres';
import { Movie } from '../types';
import { useGlobalContext } from '../context/GlobalContext';
import { REQUESTS } from '../constants';
import { getWatchData } from '../components/MovieCardBadges';

// Re-export context helpers from HeroEngine so both systems share the same logic
export { getTimeSlot, getSeason, getCurrentHoliday } from '../services/HeroEngine';
import { getTimeSlot, getSeason, getCurrentHoliday } from '../services/HeroEngine';

export interface SmartRow {
  key: string;
  title: string;
  fetchUrl?: string;
  data?: Movie[];
  type?: 'standard' | 'top10';
}

// ─── Deterministic Helpers ────────────────────────────────────────────────────

const getDailyHash = (): number => {
  const day = new Date().toDateString();
  let h = 0;
  for (let i = 0; i < day.length; i++) h = (h * 31 + day.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const getDayOfWeek = (): string =>
  new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());

const seededPick = <T,>(arr: T[], n: number, seed: number): T[] => {
  if (arr.length <= n) return [...arr];
  const indices = new Set<number>();
  let s = seed;
  while (indices.size < n) {
    s = (s * 16807 + 37) % 2147483647;
    indices.add(Math.abs(s) % arr.length);
  }
  return [...indices].map(i => arr[i]);
};

// ─── URL Signature Deduplicator ───────────────────────────────────────────────
// Strips pagination (page=N) from URL sig comparison, so page=1 and page=2 of
// the same sort are considered DIFFERENT (they return different 20-item chunks).
// But two rows with identical base params + identical page → duplicate → skip.

const makeUrlSig = (url: string): string => {
  try {
    // Normalise: sort query params for stable comparison, but KEEP page=
    const [base, qs = ''] = url.split('?');
    const params = qs.split('&').filter(Boolean).sort();
    return base + '?' + params.join('&');
  } catch { return url; }
};



// ─── Genre name lookup ────────────────────────────────────────────────────────

const GENRE_NAMES: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction',
  53: 'Thriller', 10752: 'War', 37: 'Western',
  // TV genres
  10759: 'Action & Adventure', 10765: 'Sci-Fi & Fantasy', 10768: 'War & Politics',
  10764: 'Reality', 10763: 'News', 10766: 'Soap', 10767: 'Talk', 10762: 'Kids',
};

// ─── Helper: splice a Top-10 row ──────────────────────────────────────────────
const insertTop10 = (
  manifest: SmartRow[],
  key: string,
  title: string,
  fetchUrl: string,
  preferredIndex: number,
) => {
  manifest.splice(Math.min(manifest.length, preferredIndex), 0, {
    key, title, fetchUrl, type: 'top10',
  });
};

// ─── useDynamicManifest ───────────────────────────────────────────────────────
export const useDynamicManifest = (
  pageType: 'home' | 'movie' | 'tv' | 'new_popular',
  selectedGenreId?: number,
  selectedGenreName?: string,
) => {
  const { t } = useTranslation();
  const {
    continueWatching, myList, user,
    getLikedMovies, clearSeenIds,
    getVideoState, getLastWatchedEpisode,
  } = useGlobalContext();

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    clearSeenIds();
    // Premium transition delay: ensures skeleton is visible long enough to be useful
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 180);
    return () => clearTimeout(timer);
  }, [pageType, selectedGenreId, clearSeenIds]);

  const rows = useMemo<SmartRow[]>(() => {
    const manifest: SmartRow[] = [];
    const usedUrls = new Set<string>(); // URL-signature dedup registry

    const mergeGenres = (baseGenres: string, genreId?: number) => {
        if (!genreId) return baseGenres;
        const parts = baseGenres.split(',');
        if (parts.includes(genreId.toString())) return baseGenres;
        return `${baseGenres},${genreId}`;
    };

    const addRow = (row: SmartRow): boolean => {
      if (row.fetchUrl) {
        const sig = makeUrlSig(row.fetchUrl);
        if (usedUrls.has(sig)) return false;
        usedUrls.add(sig);
      }
      manifest.push(row);
      return true;
    };

    const hash    = getDailyHash();
    const day     = getDayOfWeek();
    const tod     = getTimeSlot();
    const season  = getSeason();
    const holiday = getCurrentHoliday();
    const year    = new Date().getFullYear();

    // ── 1. COMFORT ROWS ───────────────────────────────────────────────────────
    let continueWatchingRow: SmartRow | null = null;
    let myListRow: SmartRow | null = null;

    if (continueWatching.length > 0) {
      const activelyWatching = continueWatching.filter(m => {
        const wd = getWatchData(m, getLastWatchedEpisode, getVideoState);
        return wd.pct >= 1 && wd.pct < 92;
      });
      const filtered = selectedGenreId
        ? activelyWatching.filter(m => m.genre_ids?.includes(selectedGenreId))
        : activelyWatching;
      if (filtered.length > 0) {
        const title = user?.display_name
          ? t('rows.continueWatchingUser', { name: user.display_name, defaultValue: `Here's Where You Left Off, ${user.display_name}` })
          : t('rows.continueWatching', { defaultValue: "Here's Where You Left Off" });
        continueWatchingRow = { key: 'continue-watching', title, data: filtered };
      }
    }

    if (myList.length > 0) {
      let filteredList = myList;
      if (pageType === 'tv')    filteredList = myList.filter(m => m.media_type === 'tv' || (!m.media_type && !m.title));
      if (pageType === 'movie') filteredList = myList.filter(m => m.media_type === 'movie' || (!m.media_type && !!m.title));
      if (selectedGenreId)      filteredList = filteredList.filter(m => m.genre_ids?.includes(selectedGenreId));
      if (filteredList.length > 0)
        myListRow = { key: 'my-list', title: t('rows.myList', { defaultValue: 'My List' }), data: filteredList };
    }

    // ── 2. NEW & POPULAR PAGE ─────────────────────────────────────────────────
    if (pageType === 'new_popular') {
      manifest.push({ key: 'top10-movies',   title: 'Top 10 Films in the UK Today',     fetchUrl: REQUESTS.fetchTrendingMovies,  type: 'top10' });
      manifest.push({ key: 'top10-tv',       title: 'Top 10 Series in the UK Today',    fetchUrl: REQUESTS.fetchTrendingTV,      type: 'top10' });
      manifest.push({ key: 'new-releases',   title: 'Newly Added to the Collection',    fetchUrl: REQUESTS.fetchNewReleases });
      manifest.push({ key: 'worth-wait',     title: 'Worth the Wait',                   fetchUrl: REQUESTS.fetchUpcoming + '&page=2' });
      manifest.push({ key: 'rising-stars',   title: 'Rising Stars: Under the Radar',    fetchUrl: REQUESTS.fetchByGenre('movie', 28, 'vote_average.desc', '&vote_count.gte=100&vote_count.lte=1000') });
      manifest.push({ key: 'new-this-year',  title: `The Best of ${year} So Far`,        fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'vote_average.desc', `&release_date.gte=${year}-01-01&vote_count.gte=50`) });
      manifest.push({ key: 'new-tv-year',    title: `New Series Everyone Is Watching`,  fetchUrl: REQUESTS.fetchByGenre('tv', 18, 'vote_average.desc', `&first_air_date.gte=${year}-01-01&vote_count.gte=30`) });
      manifest.push({ key: 'internet-buzz',  title: "The Shows the Internet Can't Stop Talking About", fetchUrl: REQUESTS.fetchTrendingTV + '&page=2' });
      manifest.push({ key: 'films-buzz',     title: 'The Films Everyone Is Discussing', fetchUrl: REQUESTS.fetchTrendingMovies + '&page=2' });
      manifest.push({ key: 'np-upcoming',    title: 'Coming to the Collection Soon',    fetchUrl: REQUESTS.fetchUpcoming });
      manifest.push({ key: 'np-acclaimed',   title: 'New and Acclaimed',                fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'vote_average.desc', `&release_date.gte=${year - 1}-01-01&vote_count.gte=300`) });
      manifest.push({ key: 'np-series-new',  title: 'Series Picking Up Steam',          fetchUrl: REQUESTS.fetchByGenre('tv', 10765, 'popularity.desc', `&first_air_date.gte=${year - 1}-01-01`) });
      manifest.push({ key: 'np-drama-new',   title: 'New Dramas With Something to Say', fetchUrl: REQUESTS.fetchByGenre('tv', 18, 'popularity.desc', `&first_air_date.gte=${year}-01-01`) });
      manifest.push({ key: 'np-hidden',      title: 'Flying Under the Radar',           fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'vote_average.desc', '&vote_count.gte=100&vote_count.lte=800') });
      manifest.push({ key: 'np-intl',        title: 'International Discoveries',        fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'popularity.desc') + '&without_original_language=en' });
      return manifest;
    }

    // ── 3. GENRE-FILTERED VIEWS ───────────────────────────────────────────────
    if (selectedGenreId) {
      if (pageType === 'home') {
        const baseGenreName = selectedGenreName ?? GENRE_NAMES[selectedGenreId] ?? GENRES[selectedGenreId] ?? 'Content';
        if (continueWatchingRow) addRow(continueWatchingRow);
        if (myListRow) addRow(myListRow);

        addRow({
          key: `home-genre-trending-${selectedGenreId}`,
          title: `Trending ${baseGenreName} Titles`,
          fetchUrl: REQUESTS.fetchByGenre('movie', selectedGenreId, 'popularity.desc'),
          type: 'top10'
        });

        addRow({
          key: `home-genre-tv-${selectedGenreId}`,
          title: `${baseGenreName} Series`,
          fetchUrl: REQUESTS.fetchByGenre('tv', selectedGenreId, 'popularity.desc')
        });

        addRow({
          key: `home-genre-movies-${selectedGenreId}`,
          title: `${baseGenreName} Movies`,
          fetchUrl: REQUESTS.fetchByGenre('movie', selectedGenreId, 'popularity.desc')
        });

        addRow({
          key: `home-genre-acclaimed-movies-${selectedGenreId}`,
          title: `Critically Acclaimed ${baseGenreName} Movies`,
          fetchUrl: REQUESTS.fetchByGenre('movie', selectedGenreId, 'vote_average.desc') + '&vote_count.gte=1000'
        });

        addRow({
          key: `home-genre-acclaimed-tv-${selectedGenreId}`,
          title: `Critically Acclaimed ${baseGenreName} Series`,
          fetchUrl: REQUESTS.fetchByGenre('tv', selectedGenreId, 'vote_average.desc') + '&vote_count.gte=300'
        });

        return manifest;
      }

      const baseGenreName = selectedGenreName ?? GENRE_NAMES[selectedGenreId] ?? GENRES[selectedGenreId] ?? 'Content';
      const mediaType     = pageType as 'movie' | 'tv';
      const suffix = mediaType === 'tv' ? 'Series' : 'Films';
      
      let mainGenreName = baseGenreName;
      if (!mainGenreName.includes('Series') && !mainGenreName.includes('Films') && !mainGenreName.includes('Movie') && !mainGenreName.includes('TV')) {
          mainGenreName = `${baseGenreName} ${suffix}`;
      }

      // Helper: build correct TMDB date query parameter dynamically based on mediaType
      const getReleaseDateParam = (gte?: string, lte?: string) => {
        const prefix = mediaType === 'tv' ? 'first_air_date' : 'primary_release_date';
        let res = '';
        if (gte) res += `&${prefix}.gte=${gte}`;
        if (lte) res += `&${prefix}.lte=${lte}`;
        return res;
      };

      // Helper: build a row with URL-sig dedup built in
      const gRow = (key: string, title: string, sort: string, extra = ''): SmartRow | null => {
        const url = REQUESTS.fetchByGenre(mediaType, selectedGenreId, sort, extra);
        const sig = makeUrlSig(url);
        if (usedUrls.has(sig)) return null;
        usedUrls.add(sig);
        return { key, title, fetchUrl: url };
      };

      // ── Tier 1: Top-10 & Trending ──────────────────────────────────────────
      const top10GRow: SmartRow = {
        key:      `top10-genre-${selectedGenreId}`,
        title:    `Top 10 ${mainGenreName} Right Now`,
        fetchUrl: REQUESTS.fetchByGenre(mediaType, selectedGenreId, 'popularity.desc'),
        type:     'top10',
      };
      usedUrls.add(makeUrlSig(top10GRow.fetchUrl!));
      manifest.push(top10GRow);

      // Determine profile key: use special keys for specific display names
      let profileKey = String(selectedGenreId);
      if (selectedGenreId === 99) {
        if (selectedGenreName && (selectedGenreName.toLowerCase().includes('science') || selectedGenreName.toLowerCase().includes('nature'))) {
          profileKey = '99-science-nature';
        } else {
          profileKey = '99-documentaries';
        }
      } else if ((selectedGenreId === 35 || selectedGenreId === 10767) && selectedGenreName && selectedGenreName.toLowerCase().includes('stand-up')) {
        profileKey = '35-standup';
      } else if (selectedGenreId === 16 && selectedGenreName && selectedGenreName.toLowerCase().includes('anime')) {
        profileKey = '16-anime';
      }

      const getProfileRows = (): { key: string; title: string; sort: string; extra: string }[] => {
        switch (profileKey) {
          // Action & Adventure (Movie: 28 / 12, TV: 10759)
          case '28':
          case '12':
          case '10759':
            return [
              { key: 'superhero', title: 'Superhero Blockbusters', sort: 'popularity.desc', extra: '&with_keywords=9715' },
              { key: 'martial-arts', title: 'Martial Arts Spectacles', sort: 'popularity.desc', extra: '&with_keywords=3671' },
              { key: 'spy-espionage', title: 'Spy & Espionage Thrillers', sort: 'popularity.desc', extra: '&with_keywords=470' },
              { key: 'treasure-hunt', title: 'Treasure Hunts & Quests', sort: 'popularity.desc', extra: '&with_keywords=9714' },
              { key: 'survival-disaster', title: 'Adrenaline & Survival', sort: 'popularity.desc', extra: '&with_keywords=549' },
            ];
          // Animation (Movie: 16, TV: 16)
          case '16':
            return [
              { key: 'family-animation', title: 'Family Animations', sort: 'popularity.desc', extra: '&with_genres=10751' },
              { key: 'cgi-pixar', title: 'CGI & 3D Masterpieces', sort: 'popularity.desc', extra: '&with_keywords=12542' },
              { key: 'fantasy-animation', title: 'Magical & Fantasy Worlds', sort: 'popularity.desc', extra: '&with_genres=14' },
              { key: 'anime-cross', title: 'Anime Crossovers', sort: 'popularity.desc', extra: '&with_keywords=210024' },
            ];
          case '16-anime':
            return [
              { key: 'shonen', title: 'Action-Packed Shonen', sort: 'popularity.desc', extra: '&with_keywords=210024&with_genres=28' },
              { key: 'fantasy-anime', title: 'Isekai & Fantasy Anime', sort: 'popularity.desc', extra: '&with_keywords=210024&with_genres=14' },
              { key: 'drama-anime', title: 'Emotional Anime Dramas', sort: 'popularity.desc', extra: '&with_keywords=210024&with_genres=18' },
              { key: 'classic-anime', title: 'Retro & Classic Anime', sort: 'vote_count.desc', extra: '&with_keywords=210024&first_air_date.lte=2015-01-01' },
            ];
          // Comedy (Movie: 35, TV: 35)
          case '35':
            return [
              { key: 'rom-com', title: 'Romantic Comedies', sort: 'popularity.desc', extra: '&with_genres=10749' },
              { key: 'dark-comedy', title: 'Dark Comedy & Satire', sort: 'popularity.desc', extra: '&with_keywords=10224' },
              { key: 'sitcoms', title: 'Workplace & Sitcom Favorites', sort: 'popularity.desc', extra: '&with_keywords=1701' },
              { key: 'family-comedy', title: 'Dinner Table Laughs', sort: 'popularity.desc', extra: '&with_genres=10751' },
            ];
          case '35-standup':
            return [
              { key: 'standup-hits', title: 'Trending Stand-Up Specials', sort: 'popularity.desc', extra: '&with_keywords=stand-up' },
              { key: 'talk-shows', title: 'Stand-up & Chat Shows', sort: 'popularity.desc', extra: '&with_genres=10767' },
              { key: 'satire-specials', title: 'Political Satire & Shows', sort: 'popularity.desc', extra: '&with_keywords=satire' },
            ];
          // Crime (Movie: 80, TV: 80)
          case '80':
            return [
              { key: 'heist', title: 'Heist Sagas', sort: 'popularity.desc', extra: '&with_keywords=10214' },
              { key: 'mafia-mob', title: 'Mob & Organized Crime', sort: 'popularity.desc', extra: '&with_keywords=4737' },
              { key: 'detective-police', title: 'Police & Detective Procedurals', sort: 'popularity.desc', extra: '&with_keywords=1701' },
              { key: 'courtroom-legal', title: 'Courtroom & Legal Battles', sort: 'popularity.desc', extra: '&with_keywords=5691' },
              { key: 'serial-killer', title: 'Serial Killer Investigation', sort: 'popularity.desc', extra: '&with_keywords=10224' },
            ];
          // Documentary (99-documentaries vs 99-science-nature)
          case '99-documentaries':
            return [
              { key: 'true-crime-docs', title: 'True Crime Investigatives', sort: 'popularity.desc', extra: '&with_keywords=80' },
              { key: 'history-docs', title: 'History & War Documentaries', sort: 'popularity.desc', extra: '&with_genres=36' },
              { key: 'biography-docs', title: 'Biographies & Profiles', sort: 'popularity.desc', extra: '&with_keywords=237054' },
              { key: 'music-docs', title: 'Music & Culture Documentaries', sort: 'popularity.desc', extra: '&with_genres=10402' },
            ];
          case '99-science-nature':
            return [
              { key: 'wildlife-nature', title: 'Wildlife & Nature Sagas', sort: 'popularity.desc', extra: '&with_keywords=196884' },
              { key: 'space-cosmology', title: 'Space & Cosmology Exploration', sort: 'popularity.desc', extra: '&with_keywords=3801' },
              { key: 'science-tech', title: 'Science & Cutting-Edge Tech', sort: 'popularity.desc', extra: '&with_keywords=285559' },
              { key: 'earth-environment', title: 'Climate & Earth Mysteries', sort: 'popularity.desc', extra: '&with_keywords=3336' },
            ];
          // Drama (Movie: 18, TV: 18)
          case '18':
            return [
              { key: 'true-story-dramas', title: 'Based on a True Story', sort: 'popularity.desc', extra: '&with_keywords=818' },
              { key: 'coming-of-age-dramas', title: 'Coming-of-Age Journeys', sort: 'popularity.desc', extra: '&with_keywords=4565' },
              { key: 'period-costume', title: 'Period & Costume Dramas', sort: 'popularity.desc', extra: '&with_keywords=5691' },
              { key: 'romance-dramas', title: 'Romance & Heartbreak', sort: 'popularity.desc', extra: '&with_genres=10749' },
            ];
          // Kids & Family (Movie: 10751, TV: 10762)
          case '10751':
          case '10762':
            return [
              { key: 'animated-kids', title: 'Animated Classics', sort: 'popularity.desc', extra: '&with_genres=16' },
              { key: 'live-action-kids', title: 'Live-Action Family Fun', sort: 'popularity.desc', extra: '&with_genres=12' },
              { key: 'animal-stories', title: 'Animal & Nature Tales', sort: 'popularity.desc', extra: '&with_keywords=3336' },
              { key: 'fantasy-magic', title: 'Magical & Fantasy Worlds', sort: 'popularity.desc', extra: '&with_genres=14' },
            ];
          // Horror (Movie: 27)
          case '27':
            return [
              { key: 'slasher-horror', title: 'Slasher Favorites', sort: 'popularity.desc', extra: '&with_keywords=12339' },
              { key: 'supernatural-horror', title: 'Supernatural & Ghost Stories', sort: 'popularity.desc', extra: '&with_keywords=10185' },
              { key: 'creature-features', title: 'Creature Features & Monsters', sort: 'popularity.desc', extra: '&with_keywords=10185' },
              { key: 'psychological-horror', title: 'Psychological Dread', sort: 'vote_average.desc', extra: '&vote_count.gte=300' },
            ];
          // Sci-Fi (Movie: 878, TV: 10765)
          case '878':
          case '10765':
            return [
              { key: 'space-scifi', title: 'Space Travel & Exploration', sort: 'popularity.desc', extra: '&with_keywords=3801' },
              { key: 'time-travel-scifi', title: 'Time Travel & Alternate Realities', sort: 'popularity.desc', extra: '&with_keywords=4379' },
              { key: 'dystopian-scifi', title: 'Dystopian & Post-Apocalyptic', sort: 'popularity.desc', extra: '&with_keywords=4565' },
              { key: 'cyberpunk-ai', title: 'Cyberpunk & Artificial Intelligence', sort: 'popularity.desc', extra: '&with_keywords=180370' },
            ];
          // Romance (Movie: 10749)
          case '10749':
            return [
              { key: 'rom-comedy', title: 'Romantic Comedies', sort: 'popularity.desc', extra: '&with_genres=35' },
              { key: 'rom-drama', title: 'Romantic Dramas', sort: 'popularity.desc', extra: '&with_genres=18' },
              { key: 'period-romance', title: 'Period Romance & Costumes', sort: 'popularity.desc', extra: '&with_keywords=5691' },
              { key: 'forbidden-rom', title: 'Forbidden Love & Passion', sort: 'popularity.desc', extra: '&with_keywords=10224' },
            ];
          // Mystery (Movie: 9648, TV: 9648)
          case '9648':
            return [
              { key: 'detective-mystery', title: 'Detective Procedurals', sort: 'popularity.desc', extra: '&with_keywords=1701' },
              { key: 'whodunit', title: 'Whodunits & Puzzles', sort: 'vote_average.desc', extra: '&vote_count.gte=300' },
              { key: 'supernatural-mystery', title: 'Supernatural & Sci-Fi Mysteries', sort: 'popularity.desc', extra: '&with_keywords=10185' },
            ];
          // Thriller (Movie: 53)
          case '53':
            return [
              { key: 'psych-thriller', title: 'Psychological Thrillers', sort: 'vote_average.desc', extra: '&vote_count.gte=1000' },
              { key: 'spy-thriller', title: 'Espionage & Spy Operations', sort: 'popularity.desc', extra: '&with_keywords=470' },
              { key: 'crime-suspense', title: 'Crime, Law & Suspense', sort: 'popularity.desc', extra: '&with_genres=80' },
            ];
          // Western (Movie: 37)
          case '37':
            return [
              { key: 'outlaws-revenge', title: 'Outlaws & Revenge Sagas', sort: 'popularity.desc', extra: '&with_keywords=10224' },
              { key: 'bounty-hunters', title: 'Bounty Hunters & Gunslingers', sort: 'vote_count.desc', extra: '' },
            ];
          // War (Movie: 10752, TV: 10768 with war name)
          case '10752':
            return [
              { key: 'military-combat-war', title: 'Military Battles & Combat', sort: 'popularity.desc', extra: '&with_keywords=1706' },
              { key: 'historical-war', title: 'Historical Warfare', sort: 'popularity.desc', extra: '&with_genres=36' },
              { key: 'war-survival', title: 'Survival & Heroism', sort: 'popularity.desc', extra: '&with_keywords=549' },
            ];
          // History (Movie: 36)
          case '36':
            return [
              { key: 'historical-bios', title: 'Biographies & Profiles', sort: 'popularity.desc', extra: '&with_keywords=237054' },
              { key: 'war-history', title: 'War & Military History', sort: 'popularity.desc', extra: '&with_genres=10752' },
              { key: 'ancient-civil', title: 'Ancient Civilizations', sort: 'popularity.desc', extra: '&with_keywords=5691' },
            ];
          // Music (Movie: 10402)
          case '10402':
            return [
              { key: 'musicals', title: 'Musicals', sort: 'vote_count.desc', extra: '' },
              { key: 'rock-pop-sagas', title: 'Rock & Pop Sagas', sort: 'popularity.desc', extra: '&with_keywords=237054' },
            ];
          // Reality (TV: 10764)
          case '10764':
            return [
              { key: 'reality-comps', title: 'Talent & Competition Shows', sort: 'vote_count.desc', extra: '' },
              { key: 'dating-reality', title: 'Dating & Relationships', sort: 'popularity.desc', extra: '' },
              { key: 'survival-reality', title: 'Survival Challenges', sort: 'popularity.desc', extra: '&with_keywords=549' },
            ];
          // War & Politics (TV: 10768)
          case '10768':
            return [
              { key: 'political-drama-wp', title: 'Political Dramas & Intrigues', sort: 'vote_count.desc', extra: '&with_keywords=5691' },
              { key: 'military-ops-wp', title: 'Military Operations', sort: 'popularity.desc', extra: '&with_keywords=1706' },
            ];
          // Soap Operas (TV: 10766)
          case '10766':
            return [
              { key: 'soap-drama', title: 'Daily Dramas & Telenovelas', sort: 'popularity.desc', extra: '' },
              { key: 'family-soaps', title: 'Family Soap Operas', sort: 'popularity.desc', extra: '&with_genres=10751' },
            ];
          // News (TV: 10763)
          case '10763':
            return [
              { key: 'current-affairs', title: 'Current Affairs & Specials', sort: 'popularity.desc', extra: '' },
              { key: 'doc-news', title: 'Investigative Journalism', sort: 'popularity.desc', extra: '&with_genres=99' },
            ];
          default:
            return [];
        }
      };

      // ── Tier 2: Custom Profile Sub-Genre Rows
      const profileRows = getProfileRows();
      profileRows.forEach(pr => {
        const row = gRow(`genre-profile-${profileKey}-${pr.key}`, pr.title, pr.sort, pr.extra);
        if (row) manifest.push(row);
      });

      // ── Tier 3: Core Dimension Rows
      const isTV = mediaType === 'tv';
      const dimensionRows: (SmartRow | null)[] = [
        gRow(`genre-p2-${selectedGenreId}`,       `More to Explore`,                 'popularity.desc', '&page=2'),
        gRow(`genre-acclaimed-${selectedGenreId}`, `Critically Acclaimed`,            'vote_average.desc', isTV ? '&vote_count.gte=150' : '&vote_count.gte=1500'),
        gRow(`genre-cult-${selectedGenreId}`,      `Cult Favorites`,                  'vote_count.desc', '&vote_average.gte=6.0&vote_average.lte=8.0'),
        gRow(`genre-hidden-${selectedGenreId}`,    `Hidden Gems`,                     'vote_average.desc', isTV ? '&vote_count.gte=30&vote_count.lte=300' : '&vote_count.gte=200&vote_count.lte=1200'),
        gRow(`genre-2020s-${selectedGenreId}`,     `Best of the 2020s`,               'vote_average.desc', `${getReleaseDateParam('2020-01-01')}&vote_count.gte=${isTV ? 20 : 100}`),
        gRow(`genre-2010s-${selectedGenreId}`,     `Defining the 2010s`,              'vote_average.desc', `${getReleaseDateParam('2010-01-01', '2019-12-31')}&vote_count.gte=${isTV ? 50 : 500}`),
        gRow(`genre-classics-${selectedGenreId}`,  `Classic ${baseGenreName}`,        'vote_average.desc', `${getReleaseDateParam(undefined, '2009-12-31')}&vote_count.gte=${isTV ? 30 : 1000}`),
        gRow(`genre-intl-${selectedGenreId}`,      `Global Hits`,                     'popularity.desc', '&without_original_language=en'),
        gRow(`genre-british-${selectedGenreId}`,   `Best of British`,                 'popularity.desc', '&with_origin_country=GB'),
        gRow(`genre-korean-${selectedGenreId}`,    isTV ? 'K-Drama Fever' : 'Korean Cinema', 'popularity.desc', '&with_origin_country=KR'),
        gRow(`genre-recent-${selectedGenreId}`,    `Newly Added`,                     isTV ? 'first_air_date.desc' : 'release_date.desc', '&vote_count.gte=20'),
        gRow(`genre-deep3-${selectedGenreId}`,     `Deeper Cuts`,                     'popularity.desc', '&page=3'),
        gRow(`genre-deep4-${selectedGenreId}`,     `More to Watch`,                   'popularity.desc', '&page=4'),
        gRow(`genre-legends-${selectedGenreId}`,   `All-Time Greats`,                 'vote_count.desc', '&vote_average.gte=8.0'),
        gRow(`genre-sleeper-${selectedGenreId}`,   `Quiet Masterpieces`,              'vote_average.desc', isTV ? '&vote_count.gte=10&vote_count.lte=80' : '&vote_count.gte=40&vote_count.lte=199'),
        gRow(`genre-modern-${selectedGenreId}`,    `Modern Favorites`,                'vote_average.desc', `${getReleaseDateParam('2018-01-01')}&vote_count.gte=${isTV ? 50 : 300}`),
        gRow(`genre-year-${selectedGenreId}`,      `Best of ${year}`,                 'vote_average.desc', `${getReleaseDateParam(`${year}-01-01`)}&vote_count.gte=${isTV ? 10 : 30}`),
      ];

      dimensionRows.forEach(r => r && manifest.push(r));

      // ── Tier 4: Adjacent micro-genre rows ────────────────────────────────────
      // Genres adjacent to the selected one can appear (at low density) so
      // e.g. Drama filter still sees some Mystery and Crime micro-rows — but never Action.
      const adjacentIds  = ADJACENT_GENRES[selectedGenreId] || [];
      const relevantMicro = MICRO_GENRES.filter(m => {
        if (m.type !== (pageType as string)) return false;
        const mIds = m.genres.split(',').map(Number).filter(Boolean);
        return mIds.includes(selectedGenreId) || adjacentIds.some(a => mIds.includes(a));
      });
      // Primary genre micro-rows: up to 6
      const primaryMicro = relevantMicro.filter(m => {
        const mIds = m.genres.split(',').map(Number).filter(Boolean);
        return mIds.includes(selectedGenreId);
      });
      const adjacentMicro = relevantMicro.filter(m => {
        const mIds = m.genres.split(',').map(Number).filter(Boolean);
        return !mIds.includes(selectedGenreId) && adjacentIds.some(a => mIds.includes(a));
      });

      const microPrimary  = seededPick(primaryMicro, 6, hash + selectedGenreId);
      const microAdjacent = seededPick(adjacentMicro, 3, hash + selectedGenreId + 1);

      [...microPrimary, ...microAdjacent].forEach((m) => {
        const finalGenres = mergeGenres(m.genres, selectedGenreId);
        const url = REQUESTS.fetchMicroGenre(m.type, finalGenres, m.extra);
        const sig = makeUrlSig(url);
        if (!usedUrls.has(sig)) {
          usedUrls.add(sig);
          const slug = m.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
          manifest.push({ key: `micro-genre-${selectedGenreId}-${slug}`, title: m.name, fetchUrl: url });
        }
      });

      // ── Safety fill: ensure at least 20 rows ──────────────────────────────
      const fillTitles = [
        'Explore More',
        'Popular Picks',
        'Trending Collections',
        'More to Discover',
        'Suggested Titles',
        'Viewer Favorites',
        'Handpicked Selection',
      ];
      for (let i = 0; manifest.length < 20 && i < 60; i++) {
        const url = REQUESTS.fetchByGenre(mediaType, selectedGenreId, 'popularity.desc') + `&page=${8 + i}`;
        const sig = makeUrlSig(url);
        if (!usedUrls.has(sig)) {
          usedUrls.add(sig);
          const title = fillTitles[i % fillTitles.length];
          const slug = title.toLowerCase().replace(/[^a-z0-9]/g, '-');
          manifest.push({ key: `fill-${selectedGenreId}-${slug}`, title, fetchUrl: url });
        } else {
          continue; // skip duplicate URL signature and continue scanning
        }
      }

      // Inject a Top-10 row mid-way through for visual rhythm
      insertTop10(
        manifest,
        `top10-mid-${selectedGenreId}`,
        `Trending ${mainGenreName}`,
        REQUESTS.fetchByGenre(mediaType, selectedGenreId, 'popularity.desc') + '&page=2',
        Math.min(manifest.length, 8),
      );

      return manifest;
    }

    // ── 4. STANDARD HUBS ─────────────────────────────────────────────────────

    // 4a. Holiday rows (highest contextual priority)
    if (holiday && HOLIDAY_STREAMS[holiday]) {
      const holidayRows = HOLIDAY_STREAMS[holiday];
      const picked = seededPick(
        holidayRows.filter(m => pageType === 'home' || m.type === pageType),
        Math.min(2, holidayRows.length),
        hash,
      );
      picked.forEach((m) => {
        const finalGenres = mergeGenres(m.genres, selectedGenreId);
        const url = REQUESTS.fetchMicroGenre(m.type, finalGenres, m.extra);
        const slug = m.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        addRow({ key: `holiday-${holiday}-${slug}`, title: m.name, fetchUrl: url });
      });
    }

    // 4b. Time-of-day row
    if (TIME_STREAMS[tod]) {
      const todRows = TIME_STREAMS[tod].filter(m => pageType === 'home' || m.type === pageType);
      if (todRows.length > 0) {
        const picked = todRows[hash % todRows.length];
        const finalGenres = mergeGenres(picked.genres, selectedGenreId);
        const slug = picked.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        addRow({ key: `tod-${tod}-${slug}`, title: picked.name, fetchUrl: REQUESTS.fetchMicroGenre(picked.type, finalGenres, picked.extra) });
      }
    }

    // 4c. Day-of-week themed row
    const themed = DAY_STREAMS[day];
    if (themed && (pageType === 'home' || themed.type === pageType)) {
      let finalName   = themed.name;
      let finalGenres = themed.genres;
      if (themed.name.includes('|')) {
        const names         = themed.name.split('|');
        const genreSegments = themed.genres.split('|');
        const idx           = hash % names.length;
        finalName           = names[idx]         || names[0];
        finalGenres         = genreSegments[idx] || genreSegments[0] || themed.genres;
      }
      finalGenres = mergeGenres(finalGenres, selectedGenreId);
      const slug = finalName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      addRow({ key: `day-theme-${day}-${slug}`, title: finalName, fetchUrl: REQUESTS.fetchMicroGenre(themed.type, finalGenres, themed.extra) });
    }

    // 4d. Seasonal rows (1–2)
    if (SEASON_STREAMS[season]) {
      const seasonRows = SEASON_STREAMS[season].filter(m => pageType === 'home' || m.type === pageType);
      seededPick(seasonRows, Math.min(2, seasonRows.length), hash + 7).forEach((m) => {
        const finalGenres = mergeGenres(m.genres, selectedGenreId);
        const slug = m.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        addRow({ key: `season-${season}-${slug}`, title: m.name, fetchUrl: REQUESTS.fetchMicroGenre(m.type, finalGenres, m.extra) });
      });
    }

    // 4e. Page-type specific curated rows (home / movie / tv / new_popular)
    if (pageType === 'home') {
      addRow({ key: 'home-trending-all', title: 'Trending Now',               fetchUrl: REQUESTS.fetchTrending });
      addRow({ key: 'home-nf-originals', title: 'Netflix Originals',          fetchUrl: REQUESTS.fetchNetflixOriginals });
      addRow({ key: 'home-loved-movies', title: 'Critically Loved Films',     fetchUrl: REQUESTS.fetchLoveTheseMovies });
      addRow({ key: 'home-award-series', title: 'Award-Winning Series',       fetchUrl: REQUESTS.fetchAwardWinningSeries });
      addRow({ key: 'home-exciting',     title: 'High-Octane Action',         fetchUrl: REQUESTS.fetchExcitingMovies });
      addRow({ key: 'home-scifi',        title: 'Sci-Fi Worlds to Get Lost In', fetchUrl: REQUESTS.fetchSciFiMovies });
      addRow({ key: 'home-comedy',       title: 'Laugh-Out-Loud Comedies',    fetchUrl: REQUESTS.fetchComedyMovies });
      addRow({ key: 'home-binge-tv',     title: 'Impossible to Watch Just One Episode', fetchUrl: REQUESTS.fetchBoredomBustersTV });
      addRow({ key: 'home-drama',        title: 'Drama That Makes You Think', fetchUrl: REQUESTS.fetchCriticallyAcclaimedDrama });
      addRow({ key: 'home-crime',        title: 'Crime That Keeps You Guessing', fetchUrl: REQUESTS.fetchCrimeTV });
      addRow({ key: 'home-intl',         title: 'International Discoveries',  fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'popularity.desc') + '&without_original_language=en' });
      addRow({ key: 'home-horror',       title: 'Horror for the Brave',       fetchUrl: REQUESTS.fetchHorrorMovies });
      addRow({ key: 'home-familiar',     title: 'Fan Favourites',             fetchUrl: REQUESTS.fetchFamiliarFavorites });
      addRow({ key: 'home-loved-tv',     title: 'Must-Watch Television',      fetchUrl: REQUESTS.fetchLoveTheseTV });
      addRow({ key: 'home-imaginative',  title: 'Genre-Bending Series',       fetchUrl: REQUESTS.fetchImaginativeSeries });
      addRow({ key: 'home-romance',      title: 'Romance Worth Staying Up For', fetchUrl: REQUESTS.fetchRomanceMovies });
      addRow({ key: 'home-toprated',     title: 'The All-Time Greats',        fetchUrl: REQUESTS.fetchTopRated });
      addRow({ key: 'home-us-series',    title: 'US Series Worth Your Time',  fetchUrl: REQUESTS.fetchUSSeries });
      addRow({ key: 'home-docs',         title: 'Documentaries That Change How You See the World', fetchUrl: REQUESTS.fetchDocumentaries });
      addRow({ key: 'home-family',       title: 'Family Nights Done Right',   fetchUrl: REQUESTS.fetchByGenre('movie', 10751, 'popularity.desc') });
      addRow({ key: 'home-exciting-tv',  title: 'High-Stakes Series',         fetchUrl: REQUESTS.fetchExcitingSeriesTV });
      addRow({ key: 'home-action-tv',    title: 'Action-Packed TV',           fetchUrl: REQUESTS.fetchActionTV });
      addRow({ key: 'home-korean',       title: 'K-Drama Fever',              fetchUrl: REQUESTS.fetchByGenre('tv', 18, 'popularity.desc') + '&with_origin_country=KR' });
      addRow({ key: 'home-anime',        title: 'Anime Worth the Hype',       fetchUrl: REQUESTS.fetchByGenre('tv', 16, 'popularity.desc') + '&with_origin_country=JP' });
    }

    if (pageType === 'movie') {
      addRow({ key: 'mv-trending',    title: 'Trending Films Right Now',         fetchUrl: REQUESTS.fetchTrendingMovies });
      addRow({ key: 'mv-exciting',    title: 'High-Octane Action Films',         fetchUrl: REQUESTS.fetchExcitingMovies });
      addRow({ key: 'mv-toprated',    title: 'The Films That Stood the Test of Time', fetchUrl: REQUESTS.fetchTopRated });
      addRow({ key: 'mv-scifi',       title: 'Sci-Fi Worlds to Get Lost In',     fetchUrl: REQUESTS.fetchSciFiMovies });
      addRow({ key: 'mv-drama',       title: 'Dramas That Leave a Mark',         fetchUrl: REQUESTS.fetchLoveTheseMovies });
      addRow({ key: 'mv-horror',      title: 'Horror That Haunts You',           fetchUrl: REQUESTS.fetchHorrorMovies });
      addRow({ key: 'mv-comedy',      title: 'Comedies You\'ll Actually Laugh At', fetchUrl: REQUESTS.fetchComedyMovies });
      addRow({ key: 'mv-romance',     title: 'Romance Done Right',               fetchUrl: REQUESTS.fetchRomanceMovies });
      addRow({ key: 'mv-action',      title: 'Pure Adrenaline',                  fetchUrl: REQUESTS.fetchActionMovies });
      addRow({ key: 'mv-docs',        title: 'Documentaries Worth Your Evening', fetchUrl: REQUESTS.fetchDocumentaries });
      addRow({ key: 'mv-buster',      title: 'Films for When You Can\'t Decide', fetchUrl: REQUESTS.fetchBoredomBustersMovies });
      addRow({ key: 'mv-fav',         title: 'Crowd Favourites',                 fetchUrl: REQUESTS.fetchFamiliarFavoritesMovies });
      addRow({ key: 'mv-intl',        title: 'International Cinema Worth Seeking Out', fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'popularity.desc') + '&without_original_language=en' });
      addRow({ key: 'mv-animation',   title: 'Animation That Isn\'t Just for Kids', fetchUrl: REQUESTS.fetchByGenre('movie', 16, 'vote_average.desc') + '&vote_count.gte=500' });
      addRow({ key: 'mv-history',     title: 'History Brought to Life',          fetchUrl: REQUESTS.fetchByGenre('movie', 36, 'vote_average.desc') + '&vote_count.gte=300' });
      addRow({ key: 'mv-thriller',    title: 'Thrillers to Watch with the Lights On', fetchUrl: REQUESTS.fetchByGenre('movie', 53, 'popularity.desc') });
      addRow({ key: 'mv-family',      title: 'Family Films Everyone Enjoys',     fetchUrl: REQUESTS.fetchByGenre('movie', 10751, 'popularity.desc') });
      addRow({ key: 'mv-hidden',      title: 'Films Flying Under the Radar',     fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'vote_average.desc') + '&vote_count.gte=100&vote_count.lte=1000' });
      addRow({ key: 'mv-korean',      title: 'Korean Cinema at Its Best',        fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'popularity.desc') + '&with_origin_country=KR' });
      addRow({ key: 'mv-upcoming',    title: 'Coming Soon to the Collection',    fetchUrl: REQUESTS.fetchUpcoming });
      addRow({ key: 'mv-year',        title: `The Best Films of ${year}`,        fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'vote_average.desc') + `&release_date.gte=${year}-01-01&vote_count.gte=50` });
      addRow({ key: 'mv-classics',    title: 'The Untouchable Film Classics',    fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'vote_average.desc') + '&release_date.lte=2000-01-01&vote_count.gte=2000' });
    }

    if (pageType === 'tv') {
      addRow({ key: 'tv-trending',    title: 'Trending Series Right Now',        fetchUrl: REQUESTS.fetchTrendingTV });
      addRow({ key: 'tv-originals',   title: 'Netflix Originals',                fetchUrl: REQUESTS.fetchNetflixOriginals });
      addRow({ key: 'tv-award',       title: 'Award-Winning Series',             fetchUrl: REQUESTS.fetchAwardWinningSeries });
      addRow({ key: 'tv-crime',       title: 'Crime Series That Keep You Guessing', fetchUrl: REQUESTS.fetchCrimeTV });
      addRow({ key: 'tv-drama',       title: 'Drama Series With Depth',          fetchUrl: REQUESTS.fetchDramaTV });
      addRow({ key: 'tv-action',      title: 'Action & Adventure Series',        fetchUrl: REQUESTS.fetchActionTV });
      addRow({ key: 'tv-comedy',      title: 'Comedies That Never Get Old',      fetchUrl: REQUESTS.fetchComedyTV });
      addRow({ key: 'tv-binge',       title: 'Impossible to Watch Just One Episode', fetchUrl: REQUESTS.fetchBoredomBustersTV });
      addRow({ key: 'tv-scifi',       title: 'Sci-Fi & Fantasy Worlds',          fetchUrl: REQUESTS.fetchImaginativeSeries });
      addRow({ key: 'tv-loved',       title: 'Loved by Critics & Audiences Alike', fetchUrl: REQUESTS.fetchLoveTheseTV });
      addRow({ key: 'tv-reality',     title: 'Reality TV Worth Watching',        fetchUrl: REQUESTS.fetchRealityTV });
      addRow({ key: 'tv-us',          title: 'US Series Dominating Right Now',   fetchUrl: REQUESTS.fetchUSSeries });
      addRow({ key: 'tv-exciting',    title: 'High-Stakes Series',               fetchUrl: REQUESTS.fetchExcitingSeriesTV });
      addRow({ key: 'tv-docs',        title: 'Documentary Series That Change Minds', fetchUrl: REQUESTS.fetchDocumentaries });
      addRow({ key: 'tv-korean',      title: 'K-Drama: Where to Start',          fetchUrl: REQUESTS.fetchByGenre('tv', 18, 'popularity.desc') + '&with_origin_country=KR' });
      addRow({ key: 'tv-british',     title: 'British Series Worth the Accent',  fetchUrl: REQUESTS.fetchByGenre('tv', 18, 'popularity.desc') + '&with_origin_country=GB' });
      addRow({ key: 'tv-anime',       title: 'Anime Series Worth the Hype',      fetchUrl: REQUESTS.fetchByGenre('tv', 16, 'popularity.desc') + '&with_origin_country=JP' });
      addRow({ key: 'tv-family',      title: 'Family Series for All Ages',       fetchUrl: REQUESTS.fetchByGenre('tv', 10751, 'popularity.desc') });
      addRow({ key: 'tv-mystery',     title: 'Mystery Series: Every Episode a Puzzle', fetchUrl: REQUESTS.fetchByGenre('tv', 9648, 'popularity.desc') });
      addRow({ key: 'tv-hidden',      title: 'Hidden Gems: Series Nobody Told You About', fetchUrl: REQUESTS.fetchByGenre('tv', 18, 'vote_average.desc') + '&vote_count.gte=100&vote_count.lte=1000' });
      addRow({ key: 'tv-longrun',     title: 'Long-Running Series Worth Starting', fetchUrl: REQUESTS.fetchByGenre('tv', 18, 'vote_count.desc') + '&vote_average.gte=7' });
      addRow({ key: 'tv-limited',     title: 'Limited Series: One Weekend, Done', fetchUrl: REQUESTS.fetchByGenre('tv', 18, 'vote_average.desc') + '&vote_count.gte=200&page=2' });
      addRow({ key: 'tv-scifi2',      title: 'Sci-Fi Series That Make You Think', fetchUrl: REQUESTS.fetchByGenre('tv', 10765, 'vote_average.desc') + '&vote_count.gte=300' });
    }

    // 4f. Random micro-genre pool ("chocolate bag") — deduped against everything above
    const mediaPool    = MICRO_GENRES.filter(m => pageType === 'home' ? true : m.type === pageType);
    const alreadyAdded = new Set(manifest.map(r => r.title));
    const dedupedPool  = mediaPool.filter(m => !alreadyAdded.has(m.name));
    const chocolates   = seededPick(dedupedPool, 22, hash);

    chocolates.forEach((m, i) => {
      let extra = m.extra || '';
      if (!extra.includes('page=') && i > 8) extra += `&page=${Math.floor(i / 5) + 2}`;
      const finalGenres = mergeGenres(m.genres, selectedGenreId);
      const slug = m.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      addRow({ key: `pouch-${slug}`, title: m.name, fetchUrl: REQUESTS.fetchMicroGenre(m.type, finalGenres, extra) });
    });

    // ── 5. TOP-10 ROW INJECTION ───────────────────────────────────────────────
    const top10Key    = pageType === 'tv' || (pageType === 'home' && hash % 2 === 0) ? 'top10-tv' : 'top10-movies';
    const top10Title  = top10Key === 'top10-tv' ? 'Top 10 Series in the UK Today' : 'Top 10 Films in the UK Today';
    const top10Url    = top10Key === 'top10-tv' ? REQUESTS.fetchTrendingTV : REQUESTS.fetchTrendingMovies;
    insertTop10(manifest, top10Key, top10Title, top10Url, Math.min(manifest.length, 4));

    // Secondary Top-10 (opposite type)
    const sec     = top10Key === 'top10-tv' ? { key: 'top10-movies-2', title: 'Top 10 Films in the UK Today', url: REQUESTS.fetchTrendingMovies } : { key: 'top10-tv-2', title: 'Top 10 Series in the UK Today', url: REQUESTS.fetchTrendingTV };
    insertTop10(manifest, sec.key, sec.title, sec.url, Math.min(manifest.length, 13));


    // ── 6. COMFORT ROWS INJECTION ─────────────────────────────────────────────
    if (continueWatchingRow) {
      const targetIndex = (continueWatchingRow.data?.length ?? 0) > 5 ? hash % 2 : (hash % 3) + 1;
      manifest.splice(Math.min(manifest.length, targetIndex), 0, continueWatchingRow);
    }
    if (myListRow) {
      const targetIndex = (myListRow.data?.length ?? 0) > 5 ? (hash + 1) % 2 : ((hash + 1) % 3) + 1;
      manifest.splice(Math.min(manifest.length, targetIndex), 0, myListRow);
    }

    return manifest;
  }, [pageType, selectedGenreId, selectedGenreName, continueWatching, myList, user, getLikedMovies, t]);

  return { rows, isLoading };
};