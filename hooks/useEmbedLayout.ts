import { useState, useEffect, useMemo } from 'react';

// iframe renders at HF× the viewport to make the embed's internal UI microscopic
const HF = 2.5;
const CONTENT_RATIO = 16 / 9;

// Above this viewport ratio we switch to fill-height (don't over-crop on ultrawide)
// 2.3 covers phones in landscape (~2.16–2.22) while excluding 21:9 monitors (~2.37+)
const FILL_HEIGHT_THRESHOLD = 2.3;

// Embed chrome offsets — tuned for vidsrc / vidplay family
const CLIP_TOP    = 7;     // % of iframe height
const CLIP_BOTTOM = 12.5;  // % of iframe height

export type FillMode = 'width' | 'height';

export interface EmbedLayout {
    iframeW:  number;   // iframe natural width  (px, pre-scale)
    iframeH:  number;   // iframe natural height (px, pre-scale)
    left:     number;   // left offset of inner div (px, pre-scale)
    top:      number;   // top  offset of inner div (px, pre-scale)
    scale:    number;   // CSS transform scale value  (= 1/HF)
    clipPath: string;   // CSS clip-path to remove embed chrome
    fillMode: FillMode; // which dimension drives the fit
}

export function useEmbedLayout(): EmbedLayout {
    const [vp, setVp] = useState(() => ({
        w: window.innerWidth,
        h: window.innerHeight,
    }));

    useEffect(() => {
        const update = () => setVp({ w: window.innerWidth, h: window.innerHeight });
        window.addEventListener('resize', update);
        window.addEventListener('orientationchange', update); // foldables / rotation
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('orientationchange', update);
        };
    }, []);

    return useMemo<EmbedLayout>(() => {
        const { w, h } = vp;
        const ratio    = w / h;
        const scale    = 1 / HF;   // shrink back to viewport after iframe renders at HF×

        let iframeW: number;
        let iframeH: number;
        let fillMode: FillMode;

        if (ratio > FILL_HEIGHT_THRESHOLD) {
            // ── Ultrawide (21:9, 32:9, split-monitor) ────────────────────────────
            // Fill height — video stays at 16:9 native ratio, black bars on sides.
            // Zooming to fill width here would crop too much of the picture.
            iframeH = h * HF;
            iframeW = iframeH * CONTENT_RATIO;
            fillMode = 'height';
        } else {
            // ── Portrait / square / 16:10 / 16:9 / phone-landscape ───────────────
            // Fill width — iframe is always 16:9 so the embed never pillarboxes.
            // On wider-than-16:9 screens the scaled height slightly overflows
            // the viewport; the parent overflow:hidden absorbs it symmetrically.
            iframeW = w * HF;
            iframeH = iframeW / CONTENT_RATIO;
            fillMode = 'width';
        }

        // Position pre-scale div so its CENTER aligns with viewport center.
        // transform: scale(S) with transformOrigin: center keeps the center fixed,
        // so the scaled result is always centred in the viewport.
        const left = w / 2 - iframeW / 2;
        const top  = h / 2 - iframeH / 2;

        // Clip values are percentages of the iframe's own dimensions.
        // Because the iframe is always 16:9 these stay constant across all fill modes.
        const clipPath = `inset(${CLIP_TOP}% 0% ${CLIP_BOTTOM}% 0%)`;

        return { iframeW, iframeH, left, top, scale, clipPath, fillMode };
    }, [vp]);
}
