/**
 * YouTubeCaptionService
 * Note: YouTube caption scraping has been removed per user request.
 */

export interface CaptionCue {
  start: number;
  end: number;
  text: string;
}

export async function getCaptionCues(
  videoId: string,
  lang = 'en',
  availableLangs?: string[]
): Promise<CaptionCue[] | null> {
  return null;
}

export function extractTrackLangs(tracklist: any[]): string[] {
  return [];
}
