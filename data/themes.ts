import { MicroGenreEntry } from './genres';

/**
 * data/themes.ts
 * ──────────────
 * Massive rich directory of 100+ highly creative themed, holiday, seasonal,
 * and astrological row configurations mapping to highly precise TMDB discover queries.
 *
 * Designed to work seamlessly with the existing manifest and genre builder system.
 */

// ─── 1. HOLIDAY & EVENT THEMES (15 Rows) ──────────────────────────────────────
export const HOLIDAY_STREAMS: MicroGenreEntry[] = [
  {
    name: "Christmas Cozy Traditions",
    genres: "10751,35",
    type: "movie",
    extra: "&with_keywords=9672&vote_average.gte=6.5&vote_count.gte=500"
  },
  {
    name: "Christmas Action & Thrills",
    genres: "28,12",
    type: "movie",
    extra: "&with_keywords=9672&vote_count.gte=1000"
  },
  {
    name: "Nightmare Before Christmas",
    genres: "14,16",
    type: "movie",
    extra: "&with_keywords=9672|3335&vote_count.gte=1000"
  },
  {
    name: "Halloween Night Terrors",
    genres: "27",
    type: "movie",
    extra: "&with_keywords=3335&vote_count.gte=2000"
  },
  {
    name: "Paranormal Creepshow",
    genres: "27",
    type: "movie",
    extra: "&with_keywords=10185&vote_average.gte=6.8&vote_count.gte=1000"
  },
  {
    name: "Gothic Vampire Chronicles",
    genres: "27,18",
    type: "movie",
    extra: "&with_keywords=3133&vote_average.gte=7.0"
  },
  {
    name: "Valentine's Tearjerkers",
    genres: "10749,18",
    type: "movie",
    extra: "&vote_average.gte=7.8&vote_count.gte=1000&with_keywords=9799"
  },
  {
    name: "Quirky Rom-Com Matches",
    genres: "10749,35",
    type: "movie",
    extra: "&vote_average.gte=6.5&vote_count.gte=2000"
  },
  {
    name: "Thanksgiving Feuds & Food",
    genres: "18,35",
    type: "movie",
    extra: "&with_keywords=10306&vote_count.gte=200"
  },
  {
    name: "New Year's Resolutions",
    genres: "18,35",
    type: "movie",
    extra: "&with_keywords=9673|158485&vote_average.gte=6.5"
  },
  {
    name: "St. Patrick's Emerald Isle",
    genres: "18,36",
    type: "movie",
    extra: "&with_origin_country=IE&vote_average.gte=7.0"
  },
  {
    name: "Easter Family Adventure",
    genres: "10751,16",
    type: "movie",
    extra: "&with_keywords=11370&vote_average.gte=6.5"
  },
  {
    name: "Mother's Day Maternal Bonds",
    genres: "18,35",
    type: "movie",
    extra: "&with_keywords=158566|10527&vote_average.gte=7.0"
  },
  {
    name: "Father's Day Dad Energies",
    genres: "28,18",
    type: "movie",
    extra: "&with_keywords=158565|10526&vote_average.gte=7.0"
  },
  {
    name: "Fourth of July Fireworks",
    genres: "28,36",
    type: "movie",
    extra: "&with_keywords=351|173163&vote_count.gte=1000"
  }
];

// ─── 2. CONTEXTUAL & TIME-OF-DAY THEMES (15 Rows) ────────────────────────────
export const CONTEXTUAL_STREAMS: MicroGenreEntry[] = [
  {
    name: "Sunday Morning Cozy Cartoons",
    genres: "16,10751",
    type: "tv",
    extra: "&vote_average.gte=7.5&with_runtime.lte=30"
  },
  {
    name: "Monday Coffee & Brain Food",
    genres: "99",
    type: "movie",
    extra: "&vote_average.gte=7.8&vote_count.gte=500"
  },
  {
    name: "Midweek Office Sitcom Laughs",
    genres: "35",
    type: "tv",
    extra: "&with_keywords=1701&vote_count.gte=1000"
  },
  {
    name: "Late Night High-Octane Thrills",
    genres: "28,53",
    type: "movie",
    extra: "&with_runtime.lte=110&vote_average.gte=7.0&vote_count.gte=3000"
  },
  {
    name: "Evening Escape: Epic Fantasy",
    genres: "12,14",
    type: "movie",
    extra: "&with_runtime.gte=130&vote_count.gte=5000"
  },
  {
    name: "After-School Teen Drama",
    genres: "18,35",
    type: "tv",
    extra: "&with_keywords=4565&vote_average.gte=7.2"
  },
  {
    name: "Midnight Mind-Benders",
    genres: "53,9648",
    type: "movie",
    extra: "&with_keywords=10224&vote_average.gte=7.5&vote_count.gte=2000"
  },
  {
    name: "Rainy Day Comfort Blanket",
    genres: "35,10751",
    type: "movie",
    extra: "&vote_average.gte=7.2&vote_count.gte=2500"
  },
  {
    name: "Lunch Hour Quick Bites",
    genres: "35",
    type: "tv",
    extra: "&with_runtime.lte=25&vote_average.gte=7.8&vote_count.gte=1500"
  },
  {
    name: "Friday Night Popcorn Hits",
    genres: "28,12",
    type: "movie",
    extra: "&vote_average.gte=6.5&vote_count.gte=15000"
  },
  {
    name: "Saturday Night Date Night",
    genres: "35,10749",
    type: "movie",
    extra: "&vote_average.gte=7.0&vote_count.gte=4000"
  },
  {
    name: "Thursday Throwback Retro",
    genres: "18,80",
    type: "movie",
    extra: "&primary_release_date.lte=2000-01-01&vote_average.gte=7.8&vote_count.gte=5000"
  },
  {
    name: "Sunset Road-Trips",
    genres: "12,35",
    type: "movie",
    extra: "&with_keywords=11930&vote_average.gte=7.0"
  },
  {
    name: "Deep Sleep Ambient Space",
    genres: "878,14",
    type: "movie",
    extra: "&with_keywords=3801&vote_average.gte=7.5&vote_count.gte=3000"
  },
  {
    name: "Dawn Patrol Motivation",
    genres: "18,10402",
    type: "movie",
    extra: "&vote_average.gte=7.8&with_keywords=6075"
  }
];

// ─── 3. ASTROLOGICALLY THEMED RECOMMENDATIONS (12 Rows) ──────────────────────
export const ASTROLOGY_STREAMS: MicroGenreEntry[] = [
  {
    name: "Aries' Adrenaline Junkies",
    genres: "28,53",
    type: "movie",
    extra: "&with_keywords=1706|549&vote_average.gte=7.0&vote_count.gte=3000"
  },
  {
    name: "Taurus' Slow & Savored Comforts",
    genres: "18,10749",
    type: "movie",
    extra: "&vote_average.gte=7.8&with_runtime.gte=125&vote_count.gte=2000"
  },
  {
    name: "Gemini's Spill the Tea",
    genres: "18,35",
    type: "tv",
    extra: "&with_keywords=10224&vote_average.gte=7.5&vote_count.gte=1000"
  },
  {
    name: "Cancer's Emotional Safe Haven",
    genres: "18,10751",
    type: "movie",
    extra: "&vote_average.gte=7.8&vote_count.gte=3000"
  },
  {
    name: "Leo's Glitz & Center Stage",
    genres: "10402,18",
    type: "movie",
    extra: "&vote_average.gte=7.5&vote_count.gte=1500"
  },
  {
    name: "Virgo's Perfect Puzzle Boxes",
    genres: "9648,53",
    type: "movie",
    extra: "&vote_average.gte=7.5&vote_count.gte=2500"
  },
  {
    name: "Libra's Harmonious Masterpieces",
    genres: "10749,18",
    type: "movie",
    extra: "&vote_average.gte=7.6&vote_count.gte=2000"
  },
  {
    name: "Scorpio's Erotic & Dark Dread",
    genres: "27,53",
    type: "movie",
    extra: "&with_keywords=10224&vote_average.gte=7.0&vote_count.gte=2000"
  },
  {
    name: "Sagittarius' Epic Wanderlust",
    genres: "12,14",
    type: "movie",
    extra: "&vote_average.gte=7.2&vote_count.gte=4000"
  },
  {
    name: "Capricorn's Corporate Intrigues",
    genres: "18,36",
    type: "movie",
    extra: "&with_keywords=5691&vote_average.gte=7.5&vote_count.gte=1000"
  },
  {
    name: "Aquarius' Quirky & Offbeat Worlds",
    genres: "878,35",
    type: "movie",
    extra: "&with_keywords=180370&vote_average.gte=7.2&vote_count.gte=1500"
  },
  {
    name: "Pisces' Surreal Dreamscapes",
    genres: "14,16",
    type: "movie",
    extra: "&vote_average.gte=7.8&vote_count.gte=2000"
  }
];

// ─── 4. SPECIALIZED MICRO-GENRES (30 Rows) ───────────────────────────────────
export const MICRO_THEME_STREAMS: MicroGenreEntry[] = [
  {
    name: "Cyberpunk & AI Rebellion",
    genres: "878,53",
    type: "movie",
    extra: "&with_keywords=180370|310&vote_average.gte=7.2&vote_count.gte=3000"
  },
  {
    name: "The Perfect Heist Sagas",
    genres: "80,53",
    type: "movie",
    extra: "&with_keywords=10214&vote_average.gte=7.4&vote_count.gte=4000"
  },
  {
    name: "Lethal Martial Arts Spectacles",
    genres: "28",
    type: "movie",
    extra: "&with_keywords=3671&vote_average.gte=7.0&vote_count.gte=1000"
  },
  {
    name: "Time-Loop Paradoxes",
    genres: "878,9648",
    type: "movie",
    extra: "&with_keywords=4379|207436&vote_average.gte=7.2&vote_count.gte=2000"
  },
  {
    name: "Cozy British Village Mysteries",
    genres: "9648,80",
    type: "tv",
    extra: "&with_origin_country=GB&vote_average.gte=7.5&vote_count.gte=500"
  },
  {
    name: "Post-Apocalyptic Sand & Dust",
    genres: "878,28",
    type: "movie",
    extra: "&with_keywords=4565&vote_average.gte=6.8&vote_count.gte=4000"
  },
  {
    name: "Gothic Victorian Dread",
    genres: "27,18",
    type: "movie",
    extra: "&with_keywords=5691&vote_average.gte=7.0&vote_count.gte=1500"
  },
  {
    name: "High-Seas Pirate Swashbucklers",
    genres: "12,28",
    type: "movie",
    extra: "&with_keywords=2081|1801&vote_count.gte=3000"
  },
  {
    name: "Great Prison Escapes",
    genres: "80,53",
    type: "movie",
    extra: "&with_keywords=378&vote_average.gte=7.5&vote_count.gte=2000"
  },
  {
    name: "Masterchef Culinary Dramas",
    genres: "18,35",
    type: "movie",
    extra: "&with_keywords=159491|10461&vote_average.gte=7.0"
  },
  {
    name: "Underdog Sports & Glory",
    genres: "18,35",
    type: "movie",
    extra: "&with_keywords=6075&vote_average.gte=7.4&vote_count.gte=2000"
  },
  {
    name: "Assassins & Hitmen",
    genres: "28,80",
    type: "movie",
    extra: "&with_keywords=10103|12317&vote_count.gte=3000"
  },
  {
    name: "Cops, Detectives & Procedurals",
    genres: "80,9648",
    type: "tv",
    extra: "&with_keywords=1701&vote_average.gte=7.6&vote_count.gte=1500"
  },
  {
    name: "Dark Comedy & Black Humor",
    genres: "35,80",
    type: "movie",
    extra: "&with_keywords=10224&vote_average.gte=7.0&vote_count.gte=1000"
  },
  {
    name: "CGI & Pixar-Style Magic",
    genres: "16,10751",
    type: "movie",
    extra: "&with_keywords=12542&vote_average.gte=7.6&vote_count.gte=4000"
  },
  {
    name: "Anime Shonen Battles",
    genres: "16,28",
    type: "tv",
    extra: "&with_keywords=210024&vote_average.gte=8.0&vote_count.gte=1000"
  },
  {
    name: "Period Romance & Swoons",
    genres: "10749,36",
    type: "movie",
    extra: "&with_keywords=5691&vote_average.gte=7.5&vote_count.gte=2000"
  },
  {
    name: "True Crime Investigative Docs",
    genres: "99,80",
    type: "tv",
    extra: "&vote_average.gte=7.6&vote_count.gte=1000"
  },
  {
    name: "Ancient Historical Epics",
    genres: "36,28",
    type: "movie",
    extra: "&with_keywords=5691&vote_average.gte=7.2&vote_count.gte=3000"
  },
  {
    name: "Stand-Up Comedy Specials",
    genres: "35",
    type: "tv",
    extra: "&with_keywords=9716&vote_average.gte=7.2&vote_count.gte=500"
  },
  {
    name: "Reality TV Matches & Dates",
    genres: "10764",
    type: "tv",
    extra: "&with_keywords=9743&vote_average.gte=6.0"
  },
  {
    name: "Superheroes & Comic Books",
    genres: "28,878",
    type: "movie",
    extra: "&with_keywords=9715&vote_count.gte=12000"
  },
  {
    name: "Nature & Earth Wildlife",
    genres: "99",
    type: "tv",
    extra: "&with_keywords=196884&vote_average.gte=8.2&vote_count.gte=1000"
  },
  {
    name: "Survival in the Wilderness",
    genres: "53",
    type: "movie",
    extra: "&with_keywords=549|9663&vote_average.gte=6.8&vote_count.gte=2000"
  },
  {
    name: "Witchcraft & Dark Spells",
    genres: "14,27",
    type: "movie",
    extra: "&with_keywords=6158&vote_average.gte=6.5&vote_count.gte=1500"
  },
  {
    name: "Space Operas & Galaxies",
    genres: "878,12",
    type: "movie",
    extra: "&with_keywords=3801|161244&vote_average.gte=7.0&vote_count.gte=8000"
  },
  {
    name: "Courtroom Legal Chess",
    genres: "18,80",
    type: "movie",
    extra: "&with_keywords=5691&vote_average.gte=7.5&vote_count.gte=1500"
  },
  {
    name: "High-School Rivalries",
    genres: "35,18",
    type: "movie",
    extra: "&with_keywords=4565&vote_average.gte=6.8&vote_count.gte=3000"
  },
  {
    name: "Haunted Houses & Mansions",
    genres: "27",
    type: "movie",
    extra: "&with_keywords=10185&vote_average.gte=6.5&vote_count.gte=2000"
  },
  {
    name: "Smart Hackers & Cyber Wars",
    genres: "878,53",
    type: "movie",
    extra: "&with_keywords=180370&vote_average.gte=7.0&vote_count.gte=1000"
  }
];

// ─── 5. RETRO DECADES & MILESTONES (20 Rows) ────────────────────────────────
export const RETRO_STREAMS: MicroGenreEntry[] = [
  {
    name: "90s Grunge & Street Crime",
    genres: "80,53",
    type: "movie",
    extra: "&primary_release_date.gte=1990-01-01&primary_release_date.lte=1999-12-31&vote_average.gte=7.4&vote_count.gte=3000"
  },
  {
    name: "Golden Age Hollywood Glamour",
    genres: "18,10749",
    type: "movie",
    extra: "&primary_release_date.lte=1960-01-01&vote_average.gte=7.8&vote_count.gte=1000"
  },
  {
    name: "70s Soul, Funk & Musicals",
    genres: "10402,18",
    type: "movie",
    extra: "&primary_release_date.gte=1970-01-01&primary_release_date.lte=1979-12-31&vote_average.gte=7.2"
  },
  {
    name: "80s Synthwave & Cyber Neon",
    genres: "878,28",
    type: "movie",
    extra: "&primary_release_date.gte=1980-01-01&primary_release_date.lte=1989-12-31&vote_count.gte=2500"
  },
  {
    name: "Silent Film Pioneers",
    genres: "18,35",
    type: "movie",
    extra: "&primary_release_date.lte=1930-01-01&vote_average.gte=7.6"
  },
  {
    name: "50s B-Movie Creature Features",
    genres: "27,878",
    type: "movie",
    extra: "&primary_release_date.gte=1950-01-01&primary_release_date.lte=1959-12-31&vote_average.gte=6.0"
  },
  {
    name: "60s Cold War Espionage",
    genres: "53,36",
    type: "movie",
    extra: "&primary_release_date.gte=1960-01-01&primary_release_date.lte=1969-12-31&with_keywords=470"
  },
  {
    name: "Medieval Sword & Shield Epics",
    genres: "28,12",
    type: "movie",
    extra: "&with_keywords=5691&vote_average.gte=7.0&vote_count.gte=4000"
  },
  {
    name: "Peak 2000s Teen Pop Culture",
    genres: "35,10749",
    type: "movie",
    extra: "&primary_release_date.gte=2000-01-01&primary_release_date.lte=2009-12-31&vote_count.gte=4000"
  },
  {
    name: "Defining 2010s Blockbusters",
    genres: "28,878",
    type: "movie",
    extra: "&primary_release_date.gte=2010-01-01&primary_release_date.lte=2019-12-31&vote_count.gte=15000"
  },
  {
    name: "Retro 80s Slacker Comedies",
    genres: "35",
    type: "movie",
    extra: "&primary_release_date.gte=1980-01-01&primary_release_date.lte=1989-12-31&vote_count.gte=2000"
  },
  {
    name: "Post-WWII Cinema Noir",
    genres: "80,9648",
    type: "movie",
    extra: "&primary_release_date.gte=1945-01-01&primary_release_date.lte=1959-12-31&vote_average.gte=7.2"
  },
  {
    name: "90s Cyber Sci-Fi Tech",
    genres: "878",
    type: "movie",
    extra: "&primary_release_date.gte=1990-01-01&primary_release_date.lte=1999-12-31&with_keywords=180370"
  },
  {
    name: "Swinging 60s Musical Romance",
    genres: "10749,10402",
    type: "movie",
    extra: "&primary_release_date.gte=1960-01-01&primary_release_date.lte=1969-12-31&vote_average.gte=7.0"
  },
  {
    name: "New Hollywood Renaissance",
    genres: "18,80",
    type: "movie",
    extra: "&primary_release_date.gte=1967-01-01&primary_release_date.lte=1979-12-31&vote_average.gte=7.6&vote_count.gte=2000"
  },
  {
    name: "Victorian Era Aristocracy",
    genres: "18,10749",
    type: "movie",
    extra: "&with_keywords=5691&vote_average.gte=7.4"
  },
  {
    name: "Samurai Mastery: Jidaigeki",
    genres: "28,36",
    type: "movie",
    extra: "&with_origin_country=JP&vote_average.gte=7.6&vote_count.gte=500"
  },
  {
    name: "Spaghetti Western Legends",
    genres: "37",
    type: "movie",
    extra: "&primary_release_date.gte=1960-01-01&primary_release_date.lte=1979-12-31&vote_average.gte=7.5"
  },
  {
    name: "Early CGI Revolution",
    genres: "12,878",
    type: "movie",
    extra: "&primary_release_date.gte=1990-01-01&primary_release_date.lte=2005-12-31&vote_count.gte=8000"
  },
  {
    name: "Modern Classics: 2020s Prestige",
    genres: "18",
    type: "movie",
    extra: "&primary_release_date.gte=2020-01-01&vote_average.gte=8.0&vote_count.gte=2000"
  }
];

// ─── 6. GLOBAL & CULTURAL CINEMA THEMES (10 Rows) ────────────────────────────
export const GLOBAL_STREAMS: MicroGenreEntry[] = [
  {
    name: "French New Wave & Romance",
    genres: "18,10749",
    type: "movie",
    extra: "&with_origin_country=FR&vote_average.gte=7.2&vote_count.gte=1000"
  },
  {
    name: "Korean Edge-of-Seat Thrillers",
    genres: "53,80",
    type: "movie",
    extra: "&with_origin_country=KR&vote_average.gte=7.6&vote_count.gte=2000"
  },
  {
    name: "Spanish High-Tension Crime",
    genres: "80,53",
    type: "movie",
    extra: "&with_original_language=es&vote_average.gte=7.2&vote_count.gte=1500"
  },
  {
    name: "Japanese Anime Masterpieces",
    genres: "16,14",
    type: "movie",
    extra: "&with_origin_country=JP&vote_average.gte=7.8&vote_count.gte=3000"
  },
  {
    name: "Bollywood Colors & Romance",
    genres: "18,10749",
    type: "movie",
    extra: "&with_origin_country=IN&vote_average.gte=7.0&vote_count.gte=500"
  },
  {
    name: "Nordic Noir & Snowy Secrets",
    genres: "80,9648",
    type: "tv",
    extra: "&with_origin_country=SE|NO|DK|FI&vote_average.gte=7.5"
  },
  {
    name: "German Prestige & Historiography",
    genres: "18,36",
    type: "movie",
    extra: "&with_origin_country=DE&vote_average.gte=7.5&vote_count.gte=1000"
  },
  {
    name: "Latin American Vivid Realism",
    genres: "18",
    type: "movie",
    extra: "&with_origin_country=MX|AR|BR|CO&vote_average.gte=7.4"
  },
  {
    name: "British Wit & Dry Humor",
    genres: "35",
    type: "movie",
    extra: "&with_origin_country=GB&vote_average.gte=7.0&vote_count.gte=3000"
  },
  {
    name: "Italian Cinema & Neo-Realism",
    genres: "18",
    type: "movie",
    extra: "&with_origin_country=IT&vote_average.gte=7.5&vote_count.gte=800"
  }
];

// ─── 7. MASTER CONSOLIDATED THEMED LIBRARY (102 Configurations) ──────────────
export const ALL_THEMED_STREAMS: MicroGenreEntry[] = [
  ...HOLIDAY_STREAMS,
  ...CONTEXTUAL_STREAMS,
  ...ASTROLOGY_STREAMS,
  ...MICRO_THEME_STREAMS,
  ...RETRO_STREAMS,
  ...GLOBAL_STREAMS
];
