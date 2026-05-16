import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  checkPin, isAuthenticated, setAuthenticated, clearAuthentication,
  getLockState, recordFailedAttempt, clearAttempts,
} from '../services/ghostAuth';
import { getAllProviderHealth } from '../services/ProviderHealthService';
import { 
  ArrowLeftIcon, SignOutIcon, ActivityIcon, 
  GlobeIcon, ShieldCheckIcon, HardDriveIcon,
  FlaskIcon, TerminalIcon, LinkIcon, CaretRightIcon,
  TrashIcon, BellIcon, BroadcastIcon, ArrowCounterClockwise
} from '@phosphor-icons/react';
import { SettingsToggle, SettingsInput } from '../ui/SettingsUI';
import pstreamLogo from '../assets/logos/pstream-logo.svg';

// ─── External links ────────────────────────────────────────────────────────────
const LINKS = {
  cloudflare:    'https://dash.cloudflare.com/',
  cfPages:       'https://dash.cloudflare.com/?to=/:account/pages',
  hfGiga:        'https://huggingface.co/spaces/ibrahimar397/pstream-giga',
  hfNewPipe:     'https://huggingface.co/spaces/ibrahimar397/pstream-newpipe',
  hfNewPipeEdit: 'https://huggingface.co/spaces/ibrahimar397/pstream-newpipe/blob/main/app.py',
  githubFront:   'https://github.com/Promarcos397/pstream-frontend',
  githubBack:    'https://github.com/Promarcos397/pstream-backend',
  githubNewPipe: 'https://github.com/Promarcos397/pstream-newpipe',
  tmdbDashboard: 'https://www.themoviedb.org/settings/api',
};

const GIGA_URL    = import.meta.env.VITE_GIGA_BACKEND_URL || 'https://ibrahimar397-pstream-giga.hf.space';
const NEWPIPE_URL = import.meta.env.VITE_NEWPIPE_URL      || '';

// ─── PIN Gate ─────────────────────────────────────────────────────────────────
const PinGate: React.FC<{ onAuth: () => void }> = ({ onAuth }) => {
  const [pin, setPin]           = useState('');
  const [error, setError]       = useState('');
  const [checking, setChecking] = useState(false);
  const [lockInfo, setLockInfo] = useState(getLockState());
  const navigate = useNavigate();

  useEffect(() => {
    if (!lockInfo.locked) return;
    const t = setInterval(() => {
      const st = getLockState();
      setLockInfo(st);
      if (!st.locked) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [lockInfo.locked]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (getLockState().locked) return;
    setChecking(true); setError('');
    const ok = await checkPin(pin);
    if (ok) {
      setAuthenticated(); clearAttempts(); onAuth();
    } else {
      const { locked } = recordFailedAttempt();
      setLockInfo(getLockState());
      setError(locked ? 'Too many attempts — locked 10 min.' : 'Incorrect passphrase.');
      setPin('');
    }
    setChecking(false);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-inter">
      <header className="h-16 border-b border-gray-100 flex items-center px-6 md:px-10 lg:px-16 bg-white sticky top-0 z-[100] pt-safe">
        <div onClick={() => navigate('/')} className="cursor-pointer h-8 flex items-center">
            <img src={pstreamLogo} alt="Pstream" className="h-6 md:h-8 w-auto" />
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[420px] animate-fadeIn">
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShieldCheckIcon size={32} weight="fill" className="text-red-600" />
            </div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">Admin Access</h1>
            <p className="text-gray-500 text-sm">Enter your administrative passphrase to continue.</p>
          </div>

          {!import.meta.env.VITE_ADMIN_PIN_HASH && (
            <div className="bg-amber-50 border border-amber-200 rounded p-4 mb-8 flex gap-3">
              <span className="text-amber-600">⚠</span>
              <p className="text-xs text-amber-800 font-medium leading-relaxed">
                Development mode: VITE_ADMIN_PIN_HASH is not configured. Any input will grant access.
              </p>
            </div>
          )}

          {lockInfo.locked ? (
            <div className="bg-red-50 border border-red-100 rounded p-6 text-center">
              <p className="text-red-600 font-bold text-sm">Access Temporarily Locked</p>
              <p className="text-red-600/60 text-xs mt-1">{Math.ceil(lockInfo.remainingMs / 60000)} minutes remaining</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              <SettingsInput 
                label="Passphrase"
                type="password"
                value={pin}
                onChange={setPin}
                placeholder="••••••••"
                darkTheme={false}
              />
              
              {error && <p className="text-red-600 text-xs font-bold text-center animate-shake">{error}</p>}

              <button 
                type="submit" 
                disabled={checking || !pin}
                className="w-full h-14 bg-red-600 hover:bg-red-700 disabled:opacity-30 text-white font-bold rounded flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-600/10 active:scale-95"
              >
                {checking ? 'Verifying...' : 'Sign In to Dashboard'}
                <CaretRightIcon size={20} weight="bold" />
              </button>
            </form>
          )}

          <div className="mt-12 pt-8 border-t border-gray-100 flex justify-center gap-6 opacity-30 grayscale pointer-events-none">
            <img src="/p-icon.svg" alt="" className="h-4" />
            <span className="text-[10px] font-black tracking-widest uppercase text-gray-900">Infrastructure Panel v2.1</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Shared sub-components ────────────────────────────────────────────────────
const StatusDot: React.FC<{ status: 'up' | 'waking' | 'down' | 'unconfigured' }> = ({ status }) => {
  const cfg = {
    up:           { color: '#16a34a', label: 'Healthy',    bg: 'bg-green-50' },
    waking:       { color: '#d97706', label: 'Waking',     bg: 'bg-amber-50' },
    down:         { color: '#dc2626', label: 'Offline',    bg: 'bg-red-50'   },
    unconfigured: { color: '#4b5563', label: 'Not Set',    bg: 'bg-gray-100' },
  }[status] || { color: '#4b5563', label: 'Unknown', bg: 'bg-gray-100' };

  return (
    <div className={`flex items-center gap-2.5 px-3 py-1.5 rounded-full ${cfg.bg} transition-all`}>
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: cfg.color }}>{cfg.label}</span>
    </div>
  );
};

const SectionHeader: React.FC<{ title: string; icon: React.ReactNode; sub?: string }> = ({ title, icon, sub }) => (
  <div className="mb-8">
    <div className="flex items-center gap-3 mb-1">
      <div className="text-red-600">{icon}</div>
      <h3 className="text-xl font-black text-gray-900 tracking-tight uppercase">{title}</h3>
    </div>
    {sub && <p className="text-sm text-gray-500 font-medium">{sub}</p>}
  </div>
);

const ExtLink: React.FC<{ href: string; label: string; desc?: string; icon?: React.ReactNode }> = ({ href, label, desc, icon }) => (
  <a href={href} target="_blank" rel="noopener noreferrer"
    className="group flex items-start gap-4 p-5 rounded-lg border border-gray-100 hover:border-gray-200 bg-white hover:shadow-md transition-all">
    <div className="p-2.5 rounded-md bg-gray-50 text-gray-400 group-hover:text-red-600 group-hover:bg-red-50 transition-colors">
      {icon || <LinkIcon size={20} />}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-gray-900">{label}</span>
        <CaretRightIcon size={14} weight="bold" className="text-gray-300 group-hover:text-red-600 transition-transform group-hover:translate-x-1" />
      </div>
      {desc && <p className="text-xs text-gray-500 mt-1 leading-relaxed truncate">{desc}</p>}
    </div>
  </a>
);

// ─── Main Dashboard ────────────────────────────────────────────────────────────
const GhostDashboard: React.FC<{ onSignOut: () => void }> = ({ onSignOut }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'flags' | 'ops'>('overview');
  const [status, setStatus]     = useState<any>({ giga: 'up', newpipe: 'unconfigured' });
  const [pinging, setPinging]   = useState(false);
  const [wakeNewpipe, setWakeNewpipe]   = useState<'idle'|'waking'|'ok'|'fail'>('idle');
  const [clearMsg, setClearMsg]         = useState('');
  const [providerHealth, setProviderHealth] = useState<any[]>([]);
  const [streamCacheSize, setStreamCacheSize] = useState(0);

  const [ytDisabled, setYtDisabled]       = useState(() => JSON.parse(localStorage.getItem('pstream-yt-disabled') || 'false'));
  const [newpipeEnabled, setNewpipeEnabled] = useState(() => JSON.parse(localStorage.getItem('pstream-newpipe-enabled') || 'true'));
  const [torrentEnabled, setTorrentEnabled] = useState(() => JSON.parse(localStorage.getItem('pstream-torrent-enabled') || 'true'));
  const [subtitleAi, setSubtitleAi] = useState(() => JSON.parse(localStorage.getItem('pstream-subtitle-ai') || 'true'));

  const handlePing = useCallback(async () => {
    setPinging(true);
    try {
      const gigaPromise = fetch(`${GIGA_URL}/health`).then(r => r.ok ? 'up' : 'down').catch(() => 'down');
      const npPromise = NEWPIPE_URL ? fetch(`${NEWPIPE_URL}/health`).then(r => r.ok ? 'up' : 'down').catch(() => 'down') : Promise.resolve('unconfigured');
      
      const [gigaStatus, npStatus] = await Promise.all([gigaPromise, npPromise]);
      setStatus({ giga: gigaStatus, newpipe: npStatus });
    } catch {
      setStatus({ giga: 'down', newpipe: 'down' });
    }
    setPinging(false);
  }, []);

  const handleClearCache = async () => {
    setClearMsg('');
    try {
      const r = await fetch(`${GIGA_URL}/api/cache/clear`, { method: 'POST', signal: AbortSignal.timeout(10000) });
      setClearMsg(r.ok ? '✓ Backend cache cleared' : `⚠ Server error: ${r.status}`);
    } catch (e: any) { setClearMsg(`✗ Connection failed: ${e.message}`); }
  };

  const handleWakeNewpipe = async () => {
    if (!NEWPIPE_URL) { setClearMsg('VITE_NEWPIPE_URL not set'); return; }
    setWakeNewpipe('waking');
    try {
      const r = await fetch(`${NEWPIPE_URL}/health`, { signal: AbortSignal.timeout(60000) });
      setWakeNewpipe(r.ok ? 'ok' : 'fail');
      if (r.ok) setStatus((prev: any) => ({ ...prev, newpipe: 'up' }));
    } catch { setWakeNewpipe('fail'); }
    setTimeout(() => setWakeNewpipe('idle'), 8000);
  };

  useEffect(() => {
    try { setProviderHealth(getAllProviderHealth()); } catch {}
    try {
      const keys = Object.keys(sessionStorage).filter(k => k.startsWith('pstream-stream-'));
      setStreamCacheSize(keys.length);
    } catch {}
    handlePing();
  }, [handlePing]);

  const navItems = [
    { id: 'overview', label: 'System Overview', icon: ActivityIcon },
    { id: 'services', label: 'Infrastructure', icon: HardDriveIcon },
    { id: 'flags',    label: 'Feature Toggles', icon: FlaskIcon },
    { id: 'ops',      label: 'Ops & Deployment',icon: LinkIcon },
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col font-inter">
      <header className="h-20 border-b border-gray-100 flex items-center justify-between px-6 md:px-10 lg:px-16 bg-white sticky top-0 z-[100] pt-safe">
        <div className="flex items-center gap-6">
          <div onClick={() => navigate('/')} className="cursor-pointer h-8 flex items-center">
            <img src={pstreamLogo} alt="Pstream" className="h-7 md:h-9 w-auto" />
          </div>
          <div className="h-8 w-px bg-gray-100 hidden sm:block" />
          <div className="hidden sm:flex items-center gap-2.5">
            <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center">
              <TerminalIcon size={18} weight="bold" className="text-white" />
            </div>
            <span className="text-sm font-black text-gray-900 tracking-tight uppercase">Admin Console</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-gray-50 rounded text-[10px] font-bold text-gray-400 uppercase tracking-widest border border-gray-100">
             <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
             Live Production
          </div>
          <button onClick={onSignOut} className="text-xs font-bold text-gray-400 hover:text-red-600 transition-colors uppercase tracking-widest flex items-center gap-2">
            <SignOutIcon size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row w-full max-w-[1440px] mx-auto min-h-0">
        {/* Sidebar Nav */}
        <aside className="w-full md:w-72 border-r border-gray-100 p-6 md:py-12 space-y-1 overflow-y-auto">
           {navItems.map(item => (
             <button
               key={item.id}
               onClick={() => setActiveTab(item.id as any)}
               className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-lg text-sm font-bold transition-all ${
                 activeTab === item.id 
                 ? 'bg-red-50 text-red-600 shadow-sm' 
                 : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
               }`}
             >
               <item.icon size={22} weight={activeTab === item.id ? 'fill' : 'duotone'} />
               {item.label}
             </button>
           ))}
           
           <div className="mt-12 pt-8 border-t border-gray-100">
              <div className="px-4">
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Quick Status</p>
                 <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-gray-900 uppercase">Giga</span>
                      <StatusDot status={status.giga} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-gray-900 uppercase">NewPipe</span>
                      <StatusDot status={status.newpipe} />
                    </div>
                 </div>
              </div>
           </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-6 md:p-12 lg:p-16 overflow-y-auto bg-gray-50/30">
          <div className="max-w-[900px] animate-fadeIn">
            
            {activeTab === 'overview' && (
              <div className="space-y-12">
                <SectionHeader 
                  title="System Overview" 
                  icon={<ActivityIcon size={32} weight="duotone" />} 
                  sub="Real-time telemetry and service health summary."
                />
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1">Session Cache</p>
                    <h4 className="text-2xl font-black text-gray-900">{streamCacheSize} <span className="text-sm font-medium text-gray-400">Items</span></h4>
                    <div className="mt-4 h-1.5 w-full bg-gray-50 rounded-full overflow-hidden">
                       <div className="h-full bg-red-600 rounded-full" style={{ width: `${Math.min(100, (streamCacheSize/20)*100)}%` }} />
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1">Stream Providers</p>
                    <h4 className="text-2xl font-black text-gray-900">{providerHealth.length} <span className="text-sm font-medium text-gray-400">Active</span></h4>
                    <div className="mt-4 flex gap-1">
                       {providerHealth.map((p, i) => (
                         <div key={i} className="w-2 h-2 rounded-full bg-green-500" />
                       ))}
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1">Environment</p>
                    <h4 className="text-2xl font-black text-red-600 uppercase italic tracking-tighter">{import.meta.env.MODE}</h4>
                    <p className="mt-4 text-[10px] font-mono text-gray-400 truncate">V: {new Date().toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">Active Endpoints</h4>
                    <button onClick={handlePing} disabled={pinging} className="text-red-600 hover:text-red-700 disabled:opacity-30">
                      <ArrowCounterClockwise size={16} weight="bold" className={pinging ? 'animate-spin' : ''} />
                    </button>
                  </div>
                  <div className="divide-y divide-gray-100">
                    <div className="px-6 py-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
                           <GlobeIcon size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">Primary Backend (Giga)</p>
                          <p className="text-[10px] font-mono text-gray-400">{GIGA_URL}</p>
                        </div>
                      </div>
                      <StatusDot status={status.giga} />
                    </div>
                    <div className="px-6 py-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
                           <BroadcastIcon size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">Extraction Proxy (NewPipe)</p>
                          <p className="text-[10px] font-mono text-gray-400">{NEWPIPE_URL || 'Not Configured'}</p>
                        </div>
                      </div>
                      <StatusDot status={status.newpipe} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'services' && (
              <div className="space-y-12">
                <SectionHeader 
                  title="Infrastructure" 
                  icon={<HardDriveIcon size={32} weight="duotone" />} 
                  sub="Manual service orchestration and cache management."
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="p-8 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all">
                    <h4 className="text-base font-black text-gray-900 uppercase mb-3">Global Stream Cache</h4>
                    <p className="text-sm text-gray-500 leading-relaxed mb-8 font-medium">Purge all extracted stream URLs from the backend Redis store. Required if stream providers update their URL logic.</p>
                    <button onClick={handleClearCache}
                      className="w-full py-4 bg-gray-900 text-white text-xs font-black rounded-lg uppercase tracking-widest hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-3">
                      <TrashIcon size={18} weight="bold" />
                      Purge Production Cache
                    </button>
                    {clearMsg && <p className="text-[11px] font-mono text-red-600 mt-4 text-center bg-red-50 p-2 rounded">{clearMsg}</p>}
                  </div>

                  <div className="p-8 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all">
                    <h4 className="text-base font-black text-gray-900 uppercase mb-3">NewPipe Instance</h4>
                    <p className="text-sm text-gray-500 leading-relaxed mb-8 font-medium">HuggingFace Spaces spin down after 48h of inactivity. Manually wake the service to ensure instant trailer playback.</p>
                    <button onClick={handleWakeNewpipe} disabled={wakeNewpipe === 'waking'}
                      className={`w-full py-4 border-2 text-xs font-black rounded-lg uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-3 ${
                        wakeNewpipe === 'ok'   ? 'bg-green-600 border-green-600 text-white' :
                        wakeNewpipe === 'fail' ? 'bg-red-600 border-red-600 text-white' :
                                                'border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white'
                      }`}>
                      <BellIcon size={18} weight="bold" />
                      {wakeNewpipe === 'waking' ? 'Waking Service...' :
                       wakeNewpipe === 'ok'     ? 'Service Online' :
                       wakeNewpipe === 'fail'   ? 'Wake Request Failed' :
                                                 'Send Wake Signal'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'flags' && (
              <div className="space-y-12">
                <SectionHeader 
                  title="Feature Toggles" 
                  icon={<FlaskIcon size={32} weight="duotone" />} 
                  sub="Override global application logic for development and testing."
                />
                
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-4">
                  <SettingsToggle 
                    label="Enforce NewPipe Proxy" 
                    subLabel="Route all YouTube/Trailer requests through secondary proxy to avoid ratelimits." 
                    checked={ytDisabled} 
                    onChange={() => { setYtDisabled(!ytDisabled); localStorage.setItem('pstream-yt-disabled', JSON.stringify(!ytDisabled)); }} 
                    darkTheme={false} 
                  />
                  <div className="h-px bg-gray-50" />
                  <SettingsToggle 
                    label="Enable Extraction Engine" 
                    subLabel="Use Giga-Backend to parse direct video streams for movie/tv trailers." 
                    checked={newpipeEnabled} 
                    onChange={() => { setNewpipeEnabled(!newpipeEnabled); localStorage.setItem('pstream-newpipe-enabled', JSON.stringify(!newpipeEnabled)); }} 
                    darkTheme={false} 
                  />
                  <div className="h-px bg-gray-50" />
                  <SettingsToggle 
                    label="High-Speed CDN Fallback" 
                    subLabel="Allow client to connect to secondary edge nodes if primary stream buffers." 
                    checked={torrentEnabled} 
                    onChange={() => { setTorrentEnabled(!torrentEnabled); localStorage.setItem('pstream-torrent-enabled', JSON.stringify(!torrentEnabled)); }} 
                    darkTheme={false} 
                  />
                  <div className="h-px bg-gray-50" />
                  <SettingsToggle 
                    label="Smart Subtitle Engine" 
                    subLabel="Apply AI-based timing offsets to subtitles to match audio track exactly." 
                    checked={subtitleAi} 
                    onChange={() => { setSubtitleAi(!subtitleAi); localStorage.setItem('pstream-subtitle-ai', JSON.stringify(!subtitleAi)); }} 
                    darkTheme={false} 
                  />
                </div>
              </div>
            )}

            {activeTab === 'ops' && (
              <div className="space-y-12">
                <SectionHeader 
                  title="Deployment & Ops" 
                  icon={<LinkIcon size={32} weight="duotone" />} 
                  sub="Direct links to cloud infrastructure and source control."
                />
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <ExtLink href={LINKS.cfPages} label="Cloudflare Pages" desc="Frontend CI/CD" icon={<GlobeIcon size={20} />} />
                  <ExtLink href={LINKS.hfGiga} label="Giga Backend" desc="Node.js Spaces Controller" icon={<HardDriveIcon size={20} />} />
                  <ExtLink href={LINKS.githubFront} label="Frontend Source" desc="GitHub Repository" />
                  <ExtLink href={LINKS.tmdbDashboard} label="TMDB API" desc="Developer Console" />
                  <ExtLink href={LINKS.hfNewPipe} label="NewPipe Proxy" desc="Python Extraction Engine" />
                  <ExtLink href={LINKS.githubBack} label="Backend Source" desc="Giga System Repo" />
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      <footer className="h-16 border-t border-gray-100 px-6 md:px-16 bg-white flex items-center justify-between opacity-40">
          <div className="flex items-center gap-3">
             <img src="/p-icon.svg" alt="" className="h-5" />
             <span className="text-[10px] font-black uppercase tracking-widest text-gray-900">Infrastructure Suite v3.0</span>
          </div>
          <div className="hidden sm:flex text-[10px] font-bold text-gray-500 uppercase tracking-widest gap-8">
            <span>Zero-Chatter Engine</span>
            <span>Authored by Antigravity</span>
          </div>
      </footer>
    </div>
  );
};

// ─── Root ──────────────────────────────────────────────────────────────────────
const GhostPage: React.FC = () => {
  const [authed, setAuthed] = useState(isAuthenticated());
  if (!authed) return <PinGate onAuth={() => setAuthed(true)} />;
  return <GhostDashboard onSignOut={() => { clearAuthentication(); setAuthed(false); }} />;
};

export default GhostPage;
