import DOMPurify from "dompurify";
import { convert } from "subsrt-ts";

export interface CustomCue {
    type: 'caption';
    start: number; // in ms
    end: number; // in ms
    text: string;
    content: string;
    settings?: {
        align?: 'left' | 'right' | 'center' | 'start' | 'end' | 'middle';
        position?: string; // e.g. "15%"
        line?: string;
        size?: string;
    };
}

export type CaptionCueType = CustomCue;

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

    // Regex to match WebVTT/SRT timestamp line and settings
    const timeRegex = /^(\d{2}:\d{2}:\d{2}[.,]\d{3}|\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3}|\d{2}:\d{2}[.,]\d{3})(.*)$/;

    const timeToMs = (str: string): number => {
        const parts = str.replace(',', '.').split(':');
        let hrs = 0, mins = 0, secs = 0;
        if (parts.length === 3) {
            hrs = parseFloat(parts[0]);
            mins = parseFloat(parts[1]);
            secs = parseFloat(parts[2]);
        } else if (parts.length === 2) {
            mins = parseFloat(parts[0]);
            secs = parseFloat(parts[1]);
        }
        return Math.floor((hrs * 3600 + mins * 60 + secs) * 1000);
    };

    try {
        const lines = textTrimmed.split(/\r?\n/);
        const cues: CaptionCueType[] = [];
        let currentCue: Partial<CaptionCueType> | null = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) {
                if (currentCue && currentCue.start !== undefined && currentCue.end !== undefined) {
                    cues.push(currentCue as CaptionCueType);
                }
                currentCue = null;
                continue;
            }

            const match = line.match(timeRegex);
            if (match) {
                const start = timeToMs(match[1]);
                const end = timeToMs(match[2]);
                const settingsStr = match[3].trim();

                const settings: any = {};
                if (settingsStr) {
                    const parts = settingsStr.split(/\s+/);
                    parts.forEach(part => {
                        const [key, val] = part.split(':');
                        if (key && val) {
                            settings[key] = val;
                        }
                    });
                }

                currentCue = {
                    type: 'caption',
                    start,
                    end,
                    text: '',
                    content: '',
                    settings: Object.keys(settings).length > 0 ? settings : undefined
                };
            } else if (currentCue) {
                const textLine = lines[i];
                // Strip WebVTT voice/speaker tags like <v Name> and </v>
                const cleanLine = textLine.replace(/<v\s+[^>]*>|<\/v>/g, '');
                
                if (currentCue.content) {
                    currentCue.content += '\n' + cleanLine;
                    currentCue.text += '\n' + cleanLine;
                } else {
                    currentCue.content = cleanLine;
                    currentCue.text = cleanLine;
                }
            }
        }

        if (currentCue && currentCue.start !== undefined && currentCue.end !== undefined) {
            cues.push(currentCue as CaptionCueType);
        }

        return cues;
    } catch (e) {
        console.error("Failed to parse subtitles:", e);
        return [];
    }
}
