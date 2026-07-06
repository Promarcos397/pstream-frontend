import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  DownloadSimpleIcon, CaretRightIcon, ShareNetworkIcon, DotsThreeVerticalIcon,
} from '@phosphor-icons/react';
import { useGlobalContext } from '../context/GlobalContext';
import RowMobile from '../components/RowMobile';
import MovieCardTouch from '../components/MovieCardTouch';
import ShareSheet from '../components/ShareSheet';
import ContinueWatchingOptionsSheet from '../components/ContinueWatchingOptionsSheet';
import { Movie } from '../types';
import { getOptimizedImageUrl } from '../utils/deviceHelper';
import { useTrailerHistoryStore } from '../store/useTrailerHistoryStore';
import { useProfileStore } from '../store/useProfileStore';
import { PlayIcon } from '@phosphor-icons/react';

interface MyNetflixSectionProps {
  onSelectMovie: (movie: Movie, time?: number, videoId?: string) => void;
  onPlay: (movie: Movie) => void;
}

const shareUrlFor = (movie: Movie) => {
  const type = movie.media_type || (movie.title ? 'movie' : 'tv');
  return `${window.location.origin}/title/${type}/${movie.id}`;
};

/**
 * The "My Netflix" tab (bottom nav → Profile) — a personalized activity feed
 * mirroring Netflix's own: Downloads card, Continue Watching, Recently
 * Watched, Liked (with per-card Share), and My List with a See All link.
 * Profile/settings management lives behind the header's avatar+caret sheet.
 */
const MyNetflixSection: React.FC<MyNetflixSectionProps> = ({ onSelectMovie, onPlay }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { continueWatching, myList, getLikedMovies, getLastWatchedEpisode, clearVideoState } = useGlobalContext();
  const activeProfileId = useProfileStore(s => s.activeProfileId);
  const trailerWatches = useTrailerHistoryStore(s => s.watches);

  const likedMovies = getLikedMovies().map(l => l.movie);
  const recentlyWatched = continueWatching.slice(0, 8);
  const trailersWatched = trailerWatches
    .filter(w => w.profileId === activeProfileId)
    .map(w => w.movie)
    .slice(0, 12);
  // "Reminders" = list entries that haven't released yet — the one real
  // remind-me semantic this app has (you saved something upcoming).
  const reminders = myList.filter(m => {
    const d = m.release_date || m.first_air_date;
    return d && new Date(d).getTime() > Date.now();
  });
  const [shareMovie, setShareMovie] = useState<Movie | null>(null);
  const [optionsMovie, setOptionsMovie] = useState<Movie | null>(null);

  const isEmpty = continueWatching.length === 0 && likedMovies.length === 0 && myList.length === 0 && trailersWatched.length === 0;

  const SectionTitle: React.FC<{ children: React.ReactNode; onSeeAll?: () => void }> = ({ children, onSeeAll }) => (
    <div className="flex items-center justify-between px-6 mb-3">
      <h2 className="text-[22px] font-bold text-white">{children}</h2>
      {onSeeAll && (
        <button onClick={onSeeAll} className="flex items-center gap-1 text-white text-[15px] font-semibold active:opacity-70">
          {t('common.seeAll', { defaultValue: 'See All' })}
          <CaretRightIcon size={16} weight="bold" />
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-black pt-16 pb-28 animate-fadeIn">
      {/* Downloads card — greyed like Netflix's empty state (no downloads backend) */}
      <div className="px-4 mb-7">
        <div className="bg-[#141414] rounded-xl px-4 py-4 flex items-start gap-4">
          <DownloadSimpleIcon size={26} className="text-white/35 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="block text-white/45 text-[18px] font-bold">
              {t('myNetflix.downloads', { defaultValue: 'Downloads' })}
            </span>
            <p className="text-white/30 text-[15px] mt-1 leading-snug">
              {t('myNetflix.downloadsEmpty', { defaultValue: 'Series and films that you download appear here.' })}
            </p>
          </div>
          <CaretRightIcon size={18} className="text-white/25 mt-1.5 shrink-0" />
        </div>
      </div>

      {/* My List — plain posters with See All */}
      {myList.length > 0 && (
        <div className="my-6">
          <SectionTitle onSeeAll={() => navigate('/browse/my-list')}>
            {t('nav.myList', { defaultValue: 'My List' })}
          </SectionTitle>
          <div className="flex overflow-x-scroll scrollbar-hide px-6 gap-2" style={{ WebkitOverflowScrolling: 'touch' }}>
            {myList.map(movie => (
              <div key={movie.id} className="flex-none">
                <MovieCardTouch movie={movie} onSelect={onSelectMovie} onPlay={onPlay} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Continue Watching — info/dots footer cards. Same title as Home for consistency. */}
      {continueWatching.length > 0 && (
        <RowMobile
          title={t('rows.continueWatching', { defaultValue: "Here's Where You Left Off" })}
          data={continueWatching}
          rowKey="continue-watching"
          onSelect={onSelectMovie}
          onPlay={onPlay}
        />
      )}

      {/* Recently Watched — landscape stills with share + options */}
      {recentlyWatched.length > 0 && (
        <div className="my-6">
          <SectionTitle>{t('myNetflix.recentlyWatched', { defaultValue: 'Recently Watched' })}</SectionTitle>
          <div className="flex overflow-x-scroll scrollbar-hide px-6 gap-3" style={{ WebkitOverflowScrolling: 'touch' }}>
            {recentlyWatched.map(movie => {
              const backdrop = getOptimizedImageUrl(movie.backdrop_path || movie.poster_path, 'backdrop', true);
              if (!backdrop) return null;
              const isTv = movie.media_type === 'tv' || (!movie.media_type && !movie.title);
              const ep = isTv ? getLastWatchedEpisode(String(movie.id)) : undefined;
              const label = ep
                ? `S${ep.season}:E${ep.episode} · ${movie.name || movie.title}`
                : (movie.title || movie.name);
              return (
                <div key={movie.id} className="flex-none w-[62vw]">
                  <div
                    className="relative aspect-video rounded-lg overflow-hidden bg-zinc-900 active:scale-[0.98] transition-transform"
                    onClick={() => onPlay(movie)}
                  >
                    <img src={backdrop} alt="" className="w-full h-full object-cover" loading="lazy" />
                    <div className="absolute bottom-2 right-2 flex items-center gap-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShareMovie(movie); }}
                        className="text-white drop-shadow-md active:scale-90 transition-transform"
                        aria-label={t('common.share', { defaultValue: 'Share' })}
                      >
                        <ShareNetworkIcon size={20} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setOptionsMovie(movie); }}
                        className="text-white drop-shadow-md active:scale-90 transition-transform"
                        aria-label={t('common.moreOptions', { defaultValue: 'More options' })}
                      >
                        <DotsThreeVerticalIcon size={20} weight="bold" />
                      </button>
                    </div>
                  </div>
                  <p className="text-white text-[16px] font-medium text-center mt-2 truncate">{label}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trailers You've Watched — fed by real TrailerPlayer playback events */}
      {trailersWatched.length > 0 && (
        <div className="my-6">
          <SectionTitle>{t('myNetflix.trailersWatched', { defaultValue: "Trailers You've Watched" })}</SectionTitle>
          <div className="flex overflow-x-scroll scrollbar-hide px-6 gap-2" style={{ WebkitOverflowScrolling: 'touch' }}>
            {trailersWatched.map(movie => (
              <div key={movie.id} className="flex-none">
                <MovieCardTouch movie={movie} onSelect={onSelectMovie} onPlay={onPlay} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reminders You've Set — saved titles that haven't released yet */}
      {reminders.length > 0 && (
        <div className="my-6">
          <SectionTitle>{t('myNetflix.reminders', { defaultValue: "Reminders You've Set" })}</SectionTitle>
          <div className="flex overflow-x-scroll scrollbar-hide px-6 gap-2" style={{ WebkitOverflowScrolling: 'touch' }}>
            {reminders.map(movie => {
              const poster = getOptimizedImageUrl(movie.poster_path || movie.backdrop_path, 'poster', true);
              if (!poster) return null;
              return (
                <div key={movie.id} className="flex-none w-[calc((100vw-3rem)/3.2)] rounded-lg overflow-hidden bg-[#181818]">
                  <div
                    className="aspect-[2/3] cursor-pointer active:scale-[0.97] transition-transform"
                    onClick={() => onSelectMovie(movie)}
                  >
                    <img src={poster} alt={movie.title || movie.name} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <button
                    onClick={() => onSelectMovie(movie)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 text-white text-[14px] font-bold active:bg-white/10 transition-colors"
                  >
                    <PlayIcon size={14} weight="fill" />
                    {t('hero.play', { defaultValue: 'Play' })}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Series & Films You've Liked — poster cards, each with a Share footer */}
      {likedMovies.length > 0 && (
        <div className="my-6">
          <SectionTitle>{t('myNetflix.liked', { defaultValue: "Series & Films You've Liked" })}</SectionTitle>
          <div className="flex overflow-x-scroll scrollbar-hide px-6 gap-2" style={{ WebkitOverflowScrolling: 'touch' }}>
            {likedMovies.map(movie => {
              const poster = getOptimizedImageUrl(movie.poster_path || movie.backdrop_path, 'poster', true);
              if (!poster) return null;
              return (
                <div key={movie.id} className="flex-none w-[calc((100vw-3rem)/3.2)] rounded-lg overflow-hidden bg-[#181818]">
                  <div
                    className="aspect-[2/3] cursor-pointer active:scale-[0.97] transition-transform"
                    onClick={() => onSelectMovie(movie)}
                  >
                    <img src={poster} alt={movie.title || movie.name} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <button
                    onClick={() => setShareMovie(movie)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 text-white/85 text-[13px] font-semibold active:bg-white/10 transition-colors"
                  >
                    <ShareNetworkIcon size={16} />
                    {t('common.share', { defaultValue: 'Share' })}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isEmpty && (
        <p className="text-white/40 text-center text-[14px] mt-12 px-8 leading-relaxed">
          {t('myNetflix.empty', { defaultValue: 'Titles you watch, like, or add to your list will show up here.' })}
        </p>
      )}

      <ShareSheet
        open={!!shareMovie}
        title={shareMovie ? (shareMovie.title || shareMovie.name || '') : ''}
        url={shareMovie ? shareUrlFor(shareMovie) : ''}
        thumbnailUrl={shareMovie ? getOptimizedImageUrl(shareMovie.backdrop_path || shareMovie.poster_path, 'backdrop', true) || undefined : undefined}
        onClose={() => setShareMovie(null)}
      />

      <ContinueWatchingOptionsSheet
        movie={optionsMovie}
        onClose={() => setOptionsMovie(null)}
        onRemove={(movie) => clearVideoState(movie.id)}
      />
    </div>
  );
};

export default MyNetflixSection;
