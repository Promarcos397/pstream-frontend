// Provider capabilities — which providers expose postMessage APIs, startAt, controls hiding, etc.
// Based on confirmed VidFast documentation: https://vidfast.net/documentation (June 2026)

export interface EmbedProvider {
    id: string;
    name: string;
    /**
     * Build the embed URL. `startTime` (seconds) should be appended if the provider
     * supports it — only those with supportsStartAt=true will receive it.
     */
    buildUrl: (params: {
        tmdbId: string;
        imdbId?: string | null;
        mediaType: 'movie' | 'tv';
        season?: number;
        episode?: number;
        startTime?: number;
        subtitleLang?: string;
    }) => string;
    maintained: boolean;
    supports: ('movie' | 'tv' | 'anime')[];
    hasPopups?: boolean;
    /** Provider broadcasts postMessage PLAYER_EVENT / timeupdate events to parent */
    supportsPostMessage?: boolean;
    /** Provider accepts &startAt= URL parameter for resume */
    supportsStartAt?: boolean;
    /** Provider accepts a URL parameter to completely hide native UI */
    supportsControlsHide?: boolean;
    /** Provider accepts inbound postMessage commands: play, pause, seek, volume, mute */
    supportsInboundControl?: boolean;
}

// ─── Tier 1: VidFast — full postMessage API (outbound events + inbound commands) ──
export const TIER_1_PROVIDERS: EmbedProvider[] = [
    {
        id: 'vidfast',
        name: 'VidFast',
        buildUrl: ({ tmdbId, imdbId, mediaType, season, episode, startTime, subtitleLang }) => {
            const identifier = imdbId || tmdbId;

            const base = mediaType === 'movie'
                ? `https://vidfast.pro/movie/${identifier}`
                : `https://vidfast.pro/tv/${identifier}/${season}/${episode}`;

            const params = new URLSearchParams();

            // Documented VidFast params only — no junk
            params.set('autoPlay', 'true');
            params.set('title', 'false');
            params.set('poster', 'false');

            // ✅ Correct param name per docs: startAt (not resumeAt)
            if (startTime && startTime > 5) {
                params.set('startAt', String(Math.floor(startTime)));
            }

            // ✅ Correct subtitle param per docs: sub (not ds_lang)
            if (subtitleLang) {
                params.set('sub', subtitleLang);
            }

            // ✅ No double ? — base has no query string, params appended cleanly
            return `${base}?${params.toString()}`;
        },
        maintained: true,
        supports: ['movie', 'tv'],
        supportsPostMessage: true,
        supportsStartAt: true,
        supportsControlsHide: false, // VidFast has no controls=false param
        // ✅ VidFast has a full inbound PostMessage API: play, pause, seek, volume, mute, getStatus
        supportsInboundControl: true,
    },
];

// ─── EMBED FALLBACK SWITCH ──────────────────────────────────────────────────
// Embeds are no longer the primary playback path — the player resolves a real
// stream from the backend first and only falls back to an iframe when that
// returns nothing (see VideoPlayer.tsx).
//
// They are enabled as a safety net because backend resolution currently fails
// from the Space's host: vixsrc.to and friends are behind Cloudflare, which
// blocks datacenter IPs outright. Verified 2026-07-18 — HuggingFace (AWS),
// Cloudflare Workers, allorigins and corsproxy all get 403 from two different
// continents, while a residential IP gets 200. Until the backend scrapes via
// residential egress, embeds are the only thing that plays.
//
// Set to false once direct resolution is reliable; the player already prefers
// direct sources whenever they resolve, so this only controls the safety net.
export const EMBEDS_ENABLED = true;

// Flat list for easy iteration.
export const ALL_EMBED_PROVIDERS = EMBEDS_ENABLED
    ? [...TIER_1_PROVIDERS].filter(p => p !== undefined)
    : [];