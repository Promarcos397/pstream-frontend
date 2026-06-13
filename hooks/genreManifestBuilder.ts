import {
  MICRO_GENRES, GENRES, ADJACENT_GENRES,
} from '../data/genres';
import { REQUESTS } from '../constants';
import { resolveGenreId, isTvOnlyGenreId, isMovieOnlyGenreId } from '../data/pageGenres';
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
        { key: 'martial-arts', title: 'High-Kick Action & Martial Arts', sort: 'popularity.desc', extra: '&with_keywords=3671' },
        { key: 'spy-espionage', title: 'Secret Agents & Spy Thrillers', sort: 'popularity.desc', extra: '&with_keywords=470' },
        { key: 'treasure-hunt', title: 'Treasure Hunts & Epic Quests', sort: 'popularity.desc', extra: '&with_keywords=9714' },
        { key: 'survival-disaster', title: 'Survival Against the Odds', sort: 'popularity.desc', extra: '&with_keywords=549' },
        { key: 'heist-caper', title: 'Heist Sagas & Capers', sort: 'popularity.desc', extra: '&with_keywords=10214' },
        { key: 'war-combat', title: 'War & Military Action', sort: 'popularity.desc', extra: '&with_genres=10752' },
        { key: 'underdog-champ', title: 'Inspiring Underdog Stories', sort: 'vote_average.desc', extra: '&vote_count.gte=500' },
        { key: 'car-chase', title: 'High-Speed Car Chases', sort: 'popularity.desc', extra: '&with_keywords=10034' },
        { key: 'revenge', title: 'Revenge Thrillers', sort: 'popularity.desc', extra: '&with_keywords=10224' },
        { key: 'one-man-army', title: 'One-Man Army Epics', sort: 'popularity.desc', extra: '&with_keywords=1568' },
        { key: 'dystopian-action', title: 'Dystopian & Apocalyptic Action', sort: 'popularity.desc', extra: '&with_keywords=4565' },
        { key: 'space-battles', title: 'Epic Space Battles', sort: 'popularity.desc', extra: '&with_keywords=3801' },
        { key: 'assassin', title: 'Deadly Assassins', sort: 'popularity.desc', extra: '&with_keywords=1432' },
        { key: 'sword-fight', title: 'Sword & Sandal Epics', sort: 'popularity.desc', extra: '&with_keywords=10185' },
      ];
    case '16':
      return [
        { key: 'family-animation', title: 'Family Animated Movies', sort: 'popularity.desc', extra: '&with_genres=10751' },
        { key: 'cgi-pixar', title: '3D Animated Favorites', sort: 'popularity.desc', extra: '&with_keywords=12542' },
        { key: 'fantasy-animation', title: 'Magical Fantasy Adventures', sort: 'popularity.desc', extra: '&with_genres=14' },
        { key: 'anime-cross', title: 'Epic Anime Battles', sort: 'popularity.desc', extra: '&with_keywords=210024' },
        { key: 'adventure-animation', title: 'Epic Animated Adventures', sort: 'popularity.desc', extra: '&with_genres=12' },
        { key: 'comedy-animation', title: 'Laugh-Out-Loud Animations', sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'sci-fi-animation', title: 'Futuristic Animated Sci-Fi', sort: 'popularity.desc', extra: '&with_genres=878' },
        { key: 'musical-animation', title: 'Animated Musicals', sort: 'popularity.desc', extra: '&with_genres=10402' },
        { key: 'stop-motion', title: 'Stop-Motion Masterpieces', sort: 'popularity.desc', extra: '&with_keywords=3386' },
        { key: 'animal-protagonists', title: 'Animal Adventures', sort: 'popularity.desc', extra: '&with_keywords=11400' },
        { key: 'fairy-tales', title: 'Fairy Tales & Fables', sort: 'popularity.desc', extra: '&with_keywords=3205' },
      ];
    case '16-anime':
      return [
        { key: 'shonen', title: 'Action Shonen Anime', sort: 'popularity.desc', extra: '&with_keywords=210024&with_genres=28' },
        { key: 'fantasy-anime', title: 'Isekai & Fantasy Hits', sort: 'popularity.desc', extra: '&with_keywords=210024&with_genres=14' },
        { key: 'drama-anime', title: 'Emotional Anime Series', sort: 'popularity.desc', extra: '&with_keywords=210024&with_genres=18' },
        { key: 'classic-anime', title: 'Nostalgic Classic Anime', sort: 'vote_count.desc', extra: '&with_keywords=210024&first_air_date.lte=2015-01-01' },
        { key: 'romance-anime', title: 'Romance & Slice of Life', sort: 'popularity.desc', extra: '&with_keywords=210024&with_genres=10749' },
        { key: 'horror-anime', title: 'Dark & Horror Anime', sort: 'popularity.desc', extra: '&with_keywords=210024&with_genres=27' },
      ];
    case '35':
      if (mediaType === 'movie') {
        return [
          { key: 'rom-com', title: 'Romantic Comedies', sort: 'popularity.desc', extra: '&with_genres=10749' },
          { key: 'dark-comedy', title: 'Witty Satire & Dark Comedy', sort: 'popularity.desc', extra: '&with_keywords=10224' },
          { key: 'raunchy-comedy', title: 'Silly & Raunchy Comedies', sort: 'popularity.desc', extra: '&with_keywords=9716' },
          { key: 'family-comedy', title: 'Family Comedy Night', sort: 'popularity.desc', extra: '&with_genres=10751' },
          { key: 'buddy-comedy', title: 'Buddy Comedies & Road Trips', sort: 'popularity.desc', extra: '&with_keywords=9717' },
          { key: 'mockumentary', title: 'Absurdly Funny Mockumentaries', sort: 'vote_average.desc', extra: '&vote_count.gte=200' },
          { key: 'comedy-classics', title: 'Timeless Comedy Classics', sort: 'vote_count.desc', extra: '&primary_release_date.lte=2005-01-01' },
          { key: 'action-comedy', title: 'Action-Packed Comedies', sort: 'popularity.desc', extra: '&with_genres=28' },
          { key: 'slapstick', title: 'Slapstick & Physical Comedy', sort: 'popularity.desc', extra: '&with_keywords=2700' },
          { key: 'workplace-comedy', title: 'Office Humor & Workplace Hijinks', sort: 'popularity.desc', extra: '&with_keywords=1701' },
          { key: 'stoner-comedy', title: 'Stoner Comedies', sort: 'popularity.desc', extra: '&with_keywords=2783' },
          { key: 'teen-comedy', title: 'High School & Teen Comedies', sort: 'popularity.desc', extra: '&with_keywords=2864' },
        ];
      }
      return [
        { key: 'rom-com', title: 'Romantic Comedies', sort: 'popularity.desc', extra: '&with_genres=10749' },
        { key: 'dark-comedy', title: 'Witty Satire & Dark Comedy', sort: 'popularity.desc', extra: '&with_keywords=10224' },
        { key: 'sitcoms', title: 'Workplace Sitcoms', sort: 'popularity.desc', extra: '&with_keywords=1701' },
        { key: 'family-comedy', title: 'Family Comedy Night', sort: 'popularity.desc', extra: '&with_genres=10751' },
        { key: 'sketch-comedy', title: 'Sketch & Stand-Up Shows', sort: 'popularity.desc', extra: '&with_keywords=9663' },
        { key: 'crime-comedy', title: 'Crime & Comedy', sort: 'popularity.desc', extra: '&with_genres=80' },
        { key: 'coming-of-age-comedy', title: 'Coming-of-Age Comedies', sort: 'popularity.desc', extra: '&with_keywords=4565' },
        { key: 'animated-comedy', title: 'Adult Animated Comedies', sort: 'popularity.desc', extra: '&with_genres=16' },
        { key: 'mockumentary-tv', title: 'Cringe & Mockumentary', sort: 'popularity.desc', extra: '&with_keywords=10084' },
        { key: 'sci-fi-comedy', title: 'Sci-Fi Humor', sort: 'popularity.desc', extra: '&with_genres=10765' },
        { key: 'variety-shows', title: 'Late Night Variety', sort: 'popularity.desc', extra: '&with_genres=10767' },
        { key: 'nostalgic-sitcoms', title: 'Nostalgic 90s & 2000s Sitcoms', sort: 'vote_count.desc', extra: '&first_air_date.lte=2010-01-01' },
      ];
    case '35-standup':
      return [
        { key: 'standup-hits', title: 'Stand-Up Comedy Specials', sort: 'popularity.desc', extra: '&with_keywords=stand-up' },
        { key: 'talk-shows', title: 'Late Night Chat Shows', sort: 'popularity.desc', extra: '&with_genres=10767' },
        { key: 'satire-specials', title: 'Political Satire & Comedy', sort: 'popularity.desc', extra: '&with_keywords=satire' },
        { key: 'global-comedy', title: 'Global Comedy Specials', sort: 'popularity.desc', extra: '&without_original_language=en' },
      ];
    case '80':
      return [
        { key: 'heist', title: 'Heist Sagas & Capers', sort: 'popularity.desc', extra: '&with_keywords=10214' },
        { key: 'mafia-mob', title: 'Mob Sagas & Organized Crime', sort: 'popularity.desc', extra: '&with_keywords=4737' },
        { key: 'detective-police', title: 'Cop & Detective Mysteries', sort: 'popularity.desc', extra: '&with_keywords=1701' },
        { key: 'courtroom-legal', title: 'Legal & Courtroom Dramas', sort: 'popularity.desc', extra: '&with_keywords=5691' },
        { key: 'serial-killer', title: 'Serial Killer Thrillers', sort: 'popularity.desc', extra: '&with_keywords=10224' },
        { key: 'true-crime', title: 'Grisly True Crime Sagas', sort: 'popularity.desc', extra: '&with_keywords=818' },
        { key: 'underworld', title: 'Underworld & Gang Life', sort: 'vote_average.desc', extra: '&vote_count.gte=300' },
        { key: 'cyber-crime', title: 'Cyber Crime & Hacking Thrillers', sort: 'popularity.desc', extra: '&with_keywords=180370' },
        { key: 'prison-break', title: 'Prison Escapes & Captivity', sort: 'popularity.desc', extra: '&with_keywords=378' },
        { key: 'kidnapping-ransom', title: 'High-Stakes Kidnapping', sort: 'popularity.desc', extra: '&with_keywords=1556' },
        { key: 'corrupt-cops', title: 'Corrupt Cops & Vigilantes', sort: 'popularity.desc', extra: '&with_keywords=9715' },
        { key: 'drug-cartel', title: 'Narcos & Cartel Sagas', sort: 'popularity.desc', extra: '&with_keywords=9951' },
        { key: 'bank-robbery', title: 'Bank Robbery Thrillers', sort: 'popularity.desc', extra: '&with_keywords=2157' },
      ];
    case '99-documentaries':
      return [
        { key: 'true-crime-docs', title: 'True Crime Investigations', sort: 'popularity.desc', extra: '&with_keywords=80' },
        { key: 'history-docs', title: 'History & War Docs', sort: 'popularity.desc', extra: '&with_genres=36' },
        { key: 'biography-docs', title: 'Biographies & Real Lives', sort: 'popularity.desc', extra: '&with_keywords=237054' },
        { key: 'music-docs', title: 'Music & Pop Culture Docs', sort: 'popularity.desc', extra: '&with_genres=10402' },
        { key: 'political-docs', title: 'Political & Social Docs', sort: 'popularity.desc', extra: '&with_keywords=1555' },
        { key: 'sports-docs', title: 'Sports Documentaries', sort: 'popularity.desc', extra: '&with_keywords=6075' },
        { key: 'food-travel-docs', title: 'Food, Travel & Culture', sort: 'popularity.desc', extra: '&with_keywords=9663' },
        { key: 'climate-docs', title: 'Nature & Climate Docs', sort: 'vote_average.desc', extra: '&with_keywords=3336&vote_count.gte=100' },
        { key: 'science-docs', title: 'Science & Tech Documentaries', sort: 'popularity.desc', extra: '&with_keywords=285559' },
        { key: 'art-design-docs', title: 'Art & Design', sort: 'popularity.desc', extra: '&with_keywords=163004' },
        { key: 'cult-docs', title: 'Bizarre Cults & Strange Lives', sort: 'popularity.desc', extra: '&with_keywords=156026' },
        { key: 'wildlife-docs', title: 'Wildlife & Animal Planet', sort: 'popularity.desc', extra: '&with_keywords=11400' },
        { key: 'space-docs', title: 'Space & Cosmology', sort: 'popularity.desc', extra: '&with_keywords=3801' },
      ];
    case '99-science-nature':
      return [
        { key: 'wildlife-nature', title: 'Wildlife & Nature Epics', sort: 'popularity.desc', extra: '&with_keywords=196884' },
        { key: 'space-cosmology', title: 'Space & Universe Exploration', sort: 'popularity.desc', extra: '&with_keywords=3801' },
        { key: 'science-tech', title: 'Science & Tech Discoveries', sort: 'popularity.desc', extra: '&with_keywords=285559' },
        { key: 'earth-environment', title: 'Earth & Nature Mysteries', sort: 'popularity.desc', extra: '&with_keywords=3336' },
        { key: 'human-body', title: 'Human Body & Medical Science', sort: 'popularity.desc', extra: '&with_keywords=11171' },
        { key: 'ocean-deep', title: 'Deep Sea & Ocean Wonders', sort: 'popularity.desc', extra: '&with_keywords=1721' },
      ];
    case '14':
      return [
        { key: 'epic-fantasy', title: 'Epic Fantasy Worlds', sort: 'popularity.desc', extra: '&with_keywords=1701' },
        { key: 'sword-sorcery', title: 'Swords & Sorcery', sort: 'popularity.desc', extra: '&with_keywords=10185' },
        { key: 'myth-legend', title: 'Myths & Legends', sort: 'popularity.desc', extra: '&with_keywords=4379' },
        { key: 'magic-spells', title: 'Magic & Witchcraft', sort: 'popularity.desc', extra: '&with_keywords=156026' },
        { key: 'urban-fantasy', title: 'Urban Fantasy Thrills', sort: 'popularity.desc', extra: '&with_keywords=10224' },
      ];
    case '18':
      return [
        { key: 'true-story-dramas', title: 'Dramas Based on a True Story', sort: 'popularity.desc', extra: '&with_keywords=818' },
        { key: 'coming-of-age-dramas', title: 'Coming-of-Age Journeys', sort: 'popularity.desc', extra: '&with_keywords=4565' },
        { key: 'period-costume', title: 'Period & Costume Dramas', sort: 'popularity.desc', extra: '&with_keywords=5691' },
        { key: 'romance-dramas', title: 'Romance & Heartbreak', sort: 'popularity.desc', extra: '&with_genres=10749' },
        { key: 'family-saga-dramas', title: 'Family Sagas & Generational Dramas', sort: 'vote_average.desc', extra: '&vote_count.gte=300' },
        { key: 'social-justice-dramas', title: 'Social Issues & Power Dynamics', sort: 'popularity.desc', extra: '&with_keywords=1555' },
        { key: 'grief-loss-dramas', title: 'Grief, Loss & Healing', sort: 'vote_average.desc', extra: '&vote_count.gte=200' },
        { key: 'prestige-award-dramas', title: 'Award-Winning Prestige Dramas', sort: 'vote_average.desc', extra: '&vote_count.gte=1000' },
        { key: 'courtroom-drama', title: 'Courtroom Dramas', sort: 'popularity.desc', extra: '&with_keywords=5691' },
        { key: 'medical-drama', title: 'Medical Dramas & Hospitals', sort: 'popularity.desc', extra: '&with_keywords=11171' },
        { key: 'political-drama', title: 'Political Dramas', sort: 'popularity.desc', extra: '&with_keywords=1555' },
        { key: 'sports-drama', title: 'Inspiring Sports Dramas', sort: 'popularity.desc', extra: '&with_keywords=6075' },
        { key: 'crime-drama', title: 'Gritty Crime Dramas', sort: 'popularity.desc', extra: '&with_genres=80' },
      ];
    case '10751':
    case '10762':
      return [
        { key: 'animated-kids', title: 'Animated Family Classics', sort: 'popularity.desc', extra: '&with_genres=16' },
        { key: 'live-action-kids', title: 'Live-Action Family Adventures', sort: 'popularity.desc', extra: '&with_genres=12' },
        { key: 'animal-stories', title: 'Animal & Nature Adventures', sort: 'popularity.desc', extra: '&with_keywords=3336' },
        { key: 'fantasy-magic', title: 'Magical & Fantasy Adventures', sort: 'popularity.desc', extra: '&with_genres=14' },
        { key: 'ghibli-style', title: 'Studio Ghibli & Beloved Classics', sort: 'popularity.desc', extra: '&with_keywords=12883' },
        { key: 'teen-adventure', title: 'Teen & YA Adventures', sort: 'popularity.desc', extra: '&with_keywords=1701' },
        { key: 'educational', title: 'Educational & Learning', sort: 'popularity.desc', extra: '&with_keywords=9663' },
        { key: 'toddler-friendly', title: 'For the Little Ones', sort: 'popularity.desc', extra: '&with_keywords=180547' },
        { key: 'music-singalong', title: 'Sing-Alongs & Music', sort: 'popularity.desc', extra: '&with_genres=10402' },
        { key: 'superhero-kids', title: 'Superhero Adventures', sort: 'popularity.desc', extra: '&with_keywords=9715' },
        { key: 'fairy-tales', title: 'Classic Fairy Tales & Fables', sort: 'popularity.desc', extra: '&with_keywords=3205' },
        { key: 'kids-comedy', title: 'Hilarious Kids Comedies', sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'spooky-kids', title: 'Spooky (But Not Too Scary)', sort: 'popularity.desc', extra: '&with_keywords=3133' },
        { key: 'sports-kids', title: 'Inspiring Kids Sports Stories', sort: 'popularity.desc', extra: '&with_keywords=6075' },
        { key: 'sci-fi-kids', title: 'Out of This World Sci-Fi', sort: 'popularity.desc', extra: '&with_genres=878' },
        { key: 'dinosaurs-kids', title: 'Dinosaurs & Prehistoric', sort: 'popularity.desc', extra: '&with_keywords=10185' },
      ];
    case '27':
      return [
        { key: 'slasher-horror', title: 'Slasher Favorites', sort: 'popularity.desc', extra: '&with_keywords=12339' },
        { key: 'supernatural-horror', title: 'Supernatural & Ghost Stories', sort: 'popularity.desc', extra: '&with_keywords=10185' },
        { key: 'creature-features', title: 'Creature Features & Monsters', sort: 'popularity.desc', extra: '&with_keywords=10185' },
        { key: 'psychological-horror', title: 'Psychological Horror & Mind Games', sort: 'vote_average.desc', extra: '&vote_count.gte=300' },
        { key: 'folk-horror', title: 'Folk Horror & Eerie Cults', sort: 'popularity.desc', extra: '&with_keywords=156026' },
        { key: 'body-horror', title: 'Body Horror & Gore', sort: 'vote_average.desc', extra: '&vote_count.gte=150' },
        { key: 'horror-comedy', title: 'Horror Comedies', sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'found-footage', title: 'Found Footage Horror', sort: 'popularity.desc', extra: '&with_keywords=11322' },
        { key: 'zombie-survival', title: 'Zombie Survival', sort: 'popularity.desc', extra: '&with_keywords=12377' },
        { key: 'vampire-lore', title: 'Vampire & Gothic Horror', sort: 'popularity.desc', extra: '&with_keywords=3133' },
        { key: 'witchcraft', title: 'Witches & Dark Magic', sort: 'popularity.desc', extra: '&with_keywords=156026' },
        { key: 'scifi-horror-cross', title: 'Sci-Fi Horror Crossovers', sort: 'popularity.desc', extra: '&with_genres=878' },
        { key: 'demon-possession', title: 'Demonic Possessions', sort: 'popularity.desc', extra: '&with_keywords=10185' },
      ];
    case '878':
    case '10765':
      return [
        { key: 'space-scifi', title: 'Space Travel & Exploration', sort: 'popularity.desc', extra: '&with_keywords=3801' },
        { key: 'time-travel-scifi', title: 'Time Travel & Alternate Realities', sort: 'popularity.desc', extra: '&with_keywords=4379' },
        { key: 'dystopian-scifi', title: 'Dystopian & Post-Apocalyptic', sort: 'popularity.desc', extra: '&with_keywords=4565' },
        { key: 'cyberpunk-ai', title: 'Cyberpunk & AI Sci-Fi', sort: 'popularity.desc', extra: '&with_keywords=180370' },
        { key: 'alien-contact', title: 'Alien Contact & Invasions', sort: 'popularity.desc', extra: '&with_keywords=9951' },
        { key: 'near-future', title: 'Near-Future Sci-Fi Thrillers', sort: 'vote_average.desc', extra: '&vote_count.gte=200' },
        { key: 'scifi-horror', title: 'Sci-Fi Horror Crossovers', sort: 'popularity.desc', extra: '&with_genres=27' },
        { key: 'superhero-scifi', title: 'Superhero Sci-Fi', sort: 'popularity.desc', extra: '&with_keywords=9715' },
        { key: 'robot-uprising', title: 'Robots & Androids', sort: 'popularity.desc', extra: '&with_keywords=14544' },
        { key: 'virtual-reality', title: 'Virtual Realities & Simulations', sort: 'popularity.desc', extra: '&with_keywords=10185' },
        { key: 'mind-bending', title: 'Mind-Bending Sci-Fi', sort: 'vote_average.desc', extra: '&vote_count.gte=500' },
      ];
    case '10749':
      return [
        { key: 'rom-comedy', title: 'Romantic Comedies', sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'rom-drama', title: 'Romantic Dramas', sort: 'popularity.desc', extra: '&with_genres=18' },
        { key: 'period-romance', title: 'Period Romance & Costumes', sort: 'popularity.desc', extra: '&with_keywords=5691' },
        { key: 'forbidden-rom', title: 'Forbidden Love & Passion', sort: 'popularity.desc', extra: '&with_keywords=10224' },
        { key: 'lgbtq-romance', title: 'LGBTQ+ Love Stories', sort: 'popularity.desc', extra: '&with_keywords=9003' },
        { key: 'summer-love', title: 'Summer Romance & Escapism', sort: 'popularity.desc', extra: '&with_keywords=9663' },
        { key: 'unrequited-love', title: 'Unrequited Love & Heartbreak', sort: 'vote_average.desc', extra: '&vote_count.gte=200' },
        { key: 'teen-romance', title: 'Teen Romance', sort: 'popularity.desc', extra: '&with_keywords=4565' },
        { key: 'wedding-jitters', title: 'Weddings & Engagements', sort: 'popularity.desc', extra: '&with_keywords=9716' },
        { key: 'enemies-to-lovers', title: 'Enemies to Lovers', sort: 'popularity.desc', extra: '&with_keywords=9717' },
        { key: 'workplace-romance', title: 'Office Romances', sort: 'popularity.desc', extra: '&with_keywords=1701' },
        { key: 'steamy-romance', title: 'Steamy & Sensual Romances', sort: 'popularity.desc', extra: '&with_keywords=10224' },
      ];
    case '9648':
      return [
        { key: 'detective-mystery', title: 'Cop & Detective Mysteries', sort: 'popularity.desc', extra: '&with_keywords=1701' },
        { key: 'whodunit', title: 'Whodunits & Puzzle Mysteries', sort: 'vote_average.desc', extra: '&vote_count.gte=300' },
        { key: 'supernatural-mystery', title: 'Supernatural & Sci-Fi Mysteries', sort: 'popularity.desc', extra: '&with_keywords=10185' },
        { key: 'conspiracy-thriller', title: 'Conspiracy & Hidden Truths', sort: 'popularity.desc', extra: '&with_keywords=1555' },
        { key: 'missing-persons', title: 'Disappearances & Cold Cases', sort: 'popularity.desc', extra: '&with_keywords=10224' },
        { key: 'cozy-mystery', title: 'Cozy Mysteries & Sleuths', sort: 'vote_average.desc', extra: '&vote_count.gte=100' },
        { key: 'amateur-sleuths', title: 'Amateur Sleuths', sort: 'popularity.desc', extra: '&with_keywords=2149' },
        { key: 'small-town-secrets', title: 'Small Town Secrets', sort: 'popularity.desc', extra: '&with_keywords=9715' },
        { key: 'noir-neo-noir', title: 'Noir & Neo-Noir', sort: 'popularity.desc', extra: '&with_keywords=242137' },
        { key: 'psych-mystery', title: 'Psychological Mysteries', sort: 'popularity.desc', extra: '&with_keywords=10224' },
        { key: 'classic-mysteries', title: 'Classic Whodunits', sort: 'vote_average.desc', extra: '&primary_release_date.lte=1990-01-01' },
        { key: 'british-mysteries-2', title: 'British Detectives', sort: 'popularity.desc', extra: '&with_origin_country=GB' },
        { key: 'nordic-mysteries', title: 'Chilling Nordic Mysteries', sort: 'popularity.desc', extra: '&with_origin_country=SE|NO|DK' },
        { key: 'action-mysteries', title: 'Action-Packed Mysteries', sort: 'popularity.desc', extra: '&with_genres=28' },
        { key: 'comedy-mysteries', title: 'Funny Whodunits', sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'true-crime-mysteries', title: 'True Crime Investigations', sort: 'popularity.desc', extra: '&with_keywords=818' },
      ];
    case '53':
      return [
        { key: 'psych-thriller', title: 'Psychological Thrillers', sort: 'vote_average.desc', extra: '&vote_count.gte=1000' },
        { key: 'spy-thriller', title: 'Espionage & Spy Operations', sort: 'popularity.desc', extra: '&with_keywords=470' },
        { key: 'crime-suspense', title: 'Crime & Law Suspense', sort: 'popularity.desc', extra: '&with_genres=80' },
        { key: 'home-invasion', title: 'Home Invasion & Survival', sort: 'popularity.desc', extra: '&with_keywords=549' },
        { key: 'cat-mouse', title: 'Cat & Mouse Mind Games', sort: 'vote_average.desc', extra: '&vote_count.gte=300' },
        { key: 'tech-paranoia', title: 'Tech Paranoia & Digital Dangers', sort: 'popularity.desc', extra: '&with_keywords=180370' },
        { key: 'legal-corruption', title: 'Legal Corruption & Corporate Thrillers', sort: 'popularity.desc', extra: '&with_keywords=5691' },
        { key: 'survival-thriller', title: 'Survival Thrillers', sort: 'popularity.desc', extra: '&with_keywords=12377' },
        { key: 'political-thriller', title: 'Political Thrillers', sort: 'popularity.desc', extra: '&with_keywords=1555' },
        { key: 'action-thriller', title: 'Action Thrillers', sort: 'popularity.desc', extra: '&with_genres=28' },
        { key: 'hostage-situation', title: 'Hostage Situations', sort: 'popularity.desc', extra: '&with_keywords=1556' },
      ];
    case '37':
      return [
        { key: 'outlaws-revenge', title: 'Outlaws & Revenge Sagas', sort: 'popularity.desc', extra: '&with_keywords=10224' },
        { key: 'bounty-hunters', title: 'Bounty Hunters & Gunslingers', sort: 'vote_count.desc', extra: '' },
        { key: 'frontier-life', title: 'Frontier Life & Settlers', sort: 'popularity.desc', extra: '&with_keywords=9714' },
        { key: 'revisionist-western', title: 'Revisionist & Modern Westerns', sort: 'vote_average.desc', extra: '&vote_count.gte=200' },
      ];
    case '10752':
      return [
        { key: 'military-combat-war', title: 'Military & Combat Action', sort: 'popularity.desc', extra: '&with_keywords=1706' },
        { key: 'historical-war', title: 'Historical Warfare', sort: 'popularity.desc', extra: '&with_genres=36' },
        { key: 'war-survival', title: 'Survival & Heroism', sort: 'popularity.desc', extra: '&with_keywords=549' },
        { key: 'anti-war', title: 'Thought-Provoking Anti-War Stories', sort: 'vote_average.desc', extra: '&vote_count.gte=300' },
        { key: 'cold-war', title: 'Cold War Intrigue', sort: 'popularity.desc', extra: '&with_keywords=470' },
      ];
    case '36':
      return [
        { key: 'historical-bios', title: 'Biographies & Historical Profiles', sort: 'popularity.desc', extra: '&with_keywords=237054' },
        { key: 'war-history', title: 'War & Military History', sort: 'popularity.desc', extra: '&with_genres=10752' },
        { key: 'ancient-civil', title: 'Ancient Civilizations', sort: 'popularity.desc', extra: '&with_keywords=5691' },
        { key: 'political-history', title: 'Political History & Power Games', sort: 'popularity.desc', extra: '&with_keywords=1555' },
        { key: 'royal-court', title: 'Royalty & Court Intrigue', sort: 'popularity.desc', extra: '&with_keywords=12339' },
        { key: 'civil-rights', title: 'Civil Rights & Social History', sort: 'popularity.desc', extra: '&with_keywords=1555' },
        { key: 'period-drama-history', title: 'Historical Epics & Dramas', sort: 'vote_average.desc', extra: '&vote_count.gte=500' },
        { key: 'history-docs', title: 'Historical Documentaries', sort: 'popularity.desc', extra: '&with_genres=99' },
      ];
    case '10402':
      return [
        { key: 'musicals', title: 'Musicals', sort: 'vote_count.desc', extra: '' },
        { key: 'rock-pop-sagas', title: 'Rock & Pop Music Sagas', sort: 'popularity.desc', extra: '&with_keywords=237054' },
        { key: 'concert-films', title: 'Concert Films & Performances', sort: 'popularity.desc', extra: '&with_keywords=9663' },
        { key: 'hip-hop-culture', title: 'Hip-Hop & Urban Music', sort: 'popularity.desc', extra: '&with_keywords=9715' },
      ];
    case '10767':
      return [
        { key: 'standup-hits', title: 'Stand-Up Comedy Specials', sort: 'popularity.desc', extra: '&with_keywords=stand-up' },
        { key: 'talk-shows', title: 'Late Night Chat Shows', sort: 'popularity.desc', extra: '&with_genres=10767' },
        { key: 'satire-specials', title: 'Political Satire & Comedy', sort: 'popularity.desc', extra: '&with_keywords=satire' },
        { key: 'global-comedy', title: 'Global Comedy Specials', sort: 'popularity.desc', extra: '&without_original_language=en' },
      ];
    case '10764':
      return [
        { key: 'reality-comps', title: 'Talent & Competition Shows', sort: 'vote_count.desc', extra: '' },
        { key: 'dating-reality', title: 'Dating & Relationship Shows', sort: 'popularity.desc', extra: '' },
        { key: 'survival-reality', title: 'Survival Challenges', sort: 'popularity.desc', extra: '&with_keywords=549' },
        { key: 'makeover-reality', title: 'Makeover & Transformation Shows', sort: 'popularity.desc', extra: '&with_keywords=9663' },
        { key: 'docusoap', title: 'Docusoaps & Real Lives', sort: 'vote_average.desc', extra: '&vote_count.gte=50' },
        { key: 'food-reality', title: 'Cooking & Food Competitions', sort: 'popularity.desc', extra: '&with_keywords=10168' },
        { key: 'home-real-estate', title: 'Real Estate & Home Renovation', sort: 'popularity.desc', extra: '&with_keywords=180370' },
        { key: 'travel-reality', title: 'Travel & Exploration', sort: 'popularity.desc', extra: '&with_keywords=9663' },
        { key: 'game-shows', title: 'Game Shows', sort: 'popularity.desc', extra: '&with_keywords=2157' },
      ];
    case '10768':
      return [
        { key: 'political-drama-wp', title: 'Political Dramas & Power Games', sort: 'vote_count.desc', extra: '&with_keywords=5691' },
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
      return [
        { key: 'pride-classics', title: 'Iconic Pride Classics', sort: 'vote_count.desc', extra: '&with_keywords=9003' },
        { key: 'feel-good-favs', title: 'Feel-Good LGBTQ+ Favorites', sort: 'popularity.desc', extra: '&with_keywords=9003&with_genres=35' },
        { key: 'love-out-loud', title: 'LGBTQ+ Romance & Love Stories', sort: 'popularity.desc', extra: '&with_keywords=9003&with_genres=10749' },
        { key: 'beyond-binary', title: 'Beyond the Binary: Trans & Non-Binary Stories', sort: 'popularity.desc', extra: '&with_keywords=9003' },
        { key: 'inspired-true', title: 'LGBTQ+ Stories Inspired by Real Life', sort: 'popularity.desc', extra: '&with_keywords=9003' },
        { key: 'critics-love', title: 'Critically Acclaimed LGBTQ+ Stories', sort: 'vote_average.desc', extra: '&with_keywords=9003&vote_count.gte=50' },
        { key: 'queer-horror', title: 'Queer Horror & Thrills', sort: 'popularity.desc', extra: '&with_keywords=9003&with_genres=27|53' },
        { key: 'lesbian-cinema', title: 'Sapphic Love & Dramas', sort: 'popularity.desc', extra: '&with_keywords=207317' },
        { key: 'drag-culture', title: 'Drag Queens & Ballroom Culture', sort: 'popularity.desc', extra: '&with_keywords=256183' },
        { key: 'queer-docs', title: 'Essential Queer Documentaries', sort: 'popularity.desc', extra: '&with_keywords=9003&with_genres=99' },
        { key: 'international-queer', title: 'Global LGBTQ+ Cinema', sort: 'popularity.desc', extra: '&with_keywords=9003' },
        { key: 'queer-comedy', title: 'Hilarious Queer Comedies', sort: 'popularity.desc', extra: '&with_keywords=9003&with_genres=35' },
        { key: 'queer-indie', title: 'Under-the-Radar Queer Indies', sort: 'popularity.desc', extra: '&with_keywords=9003' },
        { key: 'coming-of-age-pride', title: 'Queer Coming-of-Age', sort: 'popularity.desc', extra: '&with_keywords=9003' },
        { key: 'queer-drama', title: 'Transcendent Queer Dramas', sort: 'popularity.desc', extra: '&with_keywords=9003&with_genres=18' },
        { key: 'queer-pop-culture', title: 'Queer Pop Culture & Musicals', sort: 'popularity.desc', extra: '&with_keywords=9003&with_genres=10402' },
        { key: 'british-queer', title: 'British Queer Cinema', sort: 'popularity.desc', extra: '&with_keywords=9003' },
        { key: 'queer-action', title: 'LGBTQ+ Action', sort: 'popularity.desc', extra: '&with_keywords=9003&with_genres=28' },
        { key: 'queer-scifi', title: 'Sci-Fi & Fantasy LGBTQ+ Stories', sort: 'popularity.desc', extra: '&with_keywords=9003&with_genres=878|14' },
        { key: 'queer-history', title: 'Historical LGBTQ+ Stories', sort: 'popularity.desc', extra: '&with_keywords=9003&with_genres=36' },
        { key: 'queer-mysteries', title: 'LGBTQ+ Crime & Mysteries', sort: 'popularity.desc', extra: '&with_keywords=9003&with_genres=80|9648' },
        { key: 'queer-family', title: 'Queer Family & Relationships', sort: 'popularity.desc', extra: '&with_keywords=9003&with_genres=10751' },
        { key: 'queer-youth', title: 'LGBTQ+ Youth Stories', sort: 'popularity.desc', extra: '&with_keywords=9003' },
        { key: 'queer-shorts', title: 'Short Queer Cinema', sort: 'popularity.desc', extra: '&with_keywords=9003' },
        { key: 'queer-festival', title: 'LGBTQ+ Festival Favorites', sort: 'popularity.desc', extra: '&with_keywords=9003' },
        { key: 'queer-award', title: 'Award-Winning LGBTQ+', sort: 'popularity.desc', extra: '&with_keywords=9003' },
        { key: 'queer-reality', title: 'Queer Reality TV', sort: 'popularity.desc', extra: '&with_keywords=9003&with_genres=10764' },
        { key: 'pride-month', title: 'Celebrate Pride Month', sort: 'popularity.desc', extra: '&with_keywords=9003' },
        { key: 'queer-visionaries', title: 'Visionary Queer Storytellers', sort: 'popularity.desc', extra: '&with_keywords=9003' },
        { key: 'queer-icons', title: 'Icons of the LGBTQ+ Community', sort: 'vote_count.desc', extra: '&with_keywords=9003' }
      ];
    case '10002': // Astrology
      return [
        { key: 'zodiac-matches', title: 'Zodiac Matches', sort: 'popularity.desc', extra: '&with_keywords=185246|10168|15386' },
        { key: 'cosmic-journeys', title: 'Cosmic & Spiritual Journeys', sort: 'popularity.desc', extra: '&with_keywords=185246|10168|15386' },
        { key: 'fate-destiny', title: 'Fate & Destiny Sagas', sort: 'popularity.desc', extra: '&with_keywords=185246|10168|15386' },
        { key: 'mystic-arts', title: 'Mysticism & The Occult', sort: 'popularity.desc', extra: '&with_keywords=156026' },
        { key: 'spiritual-awakening', title: 'Spiritual Awakenings', sort: 'popularity.desc', extra: '&with_keywords=3336' },
        { key: 'tarot-magic', title: 'Tarot, Magic & Mystery', sort: 'popularity.desc', extra: '&with_keywords=10185' },
        { key: 'star-crossed', title: 'Star-Crossed Lovers', sort: 'popularity.desc', extra: '&with_genres=10749&with_keywords=185246' },
        { key: 'mercury-retrograde', title: 'Mercury in Retrograde Chaos', sort: 'popularity.desc', extra: '&with_keywords=549|10185' },
        { key: 'sun-moon', title: 'Sun & Moon Contrast', sort: 'popularity.desc', extra: '&vote_count.gte=100' },
        { key: 'destiny-lives', title: 'Destiny & Past Lives', sort: 'popularity.desc', extra: '&with_keywords=4379' },
        { key: 'cosmic-supernatural', title: 'Supernatural Cosmic Forces', sort: 'popularity.desc', extra: '&with_genres=14|10765' },
        { key: 'cosmic-horror', title: 'Cosmic Horror & Nightmares', sort: 'popularity.desc', extra: '&with_genres=27' },
        { key: 'ancient-mystics', title: 'Ancient Mystics & Sages', sort: 'popularity.desc', extra: '&with_genres=36|37' },
        { key: 'spiritual-docs', title: 'Spiritual Awakening Docs', sort: 'popularity.desc', extra: '&with_genres=99' },
        { key: 'magic-sorcery', title: 'Magic & Sorcery Realms', sort: 'popularity.desc', extra: '&with_genres=14' },
        { key: 'alien-zodiac', title: 'Alien Encounters & Zodiacs', sort: 'popularity.desc', extra: '&with_genres=878' },
        { key: 'ethereal-dream', title: 'Ethereal & Dreamy Realities', sort: 'popularity.desc', extra: '&with_keywords=10185' },
        { key: 'astronomy-space', title: 'Astronomy & The Universe', sort: 'popularity.desc', extra: '&with_keywords=3801' },
        { key: 'astrological-romance', title: 'Written in the Stars Romance', sort: 'popularity.desc', extra: '&with_genres=10749' },
        { key: 'celestial-beings', title: 'Celestial Beings & Angels', sort: 'popularity.desc', extra: '&with_genres=14|10765' },
        { key: 'zodiac-thrillers', title: 'Zodiac Thrillers', sort: 'popularity.desc', extra: '&with_genres=53' },
        { key: 'fortune-tellers', title: 'Fortune Tellers & Seers', sort: 'popularity.desc', extra: '&with_keywords=156026' },
        { key: 'new-age', title: 'New Age Discoveries', sort: 'popularity.desc', extra: '&with_genres=99' },
        { key: 'astrology-comedies', title: 'Astrology Comedies', sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'cosmic-battles', title: 'Cosmic Battles', sort: 'popularity.desc', extra: '&with_genres=28|878' },
        { key: 'moon-magic', title: 'Moon Magic & Werewolves', sort: 'popularity.desc', extra: '&with_genres=27|14' },
        { key: 'karma-revenge', title: 'Karma & Revenge', sort: 'popularity.desc', extra: '&with_genres=53|28' },
        { key: 'astral-projection', title: 'Astral Projection & Dreams', sort: 'popularity.desc', extra: '&with_keywords=10185' },
        { key: 'spiritual-healing', title: 'Spiritual Healing Journeys', sort: 'popularity.desc', extra: '&with_genres=18' },
        { key: 'astrology-docs', title: 'Astrology Documentaries', sort: 'popularity.desc', extra: '&with_genres=99' }
      ];
    case '10003': // Black Stories
      return [
        { key: 'black-directors', title: 'Black Directors & Writers', sort: 'popularity.desc', extra: '&with_keywords=237248|175510|242137|161556' },
        { key: 'black-leads', title: 'Acclaimed Black Leads', sort: 'vote_count.desc', extra: '&with_keywords=237248|175510|242137|161556' },
        { key: 'black-narratives', title: 'Powerful Black Narratives', sort: 'popularity.desc', extra: '&with_keywords=237248|175510|242137|161556' },
        { key: 'black-comedy', title: 'Black Comedy & Stand-up', sort: 'popularity.desc', extra: '&with_keywords=237248&with_genres=35' },
        { key: 'black-history', title: 'Black History & Documentaries', sort: 'popularity.desc', extra: '&with_keywords=237248&with_genres=99' },
        { key: 'black-excellence', title: 'Black Excellence in Sports & Life', sort: 'popularity.desc', extra: '&with_keywords=237248' },
        { key: 'black-romance', title: 'Black Love & Romance', sort: 'popularity.desc', extra: '&with_keywords=237248&with_genres=10749' },
        { key: 'afrofuturism', title: 'Afrofuturism & Black Sci-Fi', sort: 'popularity.desc', extra: '&with_genres=878|10765' },
        { key: 'urban-dramas', title: 'Gritty Urban Dramas', sort: 'popularity.desc', extra: '&with_genres=80|18' },
        { key: 'black-family', title: 'Black Family Sagas', sort: 'popularity.desc', extra: '&with_genres=18|10751' },
        { key: 'black-british', title: 'Black British Stories', sort: 'popularity.desc', extra: '&with_origin_country=GB' },
        { key: 'coming-of-age-black', title: 'Coming-of-Age Black Stories', sort: 'popularity.desc', extra: '&with_keywords=4565' },
        { key: 'hip-hop-soul', title: 'Hip-Hop & Soul Music Biographies', sort: 'popularity.desc', extra: '&with_genres=10402' },
        { key: 'black-horror', title: 'Black Horror & Thrillers', sort: 'popularity.desc', extra: '&with_genres=27|53' },
        { key: 'black-indie', title: 'Groundbreaking Black Indies', sort: 'popularity.desc', extra: '&vote_count.lte=1000' },
        { key: 'black-icons', title: 'Inspiring Black Icons', sort: 'vote_average.desc', extra: '&vote_count.gte=50' },
        { key: 'black-women', title: 'Black Women Storytellers', sort: 'popularity.desc', extra: '&with_keywords=237248' },
        { key: 'black-action', title: 'Black Action Heroes', sort: 'popularity.desc', extra: '&with_keywords=237248&with_genres=28' },
        { key: 'civil-rights', title: 'Civil Rights Movement', sort: 'popularity.desc', extra: '&with_keywords=1555' },
        { key: 'black-music', title: 'Black Music Icons', sort: 'popularity.desc', extra: '&with_keywords=237248&with_genres=10402' },
        { key: 'black-sci-fi', title: 'Black Voices in Sci-Fi', sort: 'popularity.desc', extra: '&with_keywords=237248&with_genres=878' },
        { key: 'black-fantasy', title: 'Black Voices in Fantasy', sort: 'popularity.desc', extra: '&with_keywords=237248&with_genres=14' },
        { key: 'black-thrillers', title: 'Black Voices in Thrillers', sort: 'popularity.desc', extra: '&with_keywords=237248&with_genres=53' },
        { key: 'black-mysteries', title: 'Black Voices in Mysteries', sort: 'popularity.desc', extra: '&with_keywords=237248&with_genres=9648' },
        { key: 'black-animation', title: 'Black Animated Stories', sort: 'popularity.desc', extra: '&with_keywords=237248&with_genres=16' },
        { key: 'black-sports', title: 'Black Sports Legends', sort: 'popularity.desc', extra: '&with_keywords=237248&with_keywords=6075' },
        { key: 'black-westerns', title: 'Black Westerns', sort: 'popularity.desc', extra: '&with_keywords=237248&with_genres=37' },
        { key: 'black-reality', title: 'Black Reality TV', sort: 'popularity.desc', extra: '&with_keywords=237248&with_genres=10764' },
        { key: 'black-talk-shows', title: 'Black Talk Shows', sort: 'popularity.desc', extra: '&with_keywords=237248&with_genres=10767' },
        { key: 'black-standup', title: 'Black Stand-Up Specials', sort: 'popularity.desc', extra: '&with_keywords=237248' }
      ];
    case '10004': // Book Adaptations
      return [
        { key: 'page-to-screen', title: 'Page-to-Screen Masterpieces', sort: 'popularity.desc', extra: '&with_keywords=818|10214' },
        { key: 'literary-adaptations', title: 'Literary Adaptations', sort: 'vote_count.desc', extra: '&with_keywords=818|10214' },
        { key: 'bestseller-hits', title: 'Bestseller Hits', sort: 'popularity.desc', extra: '&with_keywords=818|10214' },
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
        { key: 'biography-books', title: 'Biographies & Real Memoirs', sort: 'popularity.desc', extra: '&with_keywords=237054' },
        { key: 'cozy-books', title: 'Cozy Mystery Novel Adaptations', sort: 'popularity.desc', extra: '&with_keywords=818&with_genres=9648' },
        { key: 'dystopian-books', title: 'Dystopian Novels', sort: 'popularity.desc', extra: '&with_keywords=4565' },
        { key: 'horror-books', title: 'Terrifying Book Adaptations', sort: 'popularity.desc', extra: '&with_keywords=818&with_genres=27' },
        { key: 'action-books', title: 'Action-Packed Book Adaptations', sort: 'popularity.desc', extra: '&with_keywords=818&with_genres=28' },
        { key: 'comedy-books', title: 'Funny Book Adaptations', sort: 'popularity.desc', extra: '&with_keywords=818&with_genres=35' },
        { key: 'drama-books', title: 'Dramatic Book Adaptations', sort: 'popularity.desc', extra: '&with_keywords=818&with_genres=18' },
        { key: 'spy-books', title: 'Espionage Book Adaptations', sort: 'popularity.desc', extra: '&with_keywords=818&with_keywords=470' },
        { key: 'vampire-books', title: 'Vampire Book Adaptations', sort: 'popularity.desc', extra: '&with_keywords=818&with_keywords=3133' },
        { key: 'witch-books', title: 'Witches & Magic Book Adaptations', sort: 'popularity.desc', extra: '&with_keywords=818&with_keywords=156026' },
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
        { key: 'british-period-dramas', title: 'British Period & Costume Dramas', sort: 'popularity.desc', extra: '&with_origin_country=GB&with_keywords=5691|180370' },
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
        { key: 'feel-good-moods', title: 'Feel-Good Favorites', sort: 'popularity.desc', extra: '&with_keywords=9663|10224|10185' },
        { key: 'gripping-drama', title: 'Intense & Gripping Drama', sort: 'popularity.desc', extra: '&with_genres=18|53' },
        { key: 'relaxed-vibes', title: 'Chilled & Relaxed Vibes', sort: 'popularity.desc', extra: '&with_keywords=9663|10224|10185' },
        { key: 'heartwarming', title: 'Heartwarming & Uplifting', sort: 'vote_count.desc', extra: '&with_genres=10751|35' },
        { key: 'mind-bending', title: 'Mind-Bending & Surreal', sort: 'popularity.desc', extra: '&with_genres=878|9648' },
        { key: 'tearjerkers', title: 'Emotional Tearjerkers', sort: 'popularity.desc', extra: '&with_genres=18|10749' },
        { key: 'adrenaline-rush', title: 'Adrenaline Rush', sort: 'popularity.desc', extra: '&with_genres=28|53' },
        { key: 'late-night-laughs', title: 'Late-Night Laughs', sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'nostalgia-trip', title: 'Ultimate Nostalgia Trip', sort: 'vote_count.desc', extra: '&primary_release_date.lte=2000-01-01' },
        { key: 'spooky-season', title: 'Spooky & Eerie Vibes', sort: 'popularity.desc', extra: '&with_genres=27' },
        { key: 'romantic-escape', title: 'Romantic Escapism', sort: 'popularity.desc', extra: '&with_genres=10749' },
        { key: 'inspirational', title: 'Inspirational & Motivating', sort: 'vote_count.desc', extra: '&with_keywords=1555|6075' },
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
        { key: 'new-york-set', title: 'New York Set Stories', sort: 'popularity.desc', extra: '&with_origin_country=US&with_keywords=10185' },
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
        { key: 'noir-classics', title: 'Classic Film Noir', sort: 'vote_count.desc', extra: '&with_keywords=242137' },
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
        { key: 'cyberpunk-cult', title: 'Cyberpunk Cult Favorites', sort: 'popularity.desc', extra: '&with_keywords=180370' },
        { key: 'b-movie-cult', title: 'B-Movie Sci-Fi & Monsters', sort: 'popularity.desc', extra: '&with_keywords=10084' },
        { key: 'quirky-cult', title: 'Quirky Indie Cults', sort: 'popularity.desc', extra: '' },
        { key: 'anime-cult', title: 'Anime Cult Hits', sort: 'popularity.desc', extra: '&with_genres=16' },
        { key: 'surreal-cult', title: 'Surreal & Absurdist Cinema', sort: 'popularity.desc', extra: '&with_keywords=10185' },
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
        { key: 'mumblecore', title: 'Mumblecore & Realism', sort: 'popularity.desc', extra: '&with_keywords=10185' },
        { key: 'sundance-hits', title: 'Acclaimed Sundance Hits', sort: 'vote_count.desc', extra: '' },
        { key: 'a24-style-movies', title: 'A24-Style Indie Favorites', sort: 'popularity.desc', extra: '' },
        { key: 'micro-budget', title: 'Micro-Budget Masterpieces', sort: 'popularity.desc', extra: '' },
        { key: 'indie-noir', title: 'Independent Noir & Crime', sort: 'popularity.desc', extra: '&with_genres=80|53' },
        { key: 'queer-indie', title: 'Queer Indie Cinema', sort: 'popularity.desc', extra: '&with_keywords=9003' },
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
        { key: 'indie-road-trips', title: 'Independent Road Trips', sort: 'popularity.desc', extra: '&with_keywords=9717' },
        { key: 'indie-lgbtq', title: 'Independent LGBTQ+', sort: 'popularity.desc', extra: '&with_keywords=9003' },
        { key: 'indie-biographies', title: 'Independent Biographies', sort: 'popularity.desc', extra: '&with_keywords=237054' },
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
        { key: 'lgbtq-shorts', title: 'LGBTQ+ Short Films', sort: 'popularity.desc', extra: '&with_keywords=9003' },
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
        { key: 'docu-sports', title: 'Sports Docuseries & Profiles', sort: 'popularity.desc', extra: '&with_genres=99' },
        { key: 'high-stakes-games', title: 'High-Stakes Competitions', sort: 'popularity.desc', extra: '' },
        { key: 'underdog-sports', title: 'Underdog Triumphs', sort: 'popularity.desc', extra: '&with_keywords=549|4379' },
        { key: 'boxing-martial-arts', title: 'Boxing & Martial Arts', sort: 'popularity.desc', extra: '&with_keywords=3671|378|4344' },
        { key: 'auto-racing', title: 'Auto Racing & Motorsport', sort: 'popularity.desc', extra: '&with_keywords=10034|11400' },
        { key: 'soccer-football', title: 'Soccer & Football Focus', sort: 'popularity.desc', extra: '&with_keywords=6075|11062' },
        { key: 'basketball', title: 'Basketball & Hoop Dreams', sort: 'popularity.desc', extra: '&with_keywords=6075' },
        { key: 'olympics', title: 'Olympic Triumphs & Legends', sort: 'popularity.desc', extra: '&with_keywords=4379' },
        { key: 'extreme-sports', title: 'Extreme Sports & Surfing', sort: 'popularity.desc', extra: '&with_keywords=11400' },
        { key: 'american-football', title: 'Gridiron & American Football', sort: 'popularity.desc', extra: '&with_origin_country=US' },
        { key: 'sports-comedies', title: 'Sports Comedies', sort: 'popularity.desc', extra: '&with_genres=35' },
        { key: 'youth-sports', title: 'High School & College Sports', sort: 'popularity.desc', extra: '&with_keywords=2864' },
        { key: 'golf-tennis', title: 'Golf & Tennis Showdowns', sort: 'vote_count.desc', extra: '' },
        { key: 'winter-sports', title: 'Ice Hockey & Winter Sports', sort: 'vote_count.desc', extra: '' },
        { key: 'sports-biographies', title: 'Sports Biographies & Memoirs', sort: 'popularity.desc', extra: '&with_keywords=237054' },
        { key: 'women-sports', title: 'Inspirational Women in Sports', sort: 'popularity.desc', extra: '' },
        { key: 'sports-action', title: 'Sports Action', sort: 'popularity.desc', extra: '&with_genres=28' },
        { key: 'sports-romance', title: 'Sports Romance', sort: 'popularity.desc', extra: '&with_genres=10749' },
        { key: 'sports-animation', title: 'Sports Animation', sort: 'popularity.desc', extra: '&with_genres=16' },
        { key: 'sports-family', title: 'Family Sports Films', sort: 'popularity.desc', extra: '&with_genres=10751' },
        { key: 'sports-history', title: 'Sports History', sort: 'popularity.desc', extra: '&with_genres=36' },
        { key: 'sports-thrillers', title: 'Sports Thrillers', sort: 'popularity.desc', extra: '&with_genres=53' },
        { key: 'sports-mysteries', title: 'Sports Mysteries', sort: 'popularity.desc', extra: '&with_genres=9648' },
        { key: 'sports-crime', title: 'Sports Crime', sort: 'popularity.desc', extra: '&with_genres=80' },
        { key: 'sports-scifi', title: 'Sci-Fi Sports', sort: 'popularity.desc', extra: '&with_genres=878' },
        { key: 'sports-fantasy', title: 'Fantasy Sports', sort: 'popularity.desc', extra: '&with_genres=14' },
        { key: 'sports-westerns', title: 'Western Sports', sort: 'popularity.desc', extra: '&with_genres=37' },
        { key: 'sports-war', title: 'War & Sports', sort: 'popularity.desc', extra: '&with_genres=10752' },
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
        { key: 'college-life', title: 'College & University Life', sort: 'popularity.desc', extra: '&with_keywords=1701|2864' },
        { key: 'teen-horror', title: 'Teen Slashers & Horror', sort: 'popularity.desc', extra: '&with_genres=27' },
        { key: 'supernatural-teen', title: 'Supernatural Teen Sagas', sort: 'popularity.desc', extra: '&with_keywords=10185' },
        { key: 'teen-rebels', title: 'Rebel Teenagers & Outcasts', sort: 'popularity.desc', extra: '&with_genres=18' },
        { key: 'teen-musicals', title: 'Teen Musical & Drama Series', sort: 'popularity.desc', extra: '&with_genres=10402' },
        { key: 'teen-drama-friends', title: 'Best Friends & Teen Drama', sort: 'popularity.desc', extra: '&with_keywords=1701' },
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
  const quickUrl = buildScopedQuery('tv', {
    sort_by: 'popularity.desc',
    'with_runtime.lte': 35,
    'with_runtime.gte': 15,
    'vote_count.gte': selectedGenreId ? 5 : 30,
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
    // Unfiltered home: rich mix of curated categories — seeded daily so order rotates
    const standardCategories: SmartRow[] = [
      { key: 'home-us-series',          title: 'US Series',                         fetchUrl: REQUESTS.fetchUSSeries },
      { key: 'home-trending',           title: 'Your Next Watch',                   fetchUrl: REQUESTS.fetchTrending },
      { key: 'home-new',                title: 'New on P-Stream',                   fetchUrl: REQUESTS.fetchNewReleases },
      { key: 'home-drama-binge',        title: 'Bingeworthy Drama Series',          fetchUrl: REQUESTS.fetchDramaTV },
      { key: 'home-loved',              title: "We think you'll love these",        fetchUrl: REQUESTS.fetchLoveTheseTV },
      { key: 'home-action-adventure',   title: 'Exciting Action & Adventure',       fetchUrl: REQUESTS.fetchActionTV },
      { key: 'home-boredom',            title: 'Boredom Busters',                   fetchUrl: REQUESTS.fetchBoredomBustersMovies },
      { key: 'home-gems',               title: 'Gems for You',                      fetchUrl: REQUESTS.fetchHiddenGems },
      { key: 'home-us-drama',           title: 'US Drama Series',                   fetchUrl: REQUESTS.fetchByGenre('tv', 18, 'popularity.desc') + '&with_origin_country=US' },
      { key: 'home-originals',          title: 'Only on P-Stream',                  fetchUrl: REQUESTS.fetchNetflixOriginals },
      { key: 'home-suspense',           title: 'Suspense Drama Series',             fetchUrl: REQUESTS.fetchMysteryThrillerSeries },
      { key: 'home-comedy',             title: 'Comedy Series',                     fetchUrl: REQUESTS.fetchComedyTV },
      { key: 'home-supernatural',       title: 'Supernatural Soaps',                fetchUrl: REQUESTS.fetchByGenre('tv', 10765, 'popularity.desc') + '&with_genres=18' },
      { key: 'home-crime',              title: 'Crime Drama Series',                fetchUrl: REQUESTS.fetchCrimeTV },
      { key: 'home-us-action',          title: 'US Action & Adventure Series',      fetchUrl: REQUESTS.fetchByGenre('tv', 10759, 'popularity.desc') + '&with_origin_country=US' },
    ];
    pool.push(...standardCategories);
  }

  // Do not shuffle if we are on the main generic home page to respect the exact category order requested!
  if (!selectedGenreId) {
    pool.forEach(row => trackAdd(row));
  } else {
    // Interleave and shuffle the entire dynamic pool based on daily seed to keep page alive!
    const seededPool = seededPick(pool, pool.length, hash);
    seededPool.forEach(row => trackAdd(row));
  }

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
    // Curated standard film categories — seeded daily so order rotates
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
      { key: 'movie-adaptations',   title: 'Book Adaptations',                              fetchUrl: REQUESTS.fetchByGenre('movie', 18, 'popularity.desc') + '&with_keywords=818|10214' },
    ];
    pool.push(...curatedCategories);
  }

  // Interleave and shuffle the entire dynamic pool based on daily seed to keep page alive!
  const seededPool = seededPick(pool, pool.length, hash);
  seededPool.forEach(row => trackAdd(row));

  // Global Dynamic Fill
  const fillTitles = getPremiumFillTitles(baseGenreName, 'movie');

  if (selectedGenreId) {
    for (let page = 5; manifest.length < 50 && page < 65; page++) {
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
      'with_runtime.lte': 35,
      'with_runtime.gte': 15,
      'vote_count.gte': 30,
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
      'with_runtime.lte': 35,
      'with_runtime.gte': 15,
      'vote_count.gte': selectedGenreId ? 10 : 50,
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
    // Curated standard TV categories — seeded daily so order rotates
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
    const seededPool = seededPick(pool, pool.length, hash);
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
