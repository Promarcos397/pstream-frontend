/**
 * pages/GhostPage.tsx  (/ghost)
 * ──────────────────────────────
 * Secret admin panel — same design language as the P-Stream app.
 * Protected by SHA-256 PIN gate with session-only auth + brute-force lockout.
 *
 * Set VITE_ADMIN_PIN_HASH = sha256(yourPassphrase) in .env + Cloudflare Pages.
 * Generate: node -e "const c=require('crypto');console.log(c.createHash('sha256').update('YOUR_PIN').digest('hex'))"
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  checkPin, isAuthenticated, setAuthenticated,
  getLockState, recordFailedAttempt, clearAttempts,
} from '../services/ghostAuth';
import { backendWakeService, ServiceStatus } from '../services/BackendWakeService';
import { getAllProviderHealth } from '../services/ProviderHealthService';

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

// ─── Design tokens (matches the app) ──────────────────────────────────────────
// bg: #141414  surface: #1f1f1f  border: rgba(255,255,255,0.08)  red: #e50914
const s = {
  page:    'min-h-screen bg-[#141414] text-white',
  surface: 'bg-[#1f1f1f] border border-white/[0.08] rounded-xl',
  label:   'text-[11px] font-semibold uppercase tracking-widest text-white/40',
  muted:   'text-xs text-white/40',
  mono:    'font-mono text-xs',
  red:     '#e50914',
};

// ─── PIN Gate ─────────────────────────────────────────────────────────────────
const PinGate: React.FC<{ onAuth: () => void }> = ({ onAuth }) => {
  const [pin, setPin]           = useState('');
  const [error, setError]       = useState('');
  const [checking, setChecking] = useState(false);
  const [lockInfo, setLockInfo] = useState(getLockState());

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
    <div className={`${s.page} flex items-center justify-center`} style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_80%,rgba(229,9,20,0.06),transparent)] pointer-events-none" />

      <div className={`${s.surface} w-full max-w-sm px-8 py-10 relative`}>
        {/* Pstream assets */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <img src="/p-icon.svg" alt="P-Stream" className="h-8 w-auto" />
          <img src="/pstream-wordmark.svg" alt="pstream" className="h-6 w-auto" />
          <span className="text-[10px] font-mono text-white/20 border border-white/10 rounded px-1.5 py-0.5 tracking-widest">ADMIN</span>
        </div>

        <h1 className="text-center text-white font-semibold text-base mb-1">Access Required</h1>
        <p className="text-center text-white/30 text-xs mb-7">Enter your admin passphrase to continue</p>

        {!import.meta.env.VITE_ADMIN_PIN_HASH && (
          <div className="text-center text-amber-400/70 text-[10px] font-mono bg-amber-400/5 border border-amber-400/15 rounded-lg px-3 py-2 mb-4">
            ⚠ Dev mode — VITE_ADMIN_PIN_HASH not set. Any input grants access.
          </div>
        )}

        {lockInfo.locked ? (
          <div className="text-center text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            🔒 Locked — {Math.ceil(lockInfo.remainingMs / 60000)}m remaining
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder="Passphrase"
              autoFocus
              autoComplete="current-password"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-white/20 outline-none focus:border-white/30 transition-colors"
            />
            {error && <p className="text-red-400 text-xs text-center">{error}</p>}
            <button type="submit" disabled={checking || !pin}
              className="w-full py-3 bg-[#e50914] hover:bg-[#f40612] disabled:opacity-40 text-white font-bold rounded-lg text-sm transition-colors">
              {checking ? 'Verifying…' : 'Continue'}
            </button>
          </form>
        )}
        <p className="text-center text-white/10 text-[10px] mt-6 font-mono">Not indexed · Not linked · Session only</p>
      </div>
    </div>
  );
};

// ─── Shared sub-components ────────────────────────────────────────────────────
const StatusDot: React.FC<{ status: 'up' | 'waking' | 'down' | 'unconfigured' }> = ({ status }) => {
  const cfg = {
    up:           { color: '#22c55e', label: 'Live',         glow: true  },
    waking:       { color: '#f59e0b', label: 'Waking',       glow: false },
    down:         { color: '#e50914', label: 'Down',          glow: false },
    unconfigured: { color: '#525252', label: 'Not set',       glow: false },
  }[status];
  return (
    <span className="flex items-center gap-2 flex-shrink-0">
      <span className="w-2 h-2 rounded-full inline-block"
        style={{ backgroundColor: cfg.color, boxShadow: cfg.glow ? `0 0 6px ${cfg.color}` : 'none' }} />
      <span className="text-xs font-semibold tracking-wide" style={{ color: cfg.color }}>{cfg.label}</span>
    </span>
  );
};

const Panel: React.FC<{ title: string; icon?: string; children: React.ReactNode; className?: string }> = ({ title, icon, children, className = '' }) => (
  <div className={`${s.surface} p-6 ${className}`}>
    <div className={`${s.label} mb-5 flex items-center gap-2`}>
      {icon && <span className="text-base">{icon}</span>}
      {title}
    </div>
    {children}
  </div>
);

const ExtLink: React.FC<{ href: string; label: string; desc?: string }> = ({ href, label, desc }) => (
  <a href={href} target="_blank" rel="noopener noreferrer"
    className="flex items-center justify-between gap-3 p-3 rounded-lg border border-white/[0.06] hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.05] transition-all group cursor-pointer">
    <div>
      <div className="text-sm font-medium text-white/90 group-hover:text-white transition-colors">{label}</div>
      {desc && <div className={`${s.muted} mt-0.5`}>{desc}</div>}
    </div>
    <svg className="w-3.5 h-3.5 text-white/20 group-hover:text-white/60 flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  </a>
);

const Toggle: React.FC<{ label: string; desc?: string; value: boolean; onChange: (v: boolean) => void }> = ({ label, desc, value, onChange }) => (
  <div className="flex items-center justify-between gap-4 py-3.5 border-b border-white/[0.05] last:border-0">
    <div>
      <div className="text-sm font-medium text-white/90">{label}</div>
      {desc && <div className={`${s.muted} mt-0.5`}>{desc}</div>}
    </div>
    <button onClick={() => onChange(!value)} aria-pressed={value}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 focus:outline-none ${value ? 'bg-[#e50914]' : 'bg-white/15'}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${value ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  </div>
);

// ─── NewPipe tester ────────────────────────────────────────────────────────────
const NewPipeTester: React.FC = () => {
  const [query, setQuery]     = useState('Oppenheimer 2023');
  const [result, setResult]   = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const runTest = async () => {
    if (!NEWPIPE_URL) { setError('VITE_NEWPIPE_URL not configured'); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const sr = await fetch(`${NEWPIPE_URL}/search?q=${encodeURIComponent(query + ' trailer')}&limit=1`, { signal: AbortSignal.timeout(15000) });
      if (!sr.ok) throw new Error(`Search ${sr.status}`);
      const sd  = await sr.json();
      const top = sd.results?.[0];
      if (!top?.url && !top?.id) throw new Error('No results returned');
      const videoUrl = top.url || `https://www.youtube.com/watch?v=${top.id}`;
      const ex = await fetch(`${NEWPIPE_URL}/extract?url=${encodeURIComponent(videoUrl)}`, { signal: AbortSignal.timeout(25000) });
      if (!ex.ok) throw new Error(`Extract ${ex.status}`);
      setResult({ search: top, extract: await ex.json() });
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Movie title year"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-white/25 transition-colors"
          onKeyDown={e => e.key === 'Enter' && runTest()} />
        <button onClick={runTest} disabled={loading}
          className="px-5 py-2.5 bg-[#e50914] hover:bg-[#f40612] disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors">
          {loading ? '…' : 'Test'}
        </button>
      </div>
      {error && <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 font-mono">{error}</div>}
      {result && (
        <div className="space-y-2 pt-1">
          <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
            ✓ <span className="font-semibold">{result.search.title}</span>
            {result.extract.quality && <span className="text-green-400/60 ml-2">· {result.extract.quality}</span>}
          </div>
          {result.extract.stream_url && (
            <div className="text-[11px] text-white/40 font-mono bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 break-all">
              {result.extract.stream_url.substring(0, 140)}…
            </div>
          )}
          {Object.keys(result.extract.subtitles || {}).length > 0 && (
            <div className="text-xs text-white/50">
              Subtitles: <span className="text-white/80">{Object.keys(result.extract.subtitles).join(', ')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Dashboard ────────────────────────────────────────────────────────────
const GhostDashboard: React.FC<{ onSignOut: () => void }> = ({ onSignOut }) => {
  const [status, setStatus]     = useState<ServiceStatus>(backendWakeService.getStatus());
  const [pinging, setPinging]   = useState(false);
  const [wakeNewpipe, setWakeNewpipe]   = useState<'idle'|'waking'|'ok'|'fail'>('idle');
  const [clearMsg, setClearMsg]         = useState('');
  const [providerHealth, setProviderHealth] = useState<any[]>([]);
  const [streamCacheSize, setStreamCacheSize] = useState(0);

  const [ytDisabled, setYtDisabled]       = useState(() => { try { return JSON.parse(localStorage.getItem('pstream-yt-disabled') || 'false'); } catch { return false; } });
  const [newpipeEnabled, setNewpipeEnabled] = useState(() => { try { return JSON.parse(localStorage.getItem('pstream-newpipe-enabled') || 'true'); } catch { return true; } });
  const [torrentEnabled, setTorrentEnabled] = useState(() => { try { return JSON.parse(localStorage.getItem('pstream-torrent-enabled') || 'true'); } catch { return true; } });
  const [subtitleAi, setSubtitleAi] = useState(() => { try { return JSON.parse(localStorage.getItem('pstream-subtitle-ai') || 'true'); } catch { return true; } });

  const handlePing = useCallback(async () => {
    setPinging(true);
    setStatus(await backendWakeService.pingNow());
    setPinging(false);
  }, []);

  const handleClearCache = async () => {
    const clearing = true; setClearMsg('');
    try {
      const r = await fetch(`${GIGA_URL}/api/cache/clear`, { method: 'POST', signal: AbortSignal.timeout(10000) });
      setClearMsg(r.ok ? '✓ Cache cleared' : `⚠ HTTP ${r.status}`);
    } catch (e: any) { setClearMsg(`✗ ${e.message}`); }
  };

  const handleWakeNewpipe = async () => {
    if (!NEWPIPE_URL) { setClearMsg('VITE_NEWPIPE_URL not set'); return; }
    setWakeNewpipe('waking');
    try {
      const r = await fetch(`${NEWPIPE_URL}/health`, { signal: AbortSignal.timeout(60000) });
      setWakeNewpipe(r.ok ? 'ok' : 'fail');
    } catch { setWakeNewpipe('fail'); }
    setTimeout(() => setWakeNewpipe('idle'), 8000);
  };

  useEffect(() => {
    const t = setInterval(() => setStatus(backendWakeService.getStatus()), 10000);
    // Load provider health
    try { setProviderHealth(getAllProviderHealth()); } catch {}
    // Count stream cache items
    try {
      const keys = Object.keys(sessionStorage).filter(k => k.startsWith('pstream-stream-'));
      setStreamCacheSize(keys.length);
    } catch {}
    return () => clearInterval(t);
  }, []);

  const envVars = [
    { k: 'VITE_GIGA_BACKEND_URL', v: import.meta.env.VITE_GIGA_BACKEND_URL || '—' },
    { k: 'VITE_NEWPIPE_URL',      v: import.meta.env.VITE_NEWPIPE_URL      || '—' },
    { k: 'VITE_TMDB_API_KEY',     v: import.meta.env.VITE_TMDB_API_KEY ? '••••' + (import.meta.env.VITE_TMDB_API_KEY as string).slice(-4) : '—' },
    { k: 'VITE_TMDB_API_KEYS',    v: import.meta.env.VITE_TMDB_API_KEYS ? `${(import.meta.env.VITE_TMDB_API_KEYS as string).split(',').length} keys` : 'not set' },
    { k: 'VITE_ADMIN_PIN_HASH',   v: import.meta.env.VITE_ADMIN_PIN_HASH ? '✓ set' : '⚠ NOT SET' },
  ];

  return (
    <div className={s.page} style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* Navbar — matches app chrome */}
      <nav className="sticky top-0 z-50 bg-[#141414]/95 backdrop-blur-md border-b border-white/[0.06] px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/p-icon.svg" alt="P" className="h-6 w-auto" />
          <img src="/pstream-wordmark.svg" alt="pstream" className="h-4 w-auto opacity-90" />
          <span className="ml-1 text-[10px] font-mono text-white/25 border border-white/10 rounded px-1.5 py-0.5 tracking-widest">ADMIN</span>
        </div>
        <div className="flex items-center gap-3">
          <StatusDot status={status.giga} />
          <button onClick={handlePing} disabled={pinging}
            className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-white/60 hover:text-white transition-all disabled:opacity-40">
            {pinging ? 'Pinging…' : '↻ Ping'}
          </button>
          <button onClick={onSignOut}
            className="px-3 py-1.5 text-xs border border-white/10 rounded-md text-white/40 hover:text-white/70 hover:border-white/20 transition-all">
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* Row 1 — status, cache, toggles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          <Panel title="Service Health" icon="📡">
            <div className="space-y-4">
              {([
                { label: 'Giga Backend',    url: GIGA_URL,                      key: 'giga'    },
                { label: 'NewPipe Service', url: NEWPIPE_URL || 'Not configured', key: 'newpipe' },
              ] as { label: string; url: string; key: 'giga' | 'newpipe' }[]).map(({ label, url, key }) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white/90 truncate">{label}</div>
                    <div className={`${s.mono} text-white/30 truncate mt-0.5`}>{url}</div>
                  </div>
                  <StatusDot status={status[key]} />
                </div>
              ))}
              <div className={`${s.muted} pt-3 border-t border-white/[0.05]`}>
                Last ping: {status.lastPing ? new Date(status.lastPing).toLocaleTimeString() : 'Never'}
              </div>
            </div>
          </Panel>

          <Panel title="Cache & Backend" icon="🗄">
            <div className="space-y-3 flex flex-col h-full">
              <p className={s.muted}>Clears the Redis stream-URL cache. Use after deploying new extractors.</p>
              <button onClick={handleClearCache} disabled={status.giga !== 'up'}
                className="w-full py-2.5 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 text-white/70 hover:text-red-400 rounded-lg text-sm font-medium transition-all disabled:opacity-30">
                🗑  Clear Stream Cache
              </button>
              {clearMsg && <div className={`${s.mono} text-white/50 bg-white/[0.03] rounded-lg px-3 py-2`}>{clearMsg}</div>}
              <button onClick={() => backendWakeService.wake()}
                className="w-full py-2.5 bg-[#e50914]/10 hover:bg-[#e50914]/20 border border-[#e50914]/20 hover:border-[#e50914]/40 text-[#e50914] rounded-lg text-sm font-medium transition-all">
                ⚡ Wake Giga + NewPipe
              </button>
              <button onClick={handleWakeNewpipe} disabled={wakeNewpipe === 'waking'}
                className={`w-full py-2.5 border rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${
                  wakeNewpipe === 'ok'   ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                  wakeNewpipe === 'fail' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                                          'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                }`}>
                {wakeNewpipe === 'waking' ? '⏳ Waking NewPipe…' :
                 wakeNewpipe === 'ok'     ? '✓ NewPipe is awake' :
                 wakeNewpipe === 'fail'   ? '✗ NewPipe timeout' :
                                           '🔔 Wake NewPipe Only'}
              </button>
            </div>
          </Panel>

          <Panel title="Service Toggles" icon="⚙">
            <p className={`${s.muted} mb-4`}>Persists to localStorage. Reload to propagate.</p>
            <Toggle label="Disable YouTube" desc="Route all trailers through NewPipe" value={ytDisabled}
              onChange={v => { setYtDisabled(v); localStorage.setItem('pstream-yt-disabled', JSON.stringify(v)); }} />
            <Toggle label="Enable NewPipe" desc="yt-dlp trailer extraction" value={newpipeEnabled}
              onChange={v => { setNewpipeEnabled(v); localStorage.setItem('pstream-newpipe-enabled', JSON.stringify(v)); }} />
            <Toggle label="Torrent Fallback" desc="Activate when stream providers fail" value={torrentEnabled}
              onChange={v => { setTorrentEnabled(v); localStorage.setItem('pstream-torrent-enabled', JSON.stringify(v)); }} />
            <Toggle label="AI Subtitle Sync" desc="Auto-shift subtitles to match audio" value={subtitleAi}
              onChange={v => { setSubtitleAi(v); localStorage.setItem('pstream-subtitle-ai', JSON.stringify(v)); }} />
          </Panel>

        </div>

        {/* Row 1b — provider health + stream stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <Panel title="Provider Health" icon="⚡">
            {providerHealth.length === 0 ? (
              <p className={s.muted}>No provider data yet — play a title first.</p>
            ) : (
              <div className="space-y-2">
                {providerHealth.slice(0, 8).map((p: any) => (
                  <div key={p.providerId} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm text-white/80 truncate">{p.providerId}</div>
                      <div className={`${s.mono} text-white/30`}>
                        {p.successCount}✓ {p.failCount}✗
                        {p.avgLatencyMs ? ` · ${Math.round(p.avgLatencyMs)}ms` : ''}
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      p.status === 'healthy'   ? 'bg-green-500/15 text-green-400' :
                      p.status === 'degraded'  ? 'bg-amber-500/15 text-amber-400' :
                                                 'bg-red-500/15 text-red-400'
                    }`}>{p.status}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Stream Cache & Prefetch" icon="📦">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className={s.muted}>Warmed titles this session</span>
                <span className="text-white font-mono text-sm">{streamCacheSize}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className={s.muted}>Prefetch concurrency</span>
                <span className="text-white/60 font-mono text-sm">3 workers</span>
              </div>
              <div className="flex justify-between items-center">
                <span className={s.muted}>Cache TTL</span>
                <span className="text-white/60 font-mono text-sm">10 min</span>
              </div>
              <div className="flex justify-between items-center">
                <span className={s.muted}>Stream start delay</span>
                <span className="text-white/60 font-mono text-sm">~100ms head-start</span>
              </div>
              <button
                onClick={() => { sessionStorage.clear(); setStreamCacheSize(0); setClearMsg('✓ Session cache cleared'); }}
                className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white/50 hover:text-white transition-all mt-2">
                Clear Local Session Cache
              </button>
            </div>
          </Panel>

        </div>

        {/* Row 2 — NewPipe tester + env */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Panel title="NewPipe Live Test" icon="🎬" className="md:col-span-2">
            <NewPipeTester />
          </Panel>
          <Panel title="Environment" icon="🔑">
            <div className="space-y-3">
              {envVars.map(({ k, v }) => (
                <div key={k}>
                  <div className={`${s.label} text-[9px]`}>{k}</div>
                  <div className={`${s.mono} text-white/60 bg-white/[0.03] rounded px-2 py-1.5 break-all mt-1`}>{v}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Row 3 — External links */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

          <Panel title="Cloudflare" icon="☁">
            <div className="space-y-2">
              <ExtLink href={LINKS.cloudflare} label="Dashboard"      desc="DNS, Security, Analytics" />
              <ExtLink href={LINKS.cfPages}    label="Pages"          desc="Deploy & preview" />
            </div>
          </Panel>

          <Panel title="Hugging Face" icon="🤗">
            <div className="space-y-2">
              <ExtLink href={LINKS.hfGiga}        label="Giga Backend"     desc="Node.js + Redis" />
              <ExtLink href={LINKS.hfNewPipe}     label="NewPipe Service"   desc="yt-dlp FastAPI" />
              <ExtLink href={LINKS.hfNewPipeEdit} label="Edit app.py"       desc="In-browser editor" />
            </div>
          </Panel>

          <Panel title="GitHub" icon="🐙">
            <div className="space-y-2">
              <ExtLink href={LINKS.githubFront}   label="pstream-frontend"  desc="React + Vite" />
              <ExtLink href={LINKS.githubBack}    label="pstream-backend"   desc="Node.js" />
              <ExtLink href={LINKS.githubNewPipe} label="pstream-newpipe"   desc="Python yt-dlp" />
            </div>
          </Panel>

          <Panel title="TMDB & Build" icon="🎞">
            <div className="space-y-2 mb-4">
              <ExtLink href={LINKS.tmdbDashboard} label="TMDB API Dashboard" desc="Rotate keys · view usage" />
            </div>
            <div className={`${s.mono} space-y-1.5 text-white/30 pt-3 border-t border-white/[0.05]`}>
              {[
                ['Mode', import.meta.env.MODE],
                ['Dev',  String(import.meta.env.DEV)],
                ['Base', import.meta.env.BASE_URL || '/'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span>{k}</span><span className="text-white/50">{v}</span>
                </div>
              ))}
            </div>
          </Panel>

        </div>
      </div>
    </div>
  );
};

// ─── Root ──────────────────────────────────────────────────────────────────────
const GhostPage: React.FC = () => {
  const [authed, setAuthed] = useState(isAuthenticated());
  if (!authed) return <PinGate onAuth={() => setAuthed(true)} />;
  return <GhostDashboard onSignOut={() => { sessionStorage.clear(); setAuthed(false); }} />;
};

export default GhostPage;
