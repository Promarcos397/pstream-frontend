import React from 'react';
import { useIsMobile } from '../hooks/useIsMobile';

interface ManifestSkeletonProps {
  count?: number;
}

export const ManifestSkeleton: React.FC<ManifestSkeletonProps> = ({ count = 5 }) => {
  const isMobile = useIsMobile(768);

  return (
    <div className="space-y-10 md:space-y-12">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse px-4 md:px-14 lg:px-16">
          {/* Row Title Placeholder */}
          <div 
            className="h-5 sm:h-6 bg-white/10 rounded mb-5"
            style={{ width: `${140 + (i % 4) * 60}px` }}
          />

          {/* Cards Strip Placeholder */}
          <div className="flex gap-2 overflow-hidden">
            {Array.from({ length: 12 }).map((_, j) => (
              <div 
                key={j} 
                className={`flex-none rounded-md bg-white/[0.06] border border-white/[0.03] transition-all relative overflow-hidden
                  ${isMobile 
                    ? 'w-[calc((100vw-3rem)/3.2)] sm:w-[calc((100vw-3rem)/4.3)] aspect-[2/3] mr-1' 
                    : 'w-[calc((100vw-3.5rem)/5.3)] lg:w-[calc((100vw-4rem)/6.7)] aspect-[7/5] mr-1.5'
                  }`}
                style={{ animationDelay: `${(i * 6 + j) * 0.03}s` }}
              >
                {/* Subtle internal shading */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#222222]/20 via-[#181818]/45 to-black/60 pointer-events-none" />
                
                {/* Horizontal shimmer line */}
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" style={{ animationDelay: `${(i * 6 + j) * 0.04}s` }} />
                
                {/* Text placeholder for horizontal desktop cards only */}
                {!isMobile && (
                  <div className="absolute bottom-3 left-2.5 space-y-1.5 w-[80%] pointer-events-none">
                    <div className="h-2.5 bg-white/10 rounded-full w-4/5" />
                    <div className="h-1.5 bg-white/[0.06] rounded-full w-3/5" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ManifestSkeleton;