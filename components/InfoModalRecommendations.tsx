import React from 'react';
import { useTranslation } from 'react-i18next';
import { Movie } from '../types';

interface InfoModalRecommendationsProps {
    recommendations: Movie[];
    onRecommendationClick: (rec: Movie) => void;
}

const InfoModalRecommendations: React.FC<InfoModalRecommendationsProps> = ({ recommendations, onRecommendationClick }) => {
    const { t } = useTranslation();
    if (!recommendations || recommendations.length === 0) return null;

    return (
        <div className="mt-10">
            <h3 className="text-xl md:text-2xl font-bold text-white mb-4">{t('modal.similar')}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
                {recommendations.map(rec => (
                    <div key={rec.id} className="bg-[#2f2f2f] rounded-sm overflow-hidden shadow-lg cursor-pointer hover:bg-[#404040] transition relative group" onClick={() => onRecommendationClick(rec)}>
                        <div className="relative aspect-video">
                            <img
                                src={`https://image.tmdb.org/t/p/w500${rec.backdrop_path || rec.poster_path}`}
                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition"
                                alt={rec.title}
                            />
                            <div className="absolute top-2 right-2 text-white font-bold drop-shadow-md text-xs">
                                {(rec.vote_average * 10).toFixed(0)}% Match
                            </div>
                        </div>
                        <div className="p-3">
                            <div className="flex items-start justify-between">
                                <div className="flex-1 pr-2">
                                    <div className="flex items-center space-x-2 text-xs text-gray-400 mb-1">
                                        <span className="border border-gray-500 px-1 rounded-[2px]">13+</span>
                                        <span>{(rec.release_date || rec.first_air_date)?.substring(0, 4)}</span>
                                    </div>
                                    <p className="text-sm font-semibold text-gray-200 line-clamp-2 h-10 leading-tight">
                                        {rec.overview || t('common.noDesc')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default InfoModalRecommendations;
