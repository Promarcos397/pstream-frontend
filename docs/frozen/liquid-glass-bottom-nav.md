# ❄️ FROZEN: Liquid-Glass Bottom Nav

The original physics-driven "liquid bubble" mobile bottom tab bar. Replaced by
a static Netflix-style dark pill bar (see `components/BottomNavMobile.tsx`) to
match the reference screenshots exactly. Kept here verbatim so it can be
restored wholesale if we ever want the sloshy bubble back.

**To restore:** copy the code block below back into
`components/BottomNavMobile.tsx` (it exports the same `BottomNavItem` interface
and default `BottomNavMobile` component, so no call-site changes are needed).

Key traits of this version:
- `useSpring` / `useVelocity` / `useTransform` (framer-motion) drive a highlight
  bubble that glides between tabs with squash-&-stretch ("symbiote") motion.
- The bubble is measured from real DOM rects (`getBoundingClientRect`) with
  staggered re-measure timers (0/50/250ms) + a resize listener.
- Glassmorphism: `backdrop-blur`, specular highlights, translucent white fill.

```tsx
import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useVelocity, useTransform } from 'framer-motion';

export interface BottomNavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

interface BottomNavMobileProps {
  items: BottomNavItem[];
  activeId: string;
}

const BottomNavMobile: React.FC<BottomNavMobileProps> = ({ items, activeId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const navRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isFirstRender = useRef(true);
  const [bubbleState, setBubbleState] = useState({ opacity: 0, width: 0, height: 0 });

  const foundIndex = items.findIndex(i => i.id === activeId);
  const activeIndex = foundIndex >= 0 ? foundIndex : 0;

  const activeX      = useMotionValue(0);
  const activeY      = useMotionValue(0);
  const activeWidth  = useMotionValue(0);
  const activeHeight = useMotionValue(0);

  const springX      = useSpring(activeX,      { stiffness: 280, damping: 22, mass: 0.9 });
  const springY      = useSpring(activeY,      { stiffness: 280, damping: 22, mass: 0.9 });
  const springWidth  = useSpring(activeWidth,  { stiffness: 320, damping: 24, mass: 0.7 });
  const springHeight = useSpring(activeHeight, { stiffness: 320, damping: 24, mass: 0.7 });

  const xVel   = useVelocity(springX);
  const scaleY = useTransform(xVel, [-800, 0, 800], [0.55, 1, 0.55], { clamp: true });
  const scaleX = useTransform(xVel, [-800, 0, 800], [1.25, 1, 1.25], { clamp: true });

  useEffect(() => {
    const updateBubble = () => {
      const el = navRefs.current[activeIndex];
      const container = containerRef.current;
      if (!el || !container) return;

      const elRect   = el.getBoundingClientRect();
      const contRect = container.getBoundingClientRect();
      if (elRect.width === 0 || elRect.height === 0) return;

      const isDesktop = window.innerWidth >= 640;
      const addedWidth  = isDesktop ? 8 : 16;
      const addedHeight = isDesktop ? 5  : 10;

      const bubbleWidth  = elRect.width  + addedWidth;
      const bubbleHeight = elRect.height + addedHeight;

      const centerX = (elRect.left - contRect.left) + (elRect.width  );
      const centerY = (elRect.top  - contRect.top)  + (elRect.height );

      const xPos = centerX - (bubbleWidth / 1.01);
      const yPos = centerY - (bubbleHeight / 0.9);

      if (isFirstRender.current) {
        activeX.jump(xPos); activeY.jump(yPos);
        activeWidth.jump(bubbleWidth); activeHeight.jump(bubbleHeight);
        springX.jump(xPos); springY.jump(yPos);
        springWidth.jump(bubbleWidth); springHeight.jump(bubbleHeight);
        isFirstRender.current = false;
      } else {
        activeX.set(xPos); activeY.set(yPos);
        activeWidth.set(bubbleWidth); activeHeight.set(bubbleHeight);
      }
      setBubbleState({ opacity: 1, width: bubbleWidth, height: bubbleHeight });
    };

    updateBubble();
    const timer1 = setTimeout(updateBubble, 50);
    const timer2 = setTimeout(updateBubble, 250);
    window.addEventListener('resize', updateBubble);
    return () => {
      clearTimeout(timer1); clearTimeout(timer2);
      window.removeEventListener('resize', updateBubble);
    };
  }, [activeIndex, items.length]);

  const getTabClass = (isActive: boolean) =>
    `relative flex flex-col items-center justify-center cursor-pointer select-none py-0.5
     active:scale-95 group
     ${isActive ? 'text-white' : 'text-white/45 hover:text-white/80'}`;

  const getPillClass = (isActive: boolean) =>
    `relative z-10 flex flex-col items-center justify-center transition-all duration-300 px-6 py-1.5 rounded-full
     ${isActive ? 'text-white' : 'text-white/45 hover:text-white/80'}`;

  const gridColsClass = items.length === 3 ? 'grid-cols-3' : 'grid-cols-4';

  return (
    <div
      ref={containerRef}
      className="
        fixed bottom-[calc(10px+env(safe-area-inset-bottom))] left-8 right-8 z-[10020] mx-auto max-w-[340px] sm:max-w-[400px] w-auto
        bg-[#1d1d1d]/30 backdrop-blur-lg border border-white/10 rounded-[100px] py-3 sm:py-4 px-2 sm:px-3
        shadow-[0_12px_40px_rgba(0,0,0,0.65)]
      "
    >
      <AnimatePresence>
        {bubbleState.opacity > 0 && (
          <motion.div
            className="absolute pointer-events-none z-0"
            initial={false}
            animate={{ opacity: 1 }}
            style={{
              x: springX, y: springY, width: springWidth, height: springHeight,
              scaleX, scaleY,
              backdropFilter: 'blur(14px) saturate(160%)',
              WebkitBackdropFilter: 'blur(14px) saturate(160%)',
              backgroundColor: 'rgba(255, 255, 255, 0.13)',
              borderRadius: '9999px',
              clipPath: 'inset(0px round 9999px)',
              transformOrigin: 'center center',
            }}
          >
            <div className="absolute inset-0 rounded-[9999px] bg-white/5 border border-white/10 mix-blend-overlay" />
            <div className="absolute inset-0 rounded-[9999px] shadow-[inset_0_2px_10px_rgba(255,255,255,0.18)]" />
            <div className="absolute inset-x-2 top-0 h-[2px] bg-white/20 blur-[2px] rounded-full" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`grid ${gridColsClass} items-center justify-around w-full`}>
        {items.map((item, idx) => {
          const isActive = idx === activeIndex;
          return (
            <div
              key={item.id}
              ref={el => { navRefs.current[idx] = el; }}
              onClick={item.onClick}
              className={getTabClass(isActive)}
            >
              <div className={getPillClass(isActive)}>
                {item.icon}
                <span className="text-[8px] sm:text-[9px] mt-0.5 font-extralight tracking-wide whitespace-nowrap">{item.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNavMobile;
```
