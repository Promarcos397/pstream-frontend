import React from 'react';
import { useGlobalContext } from '../context/GlobalContext';
import { useTranslation } from 'react-i18next';
import { TMDB_IMAGE_BASE } from '../constants';

const ViewingActivitySection: React.FC = () => {
    const { continueWatching, myList, getVideoState } = useGlobalContext();
    const { t } = useTranslation();
    const hasActivity = continueWatching.length > 0 || myList.length > 0;

    return (
        <div className="text-gray-900 animate-fadeIn">

            <div className="mb-12">
                <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-6">
                    {t('settings.viewingHistoryTitle', { defaultValue: 'Viewing Activity' })}
                </h3>
                
                {!hasActivity ? (
                    <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-lg">
                         <p className="text-base text-gray-400">
                             {t('settings.viewingHistoryEmpty', { defaultValue: 'You haven\'t watched anything yet.' })}
                         </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                        {continueWatching.map((movie, idx) => {
                            const state = getVideoState(movie.id);
                            const progress = state && state.duration ? (state.time / state.duration) * 100 : 0;
                            
                            return (
                                <div 
                                    key={`history-grid-${movie.id}-${idx}`}
                                    className="group cursor-pointer transition-all duration-300 hover:scale-[1.02]"
                                >
                                    <div className="relative aspect-video rounded-md overflow-hidden bg-gray-900 mb-3 shadow-sm border border-gray-100">
                                        <img
                                            src={`${TMDB_IMAGE_BASE}/w300${movie.backdrop_path || movie.poster_path}`}
                                            className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                                            alt=""
                                        />
                                        {/* Progress Bar Overlay */}
                                        {progress > 0 && (
                                            <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20">
                                                <div className="h-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,1)]" style={{ width: `${progress}%` }} />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <h4 className="text-sm font-bold text-gray-900 mb-0.5 truncate pr-2">
                                        {movie.title || movie.name}
                                    </h4>
                                    <div className="text-xs text-gray-500 font-medium">
                                        {movie.release_date || movie.first_air_date ? new Date(movie.release_date || movie.first_air_date).getFullYear() : ''}
                                        {movie.media_type === 'tv' ? ` · ${t('common.series')}` : ` · ${t('common.movie')}`}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* My List */}
            {myList.length > 0 && (
                <div className="mt-12 space-y-4">
                    <div className="h-px bg-gray-100 mb-8" />
                    <h3 className="text-base font-bold text-gray-900 ml-1">{t('nav.myList')}</h3>
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                        {myList.slice(0, 10).map((movie, idx) => (
                            <div
                                key={`list-${movie.id}-${idx}`}
                                className={`flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors
                                    ${idx < Math.min(myList.length, 10) - 1 ? 'border-b border-gray-100' : ''}`}
                            >
                                <span className="text-sm font-semibold text-gray-800">{movie.title || movie.name}</span>
                                <div className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                                    {movie.media_type === 'tv' ? t('common.series') : t('common.movie')}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ViewingActivitySection;
