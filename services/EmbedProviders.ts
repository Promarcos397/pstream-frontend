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
    /*
    {
        id: 'vidapi-ru',
        name: 'VidAPI.ru',
        // controls=false hides ALL native UI — our custom controls take over completely.
        // overlay=false removes the hover gradient/title bar.
        // Both confirmed from VidAPI.ru documentation.
        buildUrl: ({ tmdbId, mediaType, season, episode, startTime }) => {
            const base = mediaType === 'movie'
                ? `https://vidapi.ru/embed/movie/${tmdbId}`
                : `https://vidapi.ru/embed/tv/${tmdbId}/${season}/${episode}`;
            const params = new URLSearchParams({ controls: 'false', overlay: 'false' });
            if (startTime && startTime > 5) params.set('resumeAt', String(Math.floor(startTime)));
            return `${base}?${params.toString()}`;
        },
        maintained: true,
        supports: ['movie', 'tv'],
        supportsPostMessage: true,
        supportsStartAt: true,
        supportsControlsHide: true,
    },
    */
    /*
    {
        id: 'vidlink',
        name: 'VidLink',
        // postMessage PLAYER_EVENT confirmed. startAt param confirmed. sub_file for subtitles.
        // For TV: nextbutton=true shows the native next-ep button inside the embed.
        buildUrl: ({ tmdbId, mediaType, season, episode, startTime }) => {
            const base = mediaType === 'movie'
                ? `https://vidlink.pro/movie/${tmdbId}`
                : `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}`;
            const params = new URLSearchParams({ title: 'false', poster: 'false' });
            if (mediaType === 'tv') params.set('nextbutton', 'true');
            if (startTime && startTime > 5) params.set('startAt', String(Math.floor(startTime)));
            return `${base}?${params.toString()}`;
        },
        maintained: true,
        supports: ['movie', 'tv'],
        supportsPostMessage: true,
        supportsStartAt: true,
    },
    */
    {
        id: 'vidfast',
        name: 'VidFast',
        // postMessage confirmed (Scribd doc). startAt + nextButton + autoNext confirmed.
        buildUrl: ({ tmdbId, mediaType, season, episode, startTime, subtitleLang }) => {
            const base = mediaType === 'movie'
                ? `https://vidfast.pro/movie/${tmdbId}`
                : `https://vidfast.pro/tv/${tmdbId}/${season}/${episode}`;
            const params = new URLSearchParams();
            params.set('autoplay', 'true');
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
        name: 'VidSrc.me',
        buildUrl: ({ tmdbId, mediaType, season, episode }) =>
            mediaType === 'movie'
                ? `https://vidsrc.me/embed/movie?tmdb=${tmdbId}`
                : `https://vidsrc.me/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`,
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
];

// ─── Tier 2: Good fallbacks, less maintained or minor popups ─────────────────

export const TIER_2_PROVIDERS: EmbedProvider[] = [
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
];

// Flat list for easy iteration
export const ALL_EMBED_PROVIDERS = [...TIER_1_PROVIDERS, ...TIER_2_PROVIDERS];