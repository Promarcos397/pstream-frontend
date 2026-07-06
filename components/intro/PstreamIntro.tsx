import React, { useEffect, useRef } from 'react';

/**
 * PSTREAM app-open ident — a Netflix-style wordmark reveal rendered on a
 * <canvas>. The word "PSTREAM" is set in the Standard Galactic Alphabet font,
 * rasterized, and each glyph is broken into its individual strokes via
 * connected-component labeling; the strokes then "unroll" left-to-right
 * (verticals bottom-up, horizontals left-right) with a dark trailing edge and
 * a bright leading highlight, settling into the solid red mark.
 *
 * Ported from the approved standalone prototype (canvas draw logic unchanged);
 * the design-tool runtime wrapper was replaced with plain React refs + a RAF
 * loop. Pure canvas, zero dependencies.
 */

interface PstreamIntroProps {
  /** Fires once the word has finished building (before the natural hold). The
   *  boot-gate uses this together with its own readiness signal to decide when
   *  to fade the intro out. */
  onBuilt?: () => void;
  /** Per-glyph build stagger in ms. */
  staggerMs?: number;
  /** Playback speed multiplier (1 = natural). */
  speed?: number;
  /** Baseline arch amount during the build (0 = flat, letters rise in place). */
  arch?: number;
  /** Render the final settled mark immediately with no build animation. */
  reducedMotion?: boolean;
  className?: string;
}

const WORD = 'PSTREAM';
const FONT_FAMILY = 'PstreamSGA';
const FONT_URL = '/StandardGalacticAlphabet-Regular.ttf';

// Timing constants (animation-time units; real seconds = units / speed).
const UNROLL = 0.75;
const LEAD = 0.45;
const HOLD = 1.9;
const FADE = 0.35;

const COLORS = { base: '#e50914', dark: '#8e070f', bright: '#ff9d9d' };

interface Comp {
  minX: number; minY: number; maxX: number; maxY: number;
  count: number; w: number; h: number;
  vertical: boolean;
  set: Record<string, HTMLCanvasElement>;
}
interface Glyph { comps: Comp[]; gw: number; gh: number; adv: number; }

// connected-component labeling of a glyph's pixels -> stroke segments
function segmentGlyph(alphaCanvas: HTMLCanvasElement, colors: Record<string, string>): Comp[] {
  const w = alphaCanvas.width, h = alphaCanvas.height;
  const g = alphaCanvas.getContext('2d')!;
  const src = g.getImageData(0, 0, w, h);
  const a = src.data;
  const lab = new Int32Array(w * h).fill(-1);
  const comps: any[] = [];
  const TH = 30;
  const stack: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const idx = y * w + x;
    if (lab[idx] !== -1 || a[idx * 4 + 3] <= TH) continue;
    const id = comps.length;
    const comp: any = { minX: x, minY: y, maxX: x, maxY: y, count: 0 };
    stack.length = 0; stack.push(idx); lab[idx] = id;
    while (stack.length) {
      const i2 = stack.pop()!;
      const cx = i2 % w, cy = (i2 / w) | 0;
      comp.count++;
      if (cx < comp.minX) comp.minX = cx; if (cx > comp.maxX) comp.maxX = cx;
      if (cy < comp.minY) comp.minY = cy; if (cy > comp.maxY) comp.maxY = cy;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (lab[ni] === -1 && a[ni * 4 + 3] > TH) { lab[ni] = id; stack.push(ni); }
      }
    }
    comps.push(comp);
  }
  const hex2rgb = (hx: string) => [parseInt(hx.slice(1, 3), 16), parseInt(hx.slice(3, 5), 16), parseInt(hx.slice(5, 7), 16)];
  const rgbs: Record<string, number[]> = {}; for (const k of Object.keys(colors)) rgbs[k] = hex2rgb(colors[k]);
  for (let ci = 0; ci < comps.length; ci++) {
    const c = comps[ci];
    const cw = c.maxX - c.minX + 1, ch = c.maxY - c.minY + 1;
    c.w = cw; c.h = ch;
    c.set = {};
    for (const k of Object.keys(colors)) {
      const cv = document.createElement('canvas');
      cv.width = cw; cv.height = ch;
      const cg = cv.getContext('2d')!;
      const im = cg.createImageData(cw, ch);
      const [r, gr, b] = rgbs[k];
      for (let y = c.minY; y <= c.maxY; y++) for (let x = c.minX; x <= c.maxX; x++) {
        if (lab[y * w + x] !== ci) continue;
        const di = ((y - c.minY) * cw + (x - c.minX)) * 4;
        im.data[di] = r; im.data[di + 1] = gr; im.data[di + 2] = b;
        im.data[di + 3] = a[(y * w + x) * 4 + 3];
      }
      cg.putImageData(im, 0, 0);
      c.set[k] = cv;
    }
    c.vertical = ch >= cw;
  }
  // order: bottom-most first, then left-most (nub -> stem -> arms feel)
  comps.sort((p, q) => (q.maxY - p.maxY) || (p.minX - q.minX));
  return comps.filter((c) => c.count > 4);
}

export const PstreamIntro: React.FC<PstreamIntroProps> = ({
  onBuilt, staggerMs = 170, speed = 1, arch = 0, reducedMotion = false, className,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onBuiltRef = useRef(onBuilt);
  onBuiltRef.current = onBuilt;

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;

    let raf = 0;
    let fontReady = false;
    let glyphs: Glyph[] | null = null;
    let FS = 100;
    let dprUsed = 1;
    let builtFor = '';
    let builtFired = false;
    let disposed = false;

    // reducedMotion: start "in the past" so the very first frame is the
    // settled mark — no build animation, still a full-screen cover.
    const total = LEAD + (WORD.length - 1) * (staggerMs / 1000) + UNROLL + HOLD + FADE;
    const t0 = reducedMotion ? performance.now() - (total / speed) * 1000 : performance.now();

    const font = new FontFace(FONT_FAMILY, `url('${FONT_URL}')`);
    font.load().then((f) => { (document as any).fonts.add(f); fontReady = true; builtFor = ''; })
      .catch(() => { fontReady = true; });

    function buildGlyphs(vw: number, vh: number, dpr: number) {
      const meas = document.createElement('canvas').getContext('2d')!;
      meas.font = `100px ${FONT_FAMILY}, sans-serif`;
      const sp100 = 10;
      let total100 = 0;
      for (const ch of WORD) { total100 += meas.measureText(ch).width + sp100; }
      total100 -= sp100;
      let fs = 100 * (0.78 * vw) / total100;
      fs = Math.min(fs, 0.42 * vh);
      const fpx = fs * dpr;

      const out: Glyph[] = [];
      for (const ch of WORD) {
        meas.font = `${fpx}px ${FONT_FAMILY}, sans-serif`;
        const m = meas.measureText(ch);
        const asc = m.actualBoundingBoxAscent || fpx * 0.8;
        const desc = m.actualBoundingBoxDescent || 0;
        const pad = Math.ceil(fpx * 0.06);
        const gw = Math.ceil(m.width + pad * 2);
        const gh = Math.ceil(asc + desc + pad * 2);
        const c = document.createElement('canvas');
        c.width = gw; c.height = gh;
        const g = c.getContext('2d')!;
        g.font = `${fpx}px ${FONT_FAMILY}, sans-serif`;
        g.fillStyle = COLORS.base;
        g.textBaseline = 'alphabetic';
        g.fillText(ch, pad, pad + asc);
        const comps = segmentGlyph(c, COLORS);
        out.push({ comps, gw, gh, adv: (m.width + 0.1 * fpx) / dpr });
      }
      glyphs = out;
      FS = fs;
      dprUsed = dpr;
    }

    const ss = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
    const easeOut = (x: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);

    function draw(now: number) {
      const c = canvasRef.current;
      if (!c) return;
      const dpr = window.devicePixelRatio || 1;
      const vw = c.clientWidth, vh = c.clientHeight;
      if (!vw || !vh) return;
      if (c.width !== Math.round(vw * dpr) || c.height !== Math.round(vh * dpr)) {
        c.width = Math.round(vw * dpr); c.height = Math.round(vh * dpr);
        builtFor = '';
      }
      const key = vw + 'x' + vh + ':' + fontReady;
      if (builtFor !== key) { buildGlyphs(vw, vh, dpr); builtFor = key; }

      const ctx = c.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, vw, vh);

      const G = glyphs;
      if (!G) return;

      const archMax = arch;
      const stagger = staggerMs / 1000;

      const n = G.length;
      const buildEnd = LEAD + (n - 1) * stagger + UNROLL;

      let t = ((now - t0) / 1000) * speed;
      // play once and hold on the final mark (fade is handled by the overlay).
      t = Math.min(t, buildEnd + HOLD - 0.01);

      if (!builtFired && t >= buildEnd) {
        builtFired = true;
        onBuiltRef.current?.();
      }

      // arch: exaggerated during build, settles to a subtle residual.
      const env = ss(t / 0.45);
      const flat = ss((t - (buildEnd - 0.15)) / 0.65);
      const A = archMax * env * (1 - 0.88 * flat);
      const S = 1;

      const slots: { c: number }[] = [];
      let acc = 0;
      for (let i = 0; i < n; i++) {
        const started = t - (LEAD + i * stagger);
        const s = ss(started / 0.22);
        const w = G[i].adv * s;
        slots.push({ c: acc + w / 2 });
        acc += w;
      }

      const cx = vw / 2, cy = vh / 2;
      const baseHalf = (FS || 100) * 0.42;
      const k = dprUsed || dpr;

      ctx.save();
      ctx.translate(cx, cy + baseHalf);
      ctx.scale(S, S);

      for (let i = 0; i < n; i++) {
        const g = G[i];
        const started = t - (LEAD + i * stagger);
        if (started <= 0) continue;
        const pLin = Math.max(0, Math.min(1, started / UNROLL));
        const la = Math.min(1, started / 0.1);
        if (la <= 0) continue;

        const u = acc > 1 ? ((slots[i].c - acc / 2) / (acc / 2)) : 0;
        const dy = -A * (1 - u * u);
        const rot = u * A * 0.0045;

        ctx.save();
        ctx.translate(slots[i].c - acc / 2, dy);
        ctx.rotate(rot);

        const gx0 = -(g.gw / k) / 2;
        const gyTop = -(g.gh / k);

        const m = g.comps.length;
        const step = 1 / (m + 0.6);
        for (let ci = 0; ci < m; ci++) {
          const comp = g.comps[ci];
          const s0 = ci * step;
          const dur = Math.min(step * 1.7, 1 - s0);
          const q = (pLin - s0) / dur;
          if (q <= 0) continue;
          const qe = easeOut(Math.min(1, q));
          const ca = Math.min(1, q / 0.15) * la;

          const dx = gx0 + comp.minX / k;
          const dyT = gyTop + comp.minY / k;
          const fa = ss((q - 0.05) / 0.12) * (1 - ss((q - 0.8) / 0.2));

          ctx.globalAlpha = ca;
          if (comp.vertical) {
            const rev = qe * comp.h;
            if (rev > 0.5) ctx.drawImage(comp.set.base, 0, comp.h - rev, comp.w, rev, dx, dyT + (comp.h - rev) / k, comp.w / k, rev / k);
            const fh = Math.min(0.35 * comp.h, comp.h - rev);
            if (q < 1 && fh > 2 && fa > 0.01) {
              ctx.save();
              ctx.globalAlpha = ca * fa;
              ctx.translate(dx, dyT + (comp.h - rev) / k);
              ctx.scale(1, -0.5);
              ctx.drawImage(comp.set.dark, 0, comp.h - rev - fh, comp.w, fh, 0, 0, comp.w / k, fh / k);
              ctx.restore();
              ctx.globalAlpha = ca * fa * 0.7;
              ctx.drawImage(comp.set.bright, 0, Math.max(0, comp.h - rev), comp.w, Math.max(2, k), dx, dyT + (comp.h - rev) / k, comp.w / k, 1.5);
            }
          } else {
            const rev = qe * comp.w;
            if (rev > 0.5) ctx.drawImage(comp.set.base, 0, 0, rev, comp.h, dx, dyT, rev / k, comp.h / k);
            const fw = Math.min(0.35 * comp.w, comp.w - rev);
            if (q < 1 && fw > 2 && fa > 0.01) {
              ctx.save();
              ctx.globalAlpha = ca * fa;
              ctx.translate(dx + rev / k, dyT);
              ctx.scale(-0.5, 1);
              ctx.drawImage(comp.set.dark, rev, 0, fw, comp.h, -fw / k, 0, fw / k, comp.h / k);
              ctx.restore();
              ctx.globalAlpha = ca * fa * 0.7;
              ctx.drawImage(comp.set.bright, Math.max(0, rev - k), 0, Math.max(2, k), comp.h, dx + rev / k, dyT, 1.5, comp.h / k);
            }
          }
        }
        ctx.restore();
      }
      ctx.restore();
    }

    const loop = (now: number) => {
      if (disposed) return;
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onResize = () => { builtFor = ''; };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
    // Intro plays once with fixed props — intentionally mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
    />
  );
};

export default PstreamIntro;
