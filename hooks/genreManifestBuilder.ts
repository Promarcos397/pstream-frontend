import {
  MICRO_GENRES, GENRES, ADJACENT_GENRES,
} from '../data/genres';
import { REQUESTS } from '../constants';
import { resolveGenreId, isTvOnlyGenreId } from '../data/pageGenres';
import type { SmartRow } from './useDynamicManifest';
import { Movie } from '../types';

const GENRE_NAMES: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Anime', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction',
  53: 'Thriller', 10752: 'War', 37: 'Western',
  10759: 'Action & Adventure', 10765: 'Sci-Fi & Fantasy', 10768: 'War & Politics',
  10764: 'Reality', 10763: 'News', 10766: 'Soap', 10767: 'Talk', 10762: 'Kids',
};

export const makeUrlSig = (url: string): string => {
  try {
    const [base, qs = ''] = url.split('?');
    const params = qs.split('&').filter(Boolean).sort();
    return base + '?' + params.join('&');
  } catch { return url; }
};

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

export const insertTop10 = (
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

export const resolveProfileKey = (selectedGenreId: number, mediaType: 'movie' | 'tv', selectedGenreName?: string): string => {
  if (selectedGenreId === 99) {
    if (selectedGenreName && (selectedGenreName.toLowerCase().includes('science') || selectedGenreName.toLowerCase().includes('nature'))) {
      return '99-science-nature';
    }
    return '99-documentaries';
  }
  if ((selectedGenreId === 35 || selectedGenreId === 10767) && selectedGenreName?.toLowerCase().includes('stand-up')) {
    return '35-standup';
  }
  if (selectedGenreId === 16) {
    return mediaType === 'tv' ? '16-anime' : '16';
  }
  return String(selectedGenreId);
};

type ProfileRowDef = { key: string; title: string; sort: string; extra: string };

export const getProfileRows = (profileKey: string, mediaType: 'movie' | 'tv'): ProfileRowDef[] => {
  switch (profileKey) {
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
    case '35':
      if (mediaType === 'movie') {
        return [
          { key: 'rom-com', title: 'Romantic Comedies', sort: 'popularity.desc', extra: '&with_genres=10749' },
          { key: 'dark-comedy', title: 'Dark Comedy & Satire', sort: 'popularity.desc', extra: '&with_keywords=10224' },
          { key: 'raunchy-comedy', title: 'Raunchy Comedies', sort: 'popularity.desc', extra: '&with_keywords=9716' },
          { key: 'family-comedy', title: 'Dinner Table Laughs', sort: 'popularity.desc', extra: '&with_genres=10751' },
        ];
      }
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
    case '80':
      return [
        { key: 'heist', title: 'Heist Sagas', sort: 'popularity.desc', extra: '&with_keywords=10214' },
        { key: 'mafia-mob', title: 'Mob & Organized Crime', sort: 'popularity.desc', extra: '&with_keywords=4737' },
        { key: 'detective-police', title: 'Police & Detective Procedurals', sort: 'popularity.desc', extra: '&with_keywords=1701' },
        { key: 'courtroom-legal', title: 'Courtroom & Legal Battles', sort: 'popularity.desc', extra: '&with_keywords=5691' },
        { key: 'serial-killer', title: 'Serial Killer Investigation', sort: 'popularity.desc', extra: '&with_keywords=10224' },
      ];
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
    case '18':
      return [
        { key: 'true-story-dramas', title: 'Based on a True Story', sort: 'popularity.desc', extra: '&with_keywords=818' },
        { key: 'coming-of-age-dramas', title: 'Coming-of-Age Journeys', sort: 'popularity.desc', extra: '&with_keywords=4565' },
        { key: 'period-costume', title: 'Period & Costume Dramas', sort: 'popularity.desc', extra: '&with_keywords=5691' },
        { key: 'romance-dramas', title: 'Romance & Heartbreak', sort: 'popularity.desc', extra: '&with_genres=10749' },
      ];
    case '10751':
    case '10762':
      return [
        { key: 'animated-kids', title: 'Animated Classics', sort: 'popularity.desc', extra: '&with_genres=16' },
        { key: 'live-action-kids', title: 'Live-Action Family Fun', sort: 'popularity.desc', extra: '&with_genres=12' },
        { key: 'animal-stories', title: 'Animal & Nature Tales', sort: 'popularity.desc', extra: '&with_keywords=3336' },
        { key: 'fantasy-magic', title: 'Magical & Fantasy Worlds', sort: 'popularity.desc', extra: '&with_genres=14' },
      ];
    case '27':
      return [
        { key: 'slasher-horror', title: 'Slasher Favorites', sort: 'popularity.desc', extra: '&with_keywords=12339' },
        { key: 'supernatural-horror', title: 'Supernatural & Ghost Stories', sort: 'popularity.desc', extra: '&with_keywords=10185' },
        { key: 'creature-features', title: 'Creature Features & Monsters', sort: 'popularity.desc', extra: '&with_keywords=10185' },
        { key: 'psychological-horror', title: 'Psychological Dread', sort: 'vote_average.desc', extra: '&vote_count.gte=300' },
      ];
    case '878':
    case '10765':
      return [
        { key: 'space-scifi', title: 'Space Travel & Exploration', sort: 'popularity.desc', extra: '&with_keywords=3801' },
        { key: 'time-travel-scifi', title: 'Time Travel & Alternate Realities', sort: 'popularity.desc', extra: '&with_keywords=4379' },
        { key: 'dystopian-scifi', title: 'Dystopian & Post-Apocalyptic', sort: 'popularity.desc', extra: '&with_keywords=4565' },
        { key: 'cyberpunk-ai', title: 'Cyberpunk & Artificial Intelligence', sort: 'popularity.desc', extra: '&with_keywords=180370' },
      ];
    case '10749':
      return [
        { key: 'rom-comedy', title: 'Romantic Comedies', sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'rom-drama', title: 'Romantic Dramas', sort: 'popularity.desc', extra: '&with_genres=18' },
        { key: 'period-romance', title: 'Period Romance & Costumes', sort: 'popularity.desc', extra: '&with_keywords=5691' },
        { key: 'forbidden-rom', title: 'Forbidden Love & Passion', sort: 'popularity.desc', extra: '&with_keywords=10224' },
      ];
    case '9648':
      return [
        { key: 'detective-mystery', title: 'Detective Procedurals', sort: 'popularity.desc', extra: '&with_keywords=1701' },
        { key: 'whodunit', title: 'Whodunits & Puzzles', sort: 'vote_average.desc', extra: '&vote_count.gte=300' },
        { key: 'supernatural-mystery', title: 'Supernatural & Sci-Fi Mysteries', sort: 'popularity.desc', extra: '&with_keywords=10185' },
      ];
    case '53':
      return [
        { key: 'psych-thriller', title: 'Psychological Thrillers', sort: 'vote_average.desc', extra: '&vote_count.gte=1000' },
        { key: 'spy-thriller', title: 'Espionage & Spy Operations', sort: 'popularity.desc', extra: '&with_keywords=470' },
        { key: 'crime-suspense', title: 'Crime, Law & Suspense', sort: 'popularity.desc', extra: '&with_genres=80' },
      ];
    case '37':
      return [
        { key: 'outlaws-revenge', title: 'Outlaws & Revenge Sagas', sort: 'popularity.desc', extra: '&with_keywords=10224' },
        { key: 'bounty-hunters', title: 'Bounty Hunters & Gunslingers', sort: 'vote_count.desc', extra: '' },
      ];
    case '10752':
      return [
        { key: 'military-combat-war', title: 'Military Battles & Combat', sort: 'popularity.desc', extra: '&with_keywords=1706' },
        { key: 'historical-war', title: 'Historical Warfare', sort: 'popularity.desc', extra: '&with_genres=36' },
        { key: 'war-survival', title: 'Survival & Heroism', sort: 'popularity.desc', extra: '&with_keywords=549' },
      ];
    case '36':
      return [
        { key: 'historical-bios', title: 'Biographies & Profiles', sort: 'popularity.desc', extra: '&with_keywords=237054' },
        { key: 'war-history', title: 'War & Military History', sort: 'popularity.desc', extra: '&with_genres=10752' },
        { key: 'ancient-civil', title: 'Ancient Civilizations', sort: 'popularity.desc', extra: '&with_keywords=5691' },
      ];
    case '10402':
      return [
        { key: 'musicals', title: 'Musicals', sort: 'vote_count.desc', extra: '' },
        { key: 'rock-pop-sagas', title: 'Rock & Pop Sagas', sort: 'popularity.desc', extra: '&with_keywords=237054' },
      ];
    case '10764':
      return [
        { key: 'reality-comps', title: 'Talent & Competition Shows', sort: 'vote_count.desc', extra: '' },
        { key: 'dating-reality', title: 'Dating & Relationships', sort: 'popularity.desc', extra: '' },
        { key: 'survival-reality', title: 'Survival Challenges', sort: 'popularity.desc', extra: '&with_keywords=549' },
      ];
    case '10768':
      return [
        { key: 'political-drama-wp', title: 'Political Dramas & Intrigues', sort: 'vote_count.desc', extra: '&with_keywords=5691' },
        { key: 'military-ops-wp', title: 'Military Operations', sort: 'popularity.desc', extra: '&with_keywords=1706' },
      ];
    case '10766':
      return [
        { key: 'soap-drama', title: 'Daily Dramas & Telenovelas', sort: 'popularity.desc', extra: '' },
        { key: 'family-soaps', title: 'Family Soap Operas', sort: 'popularity.desc', extra: '&with_genres=10751' },
      ];
    case '10763':
      return [
        { key: 'current-affairs', title: 'Current Affairs & Specials', sort: 'popularity.desc', extra: '' },
        { key: 'doc-news', title: 'Investigative Journalism', sort: 'popularity.desc', extra: '&with_genres=99' },
      ];
    case '10001': // Pride / LGBTQ
      if (mediaType === 'movie') {
        return [
          { key: 'glaad-awards', title: '2026 GLAAD Award Winners & Nominees', sort: 'popularity.desc', extra: '&with_keywords=9003&release_date.gte=2025-01-01' },
          { key: 'slaying-onscreen', title: 'Slaying On-Screen', sort: 'popularity.desc', extra: '&with_keywords=9003&with_genres=28|53' },
          { key: 'critics-love', title: 'Films the Critics Love', sort: 'popularity.desc', extra: '&with_keywords=9003&vote_average.gte=7.8' },
          { key: 'feel-good-favs', title: 'Serving Feel-Good Favorites', sort: 'popularity.desc', extra: '&with_keywords=9003&with_genres=35' },
          { key: 'love-out-loud', title: 'Love Out Loud', sort: 'popularity.desc', extra: '&with_keywords=9003&with_genres=10749' },
          { key: 'beyond-binary', title: 'Beyond the Binary', sort: 'popularity.desc', extra: '&with_keywords=9003' },
          { key: 'inspired-true', title: 'Inspired by True Events', sort: 'popularity.desc', extra: '&with_keywords=9003&with_keywords=818' },
        ];
      }
      return [
        { key: 'glaad-awards', title: '2026 GLAAD Award Winners & Nominees', sort: 'popularity.desc', extra: '&with_keywords=9003&release_date.gte=2025-01-01' },
        { key: 'slaying-onscreen', title: 'Slaying On-Screen', sort: 'popularity.desc', extra: '&with_keywords=9003&with_genres=28|53' },
        { key: 'critics-love', title: 'Shows the Critics Love', sort: 'popularity.desc', extra: '&with_keywords=9003&vote_average.gte=7.8' },
        { key: 'feel-good-favs', title: 'Serving Feel-Good Favorites', sort: 'popularity.desc', extra: '&with_keywords=9003&with_genres=35' },
        { key: 'love-out-loud', title: 'Love Out Loud', sort: 'popularity.desc', extra: '&with_keywords=9003&with_genres=10749' },
        { key: 'beyond-binary', title: 'Beyond the Binary', sort: 'popularity.desc', extra: '&with_keywords=9003' },
        { key: 'inspired-true', title: 'Inspired by True Events', sort: 'popularity.desc', extra: '&with_keywords=9003&with_keywords=818' },
        { key: 'unscripted', title: 'Unscripted (No Notes)', sort: 'popularity.desc', extra: '&with_keywords=9003&with_genres=10764' },
      ];
    case '10002': // Astrology
      return [
        { key: 'zodiac-matches', title: 'Zodiac Matches', sort: 'popularity.desc', extra: '&with_keywords=185246|10168|15386' },
        { key: 'cosmic-journeys', title: 'Cosmic & Spiritual Journeys', sort: 'popularity.desc', extra: '&with_keywords=185246|10168|15386&vote_average.gte=7' },
        { key: 'fate-destiny', title: 'Fate & Destiny Sagas', sort: 'popularity.desc', extra: '&with_keywords=185246|10168|15386' },
      ];
    case '10003': // Black Stories
      return [
        { key: 'black-directors', title: 'Black Directors & Writers', sort: 'popularity.desc', extra: '&with_keywords=237248|175510|242137|161556' },
        { key: 'black-leads', title: 'Acclaimed Black Leads', sort: 'popularity.desc', extra: '&with_keywords=237248|175510|242137|161556&vote_average.gte=7.5' },
        { key: 'black-narratives', title: 'Powerful Black Narratives', sort: 'popularity.desc', extra: '&with_keywords=237248|175510|242137|161556' },
      ];
    case '10004': // Book Adaptations
      return [
        { key: 'page-to-screen', title: 'Page-to-Screen Masterpieces', sort: 'popularity.desc', extra: '&with_keywords=818|10214' },
        { key: 'literary-adaptations', title: 'Literary Adaptations', sort: 'vote_count.desc', extra: '&with_keywords=818|10214' },
        { key: 'bestseller-hits', title: 'Bestseller Hits', sort: 'popularity.desc', extra: '&with_keywords=818|10214&vote_average.gte=7' },
      ];
    case '10005': // British
      return [
        { key: 'british-mysteries', title: 'British Mystery & Suspense', sort: 'popularity.desc', extra: '&with_origin_country=GB&with_genres=80|53|9648' },
        { key: 'british-comedies', title: 'Witty British Comedies', sort: 'popularity.desc', extra: '&with_origin_country=GB&with_genres=35' },
        { key: 'british-period-dramas', title: 'British Period & Costume Dramas', sort: 'popularity.desc', extra: '&with_origin_country=GB&with_keywords=5691|180370' },
      ];
    case '10006': // European
      return [
        { key: 'euro-thrillers', title: 'European Crime & Thrillers', sort: 'popularity.desc', extra: '&with_origin_country=FR|DE|IT|ES&with_genres=80|53' },
        { key: 'euro-dramas', title: 'European Prestige Dramas', sort: 'popularity.desc', extra: '&with_origin_country=FR|DE|IT|ES&with_genres=18' },
        { key: 'euro-comedies', title: 'European Comedy Hits', sort: 'popularity.desc', extra: '&with_origin_country=FR|DE|IT|ES&with_genres=35' },
      ];
    case '10007': // Moods
      return [
        { key: 'feel-good-moods', title: 'Feel-Good Favorites', sort: 'popularity.desc', extra: '&with_keywords=9663|10224|10185&vote_average.gte=7' },
        { key: 'gripping-drama', title: 'Intense & Gripping Drama', sort: 'popularity.desc', extra: '&with_keywords=9663|10224|10185&with_genres=18|53' },
        { key: 'relaxed-vibes', title: 'Chilled & Relaxed Vibes', sort: 'popularity.desc', extra: '&with_keywords=9663|10224|10185' },
      ];
    case '10008': // US / Hollywood
      if (mediaType === 'tv') {
        return [
          { key: 'prestige-american-dramas', title: 'Prestige American Dramas', sort: 'popularity.desc', extra: '&with_origin_country=US&with_genres=18&vote_average.gte=7.5' },
          { key: 'us-comedy-series', title: 'US Comedy Series', sort: 'popularity.desc', extra: '&with_origin_country=US&with_genres=35' },
          { key: 'us-action-adventure-series', title: 'US Action & Adventure Series', sort: 'popularity.desc', extra: '&with_origin_country=US&with_genres=10759' },
        ];
      }
      return [
        { key: 'hollywood-blockbusters', title: 'Hollywood Blockbusters', sort: 'popularity.desc', extra: '&with_origin_country=US&vote_count.gte=5000' },
        { key: 'prestige-american-dramas', title: 'Prestige American Dramas', sort: 'popularity.desc', extra: '&with_origin_country=US&with_genres=18&vote_average.gte=7.5' },
        { key: 'indie-usa-cinema', title: 'Indie USA Cinema', sort: 'popularity.desc', extra: '&with_origin_country=US&vote_count.lte=2000' },
      ];
    case '10009': // Classics
      if (mediaType === 'tv') {
        return [
          { key: 'golden-age-hollywood', title: 'Golden Age Hollywood Classics', sort: 'vote_count.desc', extra: '&with_origin_country=US' },
          { key: 'retro-favorites', title: 'Retro Favorites', sort: 'popularity.desc', extra: '' },
          { key: 'essential-classics', title: 'Essential Classics', sort: 'vote_average.desc', extra: '&vote_count.gte=500' },
        ];
      }
      return [
        { key: 'golden-age-hollywood', title: 'Golden Age Hollywood Classics', sort: 'vote_count.desc', extra: '&with_origin_country=US' },
        { key: 'retro-favorites', title: 'Retro Favorites', sort: 'popularity.desc', extra: '' },
        { key: 'essential-classics', title: 'Essential Film Classics', sort: 'vote_average.desc', extra: '&vote_count.gte=500' },
      ];
    case '10010': // Cult
      return [
        { key: 'cult-favorites', title: 'Cult Favorites', sort: 'popularity.desc', extra: '&with_keywords=10084' },
        { key: 'indie-cult', title: 'Indie Cult Classics', sort: 'vote_count.desc', extra: '&with_keywords=10084&vote_average.gte=7.0' },
        { key: 'sci-fi-horror-cult', title: 'Sci-Fi & Horror Cults', sort: 'popularity.desc', extra: '&with_keywords=10084&with_genres=878|27' },
      ];
    case '10011': // Independent
      if (mediaType === 'tv') {
        return [
          { key: 'indie-dramas', title: 'Independent Dramas', sort: 'popularity.desc', extra: '&with_genres=18' },
          { key: 'prestige-tv-favorites', title: 'Prestige TV Favorites', sort: 'vote_average.desc', extra: '' },
          { key: 'under-the-radar-indies', title: 'Under-the-Radar Indies', sort: 'popularity.desc', extra: '' },
        ];
      }
      return [
        { key: 'indie-dramas', title: 'Independent Dramas', sort: 'popularity.desc', extra: '&with_genres=18' },
        { key: 'festival-favorites', title: 'Film Festival Favorites', sort: 'vote_average.desc', extra: '' },
        { key: 'under-the-radar-indies', title: 'Under-the-Radar Indies', sort: 'popularity.desc', extra: '' },
      ];
    case '10012': // International
      if (mediaType === 'tv') {
        return [
          { key: 'subtitled-masterpieces', title: 'Subtitled Masterpieces', sort: 'vote_average.desc', extra: '&without_original_language=en&vote_count.gte=500' },
          { key: 'world-tv', title: 'Award-Winning World TV', sort: 'popularity.desc', extra: '&without_original_language=en&vote_average.gte=7.5' },
          { key: 'global-action-series', title: 'Global Action Series', sort: 'popularity.desc', extra: '&without_original_language=en&with_genres=10759' },
        ];
      }
      return [
        { key: 'subtitled-masterpieces', title: 'Subtitled Masterpieces', sort: 'vote_average.desc', extra: '&without_original_language=en&vote_count.gte=500' },
        { key: 'world-cinema', title: 'Award-Winning World Cinema', sort: 'popularity.desc', extra: '&without_original_language=en&vote_average.gte=7.5' },
        { key: 'global-action', title: 'Global Action Hits', sort: 'popularity.desc', extra: '&without_original_language=en&with_genres=28' },
      ];
    case '10013': // Shorts
      return [
        { key: 'short-films', title: 'Award-Winning Short Films', sort: 'vote_count.desc', extra: '' },
        { key: 'quick-animation-shorts', title: 'Animated Shorts', sort: 'popularity.desc', extra: '&with_genres=16' },
      ];
    case '10014': // Sport
      return [
        { key: 'sports-dramas', title: 'Inspiring Sports Dramas', sort: 'popularity.desc', extra: '&with_genres=18' },
        { key: 'docu-sports', title: 'Sports Docuseries & Profiles', sort: 'popularity.desc', extra: '&with_genres=99' },
        { key: 'high-stakes-games', title: 'High-Stakes Competitions', sort: 'popularity.desc', extra: '' },
      ];
    case '10015': // Teen
      return [
        { key: 'teen-angst-drama', title: 'Teen Dramas & Angst', sort: 'popularity.desc', extra: '&with_genres=18' },
        { key: 'high-school-comedy', title: 'High School Comedies', sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'coming-of-age-journeys', title: 'Coming-of-Age Journeys', sort: 'popularity.desc', extra: '' },
      ];
    default:
      return [];
  }
};

const getMovieFallbackProfiles = (softerVotes: boolean): ProfileRowDef[] => [
  { key: 'popular-films', title: 'Popular Films', sort: 'popularity.desc', extra: '' },
  { key: 'acclaimed-films', title: 'Critically Acclaimed Films', sort: 'vote_average.desc', extra: softerVotes ? '&vote_count.gte=150' : '&vote_count.gte=400' },
  { key: 'hidden-gem-films', title: 'Hidden Gem Films', sort: 'vote_average.desc', extra: '&vote_count.gte=50&vote_count.lte=300' },
  { key: 'new-releases-films', title: 'New Releases', sort: 'release_date.desc', extra: '&vote_count.gte=5' },
];

export interface BuildGenreSliceOpts {
  mediaType: 'movie' | 'tv';
  selectedGenreId: number;
  selectedGenreName?: string;
  usedUrls: Set<string>;
  hash: number;
  keyPrefix: string;
  year: number;
  homeHybrid?: boolean;
  skipMicro?: boolean;
  skipFill?: boolean;
}

export const buildGenreManifestSlice = (opts: BuildGenreSliceOpts): SmartRow[] => {
  const {
    mediaType,
    selectedGenreId,
    selectedGenreName,
    usedUrls,
    hash,
    keyPrefix,
    year,
    homeHybrid = false,
    skipMicro = false,
    skipFill = false,
  } = opts;

  const rows: SmartRow[] = [];
  const baseGenreName = selectedGenreName ?? GENRE_NAMES[selectedGenreId] ?? GENRES[selectedGenreId] ?? 'Content';
  const isTV = mediaType === 'tv';
  const softerMovieVotes = homeHybrid && mediaType === 'movie';

  const getReleaseDateParam = (gte?: string, lte?: string) => {
    const prefix = isTV ? 'first_air_date' : 'primary_release_date';
    let res = '';
    if (gte) res += `&${prefix}.gte=${gte}`;
    if (lte) res += `&${prefix}.lte=${lte}`;
    return res;
  };

  const gRow = (key: string, title: string, sort: string, extra = ''): SmartRow | null => {
    const url = REQUESTS.fetchByGenre(mediaType, selectedGenreId, sort, extra);
    const sig = makeUrlSig(url);
    if (usedUrls.has(sig)) return null;
    usedUrls.add(sig);
    const fullKey = keyPrefix ? `${keyPrefix}-${key}` : key;
    return { key: fullKey, title, fetchUrl: url };
  };

  const profileKey = resolveProfileKey(selectedGenreId, mediaType, selectedGenreName);
  let profileRows = getProfileRows(profileKey, mediaType);

  if (profileRows.length === 0 && mediaType === 'movie' && (homeHybrid || isTvOnlyGenreId(selectedGenreId))) {
    profileRows = getMovieFallbackProfiles(softerMovieVotes);
  }

  profileRows.forEach(pr => {
    const row = gRow(`genre-profile-${profileKey}-${pr.key}`, pr.title, pr.sort, pr.extra);
    if (row) rows.push(row);
  });

  const movieAcclaimedThreshold = softerMovieVotes ? '&vote_count.gte=150' : '&vote_count.gte=400';

  const dimensionRows: (SmartRow | null)[] = [
    gRow(`genre-classics-${selectedGenreId}`, `Classic ${baseGenreName}`, 'vote_average.desc', `${getReleaseDateParam(undefined, '2009-12-31')}&vote_count.gte=${isTV ? 8 : 250}`),
  ];
  dimensionRows.forEach(r => r && rows.push(r));

  if (!skipMicro) {
    const mergeGenres = (baseGenres: string, genreId?: number) => {
      if (!genreId) return baseGenres;
      const parts = baseGenres.split(',');
      if (parts.includes(genreId.toString())) return baseGenres;
      return `${baseGenres},${genreId}`;
    };

    const adjacentIds = ADJACENT_GENRES[selectedGenreId] || [];
    const relevantMicro = MICRO_GENRES.filter(m => {
      if (m.type !== mediaType) return false;
      const mIds = m.genres.split(',').map(Number).filter(Boolean);
      return mIds.includes(selectedGenreId) || adjacentIds.some(a => mIds.includes(a));
    });
    const primaryMicro = relevantMicro.filter(m => {
      const mIds = m.genres.split(',').map(Number).filter(Boolean);
      return mIds.includes(selectedGenreId);
    });
    const adjacentMicro = relevantMicro.filter(m => {
      const mIds = m.genres.split(',').map(Number).filter(Boolean);
      return !mIds.includes(selectedGenreId) && adjacentIds.some(a => mIds.includes(a));
    });

    const microPrimary = seededPick(primaryMicro, 6, hash + selectedGenreId);
    const microAdjacent = seededPick(adjacentMicro, 3, hash + selectedGenreId + 1);

    [...microPrimary, ...microAdjacent].forEach((m) => {
      const finalGenres = mergeGenres(m.genres, selectedGenreId);
      const url = REQUESTS.fetchMicroGenre(m.type, finalGenres, m.extra);
      const sig = makeUrlSig(url);
      if (!usedUrls.has(sig)) {
        usedUrls.add(sig);
        const slug = m.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const microKey = keyPrefix ? `${keyPrefix}-micro-${slug}` : `micro-genre-${selectedGenreId}-${slug}`;
        rows.push({ key: microKey, title: m.name, fetchUrl: url });
      }
    });
  }

  if (!skipFill) {
    const fillTitles = [
      'Explore More', 'Popular Picks', 'Trending Collections',
      'More to Discover', 'Suggested Titles', 'Viewer Favorites', 'Handpicked Selection',
    ];
    for (let i = 0; rows.length < 12 && i < 40; i++) {
      const url = REQUESTS.fetchByGenre(mediaType, selectedGenreId, 'popularity.desc') + `&page=${8 + i}`;
      const sig = makeUrlSig(url);
      if (!usedUrls.has(sig)) {
        usedUrls.add(sig);
        const title = fillTitles[i % fillTitles.length];
        const slug = title.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const fillKey = keyPrefix ? `${keyPrefix}-fill-${slug}-${i}` : `fill-${selectedGenreId}-${slug}`;
        rows.push({ key: fillKey, title, fetchUrl: url });
      }
    }
  }

  return rows;
};

export interface BuildHomeGenreManifestOpts {
  manifest: SmartRow[];
  selectedGenreId?: number;
  selectedGenreName?: string;
  usedUrls: Set<string>;
  hash: number;
  year: number;
  addRow: (row: SmartRow) => boolean;
  continueWatching: Movie[];
  myList: Movie[];
  likedEntries: any[];
  continueWatchingRow?: SmartRow | null;
  myListRow?: SmartRow | null;
}

// Helper to resolve Netflix-style dynamic titles when category filtering is active
const getThemedTitle = (baseTitle: string, mediaType: 'movie' | 'tv', selectedGenreName?: string): string => {
  if (!selectedGenreName) return baseTitle;
  const genre = selectedGenreName;
  const suffix = mediaType === 'tv' ? 'Series' : 'Films';

  if (baseTitle.includes("Best of the 2000s") || baseTitle.includes("2000s")) {
    return `2000s ${genre} ${suffix}`;
  }
  if (baseTitle.includes("90s Nostalgia Trip") || baseTitle.includes("90s")) {
    return `90s ${genre} ${suffix}`;
  }
  if (baseTitle.includes("80s Classics") || baseTitle.includes("80s")) {
    return `80s ${genre} ${suffix}`;
  }
  if (baseTitle.includes("30-Minute Hits") || baseTitle.includes("30-Minute")) {
    return `30-Minute ${genre} Hits`;
  }
  if (baseTitle.includes("Based on Books") || baseTitle.includes("Books")) {
    return `${genre} ${suffix} Based on Books`;
  }
  if (baseTitle.includes("Familiar Favorites") || baseTitle.includes("Familiar")) {
    return `Familiar ${genre} Favorites`;
  }
  if (baseTitle.includes("Spill the Tea") || baseTitle.includes("Gossip")) {
    return `High-Drama ${genre}`;
  }
  if (baseTitle.includes("Dubbed in English") || baseTitle.includes("Dubbed")) {
    return `${genre} Dubbed in English`;
  }
  return `${genre} ${baseTitle}`;
};

export const buildHomeGenreManifest = (opts: BuildHomeGenreManifestOpts): void => {
  const {
    manifest,
    selectedGenreId,
    selectedGenreName,
    usedUrls,
    hash,
    year,
    addRow,
    continueWatching,
    myList,
    likedEntries,
    continueWatchingRow,
    myListRow,
  } = opts;

  const baseGenreName = selectedGenreName ?? (selectedGenreId ? (GENRE_NAMES[selectedGenreId] ?? GENRES[selectedGenreId] ?? 'Content') : 'Content');
  
  const movieGenreId = selectedGenreId ? resolveGenreId('movie', selectedGenreId) : undefined;
  const tvGenreId = selectedGenreId ? resolveGenreId('tv', selectedGenreId) : undefined;

  // ───────────────────────────────────────────────────────────────────────────
  // 1. PRIORITIZED COMFORT ROWS (Based on Card Count)
  // ───────────────────────────────────────────────────────────────────────────
  let CW_at_top = false;
  let ML_at_top = false;

  // Pinned to Row 0 if it has >= 4 items
  if (continueWatchingRow && continueWatchingRow.data && continueWatchingRow.data.length >= 4) {
    addRow(continueWatchingRow);
    CW_at_top = true;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. PERSONALIZED RECOMMENDATIONS (Row 1-2)
  // ───────────────────────────────────────────────────────────────────────────
  let watchRowsCount = 0;
  continueWatching.forEach((m) => {
    if (watchRowsCount >= 1) return; // Only 1 "Because you watched" near the top
    if (selectedGenreId && m.genre_ids && !m.genre_ids.includes(selectedGenreId)) return;
    const isTV = m.media_type === 'tv' || (!m.media_type && !m.title);
    const url = REQUESTS.fetchSimilar(isTV ? 'tv' : 'movie', m.id);
    const sig = makeUrlSig(url);
    if (!usedUrls.has(sig)) {
      usedUrls.add(sig);
      watchRowsCount++;
      addRow({
        key: `home-genre-personal-watched-${m.id}`,
        title: `Because you watched ${m.title || m.name}`,
        fetchUrl: url,
      });
    }
  });

  // Prioritize My List to Row 1 or 2 if it has >= 4 items
  if (myListRow && myListRow.data && myListRow.data.length >= 4) {
    addRow(myListRow);
    ML_at_top = true;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. DEMOTED COMFORT ROWS (Index 2-3 if < 4 items)
  // ───────────────────────────────────────────────────────────────────────────
  if (continueWatchingRow && !CW_at_top) {
    addRow(continueWatchingRow); // Demoted Continue Watching (1-3 items)
  }

  // Add a highly engaging, full curated Row high up (Index 3/4)
  const primaryCuratedUrl = selectedGenreId
    ? REQUESTS.fetchByGenre('movie', movieGenreId!, 'popularity.desc')
    : REQUESTS.fetchTrending;
  const primaryCuratedSig = makeUrlSig(primaryCuratedUrl);
  if (!usedUrls.has(primaryCuratedSig)) {
    usedUrls.add(primaryCuratedSig);
    addRow({
      key: `home-genre-primary-curated-${selectedGenreId || 'all'}`,
      title: selectedGenreId ? `Today's Top ${baseGenreName} Picks` : 'Trending Now',
      fetchUrl: primaryCuratedUrl,
    });
  }

  // Demoted My List (1-3 items) at Index 4 or 5
  if (myListRow && !ML_at_top) {
    addRow(myListRow);
  }

  // Second "Because you watched / liked" personalization row
  let likedRowsCount = 0;
  likedEntries.forEach((entry) => {
    if (likedRowsCount >= 1) return;
    const m = entry.movie;
    if (selectedGenreId && m.genre_ids && !m.genre_ids.includes(selectedGenreId)) return;
    const isTV = m.media_type === 'tv' || (!m.media_type && !m.title);
    const url = REQUESTS.fetchRecommendations(isTV ? 'tv' : 'movie', m.id);
    const sig = makeUrlSig(url);
    if (!usedUrls.has(sig)) {
      usedUrls.add(sig);
      likedRowsCount++;
      addRow({
        key: `home-genre-personal-liked-${m.id}`,
        title: `Because you liked ${m.title || m.name}`,
        fetchUrl: url,
      });
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. TOP 10 PLACEMENTS (Demoted to index 5-8, split apart)
  // ───────────────────────────────────────────────────────────────────────────
  // First Top 10 split row placed at Row 5 or 6
  const top10MovieUrl = selectedGenreId
    ? REQUESTS.fetchByGenre('movie', movieGenreId!, 'popularity.desc')
    : REQUESTS.fetchTrendingMovies;
  const top10MovieSig = makeUrlSig(top10MovieUrl);
  if (!usedUrls.has(top10MovieSig)) {
    usedUrls.add(top10MovieSig);
    addRow({
      key: `home-genre-top10-movie-${selectedGenreId || 'all'}`,
      title: selectedGenreId ? `Top 10 ${baseGenreName} Films` : 'Top 10 Films in the UK Today',
      fetchUrl: top10MovieUrl,
      type: 'top10',
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5. THEMATIC ROWS POOL (Interleaved)
  // ───────────────────────────────────────────────────────────────────────────
  const moviePrefix = `home-genre-movie-${selectedGenreId || 'all'}`;
  const tvPrefix = `home-genre-tv-${selectedGenreId || 'all'}`;
  let movieCount = 0;
  let tvCount = 0;

  const trackAdd = (row: SmartRow) => {
    if (!addRow(row)) return;
    if (row.key.startsWith(moviePrefix)) movieCount++;
    if (row.key.startsWith(tvPrefix)) tvCount++;
  };

  const buildScopedQuery = (
    mediaType: 'movie' | 'tv',
    baseParams: Record<string, string | number>,
    extra = ''
  ): string => {
    const finalGenre = mediaType === 'movie' ? movieGenreId : tvGenreId;
    const mergedParams = {
      ...baseParams,
      ...(finalGenre && { with_genres: finalGenre }),
    };
    return REQUESTS._build(`${REQUESTS.fetchTrendingMovies.split('/trending')[0]}/discover/${mediaType}`, mergedParams, extra);
  };

  const pool: SmartRow[] = [];

  // Theme A: Retro Flashback 2000-2005 (Nostalgia Pack)
  const retro00sUrl = buildScopedQuery('tv', {
    sort_by: 'popularity.desc',
    'first_air_date.gte': '2000-01-01',
    'first_air_date.lte': '2005-12-31',
    'vote_count.gte': selectedGenreId ? 20 : 100,
  });
  pool.push({
    key: `${tvPrefix}-theme-retro00s`,
    title: getThemedTitle('Best of the 2000s', 'tv', selectedGenreName),
    fetchUrl: retro00sUrl,
  });

  // Theme B: 90s Nostalgia Trip
  const retro90sUrl = buildScopedQuery('tv', {
    sort_by: 'popularity.desc',
    'first_air_date.gte': '1990-01-01',
    'first_air_date.lte': '1999-12-31',
    'vote_count.gte': selectedGenreId ? 20 : 100,
  });
  pool.push({
    key: `${tvPrefix}-theme-retro90s`,
    title: getThemedTitle('90s Nostalgia Trip', 'tv', selectedGenreName),
    fetchUrl: retro90sUrl,
  });

  // Theme C: In a Bit of a Hurry? Try These 30-Minute Hits!
  const quickUrl = buildScopedQuery('movie', {
    sort_by: 'popularity.desc',
    'with_runtime.lte': 90,
    'vote_count.gte': selectedGenreId ? 12 : 60,
  });
  pool.push({
    key: `${moviePrefix}-theme-quickwatch`,
    title: getThemedTitle('Try These 30-Minute Hits', 'movie', selectedGenreName),
    fetchUrl: quickUrl,
  });

  // Theme D: Popular Series Based on Books (Adaptations)
  const bookUrl = buildScopedQuery('tv', {
    sort_by: 'popularity.desc',
    with_keywords: '818,10214',
    'vote_count.gte': selectedGenreId ? 3 : 20,
  });
  pool.push({
    key: `${tvPrefix}-theme-books`,
    title: getThemedTitle('Series Based on Books', 'tv', selectedGenreName),
    fetchUrl: bookUrl,
  });

  // Theme E: Anime Dubbed in English (Temporarily Disabled)
  /*
  const animeUrl = buildScopedQuery('tv', {
    sort_by: 'popularity.desc',
    with_genres: tvGenreId ? `${tvGenreId},16` : 16,
    with_original_language: 'ja',
    'vote_count.gte': selectedGenreId ? 3 : 20,
  });
  pool.push({
    key: `${tvPrefix}-theme-animedub`,
    title: getThemedTitle('Anime Dubbed in English', 'tv', selectedGenreName),
    fetchUrl: animeUrl,
  });
  */

  // Theme F: Gemini's Spill the Tea (High Drama & Gossip)
  const teaUrl = REQUESTS._build(`${REQUESTS.fetchTrendingMovies.split('/trending')[0]}/discover/tv`, {
    sort_by: 'popularity.desc',
    with_genres: tvGenreId ? `${tvGenreId},18` : '18,10764,10767',
    'vote_count.gte': selectedGenreId ? 3 : 25,
  });
  pool.push({
    key: `${tvPrefix}-theme-spilltea`,
    title: getThemedTitle('Spill the Tea: High Drama & Gossip', 'tv', selectedGenreName),
    fetchUrl: teaUrl,
  });

  // Theme G: Familiar Favorites
  const familiarUrl = buildScopedQuery('movie', {
    sort_by: 'vote_count.desc',
    'vote_average.gte': 6.5,
  });
  pool.push({
    key: `${moviePrefix}-theme-familiar`,
    title: getThemedTitle('Familiar Favorites', 'movie', selectedGenreName),
    fetchUrl: familiarUrl,
  });

  // Theme H: 80s Classics
  const retro80sUrl = buildScopedQuery('tv', {
    sort_by: 'popularity.desc',
    'first_air_date.gte': '1980-01-01',
    'first_air_date.lte': '1989-12-31',
    'vote_count.gte': selectedGenreId ? 10 : 70,
  });
  pool.push({
    key: `${tvPrefix}-theme-retro80s`,
    title: getThemedTitle('80s Classics', 'tv', selectedGenreName),
    fetchUrl: retro80sUrl,
  });

  // Theme I: Netflix Originals / Curated Exclusives
  if (!selectedGenreId) {
    pool.push({
      key: 'home-nf-originals',
      title: 'Netflix Originals',
      fetchUrl: REQUESTS.fetchNetflixOriginals,
    });
  }

  // Standard discover slice interleave
  if (selectedGenreId) {
    const movieSlice = buildGenreManifestSlice({
      mediaType: 'movie',
      selectedGenreId: movieGenreId!,
      selectedGenreName,
      usedUrls,
      hash,
      keyPrefix: moviePrefix,
      year,
      homeHybrid: true,
      skipMicro: true,
      skipFill: true,
    });
    const tvSlice = buildGenreManifestSlice({
      mediaType: 'tv',
      selectedGenreId: tvGenreId!,
      selectedGenreName,
      usedUrls,
      hash: hash + 1,
      keyPrefix: tvPrefix,
      year,
      homeHybrid: true,
      skipMicro: true,
      skipFill: true,
    });

    const maxLen = Math.max(movieSlice.length, tvSlice.length);
    for (let i = 0; i < maxLen; i++) {
      if (movieSlice[i]) pool.push(movieSlice[i]);
      if (tvSlice[i]) pool.push(tvSlice[i]);
    }
  } else {
    // Unfiltered home: dynamic mix of curated categories
    const standardCategories: SmartRow[] = [
      { key: 'home-trending-all', title: 'Trending Now', fetchUrl: REQUESTS.fetchTrending },
      { key: 'home-loved-movies', title: 'Critically Loved Films', fetchUrl: REQUESTS.fetchLoveTheseMovies },
      { key: 'home-award-series', title: 'Award-Winning Series', fetchUrl: REQUESTS.fetchAwardWinningSeries },
      { key: 'home-exciting', title: 'High-Octane Action', fetchUrl: REQUESTS.fetchExcitingMovies },
      { key: 'home-scifi', title: 'Sci-Fi Worlds to Get Lost In', fetchUrl: REQUESTS.fetchSciFiMovies },
      { key: 'home-comedy', title: 'Laugh-Out-Loud Comedies', fetchUrl: REQUESTS.fetchComedyMovies },
      { key: 'home-binge-movies', title: 'Impossible to Watch Just One Episode', fetchUrl: REQUESTS.fetchBoredomBustersMovies },
      { key: 'home-drama', title: 'Drama That Makes You Think', fetchUrl: REQUESTS.fetchCriticallyAcclaimedDrama },
      { key: 'home-crime', title: 'Crime That Keeps You Guessing', fetchUrl: REQUESTS.fetchCrimeTV },
    ];
    pool.push(...standardCategories);
  }

  // Interleave and shuffle the entire dynamic pool based on daily seed to keep page alive!
  const seededPool = seededPick(pool, pool.length, hash);
  seededPool.forEach(row => trackAdd(row));

  // ───────────────────────────────────────────────────────────────────────────
  // 6. SECOND TOP 10 SPLIT (Demoted to index 11+, separated from first)
  // ───────────────────────────────────────────────────────────────────────────
  const top10TvUrl = selectedGenreId
    ? REQUESTS.fetchByGenre('tv', tvGenreId!, 'popularity.desc')
    : REQUESTS.fetchTrendingTV;
  const top10TvSig = makeUrlSig(top10TvUrl);
  if (!usedUrls.has(top10TvSig)) {
    usedUrls.add(top10TvSig);
    
    // Ensure second Top 10 has a nice spacing by placing it far down the list
    const splitIndex = Math.max(11, manifest.length - 2);
    manifest.splice(Math.min(manifest.length, splitIndex), 0, {
      key: `home-genre-top10-tv-${selectedGenreId || 'all'}`,
      title: selectedGenreId ? `Top 10 ${baseGenreName} Series` : 'Top 10 Series in the UK Today',
      fetchUrl: top10TvUrl,
      type: 'top10',
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 7. GLOBAL DYNAMIC FILL
  // ───────────────────────────────────────────────────────────────────────────
  const fillTitles = [
    'Explore More', 'Popular Picks', 'Trending Collections',
    'More to Discover', 'Suggested Titles', 'Viewer Favorites', 'Handpicked Selection',
  ];

  let movieCountTracked = countByPrefix(moviePrefix, manifest);
  let tvCountTracked = countByPrefix(tvPrefix, manifest);
  const targetMin = 22;

  const tryFill = (type: 'movie' | 'tv', genreId: number, page: number, fillIdx: number): boolean => {
    const url = REQUESTS.fetchByGenre(type, genreId, 'popularity.desc') + `&page=${page}`;
    const sig = makeUrlSig(url);
    if (usedUrls.has(sig)) return false;
    usedUrls.add(sig);
    const title = fillTitles[fillIdx % fillTitles.length];
    const slug = title.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const prefix = type === 'movie' ? moviePrefix : tvPrefix;
    return addRow({ key: `${prefix}-fill-${slug}-${page}`, title, fetchUrl: url });
  };

  // If we are active genre, fill dynamically
  if (selectedGenreId) {
    for (let page = 5; manifest.length < targetMin && page < 65; page++) {
      const needMovieBoost = movieCountTracked < Math.max(8, Math.floor(tvCountTracked * 0.75));
      if (needMovieBoost) {
        if (tryFill('movie', movieGenreId!, page, page)) movieCountTracked++;
      } else if (page % 2 === 1) {
        if (tryFill('movie', movieGenreId!, page, page)) movieCountTracked++;
      } else if (tryFill('tv', tvGenreId!, page, page)) {
        tvCountTracked++;
      }
    }
  }
};

const countByPrefix = (prefix: string, manifest: SmartRow[]) => 
  manifest.filter(r => r.key.startsWith(prefix)).length;

export const buildMovieSubpageManifest = (opts: BuildHomeGenreManifestOpts): void => {
  const {
    manifest,
    selectedGenreId,
    selectedGenreName,
    usedUrls,
    hash,
    year,
    addRow,
    continueWatching,
    myList,
    likedEntries,
    continueWatchingRow,
    myListRow,
  } = opts;

  const baseGenreName = selectedGenreName ?? (selectedGenreId ? (GENRE_NAMES[selectedGenreId] ?? GENRES[selectedGenreId] ?? 'Films') : 'Films');

  // Filter Continue Watching for movies only
  let filteredContinueWatchingRow = continueWatchingRow;
  if (continueWatchingRow && continueWatchingRow.data) {
    const moviesOnly = continueWatchingRow.data.filter(m => m.media_type === 'movie' || (!m.media_type && !!m.title));
    if (moviesOnly.length > 0) {
      filteredContinueWatchingRow = { ...continueWatchingRow, data: moviesOnly };
    } else {
      filteredContinueWatchingRow = null;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 1. PRIORITIZED COMFORT ROWS (Based on Card Count)
  // ───────────────────────────────────────────────────────────────────────────
  let CW_at_top = false;
  let ML_at_top = false;

  if (filteredContinueWatchingRow && filteredContinueWatchingRow.data && filteredContinueWatchingRow.data.length >= 4) {
    addRow(filteredContinueWatchingRow);
    CW_at_top = true;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. PERSONALIZED RECOMMENDATIONS (Row 1-2)
  // ───────────────────────────────────────────────────────────────────────────
  let watchRowsCount = 0;
  continueWatching.forEach((m) => {
    if (watchRowsCount >= 1) return;
    const isMovie = m.media_type === 'movie' || (!m.media_type && !!m.title);
    if (!isMovie) return;
    if (selectedGenreId && m.genre_ids && !m.genre_ids.includes(selectedGenreId)) return;

    const url = REQUESTS.fetchSimilar('movie', m.id);
    const sig = makeUrlSig(url);
    if (!usedUrls.has(sig)) {
      usedUrls.add(sig);
      watchRowsCount++;
      addRow({
        key: `movie-personal-watched-${m.id}`,
        title: `Because you watched ${m.title || m.name}`,
        fetchUrl: url,
      });
    }
  });

  if (myListRow && myListRow.data && myListRow.data.length >= 4) {
    addRow(myListRow);
    ML_at_top = true;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. DEMOTED COMFORT ROWS (Index 2-3 if < 4 items)
  // ───────────────────────────────────────────────────────────────────────────
  if (filteredContinueWatchingRow && !CW_at_top) {
    addRow(filteredContinueWatchingRow);
  }

  // Primary Curated Row
  const primaryCuratedUrl = selectedGenreId
    ? REQUESTS.fetchByGenre('movie', selectedGenreId, 'popularity.desc')
    : REQUESTS.fetchTrendingMovies;
  const primaryCuratedSig = makeUrlSig(primaryCuratedUrl);
  if (!usedUrls.has(primaryCuratedSig)) {
    usedUrls.add(primaryCuratedSig);
    addRow({
      key: `movie-primary-curated-${selectedGenreId || 'all'}`,
      title: selectedGenreId ? `Today's Top ${baseGenreName} Picks` : 'Trending Films Right Now',
      fetchUrl: primaryCuratedUrl,
    });
  }

  if (myListRow && !ML_at_top) {
    addRow(myListRow);
  }

  // Liked personalization
  let likedRowsCount = 0;
  likedEntries.forEach((entry) => {
    if (likedRowsCount >= 1) return;
    const m = entry.movie;
    const isMovie = m.media_type === 'movie' || (!m.media_type && !!m.title);
    if (!isMovie) return;
    if (selectedGenreId && m.genre_ids && !m.genre_ids.includes(selectedGenreId)) return;

    const url = REQUESTS.fetchRecommendations('movie', m.id);
    const sig = makeUrlSig(url);
    if (!usedUrls.has(sig)) {
      usedUrls.add(sig);
      likedRowsCount++;
      addRow({
        key: `movie-personal-liked-${m.id}`,
        title: `Because you liked ${m.title || m.name}`,
        fetchUrl: url,
      });
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. TOP 10 PLACEMENTS (Demoted to index 5-8)
  // ───────────────────────────────────────────────────────────────────────────
  const top10Url = selectedGenreId
    ? REQUESTS.fetchByGenre('movie', selectedGenreId, 'popularity.desc')
    : REQUESTS.fetchTrendingMovies;
  const top10Sig = makeUrlSig(top10Url);
  if (!usedUrls.has(top10Sig)) {
    usedUrls.add(top10Sig);
    addRow({
      key: `movie-top10-genre-${selectedGenreId || 'all'}`,
      title: selectedGenreId ? `Top 10 ${baseGenreName} Films` : 'Top 10 Films in the UK Today',
      fetchUrl: top10Url,
      type: 'top10',
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5. THEMATIC ROWS POOL (Interleaved)
  // ───────────────────────────────────────────────────────────────────────────
  const moviePrefix = `movie-${selectedGenreId || 'all'}`;
  const pool: SmartRow[] = [];

  const trackAdd = (row: SmartRow) => {
    addRow(row);
  };

  const buildScopedQuery = (
    mediaType: 'movie',
    baseParams: Record<string, string | number>,
    extra = ''
  ): string => {
    const mergedParams = {
      ...baseParams,
      ...(selectedGenreId && { with_genres: selectedGenreId }),
    };
    return REQUESTS._build(`${REQUESTS.fetchTrendingMovies.split('/trending')[0]}/discover/${mediaType}`, mergedParams, extra);
  };

  // Special Bespoke Curation for Kids & Family (Genre ID 10751)
  if (selectedGenreId === 10751) {
    const ghibliUrl = buildScopedQuery('movie', {
      sort_by: 'popularity.desc',
      with_keywords: '12883', // Studio Ghibli
    });
    pool.push({
      key: `${moviePrefix}-theme-ghibli`,
      title: 'Studio Ghibli Favorites',
      fetchUrl: ghibliUrl,
    });

    const animalUrl = buildScopedQuery('movie', {
      sort_by: 'popularity.desc',
      with_keywords: '3336', // Animal tales
    });
    pool.push({
      key: `${moviePrefix}-theme-animals`,
      title: 'Animal Tales',
      fetchUrl: animalUrl,
    });

    const laughUrl = buildScopedQuery('movie', {
      sort_by: 'popularity.desc',
      with_genres: '35,10751', // Family Comedies
    });
    pool.push({
      key: `${moviePrefix}-theme-family-laughs`,
      title: 'Need a Good Laugh? Family Comedies',
      fetchUrl: laughUrl,
    });
  }

  // Special Bespoke Curation for Crime Films (Genre ID 80)
  if (selectedGenreId === 80) {
    const vintageUrl = buildScopedQuery('movie', {
      sort_by: 'popularity.desc',
      'primary_release_date.lte': '2010-01-01',
      'vote_count.gte': 80,
    });
    pool.push({
      key: `${moviePrefix}-theme-vintage-crime`,
      title: 'Vintage Crime',
      fetchUrl: vintageUrl,
    });

    const trueCrimeUrl = buildScopedQuery('movie', {
      sort_by: 'popularity.desc',
      with_keywords: '818,10224', // based on real life / investigation
    });
    pool.push({
      key: `${moviePrefix}-theme-true-crime-sagas`,
      title: 'True Crime & Real-Life Sagas',
      fetchUrl: trueCrimeUrl,
    });
  }

  // Theme A: Retro Flashback 2000-2005 (Nostalgia Pack)
  const retro00sUrl = buildScopedQuery('movie', {
    sort_by: 'popularity.desc',
    'primary_release_date.gte': '2000-01-01',
    'primary_release_date.lte': '2005-12-31',
    'vote_count.gte': selectedGenreId ? 25 : 120,
  });
  pool.push({
    key: `${moviePrefix}-theme-retro00s`,
    title: getThemedTitle('Best of the 2000s', 'movie', selectedGenreName),
    fetchUrl: retro00sUrl,
  });

  // Theme B: 90s Nostalgia Trip
  const retro90sUrl = buildScopedQuery('movie', {
    sort_by: 'popularity.desc',
    'primary_release_date.gte': '1990-01-01',
    'primary_release_date.lte': '1999-12-31',
    'vote_count.gte': selectedGenreId ? 25 : 120,
  });
  pool.push({
    key: `${moviePrefix}-theme-retro90s`,
    title: getThemedTitle('90s Nostalgia Trip', 'movie', selectedGenreName),
    fetchUrl: retro90sUrl,
  });

  // Theme C: 80s Classics
  const retro80sUrl = buildScopedQuery('movie', {
    sort_by: 'popularity.desc',
    'primary_release_date.gte': '1980-01-01',
    'primary_release_date.lte': '1989-12-31',
    'vote_count.gte': selectedGenreId ? 12 : 80,
  });
  pool.push({
    key: `${moviePrefix}-theme-retro80s`,
    title: getThemedTitle('80s Classics', 'movie', selectedGenreName),
    fetchUrl: retro80sUrl,
  });

  // Theme D: Quick Watch Films (Runtime <= 90 mins)
  const quickUrl = buildScopedQuery('movie', {
    sort_by: 'popularity.desc',
    'with_runtime.lte': 90,
    'vote_count.gte': selectedGenreId ? 12 : 60,
  });
  pool.push({
    key: `${moviePrefix}-theme-quickwatch`,
    title: selectedGenreName ? `Quick ${selectedGenreName} Films` : 'In a Hurry? Films Under 90 Minutes',
    fetchUrl: quickUrl,
  });

  // Theme E: Adaptations
  const bookUrl = buildScopedQuery('movie', {
    sort_by: 'popularity.desc',
    with_keywords: '818,10214',
    'vote_count.gte': selectedGenreId ? 5 : 40,
  });
  pool.push({
    key: `${moviePrefix}-theme-books`,
    title: selectedGenreName ? `${selectedGenreName} Films Based on Books` : 'Films Based on Books',
    fetchUrl: bookUrl,
  });

  // Theme F: Familiar Favorites
  const familiarUrl = buildScopedQuery('movie', {
    sort_by: 'vote_count.desc',
    'vote_average.gte': 6.5,
  });
  pool.push({
    key: `${moviePrefix}-theme-familiar`,
    title: getThemedTitle('Familiar Favorites', 'movie', selectedGenreName),
    fetchUrl: familiarUrl,
  });

  // If a genre is selected, merge genre-specific slices!
  if (selectedGenreId) {
    const movieSlice = buildGenreManifestSlice({
      mediaType: 'movie',
      selectedGenreId: selectedGenreId,
      selectedGenreName,
      usedUrls,
      hash,
      keyPrefix: moviePrefix,
      year,
      homeHybrid: false,
      skipMicro: false,
      skipFill: true,
    });
    pool.push(...movieSlice);
  } else {
    // Curated standard film categories
    const curatedCategories: SmartRow[] = [
      { key: 'movie-trending', title: 'Trending Films Right Now', fetchUrl: REQUESTS.fetchTrendingMovies },
      { key: 'movie-exciting', title: 'High-Octane Action Films', fetchUrl: REQUESTS.fetchExcitingMovies },
      { key: 'movie-toprated', title: 'The Films That Stood the Test of Time', fetchUrl: REQUESTS.fetchTopRated },
      { key: 'movie-scifi', title: 'Sci-Fi Worlds to Get Lost In', fetchUrl: REQUESTS.fetchSciFiMovies },
      { key: 'movie-drama', title: 'Dramas That Leave a Mark', fetchUrl: REQUESTS.fetchLoveTheseMovies },
      { key: 'movie-horror', title: 'Horror That Haunts You', fetchUrl: REQUESTS.fetchHorrorMovies },
      { key: 'movie-comedy', title: "Comedies You'll Actually Laugh At", fetchUrl: REQUESTS.fetchComedyMovies },
      { key: 'movie-romance', title: 'Romance Done Right', fetchUrl: REQUESTS.fetchRomanceMovies },
      { key: 'movie-action', title: 'Pure Adrenaline', fetchUrl: REQUESTS.fetchActionMovies },
      { key: 'movie-docs', title: 'Documentaries Worth Your Evening', fetchUrl: REQUESTS.fetchDocumentaries },
      { key: 'movie-buster', title: "Films for When You Can't Decide", fetchUrl: REQUESTS.fetchBoredomBustersMovies },
      { key: 'movie-fav', title: 'Crowd Favourites', fetchUrl: REQUESTS.fetchFamiliarFavoritesMovies },
      { key: 'movie-intl', title: 'International Cinema Worth Seeking Out', fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'popularity.desc') + '&without_original_language=en' },
      { key: 'movie-hidden', title: 'Films Flying Under the Radar', fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'vote_average.desc') + '&vote_count.gte=100&vote_count.lte=1000' },
      { key: 'movie-year', title: `The Best Films of ${year}`, fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'vote_average.desc') + `&release_date.gte=${year}-01-01&vote_count.gte=50` },
      { key: 'movie-classics', title: 'The Untouchable Film Classics', fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'vote_average.desc') + '&release_date.lte=2000-01-01&vote_count.gte=2000' },
    ];
    pool.push(...curatedCategories);
  }

  // Interleave and shuffle the entire dynamic pool based on daily seed to keep page alive!
  const seededPool = seededPick(pool, pool.length, hash);
  seededPool.forEach(row => trackAdd(row));

  // Global Dynamic Fill
  const fillTitles = [
    'Explore More', 'Popular Picks', 'Trending Collections',
    'More to Discover', 'Suggested Titles', 'Viewer Favorites', 'Handpicked Selection',
  ];

  if (selectedGenreId) {
    for (let page = 5; manifest.length < 22 && page < 65; page++) {
      const url = REQUESTS.fetchByGenre('movie', selectedGenreId, 'popularity.desc') + `&page=${page}`;
      const sig = makeUrlSig(url);
      if (!usedUrls.has(sig)) {
        usedUrls.add(sig);
        const title = fillTitles[page % fillTitles.length];
        const slug = title.toLowerCase().replace(/[^a-z0-9]/g, '-');
        addRow({ key: `movie-fill-${slug}-${page}`, title, fetchUrl: url });
      }
    }
  }

  // Secondary Top-10 / mid top-10
  const midUrl = selectedGenreId 
    ? REQUESTS.fetchByGenre('movie', selectedGenreId, 'popularity.desc') + '&page=2'
    : REQUESTS.fetchTrendingMovies + '?page=2';
  const midSig = makeUrlSig(midUrl);
  if (!usedUrls.has(midSig)) {
    usedUrls.add(midSig);
    
    // Gap it down to split the Top 10s nicely
    const splitIndex = Math.max(11, manifest.length - 2);
    manifest.splice(Math.min(manifest.length, splitIndex), 0, {
      key: `movie-mid-top10-${selectedGenreId || 'all'}`,
      title: selectedGenreId 
        ? `Trending ${baseGenreName} Films`
        : `Trending Films in the UK Today`,
      fetchUrl: midUrl,
      type: 'top10',
    });
  }
};

export const buildTvSubpageManifest = (opts: BuildHomeGenreManifestOpts): void => {
  const {
    manifest,
    selectedGenreId,
    selectedGenreName,
    usedUrls,
    hash,
    year,
    addRow,
    continueWatching,
    myList,
    likedEntries,
    continueWatchingRow,
    myListRow,
  } = opts;

  const baseGenreName = selectedGenreName ?? (selectedGenreId ? (GENRE_NAMES[selectedGenreId] ?? GENRES[selectedGenreId] ?? 'Series') : 'Series');

  // Filter Continue Watching for TV series only
  let filteredContinueWatchingRow = continueWatchingRow;
  if (continueWatchingRow && continueWatchingRow.data) {
    const tvOnly = continueWatchingRow.data.filter(m => m.media_type === 'tv' || (!m.media_type && !m.title));
    if (tvOnly.length > 0) {
      filteredContinueWatchingRow = { ...continueWatchingRow, data: tvOnly };
    } else {
      filteredContinueWatchingRow = null;
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 1. PRIORITIZED COMFORT ROWS (Based on Card Count)
  // ───────────────────────────────────────────────────────────────────────────
  let CW_at_top = false;
  let ML_at_top = false;

  if (filteredContinueWatchingRow && filteredContinueWatchingRow.data && filteredContinueWatchingRow.data.length >= 4) {
    addRow(filteredContinueWatchingRow);
    CW_at_top = true;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. PERSONALIZED RECOMMENDATIONS (Row 1-2)
  // ───────────────────────────────────────────────────────────────────────────
  let watchRowsCount = 0;
  continueWatching.forEach((m) => {
    if (watchRowsCount >= 1) return;
    const isTV = m.media_type === 'tv' || (!m.media_type && !m.title);
    if (!isTV) return;
    if (selectedGenreId && m.genre_ids && !m.genre_ids.includes(selectedGenreId)) return;

    const url = REQUESTS.fetchSimilar('tv', m.id);
    const sig = makeUrlSig(url);
    if (!usedUrls.has(sig)) {
      usedUrls.add(sig);
      watchRowsCount++;
      addRow({
        key: `tv-personal-watched-${m.id}`,
        title: `Because you watched ${m.title || m.name}`,
        fetchUrl: url,
      });
    }
  });

  if (myListRow && myListRow.data && myListRow.data.length >= 4) {
    addRow(myListRow);
    ML_at_top = true;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. DEMOTED COMFORT ROWS (Index 2-3 if < 4 items)
  // ───────────────────────────────────────────────────────────────────────────
  if (filteredContinueWatchingRow && !CW_at_top) {
    addRow(filteredContinueWatchingRow);
  }

  // Primary Curated Row
  const primaryCuratedUrl = selectedGenreId
    ? REQUESTS.fetchByGenre('tv', selectedGenreId, 'popularity.desc')
    : REQUESTS.fetchTrendingTV;
  const primaryCuratedSig = makeUrlSig(primaryCuratedUrl);
  if (!usedUrls.has(primaryCuratedSig)) {
    usedUrls.add(primaryCuratedSig);
    addRow({
      key: `tv-primary-curated-${selectedGenreId || 'all'}`,
      title: selectedGenreId ? `Today's Top ${baseGenreName} Picks` : 'Trending Series Right Now',
      fetchUrl: primaryCuratedUrl,
    });
  }

  if (myListRow && !ML_at_top) {
    addRow(myListRow);
  }

  // Liked personalization
  let likedRowsCount = 0;
  likedEntries.forEach((entry) => {
    if (likedRowsCount >= 1) return;
    const m = entry.movie;
    const isTV = m.media_type === 'tv' || (!m.media_type && !m.title);
    if (!isTV) return;
    if (selectedGenreId && m.genre_ids && !m.genre_ids.includes(selectedGenreId)) return;

    const url = REQUESTS.fetchRecommendations('tv', m.id);
    const sig = makeUrlSig(url);
    if (!usedUrls.has(sig)) {
      usedUrls.add(sig);
      likedRowsCount++;
      addRow({
        key: `tv-personal-liked-${m.id}`,
        title: `Because you liked ${m.title || m.name}`,
        fetchUrl: url,
      });
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. TOP 10 PLACEMENTS (Demoted to index 5-8)
  // ───────────────────────────────────────────────────────────────────────────
  const top10Url = selectedGenreId
    ? REQUESTS.fetchByGenre('tv', selectedGenreId, 'popularity.desc')
    : REQUESTS.fetchTrendingTV;
  const top10Sig = makeUrlSig(top10Url);
  if (!usedUrls.has(top10Sig)) {
    usedUrls.add(top10Sig);
    addRow({
      key: `tv-top10-genre-${selectedGenreId || 'all'}`,
      title: selectedGenreId ? `Top 10 ${baseGenreName} Series` : 'Top 10 Series in the UK Today',
      fetchUrl: top10Url,
      type: 'top10',
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5. THEMATIC ROWS POOL (Interleaved)
  // ───────────────────────────────────────────────────────────────────────────
  const tvPrefix = `tv-${selectedGenreId || 'all'}`;
  const pool: SmartRow[] = [];

  const trackAdd = (row: SmartRow) => {
    addRow(row);
  };

  const buildScopedQuery = (
    mediaType: 'tv',
    baseParams: Record<string, string | number>,
    extra = ''
  ): string => {
    const mergedParams = {
      ...baseParams,
      ...(selectedGenreId && { with_genres: selectedGenreId }),
    };
    return REQUESTS._build(`${REQUESTS.fetchTrendingTV.split('/trending')[0]}/discover/${mediaType}`, mergedParams, extra);
  };

  // Special Bespoke Curation for Comedy Series (Genre ID 35)
  if (selectedGenreId === 35) {
    const quickUrl = REQUESTS._build(`${REQUESTS.fetchTrendingTV.split('/trending')[0]}/discover/tv`, {
      sort_by: 'popularity.desc',
      with_genres: '35',
      'vote_count.gte': 50,
    });
    pool.push({
      key: `${tvPrefix}-theme-quickwatch`,
      title: 'In a Bit of a Hurry? Try These 30-Minute Hits',
      fetchUrl: quickUrl,
    });

    const bustersUrl = REQUESTS._build(`${REQUESTS.fetchTrendingTV.split('/trending')[0]}/discover/tv`, {
      sort_by: 'popularity.desc',
      with_genres: '35',
      with_keywords: '1701', // Sitcoms / workplace
    });
    pool.push({
      key: `${tvPrefix}-theme-comedy-busters`,
      title: 'Boredom Busters Workplace Sitcoms',
      fetchUrl: bustersUrl,
    });

    const crimeComedyUrl = REQUESTS._build(`${REQUESTS.fetchTrendingTV.split('/trending')[0]}/discover/tv`, {
      sort_by: 'popularity.desc',
      with_genres: '35,80', // Crime + Comedy
    });
    pool.push({
      key: `${tvPrefix}-theme-crime-comedy`,
      title: 'Crime Comedy Series',
      fetchUrl: crimeComedyUrl,
    });
  }

  // Special Bespoke Curation for Action & Adventure Series (Genre ID 10759)
  if (selectedGenreId === 10759) {
    const watchPartyUrl = buildScopedQuery('tv', {
      sort_by: 'popularity.desc',
      'vote_average.gte': 7.0,
    });
    pool.push({
      key: `${tvPrefix}-theme-watch-party`,
      title: 'Watch-Party Picks to Get the Crew Talking',
      fetchUrl: watchPartyUrl,
    });

    const usDramaUrl = buildScopedQuery('tv', {
      sort_by: 'popularity.desc',
      with_origin_country: 'US',
    });
    pool.push({
      key: `${tvPrefix}-theme-us-dramas`,
      title: 'US Drama Series',
      fetchUrl: usDramaUrl,
    });
  }

  // Theme A: Retro Flashback 2000-2005 (Nostalgia Pack)
  const retro00sUrl = buildScopedQuery('tv', {
    sort_by: 'popularity.desc',
    'first_air_date.gte': '2000-01-01',
    'first_air_date.lte': '2005-12-31',
    'vote_count.gte': selectedGenreId ? 20 : 100,
  });
  pool.push({
    key: `${tvPrefix}-theme-retro00s`,
    title: getThemedTitle('Best of the 2000s', 'tv', selectedGenreName),
    fetchUrl: retro00sUrl,
  });

  // Theme B: 90s Nostalgia Trip
  const retro90sUrl = buildScopedQuery('tv', {
    sort_by: 'popularity.desc',
    'first_air_date.gte': '1990-01-01',
    'first_air_date.lte': '1999-12-31',
    'vote_count.gte': selectedGenreId ? 20 : 100,
  });
  pool.push({
    key: `${tvPrefix}-theme-retro90s`,
    title: getThemedTitle('90s Nostalgia Trip', 'tv', selectedGenreName),
    fetchUrl: retro90sUrl,
  });

  // Theme C: 30-Minute Hits! (Fallback)
  if (selectedGenreId !== 35) {
    const quickTVGenreFallback = selectedGenreId ? selectedGenreId : '35,16,10762';
    const quickUrl = REQUESTS._build(`${REQUESTS.fetchTrendingTV.split('/trending')[0]}/discover/tv`, {
      sort_by: 'popularity.desc',
      with_genres: quickTVGenreFallback || '',
      'vote_count.gte': selectedGenreId ? 20 : 150,
    });
    pool.push({
      key: `${tvPrefix}-theme-quickwatch`,
      title: getThemedTitle('Try These 30-Minute Hits', 'tv', selectedGenreName),
      fetchUrl: quickUrl,
    });
  }

  // Theme D: Popular Series Based on Books (Adaptations)
  const bookUrl = buildScopedQuery('tv', {
    sort_by: 'popularity.desc',
    with_keywords: '818,10214',
    'vote_count.gte': selectedGenreId ? 10 : 80,
  });
  pool.push({
    key: `${tvPrefix}-theme-books`,
    title: getThemedTitle('Series Based on Books', 'tv', selectedGenreName),
    fetchUrl: bookUrl,
  });

  // Theme E: Anime Dubbed in English (Temporarily Disabled)
  /*
  const animeUrl = buildScopedQuery('tv', {
    sort_by: 'popularity.desc',
    with_genres: selectedGenreId ? `${selectedGenreId},16` : 16,
    with_original_language: 'ja',
    'vote_count.gte': selectedGenreId ? 10 : 80,
  });
  pool.push({
    key: `${tvPrefix}-theme-animedub`,
    title: getThemedTitle('Anime Dubbed in English', 'tv', selectedGenreName),
    fetchUrl: animeUrl,
  });
  */

  // Theme F: Gossip & High Drama
  const teaUrl = REQUESTS._build(`${REQUESTS.fetchTrendingTV.split('/trending')[0]}/discover/tv`, {
    sort_by: 'popularity.desc',
    with_genres: selectedGenreId ? `${selectedGenreId},18` : '18,10764,10767',
    'vote_count.gte': selectedGenreId ? 10 : 100,
  });
  pool.push({
    key: `${tvPrefix}-theme-spilltea`,
    title: getThemedTitle('Spill the Tea: High Drama & Gossip', 'tv', selectedGenreName),
    fetchUrl: teaUrl,
  });

  // If a genre is selected, merge genre-specific slices!
  if (selectedGenreId) {
    const tvSlice = buildGenreManifestSlice({
      mediaType: 'tv',
      selectedGenreId: selectedGenreId,
      selectedGenreName,
      usedUrls,
      hash,
      keyPrefix: tvPrefix,
      year,
      homeHybrid: false,
      skipMicro: false,
      skipFill: true,
    });
    pool.push(...tvSlice);
  } else {
    // Curated standard TV categories
    const curatedCategories: SmartRow[] = [
      { key: 'tv-trending', title: 'Trending Series Right Now', fetchUrl: REQUESTS.fetchTrendingTV },
      { key: 'tv-originals', title: 'Netflix Originals', fetchUrl: REQUESTS.fetchNetflixOriginals },
      { key: 'tv-award', title: 'Award-Winning Series', fetchUrl: REQUESTS.fetchAwardWinningSeries },
      { key: 'tv-crime', title: 'Crime Series That Keep You Guessing', fetchUrl: REQUESTS.fetchCrimeTV },
      { key: 'tv-drama', title: 'Drama Series With Depth', fetchUrl: REQUESTS.fetchDramaTV },
      { key: 'tv-action', title: 'Action & Adventure Series', fetchUrl: REQUESTS.fetchActionTV },
      { key: 'tv-comedy', title: 'Comedies That Never Get Old', fetchUrl: REQUESTS.fetchComedyTV },
      { key: 'tv-binge', title: 'Impossible to Watch Just One Episode', fetchUrl: REQUESTS.fetchBoredomBustersTV },
      { key: 'tv-scifi', title: 'Sci-Fi & Fantasy Worlds', fetchUrl: REQUESTS.fetchImaginativeSeries },
      { key: 'tv-loved', title: 'Loved by Critics & Audiences Alike', fetchUrl: REQUESTS.fetchLoveTheseTV },
      { key: 'tv-reality', title: 'Reality TV Worth Watching', fetchUrl: REQUESTS.fetchRealityTV },
      { key: 'tv-us', title: 'US Series Dominating Right Now', fetchUrl: REQUESTS.fetchUSSeries },
      { key: 'tv-exciting', title: 'High-Stakes Series', fetchUrl: REQUESTS.fetchExcitingSeriesTV },
      { key: 'tv-docs', title: 'Documentary Series That Change Minds', fetchUrl: REQUESTS.fetchDocumentaries },
      { key: 'tv-korean', title: 'K-Drama: Where to Start', fetchUrl: REQUESTS.fetchByGenre('tv', 18, 'popularity.desc') + '&with_origin_country=KR' },
      { key: 'tv-british', title: 'British Series Worth the Accent', fetchUrl: REQUESTS.fetchByGenre('tv', 18, 'popularity.desc') + '&with_origin_country=GB' },
      { key: 'tv-anime', title: 'Anime Series Worth the Hype', fetchUrl: REQUESTS.fetchByGenre('tv', 16, 'popularity.desc') + '&with_origin_country=JP' },
      { key: 'tv-family', title: 'Family Series for All Ages', fetchUrl: REQUESTS.fetchByGenre('tv', 10751, 'popularity.desc') },
      { key: 'tv-mystery', title: 'Mystery Series: Every Episode a Puzzle', fetchUrl: REQUESTS.fetchByGenre('tv', 9648, 'popularity.desc') },
      { key: 'tv-hidden', title: 'Hidden Gems: Series Nobody Told You About', fetchUrl: REQUESTS.fetchByGenre('tv', 18, 'vote_average.desc') + '&vote_count.gte=100&vote_count.lte=1000' },
      { key: 'tv-longrun', title: 'Long-Running Series Worth Starting', fetchUrl: REQUESTS.fetchByGenre('tv', 18, 'vote_count.desc') + '&vote_average.gte=7' },
      { key: 'tv-limited', title: 'Limited Series: One Weekend, Done', fetchUrl: REQUESTS.fetchByGenre('tv', 18, 'vote_average.desc') + '&vote_count.gte=200&page=2' },
      { key: 'tv-scifi2', title: 'Sci-Fi Series That Make You Think', fetchUrl: REQUESTS.fetchByGenre('tv', 10765, 'vote_average.desc') + '&vote_count.gte=300' },
    ];
    pool.push(...curatedCategories);
  }

  // Interleave and shuffle the entire dynamic pool based on daily seed to keep page alive!
  const seededPool = seededPick(pool, pool.length, hash);
  seededPool.forEach(row => trackAdd(row));

  // Global Dynamic Fill
  const fillTitles = [
    'Explore More', 'Popular Picks', 'Trending Collections',
    'More to Discover', 'Suggested Titles', 'Viewer Favorites', 'Handpicked Selection',
  ];
  const targetMin = 22;

  if (selectedGenreId) {
    for (let page = 5; manifest.length < targetMin && page < 65; page++) {
      const url = REQUESTS.fetchByGenre('tv', selectedGenreId, 'popularity.desc') + `&page=${page}`;
      const sig = makeUrlSig(url);
      if (!usedUrls.has(sig)) {
        usedUrls.add(sig);
        const title = fillTitles[page % fillTitles.length];
        const slug = title.toLowerCase().replace(/[^a-z0-9]/g, '-');
        addRow({ key: `tv-fill-${slug}-${page}`, title, fetchUrl: url });
      }
    }
  }

  // Secondary Top-10 / mid top-10
  const midUrl = selectedGenreId 
    ? REQUESTS.fetchByGenre('tv', selectedGenreId, 'popularity.desc') + '&page=2'
    : REQUESTS.fetchTrendingTV + '?page=2';
  const midSig = makeUrlSig(midUrl);
  if (!usedUrls.has(midSig)) {
    usedUrls.add(midSig);
    insertTop10(
      manifest,
      `tv-mid-top10-${selectedGenreId || 'all'}`,
      selectedGenreId 
        ? `Trending ${baseGenreName} Series`
        : `Trending Series in the UK`,
      midUrl,
      Math.min(manifest.length, 8),
    );
  }
};
