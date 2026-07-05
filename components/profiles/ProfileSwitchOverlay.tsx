import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProfileStore } from '../../store/useProfileStore';
import { useIsMobile } from '../../hooks/useIsMobile';
import KidsAvatar from './KidsAvatar';

const FALLBACK_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23ddd'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%23bbb'/%3E%3Cellipse cx='50' cy='85' rx='28' ry='22' fill='%23bbb'/%3E%3C/svg%3E";

/** Arc spinner colored like the kids stripes (red for adult profiles). */
const SwitchSpinner: React.FC<{ rainbow: boolean }> = ({ rainbow }) => (
  <svg width="34" height="34" viewBox="0 0 34 34" className="animate-spin" style={{ animationDuration: '0.9s' }}>
    {rainbow && (
      <defs>
        <linearGradient id="switch-spinner-rainbow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2f6bf0" />
          <stop offset="35%" stopColor="#ec2fa0" />
          <stop offset="70%" stopColor="#f5a623" />
          <stop offset="100%" stopColor="#2e8b4f" />
        </linearGradient>
      </defs>
    )}
    <circle
      cx="17" cy="17" r="13"
      fill="none"
      stroke={rainbow ? 'url(#switch-spinner-rainbow)' : '#e50914'}
      strokeWidth="4.5"
      strokeLinecap="round"
      strokeDasharray="58 82"
    />
  </svg>
);

/**
 * Desktop Netflix switch treatment: a big red arc sweeping AROUND the avatar
 * tile (not a small spinner beneath it). Arc ≈ one third of the circle with
 * rounded caps, spinning about a circle much larger than the tile.
 */
const OrbitArc: React.FC = () => (
  <svg
    width="230" height="230" viewBox="0 0 230 230"
    className="absolute -inset-x-0 animate-spin"
    style={{ left: '50%', top: '50%', marginLeft: -115, marginTop: -115, animationDuration: '1.1s' }}
  >
    <circle
      cx="115" cy="115" r="100"
      fill="none"
      stroke="#e50914"
      strokeWidth="10"
      strokeLinecap="round"
      strokeDasharray="220 408"
    />
  </svg>
);

/** The four kids stripes, used as the full-screen bloom backdrop. */
const KIDS_STRIPES = [
  'linear-gradient(180deg, #2e8b4f 0%, #6f6f8f 55%, #8d3fd1 100%)',
  'linear-gradient(180deg, #f6c244 0%, #ef8f3a 60%, #e05238 100%)',
  'linear-gradient(180deg, #f66ab5 0%, #ec2fa0 100%)',
  'linear-gradient(180deg, #cfc4f5 0%, #7f8ff0 55%, #2f6bf0 100%)',
];

/**
 * Netflix-style profile-switch transition: the chosen profile's avatar alone
 * on black with a spinner beneath. For Kids profiles, the tile's stripes bloom
 * outward to fill the screen — matching the reference mobile screenshots.
 * Driven by `switchingProfile` in the profile store, which activateProfile()
 * sets and clears.
 */
const ProfileSwitchOverlay: React.FC = () => {
  const switchingProfile = useProfileStore(s => s.switchingProfile);
  const isMobile = useIsMobile();
  const [failed, setFailed] = useState(false);
  const isKidsTile = !!switchingProfile?.isKids && !switchingProfile?.avatarUrl;

  const tileSize = isMobile ? 170 : 84;

  return (
    <AnimatePresence>
      {switchingProfile && (
        <motion.div
          key={switchingProfile.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.35 } }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[300] bg-black flex flex-col items-center justify-center overflow-hidden"
        >
          {/* Kids on mobile: stripes bloom out from behind the tile */}
          {isKidsTile && isMobile && (
            <motion.div
              initial={{ scale: 0.14, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
              className="absolute inset-0 flex"
            >
              {KIDS_STRIPES.map((bg, i) => (
                <div key={i} className="flex-1 h-full" style={{ background: bg }} />
              ))}
            </motion.div>
          )}

          <div className="relative flex items-center justify-center">
            {/* Desktop: red arc orbiting the tile, per the Netflix reference */}
            {!isMobile && <OrbitArc />}

            <motion.div
              initial={{ scale: 0.82, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className={`relative overflow-hidden shadow-2xl ${isMobile ? 'rounded-[24px]' : 'rounded-md'}`}
              style={{ width: tileSize, height: tileSize }}
            >
              {isKidsTile ? (
                <KidsAvatar size={tileSize} />
              ) : (
                <img
                  src={failed || !switchingProfile.avatarUrl ? FALLBACK_AVATAR : switchingProfile.avatarUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={() => setFailed(true)}
                  referrerPolicy="no-referrer"
                />
              )}
            </motion.div>
          </div>

          {isMobile && (
            <div className="relative mt-10">
              <SwitchSpinner rainbow={isKidsTile} />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ProfileSwitchOverlay;
