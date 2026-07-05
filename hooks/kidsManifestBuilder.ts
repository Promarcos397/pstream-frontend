import { REQUESTS } from '../constants';
import type { SmartRow } from './useDynamicManifest';
import type { PageGenre } from '../data/pageGenres';
import type { Movie } from '../types';
import { pickPersonalSeeds } from './genreManifestBuilder';

/**
 * Kids-mode catalog — Netflix Kids quality, TMDB-sourced.
 *
 * The standard manifests are built from adult-leaning genre pools whose rows
 * the kids content filter empties out. Netflix solves this with a dedicated,
 * hand-curated kids catalog; this module is our equivalent. Every id below
 * (network, company, keyword) was validated against the live TMDB API before
 * being wired in — each query returns real, recognisable kids content
 * (validated 2026-07-04: e.g. princess+family → Frozen/Tangled/Mulan,
 * Nickelodeon → PAW Patrol/Avatar/iCarly, girls-lead TV → Miraculous/Winx).
 *
 * Content is sourced through FOUR independent methods, like Netflix does:
 *   1. Networks   — the actual kids broadcasters (Nickelodeon, Disney, CN…)
 *   2. Studios    — the beloved film houses (Pixar, Ghibli, DreamWorks…)
 *   3. Keywords   — curated themes (princesses, dinosaurs, LEGO, spooky…)
 *   4. Genres     — TMDB's Family/Kids/Animation axes with quality floors
 * The client-side kids filter (services/tmdb.ts) stays on as a safety net.
 */

/* ── Validated TMDB ids ──────────────────────────────────────────────────── */

const NW = {
  NICKELODEON: 13,      // PAW Patrol, Avatar, iCarly, Henry Danger
  DISNEY_CHANNEL: 54,   // Phineas & Ferb, Gravity Falls, PJ Masks
  CARTOON_NETWORK: 56,  // Adventure Time, Teen Titans Go!, Regular Show
  NICK_JR: 35,          // Bubble Guppies, Team Umizoomi, LazyTown
  DISNEY_XD: 44,        // DuckTales, Star vs. the Forces of Evil, Lab Rats
  NETFLIX: 213,         // + genre 10762 → Sesame Street, LEGO Ninjago, Power Rangers
};

const CO = {
  PIXAR: 3,             // Toy Story, Coco, Inside Out
  DISNEY: 2,            // Moana, The Lion King, Cinderella
  DREAMWORKS: 521,      // Shrek, HTTYD, Kung Fu Panda, The Wild Robot
  ILLUMINATION: 6704,   // Minions, Despicable Me, Super Mario Bros.
  GHIBLI: 10342,        // Totoro, Spirited Away, Kiki's Delivery Service
  AARDMAN: 297,         // Wallace & Gromit, Shaun the Sheep, Chicken Run
  LAIKA: 11537,         // Coraline, Kubo, ParaNorman
  SONY_ANIMATION: 2251, // Spider-Verse, Hotel Transylvania, Cloudy with Meatballs
  BLUE_SKY: 9383,       // Ice Age, Rio, Ferdinand
  NICKELODEON_MOVIES: 2348, // SpongeBob movies, TMNT, Dora
};

const KW = {
  PRINCESS: '7376',
  DINOSAUR: '12616',
  MERMAID: '5938',
  DRAGON: '12554',
  UNICORN: '163227',
  PIRATE: '12988',
  ROBOT: '14544',
  LEGO: '210090',
  VIDEO_GAME: '282',
  FAIRY_TALE: '3205',
  SUMMER_CAMP: '5767',
  SING_ALONG: '161153',
  SPOOKY: '3335|3358|1299',            // halloween | haunted house | monster
  FRIENDSHIP: '6054',
  FEMALE_LEAD: '11322',                // Miraculous, Winx, Barbie Mysteries
  TOYS: '350918|10542',                // toys | based on toy
  VEHICLES: '13008|830|191279',        // train | car race | race car
  SUPERHERO: '9715|191219',            // superhero | superhero kids
  CHILDRENS_BOOK: '15101',             // based on children's book
  TALKING_ANIMALS: '269710|267848|377854', // anthropomorphic/talking animals
  SPACE: '9882|305|252634',            // space themes → Mario Galaxy, Treasure Planet
  MAGIC: '2343|12554',                 // magic | dragon
  UNDER_THE_SEA: '14785|270|5938',     // underwater | ocean | mermaid
  SPORTS: '6075',                      // Cars, Turbo, Space Jam
  SCHOOL: '10873',
  ALIEN: '9951',
  ANIME: '210024',
  NATURE_DOC: '221355',
};

/* ── Query helpers ───────────────────────────────────────────────────────── */

// Movie rows get a hard US certification ceiling (G/PG). Studio rows skip it —
// those brands are inherently kid-safe and many international titles (Ghibli)
// lack a US certification and would vanish behind the filter.
const CERT_PG = '&certification_country=US&certification.lte=PG';

const movie = (extra: string, sort = 'popularity.desc') =>
  REQUESTS.fetchByGenre('movie', 10751, sort, extra + CERT_PG);
const movieNoCert = (extra: string, sort = 'popularity.desc') =>
  REQUESTS.fetchByGenre('movie', 10751, sort, extra);
const anim = (extra: string, sort = 'popularity.desc') =>
  REQUESTS.fetchByGenre('movie', 16, sort, extra + CERT_PG);
const studio = (companyIds: string | number, sort = 'popularity.desc') =>
  REQUESTS.fetchByGenre('movie', 10751, sort, `&with_companies=${companyIds}`);
const kidsTv = (extra = '', sort = 'popularity.desc') =>
  REQUESTS.fetchByGenre('tv', 10762, sort, extra);
const network = (netIds: string | number, extra = '', sort = 'popularity.desc') =>
  REQUESTS.fetchByGenre('tv', 10762, sort, `&with_networks=${netIds}${extra}`);
// Broad network row — anchored on Animation instead of Kids(10762) so flagship
// shows tagged only Animation/Action-Adventure (Avatar, DuckTales, Adventure
// Time) still appear; the client kids filter screens the remainder.
const networkAll = (netIds: string | number, sort = 'popularity.desc') =>
  REQUESTS.fetchByGenre('tv', 16, sort, `&with_networks=${netIds}`);

/* ── Home rows — the flagship Kids experience ────────────────────────────── */

const homeRows = (year: number): SmartRow[] => [
  // Netflix Kids' own row names, backed by equivalent queries
  { key: 'kids-funny',        title: 'Funny',                       fetchUrl: kidsTv('&with_genres=35') },
  { key: 'kids-good-vibes',   title: 'Good Vibes Only',             fetchUrl: movie(`&with_keywords=${KW.FRIENDSHIP}`) },
  { key: 'kids-originals',    title: 'Streaming Originals',         fetchUrl: network(NW.NETFLIX) },
  { key: 'kids-family-night', title: 'Watch with the Family',       fetchUrl: movieNoCert('') },
  { key: 'kids-besties',      title: 'Besties and Buddies',         fetchUrl: movie(`&with_keywords=${KW.TALKING_ANIMALS}`) },

  // Studio rows — the brands kids actually recognise
  { key: 'kids-pixar',        title: 'Pixar Magic',                 fetchUrl: studio(CO.PIXAR) },
  { key: 'kids-dreamworks',   title: 'DreamWorks Adventures',       fetchUrl: studio(CO.DREAMWORKS) },
  { key: 'kids-illumination', title: 'Minions & More',              fetchUrl: studio(CO.ILLUMINATION) },
  { key: 'kids-ghibli',       title: 'Studio Ghibli Wonders',       fetchUrl: REQUESTS.fetchByGenre('movie', 16, 'popularity.desc', `&with_companies=${CO.GHIBLI}`) },
  { key: 'kids-disney',       title: 'Disney Classics & New Favourites', fetchUrl: studio(CO.DISNEY) },
  { key: 'kids-claymation',   title: 'Handmade Worlds: Aardman & LAIKA', fetchUrl: REQUESTS.fetchByGenre('movie', 16, 'popularity.desc', `&with_companies=${CO.AARDMAN}|${CO.LAIKA}`) },
  { key: 'kids-anim-hits',    title: 'Animated Blockbusters',       fetchUrl: REQUESTS.fetchByGenre('movie', 16, 'popularity.desc', `&with_companies=${CO.SONY_ANIMATION}|${CO.BLUE_SKY}`) },

  // Network rows — the kids TV powerhouses
  { key: 'kids-nick',         title: 'Nickelodeon Favourites',      fetchUrl: networkAll(NW.NICKELODEON) },
  { key: 'kids-disney-ch',    title: 'Disney Channel Hits',         fetchUrl: networkAll(NW.DISNEY_CHANNEL) },
  { key: 'kids-cartoon-nw',   title: 'Cartoon Network Classics',    fetchUrl: networkAll(NW.CARTOON_NETWORK) },
  { key: 'kids-little-ones',  title: 'For Little Ones',             fetchUrl: network(NW.NICK_JR) },

  // Theme rows — curated keyword worlds
  { key: 'kids-princess',     title: 'Princess Tales',              fetchUrl: movieNoCert(`&with_keywords=${KW.PRINCESS}`) },
  { key: 'kids-dinos',        title: 'Dinosaur World',              fetchUrl: movieNoCert(`&with_keywords=${KW.DINOSAUR}`) },
  { key: 'kids-superheroes',  title: 'Superhero Time',              fetchUrl: movieNoCert(`&with_keywords=${KW.SUPERHERO}`) },
  { key: 'kids-lego',         title: 'Everything LEGO',             fetchUrl: REQUESTS.fetchByGenre('movie', 16, 'popularity.desc', `&with_keywords=${KW.LEGO}`) },
  { key: 'kids-girls-lead',   title: 'Girls Take the Lead',         fetchUrl: kidsTv(`&with_keywords=${KW.FEMALE_LEAD}`) },
  { key: 'kids-sea',          title: 'Under the Sea',               fetchUrl: movie(`&with_keywords=${KW.UNDER_THE_SEA}`) },
  { key: 'kids-space',        title: 'Space Adventures',            fetchUrl: movieNoCert(`&with_keywords=${KW.SPACE}`) },
  { key: 'kids-vehicles',     title: 'Cars, Trucks & Trains',       fetchUrl: kidsTv(`&with_keywords=${KW.VEHICLES}`) },
  { key: 'kids-dragons',      title: 'Dragons & Magic',             fetchUrl: movieNoCert(`&with_keywords=${KW.MAGIC}`) },
  { key: 'kids-spooky',       title: 'Spooky (But Not Too Scary)',  fetchUrl: movieNoCert(`&with_keywords=${KW.SPOOKY}`) },
  { key: 'kids-books',        title: 'From Beloved Books',          fetchUrl: movieNoCert(`&with_keywords=${KW.CHILDRENS_BOOK}`) },
  { key: 'kids-animals',      title: 'Animal Time',                 fetchUrl: kidsTv(`&with_keywords=${KW.TALKING_ANIMALS}`) },
  { key: 'kids-sports',       title: 'Sports Stars',                fetchUrl: movieNoCert(`&with_keywords=${KW.SPORTS}`) },
  { key: 'kids-sing',         title: 'Singing & Dancing',           fetchUrl: REQUESTS.fetchByGenre('movie', 10402, 'popularity.desc', CERT_PG) },

  // Freshness + quality anchors
  { key: 'kids-new-films',    title: `New Family Films of ${year}`, fetchUrl: movieNoCert(`&primary_release_date.gte=${year - 1}-01-01`) },
  { key: 'kids-new-series',   title: 'New Kids Series',             fetchUrl: kidsTv(`&first_air_date.gte=${year - 1}-01-01`) },
  { key: 'kids-top-films',    title: 'Critically Loved Family Films', fetchUrl: movieNoCert('&vote_count.gte=300', 'vote_average.desc') },
  { key: 'kids-top-series',   title: 'Highest-Rated Kids Shows',    fetchUrl: kidsTv('&vote_count.gte=100', 'vote_average.desc') },
];

/* ── Films page rows ─────────────────────────────────────────────────────── */

const movieRows = (year: number): SmartRow[] => [
  { key: 'kids-family-favs',  title: 'Family Favourites',           fetchUrl: movieNoCert('') },
  { key: 'kids-pixar',        title: 'Pixar Magic',                 fetchUrl: studio(CO.PIXAR) },
  { key: 'kids-animated',     title: 'Animated Adventures',         fetchUrl: anim('') },
  { key: 'kids-dreamworks',   title: 'DreamWorks Adventures',       fetchUrl: studio(CO.DREAMWORKS) },
  { key: 'kids-princess',     title: 'Princess Tales',              fetchUrl: movieNoCert(`&with_keywords=${KW.PRINCESS}`) },
  { key: 'kids-illumination', title: 'Minions & More',              fetchUrl: studio(CO.ILLUMINATION) },
  { key: 'kids-adventure',    title: 'Big Adventures',              fetchUrl: REQUESTS.fetchByGenre('movie', 12, 'popularity.desc', CERT_PG) },
  { key: 'kids-comedies',     title: 'Laugh-Out-Loud Comedies',     fetchUrl: REQUESTS.fetchByGenre('movie', 35, 'popularity.desc', CERT_PG) },
  { key: 'kids-ghibli',       title: 'Studio Ghibli Wonders',       fetchUrl: REQUESTS.fetchByGenre('movie', 16, 'popularity.desc', `&with_companies=${CO.GHIBLI}`) },
  { key: 'kids-disney',       title: 'Disney Classics & New Favourites', fetchUrl: studio(CO.DISNEY) },
  { key: 'kids-superheroes',  title: 'Superhero Time',              fetchUrl: movieNoCert(`&with_keywords=${KW.SUPERHERO}`) },
  { key: 'kids-dinos',        title: 'Dinosaur World',              fetchUrl: movieNoCert(`&with_keywords=${KW.DINOSAUR}`) },
  { key: 'kids-sea',          title: 'Under the Sea',               fetchUrl: movie(`&with_keywords=${KW.UNDER_THE_SEA}`) },
  { key: 'kids-space',        title: 'Space Adventures',            fetchUrl: movieNoCert(`&with_keywords=${KW.SPACE}`) },
  { key: 'kids-dragons',      title: 'Dragons & Magic',             fetchUrl: movieNoCert(`&with_keywords=${KW.MAGIC}`) },
  { key: 'kids-claymation',   title: 'Handmade Worlds: Aardman & LAIKA', fetchUrl: REQUESTS.fetchByGenre('movie', 16, 'popularity.desc', `&with_companies=${CO.AARDMAN}|${CO.LAIKA}`) },
  { key: 'kids-spooky',       title: 'Spooky (But Not Too Scary)',  fetchUrl: movieNoCert(`&with_keywords=${KW.SPOOKY}`) },
  { key: 'kids-books',        title: 'From Beloved Books',          fetchUrl: movieNoCert(`&with_keywords=${KW.CHILDRENS_BOOK}`) },
  { key: 'kids-sing',         title: 'Singing & Dancing',           fetchUrl: REQUESTS.fetchByGenre('movie', 10402, 'popularity.desc', CERT_PG) },
  { key: 'kids-sports',       title: 'Sports Stars',                fetchUrl: movieNoCert(`&with_keywords=${KW.SPORTS}`) },
  { key: 'kids-nick-movies',  title: 'Nickelodeon on the Big Screen', fetchUrl: REQUESTS.fetchByGenre('movie', 10751, 'popularity.desc', `&with_companies=${CO.NICKELODEON_MOVIES}`) },
  { key: 'kids-new-films',    title: `New Family Films of ${year}`, fetchUrl: movieNoCert(`&primary_release_date.gte=${year - 1}-01-01`) },
  { key: 'kids-top-films',    title: 'Critically Loved Family Films', fetchUrl: movieNoCert('&vote_count.gte=300', 'vote_average.desc') },
  { key: 'kids-classics',     title: 'Timeless Family Classics',    fetchUrl: movieNoCert(`&primary_release_date.lte=${year - 15}-12-31`, 'vote_count.desc') },
];

/* ── Series page rows ────────────────────────────────────────────────────── */

const tvRows = (year: number): SmartRow[] => [
  { key: 'kids-series',       title: 'Kids Series',                 fetchUrl: kidsTv('') },
  { key: 'kids-nick',         title: 'Nickelodeon Favourites',      fetchUrl: networkAll(NW.NICKELODEON) },
  { key: 'kids-funny',        title: 'Funny',                       fetchUrl: kidsTv('&with_genres=35') },
  { key: 'kids-disney-ch',    title: 'Disney Channel Hits',         fetchUrl: networkAll(NW.DISNEY_CHANNEL) },
  { key: 'kids-animated-tv',  title: 'Animated Series',             fetchUrl: kidsTv('&with_genres=16') },
  { key: 'kids-cartoon-nw',   title: 'Cartoon Network Classics',    fetchUrl: networkAll(NW.CARTOON_NETWORK) },
  { key: 'kids-girls-lead',   title: 'Girls Take the Lead',         fetchUrl: kidsTv(`&with_keywords=${KW.FEMALE_LEAD}`) },
  { key: 'kids-disney-xd',    title: 'Disney XD Action',            fetchUrl: networkAll(NW.DISNEY_XD) },
  { key: 'kids-little-ones',  title: 'For Little Ones',             fetchUrl: network(NW.NICK_JR) },
  { key: 'kids-originals',    title: 'Streaming Originals',         fetchUrl: network(NW.NETFLIX) },
  { key: 'kids-adventure-tv', title: 'Action-Packed Adventures',    fetchUrl: kidsTv('&with_genres=10759') },
  { key: 'kids-animals',      title: 'Animal Time',                 fetchUrl: kidsTv(`&with_keywords=${KW.TALKING_ANIMALS}`) },
  { key: 'kids-dinos-tv',     title: 'Dinosaur World',              fetchUrl: kidsTv(`&with_keywords=${KW.DINOSAUR}`) },
  { key: 'kids-vehicles',     title: 'Cars, Trucks & Trains',       fetchUrl: kidsTv(`&with_keywords=${KW.VEHICLES}`) },
  { key: 'kids-scifi-tv',     title: 'Fantasy & Sci-Fi',            fetchUrl: kidsTv('&with_genres=10765') },
  { key: 'kids-anime',        title: 'Anime for Kids',              fetchUrl: kidsTv(`&with_keywords=${KW.ANIME}`) },
  { key: 'kids-spooky-tv',    title: 'Spooky (But Not Too Scary)',  fetchUrl: kidsTv(`&with_keywords=${KW.SPOOKY}`) },
  { key: 'kids-new-series',   title: `New Kids Series of ${year}`,  fetchUrl: kidsTv(`&first_air_date.gte=${year - 1}-01-01`) },
  { key: 'kids-top-series',   title: 'Highest-Rated Kids Shows',    fetchUrl: kidsTv('&vote_count.gte=100', 'vote_average.desc') },
];

/* ── Kids genre catalogs (Netflix Kids dropdown) ─────────────────────────── */
// Synthetic ids in the 21000+ range so they can never collide with real TMDB
// genre ids used by the adult catalogs.

export const KIDS_TV_GENRES: PageGenre[] = [
  { id: 21001, name: 'Action' },
  { id: 21002, name: 'Animal Time' },
  { id: 21003, name: 'Cars, Trucks & Trains' },
  { id: 21004, name: 'Dinosaurs' },
  { id: 21005, name: 'Fantasy' },
  { id: 21006, name: 'Feel-good' },
  { id: 21007, name: 'For Little Ones' },
  { id: 21008, name: 'Friends' },
  { id: 21009, name: 'Funny' },
  { id: 21010, name: 'Girls Take the Lead' },
  { id: 21011, name: 'Reality' },
  { id: 21012, name: 'Sci-Fi' },
  { id: 21013, name: 'Science & Nature' },
  { id: 21014, name: 'Singing & Dancing' },
  { id: 21015, name: 'Spooky Stuff' },
  { id: 21016, name: 'Watch with the Family' },
];

export const KIDS_MOVIE_GENRES: PageGenre[] = [
  { id: 21001, name: 'Action' },
  { id: 21017, name: 'Adventure' },
  { id: 21002, name: 'Animals' },
  { id: 21018, name: 'Animated' },
  { id: 21019, name: 'Documentaries' },
  { id: 21005, name: 'Fantasy' },
  { id: 21006, name: 'Feel-good' },
  { id: 21007, name: 'For Little Ones' },
  { id: 21008, name: 'Friends' },
  { id: 21009, name: 'Funny' },
  { id: 21010, name: 'Girls Take the Lead' },
  { id: 21020, name: 'Princess Tales' },
  { id: 21012, name: 'Sci-Fi' },
  { id: 21013, name: 'Science & Nature' },
  { id: 21014, name: 'Singing & Dancing' },
  { id: 21015, name: 'Spooky Stuff' },
  { id: 21016, name: 'Watch with the Family' },
];

// Per-genre query fragments. `mv` fragments ride on Family(10751) via movie()/
// movieNoCert(); `tv` fragments ride on Kids(10762) via kidsTv() — except
// where a genreOverride/networkAll is noted.
interface KidsGenreSpec {
  mv?: { extra: string; noCert?: boolean; genreOverride?: number };
  tv?: { extra: string; networkAll?: number };
}

const KIDS_GENRE_SPECS: Record<number, KidsGenreSpec> = {
  21001: { mv: { extra: `&with_keywords=${KW.SUPERHERO}`, noCert: true }, tv: { extra: '&with_genres=10759' } },
  21002: { mv: { extra: `&with_keywords=${KW.TALKING_ANIMALS}`, noCert: true }, tv: { extra: `&with_keywords=${KW.TALKING_ANIMALS}` } },
  21003: { mv: { extra: `&with_keywords=${KW.VEHICLES}`, noCert: true }, tv: { extra: `&with_keywords=${KW.VEHICLES}` } },
  21004: { mv: { extra: `&with_keywords=${KW.DINOSAUR}`, noCert: true }, tv: { extra: `&with_keywords=${KW.DINOSAUR}` } },
  21005: { mv: { extra: '&with_genres=14', noCert: true }, tv: { extra: '&with_genres=10765' } },
  21006: { mv: { extra: `&with_keywords=${KW.FRIENDSHIP}` }, tv: { extra: '&with_genres=35' } },
  21007: { mv: { extra: '', genreOverride: 16 }, tv: { extra: '', networkAll: NW.NICK_JR } },
  21008: { mv: { extra: `&with_keywords=${KW.FRIENDSHIP}|${KW.SUMMER_CAMP}|${KW.SCHOOL}`, noCert: true }, tv: { extra: `&with_keywords=${KW.FRIENDSHIP}|${KW.SCHOOL}` } },
  21009: { mv: { extra: '', genreOverride: 35 }, tv: { extra: '&with_genres=35' } },
  21010: { mv: { extra: `&with_keywords=${KW.FEMALE_LEAD}|${KW.PRINCESS}`, noCert: true }, tv: { extra: `&with_keywords=${KW.FEMALE_LEAD}` } },
  21011: { tv: { extra: '&with_genres=10764' } },
  21012: { mv: { extra: `&with_keywords=${KW.SPACE}|${KW.ROBOT}|${KW.ALIEN}`, noCert: true }, tv: { extra: '&with_genres=10765' } },
  21013: { mv: { extra: `&with_keywords=${KW.NATURE_DOC}`, genreOverride: 99 }, tv: { extra: '&with_genres=99' } },
  21014: { mv: { extra: '', genreOverride: 10402 }, tv: { extra: `&with_keywords=${KW.SING_ALONG}|${KW.ANIME}` } },
  21015: { mv: { extra: `&with_keywords=${KW.SPOOKY}`, noCert: true }, tv: { extra: `&with_keywords=${KW.SPOOKY}` } },
  21016: { mv: { extra: '', noCert: true }, tv: { extra: '' } },
  21017: { mv: { extra: '', genreOverride: 12 } },
  21018: { mv: { extra: '', genreOverride: 16 } },
  21019: { mv: { extra: `&with_keywords=${KW.NATURE_DOC}`, genreOverride: 99 } },
  21020: { mv: { extra: `&with_keywords=${KW.PRINCESS}|${KW.FAIRY_TALE}`, noCert: true } },
};

const buildGenreUrl = (
  media: 'movie' | 'tv',
  spec: KidsGenreSpec,
  sort: string,
  extra = '',
): string | null => {
  if (media === 'movie' && spec.mv) {
    const genre = spec.mv.genreOverride ?? 10751;
    // genreOverride rows (Animation/Comedy/Docs/…) keep the PG ceiling only
    // when riding the default Family genre; standalone genres self-curate.
    const cert = spec.mv.noCert || spec.mv.genreOverride ? '' : CERT_PG;
    return REQUESTS.fetchByGenre('movie', genre, sort, spec.mv.extra + extra + cert);
  }
  if (media === 'tv' && spec.tv) {
    if (spec.tv.networkAll) {
      return REQUESTS.fetchByGenre('tv', 10762, sort, `&with_networks=${spec.tv.networkAll}${extra}`);
    }
    return REQUESTS.fetchByGenre('tv', 10762, sort, spec.tv.extra + extra);
  }
  return null;
};

/** Rows for a selected kids genre on the Series/Films pages. */
const kidsGenreRows = (
  pageType: 'movie' | 'tv',
  genreId: number,
  genreName: string,
  year: number,
): SmartRow[] => {
  const spec = KIDS_GENRE_SPECS[genreId];
  if (!spec) return [];

  const media: 'movie' | 'tv' = pageType === 'movie' ? 'movie' : 'tv';
  const dateKey = media === 'movie' ? 'primary_release_date' : 'first_air_date';
  const candidates: Array<{ key: string; title: string; url: string | null }> = [
    { key: `kg-${genreId}-popular`, title: `Popular in ${genreName}`,     url: buildGenreUrl(media, spec, 'popularity.desc') },
    { key: `kg-${genreId}-top`,     title: `Top-Rated ${genreName}`,      url: buildGenreUrl(media, spec, 'vote_average.desc', '&vote_count.gte=50') },
    { key: `kg-${genreId}-new`,     title: `New in ${genreName}`,         url: buildGenreUrl(media, spec, 'popularity.desc', `&${dateKey}.gte=${year - 2}-01-01`) },
    { key: `kg-${genreId}-loved`,   title: `${genreName} Everyone Loves`, url: buildGenreUrl(media, spec, 'vote_count.desc') },
    { key: `kg-${genreId}-gems`,    title: `Hidden Gems: ${genreName}`,   url: buildGenreUrl(media, spec, 'vote_average.desc', '&vote_count.gte=10&vote_count.lte=200') },
    { key: `kg-${genreId}-classic`, title: `${genreName} Classics`,       url: buildGenreUrl(media, spec, 'vote_count.desc', `&${dateKey}.lte=${year - 10}-12-31`) },
  ];

  return candidates
    .filter((r): r is { key: string; title: string; url: string } => !!r.url)
    .map(r => ({ key: r.key, title: r.title, fetchUrl: r.url }));
};

/**
 * Hero fetch URL for kids mode. Synthetic kids-genre ids (21000+) must never
 * hit `with_genres=` directly — resolve them to their curated query instead.
 * With no genre selected, the hero pulls from the page's default kids pool.
 */
export const kidsHeroUrl = (pageType: 'movie' | 'tv', genreId?: number): string => {
  const media: 'movie' | 'tv' = pageType === 'movie' ? 'movie' : 'tv';
  if (genreId) {
    const spec = KIDS_GENRE_SPECS[genreId];
    if (spec) {
      const url = buildGenreUrl(media, spec, 'popularity.desc');
      if (url) return url;
    }
  }
  return media === 'movie' ? movieNoCert('') : kidsTv('');
};

/* ── Manifest entry point ────────────────────────────────────────────────── */

// Local seeded shuffle (deterministic per hash) — mirrors useDynamicManifest's.
const seededShuffle = <T,>(arr: T[], seed: number): T[] => {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.abs((seed * (i + 1) * 2654435761) | 0) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

interface KidsManifestCtx {
  year: number;
  continueWatchingRow: SmartRow | null;
  myListRow: SmartRow | null;
  selectedGenreId?: number;
  selectedGenreName?: string;
  /** Daily hash — rotates row order and personalization seeds day to day. */
  hash?: number;
  /** The kid profile's own continue-watching pool (personalization seeds). */
  continueWatching?: Movie[];
  profileName?: string;
}

/**
 * Personalized kids rows: "Top Picks for {name}" seeded from the most recent
 * watch, plus up to two "Because you watched X" rows from hash-rotated older
 * seeds. Recommendations of kid titles are inherently kid-leaning, and the
 * client-side kids filter screens every result again anyway.
 */
const kidsPersonalRows = (
  pageType: 'home' | 'movie' | 'tv',
  continueWatching: Movie[],
  hash: number,
  profileName?: string,
): SmartRow[] => {
  const eligible = continueWatching.filter(m => {
    if (pageType === 'movie') return m.media_type === 'movie' || (!m.media_type && !!m.title);
    if (pageType === 'tv') return m.media_type === 'tv' || (!m.media_type && !m.title);
    return true;
  });
  if (eligible.length === 0) return [];

  const rows: SmartRow[] = [];
  const usedIds = new Set<number | string>();

  // Most recent watch anchors "Top Picks" — the strongest recency signal.
  const anchor = eligible[0];
  const anchorType = anchor.media_type === 'tv' || (!anchor.media_type && !anchor.title) ? 'tv' : 'movie';
  usedIds.add(anchor.id);
  rows.push({
    key: 'top-picks-kids',
    title: profileName ? `Top Picks for ${profileName}` : 'Top Picks for You',
    fetchUrl: REQUESTS.fetchRecommendations(anchorType, anchor.id),
  });

  // Older watches (hash-rotated) drive the Because-you-watched rows.
  pickPersonalSeeds(eligible.slice(1), hash, 2).forEach(m => {
    if (usedIds.has(m.id)) return;
    usedIds.add(m.id);
    const type = m.media_type === 'tv' || (!m.media_type && !m.title) ? 'tv' : 'movie';
    rows.push({
      key: `kids-personal-watched-${m.id}`,
      title: `Because you watched ${m.title || m.name}`,
      fetchUrl: REQUESTS.fetchRecommendations(type, m.id),
    });
  });

  return rows;
};

export const buildKidsManifest = (
  pageType: 'home' | 'movie' | 'tv' | 'new_popular',
  {
    year, continueWatchingRow, myListRow, selectedGenreId, selectedGenreName,
    hash = 0, continueWatching = [], profileName,
  }: KidsManifestCtx,
): SmartRow[] => {
  const manifest: SmartRow[] = [];

  if (continueWatchingRow) manifest.push(continueWatchingRow);

  // A selected kids genre replaces the page pool with genre-focused rows.
  if (selectedGenreId && KIDS_GENRE_SPECS[selectedGenreId] && (pageType === 'movie' || pageType === 'tv')) {
    manifest.push(
      ...kidsGenreRows(pageType, selectedGenreId, selectedGenreName || 'This Genre', year)
    );
    if (myListRow) manifest.splice(Math.min(2, manifest.length), 0, myListRow);
    return manifest;
  }

  if (pageType === 'new_popular') {
    manifest.push(
      { key: 'kids-new-films',  title: 'New Family Films',    fetchUrl: movieNoCert(`&primary_release_date.gte=${year - 1}-01-01`) },
      { key: 'kids-new-series', title: 'New Kids Series',     fetchUrl: kidsTv(`&first_air_date.gte=${year - 1}-01-01`) },
      { key: 'top10-movies',    title: 'Top 10 Films Today',  fetchUrl: REQUESTS.fetchTrendingMovies, type: 'top10' },
      { key: 'top10-tv',        title: 'Top 10 Series Today', fetchUrl: REQUESTS.fetchTrendingTV,     type: 'top10' },
      { key: 'kids-buzz',       title: 'Everyone Is Watching', fetchUrl: kidsTv('') },
      { key: 'kids-fresh-anim', title: 'Fresh Animation',     fetchUrl: anim(`&primary_release_date.gte=${year - 1}-01-01`) },
      { key: 'kids-top-films',  title: 'Critically Loved Family Films', fetchUrl: movieNoCert('&vote_count.gte=300', 'vote_average.desc') },
      { key: 'kids-top-series', title: 'Highest-Rated Kids Shows',      fetchUrl: kidsTv('&vote_count.gte=100', 'vote_average.desc') },
    );
    if (myListRow) manifest.splice(Math.min(2, manifest.length), 0, myListRow);
    return manifest;
  }

  // ── Page pool: fixed anchors up top, remainder rotating daily ────────────
  // Netflix Kids keeps its signature rows pinned while everything below them
  // reshuffles day to day — same rhythm here.
  const pool = pageType === 'movie' ? movieRows(year)
             : pageType === 'tv'    ? tvRows(year)
             : homeRows(year);
  const ANCHOR_COUNT = pageType === 'home' ? 5 : 4;
  const anchors   = pool.slice(0, ANCHOR_COUNT);
  const rotating  = seededShuffle(pool.slice(ANCHOR_COUNT), hash);
  // Home caps like the adult manifest (~24 rows); subpages keep their full pool.
  const rotatingCapped = pageType === 'home' ? rotating.slice(0, 19) : rotating;

  manifest.push(...anchors, ...rotatingCapped);

  // ── Personalization: Top Picks + Because-you-watched, spliced on a rhythm ─
  const personal = kidsPersonalRows(
    pageType === 'new_popular' ? 'home' : pageType,
    continueWatching, hash, profileName,
  );
  personal.forEach((row, i) => {
    const at = Math.min(2 + i * 4, manifest.length); // rows 3, 7, 11
    manifest.splice(at, 0, row);
  });

  // My List sits early, like the adult home layout.
  if (myListRow) manifest.splice(Math.min(4, manifest.length), 0, myListRow);

  return manifest;
};
