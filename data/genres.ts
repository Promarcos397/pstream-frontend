/**
 * data/genres.ts
 * ──────────────
 * Static genre/category data — moved out of constants.ts.
 * Pure data, no logic, no env reads.
 *
 * v2 — 10x expanded: 250+ micro-genres, time-of-day streams,
 * seasonal streams, holiday streams, adjacent-genre map,
 * smarter DAY_STREAMS with mixture syntax.
 */

// ─── TMDB Genre ID → Name map ─────────────────────────────────────────────────
export const GENRES: { [key: number]: string } = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
  10759: "Action & Adventure",
  10762: "Family",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
};

// ─── Adjacent Genre Map — used when filtering micro-genres by selected genre ──
// When a user selects a genre, adjacent genres are allowed at lower weight
export const ADJACENT_GENRES: Record<number, number[]> = {
  28:    [12, 53, 878, 10759, 10752],
  12:    [28, 14, 878, 10759, 35],
  16:    [10751, 35, 12, 10762],
  35:    [10749, 18, 16, 80, 27],
  80:    [53, 18, 9648, 10768, 28],
  99:    [36, 18, 10768, 10752],
  18:    [80, 53, 9648, 10749, 36, 10768],
  10751: [16, 35, 12, 10762],
  14:    [12, 10765, 878, 10759, 36],
  36:    [18, 99, 10752, 80],
  27:    [53, 9648, 35, 10765],
  10402: [18, 10749, 99, 35],
  9648:  [53, 80, 27, 18, 878],
  10749: [35, 18, 10402, 10751],
  878:   [12, 14, 53, 10765, 9648],
  53:    [80, 9648, 27, 878, 18, 28],
  10752: [28, 36, 18, 99, 10768],
  37:    [12, 28, 18, 36],
  10759: [28, 12, 53, 878],
  10762: [16, 35, 12, 10751],
  10764: [35, 99, 18],
  10765: [878, 14, 27, 53, 12],
  10768: [18, 53, 36, 99, 10752],
};

// ─── Micro-Genre Library ──────────────────────────────────────────────────────
export interface MicroGenreEntry {
  name: string;
  genres: string;
  type: 'movie' | 'tv';
  extra?: string;
}

export const MICRO_GENRES: MicroGenreEntry[] = [

  // ══════════════════════════════════════════════════════
  // MOVIES — ACTION, THRILLER, CRIME
  // ══════════════════════════════════════════════════════
  { name: 'Hollywood\'s Biggest Spectacles',        genres: '28,12',    type: 'movie', extra: '&vote_count.gte=20000' },
  { name: 'High-Octane Action Thrillers',            genres: '28,53',    type: 'movie', extra: '&vote_count.gte=5000&with_runtime.lte=130' },
  { name: 'Heists That Actually Worked',             genres: '80,53',    type: 'movie', extra: '&with_keywords=heist|bank robbery' },
  { name: 'Edge-of-Your-Seat Thrillers',             genres: '53',       type: 'movie', extra: '&vote_count.gte=10000' },
  { name: 'Assassins, Hitmen & Contract Killers',   genres: '28,80',    type: 'movie', extra: '&with_keywords=assassin|hitman' },
  { name: 'Crime Sagas Worth Every Minute',          genres: '80,18',    type: 'movie', extra: '&vote_count.gte=5000&with_runtime.gte=140' },
  { name: 'Spy Films With Real Bite',                genres: '28,53',    type: 'movie', extra: '&with_keywords=spy|espionage' },
  { name: 'One Last Job',                            genres: '80,53',    type: 'movie', extra: '&with_keywords=heist|robbery|one last job' },
  { name: 'Police Procedurals, Film Edition',        genres: '80,18',    type: 'movie', extra: '&with_keywords=detective|police investigation' },
  { name: 'Car Chases & Chaos',                      genres: '28,12',    type: 'movie', extra: '&with_keywords=car chase|pursuit' },
  { name: 'Psychological Thrillers That Mess With You', genres: '53,9648', type: 'movie', extra: '&vote_count.gte=5000' },
  { name: 'Revenge Stories Done Right',              genres: '28,53',    type: 'movie', extra: '&with_keywords=revenge|vengeance' },
  { name: 'Mob Stories & Gangster Epics',            genres: '80,18',    type: 'movie', extra: '&with_keywords=mafia|gangster|mob' },
  { name: 'Fast-Paced Films Under 100 Minutes',      genres: '28,53',    type: 'movie', extra: '&with_runtime.lte=100&vote_count.gte=3000' },
  { name: 'Tense Survival Scenarios',                genres: '28,53',    type: 'movie', extra: '&with_keywords=survival|stranded|trapped' },

  // ══════════════════════════════════════════════════════
  // MOVIES — DRAMA, PRESTIGE
  // ══════════════════════════════════════════════════════
  { name: 'The Kind of Drama That Stays With You',   genres: '18',       type: 'movie', extra: '&vote_average.gte=8&vote_count.gte=3000' },
  { name: 'Award Season\'s Best-Kept Secrets',       genres: '18',       type: 'movie', extra: '&vote_average.gte=7.8&vote_count.gte=1000&vote_count.lte=5000' },
  { name: 'Films That Broke Your Heart (in a Good Way)', genres: '18,10749', type: 'movie', extra: '&vote_average.gte=7.5&vote_count.gte=2000' },
  { name: 'Stories Ripped From the Headlines',       genres: '18,99',    type: 'movie', extra: '&with_keywords=true story|based on true events' },
  { name: 'Character Studies Worth Your Evening',    genres: '18',       type: 'movie', extra: '&vote_average.gte=7.8&with_runtime.gte=100' },
  { name: 'Films That Made Adults Cry',              genres: '18,10749', type: 'movie', extra: '&with_keywords=emotional|tearjerker' },
  { name: 'Underdog Stories That Deliver',           genres: '18,35',    type: 'movie', extra: '&with_keywords=underdog|redemption|triumph' },
  { name: 'Biopics Worth Your Time',                 genres: '18,36',    type: 'movie', extra: '&with_keywords=biopic|biography' },
  { name: 'Social Issue Films With Real Impact',     genres: '18,99',    type: 'movie', extra: '&vote_average.gte=7.5&vote_count.gte=500' },
  { name: 'Coming-of-Age Stories That Hit Different', genres: '18',       type: 'movie', extra: '&with_keywords=coming of age|growing up' },
  { name: 'Slow Burns Worth Every Minute',           genres: '18,53',    type: 'movie', extra: '&with_runtime.gte=120&vote_average.gte=7.8' },
  { name: 'Films You\'ll Watch Twice to Catch Everything', genres: '53,18', type: 'movie', extra: '&with_keywords=twist|multiple storylines|nonlinear' },
  { name: 'Career-Best Performances',               genres: '18',       type: 'movie', extra: '&vote_average.gte=8.2&vote_count.gte=3000' },
  { name: 'Quiet Films That Hit Loud',               genres: '18',       type: 'movie', extra: '&vote_average.gte=8&vote_count.gte=500&vote_count.lte=2000' },

  // ══════════════════════════════════════════════════════
  // MOVIES — COMEDY
  // ══════════════════════════════════════════════════════
  { name: 'Laugh-Out-Loud Comedies',                 genres: '35',       type: 'movie', extra: '&vote_count.gte=10000' },
  { name: 'The Comedy That Sneaks Up on You',        genres: '35,18',    type: 'movie', extra: '&vote_average.gte=7.5&vote_count.gte=2000' },
  { name: 'Late Night Comedy Picks',                 genres: '35',       type: 'movie', extra: '&vote_count.gte=5000&with_runtime.lte=100' },
  { name: 'Buddy Comedies for a Lazy Afternoon',     genres: '35,28',    type: 'movie', extra: '&with_keywords=buddy|duo|friends' },
  { name: 'Dark Comedies That Go There',             genres: '35,18',    type: 'movie', extra: '&with_keywords=dark comedy|satire|black comedy' },
  { name: 'Cult Comedies You Quote for Years',       genres: '35',       type: 'movie', extra: '&vote_count.gte=5000&vote_average.lte=7.5&popularity.gte=20' },
  { name: 'The Rom-Coms You Actually Want to Watch', genres: '35,10749', type: 'movie', extra: '&vote_average.gte=7.2' },
  { name: 'Dinner Table Comedies',                   genres: '35,10751', type: 'movie', extra: '&with_keywords=family|reunion|holiday' },
  { name: 'Hollywood Comedy at Its Peak',            genres: '35',       type: 'movie', extra: '&primary_release_date.gte=2000-01-01&primary_release_date.lte=2015-01-01&vote_count.gte=10000' },
  { name: 'Absurdist Comedies for When You Need It', genres: '35',       type: 'movie', extra: '&with_keywords=absurd|surreal|quirky' },

  // ══════════════════════════════════════════════════════
  // MOVIES — HORROR
  // ══════════════════════════════════════════════════════
  { name: 'Horror That Actually Scared People',      genres: '27',       type: 'movie', extra: '&vote_count.gte=10000' },
  { name: 'Psychological Horror Worth Losing Sleep', genres: '27,53',    type: 'movie', extra: '&vote_average.gte=7&vote_count.gte=2000' },
  { name: 'Horror Classics From Every Decade',       genres: '27',       type: 'movie', extra: '&vote_average.gte=7.5' },
  { name: 'Supernatural Horror: Demons, Ghosts & More', genres: '27',   type: 'movie', extra: '&with_keywords=ghost|demon|supernatural' },
  { name: 'Slasher Favourites',                      genres: '27',       type: 'movie', extra: '&with_keywords=slasher|killer' },
  { name: 'Horror Comedies That Work',               genres: '27,35',    type: 'movie', extra: '&vote_count.gte=1000' },
  { name: 'Elevated Horror: Arthouse Scares',        genres: '27,18',    type: 'movie', extra: '&vote_average.gte=7.5&vote_count.gte=1000' },
  { name: 'Body Horror & The Grotesque',             genres: '27,878',   type: 'movie', extra: '&with_keywords=body horror|transformation' },
  { name: 'The Monsters You Can\'t Outrun',          genres: '27,28',    type: 'movie', extra: '&with_keywords=monster|creature' },

  // ══════════════════════════════════════════════════════
  // MOVIES — SCI-FI & FANTASY
  // ══════════════════════════════════════════════════════
  { name: 'Sci-Fi That Actually Makes You Think',    genres: '878',      type: 'movie', extra: '&vote_average.gte=7.5&vote_count.gte=3000' },
  { name: 'Space Operas Worth the Runtime',          genres: '878,12',   type: 'movie', extra: '&with_keywords=space|galaxy|planet' },
  { name: 'Dystopian Futures That Felt Too Real',    genres: '878,53',   type: 'movie', extra: '&with_keywords=dystopia|post-apocalyptic' },
  { name: 'Time Travel Done Right',                  genres: '878,12',   type: 'movie', extra: '&with_keywords=time travel' },
  { name: 'Artificial Intelligence Nightmares',      genres: '878,53',   type: 'movie', extra: '&with_keywords=artificial intelligence|robot|android' },
  { name: 'Cyberpunk Worlds',                        genres: '878',      type: 'movie', extra: '&with_keywords=cyberpunk|hacker|neon' },
  { name: 'Fantasy Epics That Transported You',      genres: '14,12',    type: 'movie', extra: '&vote_count.gte=5000' },
  { name: 'Mythological Adventures',                 genres: '14,12',    type: 'movie', extra: '&with_keywords=mythology|myth|legend' },
  { name: 'Superhero Films That Redefined the Genre', genres: '28,878',  type: 'movie', extra: '&with_keywords=superhero|comic book&vote_count.gte=10000' },
  { name: 'Close Encounters & First Contact',        genres: '878',      type: 'movie', extra: '&with_keywords=alien|extraterrestrial|first contact' },
  { name: 'Mind-Bending Realities',                  genres: '878,53',   type: 'movie', extra: '&with_keywords=mind bending|reality|simulation' },

  // ══════════════════════════════════════════════════════
  // MOVIES — INTERNATIONAL CINEMA
  // ══════════════════════════════════════════════════════
  { name: 'French Cinema: Cool, Sharp, Undeniable',  genres: '18,80',    type: 'movie', extra: '&with_origin_country=FR&vote_average.gte=7' },
  { name: 'Korean Cinema Rising',                    genres: '18,53',    type: 'movie', extra: '&with_origin_country=KR&vote_average.gte=7.5' },
  { name: 'Spanish Language Thrillers',              genres: '53,80',    type: 'movie', extra: '&with_original_language=es&vote_average.gte=7' },
  { name: 'Italian Genre Classics',                  genres: '28,53',    type: 'movie', extra: '&with_origin_country=IT&vote_average.gte=7' },
  { name: 'Japanese Genre Mastery',                  genres: '28,18',    type: 'movie', extra: '&with_origin_country=JP&vote_average.gte=7.5' },
  { name: 'Bollywood Goes Global',                   genres: '18,10749', type: 'movie', extra: '&with_origin_country=IN&vote_average.gte=7' },
  { name: 'Scandinavian Slow Burns',                 genres: '53,18',    type: 'movie', extra: '&with_origin_country=SE,NO,DK,FI&vote_average.gte=7' },
  { name: 'German Prestige Cinema',                  genres: '18,53',    type: 'movie', extra: '&with_origin_country=DE&vote_average.gte=7.5' },
  { name: 'Latin American Stories That Shine',       genres: '18',       type: 'movie', extra: '&with_origin_country=MX,AR,CO,BR&vote_average.gte=7.5' },
  { name: 'Asian Action Legends',                    genres: '28,12',    type: 'movie', extra: '&with_origin_country=HK,KR,JP,CN,TH&vote_count.gte=1000' },
  { name: 'Middle Eastern & North African Cinema',   genres: '18',       type: 'movie', extra: '&with_origin_country=IR,EG,MA,SA&vote_average.gte=7' },
  { name: 'World Cinema: The Hidden Library',        genres: '18',       type: 'movie', extra: '&without_original_language=en&vote_average.gte=7.8&page=2' },
  { name: 'British Films Worth Every Minute',        genres: '18,35',    type: 'movie', extra: '&with_origin_country=GB&vote_count.gte=2000' },

  // ══════════════════════════════════════════════════════
  // MOVIES — DECADE-SPECIFIC
  // ══════════════════════════════════════════════════════
  { name: 'Films That Defined the 70s',              genres: '18,80',    type: 'movie', extra: '&primary_release_date.gte=1970-01-01&primary_release_date.lte=1979-12-31&vote_average.gte=7.5' },
  { name: '80s Action Heroes You Grew Up With',      genres: '28,12',    type: 'movie', extra: '&primary_release_date.gte=1980-01-01&primary_release_date.lte=1989-12-31&vote_count.gte=3000' },
  { name: '80s Sci-Fi: The Golden Age',              genres: '878,12',   type: 'movie', extra: '&primary_release_date.gte=1980-01-01&primary_release_date.lte=1989-12-31' },
  { name: 'The Films That Built the 90s',            genres: '28,18,35', type: 'movie', extra: '&primary_release_date.gte=1990-01-01&primary_release_date.lte=1999-12-31&vote_count.gte=5000' },
  { name: '90s Thrillers You Still Quote',           genres: '53,80',    type: 'movie', extra: '&primary_release_date.gte=1990-01-01&primary_release_date.lte=1999-12-31&vote_count.gte=3000' },
  { name: 'Peak 2000s Cinema',                       genres: '28,18',    type: 'movie', extra: '&primary_release_date.gte=2000-01-01&primary_release_date.lte=2009-12-31&vote_count.gte=10000' },
  { name: 'The 2010s Decade in Blockbusters',        genres: '28,878',   type: 'movie', extra: '&primary_release_date.gte=2010-01-01&primary_release_date.lte=2019-12-31&vote_count.gte=15000' },
  { name: 'This Decade\'s Best: 2020s Hits',         genres: '18,28',    type: 'movie', extra: '&primary_release_date.gte=2020-01-01&vote_count.gte=3000' },
  { name: 'Before CG: When Stunts Were Real',        genres: '28,12',    type: 'movie', extra: '&primary_release_date.lte=1999-12-31&with_keywords=stunt|practical effects&vote_count.gte=3000' },

  // ══════════════════════════════════════════════════════
  // MOVIES — MOOD & FORMAT
  // ══════════════════════════════════════════════════════
  { name: 'Films Under 90 Minutes: No Filler',       genres: '35,18',    type: 'movie', extra: '&with_runtime.lte=90&vote_average.gte=7&vote_count.gte=2000' },
  { name: 'Films That Reward Patience',              genres: '18,53',    type: 'movie', extra: '&with_runtime.gte=150&vote_average.gte=8' },
  { name: 'Friday Night Blockbusters',               genres: '28,12',    type: 'movie', extra: '&vote_count.gte=15000' },
  { name: 'Saturday Night Crowd-Pleasers',           genres: '28,35',    type: 'movie', extra: '&vote_count.gte=10000&vote_average.gte=7' },
  { name: 'Rainy Day Comfort Films',                 genres: '35,10749', type: 'movie', extra: '&vote_average.gte=7&vote_count.gte=3000' },
  { name: 'Date Night Picks That Actually Work',     genres: '35,10749', type: 'movie', extra: '&vote_average.gte=7.5&vote_count.gte=3000' },
  { name: 'Watch Alone at Midnight',                 genres: '53,27',    type: 'movie', extra: '&vote_average.gte=7.5' },
  { name: 'The Films You Never Finished — Until Now', genres: '18,53',   type: 'movie', extra: '&vote_average.gte=8&vote_count.gte=5000&page=3' },
  { name: 'Two-Hour Escapes From Everything',        genres: '12,28',    type: 'movie', extra: '&with_runtime.gte=105&with_runtime.lte=125&vote_average.gte=7' },
  { name: 'Films With Soundtracks You\'ll Download', genres: '18,10402', type: 'movie', extra: '&with_keywords=music|soundtrack|musician' },

  // ══════════════════════════════════════════════════════
  // MOVIES — FAMILY & ANIMATION
  // ══════════════════════════════════════════════════════
  { name: 'Animated Films the Whole Family Loves',   genres: '16,10751', type: 'movie', extra: '&vote_average.gte=7&vote_count.gte=3000' },
  { name: 'Animated Adventures That Hit Differently as an Adult', genres: '16,12', type: 'movie', extra: '&vote_average.gte=8&vote_count.gte=5000' },
  { name: 'Family Films That Don\'t Talk Down to Kids', genres: '10751,35', type: 'movie', extra: '&vote_average.gte=7.5' },
  { name: 'Disney & Studio Classics (Era-Defining)', genres: '16,10751', type: 'movie', extra: '&vote_count.gte=5000&vote_average.gte=7.5' },
  { name: 'Fantasy Adventures for the Whole Family', genres: '14,10751', type: 'movie', extra: '&vote_count.gte=2000' },
  { name: 'Animated Sci-Fi That Expands Young Minds', genres: '16,878',  type: 'movie', extra: '&vote_average.gte=7' },

  // ══════════════════════════════════════════════════════
  // MOVIES — ROMANCE & FEEL-GOOD
  // ══════════════════════════════════════════════════════
  { name: 'Love Stories That Actually Feel Real',    genres: '10749,18', type: 'movie', extra: '&vote_average.gte=7.5&vote_count.gte=2000' },
  { name: 'The Rom-Com Revival',                     genres: '35,10749', type: 'movie', extra: '&primary_release_date.gte=2018-01-01&vote_count.gte=1000' },
  { name: 'Classic Hollywood Romance',               genres: '10749',    type: 'movie', extra: '&primary_release_date.lte=2000-01-01&vote_count.gte=5000' },
  { name: 'Films That Made You Believe in Love',     genres: '10749,18', type: 'movie', extra: '&vote_count.gte=5000&vote_average.gte=7.5' },
  { name: 'Feel-Good Films for a Rough Week',        genres: '35,18',    type: 'movie', extra: '&with_keywords=feel good|uplifting|heartwarming' },
  { name: 'Stories of Friendship That Feel True',    genres: '18,35',    type: 'movie', extra: '&with_keywords=friendship|best friends|loyalty' },

  // ══════════════════════════════════════════════════════
  // MOVIES — DOCUMENTARIES & HISTORY
  // ══════════════════════════════════════════════════════
  { name: 'Documentaries That Changed How People Thought', genres: '99', type: 'movie', extra: '&vote_average.gte=8&vote_count.gte=1000' },
  { name: 'True Crime Docs That Gripped the World',  genres: '99,80',    type: 'movie', extra: '&with_keywords=true crime|murder|crime investigation' },
  { name: 'Nature Documentaries That Floor You',     genres: '99',       type: 'movie', extra: '&with_keywords=nature|wildlife|animals|ocean' },
  { name: 'Music Documentaries Worth Your Headphones', genres: '99,10402', type: 'movie', extra: '&with_keywords=music|band|concert' },
  { name: 'War History That Doesn\'t Flinch',        genres: '10752,36', type: 'movie', extra: '&vote_count.gte=3000' },
  { name: 'The Films That Built the 20th Century',   genres: '36,18',    type: 'movie', extra: '&primary_release_date.lte=2000-01-01&vote_average.gte=8' },

  // ══════════════════════════════════════════════════════
  // TV — PRESTIGE DRAMA
  // ══════════════════════════════════════════════════════
  { name: 'The Series That Proved TV Can Be Art',    genres: '18',       type: 'tv', extra: '&vote_average.gte=8.5&vote_count.gte=3000' },
  { name: 'Slow Burns That Reward Your Patience',    genres: '18,53',    type: 'tv', extra: '&vote_average.gte=8&vote_count.gte=2000' },
  { name: 'Prestige Drama You\'ve Been Putting Off', genres: '18',       type: 'tv', extra: '&vote_average.gte=8&vote_count.gte=5000&page=2' },
  { name: 'One More Episode Situations',             genres: '18,53',    type: 'tv', extra: '&vote_count.gte=3000&vote_average.gte=7.8' },
  { name: 'Shows That Got Better Every Season',      genres: '18',       type: 'tv', extra: '&vote_average.gte=8&vote_count.gte=5000' },
  { name: 'Limited Series That Hit Different',       genres: '18,53',    type: 'tv', extra: '&with_keywords=limited series|miniseries' },
  { name: 'Series With Endings Worth Getting To',    genres: '18,53',    type: 'tv', extra: '&vote_average.gte=8&status=Ended' },
  { name: 'Character Studies That Take Their Time',  genres: '18',       type: 'tv', extra: '&vote_average.gte=8.2&vote_count.gte=1000' },
  { name: 'Ensemble Casts That Deliver Every Time',  genres: '18,35',    type: 'tv', extra: '&vote_count.gte=5000&vote_average.gte=8' },
  { name: 'Anthology Series Worth Starting',         genres: '18,53',    type: 'tv', extra: '&with_keywords=anthology' },
  { name: 'Prestige Drama Set in a Single Season',   genres: '18',       type: 'tv', extra: '&with_keywords=limited series&vote_average.gte=8' },
  { name: 'The Watercooler Shows of the Year',       genres: '18,53',    type: 'tv', extra: '&vote_count.gte=10000&first_air_date.gte=2020-01-01' },

  // ══════════════════════════════════════════════════════
  // TV — CRIME & THRILLER
  // ══════════════════════════════════════════════════════
  { name: 'Crime Sagas You Can\'t Leave Unfinished', genres: '80,18',    type: 'tv', extra: '&vote_count.gte=5000&vote_average.gte=8' },
  { name: 'Gritty Crime Procedurals',                genres: '80',       type: 'tv', extra: '&with_keywords=police|investigation|detective&vote_count.gte=3000' },
  { name: 'Binge-Worthy Crime Dramas',               genres: '80,18',    type: 'tv', extra: '&vote_count.gte=3000' },
  { name: 'True Crime Series That Gripped the Internet', genres: '80,99', type: 'tv', extra: '&with_keywords=true crime|real events' },
  { name: 'Cop Shows With Actual Depth',             genres: '80,18',    type: 'tv', extra: '&vote_average.gte=7.8&vote_count.gte=2000' },
  { name: 'Legal Dramas Worth the Courtroom',        genres: '18,80',    type: 'tv', extra: '&with_keywords=law|lawyer|trial|courtroom' },
  { name: 'Criminal Minds: Profiler & Forensic Series', genres: '80,9648', type: 'tv', extra: '&with_keywords=forensic|profiler|serial killer' },
  { name: 'Heist & Con Artist Series',               genres: '80,53',    type: 'tv', extra: '&with_keywords=heist|con artist|swindle' },
  { name: 'Organized Crime Empires',                 genres: '80,18',    type: 'tv', extra: '&with_keywords=mafia|cartel|gang|organized crime' },
  { name: 'Suspense Thrillers Where No One Is Safe', genres: '53,9648',  type: 'tv', extra: '&vote_average.gte=7.5&vote_count.gte=2000' },
  { name: 'Mysteries With Endings That Earned It',   genres: '9648,53',  type: 'tv', extra: '&vote_average.gte=8&vote_count.gte=1000' },
  { name: 'Small Town, Big Secrets',                 genres: '9648,18',  type: 'tv', extra: '&with_keywords=small town|secrets|mystery' },

  // ══════════════════════════════════════════════════════
  // TV — COMEDY
  // ══════════════════════════════════════════════════════
  { name: 'Sitcoms You\'ll Watch Start to Finish',   genres: '35',       type: 'tv', extra: '&vote_count.gte=5000&vote_average.gte=8' },
  { name: 'The New Generation of Sitcoms',           genres: '35',       type: 'tv', extra: '&first_air_date.gte=2015-01-01&vote_count.gte=2000' },
  { name: 'Wit-Filled British Comedies',             genres: '35',       type: 'tv', extra: '&with_origin_country=GB&vote_count.gte=1000' },
  { name: 'Offbeat Comedies That Find Their Audience', genres: '35',     type: 'tv', extra: '&vote_average.gte=7.8&vote_count.gte=500&vote_count.lte=3000' },
  { name: 'Workplace Comedies That Get It Right',    genres: '35',       type: 'tv', extra: '&with_keywords=workplace|office|coworkers' },
  { name: 'Sharp Satirical Series',                  genres: '35,18',    type: 'tv', extra: '&with_keywords=satire|political comedy|social commentary' },
  { name: 'Comedies That Sneak in the Drama',        genres: '35,18',    type: 'tv', extra: '&vote_average.gte=8&vote_count.gte=2000' },
  { name: 'Quick-Bite Comedies Under 30 Minutes',   genres: '35',       type: 'tv', extra: '&with_runtime.lte=30&vote_count.gte=2000' },
  { name: 'Comedy That Made the Critics Sit Up',     genres: '35',       type: 'tv', extra: '&vote_average.gte=8.5&vote_count.gte=1000' },
  { name: 'Dark Comedies With Real Edge',            genres: '35,18',    type: 'tv', extra: '&with_keywords=dark comedy|black comedy' },
  { name: 'Cringe Comedy That Works',                genres: '35',       type: 'tv', extra: '&with_keywords=cringe comedy|awkward|embarrassment' },
  { name: 'Stand-Up Specials Worth Your Evening',    genres: '35',       type: 'tv', extra: '&with_keywords=stand-up comedy|comedian' },

  // ══════════════════════════════════════════════════════
  // TV — SCI-FI & FANTASY
  // ══════════════════════════════════════════════════════
  { name: 'Sci-Fi Series That Predicted the Future', genres: '10765,878', type: 'tv', extra: '&vote_average.gte=8&vote_count.gte=3000' },
  { name: 'Epic Fantasy Worlds Worth Living In',     genres: '14,10765', type: 'tv', extra: '&vote_count.gte=3000&vote_average.gte=7.8' },
  { name: 'Dystopian TV That Felt Too Real',         genres: '10765,18', type: 'tv', extra: '&with_keywords=dystopia|oppressive|authoritarian' },
  { name: 'Supernatural Series That Defined the Genre', genres: '10765,27', type: 'tv', extra: '&vote_count.gte=5000&vote_average.gte=7.5' },
  { name: 'Thought-Provoking Sci-Fi Anthologies',    genres: '10765,9648', type: 'tv', extra: '&with_keywords=anthology|technology|future' },
  { name: 'Fantasy With Real Emotional Stakes',      genres: '14,18',    type: 'tv', extra: '&vote_average.gte=8&vote_count.gte=2000' },
  { name: 'Superhero Universes Worth Starting',      genres: '10759,10765', type: 'tv', extra: '&with_keywords=superhero|powers' },
  { name: 'Alien Encounters & Conspiracy Arcs',      genres: '10765,9648', type: 'tv', extra: '&with_keywords=alien|extraterrestrial|conspiracy' },
  { name: 'Horror-Adjacent Sci-Fi',                  genres: '10765,27', type: 'tv', extra: '&vote_average.gte=7.5&vote_count.gte=1000' },
  { name: 'Post-Apocalyptic Survival Series',        genres: '10765,18', type: 'tv', extra: '&with_keywords=post-apocalyptic|survival|apocalypse' },
  { name: 'Epic Sagas: Magic Systems & World-Building', genres: '14,12', type: 'tv', extra: '&vote_count.gte=3000&vote_average.gte=8' },
  { name: 'Time Travel & Parallel Worlds',           genres: '10765,9648', type: 'tv', extra: '&with_keywords=time travel|parallel universe|alternate reality' },

  // ══════════════════════════════════════════════════════
  // TV — HORROR
  // ══════════════════════════════════════════════════════
  { name: 'Horror Series That Ruined Your Sleep',    genres: '27,53',    type: 'tv', extra: '&vote_average.gte=8&vote_count.gte=2000' },
  { name: 'Haunted House Series: Atmosphere Unmatched', genres: '27',    type: 'tv', extra: '&with_keywords=haunted house|ghost|haunting' },
  { name: 'Horror Anthologies Worth Every Episode',  genres: '27,9648',  type: 'tv', extra: '&with_keywords=anthology|horror stories' },
  { name: 'Dread, Paranoia & Psychological Scares',  genres: '27,18',    type: 'tv', extra: '&vote_average.gte=7.5' },
  { name: 'Vampires, Werewolves & Mythic Horror',    genres: '27,10765', type: 'tv', extra: '&with_keywords=vampire|werewolf|supernatural' },
  { name: 'Slow-Dread Series for Brave Binge-Watchers', genres: '27,18', type: 'tv', extra: '&vote_average.gte=8&vote_count.gte=500' },

  // ══════════════════════════════════════════════════════
  // TV — INTERNATIONAL
  // ══════════════════════════════════════════════════════
  { name: 'K-Drama: Where to Begin',                 genres: '18,10749', type: 'tv', extra: '&with_origin_country=KR&vote_average.gte=8&vote_count.gte=500' },
  { name: 'K-Drama Thrillers That Grip and Don\'t Let Go', genres: '18,53', type: 'tv', extra: '&with_origin_country=KR&vote_average.gte=8' },
  { name: 'Spanish Thrillers: Edge-of-Seat Television', genres: '53,80', type: 'tv', extra: '&with_original_language=es&vote_average.gte=7.5' },
  { name: 'Scandinavian Noir: Cold, Dark, Gripping',  genres: '80,53',   type: 'tv', extra: '&with_origin_country=SE,NO,DK,FI&vote_average.gte=7.5' },
  { name: 'British Dramas Worth Every Accented Minute', genres: '18',    type: 'tv', extra: '&with_origin_country=GB&vote_count.gte=2000&with_runtime.gte=45' },
  { name: 'French Series: Subtle, Sharp, Addictive',  genres: '18,53',   type: 'tv', extra: '&with_origin_country=FR&vote_average.gte=7.5' },
  { name: 'German Series: Dark, Precise, Unmissable', genres: '18,53',   type: 'tv', extra: '&with_origin_country=DE&vote_average.gte=7.5' },
  { name: 'International Crime That Travels Well',   genres: '80,53',    type: 'tv', extra: '&without_origin_country=US&vote_average.gte=7.5' },
  { name: 'Turkish Drama: Epic in Every Sense',      genres: '18,10749', type: 'tv', extra: '&with_origin_country=TR&vote_average.gte=7' },
  { name: 'Israeli Series the World Discovered',     genres: '18,53',    type: 'tv', extra: '&with_origin_country=IL&vote_average.gte=7.5' },
  { name: 'Japanese Series With a Vision All Their Own', genres: '18',   type: 'tv', extra: '&with_origin_country=JP&vote_average.gte=7' },
  { name: 'Passport Not Required: International Hits', genres: '18',     type: 'tv', extra: '&without_origin_country=US&vote_average.gte=8&page=2' },

  // ══════════════════════════════════════════════════════
  // TV — TEEN, YOUNG ADULT
  // ══════════════════════════════════════════════════════
  { name: 'Teen Dramas With Real Emotional Intelligence', genres: '18,10765', type: 'tv', extra: '&with_keywords=teen|high school&vote_average.gte=7.5' },
  { name: 'Young Adult Series That Adults Secretly Love', genres: '18,35', type: 'tv', extra: '&with_keywords=young adult|coming of age' },
  { name: 'High School Chaos: Series Edition',        genres: '35,18',    type: 'tv', extra: '&with_keywords=high school|teenagers|adolescence' },
  { name: 'UK Teen Series: Brutally Honest',          genres: '18,35',    type: 'tv', extra: '&with_origin_country=GB&with_keywords=teen|youth' },

  // ══════════════════════════════════════════════════════
  // TV — REALITY & COMPETITION
  // ══════════════════════════════════════════════════════
  { name: 'Reality Competition Worth Your Saturday Night', genres: '10764', type: 'tv', extra: '&vote_count.gte=1000' },
  { name: 'Talent Shows That Became Cultural Moments',  genres: '10764,10402', type: 'tv', extra: '&with_keywords=talent show|singing competition' },
  { name: 'Dating Shows You Can\'t Look Away From',   genres: '10764,10749', type: 'tv', extra: '&with_keywords=dating|love|romantic competition' },
  { name: 'Cooking Competitions That Actually Entertain', genres: '10764', type: 'tv', extra: '&with_keywords=cooking competition|baking|culinary' },

  // ══════════════════════════════════════════════════════
  // TV — ACTION & ADVENTURE
  // ══════════════════════════════════════════════════════
  { name: 'US Drama Series With Staying Power',       genres: '18',       type: 'tv', extra: '&with_origin_country=US&vote_count.gte=5000&vote_average.gte=7.5' },
  { name: 'Military & Combat Series Done Properly',   genres: '10759,18', type: 'tv', extra: '&with_keywords=military|war|combat|soldier' },
  { name: 'Spy Thrillers: Long-Running Tension',      genres: '10759,53', type: 'tv', extra: '&with_keywords=spy|espionage|intelligence' },
  { name: 'Action-Packed Series You Fly Through',     genres: '10759',    type: 'tv', extra: '&vote_count.gte=5000&with_runtime.lte=50' },
  { name: 'Political Power Games',                    genres: '10768,18', type: 'tv', extra: '&vote_average.gte=7.5' },
  { name: 'War & Politics: The Human Cost',           genres: '10768,18', type: 'tv', extra: '&vote_count.gte=2000&vote_average.gte=8' },

  // ══════════════════════════════════════════════════════
  // TV — VINTAGE & ERA-SPECIFIC
  // ══════════════════════════════════════════════════════
  { name: 'The 90s Series That Defined a Generation', genres: '18,35',   type: 'tv', extra: '&first_air_date.gte=1990-01-01&first_air_date.lte=1999-12-31&vote_count.gte=3000' },
  { name: 'Vault: The Best of Early 2000s TV',        genres: '18,35',   type: 'tv', extra: '&first_air_date.gte=2000-01-01&first_air_date.lte=2007-12-31&vote_count.gte=5000' },
  { name: 'The Golden Age of Television: 2008-2015',  genres: '18,80',   type: 'tv', extra: '&first_air_date.gte=2008-01-01&first_air_date.lte=2015-12-31&vote_average.gte=8' },
  { name: '90s Animated Favourites',                  genres: '16',       type: 'tv', extra: '&first_air_date.gte=1990-01-01&first_air_date.lte=1999-12-31&vote_count.gte=1000' },
  { name: 'Long-Running Series With Iconic Runs',     genres: '18,35',   type: 'tv', extra: '&vote_count.gte=10000&vote_average.gte=8' },

  // ══════════════════════════════════════════════════════
  // TV — MOOD & CONTEXT
  // ══════════════════════════════════════════════════════
  { name: 'The Series That Ate Your Weekend',         genres: '18,53',   type: 'tv', extra: '&vote_count.gte=10000&vote_average.gte=8' },
  { name: 'Comfort TV for a Rough Week',              genres: '35,18',   type: 'tv', extra: '&vote_average.gte=7.5&vote_count.gte=3000' },
  { name: 'Binge-List: Not Starting Unless You\'re Ready', genres: '18,80', type: 'tv', extra: '&vote_average.gte=9&vote_count.gte=5000' },
  { name: 'Casual Viewing That Doesn\'t Demand Too Much', genres: '35',   type: 'tv', extra: '&vote_count.gte=3000&with_runtime.lte=30' },
  { name: 'Background TV That Secretly Grabs You',   genres: '35,10764', type: 'tv', extra: '&vote_count.gte=3000' },
  { name: 'Sleep-Preventers: Series Banned After 10pm', genres: '53,80', type: 'tv', extra: '&vote_average.gte=8.5&vote_count.gte=3000' },
  { name: 'Drama That Hit the Internet Like a Freight Train', genres: '18,53', type: 'tv', extra: '&vote_count.gte=15000&first_air_date.gte=2019-01-01' },
  { name: 'The Cult Favourites Everyone Finds Eventually', genres: '18,35', type: 'tv', extra: '&vote_average.gte=8.5&vote_count.lte=5000' },
  { name: 'Boredom Busters: Variety Pack',            genres: '35,28',   type: 'tv', extra: '&vote_count.gte=3000&page=2' },
  { name: 'The Kind of Series You Watch Twice',       genres: '18,53',   type: 'tv', extra: '&vote_average.gte=9&vote_count.gte=3000' },
  { name: 'Go Back and Relax: Easy Evening Series',   genres: '35',       type: 'tv', extra: '&vote_average.gte=7.5&with_runtime.lte=30' },
  { name: 'Stories That Spark the Conversation',      genres: '18,99',   type: 'tv', extra: '&vote_average.gte=8&page=2' },
  { name: 'Shows That Demand to Be Discussed',        genres: '18,53',   type: 'tv', extra: '&vote_count.gte=8000&vote_average.gte=8.2' },

  // ══════════════════════════════════════════════════════
  // TV — ANIMATED
  // ══════════════════════════════════════════════════════
  { name: 'Animated Series for Adults (Genuinely)',   genres: '16,35',   type: 'tv', extra: '&with_keywords=adult animation&vote_count.gte=3000' },
  { name: 'Anime That Changed the Game',              genres: '16,28',   type: 'tv', extra: '&with_keywords=anime&vote_average.gte=8' },
  { name: 'Anime Drama & Emotional Storytelling',     genres: '16,18',   type: 'tv', extra: '&with_keywords=anime&vote_average.gte=8.5' },
  { name: 'Animated Action Series Worth Your Time',   genres: '16,10759', type: 'tv', extra: '&vote_count.gte=2000' },
  { name: 'Feel-Good Family Animations',              genres: '16,10751', type: 'tv', extra: '&vote_average.gte=7.5&page=2' },

  // ══════════════════════════════════════════════════════
  // TV — MEDICAL, LEGAL, POLITICAL PROCEDURALS
  // ══════════════════════════════════════════════════════
  { name: 'Medical Dramas With Actual Weight',        genres: '18',       type: 'tv', extra: '&with_keywords=medical|hospital|doctor&vote_average.gte=7.5' },
  { name: 'Political Dramas That Mirror the Real World', genres: '10768,18', type: 'tv', extra: '&with_keywords=politics|government|election' },
  { name: 'Procedurals Worth Returning To Each Week', genres: '80,18',   type: 'tv', extra: '&vote_count.gte=5000&vote_average.gte=7.8' },

  // ══════════════════════════════════════════════════════
  // SPECIAL PICKS (Home-page appropriate, any type)
  // ══════════════════════════════════════════════════════
  { name: 'Hidden Gems: The Algorithm Never Shows You These', genres: '18,53', type: 'movie', extra: '&vote_average.gte=8&vote_count.gte=500&vote_count.lte=3000' },
  { name: 'The Critics Loved These. So Will You.',    genres: '18',       type: 'movie', extra: '&vote_average.gte=8.5&vote_count.gte=2000' },
  { name: 'Films That Made History at the Box Office', genres: '28,12',   type: 'movie', extra: '&vote_count.gte=25000' },
  { name: 'New Releases: Not to Sleep On',            genres: '18,53',   type: 'movie', extra: '&primary_release_date.gte=2024-01-01&vote_count.gte=500' },
  { name: 'Series: Not to Sleep On',                  genres: '18,53',   type: 'tv',    extra: '&first_air_date.gte=2024-01-01&vote_count.gte=500' },
  { name: 'Cult Films That Finally Found Their Audience', genres: '35,27', type: 'movie', extra: '&vote_average.gte=7.5&vote_count.gte=1000&vote_count.lte=5000' },
  { name: 'Films You Can\'t Explain Why You Love',   genres: '35,28',    type: 'movie', extra: '&vote_count.gte=10000&page=3' },
  { name: 'Period Dramas Worth the Costume Budget',   genres: '18,36',   type: 'tv',    extra: '&vote_count.gte=2000&vote_average.gte=8' },
  { name: 'Period Romances: Swoon-Worthy Drama',      genres: '18,10749', type: 'tv',   extra: '&with_keywords=historical romance|period drama' },
  { name: 'Stories That Expand How You See the World', genres: '18,99',  type: 'movie', extra: '&vote_average.gte=8&vote_count.gte=1000' },
];

// ─── Day-of-week themed rows ──────────────────────────────────────────────────
// Mixture syntax: "Name1|Name2|Name3" paired with "Genres1|Genres2|Genres3"
// One is picked deterministically by hash each day to vary the experience.
export const DAY_STREAMS: Record<string, MicroGenreEntry> = {
  Monday: {
    name:   'Monday Motivation|Start the Week Strong|Beat the Monday Feeling',
    genres: '18|28,12|35,18',
    type:   'movie',
    extra:  '&vote_average.gte=7.5',
  },
  Tuesday: {
    name:   'Tuesday Discoveries|International Breakout Hits|Films the World Loved First',
    genres: '18|18|18',
    type:   'movie',
    extra:  '&without_original_language=en&vote_average.gte=7.8',
  },
  Wednesday: {
    name:   'Hump Day Thrillers|Wednesday Night Tension|Mind-Bending Wednesday Watch',
    genres: '53|53,9648|878,53',
    type:   'movie',
    extra:  '&vote_count.gte=5000',
  },
  Thursday: {
    name:   'Throwback Thursday|Before They Were Blockbusters|90s Night: The Essential Cut',
    genres: '18,35|28,12|18,35',
    type:   'movie',
    extra:  '&primary_release_date.lte=2000-01-01&vote_count.gte=5000',
  },
  Friday: {
    name:   'Friday Night Hits|Start the Weekend Right|Big Friday Energy',
    genres: '28,12|28,12,35|28,12',
    type:   'movie',
    extra:  '&vote_count.gte=10000',
  },
  Saturday: {
    name:   'Saturday Night Spectacles|Family Film Night|Epic Saturday Watch',
    genres: '28,12,10751|16,10751|28,14,878',
    type:   'movie',
    extra:  '&vote_count.gte=5000',
  },
  Sunday: {
    name:   'Sunday Prestige Binge|The Long Sunday Series|Sunday Night Drama',
    genres: '18,80|18,53|18',
    type:   'tv',
    extra:  '&vote_count.gte=5000&vote_average.gte=8',
  },
};

// ─── Time-of-Day Streams ──────────────────────────────────────────────────────
// Keyed by: 'morning' | 'afternoon' | 'evening' | 'late_night' | 'night_owl'
export const TIME_STREAMS: Record<string, MicroGenreEntry[]> = {
  morning: [
    { name: 'Feel-Good Starts: Morning Pick-Me-Up Films',     genres: '35,18',    type: 'movie', extra: '&with_keywords=uplifting|feel good&vote_average.gte=7' },
    { name: 'Animated Mornings for the Whole Household',      genres: '16,10751', type: 'movie', extra: '&vote_average.gte=7.5' },
    { name: 'Light Documentaries Over Your First Coffee',     genres: '99',       type: 'movie', extra: '&with_runtime.lte=90&vote_average.gte=7.5' },
    { name: 'Inspiring True Stories to Kick Off the Day',     genres: '18,99',    type: 'movie', extra: '&with_keywords=true story|inspiring' },
    { name: 'Easy Morning Viewing: Nature Docs',              genres: '99',       type: 'movie', extra: '&with_keywords=nature|wildlife' },
    { name: 'Short & Sharp Morning Comedies',                 genres: '35',       type: 'tv',    extra: '&with_runtime.lte=30&vote_count.gte=3000' },
  ],
  afternoon: [
    { name: 'Afternoon Blockbusters: No Commitment Needed',   genres: '28,12',    type: 'movie', extra: '&vote_count.gte=10000' },
    { name: 'Adventure Films for a Slow Afternoon',           genres: '12,14',    type: 'movie', extra: '&vote_count.gte=5000' },
    { name: 'Family Matinee Picks',                           genres: '10751,35', type: 'movie', extra: '&vote_average.gte=7&vote_count.gte=3000' },
    { name: 'Crowd-Pleasing Comedies: Afternoon Edition',     genres: '35',       type: 'movie', extra: '&vote_count.gte=10000' },
    { name: 'Sports Dramas & Underdog Stories',               genres: '18',       type: 'movie', extra: '&with_keywords=sport|football|basketball|boxing' },
    { name: 'Afternoon Sci-Fi: Big Ideas, Easy Watch',        genres: '878,12',   type: 'movie', extra: '&vote_count.gte=5000' },
  ],
  evening: [
    { name: 'Tonight\'s Prestige Pick',                       genres: '18',       type: 'movie', extra: '&vote_average.gte=8&vote_count.gte=5000' },
    { name: 'Evening Thrillers Worth Silencing Your Phone For', genres: '53,9648', type: 'movie', extra: '&vote_count.gte=5000' },
    { name: 'Tonight\'s Premium Drama',                       genres: '18,53',    type: 'tv',    extra: '&vote_average.gte=8.5&vote_count.gte=3000' },
    { name: 'Perfect Evening: Crime Drama Picks',             genres: '80,18',    type: 'tv',    extra: '&vote_count.gte=5000&vote_average.gte=8' },
    { name: 'Sophisticated Evening Cinema',                   genres: '18',       type: 'movie', extra: '&without_original_language=en&vote_average.gte=8' },
    { name: 'International Cinema for Your Evening',          genres: '18,53',    type: 'movie', extra: '&without_original_language=en&vote_average.gte=7.5' },
  ],
  late_night: [
    { name: 'Late Night Thrillers: Just One More',            genres: '53,9648',  type: 'movie', extra: '&vote_average.gte=7.5&vote_count.gte=3000' },
    { name: 'Psychological Horror for the Dark Hours',        genres: '27,53',    type: 'movie', extra: '&vote_average.gte=7.5' },
    { name: 'Mind-Bending Late Night Sci-Fi',                 genres: '878,9648', type: 'movie', extra: '&vote_count.gte=3000&vote_average.gte=7.5' },
    { name: 'Dark Crime Sagas: After Midnight',               genres: '80,18',    type: 'movie', extra: '&vote_count.gte=5000&vote_average.gte=8' },
    { name: 'The Series That Stole Your Sleep Last Time',     genres: '53,18',    type: 'tv',    extra: '&vote_average.gte=9&vote_count.gte=3000' },
    { name: 'Neo-Noir: Late Night City Thrillers',            genres: '80,53',    type: 'movie', extra: '&with_keywords=neo-noir|noir|detective' },
  ],
  night_owl: [
    { name: 'Night Owl Comfort: Long-Form TV to Fall Asleep To', genres: '35,18', type: 'tv',   extra: '&vote_average.gte=8&vote_count.gte=5000' },
    { name: 'Quiet Late-Night Documentaries',                 genres: '99',       type: 'movie', extra: '&with_runtime.lte=100&vote_average.gte=7.5' },
    { name: 'Gentle Comedy Reruns for 3am',                   genres: '35',       type: 'tv',    extra: '&vote_average.gte=8.5&with_runtime.lte=30' },
    { name: 'Ambient Cinema: Visually Stunning Films',        genres: '14,878',   type: 'movie', extra: '&vote_count.gte=5000&vote_average.gte=8' },
  ],
};

// ─── Seasonal Streams ─────────────────────────────────────────────────────────
export const SEASON_STREAMS: Record<string, MicroGenreEntry[]> = {
  spring: [
    { name: 'Spring Awakening: Feel-Good Films',          genres: '35,10749', type: 'movie', extra: '&vote_average.gte=7&vote_count.gte=3000' },
    { name: 'New Beginnings: Stories of Fresh Starts',    genres: '18,35',    type: 'movie', extra: '&with_keywords=new start|new life|fresh start' },
    { name: 'Light & Breezy Comedies for Longer Days',    genres: '35',       type: 'movie', extra: '&vote_count.gte=5000&with_runtime.lte=100' },
    { name: 'Romance Blooms: Spring Love Stories',        genres: '10749,35', type: 'movie', extra: '&vote_average.gte=7.5' },
    { name: 'Spring Series: Light Drama for Lighter Nights', genres: '18,35', type: 'tv',   extra: '&vote_average.gte=8&vote_count.gte=2000' },
  ],
  summer: [
    { name: 'Summer Blockbusters: The Essential Cut',     genres: '28,12',    type: 'movie', extra: '&vote_count.gte=15000' },
    { name: 'Beach Day Comedies & Holiday Films',         genres: '35',       type: 'movie', extra: '&with_keywords=beach|holiday|vacation|summer' },
    { name: 'Sun-Soaked Adventure Films',                 genres: '12,28',    type: 'movie', extra: '&vote_count.gte=5000' },
    { name: 'Summer Family Films for the Long Evenings',  genres: '10751,16', type: 'movie', extra: '&vote_average.gte=7' },
    { name: 'Road Trip Films: Hit Play and Drive',        genres: '35,12',    type: 'movie', extra: '&with_keywords=road trip' },
    { name: 'Binge Before Autumn: The Summer Watchlist',  genres: '18,53',    type: 'tv',    extra: '&vote_average.gte=8.5&vote_count.gte=3000' },
  ],
  autumn: [
    { name: 'Autumn Evenings: Cosy Mystery Series',       genres: '9648,80',  type: 'tv',    extra: '&vote_average.gte=7.5&vote_count.gte=2000' },
    { name: 'Dark Drama for the Darker Nights',           genres: '18,53',    type: 'movie', extra: '&vote_average.gte=8&vote_count.gte=3000' },
    { name: 'Gothic & Atmospheric Series',                genres: '27,18',    type: 'tv',    extra: '&with_keywords=gothic|atmospheric|moody' },
    { name: 'Prestige Autumn Cinema',                     genres: '18',       type: 'movie', extra: '&vote_average.gte=8.5&vote_count.gte=2000' },
    { name: 'Cold-Night Thrillers: Wrap Up Tight',        genres: '53,9648',  type: 'movie', extra: '&vote_count.gte=5000' },
    { name: 'Scandinavian Noir: Perfect Autumn Viewing',  genres: '80,53',    type: 'tv',    extra: '&with_origin_country=SE,NO,DK,FI' },
  ],
  winter: [
    { name: 'Cosy Winter Nights: Comfort Drama',          genres: '18,35',    type: 'tv',    extra: '&vote_average.gte=8&vote_count.gte=3000' },
    { name: 'Epic Winter Binges: Saga Series',            genres: '14,10765', type: 'tv',    extra: '&vote_count.gte=5000&vote_average.gte=8' },
    { name: 'Long, Cold Nights: Long, Great Films',       genres: '18,28',    type: 'movie', extra: '&with_runtime.gte=140&vote_average.gte=8' },
    { name: 'Winter Family Films: All Together Now',      genres: '10751,16', type: 'movie', extra: '&vote_average.gte=7.5&vote_count.gte=3000' },
    { name: 'Dark & Gripping: What Winters Were Made For', genres: '80,53',   type: 'tv',    extra: '&vote_average.gte=8.5&vote_count.gte=3000' },
    { name: 'Fireplace Films: Slow, Warm, Meaningful',    genres: '18',       type: 'movie', extra: '&vote_average.gte=8.5&vote_count.gte=1000' },
  ],
};

// ─── Holiday & Event Streams ──────────────────────────────────────────────────
export const HOLIDAY_STREAMS: Record<string, MicroGenreEntry[]> = {
  christmas: [
    { name: 'Christmas Films That Became Family Tradition',   genres: '10751,35', type: 'movie', extra: '&with_keywords=christmas|xmas|holiday season' },
    { name: 'Festive Feel-Good Films for Christmas Eve',      genres: '35,10749', type: 'movie', extra: '&with_keywords=christmas|festive|holiday' },
    { name: 'Christmas Drama: The Emotional Ones',            genres: '18,10749', type: 'movie', extra: '&with_keywords=christmas|holiday|winter' },
    { name: 'Animated Christmas Classics',                    genres: '16,10751', type: 'movie', extra: '&with_keywords=christmas|santa|holiday' },
    { name: 'Christmas Series: Cosy and Warming',             genres: '35,18',    type: 'tv',    extra: '&with_keywords=christmas|festive' },
  ],
  halloween: [
    { name: 'Halloween Night Horrors: The Full Menu',         genres: '27',       type: 'movie', extra: '&vote_count.gte=5000' },
    { name: 'Psychological Terror for the Spooky Season',     genres: '27,53',    type: 'movie', extra: '&vote_average.gte=7.5' },
    { name: 'Halloween Horror Anthologies',                   genres: '27,9648',  type: 'tv',    extra: '&with_keywords=anthology|horror stories' },
    { name: 'Haunted House Films: Best in Class',             genres: '27',       type: 'movie', extra: '&with_keywords=haunted house|ghost|haunting' },
    { name: 'Horror Comedies: Scary Enough, Still Fun',       genres: '27,35',    type: 'movie', extra: '&vote_count.gte=1000' },
    { name: 'Creepy Series to Watch With the Lights Off',     genres: '27,53',    type: 'tv',    extra: '&vote_average.gte=8' },
  ],
  valentines: [
    { name: 'Valentine\'s Night: The Films That Deliver',     genres: '10749,35', type: 'movie', extra: '&vote_average.gte=7.5&vote_count.gte=3000' },
    { name: 'Love Stories That Stand the Test of Time',       genres: '10749,18', type: 'movie', extra: '&vote_count.gte=5000&vote_average.gte=7.8' },
    { name: 'Date Night Picks: Crowd-Tested & Approved',      genres: '35,10749', type: 'movie', extra: '&vote_count.gte=5000' },
    { name: 'Romantic Dramas That Actually Have Depth',       genres: '18,10749', type: 'movie', extra: '&vote_average.gte=8&vote_count.gte=2000' },
    { name: 'Romance Series Worth Starting Together',         genres: '18,10749', type: 'tv',    extra: '&vote_average.gte=8&vote_count.gte=1000' },
  ],
  new_year: [
    { name: 'New Year, New Series: The Watchlist Starters',   genres: '18,53',    type: 'tv',    extra: '&vote_average.gte=8.5&vote_count.gte=3000' },
    { name: 'Reset Button Films: New Beginnings',             genres: '18,35',    type: 'movie', extra: '&with_keywords=new start|new year|resolution' },
    { name: 'New Year\'s Eve Crowd-Pleasers',                 genres: '35,28',    type: 'movie', extra: '&vote_count.gte=10000' },
    { name: 'Goal-Setting: Inspiring True Stories',           genres: '18,99',    type: 'movie', extra: '&with_keywords=true story|inspiring|triumph' },
  ],
  easter: [
    { name: 'Easter Weekend Family Films',                    genres: '10751,16', type: 'movie', extra: '&vote_average.gte=7' },
    { name: 'Bank Holiday Adventure Films',                   genres: '12,28',    type: 'movie', extra: '&vote_count.gte=5000' },
    { name: 'Long Weekend Binge Series',                      genres: '18,53',    type: 'tv',    extra: '&vote_average.gte=8&vote_count.gte=5000' },
  ],
  summer_break: [
    { name: 'School\'s Out: Big Summer Films',                genres: '28,12,10751', type: 'movie', extra: '&vote_count.gte=5000' },
    { name: 'Summer Playlist: Binge-Worthy Series',           genres: '18,35',    type: 'tv',    extra: '&vote_average.gte=8&vote_count.gte=3000' },
    { name: 'Teen Summer Favourites',                         genres: '35,18',    type: 'movie', extra: '&with_keywords=summer|teen|high school&vote_count.gte=2000' },
  ],
};