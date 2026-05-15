import React from 'react';

export const HeroSkeleton: React.FC = () => {
  return (
    <div className="relative h-[50vh] sm:h-[66vh] md:h-[77vh] lg:h-[80vh] w-full overflow-hidden bg-black animate-pulse">
      {/* Background Pulse */}
      <div className="absolute inset-0 bg-[#141414]" />
      
      {/* Bottom Gradient */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black via-black/60 to-transparent z-10" />

      {/* Content Area */}
      <div className="absolute left-4 md:left-14 lg:left-16 bottom-[15%] md:bottom-[25%] z-20 w-full max-w-[90%] md:max-w-[40%] space-y-6">
        {/* Title/Logo Placeholder */}
        <div className="h-20 sm:h-28 md:h-36 w-3/4 bg-white/10 rounded-lg shadow-2xl" />
        
        {/* Metadata Line */}
        <div className="flex items-center gap-2">
          <div className="h-4 w-12 bg-white/10 rounded" />
          <div className="h-4 w-12 bg-white/10 rounded" />
          <div className="h-4 w-12 bg-white/10 rounded" />
        </div>

        {/* Description Placeholder */}
        <div className="space-y-2">
          <div className="h-4 w-full bg-white/[0.07] rounded" />
          <div className="h-4 w-5/6 bg-white/[0.07] rounded" />
          <div className="h-4 w-4/6 bg-white/[0.07] rounded hidden sm:block" />
        </div>

        {/* Buttons Placeholder */}
        <div className="flex items-center gap-3 pt-4">
          <div className="h-10 md:h-12 w-28 md:w-36 bg-white/10 rounded" />
          <div className="h-10 md:h-12 w-32 md:w-44 bg-white/[0.05] rounded" />
        </div>
      </div>

      {/* Maturity Badge Placeholder */}
      <div className="absolute right-0 bottom-[21%] md:bottom-[17%] w-24 h-8 bg-white/10 rounded-l-sm border-l-4 border-white/20 z-20" />
    </div>
  );
};

export default HeroSkeleton;
