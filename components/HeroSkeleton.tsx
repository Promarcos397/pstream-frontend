import React from 'react';

export const HeroSkeleton: React.FC = () => {
  return (
    <div className="w-full relative overflow-hidden bg-black select-none">
      {/* 1. MOBILE SKELETON: Renders on < 640px viewports (Centered Floating Card + Ambient Wash) */}
      <div className="block sm:hidden relative w-full px-4 pt-[calc(122px+env(safe-area-inset-top))] pb-6 flex flex-col items-center justify-center animate-pulse">
        {/* Glowing ambient wash background placeholder */}
        <div className="absolute inset-x-0 top-0 h-[50vh] bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none -z-10" />
        <div className="absolute top-[15%] w-[80%] aspect-square rounded-full bg-white/[0.02] filter blur-[40px] pointer-events-none -z-10" />

        {/* Floating Card Placeholder */}
        <div className="w-full max-w-[440px] aspect-[2/2.9] bg-[#141414] rounded-2xl border border-white/[0.08] shadow-[0_20px_60px_rgba(0,0,0,0.85)] relative flex flex-col justify-end p-4">
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

          <div className="relative z-10 w-full flex flex-col items-center gap-3">
            {/* Title Logo Placeholder */}
            <div className="h-10 w-1/2 bg-white/10 rounded-md" />
            {/* Metadata Line */}
            <div className="h-3 w-1/3 bg-white/[0.06] rounded" />
            {/* Play/List Buttons row */}
            <div className="flex w-full gap-3 mt-2">
              <div className="h-[48px] flex-1 bg-white/10 rounded" />
              <div className="h-[48px] flex-1 bg-white/[0.05] rounded" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. TABLET SKELETON: Renders on 640px to 767px viewports (Full-Bleed 60vh Wide Banner + Left Align) */}
      <div className="hidden sm:flex md:hidden relative w-full h-[60vh] min-h-[480px] bg-[#141414] flex-col justify-end pl-12 pb-12 pr-6 animate-pulse">
        {/* Background gradient fade placeholders */}
        <div className="absolute inset-0 bg-gradient-to-tr from-black/90 via-black/40 to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-white/[0.02] pointer-events-none" />

        <div className="relative z-10 w-full max-w-[480px] flex flex-col items-start gap-4">
          {/* Large Title Placeholder */}
          <div className="h-16 w-3/4 bg-white/10 rounded-lg shadow-lg" />
          {/* Genres Line */}
          <div className="h-4 w-1/2 bg-white/[0.08] rounded" />
          {/* Compact Buttons row */}
          <div className="flex gap-3 w-full max-w-[340px]">
            <div className="h-[52px] w-[140px] bg-white/10 rounded" />
            <div className="h-[52px] w-[140px] bg-white/[0.05] rounded" />
          </div>
        </div>
      </div>

      {/* 3. DESKTOP SKELETON: Renders on >= 768px viewports (Massive 80vh Wide Banner) */}
      <div className="hidden md:flex relative h-[77vh] lg:h-[80vh] w-full bg-[#141414] flex-col justify-center pl-16 md:pl-20 animate-pulse">
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none z-10" />
        <div className="absolute inset-0 bg-white/[0.01] pointer-events-none" />

        <div className="relative z-20 w-full max-w-[500px] flex flex-col justify-end h-[60%] gap-6">
          {/* Title/Logo Placeholder */}
          <div className="h-28 w-4/5 bg-white/10 rounded-lg shadow-2xl" />
          {/* Metadata Line */}
          <div className="flex gap-2">
            <div className="h-4 w-16 bg-white/10 rounded" />
            <div className="h-4 w-12 bg-white/10 rounded" />
            <div className="h-4 w-20 bg-white/10 rounded" />
          </div>
          {/* Description Block */}
          <div className="space-y-2.5">
            <div className="h-4 w-full bg-white/[0.07] rounded" />
            <div className="h-4 w-11/12 bg-white/[0.07] rounded" />
            <div className="h-4 w-4/5 bg-white/[0.07] rounded" />
          </div>
          {/* Play/Info Buttons row */}
          <div className="flex gap-3 pt-2">
            <div className="h-12 w-36 bg-white/10 rounded" />
            <div className="h-12 w-44 bg-white/[0.05] rounded" />
          </div>
        </div>

        {/* Maturity Badge Placeholder */}
        <div className="absolute right-0 bottom-[22%] w-24 h-8 bg-white/10 rounded-l border-l-4 border-white/20 z-20" />
      </div>
    </div>
  );
};

export default HeroSkeleton;
