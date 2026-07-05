import React from 'react';
import KidsBadge from './KidsBadge';

/**
 * Default avatar tile for Kids profiles that haven't picked a custom avatar —
 * four vertical gradient stripes (green→purple, amber→red, pink→magenta,
 * lavender→blue) with the gooey "kids" wordmark centered, matching the
 * reference Netflix Kids tile. Fills its container, so it drops into any
 * avatar slot (picker tile, navbar, bottom nav, profile sheet).
 */
const STRIPES = [
  'linear-gradient(180deg, #2e8b4f 0%, #6f6f8f 55%, #8d3fd1 100%)',
  'linear-gradient(180deg, #f6c244 0%, #ef8f3a 60%, #e05238 100%)',
  'linear-gradient(180deg, #f66ab5 0%, #ec2fa0 100%)',
  'linear-gradient(180deg, #cfc4f5 0%, #7f8ff0 55%, #2f6bf0 100%)',
];

const KidsAvatar: React.FC<{ size?: number; className?: string }> = ({ size = 100, className = '' }) => (
  <div className={`relative w-full h-full flex ${className}`}>
    {STRIPES.map((bg, i) => (
      <div key={i} className="flex-1 h-full" style={{ background: bg }} />
    ))}
    <div className="absolute inset-0 flex items-center justify-center">
      <KidsBadge size={Math.max(11, size * 0.3)} />
    </div>
  </div>
);

export default KidsAvatar;
