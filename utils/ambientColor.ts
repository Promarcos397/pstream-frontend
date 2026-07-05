/**
 * utils/ambientColor.ts
 * ──────────────────────
 * Dominant-color extraction for ambient background tinting — the same
 * canvas-sampling approach MobileHero uses for the hero glow, packaged as a
 * reusable promise so other surfaces (e.g. the profile-picker billboard) can
 * tint themselves to match their artwork (Batman → blue, Barbie → pink).
 */

export interface AmbientRGB { r: number; g: number; b: number }

const cache = new Map<string, AmbientRGB>();

export function extractAmbientColor(imageUrl: string): Promise<AmbientRGB | null> {
  const cached = cache.get(imageUrl);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl.includes('?') ? `${imageUrl}&cors=true` : `${imageUrl}?cors=true`;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);

        canvas.width = 16;
        canvas.height = 16;
        ctx.drawImage(img, 0, 0, 16, 16);
        const data = ctx.getImageData(0, 0, 16, 16).data;

        let r = 0, g = 0, b = 0, count = 0;
        let maxSat = 0, vibR = 0, vibG = 0, vibB = 0;

        for (let i = 0; i < data.length; i += 4) {
          const pr = data[i] ?? 0, pg = data[i + 1] ?? 0, pb = data[i + 2] ?? 0, pa = data[i + 3] ?? 0;
          if (pa <= 180) continue;
          const brightness = (pr * 299 + pg * 587 + pb * 114) / 1000;
          if (brightness <= 25 || brightness >= 230) continue;
          r += pr; g += pg; b += pb; count++;

          const max = Math.max(pr, pg, pb);
          const min = Math.min(pr, pg, pb);
          const sat = max === 0 ? 0 : (max - min) / max;
          if (sat > maxSat) { maxSat = sat; vibR = pr; vibG = pg; vibB = pb; }
        }

        if (count === 0) return resolve(null);

        // Blend average with the most vibrant pixel so the tint reads as the
        // poster's "color" rather than a muddy mean.
        let ar = Math.min(255, Math.round((r / count) * 0.45 + vibR * 0.55));
        let ag = Math.min(255, Math.round((g / count) * 0.45 + vibG * 0.55));
        let ab = Math.min(255, Math.round((b / count) * 0.45 + vibB * 0.55));

        // Luminance floor so the tint survives on AMOLED blacks.
        const lum = (ar * 299 + ag * 587 + ab * 114) / 1000;
        if (lum < 55) {
          const scale = 55 / Math.max(lum, 1);
          ar = Math.min(255, Math.round(ar * scale));
          ag = Math.min(255, Math.round(ag * scale));
          ab = Math.min(255, Math.round(ab * scale));
        }

        const rgb = { r: ar, g: ag, b: ab };
        cache.set(imageUrl, rgb);
        resolve(rgb);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
  });
}
