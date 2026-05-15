import React from 'react';

interface ManifestSkeletonProps {
  count?: number;
}

export const ManifestSkeleton: React.FC<ManifestSkeletonProps> = ({ count = 5 }) => {
  return (
    <div className="space-y-10 md:space-y-12">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse px-4 md:px-14 lg:px-16">
          <div 
            className="h-6 bg-white/10 rounded mb-5"
            style={{ width: `${140 + (i % 4) * 60}px` }}
          />
          <div className="flex gap-2 overflow-hidden">
            {Array.from({ length: 6 }).map((_, j) => (
              <div 
                key={j} 
                className="aspect-video flex-1 bg-white/[0.06] rounded-sm min-w-[160px]"
                style={{ animationDelay: `${(i * 6 + j) * 0.02}s` }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ManifestSkeleton;