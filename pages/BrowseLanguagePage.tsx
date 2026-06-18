import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Movie } from '../types';
import MovieCard from '../components/MovieCard';
import { useIsMobile } from '../hooks/useIsMobile';
import { fetchData } from '../services/api';
import { BASE_URL, REQUESTS, SHADOW_BANNED_IDS } from '../constants';
import { LANG_LABELS } from '../data/languages';
import { CaretDownIcon } from '@phosphor-icons/react';

const BROWSE_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ru', label: 'Russian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
  { code: 'tr', label: 'Turkish' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pl', label: 'Polish' },
  { code: 'sv', label: 'Swedish' },
  { code: 'da', label: 'Danish' },
  { code: 'no', label: 'Norwegian' },
  { code: 'th', label: 'Thai' },
  { code: 'id', label: 'Indonesian' },
];

// Shuffled pool of TMDB pages generated once per browser session.
// Mixing early pages (high quality) with later pages prevents the
// quality-degrades-as-you-scroll problem when fetching sequentially.
const PAGE_POOL = Array.from({ length: 30 }, (_, i) => i + 1);
for (let i = PAGE_POOL.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [PAGE_POOL[i], PAGE_POOL[j]] = [PAGE_POOL[j], PAGE_POOL[i]];
}

const INIT_BATCH = 8;  // pages fetched on first load
const MORE_BATCH = 4;  // pages fetched per infinite-scroll trigger

// Fisher-Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface BrowseLanguagePageProps {
  onSelectMovie: (movie: Movie, time?: number, videoId?: string) => void;
  onPlay?: (movie: Movie) => void;
}

const BrowseLanguagePage: React.FC<BrowseLanguagePageProps> = ({ onSelectMovie, onPlay }) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  // ALL hooks declared before any conditional return
  const [selectedLang, setSelectedLang] = useState('en');
  const [items, setItems] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const cursorRef   = useRef(INIT_BATCH);  // index into PAGE_POOL
  const dropdownRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Desktop-only page — redirect mobile users immediately
  useEffect(() => {
    if (isMobile) navigate('/browse', { replace: true });
  }, [isMobile, navigate]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const buildUrls = useCallback((lang: string, pageNum: number) => {
    const minVoteMovie = lang === 'en' ? 50 : 10;
    const minVoteTV   = lang === 'en' ? 20 : 5;
    return {
      movie: REQUESTS._build(`${BASE_URL}/discover/movie`, {
        with_original_language: lang,
        sort_by: 'popularity.desc',
        'vote_count.gte': minVoteMovie,
        page: pageNum,
      }),
      tv: REQUESTS._build(`${BASE_URL}/discover/tv`, {
        with_original_language: lang,
        sort_by: 'popularity.desc',
        'vote_count.gte': minVoteTV,
        page: pageNum,
      }),
    };
  }, []);

  const loadData = useCallback(async (
    lang: string,
    pages: number[],  // specific TMDB page numbers to fetch (from PAGE_POOL)
    reset = false
  ) => {
    if (reset) setLoading(true);
    else setIsLoadingMore(true);

    try {
      // Fetch movie + tv for each requested page in parallel
      const fetches = pages.flatMap(p => {
        const { movie, tv } = buildUrls(lang, p);
        return [fetchData(movie), fetchData(tv)];
      });
      const results: Movie[][] = await Promise.all(fetches);

      // Even indices → movies, odd → tv
      const allMovies: Movie[] = [];
      const allTV: Movie[] = [];
      results.forEach((res, idx) => {
        if (!Array.isArray(res)) return;
        if (idx % 2 === 0) allMovies.push(...res.map(m => ({ ...m, media_type: 'movie' as const })));
        else               allTV.push(...res.map(m => ({ ...m, media_type: 'tv' as const })));
      });

      // Interleave 2 movies : 1 TV, then shuffle the whole batch
      const interleaved: Movie[] = [];
      let mi = 0, ti = 0;
      while (mi < allMovies.length || ti < allTV.length) {
        if (mi < allMovies.length) interleaved.push(allMovies[mi++]);
        if (mi < allMovies.length) interleaved.push(allMovies[mi++]);
        if (ti < allTV.length)     interleaved.push(allTV[ti++]);
      }
      const shuffled = shuffle(interleaved);

      // Dedup + quality filter + shadow ban
      const seenIds = new Set<number>();
      const minVotes = lang === 'en' ? 30 : 5;
      const filtered = shuffled.filter(m => {
        const id = Number(m.id);
        if (seenIds.has(id)) return false;
        seenIds.add(id);
        return (
          (m.backdrop_path || m.poster_path) &&
          (!m.vote_count || m.vote_count >= minVotes) &&
          !SHADOW_BANNED_IDS.has(id)
        );
      });

      setItems(prev => {
        if (reset) return filtered;
        const prevSeen = new Set(prev.map(m => Number(m.id)));
        return [...prev, ...filtered.filter(m => !prevSeen.has(Number(m.id)))];
      });

      // No more content when we've exhausted the page pool
      setHasMore(cursorRef.current < PAGE_POOL.length && filtered.length >= 5);
    } catch (e) {
      console.error('[BrowseLanguagePage] fetch error', e);
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  }, [buildUrls]);

  // Reset and reload when language changes
  useEffect(() => {
    setItems([]);
    cursorRef.current = INIT_BATCH;
    setHasMore(true);
    loadData(selectedLang, PAGE_POOL.slice(0, INIT_BATCH), true);
  }, [selectedLang]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    const pages = PAGE_POOL.slice(cursorRef.current, cursorRef.current + MORE_BATCH);
    if (pages.length === 0) { setHasMore(false); return; }
    cursorRef.current += pages.length;
    loadData(selectedLang, pages);
  }, [selectedLang, loadData, isLoadingMore, hasMore]);

  // Infinite scroll — trigger when sentinel is 600px from viewport
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) handleLoadMore(); },
      { rootMargin: '600px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [handleLoadMore]);

  // Render nothing while redirecting mobile users
  if (isMobile) return null;

  const selectedLabel = LANG_LABELS[selectedLang] || 'English';

  return (
    <div className="bg-black md:bg-[#141414] min-h-screen pb-20 pt-[calc(4rem+env(safe-area-inset-top))] md:pt-28">
      <div className="px-4 md:px-10 lg:px-14 pt-0 md:pt-1">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-20">
          <h1 className="text-white font-normal text-[22px] md:text-[26px] tracking-tight leading-tight">
            Browse by Language
          </h1>

          {/* Language selector */}
          <div className="flex items-center gap-4" ref={dropdownRef}>
            <span className="text-white/90 text-[15px] hidden md:block select-none">
              Select your preferences
            </span>
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(v => !v)}
                className={`flex items-center justify-between min-w-[180px] md:min-w-[210px] px-4 py-[7px] md:py-[8px] text-[13px] md:text-[14px] font-bold tracking-[-0.2px] text-white bg-black border border-white/80 hover:bg-white/5 transition-colors gap-x-3 ${dropdownOpen ? 'bg-white/5' : ''}`}
                aria-haspopup="listbox"
                aria-expanded={dropdownOpen}
              >
                <span>{selectedLabel}</span>
                <CaretDownIcon
                  size={12}
                  weight="fill"
                  className={`text-white transition-transform duration-200 shrink-0 ${dropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              <div
                className={`absolute right-0 top-full z-50 w-full transition-all duration-200
                  ${dropdownOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-1 pointer-events-none'}`}
                role="listbox"
              >
                <div className="w-full max-h-[420px] overflow-y-auto bg-[rgba(0,0,0,0.92)] border border-white/10 pt-2 pb-2 px-4 scrollbar-hide">
                  <div className="flex flex-col gap-y-1">
                    {BROWSE_LANGUAGES.map(({ code, label }) => (
                      <button
                        key={code}
                        onClick={() => { setSelectedLang(code); setDropdownOpen(false); }}
                        role="option"
                        aria-selected={code === selectedLang}
                        className={`text-left text-[15px] md:text-[16px] transition-colors hover:underline whitespace-nowrap ${
                          code === selectedLang ? 'text-white font-bold' : 'text-white font-normal'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Grid ───────────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-2.5 gap-y-4">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="aspect-video bg-[#1e1e1e] rounded-sm overflow-hidden relative border border-white/[0.04]">
                <div
                  className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.05] to-transparent"
                  style={{ animationDelay: `${(i % 6) * 0.1}s` }}
                />
                <div className="absolute inset-0 bg-gradient-to-b from-[#252525] via-[#1e1e1e] to-[#181818]" />
                <div className="absolute bottom-3 left-3 space-y-1.5">
                  <div className="h-2 bg-white/[0.08] rounded-full" style={{ width: `${40 + (i % 5) * 18}px` }} />
                  <div className="h-1.5 bg-white/[0.05] rounded-full" style={{ width: `${28 + (i % 3) * 10}px` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center mt-32 gap-3 text-white/40">
                <span className="text-4xl">🌐</span>
                <p className="text-lg">No titles found for {selectedLabel}.</p>
                <p className="text-sm">Try a different language.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-2.5 gap-y-10">
                {items.map(movie => (
                  <MovieCard
                    key={movie.id}
                    movie={movie}
                    onSelect={onSelectMovie}
                    onPlay={onPlay}
                    isGrid={true}
                  />
                ))}
              </div>
            )}

            {hasMore && <div ref={sentinelRef} className="h-1" />}

            {isLoadingMore && (
              <div className="flex justify-center mt-10">
                <div className="relative w-9 h-9">
                  <div className="absolute inset-0 rounded-full border-2 border-white/10" />
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-white/60 animate-spin" />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BrowseLanguagePage;
