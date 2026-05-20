import React, { useState, useEffect, useRef } from 'react';
import { CaretRightIcon, GoogleLogoIcon, EnvelopeIcon, LockSimpleIcon,
  EyeIcon, EyeSlashIcon, CaretLeftIcon, UserIcon } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import logo from '../assets/logos/pstream-logo.svg';
import landingBg from '../assets/landing-bg.png';
import { supabase } from '../services/supabaseClient';
import { useAuthStore } from '../store/useAuthStore';
import Footer from '../components/Footer';
import { fetchData } from '../services/api';
import { REQUESTS } from '../constants';
import { Movie } from '../types';

// ─── Read-only Top 10 Card (no hover popup, no click) ──────────────────────
const SIZES = {
  card: 'h-[110px] w-[75px] sm:h-[140px] sm:w-[95px] md:h-[170px] md:w-[115px] lg:h-[200px] lg:w-[135px]',
};

const RankNumber: React.FC<{ index: number }> = ({ index }) => {
  const isTen = index === 9;
  return (
    <div
      className={`absolute left-[-20px] sm:left-[-26px] md:left-[-34px] lg:left-[-42px] bottom-[8%] h-[48%] z-20 pointer-events-none overflow-visible drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]`}
      style={{ width: isTen ? '60%' : '50%' }}
    >
      <svg
        viewBox={isTen ? '0 0 280 210' : '0 0 200 210'}
        className="h-full w-auto"
        preserveAspectRatio="xMinYMid meet"
        style={{ overflow: 'visible' }}
      >
        <g
          transform={isTen ? 'scale(1.0, 0.98)' : 'scale(1.1, 1.0)'}
          style={{ transformOrigin: '0px 205px' }}
        >
          <text x="8" y="195" textAnchor="start" dominantBaseline="auto"
            fill="none" stroke="#737373" strokeWidth="12" strokeLinejoin="round"
            fontSize="180" fontWeight="900"
            fontFamily="'Inter', sans-serif" letterSpacing={isTen ? '-22' : '-6'}>
            {index + 1}
          </text>
          <text x="8" y="195" textAnchor="start" dominantBaseline="auto"
            fill="#090909" stroke="#090909" strokeWidth="4" strokeLinejoin="round"
            fontSize="180" fontWeight="900"
            fontFamily="'Inter', sans-serif" letterSpacing={isTen ? '-22' : '-6'}>
            {index + 1}
          </text>
        </g>
      </svg>
    </div>
  );
};

interface AuthModalProps {
  initialView: 'signin' | 'signup';
  initialEmail: string;
  onClose: () => void;
}

const SIGNUP_AVATARS = [
  'https://lh3.googleusercontent.com/d/198aosLkzeCyglhaKy5vPMeWktSJhFui_', // Red
  'https://lh3.googleusercontent.com/d/1i3UrprAcfhKSNaSwFE1FXwTD6NXOfjaV', // Blue
  'https://lh3.googleusercontent.com/d/1ZYyoo8gUHeugXIa5ciA6pJySe3OPdkNB', // Yellow
  'https://lh3.googleusercontent.com/d/1wW1ox6Uc1g368rqZ5CAphVSH84KW711n', // Tommy Shelby
  'https://lh3.googleusercontent.com/d/1CCWWd9W3ODzxAn1lJ6TsKRYyAxdLxeq8', // Luffy
];

const AuthModal: React.FC<AuthModalProps> = ({ initialView, initialEmail, onClose }) => {
  const [view, setView] = useState<'signin' | 'signup'>(initialView);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(SIGNUP_AVATARS[0]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const navigate = useNavigate();

  // Reset view state when initialView prop changes (e.g. user toggles signin/signup outside modal)
  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  // Sync email from landing page input when it changes
  useEffect(() => {
    setEmail(initialEmail);
  }, [initialEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (view === 'signup') {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName.trim(),
              avatar_url: selectedAvatar
            }
          }
        });
        if (err) throw err;
        setSuccessMsg('Account created! Check your email to confirm, then sign in.');
        setView('signin');
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        navigate('/');
      }
    } catch (err: any) {
      const errMsg = err.message || '';
      if (
        errMsg.toLowerCase().includes('already registered') ||
        errMsg.toLowerCase().includes('already exists') ||
        err.code === 'user_already_exists'
      ) {
        setView('signin');
        setError('An account with this email already exists. Please enter your password to sign in.');
      } else {
        setError(errMsg || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/' }
    });
    if (err) { setError(err.message); setGoogleLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-[410px] bg-black/90 border border-white/10 rounded-xl p-8 shadow-2xl animate-fadeIn"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-white mb-1">
          {view === 'signin' ? 'Sign In' : 'Create Account'}
        </h2>
        <p className="text-white/40 text-sm mb-6">
          {view === 'signin' ? 'Welcome back!' : 'Start watching in seconds.'}
        </p>

        {/* Google */}
        <button
          onClick={handleGoogle}
          disabled={googleLoading}
          className="w-full h-12 mb-5 bg-white text-black rounded-lg font-bold flex items-center justify-center gap-3 hover:bg-gray-100 transition-all active:scale-[0.98] disabled:opacity-60"
        >
          <GoogleLogoIcon size={20} weight="bold" />
          {googleLoading ? 'Redirecting…' : 'Continue with Google'}
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-white/30 text-xs uppercase tracking-widest">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {successMsg && (
          <div className="mb-4 p-3 bg-green-500/20 border border-green-500/30 rounded text-green-300 text-sm">{successMsg}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {view === 'signup' && (
            <div className="relative">
              <UserIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
              <input
                type="text" required value={displayName} onChange={e => setDisplayName(e.target.value)}
                placeholder="Display name"
                className="w-full h-13 bg-[#2a2a2a] border border-white/10 text-white rounded-lg pl-10 pr-4 py-3.5 text-sm focus:outline-none focus:border-red-500 transition-colors placeholder:text-white/30"
              />
            </div>
          )}
          <div className="relative">
            <EnvelopeIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Email address" autoComplete="email"
              className="w-full h-13 bg-[#2a2a2a] border border-white/10 text-white rounded-lg pl-10 pr-4 py-3.5 text-sm focus:outline-none focus:border-red-500 transition-colors placeholder:text-white/30"
            />
          </div>
          <div className="relative">
            <LockSimpleIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
            <input
              type={showPassword ? 'text' : 'password'} required minLength={6}
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Password" autoComplete={view === 'signup' ? 'new-password' : 'current-password'}
              className="w-full h-13 bg-[#2a2a2a] border border-white/10 text-white rounded-lg pl-10 pr-10 py-3.5 text-sm focus:outline-none focus:border-red-500 transition-colors placeholder:text-white/30"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
              {showPassword ? <EyeSlashIcon size={16} /> : <EyeIcon size={16} />}
            </button>
          </div>
          
          {view === 'signup' && (
            <div className="space-y-2 pt-1 pb-1">
              <span className="text-white/40 text-xs font-semibold block">Choose Profile Icon</span>
              <div className="flex gap-3 justify-center pb-2">
                {SIGNUP_AVATARS.map((url) => {
                  const isSelected = selectedAvatar === url;
                  return (
                    <div
                      key={url}
                      onClick={() => setSelectedAvatar(url)}
                      className={`w-11 h-11 rounded-md overflow-hidden cursor-pointer border-[2px] transition-all
                        ${isSelected ? 'border-red-500 scale-105 shadow-md shadow-red-500/20' : 'border-transparent hover:scale-105'}`}
                    >
                      <img src={url} className="w-full h-full object-cover" alt="" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50 mt-1">
            {loading
              ? (view === 'signup' ? 'Creating…' : 'Signing in…')
              : (view === 'signup' ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <p className="mt-5 text-center text-white/40 text-sm">
          {view === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => { setView(view === 'signin' ? 'signup' : 'signin'); setError(''); setSuccessMsg(''); }}
            className="text-white hover:underline font-medium">
            {view === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
};

const LandingTopTenCard: React.FC<{ movie: Movie; index: number }> = ({ movie, index }) => {
  const posterSrc = movie.poster_path?.startsWith('http')
    ? movie.poster_path
    : `https://image.tmdb.org/t/p/w780${movie.poster_path}`;

  return (
    <motion.div
      whileHover={{ scale: 1.05, y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`relative flex-none ${SIZES.card} ml-6 sm:ml-8 md:ml-10 lg:ml-12 mr-4 md:mr-6 flex items-end select-none z-10 cursor-default`}
    >
      <RankNumber index={index} />
      <div className={`absolute right-0 bottom-0 w-full h-full z-10 rounded-lg overflow-hidden shadow-[0_0_15px_rgba(0,0,0,0.5)]`}>
        <img
          src={posterSrc}
          className="w-full h-full object-cover object-top"
          alt={movie.title || movie.name}
          loading="lazy"
          draggable={false}
        />
        {/* Subtle blur overlay so it looks intentionally non-interactive */}
        <div className="absolute inset-0 bg-black/10 pointer-events-none" />
      </div>
    </motion.div>
  );
};

const LandingTopTenRow: React.FC<{ title: string; fetchUrl: string }> = ({ title, fetchUrl }) => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({ left: false, right: true });

  useEffect(() => {
    fetchData(fetchUrl).then(res => {
      setMovies((res || []).slice(0, 10));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [fetchUrl]);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollState({ left: el.scrollLeft > 0, right: el.scrollLeft < el.scrollWidth - el.clientWidth - 4 });
  };

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({ left: dir === 'right' ? amount : -amount, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div>
        <h2 className="text-white text-xl md:text-2xl font-black mb-4 px-6 md:px-20 lg:px-32 xl:px-44 2xl:px-56">{title}</h2>
        <div className="flex gap-2 px-6 md:px-20 lg:px-32 xl:px-44 2xl:px-56">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className={`${SIZES.card} flex-none bg-[#333] rounded animate-pulse`} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative group/row">
      <h2 className="text-white text-xl md:text-2xl font-black mb-4 px-6 md:px-20 lg:px-32 xl:px-44 2xl:px-56">{title}</h2>
      <div className="relative mx-6 md:mx-20 lg:mx-32 xl:mx-44 2xl:mx-56">
        {/* Left arrow */}
        {scrollState.left && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-0 bottom-0 z-20 w-12 md:w-16 flex items-center justify-center bg-gradient-to-r from-black/90 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity"
          >
            <CaretLeftIcon size={36} weight="bold" className="text-white drop-shadow-lg" />
          </button>
        )}
        {/* Right arrow */}
        {scrollState.right && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-0 bottom-0 z-20 w-12 md:w-16 flex items-center justify-center bg-gradient-to-l from-black/90 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity"
          >
            <CaretRightIcon size={36} weight="bold" className="text-white drop-shadow-lg" />
          </button>
        )}
        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          className="flex gap-0 overflow-x-auto overflow-y-hidden scroll-smooth py-4 -my-4"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {movies.map((movie, i) => (
            <LandingTopTenCard key={movie.id} movie={movie} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
};

// Custom SVGs with gradients for Feature Cards
const FeatureIcon: React.FC<{ id: string }> = ({ id }) => {
  if (id === 'tv') {
    return (
      <div className="relative w-20 h-16 flex flex-col items-center justify-end">
        {/* Screen glow behind */}
        <div className="absolute top-0 w-16 h-12 rounded bg-gradient-to-br from-[#ff1f75]/20 to-[#8000ff]/20 blur-md pointer-events-none" />
        
        {/* Monitor Screen */}
        <div className="w-16 h-11 bg-[#101018] rounded-t-md border-2 border-[#2b2b3d] p-[1.5px] relative overflow-hidden flex items-center justify-center shadow-lg">
          {/* Glossy display gradient */}
          <div className="w-full h-full rounded-[2px] bg-gradient-to-tr from-[#9900ff] via-[#ff007c] to-[#ff8c00] opacity-80 relative">
            {/* Reflection shine overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-transparent rotate-12 scale-150 transform -translate-y-4" />
          </div>
        </div>
        
        {/* Stand neck */}
        <div className="w-2.5 h-2 bg-gradient-to-b from-[#2b2b3d] to-[#12121c] border-x border-[#3f3f5a]" />
        
        {/* Base */}
        <div className="w-10 h-[3px] bg-gradient-to-r from-[#ff0055] via-[#ff7700] to-[#ff0055] rounded-full shadow-md" />
      </div>
    );
  }

  if (id === 'stream') {
    return (
      <div className="relative w-16 h-16 flex items-center justify-center">
        {/* Outer Glow */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#ff007f]/30 to-[#7b2cbf]/30 blur-md pointer-events-none" />
        
        {/* Glossy circular disk */}
        <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#7b2cbf] via-[#d90429] to-[#ff007f] p-[1.5px] shadow-[0_4px_12px_rgba(0,0,0,0.5)] relative flex items-center justify-center overflow-hidden">
          {/* Radial highlight for 3D look */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.4)_0%,transparent_60%)]" />
          
          {/* Downward arrow SVG */}
          <svg className="w-6 h-6 text-white relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4V16M12 16L6 10M12 16L18 10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 20H20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    );
  }

  if (id === 'subtitles') {
    return (
      <div className="relative w-16 h-16 flex items-center justify-center">
        {/* Stars and sparks */}
        <div className="absolute -top-1 right-2 text-[#ff0055] text-xs animate-pulse font-bold">✦</div>
        <div className="absolute bottom-2 -left-1 text-[#ff7700] text-[10px] animate-pulse font-bold">✦</div>
        <div className="absolute top-4 -left-2 text-[#ff0055] text-[8px] animate-pulse font-bold">✦</div>
        
        {/* Soft glow behind */}
        <div className="absolute inset-2 rounded-full bg-[#ff007f]/10 blur-lg pointer-events-none" />
        
        {/* Telescope SVG with rich gradient fills */}
        <svg className="w-14 h-14 relative z-10" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="scopeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff007f" />
              <stop offset="50%" stopColor="#7e0fff" />
              <stop offset="100%" stopColor="#ff5500" />
            </linearGradient>
            <linearGradient id="standGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#555577" />
              <stop offset="100%" stopColor="#222233" />
            </linearGradient>
          </defs>
          
          {/* Tripod Stand */}
          <line x1="32" y1="36" x2="20" y2="58" stroke="url(#standGrad)" strokeWidth="3" strokeLinecap="round" />
          <line x1="32" y1="36" x2="44" y2="58" stroke="url(#standGrad)" strokeWidth="3" strokeLinecap="round" />
          <line x1="32" y1="36" x2="32" y2="55" stroke="url(#standGrad)" strokeWidth="3.5" strokeLinecap="round" />
          
          {/* Joint */}
          <circle cx="32" cy="36" r="4.5" fill="#3f3f5a" stroke="#fff" strokeWidth="1" />
          
          {/* Main Telescope Body */}
          <g transform="rotate(-30 32 32)">
            {/* Large lens cap */}
            <rect x="42" y="24" width="6" height="16" rx="1" fill="#fff" />
            {/* Main barrel */}
            <path d="M16 26H42V38H16C15 38 14 37 14 36V28C14 27 15 26 16 26Z" fill="url(#scopeGrad)" stroke="#fff" strokeWidth="1" />
            {/* Focus ring */}
            <rect x="22" y="25" width="3" height="14" fill="#ffea00" />
            {/* Small end barrel */}
            <rect x="6" y="29" width="8" height="6" fill="#222" stroke="#fff" strokeWidth="1" />
            {/* Eyepiece */}
            <path d="M2 28H6V36H2C1 36 0 35 0 34V30C0 29 1 28 2 28Z" fill="#555" />
          </g>
        </svg>
      </div>
    );
  }

  // place
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      {/* Soft Glow */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#ff0055]/10 to-[#ff500f]/10 blur-md pointer-events-none" />
      
      {/* Back profile card (Beige/Pink) */}
      <div className="absolute top-2 left-2 w-10 h-10 rounded-lg bg-gradient-to-br from-[#ffd2a0] to-[#ff9f68] border border-white/20 shadow-md flex flex-col items-center justify-center transform -rotate-6">
        {/* Cute eyes */}
        <div className="flex gap-2.5 mb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-[#3d1e03]" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#3d1e03]" />
        </div>
        {/* Smiling mouth */}
        <svg className="w-3.5 h-1.5 text-[#3d1e03]" viewBox="0 0 24 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 2C6 9 18 9 22 2" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </div>
      
      {/* Front profile card (Vibrant red/magenta gradient) */}
      <div className="absolute bottom-2 right-2 w-11 h-11 rounded-lg bg-gradient-to-br from-[#ff0055] to-[#ff500f] border border-white/30 shadow-lg flex flex-col items-center justify-center transform rotate-6">
        {/* Cute eyes */}
        <div className="flex gap-3 mb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-white" />
          <div className="w-1.5 h-1.5 rounded-full bg-white" />
        </div>
        {/* Smiling mouth */}
        <svg className="w-4 h-2 text-white" viewBox="0 0 24 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 2C6 9 18 9 22 2" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
};

interface Feature {
  id: string;
  title: string;
  desc: string;
}

const FEATURES: Feature[] = [
  {
    id: 'tv',
    title: 'Watch on any screen',
    desc: 'Stream on your smart TV, laptop, tablet or phone. Wherever you are, Pstream comes with you.',
  },
  {
    id: 'stream',
    title: 'Stream in HD & 4K',
    desc: 'Enjoy stunning picture quality with HD and Ultra HD streams, powered by the best available sources.',
  },
  {
    id: 'subtitles',
    title: 'Subtitles your way',
    desc: 'Choose from 40+ languages. Customise font size, colour, and background to your taste.',
  },
  {
    id: 'place',
    title: 'Never lose your place',
    desc: 'Continue Watching picks up exactly where you left off — across every show and season, on any device.',
  },
];

const FeatureCard: React.FC<Feature> = ({ id, title, desc }) => (
  <div className="bg-gradient-to-br from-[#1A2144] from-40% to-[#30181b] rounded-2xl p-5 md:p-7 flex flex-col justify-between min-h-[175px] md:min-h-[210px] relative overflow-hidden group transition-all duration-300">
    <div>
      <h3 className="text-white text-xl md:text-2xl font-black mb-2.5 leading-tight">{title}</h3>
      <p className="text-zinc-400 text-sm md:text-base font-normal leading-relaxed">{desc}</p>
    </div>
    <div className="mt-4 self-end opacity-90 transition-transform duration-300 group-hover:scale-110">
      <FeatureIcon id={id} />
    </div>
  </div>
);



// ─── Landing Page ────────────────────────────────────────────────────────────
type AuthView = 'none' | 'signin' | 'signup';

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const [authView, setAuthView] = useState<AuthView>('none');
  const [heroEmail, setHeroEmail] = useState('');

  useEffect(() => { if (user) navigate('/'); }, [user, navigate]);

  const handleGetStarted = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthView('signup');
  };

  return (
    <div className="bg-black text-white font-inter min-h-screen">

      {/* ── Navbar (logo + sign in only) ─────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-[80] bg-gradient-to-b from-black/80 to-transparent px-6 md:px-20 lg:px-32 xl:px-44 2xl:px-56 py-4 flex items-center justify-between">
        <img src={logo} alt="Pstream" className="h-5 md:h-7 cursor-pointer" onClick={() => {}} />
        <button
          onClick={() => setAuthView('signin')}
          className="px-5 py-2 bg-[#e50914] text-white text-sm font-bold rounded hover:bg-[#f40612] transition-all active:scale-95"
        >
          Sign In
        </button>
      </nav>

      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <section className="relative min-h-[60vh] sm:min-h-[65vh] md:min-h-[70vh] pt-32 pb-20 md:pt-44 md:pb-28 flex flex-col items-center justify-center text-center px-6 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img src={landingBg} className="w-full h-full object-cover opacity-50 scale-105" alt="" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.6)_100%)]" />
        </div>



        <div className="relative z-10 max-w-[720px] mx-auto space-y-6">
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black leading-tight tracking-tight drop-shadow-2xl">
            {t('auth.landingTitle', { defaultValue: 'Unlimited films, series and more' })}
          </h1>
          <p className="text-lg md:text-2xl font-medium text-white/90">
            {t('auth.readyToWatch', { defaultValue: 'Ready to watch? Enter your email to create or restart your membership.' })}
          </p>

          <form onSubmit={handleGetStarted} className="flex flex-col sm:flex-row gap-3 justify-center mt-8 max-w-xl mx-auto">
            <input
              type="email"
              value={heroEmail}
              onChange={e => setHeroEmail(e.target.value)}
              placeholder="Email address"
              className="flex-1 h-14 bg-black/50 border border-white/30 text-white rounded px-4 text-base focus:outline-none focus:border-white transition-colors placeholder:text-white/40 backdrop-blur-md"
            />
            <button
              type="submit"
              className="h-14 px-8 bg-[#e50914] hover:bg-[#f40612] text-white font-bold text-lg rounded flex items-center gap-2 whitespace-nowrap transition-all hover:scale-[1.02] active:scale-95 shadow-xl"
            >
              Get Started
              <CaretRightIcon size={22} weight="bold" />
            </button>
          </form>
        </div>
      </section>

      {/* ── Top 10 Trending Row ──────────────────────────────────────────── */}
      <section className="pt-12 pb-6 bg-black">
        <LandingTopTenRow
          title="Trending now"
          fetchUrl={REQUESTS.fetchTrending}
        />
      </section>



      {/* ── More Reasons to Join ─────────────────────────────────────────── */}
      <section className="py-12 md:py-20 px-6 md:px-20 lg:px-32 xl:px-44 2xl:px-56 bg-black">
        <h2 className="text-white text-2xl md:text-4xl font-black mb-8 md:mb-12">More reasons to join</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
          {FEATURES.map(f => <FeatureCard key={f.title} {...f} />)}
        </div>
      </section>



      {/* ── Bottom CTA ───────────────────────────────────────────────────── */}
      <section className="py-16 px-6 text-center bg-black">
        <p className="text-white text-lg md:text-xl font-normal mb-6">
          {t('auth.readyToWatch', { defaultValue: 'Ready to watch? Enter your email to create or log in to your account.' })}
        </p>
        <form
          onSubmit={handleGetStarted}
          className="flex flex-col sm:flex-row gap-3 justify-center max-w-xl mx-auto"
        >
          <input
            type="email"
            value={heroEmail}
            onChange={e => setHeroEmail(e.target.value)}
            placeholder="Email address"
            className="flex-1 h-14 bg-black/50 border border-white/30 text-white rounded px-4 text-base focus:outline-none focus:border-white transition-colors placeholder:text-white/40 backdrop-blur-md"
          />
          <button
            type="submit"
            className="h-14 px-8 bg-[#e50914] hover:bg-[#f40612] text-white font-bold text-lg rounded flex items-center gap-2 whitespace-nowrap transition-all hover:scale-[1.02] active:scale-95 shadow-xl"
          >
            Get Started <CaretRightIcon size={22} weight="bold" />
          </button>
        </form>
      </section>



      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <Footer />

      {/* ── Auth Modal ───────────────────────────────────────────────────── */}
      {authView !== 'none' && (
        <AuthModal
          initialView={authView === 'signin' ? 'signin' : 'signup'}
          initialEmail={heroEmail}
          onClose={() => setAuthView('none')}
        />
      )}
    </div>
  );
};

export default LoginPage;
