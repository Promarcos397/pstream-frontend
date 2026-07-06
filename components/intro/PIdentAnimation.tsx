// PIdentAnimation.tsx
// Netflix-style "P" ident: the letter builds stroke-by-stroke, holds, squeezes into a
// single bright column, then bursts into a full-frame color spectrum, and fades.
// Zero dependencies (just React). The glyph font is embedded below as a data URL,
// so this file is fully self-contained — drop it in and render <PIdentAnimation />.
import React, { useEffect, useRef } from "react";

const FONT_DATA_URL =
  "data:font/ttf;base64,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";
const FONT_FAMILY = "SGA_PIdent";

export interface PIdentAnimationProps {
  /** Playback speed multiplier (1 = normal). */
  speed?: number;
  /** Loop forever (true) or play once and hold the fade (false). */
  loop?: boolean;
  /** Fires once when a non-looping run reaches the end of its timeline — the
   *  boot-gate uses this to coordinate the app reveal with load readiness. */
  onComplete?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export default function PIdentAnimation({
  speed = 1,
  loop = true,
  onComplete,
  className,
  style,
}: PIdentAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const speedRef = useRef(speed);
  const loopRef = useRef(loop);
  const onCompleteRef = useRef(onComplete);
  speedRef.current = speed;
  loopRef.current = loop;
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let raf = 0;
    let G: any = null;
    let fontReady = false;
    let builtFor = "";
    let dprUsed = 1;
    let completed = false;
    const t0 = performance.now();

    // ---- load embedded font ----
    try {
      const ff = new FontFace(FONT_FAMILY, `url(${FONT_DATA_URL})`);
      ff.load()
        .then((f) => {
          (document as any).fonts.add(f);
          fontReady = true;
          builtFor = "";
        })
        .catch(() => {
          fontReady = true;
        });
    } catch {
      fontReady = true;
    }

    const ss = (x: number) => {
      x = Math.max(0, Math.min(1, x));
      return x * x * (3 - 2 * x);
    };
    const easeOut = (x: number) =>
      1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);

    // ---- connected-component labeling: split a glyph into its strokes ----
    function segmentGlyph(alphaCanvas: HTMLCanvasElement, colors: Record<string, string>) {
      const w = alphaCanvas.width, h = alphaCanvas.height;
      const g = alphaCanvas.getContext("2d")!;
      const a = g.getImageData(0, 0, w, h).data;
      const lab = new Int32Array(w * h).fill(-1);
      const comps: any[] = [];
      const TH = 30;
      const stack: number[] = [];
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const idx = y * w + x;
          if (lab[idx] !== -1 || a[idx * 4 + 3] <= TH) continue;
          const id = comps.length;
          const comp: any = { minX: x, minY: y, maxX: x, maxY: y, count: 0 };
          stack.length = 0;
          stack.push(idx);
          lab[idx] = id;
          while (stack.length) {
            const i2 = stack.pop()!;
            const cx = i2 % w, cy = (i2 / w) | 0;
            comp.count++;
            if (cx < comp.minX) comp.minX = cx;
            if (cx > comp.maxX) comp.maxX = cx;
            if (cy < comp.minY) comp.minY = cy;
            if (cy > comp.maxY) comp.maxY = cy;
            for (let dy = -1; dy <= 1; dy++)
              for (let dx = -1; dx <= 1; dx++) {
                if (!dx && !dy) continue;
                const nx = cx + dx, ny = cy + dy;
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                const ni = ny * w + nx;
                if (lab[ni] === -1 && a[ni * 4 + 3] > TH) {
                  lab[ni] = id;
                  stack.push(ni);
                }
              }
          }
          comps.push(comp);
        }
      const hex2rgb = (hx: string) => [
        parseInt(hx.slice(1, 3), 16),
        parseInt(hx.slice(3, 5), 16),
        parseInt(hx.slice(5, 7), 16),
      ];
      const rgbs: Record<string, number[]> = {};
      for (const k of Object.keys(colors)) rgbs[k] = hex2rgb(colors[k]);
      for (let ci = 0; ci < comps.length; ci++) {
        const c = comps[ci];
        const cw = c.maxX - c.minX + 1, ch = c.maxY - c.minY + 1;
        c.w = cw; c.h = ch; c.set = {};
        for (const kk of Object.keys(colors)) {
          const cv = document.createElement("canvas");
          cv.width = cw; cv.height = ch;
          const cg = cv.getContext("2d")!;
          const im = cg.createImageData(cw, ch);
          const [r, gr, bl] = rgbs[kk];
          for (let y = c.minY; y <= c.maxY; y++)
            for (let x = c.minX; x <= c.maxX; x++) {
              if (lab[y * w + x] !== ci) continue;
              const di = ((y - c.minY) * cw + (x - c.minX)) * 4;
              im.data[di] = r; im.data[di + 1] = gr; im.data[di + 2] = bl;
              im.data[di + 3] = a[(y * w + x) * 4 + 3];
            }
          cg.putImageData(im, 0, 0);
          c.set[kk] = cv;
        }
        c.vertical = ch >= cw;
      }
      comps.sort((p, q) => q.maxY - p.maxY || p.minX - q.minX);
      return comps.filter((c) => c.count > 4);
    }

    function build(vw: number, vh: number, dpr: number) {
      const FS = Math.min(0.36 * vh, 0.3 * vw);
      const fpx = FS * dpr;
      const colors = { base: "#e50914", dark: "#8e070f", bright: "#ff9d9d" };
      const meas = document.createElement("canvas").getContext("2d")!;
      meas.font = fpx + "px " + FONT_FAMILY + ", sans-serif";
      const m = meas.measureText("P");
      const asc = m.actualBoundingBoxAscent || fpx * 0.8;
      const desc = m.actualBoundingBoxDescent || 0;
      const pad = Math.ceil(fpx * 0.06);
      const gw = Math.ceil(m.width + pad * 2);
      const gh = Math.ceil(asc + desc + pad * 2);
      const c = document.createElement("canvas");
      c.width = gw; c.height = gh;
      const g = c.getContext("2d")!;
      g.font = fpx + "px " + FONT_FAMILY + ", sans-serif";
      g.fillStyle = colors.base;
      g.textBaseline = "alphabetic";
      g.fillText("P", pad, pad + asc);
      const comps = segmentGlyph(c, colors);

      // Fewer strips = fewer per-frame `lighter` glow fills (the main cost).
      const NS = 46;
      const alpha = g.getImageData(0, 0, gw, gh).data;
      const strips: any[] = [];
      const rnd = (s: number) => {
        const x = Math.sin(s * 127.1 + 311.7) * 43758.5453;
        return x - Math.floor(x);
      };
      // Warm ramp tops out at a soft cream, not pure white — keeps the spectrum
      // saturated instead of blowing out to lots of white ribbons.
      const warm = [[229, 9, 20], [255, 90, 30], [255, 140, 40], [255, 180, 70], [255, 208, 150]];
      const cool = [[36, 90, 220], [70, 150, 255], [120, 200, 255], [128, 80, 255]];
      for (let i = 0; i < NS; i++) {
        const sx = Math.floor((i * gw) / NS);
        const sw = Math.max(1, Math.ceil(gw / NS));
        let ink = false;
        for (let x = sx; x < Math.min(gw, sx + sw) && !ink; x++)
          for (let y = 0; y < gh; y += 3) {
            if (alpha[(y * gw + x) * 4 + 3] > 40) { ink = true; break; }
          }
        const origU = ((sx + sw / 2) / gw) * 2 - 1;
        const finalU = ((i + 0.5) / NS) * 2 - 1 + (rnd(i * 5 + 2) - 0.5) * (1.6 / NS);
        const coolProb = Math.max(0, Math.min(1, (Math.abs(finalU) - 0.38) / 0.5)) * 0.85;
        const pal = rnd(i * 3 + 1) < coolProb ? cool : warm;
        const col = pal[Math.floor(rnd(i * 7 + 2) * pal.length)];
        strips.push({ sx, sw, ink, origU, finalU, col, s1: rnd(i + 3), s2: rnd(i * 13 + 5), s3: rnd(i * 29 + 8) });
      }
      G = { comps, glyph: c, gw, gh, strips, cwCss: gw / dpr, chCss: gh / dpr };
      dprUsed = dpr;
    }

    function ribbonBar(ctx: CanvasRenderingContext2D, x: number, w: number, y0: number, y1: number, col: number[], alpha: number, coreAlpha: number) {
      ctx.globalAlpha = alpha * 0.18;
      ctx.fillStyle = "rgb(" + col[0] + "," + col[1] + "," + col[2] + ")";
      ctx.fillRect(x - w * 1.35, y0, w * 2.7, y1 - y0);
      ctx.globalAlpha = alpha * 0.55;
      ctx.fillRect(x - w / 2, y0, w, y1 - y0);
      ctx.globalAlpha = coreAlpha;
      ctx.fillStyle = "rgb(" + Math.min(255, col[0] + 85) + "," + Math.min(255, col[1] + 85) + "," + Math.min(255, col[2] + 85) + ")";
      ctx.fillRect(x - w * 0.16, y0, w * 0.32, y1 - y0);
    }

    function draw(now: number) {
      const cv = canvasRef.current;
      if (!cv) return;
      // Cap the backing-store resolution: the burst is dozens of wide,
      // `lighter`-blended glow ribbons of overdraw per frame, so full retina/4K
      // dpr murders fill-rate for no visible gain on a soft, transient effect.
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      const vw = cv.clientWidth, vh = cv.clientHeight;
      if (!vw || !vh) return;
      if (cv.width !== Math.round(vw * dpr) || cv.height !== Math.round(vh * dpr)) {
        cv.width = Math.round(vw * dpr);
        cv.height = Math.round(vh * dpr);
        builtFor = "";
      }
      const key = vw + "x" + vh + ":" + fontReady;
      if (builtFor !== key) { build(vw, vh, dpr); builtFor = key; }

      const ctx = cv.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, vw, vh);
      if (!G) return;

      const speed = Number(speedRef.current ?? 1);
      const doLoop = loopRef.current ?? true;

      const LEAD = 0.3, BUILD = 0.95, HOLDEND = 2.5, CONVERGEEND = 3.0, BURSTEND = 3.95, FADESTART = 5.0, TOTAL = 5.9;

      const rawT = ((now - t0) / 1000) * speed;
      let t = rawT;
      if (doLoop) t = t % TOTAL; else t = Math.min(t, TOTAL - 0.001);

      // Non-looping: fire onComplete once the timeline has fully played out.
      if (!doLoop && !completed && rawT >= TOTAL) {
        completed = true;
        onCompleteRef.current?.();
      }

      const cx = vw / 2, cy = vh / 2;
      const k = dprUsed || dpr;
      const ga = 1 - ss((t - FADESTART) / (TOTAL - FADESTART));

      // Fully faded (the end-hold before the gate unmounts us): the canvas is
      // already cleared to black, so skip the entire strip loop.
      if (ga <= 0.02 && t >= FADESTART) return;

      if (t < HOLDEND) {
        const pLin = Math.max(0, Math.min(1, (t - LEAD) / BUILD));
        if (pLin <= 0) return;
        const gx0 = -G.cwCss / 2, gyTop = -G.chCss / 2;
        ctx.save();
        ctx.translate(cx, cy);
        const m = G.comps.length;
        const step = 1 / (m + 0.6);
        for (let ci = 0; ci < m; ci++) {
          const c = G.comps[ci];
          const s0 = ci * step;
          const dur = Math.min(step * 1.7, 1 - s0);
          const q = (pLin - s0) / dur;
          if (q <= 0) continue;
          const qe = easeOut(Math.min(1, q));
          const ca = Math.min(1, q / 0.15);
          const dx = gx0 + c.minX / k;
          const dyT = gyTop + c.minY / k;
          const fa = ss((q - 0.05) / 0.12) * (1 - ss((q - 0.8) / 0.2));
          ctx.globalAlpha = ca;
          if (c.vertical) {
            const rev = qe * c.h;
            if (rev > 0.5) ctx.drawImage(c.set.base, 0, c.h - rev, c.w, rev, dx, dyT + (c.h - rev) / k, c.w / k, rev / k);
            const fh = Math.min(0.35 * c.h, c.h - rev);
            if (q < 1 && fh > 2 && fa > 0.01) {
              ctx.save();
              ctx.globalAlpha = ca * fa;
              ctx.translate(dx, dyT + (c.h - rev) / k);
              ctx.scale(1, -0.5);
              ctx.drawImage(c.set.dark, 0, c.h - rev - fh, c.w, fh, 0, 0, c.w / k, fh / k);
              ctx.restore();
              ctx.globalAlpha = ca * fa * 0.7;
              ctx.drawImage(c.set.bright, 0, Math.max(0, c.h - rev), c.w, Math.max(2, k), dx, dyT + (c.h - rev) / k, c.w / k, 1.5);
            }
          } else {
            const rev = qe * c.w;
            if (rev > 0.5) ctx.drawImage(c.set.base, 0, 0, rev, c.h, dx, dyT, rev / k, c.h / k);
            const fw2 = Math.min(0.35 * c.w, c.w - rev);
            if (q < 1 && fw2 > 2 && fa > 0.01) {
              ctx.save();
              ctx.globalAlpha = ca * fa;
              ctx.translate(dx + rev / k, dyT);
              ctx.scale(-0.5, 1);
              ctx.drawImage(c.set.dark, rev, 0, fw2, c.h, -fw2 / k, 0, fw2 / k, c.h / k);
              ctx.restore();
              ctx.globalAlpha = ca * fa * 0.7;
              ctx.drawImage(c.set.bright, Math.max(0, rev - k), 0, Math.max(2, k), c.h, dx + rev / k, dyT, 1.5, c.h / k);
            }
          }
        }
        ctx.restore();
        return;
      }

      const pc = ss((t - HOLDEND) / (CONVERGEEND - HOLDEND));
      const pbRaw = Math.max(0, Math.min(1, (t - CONVERGEEND) / (BURSTEND - CONVERGEEND)));

      const zoom = 1 + 0.17 * pc - 0.17 * ss(pbRaw / 0.4);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(zoom, zoom);
      ctx.translate(-cx, -cy);
      ctx.globalCompositeOperation = "lighter";

      const colWJit = Math.max(5, G.cwCss * 0.05);
      const hFull = vh * 1.12;
      const hCol = G.chCss * 1.9;
      // Narrower final ribbons (1.4 -> 1.15) leave a touch of gap between them.
      const wFinal = (vw / G.strips.length) * 1.15;

      for (const st of G.strips) {
        const stag = st.s3 * 0.28;
        const pbs = easeOut(Math.max(0, Math.min(1, (pbRaw - stag) / (1 - stag))));
        const origX = st.origU * (G.cwCss / 2);
        const colX = (st.s1 - 0.5) * 2 * colWJit;
        const finalX = st.finalU * (vw * 0.52);
        const cxpos = origX + (colX - origX) * pc;
        let x = cx + cxpos + (finalX - colX) * pbs;
        x += Math.sin(st.s2 * 30 + t * 0.7) * 10 * pbs;
        if (x < -90 || x > vw + 90) continue;

        const h = G.chCss + (hCol - G.chCss) * pc + (hFull - hCol) * easeOut(pbs);
        const y0 = cy - h / 2;
        const wSlice = st.sw / k;
        const wCss = wSlice + (wFinal - wSlice) * pbs;
        const vis = st.ink ? 1 : ss((pbRaw - 0.12) / 0.5);
        if (vis <= 0.01) continue;

        const flicker = 0.8 + 0.2 * Math.sin(t * (13 + st.s2 * 16) + st.s2 * 40);
        const ga2 = ga * vis * flicker;

        if (pbs < 0.1 && st.ink) {
          const boost = 1 + 1.0 * pc;
          ctx.globalAlpha = Math.min(1, ga2 * (0.85 + 0.15 * boost));
          ctx.drawImage(G.glyph, st.sx, 0, st.sw, G.gh, x - wSlice / 2, y0, Math.max(1, wSlice), h);
          if (pc > 0.2) {
            ctx.globalAlpha = ga2 * pc * 0.55;
            ctx.fillStyle = "#ff9d6e";
            ctx.fillRect(x - Math.max(0.8, wSlice * 0.22), y0, Math.max(1.6, wSlice * 0.44), h);
          }
        } else {
          const mix = ss((pbs - 0.18) / 0.5);
          const col = [
            Math.round(233 + (st.col[0] - 233) * mix),
            Math.round(28 + (st.col[1] - 28) * mix),
            Math.round(30 + (st.col[2] - 30) * mix),
          ];
          ribbonBar(ctx, x, Math.max(1.5, wCss), y0, y0 + h, col, ga2 * (0.68 - 0.18 * pbs), Math.min(1, ga2) * 0.68);
        }
      }
      ctx.restore();
      ctx.globalCompositeOperation = "source-over";
    }

    const tick = (now: number) => {
      draw(now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: "block", width: "100%", height: "100%", background: "#000", ...style }}
    />
  );
}
