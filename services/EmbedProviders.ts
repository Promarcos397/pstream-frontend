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
}

// ─── Tier 1: Highly reliable, postMessage-capable providers ─────────────────
// VidAPI.ru is slot 1: best developer API (controls=false, postMessage, sub_url)
// VidLink is slot 2: confirmed postMessage PLAYER_EVENT + startAt + sub_file

export const TIER_1_PROVIDERS: EmbedProvider[] = [
    {
        id: 'vidfast',
        name: 'VidFast',
        // postMessage confirmed (Scribd doc). startAt + nextButton + autoNext confirmed.
        buildUrl: ({ tmdbId, mediaType, season, episode, startTime, subtitleLang }) => {
            const base = mediaType === 'movie'
                ? `https://vidfast.pro/movie/${tmdbId}`
                : `https://vidfast.pro/tv/${tmdbId}/${season || 1}/${episode || 1}`;
            const params = new URLSearchParams();
            params.set('autoplay', 'true');
            params.set('controls', 'false');
            if (startTime && startTime > 5) params.set('startAt', String(Math.floor(startTime)));
            if (mediaType === 'tv') params.set('nextButton', 'true');
            if (subtitleLang) params.set('sub', subtitleLang);
            const qs = params.toString();
            return qs ? `${base}?${qs}` : base;
        },
        maintained: true,
        supports: ['movie', 'tv', 'anime'],
        supportsPostMessage: true,
        supportsStartAt: true,
        supportsControlsHide: true,
    },
    {
        id: 'vidlink',
        name: 'VidLink',
        buildUrl: ({ tmdbId, mediaType, season, episode, startTime }) => {
            const isAnime = (mediaType as string) === 'anime' || (mediaType as any) === 'mal';
            const base = isAnime
                ? `https://vidlink.pro/anime/${tmdbId}/${episode || 1}/sub`
                : (mediaType === 'movie'
                    ? `https://vidlink.pro/movie/${tmdbId}`
                    : `https://vidlink.pro/tv/${tmdbId}/${season || 1}/${episode || 1}`);
            
            const params = new URLSearchParams();
            params.set('primaryColor', '63b8bc'); // Match P-Stream Cyan
            params.set('secondaryColor', '1a1a1a'); // Harmonized dark slate
            params.set('iconColor', 'ffffff'); // Sharp white icons
            params.set('icons', 'vid'); // Premium icons style
            params.set('player', 'jw'); // Professional JWPlayer core
            params.set('title', 'false');
            params.set('poster', 'false');
            params.set('autoplay', 'true');
            
            if (mediaType === 'tv') {
                params.set('nextbutton', 'true');
            }
            if (startTime && startTime > 5) {
                params.set('startAt', String(Math.floor(startTime)));
            }
            
            const qs = params.toString();
            return qs ? `${base}?${qs}` : base;
        },
        maintained: true,
        supports: ['movie', 'tv', 'anime'],
        supportsPostMessage: true,
        supportsStartAt: true,
    },
    {
        id: 'vidsync',
        name: 'Vidsync',
        buildUrl: ({ tmdbId, mediaType, season, episode }) => {
            return mediaType === 'movie'
                ? `https://vidsync.xyz/embed/movie/${tmdbId}`
                : `https://vidsync.xyz/embed/tv/${tmdbId}/${season || 1}/${episode || 1}`;
        },
        maintained: true,
        supports: ['movie', 'tv'],
        supportsPostMessage: true,
        supportsStartAt: true,
    },
    {
        id: 'vidking',
        name: 'Vidking Player',
        buildUrl: ({ tmdbId, mediaType, season, episode, startTime }) => {
            const base = mediaType === 'movie'
                ? `https://www.vidking.net/embed/movie/${tmdbId}`
                : `https://www.vidking.net/embed/tv/${tmdbId}/${season || 1}/${episode || 1}`;
            
            const params = new URLSearchParams();
            params.set('color', '0dcaf0'); // Primary theme color without # (Default Blue / Cyan theme)
            params.set('autoPlay', 'true');
            if (mediaType === 'tv') {
                params.set('nextEpisode', 'true');
                params.set('episodeSelector', 'true');
            }
            if (startTime && startTime > 5) {
                params.set('progress', String(Math.floor(startTime)));
            }
            const qs = params.toString();
            return qs ? `${base}?${qs}` : base;
        },
        maintained: true,
        supports: ['movie', 'tv'],
        supportsPostMessage: true,
        supportsStartAt: true,
    },
    /*
    {
        id: 'vidup',
        name: 'VidUP',
        buildUrl: ({ tmdbId, mediaType, season, episode }) => {
            return mediaType === 'movie'
                ? `https://vidup.to/movie/${tmdbId}`
                : `https://vidup.to/tv/${tmdbId}/${season || 1}/${episode || 1}`;
        },
        maintained: true,
        supports: ['movie', 'tv'],
        supportsPostMessage: true,
        supportsStartAt: false,
    },
    {
        id: 'vidapi-xyz',
        name: 'VidAPI.xyz',
        buildUrl: ({ tmdbId, mediaType, season, episode }) =>
            mediaType === 'movie'
                ? `https://vidapi.xyz/embed/movie/${tmdbId}`
                : `https://vidapi.xyz/embed/tv/${tmdbId}/${season}/${episode}`,
        maintained: true,
        supports: ['movie', 'tv'],
    },
    {
        id: 'vidsrc-me',
        name: 'VidSrc.me (Vidsrc-embed)',
        buildUrl: ({ tmdbId, mediaType, season, episode, subtitleLang }) => {
            const base = mediaType === 'movie'
                ? `https://vidsrc-embed.ru/embed/movie/${tmdbId}`
                : `https://vidsrc-embed.ru/embed/tv/${tmdbId}/${season}-${episode}`;
            const params = new URLSearchParams();
            params.set('autoplay', '1');
            if (mediaType === 'tv') params.set('autonext', '1');
            if (subtitleLang) params.set('ds_lang', subtitleLang.substring(0, 2));
            const qs = params.toString();
            return qs ? `${base}?${qs}` : base;
        },
        maintained: true,
        supports: ['movie', 'tv', 'anime'],
    },
    {
        id: 'autoembed',
        name: 'AutoEmbed',
        buildUrl: ({ tmdbId, mediaType, season, episode }) =>
            mediaType === 'movie'
                ? `https://autoembed.co/movie/tmdb/${tmdbId}`
                : `https://autoembed.co/tv/tmdb/${tmdbId}-${season}-${episode}`,
        maintained: true,
        supports: ['movie', 'tv', 'anime'],
    },
    {
        id: '2embed',
        name: '2Embed',
        buildUrl: ({ tmdbId, mediaType, season, episode }) =>
            mediaType === 'movie'
                ? `https://2embed.cc/embed/${tmdbId}`
                : `https://2embed.cc/embedtv/${tmdbId}?s=${season}&e=${episode}`,
        maintained: true,
        supports: ['movie', 'tv'],
    },
    {
        id: 'videasy',
        name: 'VidEasy',
        buildUrl: ({ tmdbId, mediaType, season, episode }) =>
            mediaType === 'movie'
                ? `https://www.videasy.net/movie/${tmdbId}`
                : `https://www.videasy.net/tv/${tmdbId}/${season}/${episode}`,
        maintained: true,
        supports: ['movie', 'tv', 'anime'],
    },
    {
        id: 'vidnest',
        name: 'VidNest',
        buildUrl: ({ tmdbId, mediaType, season, episode }) =>
            mediaType === 'movie'
                ? `https://vidnest.fun/embed/movie/${tmdbId}`
                : `https://vidnest.fun/embed/tv/${tmdbId}/${season}/${episode}`,
        maintained: true,
        supports: ['movie', 'tv', 'anime'],
    },
    {
        id: 'vixsrc',
        name: 'VixSrc',
        buildUrl: ({ tmdbId, mediaType, season, episode }) =>
            mediaType === 'movie'
                ? `https://vixsrc.to/embed/movie/${tmdbId}`
                : `https://vixsrc.to/embed/tv/${tmdbId}/${season}/${episode}`,
        maintained: true,
        supports: ['movie', 'tv', 'anime'],
    },
    {
        id: 'vidsrc-to',
        name: 'VidSrc.to',
        buildUrl: ({ tmdbId, mediaType, season, episode }) =>
            mediaType === 'movie'
                ? `https://vidsrc.to/embed/movie/${tmdbId}`
                : `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}`,
        maintained: true,
        supports: ['movie', 'tv', 'anime'],
    },
    */
];

// ─── Tier 2: Good fallbacks, less maintained or minor popups ─────────────────

export const TIER_2_PROVIDERS: EmbedProvider[] = [
    /*
    {
        id: '1embed',
        name: '1Embed',
        buildUrl: ({ tmdbId, mediaType, season, episode }) =>
            mediaType === 'movie'
                ? `https://1embed.cc/embed/movie/${tmdbId}`
                : `https://1embed.cc/embed/tv/${tmdbId}/${season}/${episode}`,
        maintained: false,
        supports: ['movie', 'tv', 'anime'],
    },
    {
        id: 'fmovies4u',
        name: 'FilmEx',
        buildUrl: ({ tmdbId, mediaType, season, episode }) =>
            mediaType === 'movie'
                ? `https://fmovies4u.com/embed/movie/${tmdbId}`
                : `https://fmovies4u.com/embed/tv/${tmdbId}/${season}/${episode}`,
        maintained: false,
        supports: ['movie', 'tv'],
    },
    {
        id: 'nxsha',
        name: 'Nxsha',
        buildUrl: ({ tmdbId, mediaType, season, episode }) =>
            mediaType === 'movie'
                ? `https://web.nxsha.app/embed/movie/${tmdbId}`
                : `https://web.nxsha.app/embed/tv/${tmdbId}/${season}/${episode}`,
        maintained: false,
        supports: ['movie', 'tv'],
    },
    {
        id: 'mappletv',
        name: 'MappleTV',
        buildUrl: ({ tmdbId, mediaType, season, episode }) =>
            mediaType === 'movie'
                ? `https://mappletv.uk/embed/movie/${tmdbId}`
                : `https://mappletv.uk/embed/tv/${tmdbId}/${season}/${episode}`,
        maintained: false,
        supports: ['movie', 'tv'],
    },
    {
        id: 'embed-icefy',
        name: 'Embed Icefy',
        buildUrl: ({ tmdbId, mediaType, season, episode }) =>
            mediaType === 'movie'
                ? `https://embed.icefy.top/movie/${tmdbId}`
                : `https://embed.icefy.top/tv/${tmdbId}/${season}/${episode}`,
        maintained: false,
        supports: ['movie', 'tv', 'anime'],
    },
    {
        id: 'vidplus',
        name: 'VidPlus',
        buildUrl: ({ tmdbId, mediaType, season, episode }) =>
            mediaType === 'movie'
                ? `https://vidplus.to/embed/movie/${tmdbId}`
                : `https://vidplus.to/embed/tv/${tmdbId}/${season}/${episode}`,
        maintained: false,
        supports: ['movie', 'tv', 'anime'],
    },
    {
        id: 'aeonwatch',
        name: 'AeonWatch',
        buildUrl: ({ tmdbId, mediaType, season, episode }) =>
            mediaType === 'movie'
                ? `https://thisiscinema.pages.dev/movie/${tmdbId}`
                : `https://thisiscinema.pages.dev/tv/${tmdbId}/${season}/${episode}`,
        maintained: false,
        supports: ['movie', 'tv', 'anime'],
    },
    {
        id: 'peachify',
        name: 'Peachify',
        buildUrl: ({ tmdbId, mediaType, season, episode }) =>
            mediaType === 'movie'
                ? `https://peachify.top/movie/${tmdbId}`
                : `https://peachify.top/tv/${tmdbId}/${season}/${episode}`,
        maintained: false,
        supports: ['movie', 'tv', 'anime'],
    },
    {
        id: 'primesrc',
        name: 'PrimeSRC',
        buildUrl: ({ tmdbId, mediaType, season, episode }) =>
            mediaType === 'movie'
                ? `https://primesrc.me/movie/${tmdbId}`
                : `https://primesrc.me/tv/${tmdbId}/${season}/${episode}`,
        maintained: false,
        supports: ['movie', 'tv', 'anime'],
    },
    */
];

// Flat list for easy iteration
export const ALL_EMBED_PROVIDERS = [...TIER_1_PROVIDERS, ...TIER_2_PROVIDERS].filter(p => p !== undefined);