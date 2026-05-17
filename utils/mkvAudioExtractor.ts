import {
  readElement, readVint, readString, readUint, readInt16,
  ID_SEGMENT, ID_TRACKS, ID_TRACK_ENTRY, ID_TRACK_NUMBER,
  ID_TRACK_TYPE, ID_CODEC_ID, ID_LANGUAGE, ID_CLUSTER,
  ID_SIMPLE_BLOCK, ID_TIME_CODE, ID_CUES, ID_CUE_POINT,
  ID_CUE_TIME, ID_CUE_TRACK_POSITIONS, ID_CUE_CLUSTER_POSITION,
  ID_INFO, ID_TIMECODE_SCALE, findElement,
} from './ebml';

export interface MkvAudioTrack {
  trackNumber: number;
  codecId: string;
  language: string;
}

export interface ClusterInfo {
  timecodeMs: number;
  position: number;
}

/**
 * Browser-side MKV audio extractor using HTTP Range requests.
 * Fetches header + Cues once, then pulls only audio clusters on demand.
 */
export class MkvAudioExtractor {
  private url: string;
  private size = 0;
  private audioTrack: MkvAudioTrack | null = null;
  private segmentOffset = 0;
  private timecodeScale = 1000000; // default 1ms in nanoseconds
  private cues: ClusterInfo[] = [];
  private initialized = false;

  constructor(url: string) {
    this.url = url;
  }

  async init(signal?: AbortSignal): Promise<boolean> {
    try {
      // 1. Get Content-Length via HEAD
      const head = await fetch(this.url, { method: 'HEAD', signal });
      if (!head.ok) return false;
      const cl = head.headers.get('Content-Length');
      if (!cl) return false;
      this.size = parseInt(cl, 10);

      // 2. Fetch first 2MB: header, tracks, info, maybe early clusters
      const headerRes = await fetch(this.url, {
        headers: { Range: 'bytes=0-2097151' },
        signal,
      });
      if (!headerRes.ok && headerRes.status !== 206) return false;
      const header = new Uint8Array(await headerRes.arrayBuffer());

      // Find Segment
      const seg = findElement(header, 0, header.length, ID_SEGMENT);
      if (!seg) return false;
      this.segmentOffset = seg.dataOffset - readVint(header, 0)!.length; // rough, but ok

      // Parse Info for TimecodeScale
      const info = findElement(header, seg.dataOffset, seg.endOffset, ID_INFO);
      if (info) {
        const tcs = findElement(header, info.dataOffset, info.endOffset, ID_TIMECODE_SCALE);
        if (tcs) this.timecodeScale = readUint(header, tcs.dataOffset, tcs.endOffset - tcs.dataOffset);
      }

      // Parse Tracks
      const tracks = findElement(header, seg.dataOffset, seg.endOffset, ID_TRACKS);
      if (tracks) this.parseTracks(header, tracks.dataOffset, tracks.endOffset);
      if (!this.audioTrack) return false;

      // 3. Fetch Cues from end of file (usually last 512KB)
      await this.loadCues(signal);

      this.initialized = true;
      return true;
    } catch (e) {
      console.error('[MkvAudioExtractor] init failed:', e);
      return false;
    }
  }

  private parseTracks(data: Uint8Array, start: number, end: number) {
    let pos = start;
    while (pos < end) {
      const entry = findElement(data, pos, end, ID_TRACK_ENTRY);
      if (!entry) break;

      let num = 0, type = 0, codec = '', lang = 'und';
      let inner = entry.dataOffset;
      while (inner < entry.endOffset) {
        const child = readElement(data, inner);
        if (!child) break;
        switch (child.id) {
          case ID_TRACK_NUMBER: num = readUint(data, child.dataOffset, child.endOffset - child.dataOffset); break;
          case ID_TRACK_TYPE: type = readUint(data, child.dataOffset, child.endOffset - child.dataOffset); break;
          case ID_CODEC_ID: codec = readString(data, child.dataOffset, child.endOffset - child.dataOffset); break;
          case ID_LANGUAGE: lang = readString(data, child.dataOffset, child.endOffset - child.dataOffset); break;
        }
        inner = child.endOffset;
      }

      if (type === 2) {
        this.audioTrack = { trackNumber: num, codecId: codec, language: lang };
        console.log(`[MkvAudioExtractor] Audio #${num}: ${codec} (${lang})`);
      }
      pos = entry.endOffset;
    }
  }

  private async loadCues(signal?: AbortSignal) {
    if (this.size < 100000) return;
    try {
      const start = Math.max(0, this.size - 524288);
      const res = await fetch(this.url, {
        headers: { Range: `bytes=${start}-${this.size - 1}` },
        signal,
      });
      if (!res.ok && res.status !== 206) return;
      const data = new Uint8Array(await res.arrayBuffer());

      const cuesEl = findElement(data, 0, data.length, ID_CUES);
      if (!cuesEl) return;

      let pos = cuesEl.dataOffset;
      while (pos < cuesEl.endOffset) {
        const point = findElement(data, pos, cuesEl.endOffset, ID_CUE_POINT);
        if (!point) break;

        let cueTime = 0;
        let clusterPos = 0;
        let inner = point.dataOffset;
        while (inner < point.endOffset) {
          const child = readElement(data, inner);
          if (!child) break;
          if (child.id === ID_CUE_TIME) {
            cueTime = readUint(data, child.dataOffset, child.endOffset - child.dataOffset);
          } else if (child.id === ID_CUE_TRACK_POSITIONS) {
            let tp = child.dataOffset;
            while (tp < child.endOffset) {
              const tpChild = readElement(data, tp);
              if (!tpChild) break;
              if (tpChild.id === ID_CUE_CLUSTER_POSITION) {
                clusterPos = readUint(data, tpChild.dataOffset, tpChild.endOffset - tpChild.dataOffset);
              }
              tp = tpChild.endOffset;
            }
          }
          inner = child.endOffset;
        }

        if (clusterPos > 0) {
          const tcMs = (cueTime * this.timecodeScale) / 1000000;
          this.cues.push({ timecodeMs: tcMs, position: this.segmentOffset + clusterPos });
        }
        pos = point.endOffset;
      }

      this.cues.sort((a, b) => a.timecodeMs - b.timecodeMs);
      console.log(`[MkvAudioExtractor] ${this.cues.length} cues loaded`);
    } catch (e) {
      console.warn('[MkvAudioExtractor] cues load failed:', e);
    }
  }

  /** Extract raw audio frames for [startTimeSec, startTimeSec+durationSec] */
  async extractRange(startSec: number, durationSec: number, signal?: AbortSignal): Promise<Uint8Array | null> {
    if (!this.initialized) return null;
    const startMs = startSec * 1000;
    const endMs = (startSec + durationSec) * 1000;

    // Find relevant clusters via cues
    const relevant = this.cues.filter((c, i) => {
      const next = this.cues[i + 1];
      const nextMs = next ? next.timecodeMs : Infinity;
      return (c.timecodeMs >= startMs && c.timecodeMs <= endMs) ||
             (c.timecodeMs <= startMs && nextMs > startMs);
    });

    if (relevant.length === 0) {
      // No cues — fallback to linear scan from start (good for first 10-15 min)
      return this.linearExtract(startMs, endMs, signal);
    }

    const frames: Uint8Array[] = [];
    for (const cluster of relevant) {
      const data = await this.fetchCluster(cluster.position, signal);
      if (!data) continue;
      frames.push(...this.parseCluster(data, startMs, endMs));
    }
    return frames.length ? this.concat(frames) : null;
  }

  private async fetchCluster(position: number, signal?: AbortSignal): Promise<Uint8Array | null> {
    const end = Math.min(position + 8388608, this.size - 1); // 8MB cluster window
    try {
      const res = await fetch(this.url, {
        headers: { Range: `bytes=${position}-${end}` },
        signal,
      });
      if (!res.ok && res.status !== 206) return null;
      return new Uint8Array(await res.arrayBuffer());
    } catch {
      return null;
    }
  }

  private parseCluster(data: Uint8Array, startMs: number, endMs: number): Uint8Array[] {
    const frames: Uint8Array[] = [];
    const cluster = readElement(data, 0);
    if (!cluster || cluster.id !== ID_CLUSTER) return frames;

    let pos = cluster.dataOffset;
    let clusterTc = 0;

    // Cluster timecode
    const tc = findElement(data, pos, cluster.endOffset, ID_TIME_CODE);
    if (tc) {
      clusterTc = readUint(data, tc.dataOffset, tc.endOffset - tc.dataOffset);
      pos = tc.endOffset;
    }

    while (pos < cluster.endOffset && pos < data.length) {
      const el = readElement(data, pos);
      if (!el) break;
      if (el.id === ID_SIMPLE_BLOCK) {
        const frame = this.parseSimpleBlock(data, el.dataOffset, el.endOffset, clusterTc);
        if (frame && frame.timecodeMs >= startMs && frame.timecodeMs <= endMs) {
          frames.push(frame.data);
        }
      }
      pos = el.endOffset;
    }
    return frames;
  }

  private parseSimpleBlock(
    data: Uint8Array,
    start: number,
    end: number,
    clusterTc: number
  ): { timecodeMs: number; data: Uint8Array } | null {
    // SimpleBlock: [TrackNum vint] [Timecode int16] [Flags uint8] [Frame data...]
    const trackVint = readVint(data, start);
    if (!trackVint) return null;
    let pos = start + trackVint.length;

    const timecode = readInt16(data, pos);
    pos += 2;

    const flags = data[pos];
    pos += 1;

    if (trackVint.value !== this.audioTrack!.trackNumber) return null;

    // Lacing: 0 = none (most AC3). Others are rare for audio.
    const lacing = (flags >> 1) & 0x03;
    if (lacing !== 0) {
      // TODO: implement Xiph/EBML lacing if needed. For now, return raw block.
      console.warn('[MkvAudioExtractor] Non-zero lacing detected — audio may glitch');
    }

    const timecodeMs = clusterTc + timecode;
    return { timecodeMs, data: data.slice(pos, end) };
  }

  private async linearExtract(startMs: number, endMs: number, signal?: AbortSignal): Promise<Uint8Array | null> {
    const frames: Uint8Array[] = [];
    const chunkSize = 8388608;
    let fetchPos = 0;

    while (fetchPos < this.size) {
      const end = Math.min(fetchPos + chunkSize, this.size - 1);
      const res = await fetch(this.url, {
        headers: { Range: `bytes=${fetchPos}-${end}` },
        signal,
      });
      if (!res.ok && res.status !== 206) break;
      const data = new Uint8Array(await res.arrayBuffer());

      // Scan for Cluster ID 0x1F43B675
      for (let i = 0; i < data.length - 4; i++) {
        if (data[i] === 0x1F && data[i + 1] === 0x43 && data[i + 2] === 0xB6 && data[i + 3] === 0x75) {
          const clusterEl = readElement(data, i);
          if (clusterEl) {
            const clusterFrames = this.parseCluster(data.slice(i), startMs, endMs);
            frames.push(...clusterFrames);
          }
        }
      }

      if (frames.length > 0) break; // got frames, stop scanning
      fetchPos += chunkSize;
      if (fetchPos > 52428800) break; // safety: stop after 50MB linear scan
    }

    return frames.length ? this.concat(frames) : null;
  }

  private concat(arrays: Uint8Array[]): Uint8Array {
    const total = arrays.reduce((s, a) => s + a.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const a of arrays) {
      out.set(a, offset);
      offset += a.length;
    }
    return out;
  }

  getCodec(): string | null {
    return this.audioTrack?.codecId ?? null;
  }

  get isReady() {
    return this.initialized;
  }
}
