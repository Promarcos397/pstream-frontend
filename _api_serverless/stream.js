import axios from 'axios';

const DOMAINS = {
    vidsrc: 'https://vidsrc.vip',
    embedsu: 'https://embed.su',
    autoembed: 'https://player.autoembed.cc',
    mama: 'https://mama.up.railway.app/api/showbox',
    multiembed: 'https://multiembed.mov'
};

/**
 * Ported GigaResolver for Vercel Serverless
 */
export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');

    const { tmdbId, type, season, episode, imdbId } = req.query;

    if (!tmdbId || !type) {
        return res.status(400).json({ success: false, error: 'tmdbId and type are required' });
    }

    const scrapers = [
        scrapeVidSrcVip(tmdbId, type, season, episode),
        scrapeEmbedSu(tmdbId, type, season, episode),
        scrapeAutoembed(tmdbId, type, season, episode),
        scrapeNunflix(tmdbId, type, season, episode),
        scrapeMultiembed(imdbId, type, season, episode)
    ];

    try {
        const winner = await Promise.any(scrapers.map(p => p.then(res => {
            if (res && res.success) return res;
            throw new Error('Failed');
        })));
        
        return res.status(200).json(winner);
    } catch (e) {
        return res.status(404).json({ success: false, error: 'No stream found' });
    }
}

async function scrapeVidSrcVip(tmdbId, type, season, episode) {
    try {
        const url = type === 'tv' 
            ? `${DOMAINS.vidsrc}/embed/tv/${tmdbId}/${season}/${episode}`
            : `${DOMAINS.vidsrc}/embed/movie/${tmdbId}`;
        const { data } = await axios.get(url, { timeout: 4000 });
        if (!data || !data.source1) return null;
        const sources = [];
        for (let i = 1; data[`source${i}`]; i++) {
            const s = data[`source${i}`];
            if (s?.url) sources.push({ url: s.url, quality: 'auto', isM3U8: s.url.includes('.m3u8'), provider: 'VidSrc.vip' });
        }
        return sources.length > 0 ? { success: true, sources, provider: 'VidSrc.vip' } : null;
    } catch { return null; }
}

async function scrapeEmbedSu(tmdbId, type, season, episode) {
    // Ported from giga-backend/resolver.js
    try {
        const embedUrl = `https://embed.su/embed/${type === 'movie' ? `movie/${tmdbId}` : `tv/${tmdbId}/${season}/${episode}`}`;
        const { data: embedPage } = await axios.get(embedUrl, { timeout: 4000 });
        const vConfigMatch = embedPage.match(/window\.vConfig\s*=\s*JSON\.parse\(atob\(`([^`]+)/i);
        if (!vConfigMatch?.[1]) return null;
        const decodedConfig = JSON.parse(Buffer.from(vConfigMatch[1], 'base64').toString('binary'));
        const firstDecode = Buffer.from(decodedConfig.hash, 'base64').toString('binary').split('.').map(s => s.split('').reverse().join(''));
        const secondDecode = JSON.parse(Buffer.from(firstDecode.join('').split('').reverse().join(''), 'base64').toString('binary'));
        const sources = secondDecode.map(s => ({ url: `https://embed.su/api/e/${s.hash}`, quality: 'auto', isM3U8: true, provider: 'Embed.su' }));
        return { success: true, sources, provider: 'Embed.su' };
    } catch { return null; }
}

async function scrapeAutoembed(tmdbId, type, season, episode) {
    try {
        const mediaType = type === 'tv' ? 'tv' : 'movie';
        const id = type === 'tv' ? `${tmdbId}/${season}/${episode}` : tmdbId;
        const { data } = await axios.get(`https://tom.autoembed.cc/api/getVideoSource?type=${mediaType}&id=${id}`, { timeout: 4000 });
        if (!data?.videoSource) return null;
        return { success: true, sources: [{ url: data.videoSource, quality: 'auto', isM3U8: data.videoSource.includes('.m3u8'), provider: 'Autoembed' }], provider: 'Autoembed' };
    } catch { return null; }
}

async function scrapeNunflix(tmdbId, type, season, episode) {
    try {
        const url = type === 'tv' ? `${DOMAINS.mama}/tv/${tmdbId}?season=${season}&episode=${episode}` : `${DOMAINS.mama}/movie/${tmdbId}`;
        const { data } = await axios.get(url, { timeout: 4000 });
        if (!data?.success || !data.streams) return null;
        const stream = Array.isArray(data.streams) ? data.streams[0] : data.streams;
        const file = stream.player_streams?.[0]?.file || stream.file;
        if (!file) return null;
        return { success: true, provider: 'Nunflix', sources: [{ url: file, isM3U8: true, quality: '720p+' }] };
    } catch { return null; }
}

async function scrapeMultiembed(imdbId, type, season, episode) {
    if (!imdbId) return null;
    const url = type === 'tv' ? `${DOMAINS.multiembed}/?video_id=${imdbId}&s=${season}&e=${episode}` : `${DOMAINS.multiembed}/?video_id=${imdbId}`;
    return { success: true, provider: 'Multiembed', sources: [{ url, isM3U8: false, isEmbed: true }] };
}
