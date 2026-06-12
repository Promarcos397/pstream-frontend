// Provider capabilities — which providers expose postMessage APIs, startAt, controls hiding, etc.
// Based on confirmed documentation research (May 2026).

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
    /** Provider accepts &startAt= or &resumeAt= URL parameter for resume */
    supportsStartAt?: boolean;
    /** Provider accepts &controls=false to completely hide native UI */
    supportsControlsHide?: boolean;
    /** Provider supports inbound commands like play, pause, seek, volume, mute */
    supportsInboundControl?: boolean;
}

// ─── Tier 1: Highly reliable, postMessage-capable providers ─────────────────
// VidAPI is slot 1: best developer API (controls=false, postMessage, sub_url)

export const TIER_1_PROVIDERS: EmbedProvider[] = [
    {
        id: 'vidapi',
        name: 'VidAPI',
        // Documentation confirmed (2026). Supports resumeAt, controls hiding, and postMessage.
        buildUrl: ({ tmdbId, imdbId, mediaType, season, episode, startTime, subtitleLang }) => {
            // Prefer IMDB ID if available, otherwise fallback to TMDB ID
            const identifier = imdbId || tmdbId;
            
            const base = mediaType === 'movie'
                ? `https://vaplayer.ru/embed/movie/${identifier}`
                : `https://vaplayer.ru/embed/tv/${identifier}/${season}/${episode}`;
            
            const params = new URLSearchParams();
            params.set('autoplay', '1');
            
            // Handle player controls visibility
            params.set('controls', 'false');
            params.set('overlay', 'false');
            params.set('rel', '0');
            params.set('modestbranding', '1');
            params.set('showinfo', '0');
            params.set('iv_load_policy', '3');
            params.set('endscreen', '0');
            params.set('autoplay', '1');
            params.set('ads_distraction', '0');
            params.set('poster', 'false')
            params.set('controls', 'false')
            params.set('loop', '0')
            params.set('autopause', 'false')
            params.set('rel', '0')
            params.set('modestbranding', '1')
            params.set('showinfo', '0')
            params.set('iv_load_policy', '3')
            params.set('endscreen', '0')
            params.set('autoplay', '1')
            params.set('ads_distraction', '0')
            params.set('poster', 'false')
            params.set('controls', 'false')

            // Handle playback tracking position (alias for startAt)
            if (startTime && startTime > 5) {
                params.set('resumeAt', String(Math.floor(startTime)));
            }

            // Handle subtitle targeting configuration
            if (subtitleLang) {
                params.set('ds_lang', subtitleLang);
            }
            
            const qs = params.toString();
            return qs ? `${base}?${qs}` : base;
        },
        maintained: true,
        supports: ['movie', 'tv'],
        supportsPostMessage: true,
        supportsStartAt: true,
        supportsControlsHide: true,
        supportsInboundControl: false, // The provided docs show outbound events, but no explicitly documented inbound commands.
    },
];

// Flat list for easy iteration
export const ALL_EMBED_PROVIDERS = [...TIER_1_PROVIDERS].filter(p => p !== undefined);