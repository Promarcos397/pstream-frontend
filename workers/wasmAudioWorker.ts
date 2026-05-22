import { registerAc3Decoder } from '@mediabunny/ac3';
import { Input, UrlSource, ALL_FORMATS, AudioSampleSink } from 'mediabunny';

// Initialize the AC-3/E-AC-3 decoder extension
try {
  registerAc3Decoder();
} catch (e) {
  console.error('[WasmWorker] Failed to register AC3 decoder:', e);
}

let activeLoopId = 0;
let currentInput: Input | null = null;
let currentUrl = '';
let currentAudioTrack: any = null;
let currentSampleRate = 0;
let currentNumChannels = 0;
let currentDuration = 0;
let playhead = 0;
let isPaused = false;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

self.onmessage = async (e: MessageEvent) => {
  const { type, url, time, playhead: updatedPlayhead } = e.data;

  switch (type) {
    case 'start':
      isPaused = false;
      playhead = time || 0;
      startDecoding(url, playhead);
      break;

    case 'seek':
      playhead = time;
      startDecoding(url, playhead);
      break;

    case 'pause':
      isPaused = true;
      break;

    case 'resume':
      isPaused = false;
      break;

    case 'updatePlayhead':
      playhead = updatedPlayhead;
      break;

    case 'stop':
      activeLoopId++;
      isPaused = false;
      if (currentInput) {
        try {
          currentInput.dispose();
        } catch (err) {
          console.error('[WasmWorker] Dispose error during stop:', err);
        }
        currentInput = null;
      }
      currentUrl = '';
      currentAudioTrack = null;
      currentSampleRate = 0;
      currentNumChannels = 0;
      currentDuration = 0;
      break;
  }
};

async function startDecoding(url: string, startTimestamp: number) {
  const loopId = ++activeLoopId;

  try {
    let audioTrack = currentAudioTrack;
    let sampleRate = currentSampleRate;
    let numChannels = currentNumChannels;
    let duration = currentDuration;

    if (url !== currentUrl || !currentInput || !currentAudioTrack) {
      if (currentInput) {
        try {
          currentInput.dispose();
        } catch (err) {
          console.error('[WasmWorker] Dispose error on recreation:', err);
        }
        currentInput = null;
        currentAudioTrack = null;
      }

      currentUrl = url;
      const source = new UrlSource(url);
      const input = new Input({
        source,
        formats: ALL_FORMATS,
      });
      currentInput = input;

      audioTrack = await input.getPrimaryAudioTrack();
      if (!audioTrack) {
        postMessage({ type: 'error', message: 'No audio track found in stream' });
        return;
      }
      currentAudioTrack = audioTrack;

      sampleRate = await audioTrack.getSampleRate();
      numChannels = await audioTrack.getNumberOfChannels();
      duration = await input.computeDuration();

      currentSampleRate = sampleRate;
      currentNumChannels = numChannels;
      currentDuration = duration;

      postMessage({
        type: 'metadata',
        sampleRate,
        numChannels,
        duration,
      });
    }

    const sink = new AudioSampleSink(audioTrack);

    for await (const sample of sink.samples(startTimestamp)) {
      if (loopId !== activeLoopId) {
        sample.close();
        break;
      }

      // Throttle: don't buffer more than 15 seconds ahead of current playhead
      while (sample.timestamp > playhead + 15 && loopId === activeLoopId) {
        await sleep(100);
      }

      // Handle pause state
      while (isPaused && loopId === activeLoopId) {
        await sleep(100);
      }

      if (loopId !== activeLoopId) {
        sample.close();
        break;
      }

      const numFrames = sample.numberOfFrames;
      const sRate = sample.sampleRate;
      const ts = sample.timestamp;
      const dur = sample.duration;
      const channels = sample.numberOfChannels;

      let left: Float32Array;
      let right: Float32Array;

      if (channels === 1) {
        // Mono
        const mono = new Float32Array(numFrames);
        sample.copyTo(mono, { format: 'f32-planar', planeIndex: 0 });
        left = mono;
        right = mono;
      } else if (channels === 2) {
        // Stereo
        left = new Float32Array(numFrames);
        right = new Float32Array(numFrames);
        sample.copyTo(left, { format: 'f32-planar', planeIndex: 0 });
        sample.copyTo(right, { format: 'f32-planar', planeIndex: 1 });
      } else if (channels >= 6) {
        // Surround sound downmix (Left, Right, Center, LFE, Left Surround, Right Surround)
        const l = new Float32Array(numFrames);
        const r = new Float32Array(numFrames);
        const c = new Float32Array(numFrames);
        const ls = new Float32Array(numFrames);
        const rs = new Float32Array(numFrames);

        sample.copyTo(l, { format: 'f32-planar', planeIndex: 0 });
        sample.copyTo(r, { format: 'f32-planar', planeIndex: 1 });
        sample.copyTo(c, { format: 'f32-planar', planeIndex: 2 });
        // planeIndex 3 is LFE (subwoofer) - ignored in standard stereo downmix
        sample.copyTo(ls, { format: 'f32-planar', planeIndex: 4 });
        sample.copyTo(rs, { format: 'f32-planar', planeIndex: 5 });

        left = new Float32Array(numFrames);
        right = new Float32Array(numFrames);

        // dialogue boost: Center has higher weight (0.85 instead of 0.707)
        const centerGain = 0.85;
        const surroundGain = 0.707;

        for (let i = 0; i < numFrames; i++) {
          left[i] = l[i] + c[i] * centerGain + ls[i] * surroundGain;
          right[i] = r[i] + c[i] * centerGain + rs[i] * surroundGain;
        }
      } else {
        // General fallback
        left = new Float32Array(numFrames);
        right = new Float32Array(numFrames);
        sample.copyTo(left, { format: 'f32-planar', planeIndex: 0 });
        if (channels > 1) {
          sample.copyTo(right, { format: 'f32-planar', planeIndex: 1 });
        } else {
          right.set(left);
        }
      }

      sample.close();

      postMessage(
        {
          type: 'pcm',
          left,
          right,
          timestamp: ts,
          duration: dur,
          sampleRate: sRate,
        },
        [left.buffer, right.buffer]
      );
    }
  } catch (err: any) {
    if (loopId === activeLoopId) {
      console.error('[WasmWorker] Decoding loop error:', err);
      postMessage({ type: 'error', message: err.message || 'Decoding error' });
    }
  }
}
