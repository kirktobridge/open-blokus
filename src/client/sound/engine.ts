import { CUES, cueDuration, pitchFor, type Cue, type CueId, type Noise, type Tone } from './cues';

/**
 * The Web Audio renderer (P7): the *only* module in the app that touches an
 * `AudioContext`. It knows how to turn a `Cue` (pure data, `cues.ts`) into sound and
 * nothing else — no game concepts, no React. Callers just say `play('cut')`.
 *
 * Two browser realities shape this:
 *
 * 1. **Autoplay policy.** A context created before the user has interacted starts
 *    `suspended`. So we build it lazily, on the first `play()` — which by construction
 *    happens inside a click (picking up a piece) — and `resume()` defensively.
 * 2. **No audio is a normal state**, not an error: SSR, headless runs, locked-down
 *    browsers. Every entry point degrades to a silent no-op rather than throwing —
 *    a game must never fail to render because a speaker didn't.
 */

interface Config {
  enabled: boolean;
  /** Master volume, 0–1. */
  volume: number;
}

let config: Config = { enabled: false, volume: 0 };
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
/** Set once we know this environment can't do audio, so we stop retrying. */
let unavailable = false;

/** Mirrors the user's prefs into the engine; called from `useGameSound`. */
export function configureSound(next: Config): void {
  config = next;
  if (master && ctx) master.gain.setTargetAtTime(next.volume, ctx.currentTime, 0.01);
}

function audioContextCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  // Both are optional at the type level on purpose: this is the check for whether the
  // browser has Web Audio at all (Safari only had it prefixed for years).
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** The shared context + master chain, built on first use. Null when audio can't run. */
function ensureContext(): AudioContext | null {
  if (unavailable) return null;
  if (ctx) {
    // A context can be suspended out from under us (tab backgrounded, autoplay gate).
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    return ctx;
  }
  const Ctor = audioContextCtor();
  if (!Ctor) {
    unavailable = true;
    return null;
  }
  try {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = config.volume;
    // Cues can layer (a placement that also cuts, on the ply a color goes out), and
    // stacked transients clip. The compressor is a cheap ceiling, not an effect — hence
    // `knee = 0`: the default 30dB knee starts compressing 30dB *below* the threshold,
    // which is under every cue we play, so it would quietly duck the whole palette
    // instead of only catching the peaks.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 0;
    limiter.ratio.value = 12;
    master.connect(limiter).connect(ctx.destination);
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    return ctx;
  } catch {
    unavailable = true;
    ctx = null;
    master = null;
    return null;
  }
}

/** One second of white noise, generated once and reused by every percussive cue. */
function ensureNoiseBuffer(ac: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  const buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buf;
  return buf;
}

/**
 * Percussive attack, exponential decay. `exponentialRampToValueAtTime` can't reach 0
 * (the ramp is undefined there), hence the small floor before the hard stop.
 */
function envelope(gain: GainNode, at: number, dur: number, peak: number): void {
  const attack = Math.min(0.006, dur / 4);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
}

function playTone(ac: AudioContext, out: GainNode, tone: Tone, at: number, pitch: number): void {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = tone.wave;
  const start = at + tone.start;
  osc.frequency.setValueAtTime(tone.freq * pitch, start);
  if (tone.freqEnd !== undefined) {
    // The glide is the character of the cue (thud, whoop) — exponential so it reads
    // as a pitch bend rather than a linear sweep.
    osc.frequency.exponentialRampToValueAtTime(tone.freqEnd * pitch, start + tone.dur);
  }
  envelope(gain, start, tone.dur, tone.gain);
  osc.connect(gain).connect(out);
  osc.start(start);
  osc.stop(start + tone.dur);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}

function playNoise(ac: AudioContext, out: GainNode, noise: Noise, at: number, pitch: number): void {
  const src = ac.createBufferSource();
  src.buffer = ensureNoiseBuffer(ac);
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = noise.cutoff * pitch;
  const gain = ac.createGain();
  const start = at + noise.start;
  envelope(gain, start, noise.dur, noise.gain);
  src.connect(filter).connect(gain).connect(out);
  src.start(start);
  src.stop(start + noise.dur);
  src.onended = () => {
    src.disconnect();
    filter.disconnect();
    gain.disconnect();
  };
}

function render(ac: AudioContext, out: GainNode, cue: Cue, pitch: number): void {
  const at = ac.currentTime + 0.001; // a hair ahead, so nothing schedules in the past
  for (const tone of cue.tones) playTone(ac, out, tone, at, pitch);
  if (cue.noise) playNoise(ac, out, cue.noise, at, pitch);
}

/**
 * Play one cue. `size` (a placement's square count) shapes the pitch of the cues that
 * declare themselves `sized`, and is ignored by the rest. Silent — and free — when
 * sound is off, muted, or unsupported.
 */
export function play(id: CueId, size?: number): void {
  if (!config.enabled || config.volume <= 0) return;
  const cue = CUES[id];
  if (!cue) return;
  const ac = ensureContext();
  if (!ac || !master) return;
  try {
    render(ac, master, cue, cue.sized ? pitchFor(size ?? 5) : 1);
  } catch {
    // A failed voice is not worth a broken game; drop the cue.
  }
}

/** How long the cue rings — exposed for tests and for the settings preview. */
export { cueDuration };

/** Test seam: forget the context so a fresh one is built (never used in the app). */
export function resetAudioForTests(): void {
  ctx = null;
  master = null;
  noiseBuffer = null;
  unavailable = false;
  config = { enabled: false, volume: 0 };
}
