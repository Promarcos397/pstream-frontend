import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CaretLeftIcon, CaretRightIcon, BookOpenIcon } from '@phosphor-icons/react';
import { Movie } from '../types';
import BookHero from '../components/BookHero';

interface Issue {
    id: string;
    title: string;
    issueNumber: string;
    coverUrl: string | null;
    seriesId: number;
}

interface Series {
    id: number;
    title: string;
    issues: Issue[];
}

interface ReadsPageProps {
    onSelectBook: (book: Movie) => void;
    onRead: (book: Movie, chapterId: string) => void;
}

// Issue Card Component - Lightweight with lazy image loading
const IssueCard: React.FC<{
    issue: Issue;
    seriesTitle: string;
    onRead: (book: Movie, chapterId: string) => void;
    isVisible: boolean;
}> = ({ issue, seriesTitle, onRead, isVisible }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);

    const handleClick = () => {
        const book: Movie = {
            id: issue.seriesId,
            title: seriesTitle,
            name: seriesTitle,
            poster_path: issue.coverUrl,
            media_type: 'series',
            overview: '',
            vote_average: 0
        };
        onRead(book, issue.id);
    };

    return (
        <div
            className="relative flex-none cursor-pointer group"
            style={{ width: '140px' }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={handleClick}
        >
            {/* Cover Image */}
            <div
                className={`relative overflow-hidden rounded bg-zinc-800 transition-all duration-200 ${isHovered ? 'ring-2 ring-white/80 scale-[1.02]' : ''}`}
                style={{ aspectRatio: '2/3' }}
            >
                {/* Only load image if visible */}
                {isVisible && issue.coverUrl ? (
                    <>
                        {/* Skeleton while loading */}
                        {!imageLoaded && (
                            <div className="absolute inset-0 bg-zinc-800 animate-pulse" />
                        )}
                        <img
                            src={issue.coverUrl}
                            alt={issue.title}
                            className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                            loading="lazy"
                            onLoad={() => setImageLoaded(true)}
                        />
                    </>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">
                        Issue #{issue.issueNumber}
                    </div>
                )}

                {/* Hover Overlay - Book icon instead of play */}
                <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="bg-white/90 rounded-full p-2.5">
                        <BookOpenIcon size={18} weight="fill" className="text-black" />
                    </div>
                </div>

                {/* Issue Label on Card */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6">
                    <span className="text-white text-xs font-medium">Issue #{issue.issueNumber}</span>
                </div>
            </div>
        </div>
    );
};

// Series Row Component with lazy loading
const SeriesRow: React.FC<{
    series: Series;
    onRead: (book: Movie, chapterId: string) => void;
}> = ({ series, onRead }) => {
    const rowRef = useRef<HTMLDivElement>(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(true);
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: 8 }); // Only render first 8 initially
    const isLoadingMore = useRef(false);

    const updateScrollState = useCallback(() => {
        if (!rowRef.current) return;
        const { scrollLeft, scrollWidth, clientWidth } = rowRef.current;
        setShowLeftArrow(scrollLeft > 20);
        setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 20);

        // Calculate which items are visible based on scroll position
        const itemWidth = 152; // 140px + 12px gap
        const startIndex = Math.floor(scrollLeft / itemWidth);
        const visibleCount = Math.ceil(clientWidth / itemWidth) + 4; // Add buffer

        setVisibleRange(prev => ({
            start: Math.max(0, startIndex - 2),
            end: Math.min(series.issues.length, Math.max(prev.end, startIndex + visibleCount + 4))
        }));
    }, [series.issues.length]);

    useEffect(() => {
        updateScrollState();
    }, [updateScrollState]);

    const scroll = (direction: 'left' | 'right') => {
        if (!rowRef.current || isLoadingMore.current) return;

        const scrollAmount = rowRef.current.clientWidth * 0.75;
        rowRef.current.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth'
        });
    };

    // Preload more items when hovering arrows
    const handleArrowHover = (direction: 'left' | 'right') => {
        if (direction === 'right') {
            setVisibleRange(prev => ({
                ...prev,
                end: Math.min(series.issues.length, prev.end + 6)
            }));
        }
    };

    if (series.issues.length === 0) return null;

    return (
        <div className="mb-10">
            {/* Series Title */}
            <h2 className="text-lg md:text-xl font-bold text-white mb-3 px-4 md:px-12 flex items-center gap-2">
                {series.title}
                <span className="text-white/30 font-normal text-sm">
                    {series.issues.length} issues
                </span>
            </h2>

            <div className="relative group/row">
                {/* Left Arrow */}
                <button
                    onClick={() => scroll('left')}
                    onMouseEnter={() => handleArrowHover('left')}
                    className={`absolute left-0 top-0 bottom-0 w-12 md:w-14 bg-gradient-to-r from-[#141414] via-[#141414]/80 to-transparent z-20 flex items-center justify-start pl-2 transition-opacity ${showLeftArrow ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                >
                    <CaretLeftIcon size={24} className="text-white" weight="bold" />
                </button>

                {/* Scrollable Row */}
                <div
                    ref={rowRef}
                    onScroll={updateScrollState}
                    className="flex gap-3 overflow-x-auto scrollbar-hide px-4 md:px-12 py-1"
                >
                    {series.issues.map((issue, index) => (
                        <IssueCard
                            key={issue.id}
                            issue={issue}
                            seriesTitle={series.title}
                            onRead={onRead}
                            isVisible={index >= visibleRange.start && index <= visibleRange.end}
                        />
                    ))}
                </div>

                {/* Right Arrow */}
                <button
                    onClick={() => scroll('right')}
                    onMouseEnter={() => handleArrowHover('right')}
                    className={`absolute right-0 top-0 bottom-0 w-12 md:w-14 bg-gradient-to-l from-[#141414] via-[#141414]/80 to-transparent z-20 flex items-center justify-end pr-2 transition-opacity ${showRightArrow && series.issues.length > 5 ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                >
                    <CaretRightIcon size={24} className="text-white" weight="bold" />
                </button>
            </div>
        </div>
    );
};

const ReadsPage: React.FC<ReadsPageProps> = ({ onSelectBook, onRead }) => {
    const { t } = useTranslation();
    const [seriesList, setSeriesList] = useState<Series[]>([]);
    const [loading, setLoading] = useState(true);
    const fetchedRef = useRef(false); // Prevent double fetch

    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;
        fetchAllSeriesWithIssues();
    }, []);

    const fetchAllSeriesWithIssues = async () => {
        const electron = (window as any).electron;
        if (!electron?.cloud?.getSeries || !electron?.cloud?.getIssues) {
            setLoading(false);
            return;
        }

        try {
            const seriesRes = await electron.cloud.getSeries();
            if (!seriesRes.success) {
                setLoading(false);
                return;
            }

            // Fetch issues for each series
            const seriesWithIssues: Series[] = await Promise.all(
                seriesRes.data.map(async (s: any) => {
                    try {
                        const issuesRes = await electron.cloud.getIssues(s.id);
                        const issues: Issue[] = issuesRes.success
                            ? issuesRes.data.map((issue: any) => ({
                                id: issue.google_file_id || issue.id,
                                title: issue.story_arc || issue.title || `Issue #${issue.issue_number}`,
                                issueNumber: issue.issue_number?.toString() || '?',
                                coverUrl: issue.cover_google_id ? `comic://image?id=${issue.cover_google_id}` : null,
                                seriesId: s.id
                            }))
                            : [];

                        return {
                            id: s.id,
                            title: s.title,
                            issues: issues.sort((a: Issue, b: Issue) =>
                                parseInt(a.issueNumber) - parseInt(b.issueNumber)
                            )
                        };
                    } catch (e) {
                        return { id: s.id, title: s.title, issues: [] };
                    }
                })
            );

            setSeriesList(seriesWithIssues.filter(s => s.issues.length > 0));
        } catch (err) {
            console.error('Failed to load library:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative z-10 pb-12">
            <BookHero onSelect={onSelectBook} />

            <main className="-mt-10 md:-mt-20 relative z-20">
                {loading ? (
                    <div className="px-4 md:px-12 py-8">
                        <div className="flex items-center gap-3">
                            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            <span className="text-white/50 text-sm">Loading library...</span>
                        </div>
                    </div>
                ) : seriesList.length > 0 ? (
                    <>
                        {seriesList.map((series) => (
                            <SeriesRow
                                key={series.id}
                                series={series}
                                onRead={onRead}
                            />
                        ))}
                    </>
                ) : (
                    <div className="px-4 md:px-12 py-8">
                        <div className="text-white/40 text-sm">No comics in library</div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default ReadsPage;
