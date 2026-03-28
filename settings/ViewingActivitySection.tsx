import React from 'react';
import { useGlobalContext } from '../context/GlobalContext';
import { useTranslation } from 'react-i18next';
import { CaretRightIcon } from '@phosphor-icons/react';
import { TMDB_IMAGE_BASE } from '../constants';

const ViewingActivitySection: React.FC = () => {
    const { continueWatching, myList } = useGlobalContext();
    const { t } = useTranslation();
    const hasActivity = continueWatching.length > 0 || myList.length > 0;

    return (
        <div style={{ color: '#111' }}>

            {/* Recent History */}
            <div style={{ marginBottom: 32 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 16 }}>
                    {t('settings.viewingHistoryTitle')}
                </h3>

                {!hasActivity ? (
                    <p style={{ fontSize: 14, color: '#737373', textAlign: 'center', padding: '32px 0' }}>
                        {t('settings.viewingHistoryEmpty')}
                    </p>
                ) : (
                    <div>
                        {continueWatching.slice(0, 10).map((movie, idx) => (
                            <div
                                key={`history-${movie.id}-${idx}`}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 16,
                                    padding: '12px 0',
                                    borderBottom: idx < Math.min(continueWatching.length, 10) - 1 ? '1px solid #f5f5f5' : 'none',
                                }}
                            >
                                <div style={{ width: 40, height: 56, borderRadius: 3, overflow: 'hidden', flexShrink: 0, backgroundColor: '#f5f5f5' }}>
                                    <img
                                        src={`${TMDB_IMAGE_BASE}/w92${movie.poster_path}`}
                                        style={{ width: 40, height: 56, objectFit: 'cover', display: 'block' }}
                                        alt=""
                                    />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h4 style={{ fontSize: 14, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {movie.title || movie.name}
                                    </h4>
                                    <p style={{ fontSize: 12, color: '#737373', marginTop: 2 }}>
                                        {movie.release_date || movie.first_air_date ? new Date(movie.release_date || movie.first_air_date).getFullYear() : ''}
                                        {movie.media_type === 'tv' ? ` · ${t('common.series')}` : ` · ${t('common.movie')}`}
                                    </p>
                                </div>
                                <CaretRightIcon size={16} style={{ color: '#d4d4d4', flexShrink: 0 }} />
                            </div>
                        ))}
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
