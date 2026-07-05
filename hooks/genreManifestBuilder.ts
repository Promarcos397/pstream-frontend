import {
  MICRO_GENRES, GENRES, ADJACENT_GENRES,
} from '../data/genres';
import { REQUESTS, BASE_URL } from '../constants';
import { resolveGenreId, isTvOnlyGenreId, isMovieOnlyGenreId } from '../data/pageGenres';
import type { SmartRow } from './useDynamicManifest';
import { Movie } from '../types';

// Randomises pool order every browser session (changes on page refresh/new tab)
const SESSION_SEED = Math.floor(Math.random() * 2147483647);

const GENRE_NAMES: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Anime', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction',
  53: 'Thriller', 10752: 'War', 37: 'Western',
  10759: 'Action & Adventure', 10765: 'Sci-Fi & Fantasy', 10768: 'War & Politics',
  10764: 'Reality', 10763: 'News', 10766: 'Soap', 10767: 'Talk', 10762: 'Kids',
};

/**
 * Hash-rotated seed picker for "Because you watched/liked" rows: spreads the
 * picks across the pool (not just the newest item) and rotates them with the
 * daily hash, so the page recommends off different titles day to day while
 * staying deterministic within a session.
 */
export const pickPersonalSeeds = <T,>(items: T[], hash: number, count: number): T[] => {
  if (items.length === 0 || count <= 0) return [];
  if (items.length <= count) return items.slice(0, count);
  const step = Math.max(1, Math.floor(items.length / count));
  const picked = new Set<T>();
  for (let i = 0; i < count; i++) {
    picked.add(items[(hash + i * step) % items.length]);
  }
  return [...picked];
};


export const sanitizeTmdbQuery = (extra: string, mediaType: 'movie' | 'tv'): string => {
  if (!extra) return extra;

  let sanitized = extra;

  // 1. Fix double with_keywords by joining them with a comma (AND) or pipe (OR)
  // Actually, TMDB API accepts comma-separated list.
  // The user wrote multiple &with_keywords=A&with_keywords=B which causes API error.
  const keywordsMatch = [...sanitized.matchAll(/&with_keywords=([0-9|]+)/g)];
  if (keywordsMatch.length > 1) {
    const combined = keywordsMatch.map(m => m[1]).join(',');
    sanitized = sanitized.replace(/&with_keywords=[0-9|]+/g, '');
    sanitized += `&with_keywords=${combined}`;
  }

  // 2. Fix mediaType genre incompatibilities
  // The user merged TV and Movie rows, causing TV pages to request Movie genres (and vice versa).
  // We'll strip invalid genre requests or remap them to the closest equivalent.
  const genreMatch = sanitized.match(/&with_genres=([0-9|]+)/);
  if (genreMatch) {
    let genres = genreMatch[1].split('|');
    
    if (mediaType === 'tv') {
      genres = genres.map(g => {
        if (g === '28') return '10759'; // Action -> Action & Adventure
        if (g === '12') return '10759'; // Adventure -> Action & Adventure
        if (g === '878') return '10765'; // Sci-Fi -> Sci-Fi & Fantasy
        if (g === '14') return '10765'; // Fantasy -> Sci-Fi & Fantasy
        if (g === '10752') return '10768'; // War -> War & Politics
        if (g === '27') return '9648'; // Horror -> Mystery (closest TV match)
        if (g === '53') return '18'; // Thriller -> Drama
        if (g === '10749') return '18'; // Romance -> Drama
        if (g === '36') return '18'; // History -> Drama
        if (g === '10402') return ''; // Music has no direct TV genre, drop it or map to reality/talk? We drop it.
        return g;
      }).filter(Boolean);
    } else {
      genres = genres.map(g => {
        if (g === '10759') return '28|12'; // Action & Adventure -> Action/Adventure
        if (g === '10765') return '878|14'; // Sci-Fi & Fantasy -> Sci-Fi/Fantasy
        if (g === '10768') return '10752|36'; // War & Politics -> War/History
        if (['10762', '10763', '10764', '10766', '10767'].includes(g)) return ''; // Kids/News/Reality/Soap/Talk -> Remove
        return g;
      }).filter(Boolean);
    }

    sanitized = sanitized.replace(/&with_genres=[0-9|]+/g, '');
    if (genres.length > 0) {
      sanitized += `&with_genres=${genres.join('|')}`;
    }
  }

  return sanitized;
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

export const getPremiumFillTitles = (genreName: string, mediaType: 'movie' | 'tv'): string[] => {
  const isTV = mediaType === 'tv';
  const term = isTV ? 'Series' : 'Films';
  const g = genreName.toLowerCase();

  if (g.includes('action')) {
    return [
      'Adrenaline Rush', 'High-Octane Rides', 'Explosive Showdowns',
      'Fight to the Finish', 'Edge-of-Your-Seat Thrills', 'Stunt Spectacles',
      'Combative Chaos', 'Fast & Furious Action', 'Ruthless Heroes', 'Unstoppable Force'
    ];
  }
  if (g.includes('anime')) {
    return [
      'Otaku Favorites', 'Must-Watch Anime Sagas', 'Legendary Anime Worlds',
      'Stunning Animated Artistry', 'Action-Packed Shonen', 'Heartfelt Anime Stories',
      'Mind-Bending Anime Concepts', 'Imaginative Journeys', 'Chibi & Comedic Fun', 'Dark Fantasy Sagas'
    ];
  }
  if (g.includes('astrology') || g.includes('cosmic') || g.includes('spiritual')) {
    return [
      'Cosmic Vibrations', 'Destined Paths', 'Celestial Journeys',
      'Written in the Stars', 'Spiritual Awakening', 'Karma & Consequences',
      'Astrological Alignments', 'Fate and Fortune', 'Mystic Realities', 'Ethereal Encounters'
    ];
  }
  if (g.includes('black')) {
    return [
      'Black Culture Icons', 'Powerful Black Cinema', 'Resilient Voices',
      'Celebrating Black Brilliance', 'Soulful Storytelling', 'Groundbreaking Narratives',
      'Cultural Showcases', 'Inspiring Black Leaders', 'Trailblazing Directors', 'Uncompromising Truths'
    ];
  }
  if (g.includes('book') || g.includes('adaptation')) {
    return [
      'Literary Masterpieces', 'From Page to Screen', 'Bestselling Adaptations',
      'Novel Concepts', 'Chapter & Verse Sagas', 'Poetic Translations',
      'Adapted Classics', 'Written Words Visualized', 'Critically Loved Adaptations', 'Book Club Favorites'
    ];
  }
  if (g.includes('british')) {
    return [
      'Wry British Humor', 'Gritty British Crime', 'U.K. Prestige Drama',
      'Across the Pond Gems', 'British Period Sagas', 'Charming British Tales',
      'Classic British Mysteries', 'London Calling Stories', 'High Society & Scandals', 'British Favorites'
    ];
  }
  if (g.includes('classic')) {
    return [
      'Golden Age Masterpieces', 'Vintage Treasures', 'Silver Screen Classics',
      'Hollywood Legends', 'Timeless Classics', 'Essential Film School',
      'Iconic Performances', 'Cinematic Milestones', 'Classic Masterpieces', 'Retro Screen Favorites'
    ];
  }
  if (g.includes('comed') || g.includes('funny')) {
    return [
      'Guaranteed Laughs', 'Belly Laugh Sitcoms', 'Witty & Sharp Comedies',
      'Lighthearted Escapes', 'Hilarious Misadventures', 'Slapstick & Goofy Fun',
      'Sarcastic & Satirical Picks', 'Crowd-Pleasing Comedy', 'Feel-Good Chuckles', 'Late Night Comedy'
    ];
  }
  if (g.includes('crime')) {
    return [
      'Grisly Crime Sagas', 'Cops vs. Criminals', 'Underworld Corruption',
      'Mastermind Heists', 'Gritty Crime Investigations', 'Hardboiled Detectives',
      'Mafia & Syndicate Secrets', 'Cold Case Thrillers', 'Intriguing Alibis', 'Legal Scandals'
    ];
  }
  if (g.includes('cult')) {
    return [
      'Cult Phenomenons', 'Strange & Unusual', 'B-Movie Wonders',
      'Midnight Movie Favorites', 'Outrageously Unique', 'Campy & Offbeat',
      'Subversive Masterpieces', 'Underground Cinema', 'Oddball Favorites', 'Mind-Melting Cults'
    ];
  }
  if (g.includes('doc')) {
    return [
      'Eye-Opening Documentaries', 'Real Life Exposed', 'Historical Recounts',
      'Unbelievable Truths', 'Inspiring Real Stories', 'Shocking Exposes',
      'Human Condition Portraits', 'Planet Earth Wonders', 'Sports Behind the Scenes', 'Art & Culture Chronicles'
    ];
  }
  if (g.includes('drama')) {
    return [
      'Tear-Jerkers & Heartbreaks', 'Prestige Character Studies', 'High-Stakes Melodrama',
      'Quiet & Reflective Stories', 'Tense Family Sagas', 'Powerful Social Dramas',
      'Award-Winning Performances', 'Gripping Human Stories', 'Moral Dilemmas', 'Stellar Adaptations'
    ];
  }
  if (g.includes('european') || g.includes('euro')) {
    return [
      'Euro-Cinema Treasures', 'French New Wave & Beyond', 'Gritty Scandinavian Noir',
      'Passionate Southern Euro Dramas', 'Award-Winning European Cinema', 'European Art-House',
      'Bilingual Thrills', 'Continental Favorites', 'Cross-Border Mysteries', 'Euro Comedy Hits'
    ];
  }
  if (g.includes('fantasy')) {
    return [
      'Epic Fantasy Worlds', 'Swords & Sorcery', 'Mythological Quests',
      'Spells & Enchantments', 'Magical Kingdoms', 'High Fantasy Sagas',
      'Urban Fantasy Tales', 'Dark Fairy Tales', 'Imaginative World-Building', 'Legendary Monsters'
    ];
  }
  if (g.includes('hollywood') || g === 'us' || g === 'usa') {
    return [
      'Blockbuster Spectacles', 'All-American Classics', 'Prestige American Cinema',
      'Indie USA Gems', 'Hollywood Glitz & Glamour', 'Star-Studded Casts',
      'Epic American Journeys', 'Heartland Stories', 'US Box Office Hits', 'American Masterpieces'
    ];
  }
  if (g.includes('horror') || g.includes('spooky')) {
    return [
      'Gory Slashers', 'Bone-Chilling Supernatural', 'Creepy Creature Features',
      'Nightmarish Visions', 'Psychological Dread', 'Haunted Houses & Spirits',
      'Jump-Scare Fest', 'Disturbing Psychological Horrors', 'Folk Horror & Occult', 'Horror Comedy Favorites'
    ];
  }
  if (g.includes('indie') || g.includes('independent')) {
    return [
      'Sundance Favorites', 'Bold & Uncompromised', 'Low-Budget Masterpieces',
      'Art-House Visions', 'Quirky Character Pieces', 'Emotional Rawness',
      'Under-the-Radar Indie Gems', 'Festival Award Winners', 'Alternative Storytelling', 'Independent Spirits'
    ];
  }
  if (g.includes('intl') || g.includes('international') || g.includes('world')) {
    return [
      'Subtitled Masterpieces', 'Global Box Office Hits', 'Award-Winning World Cinema',
      'Foreign Language Thrills', 'Cultures & Perspectives', 'Cinematic Travels',
      'Cross-Cultural Gems', 'Acclaimed International Hits', 'Hidden Gems Worldwide', 'Diverse Narratives'
    ];
  }
  if (g.includes('kids') || g.includes('family')) {
    return [
      'Fun for All Ages', 'Animated Magic', 'Wholesome Adventures',
      'Animal Buddies', 'Bedtime Stories', 'Magical Family Nights',
      'Heartwarming Family Classics', 'Teen & Pre-Teen Fun', 'Playful & Silly Tales', 'Inspiring Youth Journeys'
    ];
  }
  if (g.includes('lgbtq') || g.includes('pride')) {
    return [
      'Loud & Proud', 'Queer Cinema Milestones', 'Heartfelt LGBTQ+ Romance',
      'Triumphant Trans & Non-Binary Stories', 'GLAAD Award Nominees', 'Warm & Fuzzy Queer Stories',
      'Uncompromising Queer Truths', 'Queer Community Sagas', 'Iconic Queer Characters', 'Celebrating Pride'
    ];
  }
  if (g.includes('moods') || g.includes('vibes')) {
    return [
      'Cozy & Chill Vibes', 'Intense & Cathartic', 'Feel-Good Energy Boosters',
      'Dark & Moody Atmospheres', 'Mind-Bending Trippy Rides', 'Nostalgic Comforts',
      'Melancholy Masterpieces', 'Inspiring & Uplifting', 'High-Anxiety Suspense', 'Relaxed & Breezy Picks'
    ];
  }
  if (g.includes('music')) {
    return [
      'Toe-Tapping Musicals', 'Epic Rock Biopics', 'Concert & Live Magic',
      'Behind the Beats: Hip Hop', 'Soulful Soundtracks', 'Musical Melodramas',
      'Chords of Passion', 'Pop Star Journeys', 'Underground Music Scenes', 'Orchestrated Dramas'
    ];
  }
  if (g.includes('romance') || g.includes('love')) {
    return [
      'Swoon-Worthy Romance', 'Tear-Jerking Love Stories', 'Forbidden Passion',
      'Enemies to Lovers', 'Summer Love & Escapes', 'Period Pieces & Costumes',
      'Romantic Comedy Classics', 'Second Chance at Love', 'Heartfelt Declarations', 'Bittersweet Romance'
    ];
  }
  if (g.includes('sci-fi') || g.includes('science fiction')) {
    return [
      'Space Travel & Cosmologies', 'Cyberpunk AI & Hackers', 'Dystopian Futures',
      'Time-Loop Paradoxes', 'Alien Contact & Invasions', 'Mind-Bending Concepts',
      'Near-Future Warnings', 'Sci-Fi Action Extravaganzas', 'Tech Run Amok', 'Alternative Earths'
    ];
  }
  if (g.includes('short')) {
    return [
      'Bite-Sized Masterpieces', 'Quick Animated Shorts', 'Award-Winning Short Films',
      'Short But Sweet Stories', 'Micro-Dramas', 'Avant-Garde Briefs',
      'Flash Fiction Cinema', 'Student Academy Winners', 'Brief Encounters', 'Innovative Shorts'
    ];
  }
  if (g.includes('sport')) {
    return [
      'Inspiring Underdog Stories', 'Sports Docuseries', 'Championship Dreams',
      'High-Stakes Competitions', 'Blood, Sweat, and Tears', 'Athletic Triumphs',
      'Gridiron & Court Dramas', 'Motorsport adrenaline', 'Locker Room Leadership', 'Sports Fan Classics'
    ];
  }
  if (g.includes('stand-up') || g.includes('talk')) {
    return [
      'Laugh-Out-Loud Specials', 'Late Night Banter', 'Political Satire & Sarcasm',
      'Global Stand-Up Stars', 'Candid Conversations', 'Witty Monologues',
      'Sketch Comedy Specials', 'Stand-Up Hits', 'Hilarious Anecdotes', 'Improv Masterclasses'
    ];
  }
  if (g.includes('teen')) {
    return [
      'High School Dramas', 'Coming-of-Age Sagas', 'Teen Angst & Romances',
      'Rebellious Youth', 'Prom Night Dilemmas', 'YA Adaptations',
      'Social Media Frenzies', 'First Loves & Heartbreaks', 'Youthful Friendships', 'Supernatural Teens'
    ];
  }
  if (g.includes('thriller')) {
    return [
      'Pulse-Pounding Suspense', 'Psychological Mind Games', 'Conspiracies & Cover-Ups',
      'Spies & Assassins', 'Survival Thrillers', 'Cat-and-Mouse Pursuits',
      'High-Stakes Kidnappings', 'Paranoia & Cyber Scares', 'Corporate Crime Thrillers', 'Double-Crosses'
    ];
  }
  if (g.includes('myster')) {
    return [
      'Whodunits & Riddles', 'Unsolved Cases', 'Supernatural Secrets',
      'Missing Persons', 'Cold Case Files', 'Puzzle Box Mysteries',
      'Twisted Truths', 'Detective Work', 'Secret Societies', 'Unexplained Phenomena'
    ];
  }
  if (g.includes('reality')) {
    return [
      'Unscripted Drama', 'Reality TV Icons', 'Dating & Romance Games',
      'Talent Competitions', 'Survival & Challenges', 'Makeovers & Transformations',
      'Real Life Soaps', 'Real Estate & Home', 'Kitchen Battles', 'Wild Reality'
    ];
  }
  if (g.includes('war')) {
    return [
      'Epic Battles', 'Military Operations', 'Frontline Heroism',
      'Historical Warfare', 'Band of Brothers', 'Anti-War Masterpieces',
      'Tactical Espionage', 'Behind Enemy Lines', 'Survival & Sacrifice', 'Global Conflicts'
    ];
  }
  if (g.includes('western')) {
    return [
      'Frontier Justice', 'Gunslingers & Outlaws', 'Wild West Epics',
      'Bounty Hunters', 'Classic Westerns', 'Modern Revisionist Westerns',
      'Dusty Trails', 'Cowboy Lore', 'Gold Rush Tales', 'Desert Showdowns'
    ];
  }
  if (g.includes('All')) {
    return [
      'Superhero Blockbusters', 'High-Kick Action & Martial Arts', 'Foreign Language Thrills',
      'Cultures & Perspectives', 'Cinematic Travels', 'Cross-Cultural Gems',
      'Acclaimed International Hits', 'Hidden Gems Worldwide', 'Diverse Narratives'
    ];
  }
  if (g.includes('history') || g.includes('historical')) {
    return [
      'Epic Historical Sagas', 'Ancient Civilizations', 'Royal Court Intrigue',
      'Biographical Epics', 'Revolutions & Uprisings', 'Time Period Pieces',
      'World-Changing Events', 'Historical Dramatizations', 'Legends of the Past', 'Monumental Journeys'
    ];
  }

  // Fallback for general pages
  return [
    'Critically Praised', 'Hidden Finds', 'Audience Favourites',
    'Discover Something New', 'Worth the Watch', 'Overlooked Gems',
    'Beyond the Obvious', 'Deep Cuts', 'Under the Radar', 'More Like This'
  ];
};

export const resolveProfileKey = (selectedGenreId: number, mediaType: 'movie' | 'tv', selectedGenreName?: string): string => {
  if (selectedGenreId === 99) {
    if (selectedGenreName && (selectedGenreName.toLowerCase().includes('science') || selectedGenreName.toLowerCase().includes('nature'))) {
      return '99-science-nature';
    }
    return '99-documentaries';
  }
  if (selectedGenreId === 16) {
    return '16-anime'; // Both TV series and anime films use the anime-keyword profile
  }
  return String(selectedGenreId);
};

type ProfileRowDef = { key: string; title: string; sort: string; extra: string; url?: string };

export const getProfileRows = (profileKey: string, mediaType: 'movie' | 'tv'): ProfileRowDef[] => {
  switch (profileKey) {
    case '28':
    case '12':
    case '10759':
      return [
        { key: 'superhero', title: 'Superhero Blockbusters', sort: 'popularity.desc', extra: '&with_keywords=9715' },
        { key: 'martial-arts', title: 'High-Kick Action & Martial Arts', sort: 'popularity.desc', extra: '&with_keywords=779|780' },
        { key: 'spy-espionage', title: 'Secret Agents & Spy Thrillers', sort: 'popularity.desc', extra: '&with_keywords=470' },
        { key: 'treasure-hunt', title: 'Treasure Hunts & Epic Quests', sort: 'popularity.desc', extra: '&with_keywords=207372' },
        { key: 'survival-disaster', title: 'Survival Against the Odds', sort: 'popularity.desc', extra: '&with_keywords=10349' },
        { key: 'heist-caper', title: 'Heist Sagas & Capers', sort: 'popularity.desc', extra: '&with_keywords=10051' },
        { key: 'war-combat', title: 'War & Military Action', sort: 'popularity.desc', extra: '&with_genres=10752' },
        { key: 'underdog-champ', title: 'Inspiring Underdog Stories', sort: 'vote_average.desc', extra: '&vote_count.gte=500' },
        { key: 'car-chase', title: 'High-Speed Car Chases', sort: 'popularity.desc', extra: '&with_keywords=10034' },
        { key: 'revenge', title: 'Revenge Thrillers', sort: 'popularity.desc', extra: '&with_keywords=9748' },
        { key: 'one-man-army', title: 'One-Man Army Epics', sort: 'popularity.desc', extra: '&with_keywords=1568' },
        { key: 'dystopian-action', title: 'Dystopian & Apocalyptic Action', sort: 'popularity.desc', extra: '&with_keywords=4565' },
        { key: 'space-battles', title: 'Epic Space Battles', sort: 'popularity.desc', extra: '&with_keywords=3801' },
        { key: 'assassin', title: 'Deadly Assassins', sort: 'popularity.desc', extra: '&with_keywords=1432' },
        { key: 'sword-fight', title: 'Sword & Sandal Epics', sort: 'popularity.desc', extra: '&with_keywords=9725' },
        { key: 'action-comedy', title: 'Action-Packed Comedies', sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'action-scifi', title: 'Sci-Fi Action Spectacles', sort: 'popularity.desc', extra: '&with_genres=878' },
        { key: 'historical-action', title: 'Historical Action & Battles', sort: 'popularity.desc', extra: '&with_genres=36' },
        { key: 'action-crime', title: 'Crime Action Thrillers', sort: 'popularity.desc', extra: '&with_genres=80' },
        { key: 'jungle-safari', title: 'Jungle & Wilderness Adventures', sort: 'popularity.desc', extra: '&with_genres=12' },
        { key: 'superhero-p2', title: 'More Superhero Stories', sort: 'popularity.desc', extra: '&with_keywords=9715&page=2' },
        { key: 'action-toprated', title: 'Critically Acclaimed Action', sort: 'vote_average.desc', extra: '&vote_count.gte=800' },
        { key: 'action-p2', title: 'More Action Blockbusters', sort: 'popularity.desc', extra: '&page=2' },
        { key: 'action-p3', title: 'Action Hidden Gems', sort: 'popularity.desc', extra: '&page=3' },
        { key: 'ninja-samurai', title: 'Ninja & Samurai Legends', sort: 'popularity.desc', extra: '&with_keywords=779&with_origin_country=JP' },
        { key: 'disaster-epic', title: 'Disaster & Catastrophe Epics', sort: 'popularity.desc', extra: '&with_keywords=5096&with_genres=878' },
        { key: 'animation-action', title: 'Action Animation', sort: 'popularity.desc', extra: '&with_genres=16' },
        { key: 'female-action-leads', title: 'Fierce Female Action Heroes', sort: 'popularity.desc', extra: '&page=4' },
        { key: 'action-oldschool', title: 'Old-School Action Classics', sort: 'vote_count.desc', extra: '&vote_count.gte=400' },
        { key: 'international-action', title: 'International Action Hits', sort: 'popularity.desc', extra: '&without_original_language=en' },
        { key: 'cold-war-thriller', title: 'Cold War Spy Thrillers', sort: 'popularity.desc', extra: '&with_keywords=470&with_genres=36' },
        { key: 'post-apocalyptic-action', title: 'Post-Apocalyptic Survival', sort: 'popularity.desc', extra: '&with_keywords=4565|10349' },
        { key: 'bollywood-action', title: 'Bollywood & Indian Action', sort: 'popularity.desc', extra: '&with_origin_country=IN&with_genres=28' },
        { key: 'latin-action', title: 'Latin American & Spanish Action', sort: 'popularity.desc', extra: '&with_origin_country=MX|BR|CO|AR&with_genres=28' },
        { key: 'thai-indonesian-action', title: 'Southeast Asian Martial Arts', sort: 'popularity.desc', extra: '&with_origin_country=TH|ID|PH&with_genres=28' },
        { key: 'military-ops', title: 'Special Forces & Military Ops', sort: 'popularity.desc', extra: '&with_keywords=1568&with_genres=10752' },
        { key: 'parkour-stunt', title: 'Parkour & Stunt Spectacles', sort: 'vote_average.desc', extra: '&vote_count.gte=50&vote_count.lte=400' },
        { key: 'western-action', title: 'Western Action & Gunfighters', sort: 'popularity.desc', extra: '&with_genres=37' },
        { key: 'pirate-seas', title: 'Pirates & High Seas Adventures', sort: 'popularity.desc', extra: '&with_keywords=6684' },
        { key: 'action-toprated-new', title: 'Action Picks: 2020s Hits', sort: 'popularity.desc', extra: '&primary_release_date.gte=2020-01-01' },
        { key: 'action-90s', title: '90s Action Blockbusters', sort: 'vote_count.desc', extra: '&primary_release_date.gte=1990-01-01&primary_release_date.lte=1999-12-31' },
        { key: 'action-2000s', title: '2000s Action Hits', sort: 'vote_count.desc', extra: '&primary_release_date.gte=2000-01-01&primary_release_date.lte=2009-12-31' },
      ];
    case '16':
      return [
        { key: 'family-animation', title: 'Family Animated Movies', sort: 'popularity.desc', extra: '&with_genres=10751' },
        { key: 'cgi-pixar', title: '3D Animated Favorites', sort: 'popularity.desc', extra: '&page=2' },
        { key: 'fantasy-animation', title: 'Magical Fantasy Adventures', sort: 'popularity.desc', extra: '&with_genres=14' },
        { key: 'anime-cross', title: 'Epic Anime Series', sort: 'popularity.desc', extra: '&with_keywords=210024' },
        { key: 'adventure-animation', title: 'Epic Animated Adventures', sort: 'popularity.desc', extra: '&with_genres=12' },
        { key: 'comedy-animation', title: 'Laugh-Out-Loud Animation', sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'sci-fi-animation', title: 'Futuristic Animated Sci-Fi', sort: 'popularity.desc', extra: '&with_genres=878' },
        { key: 'musical-animation', title: 'Animated Musicals', sort: 'popularity.desc', extra: '&with_genres=10402' },
        { key: 'stop-motion', title: 'Stop-Motion Masterpieces', sort: 'popularity.desc', extra: '&with_keywords=3386' },
        { key: 'animal-protagonists', title: 'Animal Hero Adventures', sort: 'popularity.desc', extra: '&with_keywords=3205' },
        { key: 'fairy-tales-anim', title: 'Fairy Tales & Timeless Fables', sort: 'popularity.desc', extra: '&with_keywords=3205' },
        { key: 'superhero-animation', title: 'Animated Superhero Action', sort: 'popularity.desc', extra: '&with_keywords=9715' },
        { key: 'japanese-anim', title: 'Japanese Animation Gems', sort: 'popularity.desc', extra: '&with_origin_country=JP' },
        { key: 'horror-dark-anim', title: 'Dark & Horror Animation', sort: 'popularity.desc', extra: '&with_genres=27' },
        { key: 'adult-animation', title: 'Adult Animated Series & Films', sort: 'vote_average.desc', extra: '&vote_count.gte=200' },
        { key: 'classic-cartoons', title: 'Classic Cartoons & Golden Age', sort: 'vote_count.desc', extra: '&vote_count.gte=300' },
        { key: 'animation-toprated', title: 'Highest-Rated Animation', sort: 'vote_average.desc', extra: '&vote_count.gte=500' },
        { key: 'animation-p2', title: 'More Animated Favorites', sort: 'popularity.desc', extra: '&page=3' },
        { key: 'international-anim', title: 'International Animation Treasures', sort: 'popularity.desc', extra: '&without_original_language=en' },
        { key: 'action-animation', title: 'High-Action Animation', sort: 'popularity.desc', extra: '&with_genres=28' },
      ];
    case '16-anime':
      return [
        { key: 'shonen', title: 'Action Shonen Anime', sort: 'popularity.desc', extra: '&with_keywords=210024&with_genres=10759' },
        { key: 'fantasy-anime', title: 'Isekai & Fantasy Hits', sort: 'popularity.desc', extra: '&with_keywords=210024&with_genres=10765' },
        { key: 'drama-anime', title: 'Emotional Anime Dramas', sort: 'popularity.desc', extra: '&with_keywords=210024&with_genres=18' },
        { key: 'classic-anime', title: 'Legendary Classic Anime', sort: 'vote_count.desc', extra: '&with_keywords=210024' },
        { key: 'romance-anime', title: 'Romance & Slice of Life', sort: 'popularity.desc', extra: '&with_keywords=210024&with_genres=10749' },
        { key: 'horror-anime', title: 'Dark & Horror Anime', sort: 'popularity.desc', extra: '&with_keywords=210024&page=3' },
        { key: 'scifi-anime', title: 'Sci-Fi & Mecha Anime', sort: 'popularity.desc', extra: '&with_keywords=210024&with_original_language=ja' },
        { key: 'comedy-anime', title: 'Hilarious Comedy Anime', sort: 'popularity.desc', extra: '&with_keywords=210024&with_genres=35' },
        { key: 'psychological-anime', title: 'Mind-Bending Psychological Anime', sort: 'vote_average.desc', extra: '&with_keywords=210024&vote_count.gte=200' },
        { key: 'sports-anime', title: 'Sports Anime Sagas', sort: 'popularity.desc', extra: '&with_keywords=210024&with_original_language=ja&sort_by=popularity.desc' },
        { key: 'villain-anime', title: 'Dark Heroes & Villain Stories', sort: 'popularity.desc', extra: '&with_keywords=210024&with_genres=80' },
        { key: 'kids-anime', title: 'Family Anime Favorites', sort: 'popularity.desc', extra: '&with_keywords=210024&with_genres=16' },
        { key: 'ghibli-inspired', title: 'Studio Ghibli & Beloved Anime Films', sort: 'vote_count.desc', extra: '&with_keywords=210024&with_original_language=ja' },
        { key: 'crime-anime', title: 'Crime & Detective Anime', sort: 'popularity.desc', extra: '&with_keywords=210024&with_genres=80' },
        { key: 'adventure-anime', title: 'Epic Adventure Anime', sort: 'popularity.desc', extra: '&with_keywords=210024&with_genres=12' },
        { key: 'popular-anime-p2', title: 'More Must-Watch Anime', sort: 'popularity.desc', extra: '&with_keywords=210024&page=2' },
        { key: 'top-rated-anime', title: 'Highest-Rated Anime of All Time', sort: 'vote_average.desc', extra: '&with_keywords=210024&vote_count.gte=500' },
        { key: 'new-anime', title: 'Recent Anime Hits', sort: 'popularity.desc', extra: '&with_keywords=210024&with_original_language=ja&vote_count.gte=30' },
        { key: 'supernatural-anime', title: 'Supernatural & Demons Anime', sort: 'popularity.desc', extra: '&with_keywords=210024&with_genres=14|10765' },
        { key: 'samurai-anime', title: 'Samurai & Historical Anime', sort: 'popularity.desc', extra: '&with_keywords=210024&with_genres=36|37' },
        { key: 'cyberpunk-anime', title: 'Cyberpunk & Futuristic Anime', sort: 'popularity.desc', extra: '&with_keywords=210024&with_genres=878' },
        { key: 'anime-classics-p2', title: 'More Anime Classics', sort: 'vote_count.desc', extra: '&with_keywords=210024&page=2' },
        { key: 'anime-p3', title: 'Discover More Anime', sort: 'popularity.desc', extra: '&with_keywords=210024&page=3' },
      ];
    case '35':
      if (mediaType === 'movie') {
        return [
          { key: 'rom-com', title: 'Romantic Comedies', sort: 'popularity.desc', extra: '&with_genres=10749' },
          { key: 'dark-comedy', title: 'Witty Satire & Dark Comedy', sort: 'popularity.desc', extra: '&with_keywords=10084' },
          { key: 'raunchy-comedy', title: 'Silly & Raunchy Comedies', sort: 'popularity.desc', extra: '&page=5' },
          { key: 'family-comedy', title: 'Family Comedy Night', sort: 'popularity.desc', extra: '&with_genres=10751' },
          { key: 'buddy-comedy', title: 'Buddy Comedies & Road Trips', sort: 'popularity.desc', extra: '&with_keywords=7312' },
          { key: 'mockumentary', title: 'Absurdly Funny Mockumentaries', sort: 'vote_average.desc', extra: '&vote_count.gte=200' },
          { key: 'comedy-classics', title: 'Timeless Comedy Classics', sort: 'vote_count.desc', extra: '&primary_release_date.lte=2005-01-01' },
          { key: 'action-comedy', title: 'Action-Packed Comedies', sort: 'popularity.desc', extra: '&with_genres=28' },
          { key: 'slapstick', title: 'Slapstick & Physical Comedy', sort: 'popularity.desc', extra: '&with_keywords=2700' },
          { key: 'workplace-comedy', title: 'Office Humor & Workplace Hijinks', sort: 'popularity.desc', extra: '&with_keywords=6282' },
          { key: 'stoner-comedy', title: 'Stoner Comedies', sort: 'popularity.desc', extra: '&with_keywords=2783' },
          { key: 'teen-comedy', title: 'High School & Teen Comedies', sort: 'popularity.desc', extra: '&with_keywords=155722' },
          { key: 'horror-comedy', title: 'Horror Comedies', sort: 'popularity.desc', extra: '&with_genres=27' },
          { key: 'crime-comedy', title: 'Comedy Heists & Crime', sort: 'popularity.desc', extra: '&with_genres=80' },
          { key: 'animated-comedy', title: 'Animated Comedy Features', sort: 'popularity.desc', extra: '&with_genres=16' },
          { key: 'scifi-comedy', title: 'Sci-Fi Comedy', sort: 'popularity.desc', extra: '&with_genres=878' },
          { key: 'sports-comedy', title: 'Sports Comedies', sort: 'popularity.desc', extra: '&with_keywords=6075' },
          { key: 'holiday-comedy', title: 'Holiday & Seasonal Comedies', sort: 'popularity.desc', extra: '&with_keywords=65' },
          { key: 'improv-satire', title: 'Improv & Satirical Comedy', sort: 'vote_average.desc', extra: '&vote_count.gte=100' },
          { key: 'intl-comedy', title: 'International Comedy Hits', sort: 'popularity.desc', extra: '&without_original_language=en' },
          { key: 'lgbtq-comedy', title: 'LGBTQ+ Comedy', sort: 'popularity.desc', extra: '&with_keywords=158718' },
          { key: 'comedy-p2', title: 'More Comedy Favorites', sort: 'popularity.desc', extra: '&page=2' },
          { key: 'comedy-p3', title: 'Discover More Comedies', sort: 'popularity.desc', extra: '&page=3' },
          { key: 'comedy-toprated', title: 'Highest-Rated Comedies', sort: 'vote_average.desc', extra: '&vote_count.gte=500' },
          { key: 'indie-comedy', title: 'Quirky Independent Comedies', sort: 'vote_average.desc', extra: '&vote_count.gte=80&vote_count.lte=400' },
        ];
      }
      return [
        { key: 'rom-com', title: 'Romantic Comedies', sort: 'popularity.desc', extra: '&with_genres=10749' },
        { key: 'dark-comedy', title: 'Witty Satire & Dark Comedy', sort: 'popularity.desc', extra: '&with_keywords=10084' },
        { key: 'sitcoms', title: 'Workplace Sitcoms', sort: 'popularity.desc', extra: '&with_keywords=210605' },
        { key: 'family-comedy', title: 'Family Comedy Night', sort: 'popularity.desc', extra: '&with_genres=10751' },
        { key: 'sketch-comedy', title: 'Sketch & Stand-Up Shows', sort: 'popularity.desc', extra: '&with_keywords=156203' },
        { key: 'crime-comedy', title: 'Crime & Comedy', sort: 'popularity.desc', extra: '&with_genres=80' },
        { key: 'coming-of-age-comedy', title: 'Coming-of-Age Comedies', sort: 'popularity.desc', extra: '&with_keywords=10683' },
        { key: 'animated-comedy', title: 'Adult Animated Comedies', sort: 'popularity.desc', extra: '&with_genres=16' },
        { key: 'mockumentary-tv', title: 'Cringe & Mockumentary', sort: 'popularity.desc', extra: '&with_keywords=10084' },
        { key: 'sci-fi-comedy', title: 'Sci-Fi Humor', sort: 'popularity.desc', extra: '&with_genres=10765' },
        { key: 'variety-shows', title: 'Late Night Variety', sort: 'popularity.desc', extra: '&with_genres=10767' },
        { key: 'nostalgic-sitcoms', title: 'Nostalgic 90s & 2000s Sitcoms', sort: 'vote_count.desc', extra: '&first_air_date.lte=2010-01-01' },
        { key: 'horror-comedy-tv', title: 'Horror Comedy Series', sort: 'popularity.desc', extra: '&with_genres=27' },
        { key: 'teen-comedy-tv', title: 'Teen Sitcoms & High School', sort: 'popularity.desc', extra: '&with_keywords=155722' },
        { key: 'political-comedy', title: 'Political Satire & Comedy', sort: 'popularity.desc', extra: '&page=4' },
        { key: 'british-comedy-tv', title: 'Brilliant British Comedies', sort: 'popularity.desc', extra: '&with_origin_country=GB' },
        { key: 'intl-comedy-tv', title: 'International Comedy Hits', sort: 'popularity.desc', extra: '&without_original_language=en' },
        { key: 'lgbtq-comedy-tv', title: 'LGBTQ+ Comedy Series', sort: 'popularity.desc', extra: '&with_keywords=158718' },
        { key: 'drama-comedy-tv', title: 'Dramedies & Hybrid Shows', sort: 'popularity.desc', extra: '&with_genres=18' },
        { key: 'comedy-toprated-tv', title: 'Highest-Rated Comedy Series', sort: 'vote_average.desc', extra: '&vote_count.gte=300' },
        { key: 'comedy-p2-tv', title: 'More Comedy Series', sort: 'popularity.desc', extra: '&page=2' },
        { key: 'comedy-p3-tv', title: 'Discover More Comedy Shows', sort: 'popularity.desc', extra: '&page=3' },
        { key: 'workplace-tv', title: 'Office & Work Comedies', sort: 'vote_average.desc', extra: '&vote_count.gte=100' },
        { key: 'anthology-comedy', title: 'Anthology Comedy Series', sort: 'popularity.desc', extra: '&with_keywords=10084' },
        { key: 'improv-tv', title: 'Improv & Absurdist Comedy', sort: 'popularity.desc', extra: '&vote_count.gte=50' },
      ];
    case '80':
      return [
        { key: 'heist', title: 'Heist Sagas & Capers', sort: 'popularity.desc', extra: '&with_keywords=10051' },
        { key: 'mafia-mob', title: 'Mob Sagas & Organized Crime', sort: 'popularity.desc', extra: '&with_keywords=4737' },
        { key: 'detective-police', title: 'Cop & Detective Mysteries', sort: 'popularity.desc', extra: '&with_keywords=703' },
        { key: 'courtroom-legal', title: 'Legal & Courtroom Dramas', sort: 'vote_average.desc', extra: '&vote_count.gte=200' },
        { key: 'serial-killer', title: 'Serial Killer Thrillers', sort: 'popularity.desc', extra: '&with_keywords=12339' },
        { key: 'true-crime', title: 'Grisly True Crime Sagas', sort: 'popularity.desc', extra: '&with_keywords=818' },
        { key: 'underworld', title: 'Underworld & Gang Life', sort: 'vote_average.desc', extra: '&vote_count.gte=300' },
        { key: 'cyber-crime', title: 'Cyber Crime & Hacking Thrillers', sort: 'popularity.desc', extra: '&with_keywords=4289' },
        { key: 'prison-break', title: 'Prison Escapes & Captivity', sort: 'popularity.desc', extra: '&with_keywords=378' },
        { key: 'kidnapping-ransom', title: 'High-Stakes Kidnapping', sort: 'popularity.desc', extra: '&with_keywords=1556' },
        { key: 'corrupt-cops', title: 'Corrupt Cops & Vigilantes', sort: 'popularity.desc', extra: '&with_keywords=9715' },
        { key: 'drug-cartel', title: 'Narcos & Cartel Sagas', sort: 'popularity.desc', extra: '&with_keywords=9951' },
        { key: 'bank-robbery', title: 'Bank Robbery Thrillers', sort: 'popularity.desc', extra: '&with_keywords=2157' },
        { key: 'noir-crime', title: 'Noir & Neo-Noir Crime', sort: 'vote_average.desc', extra: '&vote_count.gte=200' },
        { key: 'femme-fatale', title: 'Femme Fatale & Seductive Crime', sort: 'popularity.desc', extra: '&with_genres=10749' },
        { key: 'con-artist', title: 'Con Artists & Swindlers', sort: 'popularity.desc', extra: '&with_keywords=2157' },
        { key: 'nordic-crime', title: 'Nordic Crime & Dark Thrillers', sort: 'popularity.desc', extra: '&with_origin_country=SE|NO|DK|FI' },
        { key: 'british-crime', title: 'British Crime Dramas', sort: 'popularity.desc', extra: '&with_origin_country=GB' },
        { key: 'international-crime', title: 'International Crime Sagas', sort: 'popularity.desc', extra: '&without_original_language=en' },
        { key: 'crime-comedy-mix', title: 'Crime Comedies', sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'crime-toprated', title: 'Critically Acclaimed Crime', sort: 'vote_average.desc', extra: '&vote_count.gte=500' },
        { key: 'crime-p2', title: 'More Crime Sagas', sort: 'popularity.desc', extra: '&page=2' },
        { key: 'crime-p3', title: 'Discover More Crime', sort: 'popularity.desc', extra: '&page=3' },
        { key: 'crime-scifi', title: 'Sci-Fi Crime', sort: 'popularity.desc', extra: '&with_genres=878' },
        { key: 'crime-classics', title: 'Classic Crime Favorites', sort: 'vote_count.desc', extra: '&vote_count.gte=400' },
        { key: 'white-collar-crime', title: 'White-Collar Crime & Fraud', sort: 'popularity.desc', extra: '&with_keywords=4289|2157' },
        { key: 'drug-cartel-2', title: 'Narcos & Drug War Sagas', sort: 'vote_count.desc', extra: '&with_keywords=9951' },
        { key: 'cold-case', title: 'Cold Cases & Unsolved Crimes', sort: 'popularity.desc', extra: '&page=4' },
        { key: 'political-crime', title: 'Political Corruption & Scandals', sort: 'vote_average.desc', extra: '&vote_count.gte=150&with_genres=18' },
        { key: 'yakuza-triads', title: 'Yakuza, Triads & Asian Crime', sort: 'popularity.desc', extra: '&with_origin_country=JP|KR|HK|CN' },
        { key: 'hitman-contract', title: 'Hitmen & Contract Killers', sort: 'popularity.desc', extra: '&with_keywords=1432' },
        { key: 'crime-romance', title: 'Crime & Romance', sort: 'popularity.desc', extra: '&with_genres=10749' },
        { key: 'art-theft-con', title: 'Art Theft & Elaborate Cons', sort: 'vote_average.desc', extra: '&vote_count.gte=100' },
        { key: 'latin-crime', title: 'Latin American Crime & Narco Drama', sort: 'popularity.desc', extra: '&with_origin_country=MX|CO|BR' },
        { key: 'crime-2010s', title: 'Best Crime of the 2010s', sort: 'vote_count.desc', extra: '&primary_release_date.gte=2010-01-01&primary_release_date.lte=2019-12-31' },
        { key: 'crime-2020s', title: 'Crime Hits of the 2020s', sort: 'popularity.desc', extra: '&primary_release_date.gte=2020-01-01' },
      ];
    case '99-documentaries':
      return [
        { key: 'true-crime-docs', title: 'True Crime Investigations', sort: 'popularity.desc', extra: '&with_genres=80' },
        { key: 'history-docs', title: 'History & War Documentaries', sort: 'popularity.desc', extra: '&with_genres=36' },
        { key: 'biography-docs', title: 'Biographies & Real Lives', sort: 'popularity.desc', extra: '&with_keywords=818' },
        { key: 'music-docs', title: 'Music & Pop Culture Docs', sort: 'popularity.desc', extra: '&with_genres=10402' },
        { key: 'political-docs', title: 'Political Power & Social Docs', sort: 'vote_average.desc', extra: '&vote_count.gte=100' },
        { key: 'sports-docs', title: 'Sports Documentaries', sort: 'popularity.desc', extra: '&with_keywords=6075' },
        { key: 'food-travel-docs', title: 'Food, Travel & World Culture', sort: 'popularity.desc', extra: '&with_keywords=9935|10637' },
        { key: 'climate-nature-docs', title: 'Nature, Climate & Environment', sort: 'vote_average.desc', extra: '&with_keywords=9902|18330&vote_count.gte=100' },
        { key: 'science-docs', title: 'Science & Technology Docs', sort: 'vote_average.desc', extra: '&vote_count.gte=100&page=2' },
        { key: 'art-design-docs', title: 'Art, Design & Creativity', sort: 'popularity.desc', extra: '&page=2' },
        { key: 'cult-conspiracy-docs', title: 'Cults, Conspiracies & Dark Truths', sort: 'popularity.desc', extra: '&with_keywords=10084' },
        { key: 'wildlife-docs', title: 'Wildlife & Animal Planet', sort: 'popularity.desc', extra: '&with_keywords=9902|18330' },
        { key: 'space-docs', title: 'Space, Stars & Cosmology', sort: 'popularity.desc', extra: '&with_keywords=3801' },
        { key: 'war-military-docs', title: 'War & Military Documentaries', sort: 'popularity.desc', extra: '&with_genres=10752' },
        { key: 'social-justice-docs', title: 'Social Justice & Human Rights', sort: 'vote_average.desc', extra: '&vote_count.gte=50&page=5' },
        { key: 'investigative-journalism', title: 'Investigative Journalism Stories', sort: 'vote_average.desc', extra: '&vote_count.gte=100' },
        { key: 'tech-internet-docs', title: 'Tech, Internet & Digital Age', sort: 'popularity.desc', extra: '&with_keywords=4289' },
        { key: 'health-medicine-docs', title: 'Health, Medicine & The Body', sort: 'popularity.desc', extra: '&with_keywords=11171' },
        { key: 'business-finance-docs', title: 'Business, Finance & Wall Street', sort: 'popularity.desc', extra: '&page=3' },
        { key: 'fashion-celebrity-docs', title: 'Fashion, Celebrity & Pop Culture', sort: 'popularity.desc', extra: '&page=4' },
        { key: 'lgbtq-docs', title: 'LGBTQ+ Stories & Pride Docs', sort: 'popularity.desc', extra: '&with_keywords=158718' },
        { key: 'religion-spirituality-docs', title: 'Religion, Spirituality & Belief', sort: 'popularity.desc', extra: '&page=5' },
        { key: 'ocean-docs', title: 'Oceans, Seas & Deep Water Worlds', sort: 'popularity.desc', extra: '&with_keywords=1721' },
        { key: 'international-docs', title: 'International Documentary Gems', sort: 'popularity.desc', extra: '&without_original_language=en' },
        { key: 'docs-toprated', title: 'Highest-Rated Documentaries', sort: 'vote_average.desc', extra: '&vote_count.gte=200' },
        { key: 'miniseries-docs', title: 'Gripping Documentary Miniseries', sort: 'vote_average.desc', extra: '&vote_count.gte=50&page=6' },
        { key: 'crime-investigation-series', title: 'Crime Investigation Series', sort: 'popularity.desc', extra: '&with_genres=80&page=2' },
        { key: 'nature-series', title: 'Breathtaking Nature Series', sort: 'vote_count.desc', extra: '&with_keywords=9902|18330' },
        { key: 'historical-docs-p2', title: 'Hidden History Documentaries', sort: 'vote_average.desc', extra: '&with_genres=36&page=2' },
        { key: 'startup-innovation-docs', title: 'Startups, Innovation & Big Ideas', sort: 'popularity.desc', extra: '&with_keywords=4289&page=2' },
      ];
    case '99-science-nature':
      return [
        { key: 'wildlife-nature', title: 'Wildlife & Nature Epics', sort: 'popularity.desc', extra: '&with_keywords=196884' },
        { key: 'space-cosmology', title: 'Space & Universe Exploration', sort: 'popularity.desc', extra: '&with_keywords=3801' },
        { key: 'science-tech', title: 'Science & Tech Discoveries', sort: 'popularity.desc', extra: '&page=2' },
        { key: 'earth-environment', title: 'Earth & Climate Mysteries', sort: 'popularity.desc', extra: '&with_keywords=9902|18330' },
        { key: 'human-body', title: 'Human Body & Medical Science', sort: 'popularity.desc', extra: '&with_keywords=11171' },
        { key: 'ocean-deep', title: 'Deep Sea & Ocean Wonders', sort: 'popularity.desc', extra: '&with_keywords=1721' },
        { key: 'dinosaurs-paleontology', title: 'Dinosaurs & Prehistoric Earth', sort: 'popularity.desc', extra: '&with_keywords=12616' },
        { key: 'climate-change', title: 'Climate Change & Our Future', sort: 'popularity.desc', extra: '&with_keywords=9902|18330&page=2' },
        { key: 'ai-tech-future', title: 'AI, Tech & The Future', sort: 'popularity.desc', extra: '&with_keywords=4289' },
        { key: 'biology-evolution', title: 'Biology, Evolution & Life', sort: 'popularity.desc', extra: '&page=2' },
        { key: 'physics-cosmos', title: 'Physics, Quantum & The Cosmos', sort: 'vote_average.desc', extra: '&vote_count.gte=50' },
        { key: 'natural-disasters', title: 'Natural Disasters & Earth Forces', sort: 'popularity.desc', extra: '&with_keywords=5096' },
        { key: 'animals-behavior', title: 'Animal Behavior & Instinct', sort: 'popularity.desc', extra: '&with_keywords=9902|18330&page=2' },
        { key: 'planet-earth-series', title: 'Planet Earth Explorations', sort: 'vote_count.desc', extra: '&with_keywords=9902|18330' },
        { key: 'engineering-wonders', title: 'Engineering & Human Innovation', sort: 'popularity.desc', extra: '&page=3' },
        { key: 'mindscience-psychology', title: 'Psychology & Human Mind', sort: 'popularity.desc', extra: '&with_keywords=11171&page=2' },
        { key: 'explorer-adventure', title: 'Explorers & Scientific Expeditions', sort: 'popularity.desc', extra: '&page=3' },
        { key: 'nature-toprated', title: 'Highest-Rated Nature Documentaries', sort: 'vote_average.desc', extra: '&vote_count.gte=100' },
        { key: 'marine-biology', title: 'Deep Ocean & Marine Life', sort: 'popularity.desc', extra: '&with_keywords=1721&page=2' },
        { key: 'astronomy-cosmos', title: 'Star-Gazing & Cosmology', sort: 'popularity.desc', extra: '&with_keywords=3801&page=2' },
        { key: 'genetics-medicine', title: 'Genetics, DNA & Medical Breakthroughs', sort: 'popularity.desc', extra: '&page=4' },
        { key: 'extreme-weather', title: 'Extreme Weather & Natural Phenomena', sort: 'popularity.desc', extra: '&with_keywords=5096&page=2' },
        { key: 'nature-conservation', title: 'Wildlife Conservation & Earth', sort: 'vote_average.desc', extra: '&with_keywords=9902|18330&vote_count.gte=50' },
        { key: 'science-comedy-nature', title: 'Lighthearted Science & Discovery', sort: 'popularity.desc', extra: '&page=5' },
      ];
    case '14':
      return [
        { key: 'epic-fantasy', title: 'Epic Fantasy Worlds', sort: 'popularity.desc', extra: '&with_keywords=6152' },
        { key: 'sword-sorcery', title: 'Swords & Sorcery', sort: 'popularity.desc', extra: '&with_keywords=9725|5147' },
        { key: 'myth-legend', title: 'Myths & Legends', sort: 'popularity.desc', extra: '&with_keywords=4379' },
        { key: 'magic-spells', title: 'Magic & Witchcraft', sort: 'popularity.desc', extra: '&with_keywords=40931' },
        { key: 'urban-fantasy', title: 'Urban Fantasy Thrills', sort: 'popularity.desc', extra: '&with_keywords=6152' },
        { key: 'dragon-fantasy', title: 'Dragons & Mythical Creatures', sort: 'popularity.desc', extra: '&with_keywords=3205' },
        { key: 'dark-fantasy', title: 'Dark Fantasy & Gothic Tales', sort: 'popularity.desc', extra: '&with_genres=27' },
        { key: 'fairy-tale-fantasy', title: 'Fairy Tales & Enchanted Worlds', sort: 'popularity.desc', extra: '&with_keywords=3205' },
        { key: 'superhero-fantasy', title: 'Superhero Fantasy', sort: 'popularity.desc', extra: '&with_keywords=9715' },
        { key: 'animated-fantasy', title: 'Animated Fantasy Adventures', sort: 'popularity.desc', extra: '&with_genres=16' },
        { key: 'historical-fantasy', title: 'Historical & Period Fantasy', sort: 'popularity.desc', extra: '&with_genres=36' },
        { key: 'scifi-fantasy-cross', title: 'Sci-Fi Fantasy Crossovers', sort: 'popularity.desc', extra: '&with_genres=878' },
        { key: 'horror-fantasy', title: 'Supernatural Horror Fantasy', sort: 'popularity.desc', extra: '&with_genres=27' },
        { key: 'kids-fantasy', title: 'Magical Adventures for All Ages', sort: 'popularity.desc', extra: '&with_genres=10751' },
        { key: 'quest-fantasy', title: 'Epic Quest Adventures', sort: 'popularity.desc', extra: '&with_keywords=207372' },
        { key: 'romance-fantasy', title: 'Fantasy Romance', sort: 'popularity.desc', extra: '&with_genres=10749' },
        { key: 'japanese-fantasy', title: 'Japanese & Asian Fantasy', sort: 'popularity.desc', extra: '&with_origin_country=JP|KR|CN' },
        { key: 'fantasy-toprated', title: 'Critically Acclaimed Fantasy', sort: 'vote_average.desc', extra: '&vote_count.gte=500' },
        { key: 'adventure-fantasy', title: 'High Adventure Fantasy', sort: 'popularity.desc', extra: '&with_genres=12' },
        { key: 'comedy-fantasy', title: 'Comedic Fantasy', sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'fantasy-p2', title: 'More Fantasy Favorites', sort: 'popularity.desc', extra: '&page=2' },
        { key: 'fantasy-p3', title: 'Discover More Fantasy', sort: 'popularity.desc', extra: '&page=3' },
        { key: 'apocalyptic-fantasy', title: 'Apocalyptic & Dystopian Fantasy', sort: 'popularity.desc', extra: '&with_keywords=4565' },
        { key: 'portal-fantasy', title: 'Other Worlds & Portal Stories', sort: 'popularity.desc', extra: '&with_keywords=4379' },
        { key: 'international-fantasy', title: 'International Fantasy Gems', sort: 'popularity.desc', extra: '&without_original_language=en' },
      ];
    case '18':
      return [
        { key: 'true-story-dramas', title: 'Dramas Based on a True Story', sort: 'popularity.desc', extra: '&with_keywords=818' },
        { key: 'coming-of-age-dramas', title: 'Coming-of-Age Journeys', sort: 'popularity.desc', extra: '&with_keywords=10683' },
        { key: 'period-costume', title: 'Period & Costume Dramas', sort: 'popularity.desc', extra: '&primary_release_date.lte=1990-01-01' },
        { key: 'romance-dramas', title: 'Romance & Heartbreak', sort: 'popularity.desc', extra: '&with_genres=10749' },
        { key: 'family-saga-dramas', title: 'Family Sagas & Generational Dramas', sort: 'vote_average.desc', extra: '&vote_count.gte=300' },
        { key: 'social-justice-dramas', title: 'Social Issues & Power Dynamics', sort: 'vote_count.desc', extra: '&page=3' },
        { key: 'grief-loss-dramas', title: 'Grief, Loss & Healing', sort: 'vote_average.desc', extra: '&vote_count.gte=200' },
        { key: 'prestige-award-dramas', title: 'Award-Winning Prestige Dramas', sort: 'vote_average.desc', extra: '&vote_count.gte=1000' },
        { key: 'courtroom-drama', title: 'Courtroom Dramas', sort: 'popularity.desc', extra: '&with_genres=80' },
        { key: 'medical-drama', title: 'Medical Dramas & Hospitals', sort: 'popularity.desc', extra: '&with_keywords=11171' },
        { key: 'political-drama', title: 'Political Dramas', sort: 'vote_count.desc', extra: '&page=4' },
        { key: 'sports-drama', title: 'Inspiring Sports Dramas', sort: 'popularity.desc', extra: '&with_keywords=6075' },
        { key: 'crime-drama', title: 'Gritty Crime Dramas', sort: 'popularity.desc', extra: '&with_genres=80' },
        { key: 'biography-drama', title: 'Biographical Dramas', sort: 'popularity.desc', extra: '&with_keywords=818' },
        { key: 'war-drama', title: 'War & Conflict Dramas', sort: 'popularity.desc', extra: '&with_genres=10752' },
        { key: 'psychological-drama', title: 'Psychological & Mind-Game Dramas', sort: 'vote_average.desc', extra: '&vote_count.gte=400' },
        { key: 'indie-drama', title: 'Independent Arthouse Dramas', sort: 'vote_average.desc', extra: '&vote_count.gte=100&vote_count.lte=500' },
        { key: 'immigration-drama', title: 'Immigration & Identity Stories', sort: 'popularity.desc', extra: '&without_original_language=en' },
        { key: 'addiction-drama', title: 'Addiction & Redemption Stories', sort: 'vote_average.desc', extra: '&vote_count.gte=150' },
        { key: 'workplace-drama', title: 'High-Stakes Workplace Dramas', sort: 'popularity.desc', extra: '&with_keywords=6282' },
        { key: 'lgbtq-drama', title: 'LGBTQ+ Dramas', sort: 'popularity.desc', extra: '&with_keywords=158718' },
        { key: 'drama-p2', title: 'More Acclaimed Dramas', sort: 'popularity.desc', extra: '&page=2' },
        { key: 'drama-p3', title: 'Hidden Drama Gems', sort: 'popularity.desc', extra: '&page=3' },
        { key: 'international-drama', title: 'International Drama Masterpieces', sort: 'vote_count.desc', extra: '&without_original_language=en' },
        { key: 'teen-drama', title: 'Teen & YA Dramas', sort: 'popularity.desc', extra: '&with_keywords=10683' },
        { key: 'nature-drama', title: 'Nature & Environmental Dramas', sort: 'popularity.desc', extra: '&with_keywords=9902|18330' },
        { key: 'drama-toprated', title: 'All-Time Great Dramas', sort: 'vote_average.desc', extra: '&vote_count.gte=2000' },
        { key: 'drama-p4', title: 'More Great Dramas', sort: 'vote_average.desc', extra: '&vote_count.gte=500&page=2' },
      ];
    case '10751':
    case '10762':
      return [
        { key: 'animated-kids', title: 'Animated Family Classics', sort: 'popularity.desc', extra: '&with_genres=16' },
        { key: 'live-action-kids', title: 'Live-Action Family Adventures', sort: 'popularity.desc', extra: '&with_genres=12' },
        { key: 'animal-stories', title: 'Animal & Nature Adventures', sort: 'popularity.desc', extra: '&with_keywords=9902|18330' },
        { key: 'fantasy-magic', title: 'Magical & Fantasy Adventures', sort: 'popularity.desc', extra: '&with_genres=14' },
        { key: 'ghibli-style', title: 'Studio Ghibli & Japanese Animation', sort: 'popularity.desc', extra: '&with_origin_country=JP&with_genres=16' },
        { key: 'teen-adventure', title: 'Teen & YA Adventures', sort: 'popularity.desc', extra: '&with_keywords=10683' },
        { key: 'educational', title: 'Educational & Discovery', sort: 'popularity.desc', extra: '&with_genres=99' },
        { key: 'toddler-friendly', title: 'For Toddlers & Little Ones', sort: 'popularity.desc', extra: '&page=2' },
        { key: 'music-singalong', title: 'Musical Adventures & Sing-Alongs', sort: 'popularity.desc', extra: '&with_genres=10402' },
        { key: 'superhero-kids', title: 'Superhero Adventures for Kids', sort: 'popularity.desc', extra: '&with_keywords=9715' },
        { key: 'fairy-tales', title: 'Classic Fairy Tales & Fables', sort: 'popularity.desc', extra: '&with_keywords=3205' },
        { key: 'kids-comedy', title: 'Hilarious Kids Comedies', sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'spooky-kids', title: 'Spooky (But Not Too Scary)', sort: 'popularity.desc', extra: '&with_genres=27&with_genres=14' },
        { key: 'sports-kids', title: 'Inspiring Kids Sports Stories', sort: 'popularity.desc', extra: '&with_keywords=6075' },
        { key: 'sci-fi-kids', title: 'Out of This World Sci-Fi', sort: 'popularity.desc', extra: '&with_genres=878' },
        { key: 'dinosaurs-kids', title: 'Dinosaurs & Prehistoric Worlds', sort: 'popularity.desc', extra: '&page=3' },
        { key: 'christmas-holidays-kids', title: 'Holiday Specials & Festive Fun', sort: 'vote_count.desc', extra: '&page=3' },
        { key: 'ocean-sea-kids', title: 'Ocean, Sea & Underwater Adventures', sort: 'popularity.desc', extra: '&with_keywords=1721' },
        { key: 'space-kids', title: 'Space & Galaxy Adventures', sort: 'popularity.desc', extra: '&with_keywords=3801' },
        { key: 'friendship-kindness', title: 'Friendship & Kindness Stories', sort: 'vote_average.desc', extra: '&vote_count.gte=100' },
        { key: 'multicultural-kids', title: 'Multicultural & World Stories', sort: 'popularity.desc', extra: '&without_original_language=en' },
        { key: 'pixar-disney-style', title: 'Beloved Animated Studio Films', sort: 'vote_count.desc', extra: '&with_genres=16' },
        { key: 'kids-mystery', title: 'Kid-Friendly Mysteries & Puzzles', sort: 'popularity.desc', extra: '&with_genres=9648' },
        { key: 'kids-toprated', title: 'Highest-Rated Family Films', sort: 'vote_average.desc', extra: '&vote_count.gte=300' },
        { key: 'kids-p2', title: 'More Family Favorites', sort: 'popularity.desc', extra: '&page=4' },
      ];
    case '27':
      return [
        { key: 'slasher-horror', title: 'Slasher Favorites', sort: 'popularity.desc', extra: '&with_keywords=12339' },
        { key: 'supernatural-horror', title: 'Supernatural & Ghost Stories', sort: 'popularity.desc', extra: '&with_keywords=6152' },
        { key: 'creature-features', title: 'Creature Features & Monsters', sort: 'popularity.desc', extra: '&with_keywords=12339&page=2' },
        { key: 'psychological-horror', title: 'Psychological Horror & Mind Games', sort: 'vote_average.desc', extra: '&vote_count.gte=300' },
        { key: 'folk-horror', title: 'Folk Horror & Eerie Cults', sort: 'popularity.desc', extra: '&with_genres=53' },
        { key: 'body-horror', title: 'Body Horror & Gore', sort: 'vote_average.desc', extra: '&vote_count.gte=150' },
        { key: 'horror-comedy', title: 'Horror Comedies', sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'found-footage', title: 'Found Footage Horror', sort: 'popularity.desc', extra: '&with_keywords=11322' },
        { key: 'zombie-survival', title: 'Zombie Survival', sort: 'popularity.desc', extra: '&with_keywords=12377' },
        { key: 'vampire-lore', title: 'Vampire & Gothic Horror', sort: 'popularity.desc', extra: '&with_keywords=3133' },
        { key: 'witchcraft', title: 'Witches & Dark Magic', sort: 'popularity.desc', extra: '&with_keywords=40931' },
        { key: 'scifi-horror-cross', title: 'Sci-Fi Horror Crossovers', sort: 'popularity.desc', extra: '&with_genres=878' },
        { key: 'demon-possession', title: 'Demonic Possessions', sort: 'popularity.desc', extra: '&with_keywords=6152' },
        { key: 'home-invasion-horror', title: 'Home Invasion & Stalker Horror', sort: 'popularity.desc', extra: '&with_keywords=10349' },
        { key: 'asian-horror', title: 'Asian Horror Masterpieces', sort: 'popularity.desc', extra: '&with_origin_country=JP|KR|TH' },
        { key: 'indie-horror', title: 'Indie & A24-Style Horror', sort: 'vote_average.desc', extra: '&vote_count.gte=100&vote_count.lte=600' },
        { key: 'monster-horror', title: 'Giant Monsters & Kaiju', sort: 'popularity.desc', extra: '&with_keywords=12339&with_genres=878' },
        { key: 'ghost-haunted', title: 'Haunted Houses & Ghosts', sort: 'popularity.desc', extra: '&with_keywords=6152&page=2' },
        { key: 'supernatural-thriller-horror', title: 'Supernatural Thrillers', sort: 'popularity.desc', extra: '&with_genres=53' },
        { key: 'horror-toprated', title: 'All-Time Horror Greats', sort: 'vote_average.desc', extra: '&vote_count.gte=600' },
        { key: 'horror-p2', title: 'More Horror Picks', sort: 'popularity.desc', extra: '&page=2' },
        { key: 'horror-p3', title: 'Horror Hidden Gems', sort: 'popularity.desc', extra: '&page=3' },
        { key: 'horror-p4', title: 'Discover More Horror', sort: 'popularity.desc', extra: '&page=4' },
        { key: 'action-horror', title: 'Action-Packed Horror', sort: 'popularity.desc', extra: '&with_genres=28' },
        { key: 'classic-horror-golden', title: 'Golden Age Horror Classics', sort: 'vote_count.desc', extra: '&vote_count.gte=300' },
        { key: 'eco-horror', title: 'Eco-Horror & Nature Attacks', sort: 'popularity.desc', extra: '&with_keywords=9902|5096&with_genres=27' },
        { key: 'cosmic-horror', title: 'Cosmic & Lovecraftian Horror', sort: 'vote_average.desc', extra: '&vote_count.gte=80' },
        { key: 'religious-horror', title: 'Religious & Cult Horror', sort: 'popularity.desc', extra: '&with_keywords=40931|6152&with_genres=27' },
        { key: 'isolation-horror', title: 'Isolation & Cabin-in-the-Woods Horror', sort: 'vote_average.desc', extra: '&vote_count.gte=150' },
        { key: 'anthology-horror', title: 'Horror Anthologies & Short Scares', sort: 'popularity.desc', extra: '&page=5' },
        { key: 'teen-horror', title: 'Teen Slashers & YA Horror', sort: 'popularity.desc', extra: '&with_keywords=296608' },
        { key: 'horror-romance', title: 'Dark Romance & Horror', sort: 'popularity.desc', extra: '&with_genres=10749' },
        { key: 'nordic-horror', title: 'Scandinavian & Nordic Horror', sort: 'popularity.desc', extra: '&with_origin_country=SE|NO|DK|FI' },
        { key: 'horror-2010s', title: 'Best Horror of the 2010s', sort: 'vote_count.desc', extra: '&primary_release_date.gte=2010-01-01&primary_release_date.lte=2019-12-31' },
        { key: 'horror-2020s', title: 'Modern Horror of the 2020s', sort: 'popularity.desc', extra: '&primary_release_date.gte=2020-01-01' },
      ];
    case '878':
    case '10765':
      return [
        { key: 'space-scifi', title: 'Space Travel & Exploration', sort: 'popularity.desc', extra: '&with_keywords=3801' },
        { key: 'time-travel-scifi', title: 'Time Travel & Alternate Realities', sort: 'popularity.desc', extra: '&with_keywords=4379' },
        { key: 'dystopian-scifi', title: 'Dystopian & Post-Apocalyptic', sort: 'popularity.desc', extra: '&with_keywords=4565' },
        { key: 'cyberpunk-ai', title: 'Cyberpunk & AI Sci-Fi', sort: 'popularity.desc', extra: '&with_keywords=4289' },
        { key: 'alien-contact', title: 'Alien Contact & Invasions', sort: 'popularity.desc', extra: '&with_keywords=9951' },
        { key: 'near-future', title: 'Near-Future Sci-Fi Thrillers', sort: 'vote_average.desc', extra: '&vote_count.gte=200' },
        { key: 'scifi-horror', title: 'Sci-Fi Horror Crossovers', sort: 'popularity.desc', extra: '&with_genres=27' },
        { key: 'superhero-scifi', title: 'Superhero Sci-Fi', sort: 'popularity.desc', extra: '&with_keywords=9715' },
        { key: 'robot-uprising', title: 'Robots & Androids', sort: 'popularity.desc', extra: '&with_keywords=14544' },
        { key: 'virtual-reality', title: 'Virtual Realities & Simulations', sort: 'popularity.desc', extra: '&with_keywords=4563' },
        { key: 'mind-bending', title: 'Mind-Bending Sci-Fi', sort: 'vote_average.desc', extra: '&vote_count.gte=500' },
        { key: 'first-contact', title: 'First Contact & Alien Life', sort: 'popularity.desc', extra: '&with_keywords=3801&page=2' },
        { key: 'space-opera', title: 'Space Opera & Galactic Sagas', sort: 'popularity.desc', extra: '&with_keywords=3801&with_genres=12' },
        { key: 'scifi-comedy', title: 'Sci-Fi Comedy & Satire', sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'climate-scifi', title: 'Climate Disaster Sci-Fi', sort: 'popularity.desc', extra: '&with_keywords=18330|5096' },
        { key: 'anime-scifi', title: 'Anime & Animated Sci-Fi', sort: 'popularity.desc', extra: '&with_keywords=210024' },
        { key: 'scifi-action', title: 'High-Action Sci-Fi', sort: 'popularity.desc', extra: '&with_genres=28' },
        { key: 'scifi-adventure', title: 'Sci-Fi Adventure', sort: 'popularity.desc', extra: '&with_genres=12' },
        { key: 'biotech-mutation', title: 'Biotech & Genetic Experiments', sort: 'popularity.desc', extra: '&with_keywords=14544&page=2' },
        { key: 'scifi-toprated', title: 'All-Time Sci-Fi Greats', sort: 'vote_average.desc', extra: '&vote_count.gte=800' },
        { key: 'scifi-p2', title: 'More Sci-Fi Favorites', sort: 'popularity.desc', extra: '&page=2' },
        { key: 'scifi-p3', title: 'Discover More Sci-Fi', sort: 'popularity.desc', extra: '&page=3' },
        { key: 'scifi-p4', title: 'Sci-Fi Hidden Gems', sort: 'popularity.desc', extra: '&page=4' },
        { key: 'international-scifi', title: 'International Sci-Fi Gems', sort: 'popularity.desc', extra: '&without_original_language=en' },
        { key: 'scifi-indie', title: 'Independent Sci-Fi', sort: 'vote_average.desc', extra: '&vote_count.gte=100&vote_count.lte=500' },
        { key: 'kids-scifi', title: 'Sci-Fi for All Ages', sort: 'popularity.desc', extra: '&with_genres=10751' },
        { key: 'time-loop', title: 'Time Loops & Paradoxes', sort: 'vote_average.desc', extra: '&with_keywords=4379&vote_count.gte=100' },
        { key: 'mecha-scifi', title: 'Mecha, Robots & Powered Suits', sort: 'popularity.desc', extra: '&with_keywords=14544&with_genres=16' },
        { key: 'genetic-experiment', title: 'Genetic Engineering & Evolution', sort: 'popularity.desc', extra: '&page=5' },
        { key: 'korean-scifi', title: 'Korean Sci-Fi Hits', sort: 'popularity.desc', extra: '&with_origin_country=KR' },
        { key: 'scifi-thriller-cross', title: 'Sci-Fi Thriller Hybrids', sort: 'vote_average.desc', extra: '&with_genres=53&vote_count.gte=200' },
        { key: 'scifi-drama-cross', title: 'Thoughtful Sci-Fi Drama', sort: 'vote_average.desc', extra: '&with_genres=18&vote_count.gte=300' },
        { key: 'scifi-2020s', title: 'New Sci-Fi of the 2020s', sort: 'popularity.desc', extra: '&primary_release_date.gte=2020-01-01' },
        { key: 'scifi-90s', title: '90s Sci-Fi Classics', sort: 'vote_count.desc', extra: '&primary_release_date.gte=1990-01-01&primary_release_date.lte=1999-12-31' },
      ];
    case '10749':
      return [
        { key: 'rom-comedy', title: 'Romantic Comedies', sort: 'popularity.desc', extra: '&with_genres=35&without_original_language=ko' },
        { key: 'rom-drama', title: 'Romantic Dramas', sort: 'popularity.desc', extra: '&with_genres=18&without_original_language=ko' },
        { key: 'k-drama-romance', title: 'K-Drama Romance', sort: 'popularity.desc', extra: '&with_origin_country=KR' },
        { key: 'forbidden-rom', title: 'Forbidden Love & Passion', sort: 'popularity.desc', extra: '&with_keywords=3691&without_original_language=ko' },
        { key: 'lgbtq-romance', title: 'LGBTQ+ Love Stories', sort: 'popularity.desc', extra: '&with_keywords=158718' },
        { key: 'summer-love', title: 'Summer Flings & Vacation Romance', sort: 'popularity.desc', extra: '&with_keywords=9935' },
        { key: 'unrequited-love', title: 'Unrequited Love & Heartbreak', sort: 'vote_average.desc', extra: '&vote_count.gte=200&without_original_language=ko' },
        { key: 'teen-romance', title: 'Teen & YA Romance', sort: 'popularity.desc', extra: '&with_keywords=10683&without_original_language=ko' },
        { key: 'wedding-jitters', title: 'Weddings, Engagements & Marriage', sort: 'popularity.desc', extra: '&page=2&without_original_language=ko' },
        { key: 'period-romance', title: 'Period Romance & Costume Dramas', sort: 'popularity.desc', extra: '&primary_release_date.lte=1995-01-01' },
        { key: 'workplace-romance', title: 'Office & Workplace Romances', sort: 'popularity.desc', extra: '&with_keywords=6282&without_original_language=ko' },
        { key: 'enemies-to-lovers', title: 'Enemies to Lovers', sort: 'popularity.desc', extra: '&page=3&without_original_language=ko' },
        { key: 'fantasy-romance', title: 'Fantasy & Supernatural Romance', sort: 'popularity.desc', extra: '&with_genres=14&without_original_language=ko' },
        { key: 'british-romance', title: 'British Romance & Period Drama', sort: 'popularity.desc', extra: '&with_origin_country=GB' },
        { key: 'french-romance', title: 'French & European Romance', sort: 'popularity.desc', extra: '&with_origin_country=FR|IT|ES' },
        { key: 'steamy-romance', title: 'Steamy & Passionate Romances', sort: 'vote_average.desc', extra: '&vote_count.gte=100&without_original_language=ko' },
        { key: 'second-chance-love', title: 'Second Chance & Reunion Romance', sort: 'popularity.desc', extra: '&page=4&without_original_language=ko' },
        { key: 'action-romance', title: 'Action-Adventure Romance', sort: 'popularity.desc', extra: '&with_genres=28&without_original_language=ko' },
        { key: 'romance-toprated', title: 'Critically Acclaimed Romance', sort: 'vote_average.desc', extra: '&vote_count.gte=400' },
        { key: 'classic-hollywood-romance', title: 'Classic Hollywood Romance', sort: 'vote_count.desc', extra: '&vote_count.gte=500&with_original_language=en' },
        { key: 'music-romance', title: 'Music & Love Stories', sort: 'popularity.desc', extra: '&with_genres=10402' },
        { key: 'royals-romance', title: 'Royals & Aristocratic Love', sort: 'popularity.desc', extra: '&with_genres=36&without_original_language=ko' },
        { key: 'holiday-romance', title: 'Holiday Season Romance', sort: 'vote_count.desc', extra: '&with_keywords=65' },
        { key: 'mature-love', title: 'Love After 40 & Second Bloom', sort: 'popularity.desc', extra: '&page=5&without_original_language=ko' },
        { key: 'indie-romance', title: 'Indie Romance & Low-Key Love', sort: 'vote_average.desc', extra: '&vote_count.gte=50&vote_count.lte=300' },
        { key: 'anime-romance', title: 'Anime Romance', sort: 'popularity.desc', extra: '&with_genres=16&with_origin_country=JP' },
        { key: 'chinese-romance', title: 'C-Drama & Chinese Romance', sort: 'popularity.desc', extra: '&with_origin_country=CN' },
        { key: 'us-rom-coms', title: 'Hollywood Rom-Coms', sort: 'vote_count.desc', extra: '&with_original_language=en&with_genres=35' },
        { key: 'romance-p2', title: 'More Romance Favorites', sort: 'popularity.desc', extra: '&page=6&without_original_language=ko' },
      ];
    case '9648':
      return [
        { key: 'detective-mystery', title: 'Cop & Detective Mysteries', sort: 'popularity.desc', extra: '' },
        { key: 'whodunit', title: 'Whodunits & Puzzle Mysteries', sort: 'vote_average.desc', extra: '&vote_count.gte=300' },
        { key: 'supernatural-mystery', title: 'Supernatural & Paranormal Mysteries', sort: 'popularity.desc', extra: '&with_keywords=6152' },
        { key: 'conspiracy-thriller', title: 'Conspiracy & Hidden Truths', sort: 'popularity.desc', extra: '&with_keywords=470' },
        { key: 'missing-persons', title: 'Disappearances & Cold Cases', sort: 'popularity.desc', extra: '&page=2' },
        { key: 'cozy-mystery', title: 'Cozy Mysteries & Armchair Sleuths', sort: 'vote_average.desc', extra: '&vote_count.gte=100' },
        { key: 'amateur-sleuths', title: 'Amateur Detectives & Unlikely Heroes', sort: 'popularity.desc', extra: '&page=3' },
        { key: 'small-town-secrets', title: 'Small Town Dark Secrets', sort: 'popularity.desc', extra: '&page=4' },
        { key: 'noir-neo-noir', title: 'Noir & Neo-Noir Classics', sort: 'popularity.desc', extra: '&with_genres=80' },
        { key: 'psych-mystery', title: 'Psychological & Mind-Bending Mysteries', sort: 'vote_average.desc', extra: '&vote_count.gte=200' },
        { key: 'classic-mysteries', title: 'Golden Age Mystery Classics', sort: 'vote_count.desc', extra: '&vote_count.gte=300' },
        { key: 'british-mysteries-2', title: 'British Detective Drama', sort: 'popularity.desc', extra: '&with_origin_country=GB' },
        { key: 'nordic-mysteries', title: 'Chilling Nordic Mysteries', sort: 'popularity.desc', extra: '&with_origin_country=SE|NO|DK' },
        { key: 'action-mysteries', title: 'Action-Packed Mystery Adventures', sort: 'popularity.desc', extra: '&with_genres=28' },
        { key: 'comedy-mysteries', title: 'Funny Whodunits & Madcap Mysteries', sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'true-crime-mysteries', title: 'True Crime & Real Investigations', sort: 'popularity.desc', extra: '&with_genres=99' },
        { key: 'historical-mystery', title: 'Historical Mysteries & Period Detectives', sort: 'popularity.desc', extra: '&with_genres=36' },
        { key: 'scifi-mystery', title: 'Sci-Fi & Tech Mysteries', sort: 'popularity.desc', extra: '&with_genres=878' },
        { key: 'courtroom-mystery', title: 'Courtroom Mysteries & Legal Thrillers', sort: 'popularity.desc', extra: '&with_genres=53' },
        { key: 'international-mystery', title: 'International Mystery Gems', sort: 'popularity.desc', extra: '&without_original_language=en' },
        { key: 'asian-mystery', title: 'Asian Crime & Mystery', sort: 'popularity.desc', extra: '&with_origin_country=JP|KR' },
        { key: 'mystery-toprated', title: 'Highest-Rated Mysteries', sort: 'vote_average.desc', extra: '&vote_count.gte=500' },
        { key: 'mystery-p2', title: 'More Mystery Favorites', sort: 'popularity.desc', extra: '&page=5' },
        { key: 'heist-mystery', title: 'Heist & Caper Mysteries', sort: 'popularity.desc', extra: '&with_keywords=10051' },
        { key: 'locked-room', title: 'Locked-Room & Impossible Crimes', sort: 'vote_average.desc', extra: '&vote_count.gte=100' },
      ];
    case '53':
      return [
        { key: 'psych-thriller', title: 'Psychological Thrillers', sort: 'vote_average.desc', extra: '&vote_count.gte=1000' },
        { key: 'spy-thriller', title: 'Espionage & Spy Operations', sort: 'popularity.desc', extra: '&with_keywords=470' },
        { key: 'crime-suspense', title: 'Crime & Law Suspense', sort: 'popularity.desc', extra: '&with_genres=80' },
        { key: 'home-invasion', title: 'Home Invasion & Survival', sort: 'popularity.desc', extra: '&with_keywords=10349' },
        { key: 'cat-mouse', title: 'Cat & Mouse Mind Games', sort: 'vote_average.desc', extra: '&vote_count.gte=300' },
        { key: 'tech-paranoia', title: 'Tech Paranoia & Digital Dangers', sort: 'popularity.desc', extra: '&with_keywords=4289' },
        { key: 'legal-corruption', title: 'Legal Corruption & Corporate Thrillers', sort: 'popularity.desc', extra: '&with_genres=80' },
        { key: 'survival-thriller', title: 'Survival Thrillers', sort: 'popularity.desc', extra: '&with_keywords=10349' },
        { key: 'political-thriller', title: 'Political Thrillers', sort: 'popularity.desc', extra: '&with_keywords=470' },
        { key: 'action-thriller', title: 'Action Thrillers', sort: 'popularity.desc', extra: '&with_genres=28' },
        { key: 'hostage-situation', title: 'Hostage Situations', sort: 'popularity.desc', extra: '&with_keywords=1556' },
        { key: 'mystery-thriller', title: 'Mystery Thrillers', sort: 'popularity.desc', extra: '&with_genres=9648' },
        { key: 'serial-killer-thriller', title: 'Serial Killer Hunts', sort: 'popularity.desc', extra: '&with_keywords=12339' },
        { key: 'scifi-thriller', title: 'Sci-Fi Thrillers', sort: 'popularity.desc', extra: '&with_genres=878' },
        { key: 'horror-thriller', title: 'Horror Thrillers', sort: 'popularity.desc', extra: '&with_genres=27' },
        { key: 'conspiracy-thriller', title: 'Conspiracy & Cover-Ups', sort: 'popularity.desc', extra: '&with_keywords=470&page=2' },
        { key: 'heist-thriller', title: 'Heist Thrillers', sort: 'popularity.desc', extra: '&with_keywords=10051' },
        { key: 'nordic-thriller', title: 'Nordic Crime & Thriller', sort: 'popularity.desc', extra: '&with_origin_country=SE|NO|DK|FI' },
        { key: 'intl-thriller', title: 'International Thriller Gems', sort: 'popularity.desc', extra: '&without_original_language=en' },
        { key: 'thriller-toprated', title: 'Critically Acclaimed Thrillers', sort: 'vote_average.desc', extra: '&vote_count.gte=600' },
        { key: 'thriller-p2', title: 'More Thriller Picks', sort: 'popularity.desc', extra: '&page=2' },
        { key: 'thriller-p3', title: 'Discover More Thrillers', sort: 'popularity.desc', extra: '&page=3' },
        { key: 'thriller-classics', title: 'Classic Thriller Masterpieces', sort: 'vote_count.desc', extra: '&vote_count.gte=300' },
        { key: 'thriller-p4', title: 'Thriller Hidden Gems', sort: 'popularity.desc', extra: '&page=4' },
      ];
    case '37':
      return [
        { key: 'outlaws-revenge', title: 'Outlaws & Revenge Sagas', sort: 'popularity.desc', extra: '&with_keywords=9748' },
        { key: 'bounty-hunters', title: 'Bounty Hunters & Gunslingers', sort: 'vote_count.desc', extra: '' },
        { key: 'frontier-life', title: 'Frontier Life & Settlers', sort: 'popularity.desc', extra: '&with_keywords=9454' },
        { key: 'revisionist-western', title: 'Revisionist & Modern Westerns', sort: 'vote_average.desc', extra: '&vote_count.gte=200' },
        { key: 'spaghetti-western', title: 'Spaghetti Westerns & Italian Classics', sort: 'vote_count.desc', extra: '&with_origin_country=IT|ES' },
        { key: 'western-action', title: 'Action-Packed Westerns', sort: 'popularity.desc', extra: '&with_genres=28' },
        { key: 'western-comedy', title: 'Comedy Westerns', sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'western-scifi', title: 'Sci-Fi Westerns & Space Cowboys', sort: 'popularity.desc', extra: '&with_genres=878' },
        { key: 'classic-western', title: 'Classic Western Heroes', sort: 'vote_count.desc', extra: '&vote_count.gte=250' },
        { key: 'native-american', title: 'Native American & Revisionist Stories', sort: 'popularity.desc', extra: '&page=2' },
        { key: 'neo-western', title: 'Neo-Westerns & Modern Frontier', sort: 'popularity.desc', extra: '&page=3' },
        { key: 'western-mystery', title: 'Western Mystery & Crime', sort: 'popularity.desc', extra: '&with_genres=9648|80' },
        { key: 'epic-western', title: 'Epic Wide-Screen Westerns', sort: 'vote_average.desc', extra: '&vote_count.gte=300' },
        { key: 'western-animation', title: 'Animated Western Adventures', sort: 'popularity.desc', extra: '&with_genres=16' },
        { key: 'outlaw-biopics', title: 'Outlaw Biographies', sort: 'popularity.desc', extra: '&with_keywords=818' },
        { key: 'western-p2', title: 'More Western Favorites', sort: 'popularity.desc', extra: '&page=4' },
      ];
    case '10752':
      return [
        { key: 'military-combat-war', title: 'Military & Combat Action', sort: 'vote_count.desc', extra: '' },
        { key: 'historical-war', title: 'Historical Warfare', sort: 'popularity.desc', extra: '&with_genres=36' },
        { key: 'war-survival', title: 'Survival & Heroism', sort: 'popularity.desc', extra: '&with_keywords=10349' },
        { key: 'anti-war', title: 'Thought-Provoking Anti-War Stories', sort: 'vote_average.desc', extra: '&vote_count.gte=300' },
        { key: 'cold-war', title: 'Cold War Intrigue', sort: 'popularity.desc', extra: '&with_keywords=470' },
        { key: 'ww2-war', title: 'World War II Epics', sort: 'vote_count.desc', extra: '&vote_count.gte=300' },
        { key: 'ww1-war', title: 'World War I Stories', sort: 'popularity.desc', extra: '&page=2' },
        { key: 'vietnam-war', title: 'Vietnam War Films', sort: 'popularity.desc', extra: '&primary_release_date.gte=1970-01-01&primary_release_date.lte=1985-01-01' },
        { key: 'war-drama', title: 'Powerful War Dramas', sort: 'popularity.desc', extra: '&with_genres=18' },
        { key: 'war-action', title: 'War Action Spectacles', sort: 'popularity.desc', extra: '&with_genres=28' },
        { key: 'special-ops', title: 'Special Forces & Elite Ops', sort: 'popularity.desc', extra: '&with_keywords=470&with_genres=28' },
        { key: 'prisoner-of-war', title: 'Prisoners of War & Escape', sort: 'popularity.desc', extra: '&with_keywords=378' },
        { key: 'naval-warfare', title: 'Naval & Sea Warfare', sort: 'popularity.desc', extra: '&page=3' },
        { key: 'war-docs', title: 'War Documentaries & Testimonials', sort: 'popularity.desc', extra: '&with_genres=99' },
        { key: 'war-home-front', title: 'Home Front & Civilian Stories', sort: 'popularity.desc', extra: '&with_genres=18&page=2' },
        { key: 'modern-warfare', title: 'Modern & Contemporary Warfare', sort: 'popularity.desc', extra: '&page=4' },
        { key: 'war-toprated', title: 'Greatest War Films of All Time', sort: 'vote_average.desc', extra: '&vote_count.gte=500' },
        { key: 'intl-war', title: 'International War Cinema', sort: 'popularity.desc', extra: '&without_original_language=en' },
      ];
    case '36':
      return [
        { key: 'historical-bios', title: 'Biographies & Historical Profiles', sort: 'popularity.desc', extra: '&with_keywords=818' },
        { key: 'war-history', title: 'War & Military History', sort: 'popularity.desc', extra: '&with_genres=10752' },
        { key: 'ancient-civil', title: 'Ancient Civilizations', sort: 'popularity.desc', extra: '&primary_release_date.lte=1975-01-01' },
        { key: 'political-history', title: 'Political History & Power Games', sort: 'vote_count.desc', extra: '&page=3' },
        { key: 'royal-court', title: 'Royalty & Court Intrigue', sort: 'vote_average.desc', extra: '&vote_count.gte=200' },
        { key: 'civil-rights', title: 'Civil Rights & Social Justice', sort: 'popularity.desc', extra: '&with_genres=18&page=2' },
        { key: 'period-drama-history', title: 'Historical Epics & Costume Dramas', sort: 'vote_average.desc', extra: '&vote_count.gte=500' },
        { key: 'history-docs', title: 'Historical Documentaries', sort: 'popularity.desc', extra: '&with_genres=99' },
        { key: 'medieval-history', title: 'Medieval & Dark Ages', sort: 'popularity.desc', extra: '&with_genres=14&page=2' },
        { key: 'roman-greek', title: 'Ancient Rome & Greece', sort: 'popularity.desc', extra: '&primary_release_date.lte=1975-01-01&page=2' },
        { key: 'american-history', title: 'American History Stories', sort: 'popularity.desc', extra: '&with_origin_country=US&page=2' },
        { key: 'european-history', title: 'European History & Culture', sort: 'popularity.desc', extra: '&with_origin_country=GB|FR|DE|IT|ES' },
        { key: 'asian-history', title: 'Asian History & Dynasties', sort: 'popularity.desc', extra: '&with_origin_country=JP|CN|KR|IN' },
        { key: 'ww2-history', title: 'World War II History', sort: 'vote_count.desc', extra: '&with_genres=10752' },
        { key: 'explorer-pioneers', title: 'Explorers, Pioneers & Inventors', sort: 'popularity.desc', extra: '&page=2' },
        { key: 'revolution-history', title: 'Revolutions That Changed the World', sort: 'popularity.desc', extra: '&page=3' },
        { key: 'victorian-era', title: 'Victorian & Industrial Era', sort: 'popularity.desc', extra: '&with_keywords=252596' },
        { key: 'african-history', title: 'African & World History', sort: 'popularity.desc', extra: '&without_original_language=en&page=2' },
        { key: 'history-crime', title: 'Historical Crime & Mystery', sort: 'popularity.desc', extra: '&with_genres=80&with_genres=9648' },
        { key: 'historical-romance', title: 'Historical Romance & Passion', sort: 'popularity.desc', extra: '&with_genres=10749' },
        { key: 'history-toprated', title: 'Highest-Rated History Films', sort: 'vote_average.desc', extra: '&vote_count.gte=400' },
        { key: 'history-p2', title: 'More Historical Favorites', sort: 'popularity.desc', extra: '&page=4' },
      ];
    case '10402':
      return [
        { key: 'musicals', title: 'Beloved Musicals', sort: 'vote_count.desc', extra: '' },
        { key: 'rock-pop-sagas', title: 'Rock & Pop Music Biopics', sort: 'popularity.desc', extra: '&with_keywords=818' },
        { key: 'concert-films', title: 'Concert Films & Live Performances', sort: 'popularity.desc', extra: '&page=2' },
        { key: 'hip-hop-culture', title: 'Hip-Hop & Urban Music Stories', sort: 'popularity.desc', extra: '&with_keywords=898' },
        { key: 'broadway-musicals', title: 'Broadway & Stage Musicals', sort: 'vote_average.desc', extra: '&vote_count.gte=200' },
        { key: 'jazz-blues', title: 'Jazz & Blues Classics', sort: 'vote_count.desc', extra: '&page=3' },
        { key: 'classical-music', title: 'Classical Music & Opera', sort: 'popularity.desc', extra: '&page=4' },
        { key: 'dance-music', title: 'Dance & Choreography Films', sort: 'popularity.desc', extra: '&page=3' },
        { key: 'country-folk', title: 'Country, Folk & Americana', sort: 'popularity.desc', extra: '&with_origin_country=US&page=2' },
        { key: 'animated-musicals', title: 'Animated Musical Adventures', sort: 'popularity.desc', extra: '&with_genres=16' },
        { key: 'music-docs', title: 'Behind the Music Documentaries', sort: 'popularity.desc', extra: '&with_genres=99' },
        { key: 'reggae-world-music', title: 'World Music & Reggae Stories', sort: 'popularity.desc', extra: '&without_original_language=en' },
        { key: 'music-romance', title: 'Music & Romance', sort: 'popularity.desc', extra: '&with_genres=10749' },
        { key: 'music-comedy', title: 'Musical Comedies', sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'music-drama', title: 'Music Dramas & Struggles', sort: 'popularity.desc', extra: '&with_genres=18' },
        { key: 'band-stories', title: 'Band Stories & Music Rivalries', sort: 'popularity.desc', extra: '&page=5' },
        { key: 'music-toprated', title: 'Highest-Rated Music Films', sort: 'vote_average.desc', extra: '&vote_count.gte=200' },
      ];
    case '10764':
      return [
        { key: 'reality-comps', title: 'Talent & Competition Shows', sort: 'vote_count.desc', extra: '' },
        { key: 'dating-reality', title: 'Dating, Love & Reality Romance', sort: 'popularity.desc', extra: '&page=2' },
        { key: 'survival-reality', title: 'Survival Challenges & Wilderness', sort: 'popularity.desc', extra: '&page=4' },
        { key: 'makeover-reality', title: 'Makeover & Life Transformation', sort: 'popularity.desc', extra: '&page=3' },
        { key: 'docusoap', title: 'Docusoaps & Celebrity Real Lives', sort: 'vote_average.desc', extra: '&vote_count.gte=50' },
        { key: 'food-reality', title: 'Cooking, Baking & Food Competitions', sort: 'popularity.desc', extra: '&page=5' },
        { key: 'home-real-estate', title: 'Real Estate & Home Renovation', sort: 'popularity.desc', extra: '&page=4' },
        { key: 'travel-reality', title: 'Travel, Adventure & Exploration Shows', sort: 'popularity.desc', extra: '&page=6' },
        { key: 'game-shows', title: 'Game Shows & Trivia Challenges', sort: 'popularity.desc', extra: '' },
        { key: 'talent-shows', title: 'Singing, Dancing & Talent Battles', sort: 'vote_count.desc', extra: '&page=2' },
        { key: 'celebrity-reality', title: 'Celebrity Life & Behind the Scenes', sort: 'popularity.desc', extra: '&page=5' },
        { key: 'extreme-challenges', title: 'Extreme Challenges & Stunts', sort: 'popularity.desc', extra: '&with_keywords=10349&page=2' },
        { key: 'fashion-beauty', title: 'Fashion, Beauty & Style Shows', sort: 'popularity.desc', extra: '&page=6' },
        { key: 'international-reality', title: 'International Reality Hits', sort: 'popularity.desc', extra: '&without_original_language=en' },
        { key: 'true-crime-reality', title: 'True Crime Reality Shows', sort: 'popularity.desc', extra: '&with_genres=99' },
        { key: 'family-reality', title: 'Family & Kids Reality Shows', sort: 'popularity.desc', extra: '&with_genres=10751' },
        { key: 'sports-reality', title: 'Sports Reality & Athletic Challenges', sort: 'popularity.desc', extra: '&with_keywords=6075' },
        { key: 'business-reality', title: 'Business & Entrepreneur Shows', sort: 'popularity.desc', extra: '&page=7' },
        { key: 'nature-wildlife-reality', title: 'Nature & Wildlife Reality Shows', sort: 'popularity.desc', extra: '&page=6' },
        { key: 'reality-toprated', title: 'Highest-Rated Reality TV', sort: 'vote_average.desc', extra: '&vote_count.gte=100' },
      ];
    case '10768':
      return [
        { key: 'political-drama-wp', title: 'Political Dramas & Power Games', sort: 'vote_count.desc', extra: '' },
        { key: 'military-ops-wp', title: 'Military Operations & Command', sort: 'popularity.desc', extra: '&with_keywords=470' },
        { key: 'war-politics-thriller', title: 'War & Politics Thrillers', sort: 'popularity.desc', extra: '&with_genres=53' },
        { key: 'political-intrigue', title: 'Espionage & Political Intrigue', sort: 'popularity.desc', extra: '&with_keywords=470' },
        { key: 'government-corruption', title: 'Government Corruption Stories', sort: 'vote_average.desc', extra: '&vote_count.gte=50&page=2' },
        { key: 'democracy-elections', title: 'Democracy, Elections & Campaigns', sort: 'popularity.desc', extra: '&page=2' },
        { key: 'whistleblowers', title: 'Whistleblowers & Truth Seekers', sort: 'vote_average.desc', extra: '&vote_count.gte=100' },
        { key: 'cold-war-politics', title: 'Cold War & Geopolitical Tension', sort: 'popularity.desc', extra: '&with_keywords=470&page=2' },
        { key: 'revolution-uprising', title: 'Revolutions & Uprisings', sort: 'popularity.desc', extra: '&with_genres=18' },
        { key: 'civil-conflict', title: 'Civil War & Internal Conflict', sort: 'popularity.desc', extra: '&with_genres=10752' },
        { key: 'frontline-reporting', title: 'War Journalism & Frontline Docs', sort: 'popularity.desc', extra: '&with_genres=99' },
        { key: 'propaganda-power', title: 'Propaganda, Power & Ideology', sort: 'vote_average.desc', extra: '&vote_count.gte=50' },
        { key: 'political-satire-wp', title: 'Political Satire & Dark Comedy', sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'wartime-leadership', title: 'Wartime Leadership & Sacrifice', sort: 'vote_count.desc', extra: '' },
        { key: 'international-politics', title: 'International Affairs & Diplomacy', sort: 'popularity.desc', extra: '&without_original_language=en' },
        { key: 'war-politics-p2', title: 'More War & Politics Picks', sort: 'popularity.desc', extra: '&page=3' },
      ];
    case '10766':
      return [
        { key: 'soap-drama', title: 'Daily Dramas & Telenovelas', sort: 'popularity.desc', extra: '' },
        { key: 'family-soaps', title: 'Family Saga Soap Operas', sort: 'popularity.desc', extra: '&with_genres=10751' },
        { key: 'latin-telenovelas', title: 'Latin & Spanish Telenovelas', sort: 'popularity.desc', extra: '&with_origin_country=MX|BR|CO|AR' },
        { key: 'british-soaps', title: 'Classic British Soaps', sort: 'popularity.desc', extra: '&with_origin_country=GB' },
        { key: 'american-soaps', title: 'American Daytime Drama', sort: 'popularity.desc', extra: '&with_origin_country=US' },
        { key: 'romance-soaps', title: 'Romantic Soap Operas', sort: 'popularity.desc', extra: '&with_genres=10749' },
        { key: 'korean-dramas', title: 'K-Drama Love & Passion', sort: 'popularity.desc', extra: '&with_origin_country=KR' },
        { key: 'scandal-secrets', title: 'Scandals, Secrets & Affairs', sort: 'vote_average.desc', extra: '&vote_count.gte=50' },
        { key: 'class-wealth-soaps', title: 'Class, Wealth & High Society', sort: 'popularity.desc', extra: '&page=2' },
        { key: 'revenge-betrayal', title: 'Revenge & Betrayal Stories', sort: 'popularity.desc', extra: '&page=3' },
        { key: 'soap-toprated', title: 'Highly Rated Soap Dramas', sort: 'vote_average.desc', extra: '&vote_count.gte=100' },
        { key: 'soap-p2', title: 'More Soap Opera Favorites', sort: 'popularity.desc', extra: '&page=4' },
      ];
    case '10763':
      return [
        { key: 'current-affairs', title: 'Current Affairs & Specials', sort: 'popularity.desc', extra: '' },
        { key: 'doc-news', title: 'Investigative Journalism', sort: 'popularity.desc', extra: '&with_genres=99' },
        { key: 'political-news', title: 'Political News & Analysis', sort: 'popularity.desc', extra: '&page=2' },
        { key: 'breaking-news-docs', title: 'Breaking News Documentaries', sort: 'vote_average.desc', extra: '&vote_count.gte=50' },
        { key: 'war-reporting', title: 'War Reporting & Frontline News', sort: 'vote_average.desc', extra: '&vote_count.gte=50' },
        { key: 'climate-news', title: 'Climate & Environmental Reporting', sort: 'popularity.desc', extra: '&with_keywords=9902|18330' },
        { key: 'sports-news', title: 'Sports News & Analysis', sort: 'popularity.desc', extra: '&with_keywords=6075' },
        { key: 'satire-news', title: 'News Satire & Comedy', sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'international-news', title: 'International News Perspectives', sort: 'popularity.desc', extra: '&without_original_language=en' },
        { key: 'news-p2', title: 'More News & Commentary', sort: 'popularity.desc', extra: '&page=2' },
      ];
    
    case '10001': // Pride / LGBTQ
      return [
        { key: 'pride-classics', title: 'Iconic Pride Classics', sort: 'vote_count.desc', extra: '&with_keywords=158718' },
        { key: 'feel-good-favs', title: 'Feel-Good LGBTQ+ Favorites', sort: 'popularity.desc', extra: '&with_keywords=158718&with_genres=35' },
        { key: 'love-out-loud', title: 'LGBTQ+ Romance & Love Stories', sort: 'popularity.desc', extra: '&with_keywords=158718&with_genres=10749' },
        { key: 'beyond-binary', title: 'Beyond the Binary: Trans & Non-Binary Stories', sort: 'popularity.desc', extra: '&with_keywords=158718' },
        { key: 'inspired-true', title: 'LGBTQ+ Stories Inspired by Real Life', sort: 'popularity.desc', extra: '&with_keywords=158718' },
        { key: 'critics-love', title: 'Critically Acclaimed LGBTQ+ Stories', sort: 'vote_average.desc', extra: '&with_keywords=158718&vote_count.gte=50' },
        { key: 'queer-horror', title: 'Queer Horror & Thrills', sort: 'popularity.desc', extra: '&with_keywords=158718&with_genres=27|53' },
        { key: 'lesbian-cinema', title: 'Sapphic Love & Dramas', sort: 'popularity.desc', extra: '&with_keywords=158718' },
        { key: 'drag-culture', title: 'Drag Queens & Ballroom Culture', sort: 'popularity.desc', extra: '&with_keywords=824' },
        { key: 'queer-docs', title: 'Essential Queer Documentaries', sort: 'popularity.desc', extra: '&with_keywords=158718&with_genres=99' },
        { key: 'international-queer', title: 'Global LGBTQ+ Cinema', sort: 'popularity.desc', extra: '&with_keywords=158718' },
        { key: 'queer-comedy', title: 'Hilarious Queer Comedies', sort: 'popularity.desc', extra: '&with_keywords=158718&with_genres=35' },
        { key: 'queer-indie', title: 'Under-the-Radar Queer Indies', sort: 'popularity.desc', extra: '&with_keywords=158718' },
        { key: 'coming-of-age-pride', title: 'Queer Coming-of-Age', sort: 'popularity.desc', extra: '&with_keywords=158718' },
        { key: 'queer-drama', title: 'Transcendent Queer Dramas', sort: 'popularity.desc', extra: '&with_keywords=158718&with_genres=18' },
        { key: 'queer-pop-culture', title: 'Queer Pop Culture & Musicals', sort: 'popularity.desc', extra: '&with_keywords=158718&with_genres=10402' },
        { key: 'british-queer', title: 'British Queer Cinema', sort: 'popularity.desc', extra: '&with_keywords=158718' },
        { key: 'queer-action', title: 'LGBTQ+ Action', sort: 'popularity.desc', extra: '&with_keywords=158718&with_genres=28' },
        { key: 'queer-scifi', title: 'Sci-Fi & Fantasy LGBTQ+ Stories', sort: 'popularity.desc', extra: '&with_keywords=158718&with_genres=878|14' },
        { key: 'queer-history', title: 'Historical LGBTQ+ Stories', sort: 'popularity.desc', extra: '&with_keywords=158718&with_genres=36' },
        { key: 'queer-mysteries', title: 'LGBTQ+ Crime & Mysteries', sort: 'popularity.desc', extra: '&with_keywords=158718&with_genres=80|9648' },
        { key: 'queer-family', title: 'Queer Family & Relationships', sort: 'popularity.desc', extra: '&with_keywords=158718&with_genres=10751' },
        { key: 'queer-youth', title: 'LGBTQ+ Youth Stories', sort: 'popularity.desc', extra: '&with_keywords=158718' },
        { key: 'queer-shorts', title: 'Short Queer Cinema', sort: 'popularity.desc', extra: '&with_keywords=158718' },
        { key: 'queer-festival', title: 'LGBTQ+ Festival Favorites', sort: 'popularity.desc', extra: '&with_keywords=158718' },
        { key: 'queer-award', title: 'Award-Winning LGBTQ+', sort: 'popularity.desc', extra: '&with_keywords=158718' },
        { key: 'queer-reality', title: 'Queer Reality TV', sort: 'popularity.desc', extra: '&with_keywords=158718&with_genres=10764' },
        { key: 'pride-month', title: 'Celebrate Pride Month', sort: 'popularity.desc', extra: '&with_keywords=158718' },
        { key: 'queer-visionaries', title: 'Visionary Queer Storytellers', sort: 'popularity.desc', extra: '&with_keywords=158718' },
        { key: 'queer-icons', title: 'Icons of the LGBTQ+ Community', sort: 'vote_count.desc', extra: '&with_keywords=158718' }
      ];
    case '10002': // Astrology
      // Base keywords (set in constants.ts): 156174|40931|14742|2591
      // occult | witchcraft | psychic | tarot cards
      return [
        { key: 'astro-popular',   title: 'Supernatural & Occult',    sort: 'popularity.desc', extra: '' },
        { key: 'astro-acclaimed', title: 'Acclaimed Mystic Films',    sort: 'vote_count.desc', extra: '' },
        { key: 'astro-horror',    title: 'Occult Horror',             sort: 'popularity.desc', extra: '&with_genres=27' },
        { key: 'astro-mystery',   title: 'Psychic Mysteries',         sort: 'popularity.desc', extra: '&with_genres=9648' },
        { key: 'astro-thriller',  title: 'Supernatural Thrillers',    sort: 'popularity.desc', extra: '&with_genres=53' },
        { key: 'astro-fantasy',   title: 'Magic & Fantasy',           sort: 'popularity.desc', extra: '&with_genres=14' },
        { key: 'astro-drama',     title: 'Spiritual Dramas',          sort: 'popularity.desc', extra: '&with_genres=18' },
        { key: 'astro-romance',   title: 'Star-Crossed Love',         sort: 'popularity.desc', extra: '&with_genres=10749' },
        { key: 'astro-scifi',     title: 'Cosmic Sci-Fi',             sort: 'popularity.desc', extra: '&with_genres=878' },
        { key: 'astro-animation', title: 'Animated Supernatural',     sort: 'popularity.desc', extra: '&with_genres=16' },
        { key: 'astro-comedy',    title: 'Supernatural Comedies',     sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'astro-action',    title: 'Occult Action',             sort: 'popularity.desc', extra: '&with_genres=28' },
        { key: 'astro-ancient',   title: 'Ancient Mystics',           sort: 'popularity.desc', extra: '&with_genres=36' },
        { key: 'astro-more',      title: 'More Supernatural Cinema',  sort: 'popularity.desc', extra: '&page=2' },
        { key: 'astro-deep',      title: 'Deep Cuts: Esoteric Films', sort: 'popularity.desc', extra: '&page=3' },
      ];
    case '10003': // Black Stories
      // Base keywords (set in constants.ts fetchByGenre genreId 10003):
      //   movie: 12425|256015|41385|6984  (racism | african american | racial tension | racial segregation)
      //   tv:    12425|898|256015|41385   (racism | hip-hop | african american | racial tension)
      return [
        { key: 'bs-popular',   title: 'Popular Black Cinema',   sort: 'popularity.desc', extra: '' },
        { key: 'bs-acclaimed', title: 'Acclaimed Black Cinema',  sort: 'vote_count.desc', extra: '' },
        { key: 'bs-drama',     title: 'Powerful Black Dramas',   sort: 'popularity.desc', extra: '&with_genres=18' },
        { key: 'bs-comedy',    title: 'Black Comedy',            sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'bs-docs',      title: 'Black Documentaries',     sort: 'popularity.desc', extra: '&with_genres=99' },
        { key: 'bs-crime',     title: 'Black Crime Stories',     sort: 'popularity.desc', extra: '&with_genres=80' },
        { key: 'bs-thriller',  title: 'Black Thrillers',         sort: 'popularity.desc', extra: '&with_genres=53' },
        { key: 'bs-romance',   title: 'Black Love & Romance',    sort: 'popularity.desc', extra: '&with_genres=10749' },
        { key: 'bs-action',    title: 'Black Action Films',      sort: 'popularity.desc', extra: '&with_genres=28' },
        { key: 'bs-history',   title: 'Black History Films',     sort: 'popularity.desc', extra: '&with_genres=36' },
        { key: 'bs-horror',    title: 'Black Horror',            sort: 'popularity.desc', extra: '&with_genres=27' },
        { key: 'bs-western',   title: 'Black Westerns',          sort: 'popularity.desc', extra: '&with_genres=37' },
        { key: 'bs-british',   title: 'Black British Stories',   sort: 'popularity.desc', extra: '&with_origin_country=GB' },
        { key: 'bs-scifi',     title: 'Black Sci-Fi',            sort: 'popularity.desc', extra: '&with_genres=878' },
        { key: 'bs-music',     title: 'Black Music Films',       sort: 'popularity.desc', extra: '&with_genres=10402' },
        { key: 'bs-more',      title: 'More Black Cinema',       sort: 'popularity.desc', extra: '&page=2' },
        ...(mediaType === 'movie' ? [
          { key: 'bs-hiphop',
            title: 'Hip-Hop & Soul Biopics',
            sort: '', extra: '',
            url: REQUESTS._build(`${BASE_URL}/discover/movie`, { sort_by: 'popularity.desc', 'vote_count.gte': 25, with_keywords: '898|254106' }),
          },
          { key: 'bs-civil-rights',
            title: 'Civil Rights Stories',
            sort: '', extra: '',
            url: REQUESTS._build(`${BASE_URL}/discover/movie`, { sort_by: 'popularity.desc', 'vote_count.gte': 25, with_keywords: '270891|4098' }),
          },
          { key: 'recs-get-out', title: 'More Like Get Out', sort: '', extra: '', url: REQUESTS.fetchRecommendations('movie', 419430) },
          { key: 'recs-selma',   title: 'Films Like Selma',  sort: '', extra: '', url: REQUESTS.fetchRecommendations('movie', 244786) },
        ] : [
          { key: 'bs-hiphop',
            title: 'Hip-Hop TV Shows',
            sort: '', extra: '',
            url: REQUESTS._build(`${BASE_URL}/discover/tv`, { sort_by: 'popularity.desc', 'vote_count.gte': 5, with_keywords: '898' }),
          },
          { key: 'bs-civil-rights',
            title: 'Civil Rights Stories',
            sort: '', extra: '',
            url: REQUESTS._build(`${BASE_URL}/discover/tv`, { sort_by: 'popularity.desc', 'vote_count.gte': 5, with_keywords: '270891|4098' }),
          },
          { key: 'recs-atlanta', title: 'Because You Like Atlanta', sort: '', extra: '', url: REQUESTS.fetchRecommendations('tv', 67195) },
        ]),
      ];
    case '10004': // Book Adaptations
      return [
        { key: 'page-to-screen', title: 'Page-to-Screen Masterpieces', sort: 'popularity.desc', extra: '' },
        { key: 'literary-adaptations', title: 'Literary Adaptations', sort: 'vote_count.desc', extra: '' },
        { key: 'bestseller-hits', title: 'Bestseller Hits', sort: 'popularity.desc', extra: '&page=2' },
        { key: 'young-adult-books', title: 'Young Adult Novel Adaptations', sort: 'popularity.desc', extra: '&with_keywords=818' },
        { key: 'classic-lit', title: 'Classic Literature Brought to Life', sort: 'vote_average.desc', extra: '&with_keywords=818&vote_count.gte=100' },
        { key: 'fantasy-books', title: 'Epic Fantasy Novels', sort: 'popularity.desc', extra: '&with_keywords=818&with_genres=14' },
        { key: 'thriller-books', title: 'Gripping Thriller Books', sort: 'popularity.desc', extra: '&with_keywords=818&with_genres=53' },
        { key: 'comic-book-books', title: 'Graphic Novel & Comic Adaptations', sort: 'popularity.desc', extra: '&with_keywords=9715' },
        { key: 'scifi-books', title: 'Sci-Fi Masterpieces from Novels', sort: 'popularity.desc', extra: '&with_keywords=818&with_genres=878|10765' },
        { key: 'true-crime-books', title: 'True Crime Book Adaptations', sort: 'popularity.desc', extra: '&with_genres=80&with_keywords=818' },
        { key: 'historical-books', title: 'Historical & Period Novels', sort: 'popularity.desc', extra: '&with_keywords=818&with_genres=36' },
        { key: 'romance-books', title: 'Romantic Bestsellers', sort: 'popularity.desc', extra: '&with_keywords=818&with_genres=10749' },
        { key: 'award-books', title: 'Award-Winning Adaptations', sort: 'popularity.desc', extra: '&with_keywords=818' },
        { key: 'kids-books', title: 'Children\'s Book Classics', sort: 'popularity.desc', extra: '&with_keywords=818&with_genres=10751|16' },
        { key: 'biography-books', title: 'Biographies & Real Memoirs', sort: 'popularity.desc', extra: '&with_keywords=818' },
        { key: 'cozy-books', title: 'Cozy Mystery Novel Adaptations', sort: 'popularity.desc', extra: '&with_keywords=818&with_genres=9648' },
        { key: 'dystopian-books', title: 'Dystopian Novels', sort: 'popularity.desc', extra: '&with_keywords=4565' },
        { key: 'horror-books', title: 'Terrifying Book Adaptations', sort: 'popularity.desc', extra: '&with_keywords=818&with_genres=27' },
        { key: 'action-books', title: 'Action-Packed Book Adaptations', sort: 'popularity.desc', extra: '&with_keywords=818&with_genres=28' },
        { key: 'comedy-books', title: 'Funny Book Adaptations', sort: 'popularity.desc', extra: '&with_keywords=818&with_genres=35' },
        { key: 'drama-books', title: 'Dramatic Book Adaptations', sort: 'popularity.desc', extra: '&with_keywords=818&with_genres=18' },
        { key: 'spy-books', title: 'Espionage Book Adaptations', sort: 'popularity.desc', extra: '&with_keywords=818&with_keywords=470' },
        { key: 'vampire-books', title: 'Vampire Book Adaptations', sort: 'popularity.desc', extra: '&with_keywords=818&with_keywords=3133' },
        { key: 'witch-books', title: 'Witches & Magic Book Adaptations', sort: 'popularity.desc', extra: '&with_keywords=818&with_genres=14' },
        { key: 'sports-books', title: 'Sports Book Adaptations', sort: 'popularity.desc', extra: '&with_keywords=818&with_keywords=6075' },
        { key: 'music-books', title: 'Music Book Adaptations', sort: 'popularity.desc', extra: '&with_keywords=818&with_genres=10402' },
        { key: 'war-books', title: 'War Book Adaptations', sort: 'popularity.desc', extra: '&with_keywords=818&with_genres=10752' },
        { key: 'western-books', title: 'Western Book Adaptations', sort: 'popularity.desc', extra: '&with_keywords=818&with_genres=37' },
        { key: 'mystery-books', title: 'Mystery Book Adaptations', sort: 'popularity.desc', extra: '&with_keywords=818&with_genres=9648' },
        { key: 'family-books', title: 'Family Book Adaptations', sort: 'popularity.desc', extra: '&with_keywords=818&with_genres=10751' }
      ];
    case '10005': // British
      return [
        { key: 'british-mysteries', title: 'British Mystery & Suspense', sort: 'popularity.desc', extra: '&with_origin_country=GB&with_genres=80|53|9648' },
        { key: 'british-comedies', title: 'Witty British Comedies', sort: 'popularity.desc', extra: '&with_origin_country=GB&with_genres=35' },
        { key: 'british-period-dramas', title: 'British Period & Costume Dramas', sort: 'popularity.desc', extra: '&with_origin_country=GB&primary_release_date.lte=1995-01-01' },
        { key: 'british-action', title: 'British Action & Thrills', sort: 'popularity.desc', extra: '&with_origin_country=GB&with_genres=28' },
        { key: 'british-scifi', title: 'British Sci-Fi & Fantasy', sort: 'popularity.desc', extra: '&with_origin_country=GB&with_genres=878|10765' },
        { key: 'british-docs', title: 'British Documentaries', sort: 'popularity.desc', extra: '&with_origin_country=GB&with_genres=99' },
        { key: 'british-royalty', title: 'British Royalty & History', sort: 'popularity.desc', extra: '&with_origin_country=GB&with_keywords=12339' },
        { key: 'british-gangsters', title: 'Gritty British Gangsters & Crime', sort: 'popularity.desc', extra: '&with_origin_country=GB&with_genres=80' },
        { key: 'cozy-british', title: 'Cozy British Mysteries', sort: 'popularity.desc', extra: '&with_origin_country=GB&with_genres=9648' },
        { key: 'bafta-winners', title: 'BAFTA Winners & Nominees', sort: 'vote_count.desc', extra: '&with_origin_country=GB' },
        { key: 'british-working-class', title: 'British Working Class Dramas', sort: 'popularity.desc', extra: '&with_origin_country=GB&with_genres=18' },
        { key: 'british-teen', title: 'British Teen Angst', sort: 'popularity.desc', extra: '&with_origin_country=GB&with_keywords=4565' },
        { key: 'london-thrillers', title: 'London-Set Thrillers', sort: 'popularity.desc', extra: '&with_origin_country=GB' },
        { key: 'british-horror', title: 'British Horror & Dark Comedy', sort: 'popularity.desc', extra: '&with_origin_country=GB&with_genres=27|35' },
        { key: 'shakespeare', title: 'Shakespearean Adaptations', sort: 'popularity.desc', extra: '&with_origin_country=GB&with_keywords=818' },
        { key: 'beloved-british', title: 'Beloved British Stories', sort: 'popularity.desc', extra: '&with_origin_country=GB' },
        { key: 'british-reality', title: 'British Reality & Entertainment', sort: 'popularity.desc', extra: '&with_origin_country=GB&with_genres=10764' },
        { key: 'british-romance', title: 'British Romance', sort: 'popularity.desc', extra: '&with_origin_country=GB&with_genres=10749' },
        { key: 'british-family', title: 'British Family Favorites', sort: 'popularity.desc', extra: '&with_origin_country=GB&with_genres=10751' },
        { key: 'british-animation', title: 'British Animation', sort: 'popularity.desc', extra: '&with_origin_country=GB&with_genres=16' },
        { key: 'british-war', title: 'British War Stories', sort: 'popularity.desc', extra: '&with_origin_country=GB&with_genres=10752' },
        { key: 'british-westerns', title: 'British Takes on Westerns', sort: 'popularity.desc', extra: '&with_origin_country=GB&with_genres=37' },
        { key: 'british-music', title: 'British Music & Musicals', sort: 'popularity.desc', extra: '&with_origin_country=GB&with_genres=10402' },
        { key: 'british-talk-shows', title: 'British Talk Shows', sort: 'popularity.desc', extra: '&with_origin_country=GB&with_genres=10767' },
        { key: 'british-standup', title: 'British Stand-Up Comedy', sort: 'popularity.desc', extra: '&with_origin_country=GB' },
        { key: 'british-indie', title: 'British Independent Cinema', sort: 'vote_count.desc', extra: '&with_origin_country=GB' },
        { key: 'british-classics', title: 'British Classics', sort: 'vote_count.desc', extra: '&with_origin_country=GB' },
        { key: 'british-spy', title: 'British Espionage', sort: 'popularity.desc', extra: '&with_origin_country=GB&with_keywords=470' },
        { key: 'british-fantasy', title: 'British Fantasy', sort: 'popularity.desc', extra: '&with_origin_country=GB&with_genres=14' },
        { key: 'british-soap', title: 'British Soap Operas', sort: 'popularity.desc', extra: '&with_origin_country=GB&with_genres=10766' }
      ];
    case '10006': // European
      return [
        { key: 'euro-thrillers', title: 'European Crime & Thrillers', sort: 'popularity.desc', extra: '&with_origin_country=FR|DE|IT|ES&with_genres=80|53' },
        { key: 'euro-dramas', title: 'European Prestige Dramas', sort: 'popularity.desc', extra: '&with_origin_country=FR|DE|IT|ES&with_genres=18' },
        { key: 'euro-comedies', title: 'European Comedy Hits', sort: 'popularity.desc', extra: '&with_origin_country=FR|DE|IT|ES&with_genres=35' },
        { key: 'nordic-noir', title: 'Nordic Noir & Suspense', sort: 'popularity.desc', extra: '&with_origin_country=SE|DK|NO|FI' },
        { key: 'french-cinema', title: 'French Cinema & Amour', sort: 'popularity.desc', extra: '&with_origin_country=FR' },
        { key: 'spanish-passion', title: 'Spanish Drama & Passion', sort: 'popularity.desc', extra: '&with_origin_country=ES' },
        { key: 'italian-classics', title: 'Italian Epics & Classics', sort: 'vote_count.desc', extra: '&with_origin_country=IT' },
        { key: 'german-history', title: 'German Historical & War Sagas', sort: 'popularity.desc', extra: '&with_origin_country=DE' },
        { key: 'cannes-favorites', title: 'Cannes Film Festival Favorites', sort: 'vote_count.desc', extra: '&with_origin_country=FR|DE|IT|ES' },
        { key: 'euro-arthouse', title: 'European Art-House Cinema', sort: 'vote_count.desc', extra: '&with_origin_country=FR|DE|IT|ES' },
        { key: 'euro-scifi', title: 'European Sci-Fi & Fantasy', sort: 'popularity.desc', extra: '&with_origin_country=FR|DE|IT|ES&with_genres=878|14|10765' },
        { key: 'euro-travel', title: 'Euro-Trip & Travel Romances', sort: 'popularity.desc', extra: '&with_origin_country=FR|DE|IT|ES&with_genres=10749' },
        { key: 'eastern-euro', title: 'Eastern European Masterpieces', sort: 'popularity.desc', extra: '&with_origin_country=PL|CZ|HU|RO|UA' },
        { key: 'low-countries', title: 'Belgian & Dutch Gems', sort: 'popularity.desc', extra: '&with_origin_country=NL|BE' },
        { key: 'nordic-family', title: 'Nordic Chills & Family', sort: 'popularity.desc', extra: '&with_origin_country=SE|NO|DK|FI&with_genres=10751' },
        { key: 'euro-horror', title: 'European Horror & Gore', sort: 'popularity.desc', extra: '&with_origin_country=FR|DE|IT|ES&with_genres=27' },
        { key: 'euro-docs', title: 'European Documentaries', sort: 'popularity.desc', extra: '&with_origin_country=FR|DE|IT|ES&with_genres=99' },
        { key: 'french-comedies', title: 'French Comedies', sort: 'popularity.desc', extra: '&with_origin_country=FR&with_genres=35' },
        { key: 'spanish-thrillers', title: 'Spanish Thrillers', sort: 'popularity.desc', extra: '&with_origin_country=ES&with_genres=53' },
        { key: 'italian-romance', title: 'Italian Romance', sort: 'popularity.desc', extra: '&with_origin_country=IT&with_genres=10749' },
        { key: 'german-thrillers', title: 'German Thrillers', sort: 'popularity.desc', extra: '&with_origin_country=DE&with_genres=53' },
        { key: 'nordic-comedies', title: 'Nordic Comedies', sort: 'popularity.desc', extra: '&with_origin_country=SE|DK|NO|FI&with_genres=35' },
        { key: 'euro-action', title: 'European Action', sort: 'popularity.desc', extra: '&with_origin_country=FR|DE|IT|ES&with_genres=28' },
        { key: 'euro-animation', title: 'European Animation', sort: 'popularity.desc', extra: '&with_origin_country=FR|DE|IT|ES&with_genres=16' },
        { key: 'euro-family', title: 'European Family Films', sort: 'popularity.desc', extra: '&with_origin_country=FR|DE|IT|ES&with_genres=10751' },
        { key: 'euro-mystery', title: 'European Mysteries', sort: 'popularity.desc', extra: '&with_origin_country=FR|DE|IT|ES&with_genres=9648' },
        { key: 'euro-war', title: 'European War Stories', sort: 'popularity.desc', extra: '&with_origin_country=FR|DE|IT|ES&with_genres=10752' },
        { key: 'euro-westerns', title: 'Spaghetti Westerns & More', sort: 'popularity.desc', extra: '&with_origin_country=IT|ES&with_genres=37' },
        { key: 'euro-music', title: 'European Musicals & Music', sort: 'popularity.desc', extra: '&with_origin_country=FR|DE|IT|ES&with_genres=10402' },
        { key: 'euro-reality', title: 'European Reality TV', sort: 'popularity.desc', extra: '&with_origin_country=FR|DE|IT|ES|GB&with_genres=10764' }
      ];
    case '10007': // Moods
      return [
        { key: 'feel-good-moods', title: 'Feel-Good Favorites', sort: 'popularity.desc', extra: '&with_genres=35|10749' },
        { key: 'gripping-drama', title: 'Intense & Gripping Drama', sort: 'popularity.desc', extra: '&with_genres=18|53' },
        { key: 'relaxed-vibes', title: 'Chilled & Relaxed Vibes', sort: 'vote_average.desc', extra: '&vote_count.gte=500' },
        { key: 'heartwarming', title: 'Heartwarming & Uplifting', sort: 'vote_count.desc', extra: '&with_genres=10751|35' },
        { key: 'mind-bending', title: 'Mind-Bending & Surreal', sort: 'popularity.desc', extra: '&with_genres=878|9648' },
        { key: 'tearjerkers', title: 'Emotional Tearjerkers', sort: 'popularity.desc', extra: '&with_genres=18|10749' },
        { key: 'adrenaline-rush', title: 'Adrenaline Rush', sort: 'popularity.desc', extra: '&with_genres=28|53' },
        { key: 'late-night-laughs', title: 'Late-Night Laughs', sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'nostalgia-trip', title: 'Ultimate Nostalgia Trip', sort: 'vote_count.desc', extra: '&primary_release_date.lte=2000-01-01' },
        { key: 'spooky-season', title: 'Spooky & Eerie Vibes', sort: 'popularity.desc', extra: '&with_genres=27' },
        { key: 'romantic-escape', title: 'Romantic Escapism', sort: 'popularity.desc', extra: '&with_genres=10749' },
        { key: 'inspirational', title: 'Inspirational & Motivating', sort: 'vote_count.desc', extra: '&with_keywords=6075' },
        { key: 'edge-of-seat', title: 'Edge-of-Your-Seat Tension', sort: 'vote_count.desc', extra: '&with_genres=53' },
        { key: 'wholesome-family', title: 'Wholesome Family Fun', sort: 'popularity.desc', extra: '&with_genres=10751' },
        { key: 'thought-provoking', title: 'Thought-Provoking & Intellectual', sort: 'vote_count.desc', extra: '' },
        { key: 'dark-twisty', title: 'Dark & Twisty Thrillers', sort: 'popularity.desc', extra: '&with_genres=53' },
        { key: 'melancholy', title: 'Melancholic & Poetic', sort: 'popularity.desc', extra: '&with_genres=18' },
        { key: 'quirky-moods', title: 'Absurd & Quirky', sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'slow-burn', title: 'Slow-Burn Masterpieces', sort: 'vote_count.desc', extra: '' },
        { key: 'escapist-fantasy', title: 'Escapist Fantasy', sort: 'popularity.desc', extra: '&with_genres=14|878' },
        { key: 'gritty-raw', title: 'Gritty & Raw Action', sort: 'popularity.desc', extra: '&with_genres=28|80' },
        { key: 'uplifting-docs', title: 'Uplifting Documentaries', sort: 'popularity.desc', extra: '&with_genres=99' },
        { key: 'cozy-mysteries', title: 'Cozy Mysteries', sort: 'popularity.desc', extra: '&with_genres=9648' },
        { key: 'wild-adventures', title: 'Wild Adventures', sort: 'popularity.desc', extra: '&with_genres=12' },
        { key: 'laugh-out-loud', title: 'Laugh Out Loud Comedies', sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'epic-battles', title: 'Epic Battles', sort: 'popularity.desc', extra: '&with_genres=28|10752' },
        { key: 'dreamy-romance', title: 'Dreamy Romance', sort: 'popularity.desc', extra: '&with_genres=10749' },
        { key: 'intense-crime', title: 'Intense Crime', sort: 'popularity.desc', extra: '&with_genres=80' },
        { key: 'musical-joy', title: 'Musical Joy', sort: 'popularity.desc', extra: '&with_genres=10402' },
        { key: 'historical-epics', title: 'Historical Epics', sort: 'popularity.desc', extra: '&with_genres=36' }
      ];
    case '10008': // US / Hollywood
      return [
        { key: 'hollywood-blockbusters', title: 'Hollywood Blockbusters', sort: 'popularity.desc', extra: '&with_origin_country=US' },
        { key: 'prestige-american-dramas', title: 'Prestige American Dramas', sort: 'popularity.desc', extra: '&with_origin_country=US&with_genres=18' },
        { key: 'indie-usa-cinema', title: 'Indie USA Cinema', sort: 'vote_count.desc', extra: '&with_origin_country=US' },
        { key: 'us-comedies', title: 'American Comedies', sort: 'popularity.desc', extra: '&with_origin_country=US&with_genres=35' },
        { key: 'us-action-flicks', title: 'US Action Flicks', sort: 'popularity.desc', extra: '&with_origin_country=US&with_genres=28' },
        { key: 'us-horror', title: 'American Horror Stories', sort: 'popularity.desc', extra: '&with_origin_country=US&with_genres=27' },
        { key: 'us-romance', title: 'Hollywood Romances', sort: 'popularity.desc', extra: '&with_origin_country=US&with_genres=10749' },
        { key: 'oscar-winners', title: 'Oscar Best Picture Winners', sort: 'vote_count.desc', extra: '&with_origin_country=US' },
        { key: 'us-sports', title: 'US Sports & Triumphs', sort: 'popularity.desc', extra: '&with_origin_country=US&with_keywords=6075' },
        { key: 'us-road-trips', title: 'American Road Trips & Journeys', sort: 'popularity.desc', extra: '&with_origin_country=US' },
        { key: 'new-york-set', title: 'New York Set Stories', sort: 'popularity.desc', extra: '&with_origin_country=US&with_keywords=1368' },
        { key: 'la-set', title: 'Los Angeles & Hollywood Stories', sort: 'popularity.desc', extra: '&with_origin_country=US' },
        { key: 'us-scifi-movies', title: 'High-Budget US Sci-Fi', sort: 'popularity.desc', extra: '&with_origin_country=US&with_genres=878' },
        { key: 'us-crime-thrillers', title: 'Gritty American Crime Thrillers', sort: 'popularity.desc', extra: '&with_origin_country=US&with_genres=80|53' },
        { key: 'us-family-movies', title: 'American Family Movies', sort: 'popularity.desc', extra: '&with_origin_country=US&with_genres=10751' },
        { key: 'us-animation', title: 'American Animation', sort: 'popularity.desc', extra: '&with_origin_country=US&with_genres=16' },
        { key: 'us-documentaries', title: 'American Documentaries', sort: 'popularity.desc', extra: '&with_origin_country=US&with_genres=99' },
        { key: 'us-war-movies', title: 'American War Movies', sort: 'popularity.desc', extra: '&with_origin_country=US&with_genres=10752' },
        { key: 'us-westerns', title: 'American Westerns', sort: 'popularity.desc', extra: '&with_origin_country=US&with_genres=37' },
        { key: 'us-musicals', title: 'American Musicals', sort: 'popularity.desc', extra: '&with_origin_country=US&with_genres=10402' },
        { key: 'us-mysteries', title: 'American Mysteries', sort: 'popularity.desc', extra: '&with_origin_country=US&with_genres=9648' },
        { key: 'us-fantasy', title: 'American Fantasy', sort: 'popularity.desc', extra: '&with_origin_country=US&with_genres=14' },
        { key: 'us-history', title: 'American Historical Epics', sort: 'popularity.desc', extra: '&with_origin_country=US&with_genres=36' },
        { key: 'us-teen-movies', title: 'American Teen Movies', sort: 'popularity.desc', extra: '&with_origin_country=US&with_keywords=4565' },
        { key: 'us-cult-classics', title: 'American Cult Classics', sort: 'vote_count.desc', extra: '&with_origin_country=US' },
        { key: 'us-independent-film', title: 'American Independent Film', sort: 'vote_count.desc', extra: '&with_origin_country=US' },
        { key: 'us-political-thrillers', title: 'American Political Thrillers', sort: 'popularity.desc', extra: '&with_origin_country=US&with_genres=53' },
        { key: 'us-romantic-comedies', title: 'American Romantic Comedies', sort: 'popularity.desc', extra: '&with_origin_country=US&with_genres=35|10749' },
        { key: 'us-sci-fi-action', title: 'American Sci-Fi Action', sort: 'popularity.desc', extra: '&with_origin_country=US&with_genres=28|878' },
        { key: 'us-superhero', title: 'American Superhero', sort: 'popularity.desc', extra: '&with_origin_country=US&with_keywords=9715' }
      ];
    case '10009': // Classics
      return [
        { key: 'golden-age-hollywood', title: 'Golden Age Hollywood Classics', sort: 'vote_count.desc', extra: '&with_origin_country=US' },
        { key: 'retro-favorites', title: 'Retro Favorites', sort: 'popularity.desc', extra: '' },
        { key: 'essential-classics', title: 'Essential Film Classics', sort: 'vote_count.desc', extra: '' },
        { key: 'black-and-white', title: 'Black & White Masterpieces', sort: 'vote_count.desc', extra: '&with_keywords=233|2041' },
        { key: 'silent-era', title: 'The Silent Era', sort: 'vote_count.desc', extra: '&with_keywords=4450' },
        { key: 'western-classics', title: 'Classic Westerns', sort: 'popularity.desc', extra: '&with_genres=37&primary_release_date.lte=1980-01-01' },
        { key: 'noir-classics', title: 'Classic Film Noir', sort: 'vote_count.desc', extra: '&with_genres=53&primary_release_date.lte=1970-01-01' },
        { key: 'pre-code', title: 'Pre-Code Hollywood', sort: 'popularity.desc', extra: '&primary_release_date.lte=1934-07-01' },
        { key: 'hitchcock', title: 'Alfred Hitchcock Suspense', sort: 'popularity.desc', extra: '&with_genres=53' },
        { key: 'golden-age-musicals', title: 'Golden Age Musicals', sort: 'popularity.desc', extra: '&with_genres=10402' },
        { key: 'classic-monsters', title: 'Classic Monster Movies', sort: 'popularity.desc', extra: '&with_genres=27' },
        { key: 'sixties-epics', title: 'Epics of the 50s & 60s', sort: 'popularity.desc', extra: '&primary_release_date.gte=1950-01-01&primary_release_date.lte=1969-12-31' },
        { key: 'new-hollywood', title: 'New Hollywood 70s', sort: 'popularity.desc', extra: '&primary_release_date.gte=1970-01-01&primary_release_date.lte=1979-12-31' },
        { key: 'eighties-classics', title: '80s Box Office Hits', sort: 'popularity.desc', extra: '&primary_release_date.gte=1980-01-01&primary_release_date.lte=1989-12-31' },
        { key: 'intl-classics', title: 'Foreign Language Classics', sort: 'popularity.desc', extra: '&without_original_language=en' },
        { key: 'classic-comedies', title: 'Classic Comedies', sort: 'vote_count.desc', extra: '&with_genres=35' },
        { key: 'classic-dramas', title: 'Classic Dramas', sort: 'vote_count.desc', extra: '&with_genres=18' },
        { key: 'classic-romance', title: 'Classic Romance', sort: 'vote_count.desc', extra: '&with_genres=10749' },
        { key: 'classic-scifi', title: 'Classic Sci-Fi', sort: 'vote_count.desc', extra: '&with_genres=878' },
        { key: 'classic-horror', title: 'Classic Horror', sort: 'vote_count.desc', extra: '&with_genres=27' },
        { key: 'classic-action', title: 'Classic Action', sort: 'vote_count.desc', extra: '&with_genres=28' },
        { key: 'classic-thrillers', title: 'Classic Thrillers', sort: 'vote_count.desc', extra: '&with_genres=53' },
        { key: 'classic-mysteries', title: 'Classic Mysteries', sort: 'vote_count.desc', extra: '&with_genres=9648' },
        { key: 'classic-family', title: 'Classic Family Films', sort: 'vote_count.desc', extra: '&with_genres=10751' },
        { key: 'classic-animation', title: 'Classic Animation', sort: 'vote_count.desc', extra: '&with_genres=16' },
        { key: 'classic-war', title: 'Classic War Movies', sort: 'vote_count.desc', extra: '&with_genres=10752' },
        { key: 'classic-history', title: 'Classic Historical Epics', sort: 'vote_count.desc', extra: '&with_genres=36' },
        { key: 'classic-docs', title: 'Classic Documentaries', sort: 'vote_count.desc', extra: '&with_genres=99' },
        { key: 'nineties-classics', title: '90s Classics', sort: 'popularity.desc', extra: '&primary_release_date.gte=1990-01-01&primary_release_date.lte=1999-12-31' },
        { key: 'seventies-classics', title: '70s Classics', sort: 'popularity.desc', extra: '&primary_release_date.gte=1970-01-01&primary_release_date.lte=1979-12-31' }
      ];
    case '10010': // Cult
      return [
        { key: 'cult-favorites', title: 'Cult Favorites', sort: 'popularity.desc', extra: '&with_keywords=10084' },
        { key: 'indie-cult', title: 'Indie Cult Classics', sort: 'vote_count.desc', extra: '&with_keywords=10084' },
        { key: 'sci-fi-horror-cult', title: 'Sci-Fi & Horror Cults', sort: 'popularity.desc', extra: '&with_keywords=10084' },
        { key: 'midnight-movies', title: 'Midnight Movies', sort: 'popularity.desc', extra: '&with_keywords=10084' },
        { key: 'campy-cult', title: 'Campy & Bizarre', sort: 'popularity.desc', extra: '&with_keywords=10084' },
        { key: 'cult-action', title: 'Cult Action & Martial Arts', sort: 'popularity.desc', extra: '&with_keywords=10084' },
        { key: 'cyberpunk-cult', title: 'Cyberpunk Cult Favorites', sort: 'popularity.desc', extra: '&with_keywords=4289' },
        { key: 'b-movie-cult', title: 'B-Movie Sci-Fi & Monsters', sort: 'popularity.desc', extra: '&with_keywords=10084' },
        { key: 'quirky-cult', title: 'Quirky Indie Cults', sort: 'popularity.desc', extra: '' },
        { key: 'anime-cult', title: 'Anime Cult Hits', sort: 'popularity.desc', extra: '&with_genres=16' },
        { key: 'surreal-cult', title: 'Surreal & Absurdist Cinema', sort: 'popularity.desc', extra: '&with_genres=14' },
        { key: 'cult-directors', title: 'Cult Directors & Auteurs', sort: 'vote_count.desc', extra: '' },
        { key: 'eighties-cult', title: '80s Cult Classics', sort: 'popularity.desc', extra: '&primary_release_date.gte=1980-01-01&primary_release_date.lte=1989-12-31' },
        { key: 'nineties-cult', title: '90s Cult Favorites', sort: 'popularity.desc', extra: '&primary_release_date.gte=1990-01-01&primary_release_date.lte=1999-12-31' },
        { key: 'cult-comedy', title: 'Cult Comedy Classics', sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'dark-cult', title: 'Dark Psychological Cults', sort: 'popularity.desc', extra: '&with_genres=53|9648' },
        { key: 'cult-horror', title: 'Cult Horror', sort: 'popularity.desc', extra: '&with_genres=27' },
        { key: 'cult-scifi', title: 'Cult Sci-Fi', sort: 'popularity.desc', extra: '&with_genres=878' },
        { key: 'cult-thrillers', title: 'Cult Thrillers', sort: 'popularity.desc', extra: '&with_genres=53' },
        { key: 'cult-fantasy', title: 'Cult Fantasy', sort: 'popularity.desc', extra: '&with_genres=14' },
        { key: 'cult-musicals', title: 'Cult Musicals', sort: 'popularity.desc', extra: '&with_genres=10402' },
        { key: 'cult-romance', title: 'Cult Romance', sort: 'popularity.desc', extra: '&with_genres=10749' },
        { key: 'cult-animation', title: 'Cult Animation', sort: 'popularity.desc', extra: '&with_genres=16' },
        { key: 'cult-westerns', title: 'Cult Westerns', sort: 'popularity.desc', extra: '&with_genres=37' },
        { key: 'cult-war', title: 'Cult War Movies', sort: 'popularity.desc', extra: '&with_genres=10752' },
        { key: 'cult-history', title: 'Cult Historical Films', sort: 'popularity.desc', extra: '&with_genres=36' },
        { key: 'cult-mysteries', title: 'Cult Mysteries', sort: 'popularity.desc', extra: '&with_genres=9648' },
        { key: 'cult-family', title: 'Cult Family Films', sort: 'popularity.desc', extra: '&with_genres=10751' },
        { key: 'cult-docs', title: 'Cult Documentaries', sort: 'popularity.desc', extra: '&with_genres=99' },
        { key: 'cult-international', title: 'Cult International Cinema', sort: 'popularity.desc', extra: '&without_original_language=en' }
      ];
    case '10011': // Independent
      return [
        { key: 'indie-dramas', title: 'Independent Dramas', sort: 'popularity.desc', extra: '&with_genres=18' },
        { key: 'festival-favorites', title: 'Film Festival Favorites', sort: 'vote_count.desc', extra: '' },
        { key: 'under-the-radar-indies', title: 'Under-the-Radar Indies', sort: 'popularity.desc', extra: '' },
        { key: 'indie-comedies', title: 'Quirky Indie Comedies', sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'indie-horror', title: 'Indie Horror & Thrillers', sort: 'popularity.desc', extra: '&with_genres=27|53' },
        { key: 'mumblecore', title: 'Mumblecore & Realism', sort: 'popularity.desc', extra: '&vote_count.lte=300' },
        { key: 'sundance-hits', title: 'Acclaimed Sundance Hits', sort: 'vote_count.desc', extra: '' },
        { key: 'a24-style-movies', title: 'A24-Style Indie Favorites', sort: 'popularity.desc', extra: '' },
        { key: 'micro-budget', title: 'Micro-Budget Masterpieces', sort: 'popularity.desc', extra: '' },
        { key: 'indie-noir', title: 'Independent Noir & Crime', sort: 'popularity.desc', extra: '&with_genres=80|53' },
        { key: 'queer-indie', title: 'Queer Indie Cinema', sort: 'popularity.desc', extra: '&with_keywords=158718' },
        { key: 'intl-indie', title: 'International Indie Gems', sort: 'popularity.desc', extra: '&without_original_language=en' },
        { key: 'indie-docs', title: 'Award-Winning Indie Docs', sort: 'popularity.desc', extra: '&with_genres=99' },
        { key: 'indie-family', title: 'Heartfelt Family Indies', sort: 'popularity.desc', extra: '&with_genres=10751' },
        { key: 'indie-scifi', title: 'Independent Sci-Fi', sort: 'popularity.desc', extra: '&with_genres=878' },
        { key: 'indie-action', title: 'Independent Action', sort: 'popularity.desc', extra: '&with_genres=28' },
        { key: 'indie-romance', title: 'Independent Romance', sort: 'popularity.desc', extra: '&with_genres=10749' },
        { key: 'indie-animation', title: 'Independent Animation', sort: 'popularity.desc', extra: '&with_genres=16' },
        { key: 'indie-mysteries', title: 'Independent Mysteries', sort: 'popularity.desc', extra: '&with_genres=9648' },
        { key: 'indie-thrillers', title: 'Independent Thrillers', sort: 'popularity.desc', extra: '&with_genres=53' },
        { key: 'indie-fantasy', title: 'Independent Fantasy', sort: 'popularity.desc', extra: '&with_genres=14' },
        { key: 'indie-music', title: 'Independent Musicals', sort: 'popularity.desc', extra: '&with_genres=10402' },
        { key: 'indie-war', title: 'Independent War Stories', sort: 'popularity.desc', extra: '&with_genres=10752' },
        { key: 'indie-westerns', title: 'Independent Westerns', sort: 'popularity.desc', extra: '&with_genres=37' },
        { key: 'indie-history', title: 'Independent Historical Films', sort: 'popularity.desc', extra: '&with_genres=36' },
        { key: 'indie-coming-of-age', title: 'Independent Coming-of-Age', sort: 'popularity.desc', extra: '&with_keywords=4565' },
        { key: 'indie-road-trips', title: 'Independent Road Trips', sort: 'popularity.desc', extra: '&with_keywords=7312' },
        { key: 'indie-lgbtq', title: 'Independent LGBTQ+', sort: 'popularity.desc', extra: '&with_keywords=158718' },
        { key: 'indie-biographies', title: 'Independent Biographies', sort: 'popularity.desc', extra: '&with_keywords=818' },
        { key: 'indie-sports', title: 'Independent Sports Films', sort: 'popularity.desc', extra: '&with_keywords=6075' }
      ];
    case '10012': // International
      return [
        { key: 'subtitled-masterpieces', title: 'Subtitled Masterpieces', sort: 'vote_count.desc', extra: '&without_original_language=en' },
        { key: 'world-cinema', title: 'Award-Winning World Cinema', sort: 'popularity.desc', extra: '&without_original_language=en' },
        { key: 'global-action', title: 'Global Action Hits', sort: 'popularity.desc', extra: '&without_original_language=en&with_genres=28' },
        { key: 'asian-cinema', title: 'Asian Cinema Masterpieces', sort: 'popularity.desc', extra: '&with_origin_country=KR|JP|CN|TW|HK' },
        { key: 'bollywood-hits', title: 'Bollywood & Indian Epics', sort: 'popularity.desc', extra: '&with_origin_country=IN' },
        { key: 'middle-eastern', title: 'Middle Eastern Stories', sort: 'popularity.desc', extra: '&with_origin_country=EG|IR|AE|SA|LB' },
        { key: 'latin-cinema', title: 'Latin American Cinema', sort: 'popularity.desc', extra: '&with_origin_country=MX|BR|AR|CO|CL' },
        { key: 'french-new-wave', title: 'French Cinema & New Wave', sort: 'popularity.desc', extra: '&with_origin_country=FR' },
        { key: 'italian-classics', title: 'Italian Epics & Classics', sort: 'popularity.desc', extra: '&with_origin_country=IT' },
        { key: 'spanish-thrillers', title: 'Spanish Suspense & Passion', sort: 'popularity.desc', extra: '&with_origin_country=ES' },
        { key: 'nordic-cinema', title: 'Nordic Chill & Crime', sort: 'popularity.desc', extra: '&with_origin_country=SE|NO|DK|FI' },
        { key: 'african-cinema', title: 'African Stories & Cinema', sort: 'popularity.desc', extra: '&with_origin_country=ZA|NG|KE|EG' },
        { key: 'global-horror', title: 'Terrifying International Horror', sort: 'popularity.desc', extra: '&without_original_language=en&with_genres=27' },
        { key: 'global-scifi', title: 'International Sci-Fi', sort: 'popularity.desc', extra: '&without_original_language=en&with_genres=878' },
        { key: 'world-romance', title: 'Romance Around the World', sort: 'popularity.desc', extra: '&without_original_language=en&with_genres=10749' },
        { key: 'festival-intl', title: 'Cannes & Venice Favorites', sort: 'popularity.desc', extra: '&without_original_language=en' },
        { key: 'global-coming-of-age', title: 'Global Coming-of-Age', sort: 'popularity.desc', extra: '&without_original_language=en&with_keywords=4565' },
        { key: 'global-crime', title: 'International Crime & Mafia', sort: 'popularity.desc', extra: '&without_original_language=en&with_genres=80' },
        { key: 'global-history', title: 'Historical International Epics', sort: 'popularity.desc', extra: '&without_original_language=en&with_genres=36' },
        { key: 'global-comedy-movies', title: 'Heartfelt World Comedies', sort: 'popularity.desc', extra: '&without_original_language=en&with_genres=35' },
        { key: 'global-drama', title: 'Global Dramas', sort: 'popularity.desc', extra: '&without_original_language=en&with_genres=18' },
        { key: 'global-animation', title: 'Global Animation', sort: 'popularity.desc', extra: '&without_original_language=en&with_genres=16' },
        { key: 'global-family', title: 'Global Family Films', sort: 'popularity.desc', extra: '&without_original_language=en&with_genres=10751' },
        { key: 'global-mysteries', title: 'Global Mysteries', sort: 'popularity.desc', extra: '&without_original_language=en&with_genres=9648' },
        { key: 'global-thrillers', title: 'Global Thrillers', sort: 'popularity.desc', extra: '&without_original_language=en&with_genres=53' },
        { key: 'global-fantasy', title: 'Global Fantasy', sort: 'popularity.desc', extra: '&without_original_language=en&with_genres=14' },
        { key: 'global-docs', title: 'Global Documentaries', sort: 'popularity.desc', extra: '&without_original_language=en&with_genres=99' },
        { key: 'global-music', title: 'Global Music & Musicals', sort: 'popularity.desc', extra: '&without_original_language=en&with_genres=10402' },
        { key: 'global-war', title: 'Global War Stories', sort: 'popularity.desc', extra: '&without_original_language=en&with_genres=10752' },
        { key: 'global-westerns', title: 'Global Westerns', sort: 'popularity.desc', extra: '&without_original_language=en&with_genres=37' }
      ];
    case '10013': // Shorts
      return [
        { key: 'short-films', title: 'Award-Winning Short Films', sort: 'vote_count.desc', extra: '' },
        { key: 'quick-animation-shorts', title: 'Animated Shorts', sort: 'popularity.desc', extra: '&with_genres=16' },
        { key: 'documentary-shorts', title: 'Documentary Shorts', sort: 'popularity.desc', extra: '&with_genres=99' },
        { key: 'comedy-shorts', title: 'Comedy Shorts', sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'horror-shorts', title: 'Horror Shorts', sort: 'popularity.desc', extra: '&with_genres=27' },
        { key: 'oscar-shorts', title: 'Oscar-Nominated Short Films', sort: 'vote_count.desc', extra: '' },
        { key: 'pixar-disney-shorts', title: 'Pixar & Disney Short Favorites', sort: 'popularity.desc', extra: '&with_keywords=12542' },
        { key: 'scifi-shorts', title: 'Sci-Fi Short Stories', sort: 'popularity.desc', extra: '&with_genres=878' },
        { key: 'family-shorts', title: 'Heartwarming Animated Shorts', sort: 'popularity.desc', extra: '&with_genres=16|10751' },
        { key: 'experimental-shorts', title: 'Experimental & Avant-Garde', sort: 'popularity.desc', extra: '' },
        { key: 'thriller-shorts', title: 'Bite-Sized Thrillers', sort: 'popularity.desc', extra: '&with_genres=53' },
        { key: 'lgbtq-shorts', title: 'LGBTQ+ Short Films', sort: 'popularity.desc', extra: '&with_keywords=158718' },
        { key: 'indie-shorts', title: 'Indie Short Dramas', sort: 'popularity.desc', extra: '&with_genres=18' },
        { key: 'student-shorts', title: 'Student Film Showcases', sort: 'popularity.desc', extra: '' },
        { key: 'intl-shorts', title: 'International Short Cinema', sort: 'popularity.desc', extra: '&without_original_language=en' },
        { key: 'action-shorts', title: 'Action Shorts', sort: 'popularity.desc', extra: '&with_genres=28' },
        { key: 'drama-shorts', title: 'Drama Shorts', sort: 'popularity.desc', extra: '&with_genres=18' },
        { key: 'romance-shorts', title: 'Romance Shorts', sort: 'popularity.desc', extra: '&with_genres=10749' },
        { key: 'fantasy-shorts', title: 'Fantasy Shorts', sort: 'popularity.desc', extra: '&with_genres=14' },
        { key: 'mystery-shorts', title: 'Mystery Shorts', sort: 'popularity.desc', extra: '&with_genres=9648' },
        { key: 'war-shorts', title: 'War Shorts', sort: 'popularity.desc', extra: '&with_genres=10752' },
        { key: 'history-shorts', title: 'History Shorts', sort: 'popularity.desc', extra: '&with_genres=36' },
        { key: 'music-shorts', title: 'Music Shorts', sort: 'popularity.desc', extra: '&with_genres=10402' },
        { key: 'western-shorts', title: 'Western Shorts', sort: 'popularity.desc', extra: '&with_genres=37' },
        { key: 'crime-shorts', title: 'Crime Shorts', sort: 'popularity.desc', extra: '&with_genres=80' },
        { key: 'sci-fi-shorts', title: 'Sci-Fi Shorts', sort: 'popularity.desc', extra: '&with_genres=878' },
        { key: 'horror-shorts-2', title: 'More Horror Shorts', sort: 'popularity.desc', extra: '&with_genres=27' },
        { key: 'comedy-shorts-2', title: 'More Comedy Shorts', sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'documentary-shorts-2', title: 'More Documentary Shorts', sort: 'popularity.desc', extra: '&with_genres=99' },
        { key: 'animation-shorts-2', title: 'More Animated Shorts', sort: 'popularity.desc', extra: '&with_genres=16' }
      ];
    case '10014': // Sport
      return [
        { key: 'sports-dramas', title: 'Inspiring Sports Dramas', sort: 'popularity.desc', extra: '&with_genres=18' },
        { key: 'boxing-films', title: 'Boxing Films & Fight Stories', sort: 'vote_count.desc', extra: '&with_keywords=779|10034|6075&with_genres=18|28|99' },
        { key: 'docu-sports', title: 'Sports Docuseries & Profiles', sort: 'popularity.desc', extra: '&with_genres=99' },
        { key: 'underdog-sports', title: 'Underdog Triumphs', sort: 'popularity.desc', extra: '&with_keywords=4379' },
        { key: 'martial-arts-sport', title: 'Martial Arts & Combat Sport', sort: 'popularity.desc', extra: '&with_keywords=779|780&with_genres=28|18' },
        { key: 'soccer-football', title: 'Soccer, Football & The Beautiful Game', sort: 'popularity.desc', extra: '&with_keywords=6075|11062' },
        { key: 'basketball', title: 'Basketball & Hoop Dreams', sort: 'popularity.desc', extra: '&with_keywords=6075' },
        { key: 'auto-racing', title: 'Auto Racing & Motorsport', sort: 'popularity.desc', extra: '&with_keywords=10034' },
        { key: 'high-stakes-games', title: 'High-Stakes Competitions', sort: 'popularity.desc', extra: '' },
        { key: 'olympics', title: 'Olympic Triumphs & Legends', sort: 'popularity.desc', extra: '&with_keywords=4379' },
        { key: 'extreme-sports', title: 'Extreme Sports, Surfing & Adventure', sort: 'popularity.desc', extra: '&page=2' },
        { key: 'american-football', title: 'Gridiron & American Football', sort: 'popularity.desc', extra: '&with_origin_country=US' },
        { key: 'sports-comedies', title: 'Sports Comedies', sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'youth-sports', title: 'High School & College Sports', sort: 'popularity.desc', extra: '&with_keywords=296608' },
        { key: 'sports-biographies', title: 'Sports Biographies & Memoirs', sort: 'vote_count.desc', extra: '&with_keywords=818' },
        { key: 'women-sports', title: 'Inspirational Women in Sport', sort: 'popularity.desc', extra: '' },
        { key: 'golf-tennis', title: 'Golf, Tennis & Racket Sports', sort: 'vote_count.desc', extra: '' },
        { key: 'winter-sports', title: 'Ice Hockey, Skiing & Winter Sports', sort: 'vote_count.desc', extra: '' },
        { key: 'sports-romance', title: 'Sports Romance', sort: 'popularity.desc', extra: '&with_genres=10749' },
        { key: 'sports-animation', title: 'Sports Anime & Animation', sort: 'popularity.desc', extra: '&with_genres=16' },
        { key: 'sports-family', title: 'Family Sports Films', sort: 'popularity.desc', extra: '&with_genres=10751' },
        { key: 'sports-history', title: 'Sports History & Legends', sort: 'popularity.desc', extra: '&with_genres=36' },
        { key: 'sports-thrillers', title: 'Sports Thrillers & Mind Games', sort: 'popularity.desc', extra: '&with_genres=53' },
        { key: 'sports-crime', title: 'Sports Corruption & Crime', sort: 'popularity.desc', extra: '&with_genres=80' },
        { key: 'baseball-cricket', title: 'Baseball, Cricket & Bat Sports', sort: 'popularity.desc', extra: '&page=3' },
        { key: 'swimming-athletics', title: 'Athletics, Swim & Track', sort: 'popularity.desc', extra: '&page=4' },
        { key: 'sports-music', title: 'Music & Sports', sort: 'popularity.desc', extra: '&with_genres=10402' }
      ];
    case '10015': // Teen
      return [
        { key: 'teen-angst-drama', title: 'Teen Dramas & Angst', sort: 'popularity.desc', extra: '&with_genres=18' },
        { key: 'high-school-comedy', title: 'High School Comedies', sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'coming-of-age-journeys', title: 'Coming-of-Age Journeys', sort: 'popularity.desc', extra: '' },
        { key: 'teen-romance', title: 'Teen Romance & First Love', sort: 'popularity.desc', extra: '&with_genres=10749' },
        { key: 'teen-scifi-fantasy', title: 'Teen Sci-Fi & Fantasy', sort: 'popularity.desc', extra: '&with_genres=10765|878|14' },
        { key: 'teen-thrillers', title: 'Teen Thrillers & Mysteries', sort: 'popularity.desc', extra: '&with_genres=53|9648' },
        { key: 'college-life', title: 'College & University Life', sort: 'popularity.desc', extra: '&page=3' },
        { key: 'teen-horror', title: 'Teen Slashers & Horror', sort: 'popularity.desc', extra: '&with_genres=27' },
        { key: 'supernatural-teen', title: 'Supernatural Teen Sagas', sort: 'popularity.desc', extra: '&with_genres=14' },
        { key: 'teen-rebels', title: 'Rebel Teenagers & Outcasts', sort: 'popularity.desc', extra: '&with_genres=18' },
        { key: 'teen-musicals', title: 'Teen Musical & Drama Series', sort: 'popularity.desc', extra: '&with_genres=10402' },
        { key: 'teen-drama-friends', title: 'Best Friends & Teen Drama', sort: 'popularity.desc', extra: '&with_genres=18' },
        { key: 'teen-gossip', title: 'High School Gossip & Secrets', sort: 'popularity.desc', extra: '&with_keywords=4565' },
        { key: 'teen-book-adaptations', title: 'YA Book Adaptations for Teens', sort: 'popularity.desc', extra: '&with_keywords=818' },
        { key: 'intl-teen-drama', title: 'International Teen Drama', sort: 'popularity.desc', extra: '&without_original_language=en' },
        { key: 'teen-action', title: 'Teen Action & Superpowers', sort: 'popularity.desc', extra: '&with_genres=28' },
        { key: 'teen-sitcoms', title: 'Lighthearted Teen Sitcoms', sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'teen-family', title: 'Family Teen Movies', sort: 'popularity.desc', extra: '&with_genres=10751' },
        { key: 'teen-animation', title: 'Teen Animation', sort: 'popularity.desc', extra: '&with_genres=16' },
        { key: 'teen-docs', title: 'Teen Documentaries', sort: 'popularity.desc', extra: '&with_genres=99' },
        { key: 'teen-sports', title: 'Teen Sports Movies', sort: 'popularity.desc', extra: '&with_keywords=6075' },
        { key: 'teen-mysteries', title: 'Teen Mysteries', sort: 'popularity.desc', extra: '&with_genres=9648' },
        { key: 'teen-sci-fi', title: 'Teen Sci-Fi', sort: 'popularity.desc', extra: '&with_genres=878' },
        { key: 'teen-fantasy', title: 'Teen Fantasy', sort: 'popularity.desc', extra: '&with_genres=14' },
        { key: 'teen-crime', title: 'Teen Crime Stories', sort: 'popularity.desc', extra: '&with_genres=80' },
        { key: 'teen-war', title: 'Teen War Stories', sort: 'popularity.desc', extra: '&with_genres=10752' },
        { key: 'teen-westerns', title: 'Teen Westerns', sort: 'popularity.desc', extra: '&with_genres=37' },
        { key: 'teen-history', title: 'Teen Historical Epics', sort: 'popularity.desc', extra: '&with_genres=36' },
        { key: 'teen-indie', title: 'Teen Indie Films', sort: 'vote_count.desc', extra: '' },
        { key: 'teen-classics', title: 'Teen Classics', sort: 'vote_count.desc', extra: '' }
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

  // Prevent TMDB 0-result errors: don't query /discover/movie for TV-only genres
  if (!isTV && isTvOnlyGenreId(selectedGenreId)) return [];
  
  // Prevent TMDB 0-result errors: don't query /discover/tv for Movie-only genres
  if (isTV && isMovieOnlyGenreId(selectedGenreId)) return [];

  const getReleaseDateParam = (gte?: string, lte?: string) => {
    const prefix = isTV ? 'first_air_date' : 'primary_release_date';
    let res = '';
    if (gte) res += `&${prefix}.gte=${gte}`;
    if (lte) res += `&${prefix}.lte=${lte}`;
    return res;
  };

  const gRow = (key: string, title: string, sort: string, extra = ''): SmartRow | null => {
      extra = sanitizeTmdbQuery(extra, mediaType);
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
    if (pr.url) {
      const sig = makeUrlSig(pr.url);
      if (!usedUrls.has(sig)) {
        usedUrls.add(sig);
        rows.push({ key: `genre-profile-${profileKey}-${pr.key}`, title: pr.title, fetchUrl: pr.url });
      }
    } else {
      const row = gRow(`genre-profile-${profileKey}-${pr.key}`, pr.title, pr.sort, pr.extra);
      if (row) rows.push(row);
    }
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
    const fillTitles = getPremiumFillTitles(baseGenreName, mediaType);
    for (let i = 0; rows.length < 35 && i < 60; i++) {
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
  if (!selectedGenreName || selectedGenreName === 'All') return baseTitle;
  const genre = selectedGenreName;
  const suffix = mediaType === 'tv' ? 'Series' : 'Films';

  if (baseTitle.includes("2010s")) return `2010s ${genre} ${suffix}`;
  if (baseTitle.includes("2000s")) return `2000s ${genre} ${suffix}`;
  if (baseTitle.includes("90s"))   return `90s ${genre} ${suffix}`;
  if (baseTitle.includes("80s"))   return `80s ${genre} ${suffix}`;
  if (baseTitle.includes("70s"))   return `70s ${genre} ${suffix}`;
  if (baseTitle.includes("60s"))   return `60s ${genre} ${suffix}`;
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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 1. PRIORITIZED COMFORT ROWS (Based on Card Count)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 1. CURATED ANCHOR ROWS (non-trending — give the page a strong cold start)
  const primaryCuratedUrl = selectedGenreId
    ? REQUESTS.fetchByGenre('movie', movieGenreId!, 'vote_count.desc')
    : REQUESTS.fetchTopRated;
  const primaryCuratedSig = makeUrlSig(primaryCuratedUrl);
  if (!usedUrls.has(primaryCuratedSig)) {
    usedUrls.add(primaryCuratedSig);
    addRow({
      key: `home-genre-primary-curated-${selectedGenreId || 'all'}`,
      title: selectedGenreId ? `Most Loved ${baseGenreName}` : 'Award-Winning Films',
      fetchUrl: primaryCuratedUrl,
    });
  }

  const secondCuratedUrl = selectedGenreId
    ? REQUESTS.fetchByGenre('tv', tvGenreId!, 'vote_count.desc')
    : REQUESTS.fetchPopular;
  const secondCuratedSig = makeUrlSig(secondCuratedUrl);
  if (!usedUrls.has(secondCuratedSig)) {
    usedUrls.add(secondCuratedSig);
    addRow({
      key: `home-genre-secondary-curated-${selectedGenreId || 'all'}`,
      title: selectedGenreId ? `Popular ${baseGenreName} Series` : 'Popular Right Now',
      fetchUrl: secondCuratedUrl,
    });
  }

  // 2. PERSONALIZED ROWS
  // 2. PERSONALIZED ROWS — collected first, then spliced in at specific positions
  const personalRows: { row: SmartRow; targetIndex: number }[] = [];

  // Continue Watching → row 1
  if (continueWatchingRow) {
    personalRows.push({ row: continueWatchingRow, targetIndex: 1 });
  }

  // “Because you watched” → up to 2 rows (4 and 8), seeds rotate daily
  const watchedEligible = continueWatching.filter(m =>
    !selectedGenreId || (m.genre_ids && m.genre_ids.includes(selectedGenreId)));
  pickPersonalSeeds(watchedEligible, hash, 2).forEach((m, i) => {
    const isTV = m.media_type === 'tv' || (!m.media_type && !m.title);
    const url = REQUESTS.fetchRecommendations(isTV ? 'tv' : 'movie', m.id);
    const sig = makeUrlSig(url);
    if (!usedUrls.has(sig)) {
      usedUrls.add(sig);
      personalRows.push({
        row: { key: `home-genre-personal-watched-${m.id}`, title: `Because you watched ${m.title || m.name}`, fetchUrl: url },
        targetIndex: i === 0 ? 4 : 8,
      });
    }
  });

  // “Because you liked” → up to 2 rows (7 and 13), seeds rotate daily
  const likedEligible = likedEntries
    .map(e => e.movie)
    .filter((m: Movie) => m && (!selectedGenreId || (m.genre_ids && m.genre_ids.includes(selectedGenreId))));
  pickPersonalSeeds(likedEligible, hash ^ 0x2f7c, 2).forEach((m: Movie, i: number) => {
    const isTV = m.media_type === 'tv' || (!m.media_type && !m.title);
    const url = REQUESTS.fetchRecommendations(isTV ? 'tv' : 'movie', m.id);
    const sig = makeUrlSig(url);
    if (!usedUrls.has(sig)) {
      usedUrls.add(sig);
      personalRows.push({
        row: { key: `home-genre-personal-liked-${m.id}`, title: `Because you liked ${m.title || m.name}`, fetchUrl: url },
        targetIndex: i === 0 ? 7 : 13,
      });
    }
  });

  // My List → row 12
  if (myListRow) {
    personalRows.push({ row: myListRow, targetIndex: 12 });
  }

  // 4. TRENDING + TOP 10 — added to personalRows so they're spliced after the fill
  const trendingAllUrl = REQUESTS.fetchTrending;
  const trendingAllSig = makeUrlSig(trendingAllUrl);
  if (!selectedGenreId && !usedUrls.has(trendingAllSig)) {
    usedUrls.add(trendingAllSig);
    personalRows.push({ row: { key: 'home-trending-all', title: 'Trending Now', fetchUrl: trendingAllUrl }, targetIndex: 9 });
  }

  const top10MovieUrl = selectedGenreId
    ? REQUESTS.fetchByGenre('movie', movieGenreId!, 'popularity.desc')
    : REQUESTS.fetchTrendingMovies;
  const top10MovieSig = makeUrlSig(top10MovieUrl);
  if (!usedUrls.has(top10MovieSig)) {
    usedUrls.add(top10MovieSig);
    personalRows.push({ row: { key: `home-genre-top10-movie-${selectedGenreId || 'all'}`, title: selectedGenreId ? `Top 10 ${baseGenreName} Films` : 'Top 10 Films in the UK Today', fetchUrl: top10MovieUrl, type: 'top10' }, targetIndex: 10 });
  }

  const trendingTVUrl = REQUESTS.fetchTrendingTV;
  const trendingTVSig = makeUrlSig(trendingTVUrl);
  if (!selectedGenreId && !usedUrls.has(trendingTVSig)) {
    usedUrls.add(trendingTVSig);
    personalRows.push({ row: { key: 'home-trending-tv', title: 'Trending Series Right Now', fetchUrl: trendingTVUrl }, targetIndex: 11 });
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 5. THEMATIC ROWS POOL (Interleaved)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // Decades / trending rows — genre pages get TV decade rows; home All gets trending/all (mixed types)
  const homeTvDecadePool = [
    { label: 'Best of the 2000s',  gte: '2000-01-01', lte: '2009-12-31' },
    { label: '90s Nostalgia Trip', gte: '1990-01-01', lte: '1999-12-31' },
    { label: '80s Classics',       gte: '1980-01-01', lte: '1989-12-31' },
    { label: '70s Retro TV',       gte: '1970-01-01', lte: '1979-12-31' },
    { label: '2010s Must-Watch',   gte: '2010-01-01', lte: '2019-12-31' },
    { label: '60s TV Classics',    gte: '1960-01-01', lte: '1969-12-31' },
  ];
  if (selectedGenreId) {
    seededPick(homeTvDecadePool, 2, hash + 311).forEach((d, i) => {
      pool.push({
        key: `${tvPrefix}-theme-decade-${i}`,
        title: getThemedTitle(d.label, 'tv', selectedGenreName),
        fetchUrl: buildScopedQuery('tv', {
          sort_by: 'popularity.desc',
          'first_air_date.gte': d.gte,
          'first_air_date.lte': d.lte,
          'vote_count.gte': 20,
        }),
      });
    });
  } else {
    // Home All: trending/all rows are genuinely mixed (both movies AND TV in one row)
    const trendingAllVariants = [
      { key: 'home-trall-2', title: 'Films & Series of the Moment',   page: 2 },
      { key: 'home-trall-3', title: 'Rising Stars: Films & Shows',    page: 3 },
      { key: 'home-trall-4', title: 'Discover Something New',         page: 4 },
      { key: 'home-trall-5', title: 'Under-the-Radar Picks',          page: 5 },
      { key: 'home-trall-6', title: 'More Hidden Favourites',         page: 6 },
    ];
    seededPick(trendingAllVariants, 3, hash + 311).forEach(d => {
      pool.push({ key: d.key, title: d.title, fetchUrl: `${REQUESTS.fetchTrending}?page=${d.page}` });
    });
  }

  // Theme C: In a Bit of a Hurry? Try These 30-Minute Hits!
  const quickUrl = buildScopedQuery('tv', {
    sort_by: 'popularity.desc',
    'with_runtime.lte': 35,
    'with_runtime.gte': 15,
    'vote_count.gte': selectedGenreId ? 5 : 30,
    ...(selectedGenreId !== 16 && selectedGenreId !== 10762 && { without_genres: '16,10762' }),
  });
  pool.push({
    key: `${tvPrefix}-theme-quickwatch`,
    title: getThemedTitle('Try These 30-Minute Hits', 'tv', selectedGenreName),
    fetchUrl: quickUrl,
  });

  // Theme C2: Quick Watch Movies (Under 90 Minutes)
  const quickMovieUrl = buildScopedQuery('movie', {
    sort_by: 'popularity.desc',
    'with_runtime.lte': 95,
    'with_runtime.gte': 40,
    'vote_count.gte': selectedGenreId ? 5 : 50,
  });
  pool.push({
    key: `${moviePrefix}-theme-quickwatch-movie`,
    title: getThemedTitle('In a Hurry? Films Under 90 Minutes', 'movie', selectedGenreName),
    fetchUrl: quickMovieUrl,
  });

  // Theme D: Popular Series Based on Books (Adaptations)
  const bookUrl = buildScopedQuery('tv', {
    sort_by: 'popularity.desc',
    with_keywords: '818',
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

  // Netflix Originals lives in the pool (standardCategories) when !selectedGenreId,
  // or gets pushed individually below when a genre is active, so nothing here.

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
    // Home All: large rich pool — movies AND series mixed — shuffled fresh each session
    const standardCategories: SmartRow[] = [
      // Mixed (trending/all returns both movies and TV in a single row)
      { key: 'home-trending',           title: 'Your Next Watch',                           fetchUrl: REQUESTS.fetchTrending },
      { key: 'home-trending-p2',        title: 'Popular with Everyone',                     fetchUrl: `${REQUESTS.fetchTrending}?page=2` },
      { key: 'home-trending-p3',        title: 'Keep Discovering',                          fetchUrl: `${REQUESTS.fetchTrending}?page=3` },

      // Film rows
      { key: 'home-new',                title: 'New on P-Stream',                           fetchUrl: REQUESTS.fetchNewReleases },
      { key: 'home-upcoming',           title: 'Coming Soon',                               fetchUrl: REQUESTS.fetchUpcoming },
      { key: 'home-toprated',           title: 'All-Time Masterpieces',                     fetchUrl: REQUESTS.fetchTopRated },
      { key: 'home-trending-movies',    title: 'Trending Films Right Now',                  fetchUrl: REQUESTS.fetchTrendingMovies },
      { key: 'home-action-movies',      title: 'Action & Adventure Films',                  fetchUrl: REQUESTS.fetchActionMovies },
      { key: 'home-horror-movies',      title: 'Horror Films',                              fetchUrl: REQUESTS.fetchHorrorMovies },
      { key: 'home-scifi-movies',       title: 'Sci-Fi & Fantasy Films',                    fetchUrl: REQUESTS.fetchSciFiMovies },
      { key: 'home-comedy-movies',      title: 'Comedy Films',                              fetchUrl: REQUESTS.fetchComedyMovies },
      { key: 'home-romance-movies',     title: 'Romance Films',                             fetchUrl: REQUESTS.fetchRomanceMovies },
      { key: 'home-thriller-movies',    title: 'Thrillers That Keep You Guessing',          fetchUrl: REQUESTS.fetchUnderratedThrillers },
      { key: 'home-prestige',           title: 'Award-Winning & Critically Acclaimed',      fetchUrl: REQUESTS.fetchPrestigeDrama },
      { key: 'home-world-cinema',       title: 'World Cinema: Global Hits',                 fetchUrl: REQUESTS.fetchWorldCinema },
      { key: 'home-cult',               title: 'Cult Classics',                             fetchUrl: REQUESTS.fetchCultFilms },
      { key: 'home-hidden-gems',        title: 'Hidden Gems',                               fetchUrl: REQUESTS.fetchHiddenGems },
      { key: 'home-loved-movies',       title: 'Films Worth Loving',                        fetchUrl: REQUESTS.fetchLoveTheseMovies },
      { key: 'home-boredom-movies',     title: 'Crowd-Pleasers',                            fetchUrl: REQUESTS.fetchBoredomBustersMovies },
      { key: 'home-conceptual-sf',      title: 'Mind-Bending Sci-Fi',                       fetchUrl: REQUESTS.fetchConceptualSciFi },
      { key: 'home-crime-movies',       title: 'Crime & Heist Films',                       fetchUrl: REQUESTS.fetchByGenre('movie', 80, 'popularity.desc') },
      { key: 'home-drama-movies',       title: 'Acclaimed Drama Films',                     fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'vote_average.desc', '&vote_count.gte=200') },
      { key: 'home-family-films',       title: 'Family & Animation',                        fetchUrl: REQUESTS.fetchByGenre('movie', 10751, 'popularity.desc') },
      { key: 'home-anime-films',        title: 'Must-Watch Anime Films',                    fetchUrl: `${REQUESTS.fetchByGenre('movie', 16, 'popularity.desc')}&with_origin_country=JP` },
      { key: 'home-kr-films',           title: 'Korean Cinema',                             fetchUrl: `${REQUESTS.fetchByGenre('movie', 18, 'popularity.desc')}&with_origin_country=KR` },
      { key: 'home-euro-cinema',        title: 'European Art-House',                        fetchUrl: `${REQUESTS.fetchByGenre('movie', 18, 'popularity.desc')}&with_origin_country=FR|IT|ES|DE` },
      { key: 'home-docs',               title: 'Documentaries Worth Watching',              fetchUrl: REQUESTS.fetchDocumentaries },
      { key: 'home-classic-cinema',     title: 'Classic Cinema',                            fetchUrl: REQUESTS.fetchClassicCinema },

      // Series rows
      { key: 'home-trending-tv',        title: 'Trending Series',                           fetchUrl: REQUESTS.fetchTrendingTV },
      { key: 'home-action-tv',          title: 'Action & Adventure Series',                 fetchUrl: REQUESTS.fetchActionTV },
      { key: 'home-crime-tv',           title: 'Crime & Thriller Series',                   fetchUrl: REQUESTS.fetchCrimeTV },
      { key: 'home-drama-binge',        title: 'Bingeworthy Drama Series',                  fetchUrl: REQUESTS.fetchDramaTV },
      { key: 'home-comedy-tv',          title: 'Comedy Series',                             fetchUrl: REQUESTS.fetchComedyTV },
      { key: 'home-suspense',           title: 'Mystery & Thriller Series',                 fetchUrl: REQUESTS.fetchMysteryThrillerSeries },
      { key: 'home-us-series',          title: 'US Series',                                 fetchUrl: REQUESTS.fetchUSSeries },
      { key: 'home-loved-tv',           title: 'Series Worth Bingeing',                     fetchUrl: REQUESTS.fetchLoveTheseTV },
      { key: 'home-originals',          title: 'Only on P-Stream',                          fetchUrl: REQUESTS.fetchNetflixOriginals },
      { key: 'home-boredom-tv',         title: 'Series to Cure Your Boredom',               fetchUrl: REQUESTS.fetchBoredomBustersTV },
      { key: 'home-hidden-tv-gems',     title: 'Under-the-Radar Series',                    fetchUrl: REQUESTS.fetchHiddenTVGems },
      { key: 'home-intl-series',        title: 'International Series',                      fetchUrl: REQUESTS.fetchInternationalSeries },
      { key: 'home-award-series',       title: 'Award-Winning Series',                      fetchUrl: REQUESTS.fetchAwardWinningSeries },
      { key: 'home-supernatural',       title: 'Supernatural & Fantasy Series',             fetchUrl: REQUESTS.fetchByGenre('tv', 10765, 'popularity.desc') },
      { key: 'home-us-drama',           title: 'US Drama Series',                           fetchUrl: `${REQUESTS.fetchByGenre('tv', 18, 'popularity.desc')}&with_origin_country=US` },
      { key: 'home-us-action',          title: 'US Action & Adventure Series',              fetchUrl: `${REQUESTS.fetchByGenre('tv', 10759, 'popularity.desc')}&with_origin_country=US` },
      { key: 'home-romance-tv',         title: 'Romance Series',                            fetchUrl: `${REQUESTS.fetchByGenre('tv', 10749, 'popularity.desc')}&without_original_language=ko,ja,zh` },
      { key: 'home-scifi-tv',           title: 'Sci-Fi & Fantasy Series',                   fetchUrl: REQUESTS.fetchImaginativeSeries },
      { key: 'home-kdrama',             title: 'K-Drama Hits',                              fetchUrl: `${REQUESTS.fetchByGenre('tv', 18, 'popularity.desc')}&with_origin_country=KR` },
      { key: 'home-anime-tv',           title: 'Top Anime Series',                          fetchUrl: `${REQUESTS.fetchByGenre('tv', 16, 'popularity.desc')}&with_origin_country=JP` },
    ];
    pool.push(...standardCategories);
  }

  // Shuffle the pool every session (home All page included — user wants random order each visit)
  const seededPool = seededPick(pool, pool.length, Math.abs((hash ^ SESSION_SEED) | 0));
  seededPool.forEach(row => trackAdd(row));

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 6. SECOND TOP 10 SPLIT (Demoted to index 11+, separated from first)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 7. GLOBAL DYNAMIC FILL
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const movieFillTitles = getPremiumFillTitles(baseGenreName, 'movie');
  const tvFillTitles = getPremiumFillTitles(baseGenreName, 'tv');

  let movieCountTracked = countByPrefix(moviePrefix, manifest);
  let tvCountTracked = countByPrefix(tvPrefix, manifest);
  const targetMin = 60;

  const tryFill = (type: 'movie' | 'tv', genreId: number, page: number, fillIdx: number): boolean => {
    const url = REQUESTS.fetchByGenre(type, genreId, 'popularity.desc') + `&page=${page}`;
    const sig = makeUrlSig(url);
    if (usedUrls.has(sig)) return false;
    usedUrls.add(sig);
    const titles = type === 'movie' ? movieFillTitles : tvFillTitles;
    const title = titles[fillIdx % titles.length];
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

  // Splice personalized rows into their target positions (sorted ascending so earlier inserts don't shift later ones incorrectly)
  personalRows
    .sort((a, b) => a.targetIndex - b.targetIndex)
    .forEach(({ row, targetIndex }) => {
      manifest.splice(Math.min(manifest.length, targetIndex), 0, row);
    });
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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 1. PRIORITIZED COMFORT ROWS (Based on Card Count)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Curated anchor first — strong cold start before any personalized rows
  const primaryCuratedUrl = selectedGenreId
    ? REQUESTS.fetchByGenre('movie', selectedGenreId, 'vote_count.desc')
    : REQUESTS.fetchTrendingMovies;
  const primaryCuratedSig = makeUrlSig(primaryCuratedUrl);
  if (!usedUrls.has(primaryCuratedSig)) {
    addRow({
      key: `movie-primary-curated-${selectedGenreId || 'all'}`,
      title: selectedGenreId ? `Most Loved ${baseGenreName} Films` : 'Trending Films Right Now',
      fetchUrl: primaryCuratedUrl,
    });
  }

  let CW_at_top = false;
  let ML_at_top = false;

  if (filteredContinueWatchingRow && filteredContinueWatchingRow.data && filteredContinueWatchingRow.data.length >= 6) {
    addRow(filteredContinueWatchingRow);
    CW_at_top = true;
  }

  // Up to 2 "Because you watched" rows, seeds rotating daily with the hash.
  const watchedMovieSeeds = continueWatching.filter((m) => {
    const isMovie = m.media_type === 'movie' || (!m.media_type && !!m.title);
    if (!isMovie) return false;
    return !selectedGenreId || (m.genre_ids && m.genre_ids.includes(selectedGenreId));
  });
  pickPersonalSeeds(watchedMovieSeeds, hash, 2).forEach((m) => {
    const url = REQUESTS.fetchRecommendations('movie', m.id);
    // addRow dedups via usedUrls itself — no pre-add, or it would self-block.
    if (!usedUrls.has(makeUrlSig(url))) {
      addRow({
        key: `movie-personal-watched-${m.id}`,
        title: `Because you watched ${m.title || m.name}`,
        fetchUrl: url,
      });
    }
  });

  if (filteredContinueWatchingRow && !CW_at_top) {
    addRow(filteredContinueWatchingRow);
  }

  // Up to 2 "Because you liked" rows, offset-rotated so they differ from the
  // watched seeds even when both pools overlap.
  const likedMovieSeeds = likedEntries
    .map(e => e.movie)
    .filter((m: Movie) => {
      if (!m) return false;
      const isMovie = m.media_type === 'movie' || (!m.media_type && !!m.title);
      if (!isMovie) return false;
      return !selectedGenreId || (m.genre_ids && m.genre_ids.includes(selectedGenreId));
    });
  pickPersonalSeeds(likedMovieSeeds, hash ^ 0x2f7c, 2).forEach((m: Movie) => {
    const url = REQUESTS.fetchRecommendations('movie', m.id);
    // addRow dedups via usedUrls itself — no pre-add, or it would self-block.
    if (!usedUrls.has(makeUrlSig(url))) {
      addRow({
        key: `movie-personal-liked-${m.id}`,
        title: `Because you liked ${m.title || m.name}`,
        fetchUrl: url,
      });
    }
  });

  if (myListRow) {
    addRow(myListRow);
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 4. TOP 10 PLACEMENTS (Demoted to index 5-8)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const top10Url = selectedGenreId
    ? REQUESTS.fetchByGenre('movie', selectedGenreId, 'popularity.desc')
    : REQUESTS.fetchTrendingMovies;
  const top10Sig = makeUrlSig(top10Url);
  if (!usedUrls.has(top10Sig)) {
    addRow({
      key: `movie-top10-genre-${selectedGenreId || 'all'}`,
      title: selectedGenreId ? `Top 10 ${baseGenreName} Films` : 'Top 10 Films in the UK Today',
      fetchUrl: top10Url,
      type: 'top10',
    });
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 5. THEMATIC ROWS POOL (Interleaved)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const moviePrefix = `movie-${selectedGenreId || 'all'}`;
  const pool: SmartRow[] = [];

  const trackAdd = (row: SmartRow) => {
    manifest.push(row);
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
      with_keywords: '9902|18330', // Animal tales
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

  // Crime (80) movie bespoke
  if (selectedGenreId === 80) {
    const vintageUrl = buildScopedQuery('movie', {
      sort_by: 'popularity.desc',
      'primary_release_date.lte': '2010-01-01',
      'vote_count.gte': 80,
    });
    pool.push({
      key: `${moviePrefix}-theme-vintage-crime`,
      title: 'Vintage Crime Films',
      fetchUrl: vintageUrl,
    });

    const trueCrimeUrl = buildScopedQuery('movie', {
      sort_by: 'popularity.desc',
      with_keywords: '818',
    });
    pool.push({
      key: `${moviePrefix}-theme-true-crime-sagas`,
      title: 'True Crime & Real-Life Sagas',
      fetchUrl: trueCrimeUrl,
    });

    const dm = `${REQUESTS.fetchTrendingMovies.split('/trending')[0]}/discover/movie`;
    pool.push({
      key: `${moviePrefix}-theme-crime-prestige`,
      title: 'Critically Acclaimed Crime Films',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'vote_average.desc', with_genres: '80', 'vote_count.gte': 400 }),
    });
    pool.push({
      key: `${moviePrefix}-theme-crime-heist`,
      title: 'Heist & Con Films',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: '80,28' }),
    });
    pool.push({
      key: `${moviePrefix}-theme-nordic-crime`,
      title: 'Nordic Crime Films',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: '80', with_origin_country: 'SE|DK|NO|FI' }),
    });
  }

  // Action (28) movie bespoke
  if (selectedGenreId === 28) {
    const dm = `${REQUESTS.fetchTrendingMovies.split('/trending')[0]}/discover/movie`;
    pool.push({
      key: `${moviePrefix}-theme-blockbusters`,
      title: 'Hollywood Action Blockbusters',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'vote_count.desc', with_genres: '28', 'vote_average.gte': 6.5 }),
    });
    pool.push({
      key: `${moviePrefix}-theme-action-prestige`,
      title: 'Critically Acclaimed Action Films',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'vote_average.desc', with_genres: '28', 'vote_count.gte': 300 }),
    });
    pool.push({
      key: `${moviePrefix}-theme-action-franchise`,
      title: 'Action Franchise Films',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: '28,12' }),
    });
    pool.push({
      key: `${moviePrefix}-theme-spy-thriller`,
      title: 'Spy & Espionage Thrillers',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: '28,53' }),
    });
    pool.push({
      key: `${moviePrefix}-theme-action-new`,
      title: 'New Action Films',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: '28', 'primary_release_date.gte': `${new Date().getFullYear() - 2}-01-01` }),
    });
  }

  // Horror (27) movie bespoke
  if (selectedGenreId === 27) {
    const dm = `${REQUESTS.fetchTrendingMovies.split('/trending')[0]}/discover/movie`;
    pool.push({
      key: `${moviePrefix}-theme-horror-prestige`,
      title: 'Critically Acclaimed Horror',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'vote_average.desc', with_genres: '27', 'vote_count.gte': 300 }),
    });
    pool.push({
      key: `${moviePrefix}-theme-psychological-horror`,
      title: 'Psychological Horror Films',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: '27,53' }),
    });
    pool.push({
      key: `${moviePrefix}-theme-horror-supernatural`,
      title: 'Supernatural Horror Films',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: '27,14' }),
    });
    pool.push({
      key: `${moviePrefix}-theme-horror-new`,
      title: 'New Horror Releases',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: '27', 'primary_release_date.gte': `${new Date().getFullYear() - 2}-01-01` }),
    });
    pool.push({
      key: `${moviePrefix}-theme-horror-cult`,
      title: 'Cult Horror Classics',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'vote_count.desc', with_genres: '27', 'primary_release_date.lte': '2005-01-01', 'vote_average.gte': 7.0 }),
    });
  }

  // Sci-Fi (878) / Fantasy (14) movie bespoke
  if (selectedGenreId === 878 || selectedGenreId === 14) {
    const dm = `${REQUESTS.fetchTrendingMovies.split('/trending')[0]}/discover/movie`;
    const sfGenre = selectedGenreId === 878 ? '878' : '14';
    pool.push({
      key: `${moviePrefix}-theme-scifi-prestige`,
      title: selectedGenreId === 878 ? 'Prestige Sci-Fi Films' : 'Epic Fantasy Films',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'vote_average.desc', with_genres: sfGenre, 'vote_count.gte': 500 }),
    });
    pool.push({
      key: `${moviePrefix}-theme-scifi-blockbuster`,
      title: selectedGenreId === 878 ? 'Sci-Fi Blockbusters' : 'Fantasy Adventures',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: `${sfGenre},28` }),
    });
    pool.push({
      key: `${moviePrefix}-theme-scifi-new`,
      title: selectedGenreId === 878 ? 'New Sci-Fi Films' : 'New Fantasy Films',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: sfGenre, 'primary_release_date.gte': `${new Date().getFullYear() - 2}-01-01` }),
    });
    pool.push({
      key: `${moviePrefix}-theme-scifi-classic`,
      title: selectedGenreId === 878 ? 'Classic Sci-Fi Films' : 'Classic Fantasy Films',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'vote_count.desc', with_genres: sfGenre, 'primary_release_date.lte': '2000-01-01', 'vote_average.gte': 7.0 }),
    });
    if (selectedGenreId === 878) {
      pool.push({
        key: `${moviePrefix}-theme-dystopian`,
        title: 'Dystopian Futures',
        fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: '878', with_keywords: '4344' }),
      });
    }
  }

  // Thriller (53) movie bespoke
  if (selectedGenreId === 53) {
    const dm = `${REQUESTS.fetchTrendingMovies.split('/trending')[0]}/discover/movie`;
    pool.push({
      key: `${moviePrefix}-theme-thriller-prestige`,
      title: 'Critically Acclaimed Thrillers',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'vote_average.desc', with_genres: '53', 'vote_count.gte': 400 }),
    });
    pool.push({
      key: `${moviePrefix}-theme-thriller-psychological`,
      title: 'Psychological Thrillers',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: '53,18' }),
    });
    pool.push({
      key: `${moviePrefix}-theme-thriller-heist`,
      title: 'Heist & Con Thrillers',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: '53,80' }),
    });
    pool.push({
      key: `${moviePrefix}-theme-thriller-new`,
      title: 'New Thrillers',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: '53', 'primary_release_date.gte': `${new Date().getFullYear() - 2}-01-01` }),
    });
    pool.push({
      key: `${moviePrefix}-theme-thriller-spy`,
      title: 'Spy & Conspiracy Thrillers',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: '53,28' }),
    });
  }

  // Drama (18) movie bespoke
  if (selectedGenreId === 18) {
    const dm = `${REQUESTS.fetchTrendingMovies.split('/trending')[0]}/discover/movie`;
    pool.push({
      key: `${moviePrefix}-theme-drama-prestige`,
      title: 'Prestige Drama Films',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'vote_average.desc', with_genres: '18', 'vote_count.gte': 500 }),
    });
    pool.push({
      key: `${moviePrefix}-theme-drama-british`,
      title: 'British Drama Films',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: '18', with_origin_country: 'GB' }),
    });
    pool.push({
      key: `${moviePrefix}-theme-drama-european`,
      title: 'European Art-House Drama',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: '18', with_origin_country: 'FR|IT|ES|DE' }),
    });
    pool.push({
      key: `${moviePrefix}-theme-drama-biopic`,
      title: 'True Story & Biographical Films',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: '18', with_keywords: '818' }),
    });
    pool.push({
      key: `${moviePrefix}-theme-drama-award`,
      title: 'Oscar-Calibre Dramas',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'vote_count.desc', with_genres: '18', 'vote_average.gte': 7.5 }),
    });
  }

  // Documentary (99) movie bespoke
  if (selectedGenreId === 99) {
    const dm = `${REQUESTS.fetchTrendingMovies.split('/trending')[0]}/discover/movie`;
    pool.push({
      key: `${moviePrefix}-theme-doc-truecrime`,
      title: 'True Crime Documentaries',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: '99,80' }),
    });
    pool.push({
      key: `${moviePrefix}-theme-doc-nature`,
      title: 'Nature & Wildlife Documentaries',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: '99', with_keywords: '299|241741' }),
    });
    pool.push({
      key: `${moviePrefix}-theme-doc-acclaimed`,
      title: 'Award-Winning Documentaries',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'vote_average.desc', with_genres: '99', 'vote_count.gte': 100 }),
    });
    pool.push({
      key: `${moviePrefix}-theme-doc-history`,
      title: 'History & Society Documentaries',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: '99,36' }),
    });
    pool.push({
      key: `${moviePrefix}-theme-doc-music`,
      title: 'Music & Cultural Documentaries',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: '99,10402' }),
    });
  }

  // Comedy (35) movie bespoke
  if (selectedGenreId === 35) {
    const dm = `${REQUESTS.fetchTrendingMovies.split('/trending')[0]}/discover/movie`;
    pool.push({
      key: `${moviePrefix}-theme-comedy-prestige`,
      title: 'Critically Acclaimed Comedy Films',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'vote_average.desc', with_genres: '35', 'vote_count.gte': 500 }),
    });
    pool.push({
      key: `${moviePrefix}-theme-comedy-romantic`,
      title: 'Romantic Comedy Films',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: '35,10749' }),
    });
    pool.push({
      key: `${moviePrefix}-theme-comedy-crime`,
      title: 'Crime Comedy Films',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: '35,80' }),
    });
    pool.push({
      key: `${moviePrefix}-theme-comedy-new`,
      title: 'New Comedy Films',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: '35', 'primary_release_date.gte': `${new Date().getFullYear() - 2}-01-01` }),
    });
    pool.push({
      key: `${moviePrefix}-theme-comedy-classic`,
      title: 'Comedy Classics',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'vote_count.desc', with_genres: '35', 'primary_release_date.lte': '2005-01-01', 'vote_average.gte': 7.0 }),
    });
  }

  // Romance (10749) movie bespoke
  if (selectedGenreId === 10749) {
    const dm = `${REQUESTS.fetchTrendingMovies.split('/trending')[0]}/discover/movie`;
    pool.push({
      key: `${moviePrefix}-theme-romance-prestige`,
      title: 'Critically Acclaimed Romance Films',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'vote_average.desc', with_genres: '10749', 'vote_count.gte': 400 }),
    });
    pool.push({
      key: `${moviePrefix}-theme-romance-comedy`,
      title: 'Romantic Comedy Films',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: '10749,35' }),
    });
    pool.push({
      key: `${moviePrefix}-theme-romance-drama`,
      title: 'Sweeping Romance Drama Films',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: '10749,18' }),
    });
    pool.push({
      key: `${moviePrefix}-theme-romance-new`,
      title: 'New Romance Films',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: '10749', 'primary_release_date.gte': `${new Date().getFullYear() - 2}-01-01` }),
    });
    pool.push({
      key: `${moviePrefix}-theme-romance-classics`,
      title: 'Romance Film Classics',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'vote_count.desc', with_genres: '10749', 'primary_release_date.lte': '2005-01-01', 'vote_average.gte': 7.0 }),
    });
  }

  // Anime & Animation (16) movie bespoke
  if (selectedGenreId === 16) {
    const dm = `${REQUESTS.fetchTrendingMovies.split('/trending')[0]}/discover/movie`;
    pool.push({
      key: `${moviePrefix}-theme-anime-ghibli`,
      title: 'Studio Ghibli Films',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: '16', with_keywords: '12883' }),
    });
    pool.push({
      key: `${moviePrefix}-theme-anime-prestige`,
      title: 'Critically Acclaimed Anime Films',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'vote_average.desc', with_genres: '16', with_original_language: 'ja', 'vote_count.gte': 200 }),
    });
    pool.push({
      key: `${moviePrefix}-theme-anime-action`,
      title: 'Action & Adventure Anime Films',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: '16,28', with_original_language: 'ja' }),
    });
    pool.push({
      key: `${moviePrefix}-theme-animation-family`,
      title: 'Family Animation Films',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: '16,10751' }),
    });
    pool.push({
      key: `${moviePrefix}-theme-anime-classic`,
      title: 'Classic Anime Films',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'vote_count.desc', with_genres: '16', 'primary_release_date.lte': '2010-01-01', 'vote_average.gte': 7.5 }),
    });
  }

  // Music & Musicals (10402) movie bespoke
  if (selectedGenreId === 10402) {
    const dm = `${REQUESTS.fetchTrendingMovies.split('/trending')[0]}/discover/movie`;
    pool.push({
      key: `${moviePrefix}-theme-musicals-broadway`,
      title: 'Broadway & Stage Musicals',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'vote_average.desc', with_genres: '10402', 'vote_count.gte': 200 }),
    });
    pool.push({
      key: `${moviePrefix}-theme-music-biopic`,
      title: 'Musician Biographical Films',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: '10402,18', with_keywords: '818' }),
    });
    pool.push({
      key: `${moviePrefix}-theme-music-concert`,
      title: 'Concert Films & Performances',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: '10402', with_keywords: '7917|4344' }),
    });
    pool.push({
      key: `${moviePrefix}-theme-music-drama`,
      title: 'Music Drama Films',
      fetchUrl: REQUESTS._build(dm, { sort_by: 'popularity.desc', with_genres: '10402,18' }),
    });
  }

  // Decades: rotate through 6 eras and pick 2 per 4h segment so the same eras don't repeat
  const movieDecadePool = [
    { label: 'Best of the 2000s',     gte: '2000-01-01', lte: '2009-12-31' },
    { label: '90s Nostalgia Trip',    gte: '1990-01-01', lte: '1999-12-31' },
    { label: '80s Classics',          gte: '1980-01-01', lte: '1989-12-31' },
    { label: '70s Cinema Gems',       gte: '1970-01-01', lte: '1979-12-31' },
    { label: '2010s Blockbusters',    gte: '2010-01-01', lte: '2019-12-31' },
    { label: '60s & Earlier Classics',gte: '1960-01-01', lte: '1969-12-31' },
  ];
  seededPick(movieDecadePool, 2, hash + 433).forEach((d, i) => {
    pool.push({
      key: `${moviePrefix}-theme-decade-${i}`,
      title: getThemedTitle(d.label, 'movie', selectedGenreName),
      fetchUrl: buildScopedQuery('movie', {
        sort_by: 'popularity.desc',
        'primary_release_date.gte': d.gte,
        'primary_release_date.lte': d.lte,
        'vote_count.gte': selectedGenreId ? 25 : 120,
      }),
    });
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
    with_keywords: '818',
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
    // Curated standard film categories â€” seeded daily so order rotates
    const curatedCategories: SmartRow[] = [
      { key: 'movie-trending',      title: 'Trending Films Right Now',                      fetchUrl: REQUESTS.fetchTrendingMovies },
      { key: 'movie-exciting',      title: 'High-Octane Action Films',                      fetchUrl: REQUESTS.fetchExcitingMovies },
      { key: 'movie-toprated',      title: 'Timeless Film Masterpieces',                    fetchUrl: REQUESTS.fetchTopRated },
      { key: 'movie-scifi',         title: 'Mind-Bending Sci-Fi',                           fetchUrl: REQUESTS.fetchSciFiMovies },
      { key: 'movie-drama',         title: 'Emotional & Impactful Dramas',                  fetchUrl: REQUESTS.fetchLoveTheseMovies },
      { key: 'movie-horror',        title: 'Spooky & Haunting Horror',                      fetchUrl: REQUESTS.fetchHorrorMovies },
      { key: 'movie-comedy',        title: 'Hilarious Comedy Favorites',                    fetchUrl: REQUESTS.fetchComedyMovies },
      { key: 'movie-romance',       title: 'Romance Done Right',                            fetchUrl: REQUESTS.fetchRomanceMovies },
      { key: 'movie-action',        title: 'High-Octane Action',                            fetchUrl: REQUESTS.fetchActionMovies },
      { key: 'movie-docs',          title: 'Compelling Documentaries',                      fetchUrl: REQUESTS.fetchDocumentaries },
      { key: 'movie-buster',        title: 'Crowd-Pleasing Favorites',                      fetchUrl: REQUESTS.fetchBoredomBustersMovies },
      { key: 'movie-fav',           title: 'Popular Hits & Fan Favorites',                  fetchUrl: REQUESTS.fetchFamiliarFavoritesMovies },
      { key: 'movie-hidden-gems',   title: 'Hidden Gems',                                   fetchUrl: REQUESTS.fetchHiddenGems },
      { key: 'movie-world-cinema',  title: 'Critically Acclaimed World Cinema',             fetchUrl: REQUESTS.fetchWorldCinema },
      { key: 'movie-prestige',      title: 'Prestige Cinema',                               fetchUrl: REQUESTS.fetchPrestigeDrama },
      { key: 'movie-cult',          title: 'Cult Classics & Favorites',                     fetchUrl: REQUESTS.fetchCultFilms },
      { key: 'movie-conceptual-sf', title: 'Thought-Provoking Sci-Fi',                      fetchUrl: REQUESTS.fetchConceptualSciFi },
      { key: 'movie-underrated',    title: 'Underrated Thrillers',                          fetchUrl: REQUESTS.fetchUnderratedThrillers },
      { key: 'movie-classic-pre00', title: 'Timeless Classics',                             fetchUrl: REQUESTS.fetchClassicCinema },
      { key: 'movie-intl',          title: 'Acclaimed World Cinema',                        fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'popularity.desc') + '&without_original_language=en' },
      { key: 'movie-year',          title: `The Best Films of ${year}`,                     fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'vote_average.desc') + `&release_date.gte=${year}-01-01&vote_count.gte=50` },
      { key: 'movie-kr-cinema',     title: 'Korean Cinema Favorites',                       fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'popularity.desc') + '&with_origin_country=KR' },
      { key: 'movie-french',        title: 'Prestige European Cinema',                      fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'popularity.desc') + '&with_origin_country=FR|IT|ES' },
      { key: 'movie-anime-film',    title: 'Must-Watch Anime Films',                        fetchUrl: REQUESTS.fetchByGenre('movie', 16, 'popularity.desc') + '&with_origin_country=JP' },
      { key: 'movie-runtime90',     title: 'Under 90 Minutes: Fast & Great',                fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'popularity.desc') + '&with_runtime.lte=95' },
      { key: 'movie-adaptations',   title: 'Book Adaptations',                              fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'popularity.desc') + '&with_keywords=818' },
    ];
    pool.push(...curatedCategories);
  }

  // Interleave and shuffle using session seed so order varies every page load, not just every 4 hours
  const seededPool = seededPick(pool, pool.length, Math.abs((hash ^ SESSION_SEED) | 0));
  seededPool.forEach(row => trackAdd(row));

  // Global Dynamic Fill
  const fillTitles = getPremiumFillTitles(baseGenreName, 'movie');

  if (selectedGenreId) {
    for (let page = 5; manifest.length < 50 && page < 65; page++) {
      const url = REQUESTS.fetchByGenre('movie', selectedGenreId, 'popularity.desc') + `&page=${page}`;
      const sig = makeUrlSig(url);
      if (!usedUrls.has(sig)) {
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

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 1. PRIORITIZED COMFORT ROWS (Based on Card Count)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Curated anchor first — strong cold start before any personalized rows
  const primaryCuratedExtra = selectedGenreId === 10749 ? '&without_original_language=ko,ja,zh' : '';
  const primaryCuratedUrl = selectedGenreId
    ? REQUESTS.fetchByGenre('tv', selectedGenreId, 'popularity.desc', primaryCuratedExtra)
    : REQUESTS.fetchNetflixOriginals;
  const primaryCuratedSig = makeUrlSig(primaryCuratedUrl);
  if (!usedUrls.has(primaryCuratedSig)) {
    addRow({
      key: `tv-primary-curated-${selectedGenreId || 'all'}`,
      title: selectedGenreId ? `Popular ${baseGenreName} Series` : 'Popular Series',
      fetchUrl: primaryCuratedUrl,
    });
  }

  // Personalized + Top 10 rows — deferred and spliced after thematic fill
  const personalRows: { row: SmartRow; targetIndex: number }[] = [];

  // Continue Watching → row 1
  if (filteredContinueWatchingRow) {
    personalRows.push({ row: filteredContinueWatchingRow, targetIndex: 1 });
  }

  // Because you watched → up to 2 rows (4 and 8), seeds rotating daily
  const watchedTvSeeds = continueWatching.filter((m) => {
    const isTV = m.media_type === 'tv' || (!m.media_type && !m.title);
    if (!isTV) return false;
    return !selectedGenreId || (m.genre_ids && m.genre_ids.includes(selectedGenreId));
  });
  pickPersonalSeeds(watchedTvSeeds, hash, 2).forEach((m, i) => {
    const url = REQUESTS.fetchRecommendations('tv', m.id);
    const sig = makeUrlSig(url);
    if (!usedUrls.has(sig)) {
      usedUrls.add(sig);
      personalRows.push({
        row: { key: `tv-personal-watched-${m.id}`, title: `Because you watched ${m.title || m.name}`, fetchUrl: url },
        targetIndex: i === 0 ? 4 : 8,
      });
    }
  });

  // Because you liked → up to 2 rows (7 and 13), offset-rotated
  const likedTvSeeds = likedEntries
    .map(e => e.movie)
    .filter((m: Movie) => {
      if (!m) return false;
      const isTV = m.media_type === 'tv' || (!m.media_type && !m.title);
      if (!isTV) return false;
      return !selectedGenreId || (m.genre_ids && m.genre_ids.includes(selectedGenreId));
    });
  pickPersonalSeeds(likedTvSeeds, hash ^ 0x2f7c, 2).forEach((m: Movie, i: number) => {
    const url = REQUESTS.fetchRecommendations('tv', m.id);
    const sig = makeUrlSig(url);
    if (!usedUrls.has(sig)) {
      usedUrls.add(sig);
      personalRows.push({
        row: { key: `tv-personal-liked-${m.id}`, title: `Because you liked ${m.title || m.name}`, fetchUrl: url },
        targetIndex: i === 0 ? 7 : 13,
      });
    }
  });

  // My List → row 12
  if (myListRow) {
    personalRows.push({ row: myListRow, targetIndex: 12 });
  }

  // Top 10 → row 9
  const top10Extra = selectedGenreId === 10749 ? '&without_original_language=ko,ja,zh' : '';
  const top10Url = selectedGenreId
    ? REQUESTS.fetchByGenre('tv', selectedGenreId, 'vote_count.desc', top10Extra)
    : REQUESTS.fetchTrendingTV;
  const top10Sig = makeUrlSig(top10Url);
  if (!usedUrls.has(top10Sig)) {
    usedUrls.add(top10Sig);
    personalRows.push({
      row: { key: `tv-top10-genre-${selectedGenreId || 'all'}`, title: selectedGenreId ? `Top 10 ${baseGenreName} Series` : 'Top 10 Series in the UK Today', fetchUrl: top10Url, type: 'top10' },
      targetIndex: 9,
    });
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 5. THEMATIC ROWS POOL (Interleaved)
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const tvPrefix = `tv-${selectedGenreId || 'all'}`;
  const pool: SmartRow[] = [];

  const trackAdd = (row: SmartRow) => {
    manifest.push(row);
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

  // Special Bespoke Curation for Romance Series (Genre ID 10749)
  // All rows use without_original_language=ko,ja,zh to surface Western/English content
  if (selectedGenreId === 10749) {
    pool.push({
      key: `${tvPrefix}-theme-en-romance`,
      title: 'English-Language Romance Series',
      fetchUrl: buildScopedQuery('tv', {
        sort_by: 'popularity.desc',
        without_original_language: 'ko,ja,zh',
        'vote_count.gte': 50,
      }),
    });
    pool.push({
      key: `${tvPrefix}-theme-prestige-romance`,
      title: 'Critically Acclaimed Romance',
      fetchUrl: buildScopedQuery('tv', {
        sort_by: 'vote_average.desc',
        without_original_language: 'ko,ja,zh',
        'vote_count.gte': 300,
      }),
    });
    pool.push({
      key: `${tvPrefix}-theme-new-romance`,
      title: 'New & Recent Romance Series',
      fetchUrl: buildScopedQuery('tv', {
        sort_by: 'popularity.desc',
        'first_air_date.gte': `${new Date().getFullYear() - 2}-01-01`,
        without_original_language: 'ko,ja,zh',
      }),
    });
    pool.push({
      key: `${tvPrefix}-theme-latin-romance`,
      title: 'Latin & Spanish Romance',
      fetchUrl: buildScopedQuery('tv', {
        sort_by: 'popularity.desc',
        with_origin_country: 'ES|MX|CO|AR|PT|BR',
      }),
    });
  }

  // Special Bespoke Curation for Comedy Series (Genre ID 35)
  if (selectedGenreId === 35) {
    const quickUrl = REQUESTS._build(`${REQUESTS.fetchTrendingTV.split('/trending')[0]}/discover/tv`, {
      sort_by: 'popularity.desc',
      with_genres: '35',
      'with_runtime.lte': 35,
      'with_runtime.gte': 15,
      'vote_count.gte': 30,
      without_genres: '16,10762',
    });
    pool.push({
      key: `${tvPrefix}-theme-quickwatch`,
      title: 'In a Bit of a Hurry? Try These 30-Minute Hits',
      fetchUrl: quickUrl,
    });

    const bustersUrl = REQUESTS._build(`${REQUESTS.fetchTrendingTV.split('/trending')[0]}/discover/tv`, {
      sort_by: 'popularity.desc',
      with_genres: '35',
      with_keywords: '210605', // workplace comedy
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
      title: 'US Action & Adventure Series',
      fetchUrl: usDramaUrl,
    });

    const actionNewUrl = buildScopedQuery('tv', {
      sort_by: 'popularity.desc',
      'first_air_date.gte': `${new Date().getFullYear() - 2}-01-01`,
    });
    pool.push({
      key: `${tvPrefix}-theme-action-new`,
      title: 'New Action & Adventure Series',
      fetchUrl: actionNewUrl,
    });

    pool.push({
      key: `${tvPrefix}-theme-action-prestige`,
      title: 'Critically Acclaimed Action Series',
      fetchUrl: buildScopedQuery('tv', { sort_by: 'vote_average.desc', 'vote_count.gte': 300 }),
    });
  }

  // Drama (18)
  if (selectedGenreId === 18) {
    const d = `${REQUESTS.fetchTrendingTV.split('/trending')[0]}/discover/tv`;
    pool.push({
      key: `${tvPrefix}-theme-prestige-drama`,
      title: 'Prestige Drama Series',
      fetchUrl: REQUESTS._build(d, { sort_by: 'vote_average.desc', with_genres: '18', 'vote_count.gte': 500 }),
    });
    pool.push({
      key: `${tvPrefix}-theme-british-drama`,
      title: 'British Drama Series',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '18', with_origin_country: 'GB' }),
    });
    pool.push({
      key: `${tvPrefix}-theme-us-drama`,
      title: 'Award-Winning US Drama',
      fetchUrl: REQUESTS._build(d, { sort_by: 'vote_average.desc', with_genres: '18', with_origin_country: 'US', 'vote_count.gte': 300 }),
    });
    pool.push({
      key: `${tvPrefix}-theme-limited-drama`,
      title: 'Acclaimed Limited Series',
      fetchUrl: REQUESTS._build(d, { sort_by: 'vote_average.desc', with_genres: '18', with_type: '2', 'vote_count.gte': 100 }),
    });
    pool.push({
      key: `${tvPrefix}-theme-drama-new`,
      title: 'New Dramas With Something to Say',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '18', 'first_air_date.gte': `${new Date().getFullYear() - 1}-01-01` }),
    });
  }

  // Crime (80)
  if (selectedGenreId === 80) {
    const d = `${REQUESTS.fetchTrendingTV.split('/trending')[0]}/discover/tv`;
    pool.push({
      key: `${tvPrefix}-theme-british-crime`,
      title: 'British Crime Dramas',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '80', with_origin_country: 'GB' }),
    });
    pool.push({
      key: `${tvPrefix}-theme-crime-prestige`,
      title: 'Critically Acclaimed Crime Series',
      fetchUrl: REQUESTS._build(d, { sort_by: 'vote_average.desc', with_genres: '80', 'vote_count.gte': 300 }),
    });
    pool.push({
      key: `${tvPrefix}-theme-crime-us`,
      title: 'US Crime & Procedural Series',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '80', with_origin_country: 'US' }),
    });
    pool.push({
      key: `${tvPrefix}-theme-nordic-noir`,
      title: 'Nordic Noir Series',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '80', with_origin_country: 'SE|DK|NO|FI' }),
    });
    pool.push({
      key: `${tvPrefix}-theme-crime-new`,
      title: 'New Crime Series',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '80', 'first_air_date.gte': `${new Date().getFullYear() - 2}-01-01` }),
    });
  }

  // Mysteries & Thrillers (9648 / 53)
  if (selectedGenreId === 9648 || selectedGenreId === 53) {
    const d = `${REQUESTS.fetchTrendingTV.split('/trending')[0]}/discover/tv`;
    pool.push({
      key: `${tvPrefix}-theme-mystery-prestige`,
      title: 'Critically Acclaimed Mysteries',
      fetchUrl: REQUESTS._build(d, { sort_by: 'vote_average.desc', with_genres: '9648', 'vote_count.gte': 200 }),
    });
    pool.push({
      key: `${tvPrefix}-theme-mystery-british`,
      title: 'British Mysteries & Whodunits',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '9648', with_origin_country: 'GB' }),
    });
    pool.push({
      key: `${tvPrefix}-theme-mystery-true-crime`,
      title: 'True Crime & Investigation Series',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '9648,80' }),
    });
    pool.push({
      key: `${tvPrefix}-theme-mystery-supernatural`,
      title: 'Supernatural Mysteries',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '9648,10765' }),
    });
    pool.push({
      key: `${tvPrefix}-theme-mystery-new`,
      title: 'New Mystery & Thriller Series',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '9648', 'first_air_date.gte': `${new Date().getFullYear() - 2}-01-01` }),
    });
  }

  // Horror (27) — TMDB TV has no genre 27, use Mystery (9648) + dark themes
  if (selectedGenreId === 27) {
    const d = `${REQUESTS.fetchTrendingTV.split('/trending')[0]}/discover/tv`;
    pool.push({
      key: `${tvPrefix}-theme-horror-dark`,
      title: 'Dark & Terrifying Series',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '9648', 'vote_count.gte': 50 }),
    });
    pool.push({
      key: `${tvPrefix}-theme-horror-supernatural`,
      title: 'Supernatural Horror Series',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '9648,10765' }),
    });
    pool.push({
      key: `${tvPrefix}-theme-horror-british`,
      title: 'British Horror & Thriller Series',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '9648', with_origin_country: 'GB' }),
    });
    pool.push({
      key: `${tvPrefix}-theme-horror-prestige`,
      title: 'Critically Acclaimed Dark Drama',
      fetchUrl: REQUESTS._build(d, { sort_by: 'vote_average.desc', with_genres: '18', 'vote_count.gte': 400 }),
    });
    pool.push({
      key: `${tvPrefix}-theme-horror-true-crime`,
      title: 'True Crime & Dark Investigation',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '9648,80' }),
    });
  }

  // Sci-Fi & Fantasy (10765 / 878 / 14)
  if (selectedGenreId === 10765 || selectedGenreId === 878 || selectedGenreId === 14) {
    const d = `${REQUESTS.fetchTrendingTV.split('/trending')[0]}/discover/tv`;
    pool.push({
      key: `${tvPrefix}-theme-scifi-prestige`,
      title: 'Prestige Sci-Fi Series',
      fetchUrl: REQUESTS._build(d, { sort_by: 'vote_average.desc', with_genres: '10765', 'vote_count.gte': 300 }),
    });
    pool.push({
      key: `${tvPrefix}-theme-scifi-new`,
      title: 'New Sci-Fi & Fantasy Series',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '10765', 'first_air_date.gte': `${new Date().getFullYear() - 2}-01-01` }),
    });
    pool.push({
      key: `${tvPrefix}-theme-fantasy-epic`,
      title: 'Epic Fantasy & Sword-and-Sorcery',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '10765,18', 'vote_count.gte': 100 }),
    });
    pool.push({
      key: `${tvPrefix}-theme-superhero`,
      title: 'Superhero & Comic Book Series',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '10765,10759' }),
    });
    pool.push({
      key: `${tvPrefix}-theme-scifi-classic`,
      title: 'Classic Sci-Fi Series',
      fetchUrl: REQUESTS._build(d, { sort_by: 'vote_count.desc', with_genres: '10765', 'first_air_date.lte': '2010-01-01', 'vote_average.gte': 7.0 }),
    });
  }

  // Documentary Series (99)
  if (selectedGenreId === 99) {
    const d = `${REQUESTS.fetchTrendingTV.split('/trending')[0]}/discover/tv`;
    pool.push({
      key: `${tvPrefix}-theme-truecrime-doc`,
      title: 'True Crime Documentaries',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '99,80' }),
    });
    pool.push({
      key: `${tvPrefix}-theme-nature-doc`,
      title: 'Nature & Wildlife Series',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '99', with_keywords: '299|241741' }),
    });
    pool.push({
      key: `${tvPrefix}-theme-history-doc`,
      title: 'History & Society Documentaries',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '99,36' }),
    });
    pool.push({
      key: `${tvPrefix}-theme-doc-acclaimed`,
      title: 'Award-Winning Documentaries',
      fetchUrl: REQUESTS._build(d, { sort_by: 'vote_average.desc', with_genres: '99', 'vote_count.gte': 100 }),
    });
    pool.push({
      key: `${tvPrefix}-theme-doc-sport`,
      title: 'Sports Documentaries & Series',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '99', with_keywords: '6075|1701' }),
    });
  }

  // Anime & Animation (16)
  if (selectedGenreId === 16) {
    const d = `${REQUESTS.fetchTrendingTV.split('/trending')[0]}/discover/tv`;
    pool.push({
      key: `${tvPrefix}-theme-anime-shonen`,
      title: 'Shonen & Action Anime',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '16,10759', with_original_language: 'ja' }),
    });
    pool.push({
      key: `${tvPrefix}-theme-anime-classic`,
      title: 'Classic Anime Series',
      fetchUrl: REQUESTS._build(d, { sort_by: 'vote_count.desc', with_genres: '16', with_original_language: 'ja', 'first_air_date.lte': '2010-01-01', 'vote_average.gte': 7.5 }),
    });
    pool.push({
      key: `${tvPrefix}-theme-anime-drama`,
      title: 'Anime Drama & Slice of Life',
      fetchUrl: REQUESTS._build(d, { sort_by: 'vote_average.desc', with_genres: '16,18', with_original_language: 'ja', 'vote_count.gte': 100 }),
    });
    pool.push({
      key: `${tvPrefix}-theme-anime-film-series`,
      title: 'Anime Films & OVA Series',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '16', without_original_language: 'en,ko,zh' }),
    });
    pool.push({
      key: `${tvPrefix}-theme-anime-new`,
      title: 'New Anime This Season',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '16', 'first_air_date.gte': `${new Date().getFullYear() - 1}-01-01` }),
    });
  }

  // Western (37) — film-focused since most westerns are movies; TV uses drama/adventure themes
  if (selectedGenreId === 37) {
    const d = `${REQUESTS.fetchTrendingTV.split('/trending')[0]}/discover/tv`;
    pool.push({
      key: `${tvPrefix}-theme-western-prestige`,
      title: 'Prestige Western Series',
      fetchUrl: REQUESTS._build(d, { sort_by: 'vote_average.desc', with_genres: '37', 'vote_count.gte': 100 }),
    });
    pool.push({
      key: `${tvPrefix}-theme-western-neo`,
      title: 'Neo-Western Crime Drama',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '37,80' }),
    });
    pool.push({
      key: `${tvPrefix}-theme-western-action`,
      title: 'Western Action & Adventure',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '37,10759' }),
    });
  }

  // War & Politics (10768) / War (10752)
  if (selectedGenreId === 10768 || selectedGenreId === 10752) {
    const d = `${REQUESTS.fetchTrendingTV.split('/trending')[0]}/discover/tv`;
    pool.push({
      key: `${tvPrefix}-theme-war-prestige`,
      title: 'Critically Acclaimed War Series',
      fetchUrl: REQUESTS._build(d, { sort_by: 'vote_average.desc', with_genres: '10768', 'vote_count.gte': 200 }),
    });
    pool.push({
      key: `${tvPrefix}-theme-war-political`,
      title: 'Political Drama Series',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '10768,18' }),
    });
    pool.push({
      key: `${tvPrefix}-theme-war-historical`,
      title: 'Historical War Drama',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '10768', 'first_air_date.lte': '2010-01-01', 'vote_count.gte': 50 }),
    });
    pool.push({
      key: `${tvPrefix}-theme-war-new`,
      title: 'New War & Political Series',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '10768', 'first_air_date.gte': `${new Date().getFullYear() - 2}-01-01` }),
    });
  }

  // History (36) — remapped to Drama (18) on TV, so use drama with historical keywords
  if (selectedGenreId === 36) {
    const d = `${REQUESTS.fetchTrendingTV.split('/trending')[0]}/discover/tv`;
    pool.push({
      key: `${tvPrefix}-theme-history-prestige`,
      title: 'Critically Acclaimed Period Drama',
      fetchUrl: REQUESTS._build(d, { sort_by: 'vote_average.desc', with_genres: '18', 'vote_count.gte': 400 }),
    });
    pool.push({
      key: `${tvPrefix}-theme-history-british`,
      title: 'British Historical Drama',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '18', with_origin_country: 'GB' }),
    });
    pool.push({
      key: `${tvPrefix}-theme-history-epic`,
      title: 'Epic Historical Series',
      fetchUrl: REQUESTS._build(d, { sort_by: 'vote_count.desc', with_genres: '18', 'first_air_date.lte': '2015-01-01', 'vote_average.gte': 7.5 }),
    });
  }

  // Reality (10764)
  if (selectedGenreId === 10764) {
    const d = `${REQUESTS.fetchTrendingTV.split('/trending')[0]}/discover/tv`;
    pool.push({
      key: `${tvPrefix}-theme-reality-competition`,
      title: 'Competition Shows',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '10764', 'vote_count.gte': 50 }),
    });
    pool.push({
      key: `${tvPrefix}-theme-reality-us`,
      title: 'US Reality Series',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '10764', with_origin_country: 'US' }),
    });
    pool.push({
      key: `${tvPrefix}-theme-reality-acclaimed`,
      title: 'Fan-Favourite Reality Shows',
      fetchUrl: REQUESTS._build(d, { sort_by: 'vote_average.desc', with_genres: '10764', 'vote_count.gte': 200 }),
    });
  }

  // Kids (10762)
  if (selectedGenreId === 10762) {
    const d = `${REQUESTS.fetchTrendingTV.split('/trending')[0]}/discover/tv`;
    pool.push({
      key: `${tvPrefix}-theme-kids-animated`,
      title: 'Kids Animation Series',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '10762,16' }),
    });
    pool.push({
      key: `${tvPrefix}-theme-kids-adventure`,
      title: 'Kids Adventure & Action',
      fetchUrl: REQUESTS._build(d, { sort_by: 'popularity.desc', with_genres: '10762,10759' }),
    });
    pool.push({
      key: `${tvPrefix}-theme-kids-family`,
      title: 'Wholesome Family Series',
      fetchUrl: REQUESTS._build(d, { sort_by: 'vote_average.desc', with_genres: '10762', 'vote_count.gte': 100 }),
    });
  }

  // Decades: rotate through 6 eras and pick 2 per 4h segment so the same eras don't repeat
  const tvDecadePool = [
    { label: 'Best of the 2000s',   gte: '2000-01-01', lte: '2009-12-31' },
    { label: '90s Nostalgia Trip',  gte: '1990-01-01', lte: '1999-12-31' },
    { label: '80s TV Classics',     gte: '1980-01-01', lte: '1989-12-31' },
    { label: '70s Retro TV',        gte: '1970-01-01', lte: '1979-12-31' },
    { label: '2010s Must-Watch',    gte: '2010-01-01', lte: '2019-12-31' },
    { label: '60s TV Classics',     gte: '1960-01-01', lte: '1969-12-31' },
  ];
  // For Romance genre on TV, filter out K-drama/anime from decade rows
  const decadeLangFilter = selectedGenreId === 10749 ? { without_original_language: 'ko,ja,zh' } : {};
  seededPick(tvDecadePool, 2, hash + 557).forEach((d, i) => {
    pool.push({
      key: `${tvPrefix}-theme-decade-${i}`,
      title: getThemedTitle(d.label, 'tv', selectedGenreName),
      fetchUrl: buildScopedQuery('tv', {
        sort_by: 'popularity.desc',
        'first_air_date.gte': d.gte,
        'first_air_date.lte': d.lte,
        'vote_count.gte': selectedGenreId ? 20 : 100,
        ...decadeLangFilter,
      }),
    });
  });

  // Theme C: 30-Minute Hits! (Fallback)
  if (selectedGenreId !== 35) {
    const quickTVGenreFallback = selectedGenreId ? selectedGenreId : '35';
    const quickUrl = REQUESTS._build(`${REQUESTS.fetchTrendingTV.split('/trending')[0]}/discover/tv`, {
      sort_by: 'popularity.desc',
      with_genres: quickTVGenreFallback || '',
      'with_runtime.lte': 35,
      'with_runtime.gte': 15,
      'vote_count.gte': selectedGenreId ? 10 : 50,
      ...(selectedGenreId !== 16 && selectedGenreId !== 10762 && { without_genres: '16,10762' }),
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
    with_keywords: '818',
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
    // Curated standard TV categories â€” seeded daily so order rotates
    const curatedCategories: SmartRow[] = [
      { key: 'tv-us-series',          title: 'US Series',                         fetchUrl: REQUESTS.fetchUSSeries },
      { key: 'tv-trending',           title: 'Your Next Watch',                   fetchUrl: REQUESTS.fetchTrendingTV },
      { key: 'tv-new',                title: 'New on P-Stream',                   fetchUrl: REQUESTS.fetchNewReleases },
      { key: 'tv-drama-binge',        title: 'Bingeworthy Drama Series',          fetchUrl: REQUESTS.fetchDramaTV },
      { key: 'tv-loved',              title: "We think you'll love these",        fetchUrl: REQUESTS.fetchLoveTheseTV },
      { key: 'tv-action-adventure',   title: 'Exciting Action & Adventure Series',fetchUrl: REQUESTS.fetchActionTV },
      { key: 'tv-boredom',            title: 'Boredom Busters',                   fetchUrl: REQUESTS.fetchBoredomBustersTV },
      { key: 'tv-gems',               title: 'Gems for You',                      fetchUrl: REQUESTS.fetchHiddenTVGems },
      { key: 'tv-us-drama',           title: 'US Drama Series',                   fetchUrl: REQUESTS.fetchByGenre('tv', 18, 'popularity.desc') + '&with_origin_country=US' },
      { key: 'tv-originals',          title: 'Only on P-Stream',                  fetchUrl: REQUESTS.fetchNetflixOriginals },
      { key: 'tv-suspense',           title: 'Suspense Drama Series',             fetchUrl: REQUESTS.fetchMysteryThrillerSeries },
      { key: 'tv-comedy',             title: 'Comedy Series',                     fetchUrl: REQUESTS.fetchComedyTV },
      { key: 'tv-supernatural',       title: 'Supernatural Soaps',                fetchUrl: REQUESTS.fetchByGenre('tv', 10765, 'popularity.desc') + '&with_genres=18' },
      { key: 'tv-crime',              title: 'Crime Drama Series',                fetchUrl: REQUESTS.fetchCrimeTV },
      { key: 'tv-us-action',          title: 'US Action & Adventure Series',      fetchUrl: REQUESTS.fetchByGenre('tv', 10759, 'popularity.desc') + '&with_origin_country=US' },
    ];
    pool.push(...curatedCategories);
  }

  // Do not shuffle if we are on the main generic TV page to respect the exact category order requested!
  if (!selectedGenreId) {
    pool.forEach(row => trackAdd(row));
  } else {
    const seededPool = seededPick(pool, pool.length, Math.abs((hash ^ SESSION_SEED) | 0));
    seededPool.forEach(row => trackAdd(row));
  }

  // Global Dynamic Fill
  const fillTitles = getPremiumFillTitles(baseGenreName, 'tv');
  const targetMin = 50;

  if (selectedGenreId) {
    for (let page = 5; manifest.length < targetMin && page < 65; page++) {
      const url = REQUESTS.fetchByGenre('tv', selectedGenreId, 'popularity.desc') + `&page=${page}`;
      const sig = makeUrlSig(url);
      if (!usedUrls.has(sig)) {
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

  // Splice personalized rows into their target positions after the fill
  personalRows
    .sort((a, b) => a.targetIndex - b.targetIndex)
    .forEach(({ row, targetIndex }) => {
      manifest.splice(Math.min(manifest.length, targetIndex), 0, row);
    });
};




