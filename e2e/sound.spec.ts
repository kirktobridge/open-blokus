import { test, expect, type Browser, type Page } from '@playwright/test';

/**
 * Sound (P7) is the one feature a DOM assertion can't see, so these specs swap the
 * browser's `AudioContext` for an `OfflineAudioContext` and let the app's real engine
 * render into a buffer we can measure.
 *
 * Measuring the *waveform* rather than counting oscillators is the whole point: a count
 * proves a cue fired, never that it was audible. The bug this spec was written against —
 * a compressor left on its default 30dB knee, which starts compressing *below* every cue
 * in the palette and so quietly ducks the entire game — leaves the counts identical and
 * only shows up in the amplitude.
 *
 * Two properties of the harness shape what we assert where:
 *
 * - An `OfflineAudioContext`'s clock is frozen at 0 until it renders, so cues that are
 *   seconds apart for a real player stack on the same instant here, and the layered
 *   transient legitimately trips the limiter. In-game peaks are therefore a *floor*, not
 *   a faithful mix — good enough for "was there sound", too soft for a tight bar.
 * - The settings preview fires one cue on its own, with nothing to overlap. That's the
 *   clean path, so that's where the amplitude bar lives.
 */

/**
 * The bar a single cue at full volume has to clear. Measured, not derived (in the spirit
 * of EVENT_THRESHOLDS): the fixed engine renders 0.111–0.123 here across runs, and the
 * over-compressed one rendered 0.064–0.068 — so 0.09 splits them with ~30% either side.
 */
const AUDIBLE_PEAK = 0.09;

/** The pickup cue's tone (Hz) — the one voice that isn't part of a placement. */
const PICKUP_HZ = 880;

interface Audio {
  peak: number;
  rms: number;
  /** Every oscillator frequency the engine scheduled, in order — one per cue voice. */
  freqs: number[];
  /** How many AudioContexts the app built. A muted game must never build one. */
  contexts: number;
}

/** Replace Web Audio with an offline renderer, and log every voice the engine schedules. */
function instrument() {
  const w = window as unknown as {
    __freqs: number[];
    __contexts: number;
    __ctx: OfflineAudioContext | null;
    AudioContext: typeof AudioContext;
    OfflineAudioContext: typeof OfflineAudioContext;
  };
  w.__freqs = [];
  w.__contexts = 0;
  w.__ctx = null;
  const Offline = w.OfflineAudioContext;
  w.AudioContext = class extends Offline {
    constructor() {
      super(1, 44100 * 2, 44100); // 2s of mono to render into
      w.__contexts++;
      w.__ctx = this;
    }
    createOscillator(): OscillatorNode {
      const osc = super.createOscillator();
      const setValueAtTime = osc.frequency.setValueAtTime.bind(osc.frequency);
      osc.frequency.setValueAtTime = (value: number, time: number) => {
        w.__freqs.push(Math.round(value * 10) / 10);
        return setValueAtTime(value, time);
      };
      return osc;
    }
  } as unknown as typeof AudioContext;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(instrument);
});

/** A second instrumented page, isolated from the first (its own storage and match). */
async function freshPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(instrument);
  return page;
}

/** Render everything the app scheduled, and measure it. */
async function audio(page: Page): Promise<Audio> {
  return page.evaluate(async () => {
    const w = window as unknown as {
      __freqs: number[];
      __contexts: number;
      __ctx: OfflineAudioContext | null;
    };
    const base = { freqs: w.__freqs, contexts: w.__contexts };
    if (!w.__ctx) return { ...base, peak: 0, rms: 0 };
    const data = (await w.__ctx.startRendering()).getChannelData(0);
    let peak = 0;
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      peak = Math.max(peak, Math.abs(data[i]));
      sum += data[i] * data[i];
    }
    return { ...base, peak, rms: Math.sqrt(sum / data.length) };
  });
}

/** A 4p match entered as P0 (blue), who moves first — no bots making noise of their own. */
async function createMatchAsBlue(page: Page) {
  await page.goto('/');
  await page.getByTestId('open-friends').click();
  await page.getByTestId('mode-select').selectOption('4');
  await page.getByTestId('create-match').click();
  await expect(page.getByTestId('match-id')).toBeVisible();
  await expect(page.getByText(/active blue/)).toBeVisible();
}

/** Pick up `piece` and commit it on blue's opening corner. */
async function placeOnCorner(page: Page, piece: string) {
  await page.getByTestId(`piece-blue-${piece}`).click(); // pickup cue
  await page.getByTestId('cell-0-0').click(); // stage
  await page.getByTestId('submit-move').click(); // commit → placement cue
  await expect(page.getByTestId('cell-0-0')).toHaveAttribute('data-value', 'blue');
}

/** Drive the settings preview at `volume` — one cue, nothing overlapping it. */
async function previewAt(page: Page, volume: string): Promise<Audio> {
  await page.goto('/');
  await page.getByTestId('settings-toggle').click();
  // Any value but the 0.6 default: `fill()` with the value already in the input fires no
  // change event, so a "0.6" case would preview nothing and measure silence.
  await page.getByTestId('sound-volume').fill(volume);
  return audio(page);
}

test('a cue is audible, not merely scheduled', async ({ page }) => {
  const { peak, rms, freqs } = await previewAt(page, '1');
  expect(freqs.length).toBeGreaterThan(0); // voices were scheduled…
  expect(rms).toBeGreaterThan(0);
  expect(peak).toBeGreaterThan(AUDIBLE_PEAK); // …and real energy came out of them
});

test('the volume slider actually changes how loud the game is', async ({ page, browser }) => {
  const loud = (await previewAt(page, '1')).peak;
  expect(loud).toBeGreaterThan(AUDIBLE_PEAK);

  // A fresh page: a context can only be rendered once, and volume is read when it's built.
  const quiet = (await previewAt(await freshPage(browser), '0.2')).peak;
  expect(quiet).toBeGreaterThan(0); // quiet, but not muted
  expect(quiet).toBeLessThan(loud / 2);
});

test('placing a piece in a real game makes sound', async ({ page }) => {
  await createMatchAsBlue(page);
  expect((await audio(page)).contexts).toBe(0); // silent — and free — until the player acts

  await placeOnCorner(page, 'I3');
  const { peak, freqs } = await audio(page);
  expect(freqs).toContain(PICKUP_HZ); // the click…
  expect(freqs.length).toBeGreaterThan(1); // …and the clack
  expect(peak).toBeGreaterThan(0);
});

test('a bigger piece lands at a lower pitch', async ({ page, browser }) => {
  // The placement cue is `sized` (cues.ts): a monomino ticks, a pentomino thumps. Both
  // pieces cover blue's opening corner, so this is one flow run twice with one variable.
  // Each match gets its own page — a second match in the same tab rejoins the first.
  const placementTones = async (p: Page, piece: string) => {
    await createMatchAsBlue(p);
    await placeOnCorner(p, piece);
    // Everything but the pickup click is the placement cue's own voices.
    return (await audio(p)).freqs.filter((f) => f !== PICKUP_HZ);
  };

  const small = await placementTones(page, 'I1'); // 1 square
  const big = await placementTones(await freshPage(browser), 'I5'); // 5 squares

  expect(small).toHaveLength(2);
  expect(big).toHaveLength(2);
  for (let i = 0; i < small.length; i++) expect(big[i]).toBeLessThan(small[i]);
});

test('the event vocabulary is audible: a finished game sounds its beats', async ({ page }) => {
  // An all-AI watch game runs to completion in seconds and must cross P32's events —
  // every color ends stuck, and `endgame` fires once. Each event cue has a signature tone
  // no other cue can produce (the placement cue's pitch scaling only spans 151–633Hz), so
  // the scheduled frequencies tell us which beats actually sounded.
  await page.goto('/?botDelay=0');
  await page.getByTestId('open-custom').click();
  await page.getByTestId('ai-mode-select').selectOption('4');
  await page.getByTestId('ai-count-select').selectOption('4'); // 0 humans → watch
  await page.getByTestId('start-ai').click();

  await expect(page.getByRole('heading', { name: 'Game over' })).toBeVisible({
    timeout: 30_000,
  });

  const { freqs, peak } = await audio(page);
  expect(freqs).toContain(330); // `out-of-moves` — its closing note
  expect(freqs).toContain(784); // `endgame` — its top note
  expect(peak).toBeGreaterThan(0);
});

test('muting silences the game, and the setting survives a reload', async ({ page }) => {
  await createMatchAsBlue(page);

  await page.getByTestId('settings-toggle').click();
  const toggle = page.getByTestId('sound-toggle');
  await expect(toggle).toBeChecked(); // sound is on out of the box
  await toggle.uncheck();
  await page.getByTestId('settings-toggle').click(); // close the panel

  await placeOnCorner(page, 'I2');
  const muted = await audio(page);
  expect(muted.freqs).toEqual([]);
  expect(muted.peak).toBe(0);
  // Muting isn't gain-zero: a muted player never pays for an AudioContext at all.
  expect(muted.contexts).toBe(0);

  // The pref is persisted, not just in-memory state.
  await page.reload();
  await page.getByTestId('settings-toggle').click();
  await expect(page.getByTestId('sound-toggle')).not.toBeChecked();
  await expect(page.getByTestId('sound-volume')).toBeDisabled(); // volume is moot when muted
});
