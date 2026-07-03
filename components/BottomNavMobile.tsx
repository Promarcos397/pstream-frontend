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

/**
 * Liquid-bubble mobile bottom tab bar — a physics-animated highlight that
 * glides between tabs. Generic over the tab list so different nav contexts
 * (e.g. Kids mode's 3-tab layout vs the standard 4-tab layout) share one
 * implementation instead of forking the animation code.
 */
const BottomNavMobile: React.FC<BottomNavMobileProps> = ({ items, activeId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const navRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Tracks the very first render so we teleport the bubble instead of animating it in
  const isFirstRender = useRef(true);
  const [bubbleState, setBubbleState] = useState({ opacity: 0, width: 0, height: 0 });

  const foundIndex = items.findIndex(i => i.id === activeId);
  const activeIndex = foundIndex >= 0 ? foundIndex : 0;

  // Motion values for the bubble's position and size
  const activeX      = useMotionValue(0);
  const activeY      = useMotionValue(0);
  const activeWidth  = useMotionValue(0);
  const activeHeight = useMotionValue(0);

  // Sloshy springs for smooth animated movement
  const springX      = useSpring(activeX,      { stiffness: 280, damping: 22, mass: 0.9 });
  const springY      = useSpring(activeY,      { stiffness: 280, damping: 22, mass: 0.9 });
  const springWidth  = useSpring(activeWidth,  { stiffness: 320, damping: 24, mass: 0.7 });
  const springHeight = useSpring(activeHeight, { stiffness: 320, damping: 24, mass: 0.7 });

  // Velocity-based squash & stretch (symbiote effect)
  const xVel   = useVelocity(springX);
  const scaleY = useTransform(xVel, [-800, 0, 800], [0.55, 1, 0.55], { clamp: true });
  const scaleX = useTransform(xVel, [-800, 0, 800], [1.25, 1, 1.25], { clamp: true });

  // Recompute bubble position whenever the active tab (or the tab set itself) changes
  useEffect(() => {
    const updateBubble = () => {
      const el = navRefs.current[activeIndex];
      const container = containerRef.current;
      if (!el || !container) return;

      const elRect   = el.getBoundingClientRect();
      const contRect = container.getBoundingClientRect();

      // If the element hasn't painted yet (dimensions are 0), bail out.
      // The staggered timers below will catch it once it has.
      if (elRect.width === 0 || elRect.height === 0) return;

      const isDesktop = window.innerWidth >= 640;

      // Tight explicit padding — keeps the bubble small and snug around the icon
      const addedWidth  = isDesktop ? 8 : 16;
      const addedHeight = isDesktop ? 5  : 10;

      const bubbleWidth  = elRect.width  + addedWidth;
      const bubbleHeight = elRect.height + addedHeight;

      // Derive exact centre of the nav item relative to the container
      const centerX = (elRect.left - contRect.left) + (elRect.width  );
      const centerY = (elRect.top  - contRect.top)  + (elRect.height );

      // Subtract half the bubble's own size to place it centred over the icon
      const xPos = centerX - (bubbleWidth / 1.01);
      const yPos = centerY - (bubbleHeight / 0.9);

      if (isFirstRender.current) {
        // On the very first render: jump all spring values instantly so the
        // bubble appears in place with no fly-in from the corner.
        activeX.jump(xPos);
        activeY.jump(yPos);
        activeWidth.jump(bubbleWidth);
        activeHeight.jump(bubbleHeight);
        springX.jump(xPos);
        springY.jump(yPos);
        springWidth.jump(bubbleWidth);
        springHeight.jump(bubbleHeight);
        isFirstRender.current = false;
      } else {
        // Every subsequent tab change: animate smoothly via the springs.
        activeX.set(xPos);
        activeY.set(yPos);
        activeWidth.set(bubbleWidth);
        activeHeight.set(bubbleHeight);
      }

      setBubbleState({ opacity: 1, width: bubbleWidth, height: bubbleHeight });
    };

    // Fire immediately, then at 50 ms and 250 ms as fallbacks.
    // This guarantees we measure correctly even if fonts or SVG icons are slow to paint.
    updateBubble();
    const timer1 = setTimeout(updateBubble, 50);
    const timer2 = setTimeout(updateBubble, 250);

    window.addEventListener('resize', updateBubble);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
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

  // Literal class strings (not interpolated) so Tailwind's static scanner picks them up.
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
      {/* ── THE LIQUID BUBBLE ──────────────────────────────────────────── */}
      <AnimatePresence>
        {bubbleState.opacity > 0 && (
          <motion.div
            className="absolute pointer-events-none z-0"
            initial={false}
            animate={{ opacity: 1 }}
            style={{
              x: springX,
              y: springY,
              width: springWidth,
              height: springHeight,
              scaleX,
              scaleY,
              backdropFilter: 'blur(14px) saturate(160%)',
              WebkitBackdropFilter: 'blur(14px) saturate(160%)',
              backgroundColor: 'rgba(255, 255, 255, 0.13)',
              borderRadius: '9999px',
              clipPath: 'inset(0px round 9999px)',
              transformOrigin: 'center center',
            }}
          >
            {/* Specular highlights — visible on all platforms */}
            <div className="absolute inset-0 rounded-[9999px] bg-white/5 border border-white/10 mix-blend-overlay" />
            <div className="absolute inset-0 rounded-[9999px] shadow-[inset_0_2px_10px_rgba(255,255,255,0.18)]" />
            <div className="absolute inset-x-2 top-0 h-[2px] bg-white/20 blur-[2px] rounded-full" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Nav Items ─────────────────────────────────────────────────── */}
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
