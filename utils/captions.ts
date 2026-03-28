import DOMPurify from "dompurify";
import { parse, convert } from "subsrt-ts";
import { ContentCaption } from "subsrt-ts/dist/types/handler";

export type CaptionCueType = ContentCaption;

export function convertSubtitlesToObjectUrl(text: string): string {
    try {
        const textTrimmed = text.trim();
        if (!textTrimmed) return '';
        const vtt = convert(textTrimmed, "vtt");
        return URL.createObjectURL(
            new Blob([vtt], { type: "text/vtt" })
        );
    } catch (e) {
        console.error("Failed to convert subtitles to object URL:", e);
        return '';
    }
}

// Safe sanitize for both browser and potential ESM misconfigurations
export const sanitize = (html: string, config?: any) => {
    try {
        const purifier = DOMPurify.sanitize || (DOMPurify as any).default?.sanitize || DOMPurify;
        if (typeof purifier === 'function') {
            return purifier(html, config);
        }
    } catch (e) {
        console.warn('DOMPurify failed, falling back to basic string', e);
    }
    return html;
};

export function captionIsVisible(
    start: number,
    end: number,
    delay: number,
    currentTime: number,
) {
    const delayedStart = start / 1000 + delay;
    const delayedEnd = end / 1000 + delay;
    return (
        Math.max(0, delayedStart) <= currentTime &&
        Math.max(0, delayedEnd) >= currentTime
    );
}

export function makeQueId(index: number, start: number, end: number): string {
    return `${index}-${start}-${end}`;
}

export function parseSubtitles(
    text: string,
    _language?: string,
): CaptionCueType[] {
    const textTrimmed = text.trim();
    if (!textTrimmed) return [];

    try {
        // Use subsrt-ts parse directly, which auto-detects formats securely 
        // Handles SRT, VTT, SBV, JSON, etc.
        const cues = parse(textTrimmed);
        return cues.filter((cue) => cue.type === "caption") as CaptionCueType[];
    } catch (e) {
        console.error("Failed to parse subtitles:", e);
        return [];
    }
}
