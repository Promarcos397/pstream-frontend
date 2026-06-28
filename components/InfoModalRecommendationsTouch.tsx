import React, { useState } from 'react';
import { Movie } from '../types';

const RecTouchCard: React.FC<{ src: string; alt: string; onClick: () => void }> = React.memo(({ src, alt, onClick }) => {
    const [loaded, setLoaded] = useState(false);
    return (
        <div
            onClick={onClick}
            className="aspect-[2/3] bg-zinc-800 rounded-[4px] overflow-hidden active:scale-95 transition-transform duration-200 cursor-pointer shadow-md"
        >
            <img
                src={src}
                alt={alt}
                className={`w-full h-full object-cover transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                loading="lazy"
                decoding="async"
                onLoad={() => setLoaded(true)}
            />
        </div>
    );
});

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

                const isFullUrl = imgPath.startsWith('http') ||
                                  imgPath.startsWith('comic:') ||
                                  imgPath.startsWith('/assets') ||
                                  imgPath.includes('/404_assets') ||
                                  imgPath.startsWith('data:');
                const src = isFullUrl ? imgPath : `https://image.tmdb.org/t/p/w342${imgPath}`;

                return (
                    <RecTouchCard
                        key={rec.id}
                        src={src}
                        alt={rec.title || rec.name || 'recommendation'}
                        onClick={() => onRecommendationClick(rec)}
                    />
                );
            })}
        </div>
    );
};

export default React.memo(InfoModalRecommendationsTouch);
