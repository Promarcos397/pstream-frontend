import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Movie } from '../types';
import SpotlightCard from '../components/SpotlightCard';
import NewPopularSubNavMobile, { NewTab } from '../components/NewPopularSubNavMobile';
import { fetchData } from '../services/tmdb';
import { BASE_URL } from '../constants';

interface NewPopularMobilePageProps {
    onSelectMovie: (movie: Movie, time?: number, videoId?: string) => void;
    onPlay: (movie: Movie) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const fmtDate = (d: Date) => d.toISOString().split('T')[0];

/** Returns true if a release date string is within `days` days from now. */
const isWithinDays = (dateStr: string, days: number): boolean => {
    if (!dateStr) return false;
    const d = new Date(dateStr + 'T00:00:00');
    const now = Date.now();
    return d.getTime() <= now && now - d.getTime() < days * 86_400_000;
};

/** Merge + deduplicate two Movie arrays by id. */
const merge = (a: Movie[], b: Movie[]): Movie[] => {
    const map = new Map<string | number, Movie>();
    [...a, ...b].forEach(m => map.set(m.id, m));
    return Array.from(map.values());
};

// ─────────────────────────────────────────────────────────────────────────────
// URL builders (date-dependent, computed fresh each render)
// ─────────────────────────────────────────────────────────────────────────────

function getUrls() {
    const today       = fmtDate(new Date());
    const thirtyAgo   = fmtDate(new Date(Date.now() - 30 * 86_400_000));
    const twoWeeks    = fmtDate(new Date(Date.now() + 14 * 86_400_000));
    const sixMonths   = fmtDate(new Date(Date.now() + 180 * 86_400_000));

    return {
        // Everyone's Watching
        watching: `${BASE_URL}/trending/all/week`,

        // Just Landed — movies + TV from last 30 days
        justLandedMovies: `${BASE_URL}/discover/movie?primary_release_date.gte=${thirtyAgo}&primary_release_date.lte=${today}&sort_by=popularity.desc&vote_count.gte=3`,
        justLandedTv:     `${BASE_URL}/discover/tv?first_air_date.gte=${thirtyAgo}&first_air_date.lte=${today}&sort_by=popularity.desc`,

        // Top 10
        top10Movies: `${BASE_URL}/movie/top_rated`,
        top10Series: `${BASE_URL}/tv/top_rated`,

        // Coming Soon — movies + TV
        comingSoonMovies: `${BASE_URL}/movie/upcoming`,
        comingSoonTv:     `${BASE_URL}/discover/tv?first_air_date.gte=${today}&first_air_date.lte=${sixMonths}&sort_by=popularity.desc&vote_count.gte=3`,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Simple data-fetching hook
// ─────────────────────────────────────────────────────────────────────────────

function useMovies(urls: string[]): { movies: Movie[]; loading: boolean } {
    const [movies, setMovies] = useState<Movie[]>([]);
    const [loading, setLoading] = useState(true);
    const key = urls.join('|');

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        setMovies([]);

        Promise.all(urls.map(u => fetchData(u).catch(() => [] as Movie[])))
            .then(results => {
                if (!mounted) return;
                const merged = results.reduce<Movie[]>((acc, r) => merge(acc, r as Movie[]), []);
                setMovies(merged);
            })
            .finally(() => { if (mounted) setLoading(false); });

        return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    return { movies, loading };
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton loader
// ─────────────────────────────────────────────────────────────────────────────

const SpotlightSkeleton: React.FC = () => (
    <div className="w-full bg-[#1c1c1c] border border-white/[0.07] rounded-xl overflow-hidden animate-pulse">
        <div className="w-full aspect-video bg-white/[0.06]" />
        <div className="px-4 pt-3 pb-5 flex flex-col gap-3">
            <div className="h-6 w-2/3 bg-white/[0.07] rounded" />
            <div className="h-3 w-1/3 bg-white/[0.05] rounded" />
            <div className="h-3 w-full bg-white/[0.05] rounded" />
            <div className="h-3 w-5/6 bg-white/[0.05] rounded" />
            <div className="flex gap-2 mt-1">
                <div className="flex-1 h-11 bg-white/[0.10] rounded" />
                <div className="flex-1 h-11 bg-white/[0.05] rounded" />
            </div>
        </div>
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Feed renderer (shared between tabs)
// ─────────────────────────────────────────────────────────────────────────────

interface FeedProps {
    movies: Movie[];
    loading: boolean;
    onSelect: (m: Movie) => void;
    onPlay: (m: Movie) => void;
    isComingSoon?: boolean;
    getHidePlay?: (m: Movie) => boolean;
    getRank?: (i: number) => number | undefined;
    limit?: number;
}

const Feed: React.FC<FeedProps> = ({
    movies, loading, onSelect, onPlay,
    isComingSoon = false,
    getHidePlay,
    getRank,
    limit,
}) => {
    const { t } = useTranslation();
    const items = limit ? movies.slice(0, limit) : movies;

    if (loading) {
        return (
            <div className="flex flex-col gap-4">
                {[...Array(4)].map((_, i) => <SpotlightSkeleton key={i} />)}
            </div>
        );
    }

    if (!items.length) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/40">
                <span className="text-3xl">🎬</span>
                <p className="text-sm font-medium">{t('common.nothingToShow', { defaultValue: 'Nothing here yet' })}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {items.map((movie, i) => (
                <SpotlightCard
                    key={movie.id}
                    movie={movie}
                    onSelect={onSelect}
                    onPlay={onPlay}
                    rank={getRank ? getRank(i) : undefined}
                    isComingSoon={isComingSoon}
                    hidePlay={getHidePlay ? getHidePlay(movie) : false}
                    nextMovie={items[i + 1] ?? null}
                />
            ))}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

const DAYS_TOO_NEW = 7; // If released within 7 days → no play button

const NewPopularMobilePage: React.FC<NewPopularMobilePageProps> = ({
    onSelectMovie,
    onPlay,
}) => {
    const [activeTab, setActiveTab] = useState<NewTab>('watching');
    const urls = getUrls();

    // Pre-fetch all tabs on mount so switching tabs is instant
    const watching    = useMovies(activeTab === 'watching'    ? [urls.watching]                                       : []);
    const justLanded  = useMovies(activeTab === 'justlanded'  ? [urls.justLandedMovies, urls.justLandedTv]            : []);
    const top10Movies = useMovies(activeTab === 'top10movies' ? [urls.top10Movies]                                    : []);
    const top10Series = useMovies(activeTab === 'top10series' ? [urls.top10Series]                                    : []);
    const comingSoon  = useMovies(activeTab === 'comingsoon'  ? [urls.comingSoonMovies, urls.comingSoonTv]            : []);

    const hidePlayForJustLanded = useCallback(
        (m: Movie) => isWithinDays(m.release_date || m.first_air_date || '', DAYS_TOO_NEW),
        []
    );

    return (
        <div className="relative min-h-screen bg-black md:bg-[#141414]">
            {/* Sub-nav */}
            <NewPopularSubNavMobile activeTab={activeTab} onTabChange={setActiveTab} />

            {/* Spacer: mobile top header (56px) + sub-nav (~70px) + safe-area */}
            <div className="h-[calc(122px+env(safe-area-inset-top))]" />

            {/* Feed */}
            <div className="px-4 pb-[calc(90px+env(safe-area-inset-bottom))]">
                {activeTab === 'watching' && (
                    <Feed
                        movies={watching.movies}
                        loading={watching.loading}
                        onSelect={onSelectMovie}
                        onPlay={onPlay}
                    />
                )}

                {activeTab === 'justlanded' && (
                    <Feed
                        movies={justLanded.movies}
                        loading={justLanded.loading}
                        onSelect={onSelectMovie}
                        onPlay={onPlay}
                        getHidePlay={hidePlayForJustLanded}
                    />
                )}

                {activeTab === 'top10movies' && (
                    <Feed
                        movies={top10Movies.movies}
                        loading={top10Movies.loading}
                        onSelect={onSelectMovie}
                        onPlay={onPlay}
                        getRank={i => i + 1}
                        limit={10}
                    />
                )}

                {activeTab === 'top10series' && (
                    <Feed
                        movies={top10Series.movies}
                        loading={top10Series.loading}
                        onSelect={onSelectMovie}
                        onPlay={onPlay}
                        getRank={i => i + 1}
                        limit={10}
                    />
                )}

                {activeTab === 'comingsoon' && (
                    <Feed
                        movies={comingSoon.movies}
                        loading={comingSoon.loading}
                        onSelect={onSelectMovie}
                        onPlay={onPlay}
                        isComingSoon
                    />
                )}
            </div>
        </div>
    );
};

export default NewPopularMobilePage;
