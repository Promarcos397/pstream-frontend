import React from 'react';
import { useGlobalContext } from '../context/GlobalContext';
import { useTranslation } from 'react-i18next';
import { CaretRightIcon } from '@phosphor-icons/react';
import { TMDB_IMAGE_BASE } from '../constants';

const ViewingActivitySection: React.FC = () => {
    const { continueWatching, myList, getVideoState } = useGlobalContext();
    const { t } = useTranslation();
    const hasActivity = continueWatching.length > 0 || myList.length > 0;

    return (
        <div style={{ color: '#111' }}>

            <div style={{ marginBottom: 40 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111', marginBottom: 24 }}>
                    {t('settings.viewingHistoryTitle', { defaultValue: 'Viewing Activity' })}
                </h3>
                
                {!hasActivity ? (
                    <div style={{ textAlign: 'center', padding: '60px 0', border: '1px dashed #d4d4d4', borderRadius: 4 }}>
                         <p style={{ fontSize: 15, color: '#737373' }}>
                             {t('settings.viewingHistoryEmpty', { defaultValue: 'You haven\'t watched anything yet.' })}
                         </p>
                    </div>
                ) : (
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', 
                        gap: 20 
                    }}>
                        {continueWatching.map((movie, idx) => {
                            const state = getVideoState(movie.id);
                            const progress = state && state.duration ? (state.time / state.duration) * 100 : 0;
                            
                            return (
                                <div 
                                    key={`history-grid-${movie.id}-${idx}`}
                                    style={{ cursor: 'pointer', transition: 'transform 0.2s ease' }}
                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                    <div style={{ 
                                        position: 'relative', 
                                        aspectRatio: '16/9', 
                                        borderRadius: 4, 
                                        overflow: 'hidden', 
                                        backgroundColor: '#111',
                                        marginBottom: 10
                                    }}>
                                        <img
                                            src={`${TMDB_IMAGE_BASE}/w300${movie.backdrop_path || movie.poster_path}`}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            alt=""
                                        />
                                        {/* Progress Bar Overlay */}
                                        {progress > 0 && (
                                            <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 3, backgroundColor: 'rgba(255,255,255,0.3)' }}>
                                                <div style={{ width: `${progress}%`, height: '100%', backgroundColor: '#e50914' }} />
                                            </div>
                                        )}
                                        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.2)', opacity: 0, transition: 'opacity 0.2s' }} />
                                    </div>
                                    <h4 style={{ fontSize: 14, fontWeight: 700, color: '#333', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {movie.title || movie.name}
                                    </h4>
                                    <div style={{ fontSize: 12, color: '#737373' }}>
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
                <>
                    <div style={{ height: 1, backgroundColor: '#f0f0f0', marginBottom: 24 }} />
                    <div>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 16 }}>{t('nav.myList')}</h3>
                        {myList.slice(0, 5).map((movie, idx) => (
                            <div
                                key={`list-${movie.id}-${idx}`}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '10px 0',
                                    borderBottom: idx < Math.min(myList.length, 5) - 1 ? '1px solid #f5f5f5' : 'none',
                                }}
                            >
                                <span style={{ fontSize: 14, fontWeight: 500, color: '#111' }}>{movie.title || movie.name}</span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default ViewingActivitySection;
