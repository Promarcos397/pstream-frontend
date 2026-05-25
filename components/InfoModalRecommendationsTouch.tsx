import React from 'react';
import { Movie } from '../types';

interface InfoModalRecommendationsTouchProps {
    recommendations: Movie[];
    onRecommendationClick: (rec: Movie) => void;
}

const InfoModalRecommendationsTouch: React.FC<InfoModalRecommendationsTouchProps> = ({
    recommendations,
    onRecommendationClick,
}) => {
    if (!recommendations?.length) return null;

    // Render a premium 3-column grid of movie poster cards and nothing else
    return (
        <div className="grid grid-cols-3 gap-2.5 mt-2">
            {recommendations.slice(0, 12).map((rec) => {
                const imgPath = rec.poster_path || rec.backdrop_path;
                if (!imgPath) return null;
                
                const isFullUrl = imgPath.startsWith('http') || imgPath.startsWith('comic://');
                const src = isFullUrl ? imgPath : `https://image.tmdb.org/t/p/w342${imgPath}`;

                return (
                    <div
                        key={rec.id}
                        onClick={() => onRecommendationClick(rec)}
                        className="aspect-[2/3] bg-zinc-800 rounded-[4px] overflow-hidden active:scale-95 transition-transform duration-200 cursor-pointer shadow-md"
                    >
                        <img
                            src={src}
                            alt={rec.title || rec.name || 'recommendation'}
                            className="w-full h-full object-cover"
                            loading="lazy"
                        />
                    </div>
                );
            })}
        </div>
    );
};

export default InfoModalRecommendationsTouch;
