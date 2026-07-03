import React from 'react';

/**
 * Default avatar tile for Kids profiles that haven't picked a custom avatar —
 * a colorful striped background with a bubbly "kids" wordmark, distinct from
 * the plain gray silhouette used for everyone else. Sized relative to its
 * container so it drops into any avatar slot (picker tile, navbar, bottom nav).
 */
const KidsAvatar: React.FC<{ size?: number; className?: string }> = ({ size = 100, className = '' }) => (
  <div
    className={`w-full h-full flex items-center justify-center ${className}`}
    style={{ background: 'linear-gradient(120deg, #2f8f4e 0%, #f5a623 30%, #e8368f 62%, #7b5fd1 100%)' }}
  >
    <span
      className="font-black italic select-none"
      style={{
        fontSize: Math.max(9, size * 0.32),
        color: '#e8283f',
        WebkitTextStroke: `${Math.max(1, size * 0.018)}px #ffffff`,
        paintOrder: 'stroke fill',
      }}
    >
      kids
    </span>
  </div>
);

export default KidsAvatar;
