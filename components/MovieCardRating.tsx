import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ThumbsUpIcon, ThumbsDownIcon } from '@phosphor-icons/react';
import TooltipWrapper from './TooltipWrapper';

export type MovieRating = 'like' | 'dislike' | 'love';

export const DoubleThumbsUpIcon: React.FC<{
  size?: number;
  weight?: 'fill' | 'bold';
  className?: string;
  maskColor?: string;
}> = ({ size = 22, weight = 'bold', className = '', maskColor = '#2f2f2f' }) => {
  const offsetX = Math.round(size * 0.38);
  const offsetY = Math.round(size * 0.32);
  const biteR = Math.round(size * 0.44);
  return (
    <div className={`relative inline-flex ${className}`} style={{ width: size + offsetX, height: size + offsetY }}>
      <div className="absolute" style={{ left: offsetX, top: offsetY, zIndex: 1 }}>
        <ThumbsUpIcon size={size} weight={weight} />
      </div>
      <div
        className="absolute rounded-full"
        style={{
          width: biteR * 2, height: biteR * 2,
          left: offsetX - biteR + 4, top: offsetY - biteR + 5,
          background: maskColor, transition: 'background-color 0.15s', zIndex: 2,
        }}
      />
      <div className="absolute" style={{ left: 0, top: 0, zIndex: 3 }}>
        <ThumbsUpIcon size={size} weight={weight} />
      </div>
    </div>
  );
};

export const RatingIcon: React.FC<{
  rating: MovieRating | undefined;
  size?: number;
  weight?: 'fill' | 'bold';
  className?: string;
  maskColor?: string;
}> = ({ rating, size = 22, weight = 'bold', className = '', maskColor = '#2f2f2f' }) => {
  if (rating === 'love') return <DoubleThumbsUpIcon size={size} weight={weight} className={className} maskColor={maskColor} />;
  if (rating === 'dislike') return <ThumbsDownIcon size={size} weight={weight} className={className} />;
  return <ThumbsUpIcon size={size} weight={weight} className={className} />;
};

const RatingPillOption: React.FC<{
  option: MovieRating;
  isActive: boolean;
  tooltipText: string;
  onClick: () => void;
  maskColor?: string;
}> = ({ option, isActive, tooltipText, onClick, maskColor = '#2f2f2f' }) => (
  <TooltipWrapper label={tooltipText}>
    <button
      onClick={onClick}
      className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors duration-150 hover:bg-white/10 flex-shrink-0 text-white ${isActive ? 'bg-white/15' : ''}`}
      title={tooltipText}
    >
      <RatingIcon rating={option} size={20} weight={isActive ? 'fill' : 'bold'} maskColor={maskColor} />
    </button>
  </TooltipWrapper>
);

export const RatingPill: React.FC<{
  rating: MovieRating | undefined;
  onRate: (r: MovieRating) => void;
}> = ({ rating, onRate }) => {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();
  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <button
        type="button"
        className="border border-white/40 rounded-full w-10 h-10 flex items-center justify-center transition-colors duration-150 cursor-pointer text-white bg-zinc-800/80 hover:bg-white/15 hover:border-white"
      >
        <RatingIcon
          rating={rating}
          size={20}
          weight={rating ? 'fill' : 'bold'}
          className="text-white"
          maskColor={expanded ? '#414141' : '#2a2a2a'}
        />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0, x: '-50%', y: '-50%' }}
            animate={{ opacity: 1, scaleX: 1, x: '-50%', y: '-50%' }}
            exit={{ opacity: 0, scaleX: 0, x: '-50%', y: '-50%' }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            className="absolute top-1/2 left-1/2 bg-[#2f2f2f] rounded-full px-5 py-2.5 flex items-center justify-center gap-x-3.5 shadow-[0_12px_24px_rgba(0,0,0,0.85)] border border-white/10 z-[100]"
            style={{ transformOrigin: 'center center', originX: 0.5 }}
            onClick={(e) => e.stopPropagation()}
          >
            {(['dislike', 'like', 'love'] as MovieRating[]).map(r => {
              const tooltipText =
                r === 'love' ? t('infoModal.loveThis', { defaultValue: 'Love this!' })
                : r === 'like' ? t('infoModal.iLikeThis', { defaultValue: 'I like this' })
                : t('infoModal.notForMe', { defaultValue: 'Not for me' });
              return (
                <RatingPillOption
                  key={r}
                  option={r}
                  isActive={rating === r}
                  tooltipText={tooltipText}
                  onClick={() => onRate(r)}
                  maskColor="#2f2f2f"
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
