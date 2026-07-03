import React, { useId } from 'react';

/**
 * "kids" wordmark badge for nav headers — the gooey bubble-letter treatment.
 *
 * Layer 1: SVG gooey filter applied to a thick white stroke. Uses gravity
 * (feOffset) to melt the bottom internal valleys (e.g. between "k" and "i")
 * flat, matching Netflix's puffy logo look instead of a self-intersecting
 * stroke outline.
 * Layer 2: Crisp SVG stroke overlaid on top to restore perfect
 * anti-aliasing on the outer convex edges and top gaps the filter blurred.
 * Layer 3: Plump red foreground text.
 */
const KidsBadge: React.FC<{ size?: number; className?: string }> = ({ size = 15, className = '' }) => {
  // useId() includes colons, which can be unreliable in SVG url(#...) refs
  // in some browsers — strip them so the filter reference always resolves.
  const filterId = useId().replace(/:/g, '');

  const bgStrokeWidth = size * 0.42;
  const fgStrokeWidth = size * 0.04;
  const tracking = -(size * 0.035);

  const width = size * 2.8;
  const height = size * 1.5;

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ width, height }}
    >
      <svg
        width={width}
        height={height}
        className="overflow-visible drop-shadow-sm"
        style={{
          fontFamily: '"Arial Rounded MT Bold", ui-rounded, "SF Pro Rounded", "Nunito", sans-serif',
          letterSpacing: `${tracking}px`,
        }}
      >
        <defs>
          {/* The Valley Melter: blurs the thick stroke to bridge gaps, shifts it
              down so it only affects the bottom, then thresholds to solidify
              into a flat base. */}
          <filter id={`valley-melter-${filterId}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={size * 0.06} result="blurred" />
            <feOffset in="blurred" dx="0" dy={size * 0.06} result="shifted" />
            <feColorMatrix
              in="shifted"
              type="matrix"
              values="
                0 0 0 0 1
                0 0 0 0 1
                0 0 0 0 1
                0 0 0 100 -60"
              result="solid"
            />
            {/* Tiny blur ensures any exposed bridged valley segments are soft */}
            <feGaussianBlur in="solid" stdDeviation={0.5} />
          </filter>
        </defs>

        {/* LAYER 1: Melted valley filler (smoothly bridged bottom, shifted away from top) */}
        <text
          x="50%" y="52%"
          textAnchor="middle" dominantBaseline="central"
          fill="white" stroke="white" strokeWidth={bgStrokeWidth} strokeLinejoin="round" strokeLinecap="round"
          fontWeight="900" fontSize={size}
          filter={`url(#valley-melter-${filterId})`}
        >
          kids
        </text>

        {/* LAYER 2: Crisp outer shell (flawless anti-aliased perimeter everywhere else) */}
        <text
          x="50%" y="52%"
          textAnchor="middle" dominantBaseline="central"
          fill="white" stroke="white" strokeWidth={bgStrokeWidth} strokeLinejoin="round" strokeLinecap="round"
          fontWeight="900" fontSize={size}
        >
          kids
        </text>

        {/* LAYER 3: Red foreground text */}
        <text
          x="50%" y="52%"
          textAnchor="middle" dominantBaseline="central"
          fill="#e50914" stroke="#e50914" strokeWidth={fgStrokeWidth} strokeLinejoin="round" strokeLinecap="round"
          fontWeight="900" fontSize={size}
        >
          kids
        </text>
      </svg>
    </span>
  );
};

export default KidsBadge;
