import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusIcon, PencilSimpleIcon, LockSimpleIcon, XIcon } from '@phosphor-icons/react';
import pstreamWordmark from '../../assets/logos/pstream-logo.svg';
import { Profile } from '../../types';
import { useProfileStore } from '../../store/useProfileStore';
import { activateProfile } from '../../store/useAuthStore';
import { useIsMobile } from '../../hooks/useIsMobile';
import { HeroEngine } from '../../services/HeroEngine';
import { fetchData, getMovieImages } from '../../services/api';
import { REQUESTS } from '../../constants';
import { extractAmbientColor, AmbientRGB } from '../../utils/ambientColor';
import AddEditProfileModal from './AddEditProfileModal';
import ProfilePinPrompt from './ProfilePinPrompt';
import KidsAvatar from './KidsAvatar';
import KidsBadge from './KidsBadge';

const FALLBACK_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23ddd'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%23bbb'/%3E%3Cellipse cx='50' cy='85' rx='28' ry='22' fill='%23bbb'/%3E%3C/svg%3E";

/** Avatar fill for a tile: kids stripes when no custom avatar, else the image. */
const TileImage: React.FC<{ profile: Profile }> = ({ profile }) => {
  const [failed, setFailed] = useState(false);
  if (profile.isKids && !profile.avatarUrl) return <KidsAvatar size={110} />;
  return (
    <>
      <img
        src={failed || !profile.avatarUrl ? FALLBACK_AVATAR : profile.avatarUrl}
        alt=""
        className="w-full h-full object-cover"
        onError={() => setFailed(true)}
        referrerPolicy="no-referrer"
      />
      {/* Netflix marks kids-ticked profiles with a small badge, bottom-right */}
      {profile.isKids && <KidsBadge size={11} className="absolute bottom-1.5 right-1.5" />}
    </>
  );
};

const ProfileTile: React.FC<{
  profile: Profile;
  editMode: boolean;
  onSelect: () => void;
  onEdit: () => void;
}> = ({ profile, editMode, onSelect, onEdit }) => (
  <button
    type="button"
    onClick={editMode ? onEdit : onSelect}
    className="flex flex-col items-center gap-3 group w-[110px] sm:w-[140px]"
  >
    {/* Netflix hover = white outline on the tile, no zoom. */}
    <div className="relative w-[110px] h-[110px] sm:w-[140px] sm:h-[140px] rounded-md overflow-hidden shadow-lg ring-white transition-shadow group-hover:ring-[3px] group-active:scale-[0.98]">
      <TileImage profile={profile} />
      {editMode && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <PencilSimpleIcon size={32} weight="fill" className="text-white" />
        </div>
      )}
    </div>
    <span className={`text-[15px] sm:text-base transition-colors ${editMode ? 'text-white/40' : 'text-[#808080] group-hover:text-white'}`}>
      {profile.name}
    </span>
    {profile.pin && !editMode && (
      <LockSimpleIcon size={13} weight="fill" className="text-[#808080] -mt-1.5" />
    )}
  </button>
);

const AddProfileTile: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const { t } = useTranslation();
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-3 group w-[110px] sm:w-[140px]">
      {/* Netflix renders the Add tile as a filled gray circle, not a square. */}
      <div className="w-[110px] h-[110px] sm:w-[140px] sm:h-[140px] rounded-full bg-[#2b2b2b] flex items-center justify-center transition-all group-hover:bg-[#404040] group-active:scale-[0.98]">
        <PlusIcon size={44} weight="regular" className="text-[#808080] group-hover:text-white transition-colors" />
      </div>
      <span className="text-[15px] sm:text-base text-[#808080] group-hover:text-white transition-colors">
        {t('profiles.addProfile', { defaultValue: 'Add Profile' })}
      </span>
    </button>
  );
};

/* ── Mobile pieces (reference: user's Netflix mobile screenshots) ──────────── */

/** Glossy red shield + padlock — the "Profile Lock is ON" hero graphic. */
const LockShield: React.FC = () => (
  <svg width="120" height="140" viewBox="0 0 120 140" className="drop-shadow-[0_8px_30px_rgba(229,9,20,0.35)]">
    <defs>
      <linearGradient id="pl-shield-fill" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f5495c" />
        <stop offset="45%" stopColor="#d92438" />
        <stop offset="100%" stopColor="#8e2b86" />
      </linearGradient>
      <linearGradient id="pl-shield-rim" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ff8a5c" />
        <stop offset="50%" stopColor="#ff5d73" />
        <stop offset="100%" stopColor="#b44ad1" />
      </linearGradient>
      <linearGradient id="pl-shield-gloss" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
        <stop offset="60%" stopColor="rgba(255,255,255,0)" />
      </linearGradient>
    </defs>
    <path d="M60 6 L106 22 V64 C106 98 88 120 60 134 C32 120 14 98 14 64 V22 Z" fill="url(#pl-shield-rim)" />
    <path d="M60 14 L98 27 V63 C98 92 83 111 60 124 C37 111 22 92 22 63 V27 Z" fill="url(#pl-shield-fill)" />
    <path d="M60 14 L98 27 V50 L27 88 C23 80 22 72 22 63 V27 Z" fill="url(#pl-shield-gloss)" opacity="0.35" />
    <rect x="43" y="62" width="34" height="26" rx="5" fill="none" stroke="white" strokeWidth="4.5" />
    <path d="M49 62 V52 a11 11 0 0 1 22 0 V62" fill="none" stroke="white" strokeWidth="4.5" strokeLinecap="round" />
    <line x1="60" y1="71" x2="60" y2="79" stroke="white" strokeWidth="4.5" strokeLinecap="round" />
  </svg>
);

const MobileProfileTile: React.FC<{
  profile: Profile;
  editMode: boolean;
  onSelect: () => void;
  onEdit: () => void;
  /** Larger grid presentation used by the no-lock "Choose your profile" grid. */
  large?: boolean;
}> = ({ profile, editMode, onSelect, onEdit, large = false }) => (
  <button
    type="button"
    onClick={editMode ? onEdit : onSelect}
    className="flex flex-col items-center gap-2.5 shrink-0 active:scale-95 transition-transform"
  >
    <div className={`relative overflow-hidden shadow-lg ${large ? 'w-[96px] h-[96px] rounded-[20px]' : 'w-[76px] h-[76px] rounded-[18px]'}`}>
      <TileImage profile={profile} />
      {editMode && (
        <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
          <PencilSimpleIcon size={26} weight="fill" className="text-white" />
        </div>
      )}
      {!!profile.pin && !editMode && (
        <span className="absolute bottom-1 left-1 w-[18px] h-[18px] rounded-[5px] bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
          <LockSimpleIcon size={11} weight="fill" className="text-white" />
        </span>
      )}
    </div>
    <span className={`text-white ${large ? 'text-[18px] font-semibold' : 'text-[15px] font-medium'}`}>{profile.name}</span>
  </button>
);

/** Gray "+ Add" square that lives INSIDE the profile grid (no-lock layout). */
const AddGridTile: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex flex-col items-center gap-2.5 active:scale-95 transition-transform"
  >
    <div className="w-[96px] h-[96px] rounded-[20px] bg-[#3a3a3a] flex items-center justify-center text-white">
      <PlusIcon size={40} weight="thin" />
    </div>
    <span className="text-white text-[18px] font-semibold">{label}</span>
  </button>
);

const MobileActionTile: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex flex-col items-center gap-2.5 active:scale-95 transition-transform"
  >
    <div className="w-[64px] h-[64px] rounded-[16px] bg-[#2a2a2a] flex items-center justify-center text-white">
      {icon}
    </div>
    <span className="text-white text-[15px] font-medium">{label}</span>
  </button>
);

/**
 * Full-screen "Who's watching?" gate. Renders whenever the account is signed
 * in but no profile is active yet (fresh login, explicit "exit profile", a
 * PIN-locked profile awaiting unlock, or returning after hours away).
 *
 * Desktop: centered grid, Netflix web style.
 * Mobile: bottom-anchored "Choose your profile" row with Add/Edit tiles and a
 * "Profile Lock is ON" shield hero when any profile is PIN-locked — matching
 * the reference Netflix mobile screenshots.
 */
const WhosWatchingGate: React.FC = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const profiles = useProfileStore(s => s.profiles);
  const isLoaded = useProfileStore(s => s.isLoaded);
  const unlockedProfileIds = useProfileStore(s => s.unlockedProfileIds);
  const markUnlocked = useProfileStore(s => s.markUnlocked);
  const createProfile = useProfileStore(s => s.createProfile);
  const updateProfile = useProfileStore(s => s.updateProfile);
  const deleteProfile = useProfileStore(s => s.deleteProfile);
  const isDeletable = useProfileStore(s => s.isDeletable);
  const canAddMore = useProfileStore(s => s.canAddMore());
  const gateEditMode = useProfileStore(s => s.gateEditMode);
  const setGateEditMode = useProfileStore(s => s.setGateEditMode);

  // Enter edit mode if we were opened via "Manage Profiles"; consume the flag.
  const [editMode, setEditMode] = useState(gateEditMode);
  useEffect(() => {
    if (gateEditMode) { setEditMode(true); setGateEditMode(false); }
  }, [gateEditMode, setGateEditMode]);

  const [modal, setModal] = useState<{ mode: 'add' | 'edit'; profile?: Profile } | null>(null);
  const [pendingUnlock, setPendingUnlock] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Mobile no-lock variant shows a rotating featured-title billboard above the
  // picker: three titles (1 series + 2 films, shuffled), deliberately distinct
  // from the home-page hero, auto-cycling with a crossfade. The screen's
  // ambient background tints itself to each artwork's dominant color
  // (Batman → blue wash, Barbie → pink), per the reference screenshots.
  const anyLocked = profiles.some(p => !!p.pin);
  interface BillboardSlide {
    id: number;
    imageUrl: string;
    logoUrl?: string;
    rank?: number;                 // 1-based Top-10 position, for the "No. N in …" line
    mediaType: 'movie' | 'tv';
  }
  const [slides, setSlides] = useState<BillboardSlide[]>([]);
  const [slideIdx, setSlideIdx] = useState(0);
  const [ambient, setAmbient] = useState<AmbientRGB | null>(null);

  useEffect(() => {
    if (!isMobile || anyLocked) return;
    let cancelled = false;
    (async () => {
      try {
        const [movies, tv] = await Promise.all([
          fetchData(REQUESTS.fetchTrendingMovies),
          fetchData(REQUESTS.fetchTrendingTV),
        ]);
        // Never mirror the home hero — the picker should tease something else.
        const heroId = HeroEngine.getCachedHero('home')?.movie?.id;
        const usable = (m: any) => (m?.poster_path || m?.backdrop_path) && m.id !== heroId;

        // Random picks from today's Top 10 (2 films + 1 series), carrying their
        // real chart position so the "No. N in … Today" line is truthful.
        const shuffledIdx = (n: number, count: number) => {
          const idxs = Array.from({ length: n }, (_, i) => i);
          for (let i = idxs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
          }
          return idxs.slice(0, count);
        };
        const topMovies = (movies || []).filter(usable).slice(0, 10);
        const topTv = (tv || []).filter(usable).slice(0, 10);
        const picks: Array<{ m: any; type: 'movie' | 'tv'; rank: number }> = [
          ...shuffledIdx(topMovies.length, Math.min(2, topMovies.length))
            .map(i => ({ m: topMovies[i], type: 'movie' as const, rank: i + 1 })),
          ...shuffledIdx(topTv.length, Math.min(1, topTv.length))
            .map(i => ({ m: topTv[i], type: 'tv' as const, rank: i + 1 })),
        ];
        if (picks.length === 0) return;

        const built = await Promise.all(picks.map(async ({ m, type, rank }) => {
          // Default poster/backdrop is very often baked with the title's logo
          // art — TMDB backdrops in particular commonly ship WITH the show's
          // logo burned in, so "fall back to the backdrop" alone isn't enough
          // to guarantee text-free art. Search both posters and backdrops for
          // a genuinely textless asset (iso_639_1 === null); only when one is
          // found do we also overlay the separately-fetched logo — otherwise
          // the raw art's own baked-in title would double up with it.
          let imageUrl: string | undefined;
          let logoUrl: string | undefined;
          try {
            const images = await getMovieImages(m.id, type);
            const byVotes = (a: any, b: any) => (b.vote_average || 0) - (a.vote_average || 0);
            const textlessPoster = (images?.posters || []).filter((p: any) => p.iso_639_1 === null).sort(byVotes)[0];
            const textlessBackdrop = (images?.backdrops || []).filter((p: any) => p.iso_639_1 === null).sort(byVotes)[0];

            if (textlessPoster) {
              imageUrl = `https://image.tmdb.org/t/p/w780${textlessPoster.file_path}`;
            } else if (textlessBackdrop) {
              imageUrl = `https://image.tmdb.org/t/p/w780${textlessBackdrop.file_path}`;
            }
            if (imageUrl) {
              const logo = images?.logos?.find((l: any) => l.iso_639_1 === 'en' || l.iso_639_1 === null);
              if (logo) logoUrl = `https://image.tmdb.org/t/p/w300${logo.file_path}`;
            }
          } catch { /* fall through to the raw poster/backdrop below */ }

          if (!imageUrl) {
            // No confirmed textless asset — use the raw art as-is (it likely
            // already carries the title) and skip the logo overlay entirely.
            imageUrl = m.backdrop_path
              ? `https://image.tmdb.org/t/p/w780${m.backdrop_path}`
              : `https://image.tmdb.org/t/p/w780${m.poster_path}`;
          }
          return { id: m.id, imageUrl, logoUrl, rank, mediaType: type };
        }));

        // Shuffle so the series/film order differs visit to visit.
        for (let i = built.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [built[i], built[j]] = [built[j], built[i]];
        }
        if (!cancelled) setSlides(built);
      } catch { /* billboard is decorative — fall back to gradient */ }
    })();
    return () => { cancelled = true; };
  }, [isMobile, anyLocked]);

  // Auto-cycle through the three titles.
  useEffect(() => {
    if (slides.length < 2) return;
    const id = setInterval(() => setSlideIdx(i => (i + 1) % slides.length), 7000);
    return () => clearInterval(id);
  }, [slides.length]);

  const activeSlide = slides.length > 0 ? slides[slideIdx % slides.length] : null;

  // Ambient tint follows the active artwork.
  useEffect(() => {
    if (!activeSlide) return;
    let cancelled = false;
    extractAmbientColor(activeSlide.imageUrl).then(rgb => {
      if (!cancelled && rgb) setAmbient(rgb);
    });
    return () => { cancelled = true; };
  }, [activeSlide?.imageUrl]);

  if (!isLoaded) {
    return <div className="fixed inset-0 z-[150] bg-black" />;
  }

  const handleSelect = (profile: Profile) => {
    if (profile.pin && !unlockedProfileIds.includes(profile.id)) {
      setPendingUnlock(profile);
      return;
    }
    activateProfile(profile.id);
  };

  const handleSaveNew = async (input: { name: string; avatarUrl?: string; isKids: boolean; pin?: string | null }) => {
    setSaving(true);
    setSaveError(null);
    const created = await createProfile(input);
    setSaving(false);
    if (!created) {
      setSaveError(t('profiles.saveFailed', { defaultValue: 'Could not save this profile. Please try again.' }));
      return;
    }
    setModal(null);
  };

  const handleSaveEdit = async (id: string, input: { name: string; avatarUrl?: string; isKids: boolean; pin?: string | null }) => {
    setSaving(true);
    await updateProfile(id, input);
    setSaving(false);
    setModal(null);
  };

  const handleDelete = async (id: string) => {
    setSaving(true);
    const result = await deleteProfile(id);
    setSaving(false);
    if (!result.ok) {
      setSaveError(
        result.reason === 'default_kids'
          ? t('profiles.cantDeleteKids', { defaultValue: "The Kids profile comes with every account and can't be deleted." })
          : t('profiles.cantDeleteLastAdult', { defaultValue: 'You need at least one non-Kids profile. Add another before deleting this one.' })
      );
      return;
    }
    setModal(null);
  };

  // Protected profiles get no Delete button — a hint explains why instead.
  const protectedHintFor = (p?: Profile): string | null => {
    if (!p || isDeletable(p.id)) return null;
    return p.isDefault
      ? t('profiles.cantDeleteKids', { defaultValue: "The Kids profile comes with every account and can't be deleted." })
      : t('profiles.cantDeleteLastAdult', { defaultValue: 'You need at least one non-Kids profile. Add another before deleting this one.' });
  };

  const sharedOverlays = (
    <>
      <AnimatePresence>
        {modal && (
          <AddEditProfileModal
            mode={modal.mode}
            initial={modal.profile}
            saving={saving}
            errorMessage={saveError}
            onCancel={() => { setModal(null); setSaveError(null); }}
            onSave={(input) =>
              modal.mode === 'add' ? handleSaveNew(input) : handleSaveEdit(modal.profile!.id, input)
            }
            onDelete={
              modal.mode === 'edit' && modal.profile && isDeletable(modal.profile.id)
                ? () => handleDelete(modal.profile!.id)
                : undefined
            }
            protectedHint={modal.mode === 'edit' ? protectedHintFor(modal.profile) : null}
          />
        )}
      </AnimatePresence>

      {pendingUnlock && (
        <ProfilePinPrompt
          profile={pendingUnlock}
          onCancel={() => setPendingUnlock(null)}
          onUnlock={() => {
            markUnlocked(pendingUnlock.id);
            activateProfile(pendingUnlock.id);
            setPendingUnlock(null);
          }}
        />
      )}
    </>
  );

  /* ── Mobile layout ──────────────────────────────────────────────────────── */
  if (isMobile) {
    // The whole screen washes with the active artwork's dominant color.
    const bgStyle = ambient
      ? { background: `radial-gradient(130% 60% at 50% 0%, rgba(${ambient.r},${ambient.g},${ambient.b},0.45) 0%, rgba(${ambient.r},${ambient.g},${ambient.b},0.18) 42%, #000 82%)` }
      : { background: 'radial-gradient(130% 55% at 50% 0%, #241318 0%, #0a0507 45%, #000 75%)' };
    const archStyle = {
      background: ambient
        ? `linear-gradient(rgba(${ambient.r},${ambient.g},${ambient.b},0.14), rgba(${ambient.r},${ambient.g},${ambient.b},0.10)), #131313`
        : '#131313',
      borderTopLeftRadius: '50% 52px',
      borderTopRightRadius: '50% 52px',
    };

    // Grid shape mirrors the reference: up to 4 tiles → 2 columns (2×2),
    // beyond that → 3 columns. The Add tile lives inside the grid.
    const tileCount = profiles.length + (canAddMore ? 1 : 0);
    const gridColsClass = tileCount <= 4 ? 'grid-cols-2' : 'grid-cols-3';
    const showBillboard = !anyLocked && !!activeSlide;

    return (
      <div
        className="fixed inset-0 z-[150] flex flex-col transition-colors duration-700"
        style={bgStyle}
      >
        {/* Full-bleed billboard art, mask-faded so it dissolves into the
            ambient-tinted background well above the picker — no hard edge. */}
        {showBillboard && (
          <div
            className="absolute inset-x-0 top-0 h-[58%]"
            style={{
              WebkitMaskImage: 'linear-gradient(180deg, black 58%, transparent 97%)',
              maskImage: 'linear-gradient(180deg, black 58%, transparent 97%)',
            }}
          >
            <AnimatePresence>
              <motion.div
                key={activeSlide!.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: 'easeInOut' }}
                className="absolute inset-0"
              >
                <img src={activeSlide!.imageUrl} alt="" className="w-full h-full object-cover object-top" />
                {/* slight top scrim for status-bar legibility */}
                <div
                  className="absolute inset-x-0 top-0 h-24"
                  style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 100%)' }}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {!showBillboard && (
          <img
            src={pstreamWordmark}
            alt="Pstream"
            className="h-6 absolute top-[calc(1rem+env(safe-area-inset-top))] left-1/2 -translate-x-1/2 opacity-90"
          />
        )}

        {/* Center region: shield hero when locked; otherwise the billboard's
            title logo + Top-10 rank line anchored just above the picker. */}
        <div className={`relative flex-1 flex flex-col items-center px-8 ${anyLocked || !activeSlide ? 'justify-center' : 'justify-end pb-3'}`}>
          {anyLocked ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col items-center gap-7"
            >
              <LockShield />
              <h1 className="text-white text-[26px] font-bold text-center">
                {t('profiles.lockIsOn', { defaultValue: 'Profile Lock is ON' })}
              </h1>
            </motion.div>
          ) : activeSlide ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSlide.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col items-center gap-4"
              >
                {activeSlide.logoUrl && (
                  <img
                    src={activeSlide.logoUrl}
                    alt=""
                    className="max-w-[58%] max-h-[86px] object-contain drop-shadow-lg"
                  />
                )}
                {!!activeSlide.rank && activeSlide.rank <= 10 && (
                  <div className="flex items-center gap-2.5">
                    <span className="bg-[#e50914] rounded-[3px] px-[5px] py-[3px] flex flex-col items-center leading-none shrink-0 shadow">
                      <span className="text-white text-[7px] font-black tracking-[0.08em]">TOP</span>
                      <span className="text-white text-[11px] font-black leading-[0.95]">10</span>
                    </span>
                    <span className="text-white text-[19px] font-bold">
                      {activeSlide.mediaType === 'tv'
                        ? t('profiles.rankSeries', { defaultValue: 'No. {{n}} in Series Today', n: activeSlide.rank })
                        : t('profiles.rankFilms', { defaultValue: 'No. {{n}} in Films Today', n: activeSlide.rank })}
                    </span>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          ) : (
            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="text-white text-[28px] font-bold text-center"
            >
              {t('profiles.whosWatching', { defaultValue: "Who's watching?" })}
            </motion.h1>
          )}
        </div>

        {/* Bottom picker — the raised "arch" surface starts mid-tile, so the
            label sits on black and the avatars straddle the curve, matching
            the reference screenshots. */}
        <div className="relative pb-[calc(28px+env(safe-area-inset-bottom))]">
          <div
            className="absolute inset-x-0 bottom-0 top-[84px] transition-colors duration-700"
            style={archStyle}
          />

          <div className="relative">
            <p className="text-center text-[#b3b3b3] text-[17px] mb-6">
              {editMode
                ? t('profiles.editProfiles', { defaultValue: 'Edit profiles' })
                : t('profiles.chooseYourProfile', { defaultValue: 'Choose your profile' })}
            </p>

            {anyLocked ? (
              /* Locked layout: single row + separate Add/Edit action tiles. */
              <>
                <div className="flex justify-center gap-6 px-6 overflow-x-auto mb-7">
                  {profiles.map((profile) => (
                    <MobileProfileTile
                      key={profile.id}
                      profile={profile}
                      editMode={editMode}
                      onSelect={() => handleSelect(profile)}
                      onEdit={() => setModal({ mode: 'edit', profile })}
                    />
                  ))}
                </div>

                <div className="flex justify-center gap-8">
                  {canAddMore && (
                    <MobileActionTile
                      icon={<PlusIcon size={28} weight="regular" />}
                      label={t('profiles.add', { defaultValue: 'Add' })}
                      onClick={() => setModal({ mode: 'add' })}
                    />
                  )}
                  {/* Netflix flips Edit(pencil) → Finished(X) while editing */}
                  <MobileActionTile
                    icon={editMode ? <XIcon size={26} weight="regular" /> : <PencilSimpleIcon size={26} weight="regular" />}
                    label={editMode
                      ? t('profiles.finished', { defaultValue: 'Finished' })
                      : t('profiles.edit', { defaultValue: 'Edit' })}
                    onClick={() => setEditMode(v => !v)}
                  />
                </div>
              </>
            ) : (
              /* No-lock layout: centered grid with the Add tile integrated,
                 exactly like the reference (2×2 for ≤4 tiles). Edit mode is
                 reachable via Manage Profiles; while active, pencils overlay
                 the tiles and a Finished tile appears below. */
              <>
                <div className={`grid ${gridColsClass} gap-x-14 gap-y-6 w-fit mx-auto`}>
                  {profiles.map((profile) => (
                    <MobileProfileTile
                      key={profile.id}
                      profile={profile}
                      editMode={editMode}
                      large
                      onSelect={() => handleSelect(profile)}
                      onEdit={() => setModal({ mode: 'edit', profile })}
                    />
                  ))}
                  {canAddMore && !editMode && (
                    <AddGridTile
                      label={t('profiles.add', { defaultValue: 'Add' })}
                      onClick={() => setModal({ mode: 'add' })}
                    />
                  )}
                  {editMode && (
                    <MobileActionTile
                      icon={<XIcon size={26} weight="regular" />}
                      label={t('profiles.finished', { defaultValue: 'Finished' })}
                      onClick={() => setEditMode(false)}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {sharedOverlays}
      </div>
    );
  }

  /* ── Desktop layout ─────────────────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 z-[150] bg-black flex flex-col items-center justify-center px-6 overflow-y-auto">
      <img src={pstreamWordmark} alt="Pstream" className="h-8 sm:h-9 absolute top-8 left-8 sm:left-14" />

      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-white text-3xl sm:text-5xl font-medium mb-10 sm:mb-14 text-center"
      >
        {t('profiles.whosWatching', { defaultValue: "Who's watching?" })}
      </motion.h1>

      <div className="flex flex-wrap items-start justify-center gap-6 sm:gap-8 max-w-[900px]">
        {profiles.map((profile) => (
          <ProfileTile
            key={profile.id}
            profile={profile}
            editMode={editMode}
            onSelect={() => handleSelect(profile)}
            onEdit={() => setModal({ mode: 'edit', profile })}
          />
        ))}
        {canAddMore && (
          <AddProfileTile onClick={() => setModal({ mode: 'add' })} />
        )}
      </div>

      <button
        onClick={() => setEditMode(v => !v)}
        className="mt-12 sm:mt-16 px-8 py-2.5 border border-[#808080] text-[#808080] text-sm sm:text-base tracking-[0.18em] hover:text-white hover:border-white transition-colors"
      >
        {editMode
          ? t('common.done', { defaultValue: 'Done' })
          : t('profiles.manageProfiles', { defaultValue: 'Manage Profiles' })}
      </button>

      {sharedOverlays}
    </div>
  );
};

export default WhosWatchingGate;
