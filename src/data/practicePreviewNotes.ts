// AI_CHANGE:
// Tool: Cursor
// Model: Composer
// Timestamp: 2026-06-05T16:30:00-04:00
// Purpose: Transposable preview scales with user-selectable key and more scale types.
// Reason: User wants more patterns and control over which key the preview runs in.

import type { GuitarNoteEvent } from '../types/guitar';
import { fretToNoteName } from '../utils/noteHelpers';
import { openStringMidi, pitchMidiForFrettedNote } from '../utils/stringTuning';

const PREVIEW_TUNING = [64, 59, 55, 50, 45, 40];

export function previewMsPerBeat(bpm: number): number {
  return 60_000 / Math.max(bpm, 1);
}

/** Default preview playback BPM (wall-clock quarter-note speed). */
export const PREVIEW_BPM_DEFAULT = 80;

export const PREVIEW_BPM_MIN = 48;

/** Fastest tempo in preloaded library (I'm Looking Through You, Rock and Roll @ 172). */
export const PREVIEW_BPM_LIBRARY_MAX = 172;

export const PREVIEW_BPM_MAX = PREVIEW_BPM_LIBRARY_MAX;

/** @deprecated Use previewMsPerBeat(bpm) — kept for tests */
export const PRACTICE_PREVIEW_MS_PER_BEAT = previewMsPerBeat(PREVIEW_BPM_DEFAULT);

/** Midi ticks per quarter note — must match noteHelpers / alphaTab tick lookup. */
export const PREVIEW_QUARTER_TICKS = 960;

const BEAT = PREVIEW_QUARTER_TICKS;
const MAX_PREVIEW_FRET = 22;

/** One scale degree per quarter note so onsets match the selected BPM. */
const SCALE_STEP_BEATS = 1;
const SCALE_HOLD_BEATS = 0.95;

export const PRACTICE_PREVIEW_KEYS = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;

export type PracticePreviewKeyId = (typeof PRACTICE_PREVIEW_KEYS)[number];

export const DEFAULT_PREVIEW_KEY: PracticePreviewKeyId = 'C';

const KEY_PITCH_CLASS: Record<PracticePreviewKeyId, number> = {
  C: 0,
  'C#': 1,
  D: 2,
  'D#': 3,
  E: 4,
  F: 5,
  'F#': 6,
  G: 7,
  'G#': 8,
  A: 9,
  'A#': 10,
  B: 11,
};

export type PracticePreviewScaleId =
  | 'major'
  | 'natural-minor'
  | 'major-pentatonic'
  | 'minor-pentatonic'
  | 'blues'
  | 'dorian'
  | 'mixolydian'
  | 'harmonic-minor'
  | 'melodic-minor'
  | 'phrygian'
  | 'lydian'
  | 'open-major';

export type PracticePreviewScale = {
  id: PracticePreviewScaleId;
  label: string;
  /** Key the stored fret pattern was written for (transposed to user key). */
  referenceKey: PracticePreviewKeyId;
  ascend: ReadonlyArray<readonly [string: number, fret: number]>;
};

export const DEFAULT_PREVIEW_SCALE_ID: PracticePreviewScaleId = 'major';

export const PRACTICE_PREVIEW_SCALES: PracticePreviewScale[] = [
  {
    id: 'major',
    label: 'Major',
    referenceKey: 'C',
    ascend: [
      [6, 3], [6, 5], [6, 7], [5, 3], [5, 5], [5, 7], [4, 2], [4, 4], [4, 5],
      [3, 2], [3, 4], [3, 5], [2, 1], [2, 3], [2, 5], [1, 1], [1, 3], [1, 5], [1, 8],
    ],
  },
  {
    id: 'natural-minor',
    label: 'Natural minor',
    referenceKey: 'A',
    ascend: [
      [6, 5], [6, 7], [6, 8], [5, 5], [5, 7], [5, 8], [4, 5], [4, 7], [4, 9],
      [3, 4], [3, 5], [3, 7], [2, 5], [2, 6], [2, 8], [1, 5], [1, 7], [1, 8], [1, 10],
    ],
  },
  {
    id: 'major-pentatonic',
    label: 'Major pentatonic',
    referenceKey: 'C',
    ascend: [
      [6, 3], [6, 5], [5, 2], [5, 5], [4, 2], [4, 5], [3, 2], [3, 4],
      [2, 0], [2, 3], [1, 0], [1, 3], [1, 5],
    ],
  },
  {
    id: 'minor-pentatonic',
    label: 'Minor pentatonic',
    referenceKey: 'A',
    ascend: [
      [6, 5], [6, 8], [5, 5], [5, 7], [4, 5], [4, 7], [3, 5], [3, 7],
      [2, 5], [2, 8], [1, 5], [1, 8],
    ],
  },
  {
    id: 'blues',
    label: 'Blues',
    referenceKey: 'A',
    ascend: [
      [6, 5], [6, 8], [6, 9], [5, 5], [5, 7], [5, 8], [4, 5], [4, 7], [4, 8],
      [3, 5], [3, 7], [3, 8], [2, 5], [2, 8], [2, 10], [1, 5], [1, 8], [1, 10],
    ],
  },
  {
    id: 'dorian',
    label: 'Dorian',
    referenceKey: 'A',
    ascend: [
      [6, 5], [6, 7], [6, 8], [5, 5], [5, 7], [5, 8], [4, 5], [4, 7], [4, 9],
      [3, 6], [3, 7], [3, 9], [2, 5], [2, 7], [2, 8], [1, 5], [1, 7], [1, 8], [1, 10],
    ],
  },
  {
    id: 'mixolydian',
    label: 'Mixolydian',
    referenceKey: 'G',
    ascend: [
      [6, 3], [6, 5], [5, 0], [5, 2], [5, 3], [4, 0], [4, 2], [4, 4],
      [3, 0], [3, 2], [3, 4], [2, 0], [2, 1], [2, 3], [1, 0], [1, 2], [1, 3],
    ],
  },
  {
    id: 'harmonic-minor',
    label: 'Harmonic minor',
    referenceKey: 'A',
    ascend: [
      [6, 5], [6, 7], [6, 8], [5, 5], [5, 7], [5, 8], [4, 5], [4, 7], [4, 9],
      [3, 4], [3, 5], [3, 7], [2, 5], [2, 6], [2, 9], [1, 5], [1, 7], [1, 8], [1, 11],
    ],
  },
  {
    id: 'melodic-minor',
    label: 'Melodic minor',
    referenceKey: 'A',
    ascend: [
      [6, 5], [6, 7], [6, 8], [5, 5], [5, 7], [5, 8], [4, 5], [4, 7], [4, 9],
      [3, 6], [3, 7], [3, 9], [2, 5], [2, 7], [2, 9], [1, 5], [1, 7], [1, 9], [1, 11],
    ],
  },
  {
    id: 'phrygian',
    label: 'Phrygian',
    referenceKey: 'E',
    ascend: [
      [6, 0], [6, 1], [6, 3], [5, 0], [5, 2], [5, 3], [4, 0], [4, 1], [4, 3],
      [3, 0], [3, 1], [3, 3], [2, 0], [2, 1], [2, 3], [1, 0], [1, 1], [1, 3],
    ],
  },
  {
    id: 'lydian',
    label: 'Lydian',
    referenceKey: 'F',
    ascend: [
      [6, 1], [6, 3], [5, 0], [5, 2], [5, 3], [4, 0], [4, 2], [4, 4],
      [3, 0], [3, 2], [3, 4], [2, 0], [2, 2], [2, 3], [1, 0], [1, 2], [1, 4],
    ],
  },
  {
    id: 'open-major',
    label: 'Open major',
    referenceKey: 'G',
    ascend: [
      [6, 3], [6, 5], [5, 0], [5, 2], [5, 3], [4, 0], [4, 2], [4, 4],
      [3, 0], [3, 2], [3, 4], [2, 0], [2, 1], [2, 3], [1, 0], [1, 2], [1, 3],
    ],
  },
];

export function getPracticePreviewScale(
  id: PracticePreviewScaleId,
): PracticePreviewScale {
  const scale = PRACTICE_PREVIEW_SCALES.find((s) => s.id === id);
  return scale ?? PRACTICE_PREVIEW_SCALES[0];
}

export function previewKeyLabel(key: PracticePreviewKeyId): string {
  return key;
}

export function previewScaleHint(
  scaleId: PracticePreviewScaleId,
  key: PracticePreviewKeyId,
): string {
  const scale = getPracticePreviewScale(scaleId);
  return `${key} ${scale.label.toLowerCase()} up and down`;
}

function semitoneShift(
  fromKey: PracticePreviewKeyId,
  toKey: PracticePreviewKeyId,
): number {
  return KEY_PITCH_CLASS[toKey] - KEY_PITCH_CLASS[fromKey];
}

function transposePosition(
  string: number,
  fret: number,
  semitones: number,
): [string: number, fret: number] {
  const sourceMidi = pitchMidiForFrettedNote(string, fret, PREVIEW_TUNING, 0);
  if (sourceMidi == null) return [string, fret];
  const targetMidi = sourceMidi + semitones;

  const open = openStringMidi(PREVIEW_TUNING, string);
  if (open != null) {
    const sameStringFret = targetMidi - open;
    if (sameStringFret >= 0 && sameStringFret <= MAX_PREVIEW_FRET) {
      return [string, sameStringFret];
    }
  }

  let best: [string, fret] | null = null;
  let bestScore = Infinity;
  for (let s = 1; s <= 6; s++) {
    const stringOpen = openStringMidi(PREVIEW_TUNING, s);
    if (stringOpen == null) continue;
    const candidateFret = targetMidi - stringOpen;
    if (candidateFret < 0 || candidateFret > MAX_PREVIEW_FRET) continue;
    const score = Math.abs(s - string) * 12 + Math.abs(candidateFret - fret);
    if (score < bestScore) {
      bestScore = score;
      best = [s, candidateFret];
    }
  }

  return best ?? [string, Math.max(0, Math.min(MAX_PREVIEW_FRET, fret + semitones))];
}

function transposeAscend(
  ascend: PracticePreviewScale['ascend'],
  fromKey: PracticePreviewKeyId,
  toKey: PracticePreviewKeyId,
): Array<[string: number, fret: number]> {
  if (fromKey === toKey) return ascend.map(([s, f]) => [s, f]);
  const shift = semitoneShift(fromKey, toKey);
  return ascend.map(([string, fret]) => transposePosition(string, fret, shift));
}

type PreviewStep = {
  string: number;
  fret: number;
  beat: number;
  hold?: number;
};

function buildScaleSteps(ascend: Array<[string: number, fret: number]>): PreviewStep[] {
  const down = [...ascend].reverse().slice(1);
  const path = [...ascend, ...down];
  let beat = 0;
  const steps: PreviewStep[] = [];
  for (const [string, fret] of path) {
    steps.push({ string, fret, beat, hold: SCALE_HOLD_BEATS });
    beat += SCALE_STEP_BEATS;
  }
  return steps;
}

function previewNote(
  id: string,
  string: number,
  fret: number,
  startBeat: number,
  durationBeats: number,
): GuitarNoteEvent {
  const startTick = Math.round(startBeat * BEAT);
  const endTick = startTick + Math.round(durationBeats * BEAT);
  return {
    id,
    trackIndex: 0,
    string,
    fret,
    startTick,
    endTick,
    startMs: 0,
    durationMs: 120,
    noteName: fretToNoteName(string, fret, PREVIEW_TUNING, 0),
    capo: 0,
  };
}

function buildPreviewEvents(
  scale: PracticePreviewScale,
  key: PracticePreviewKeyId,
): GuitarNoteEvent[] {
  const ascend = transposeAscend(scale.ascend, scale.referenceKey, key);
  return buildScaleSteps(ascend)
    .map((step, index) =>
      previewNote(
        `${scale.id}-${key}-${index + 1}`,
        step.string,
        step.fret,
        step.beat,
        step.hold ?? SCALE_HOLD_BEATS,
      ),
    )
    .sort((a, b) => a.startTick - b.startTick || a.string - b.string);
}

const previewEventsCache = new Map<string, GuitarNoteEvent[]>();
const cycleTicksCache = new Map<string, number>();

function cacheKey(scaleId: PracticePreviewScaleId, key: PracticePreviewKeyId): string {
  return `${scaleId}@${key}`;
}

function ensurePreviewCache(
  scaleId: PracticePreviewScaleId,
  key: PracticePreviewKeyId,
): void {
  const id = cacheKey(scaleId, key);
  if (previewEventsCache.has(id)) return;
  const scale = getPracticePreviewScale(scaleId);
  const events = buildPreviewEvents(scale, key);
  previewEventsCache.set(id, events);
  const lastEnd = Math.max(...events.map((e) => e.endTick));
  cycleTicksCache.set(id, lastEnd + BEAT * 4);
}

export function buildPreviewEventsForScale(
  scaleId: PracticePreviewScaleId = DEFAULT_PREVIEW_SCALE_ID,
  key: PracticePreviewKeyId = DEFAULT_PREVIEW_KEY,
): GuitarNoteEvent[] {
  ensurePreviewCache(scaleId, key);
  return previewEventsCache.get(cacheKey(scaleId, key))!;
}

export function previewCycleTicksForScale(
  scaleId: PracticePreviewScaleId = DEFAULT_PREVIEW_SCALE_ID,
  key: PracticePreviewKeyId = DEFAULT_PREVIEW_KEY,
): number {
  ensurePreviewCache(scaleId, key);
  return cycleTicksCache.get(cacheKey(scaleId, key))!;
}

/** Default preview events (C major). */
export const PRACTICE_PREVIEW_EVENTS = buildPreviewEventsForScale(
  DEFAULT_PREVIEW_SCALE_ID,
  DEFAULT_PREVIEW_KEY,
);

export const PRACTICE_PREVIEW_CYCLE_TICKS = previewCycleTicksForScale(
  DEFAULT_PREVIEW_SCALE_ID,
  DEFAULT_PREVIEW_KEY,
);

/** Elapsed wall-clock ms → synth tick (same formula as millisToTicks). */
export function previewTickAtElapsedMs(elapsedMs: number, bpm: number): number {
  if (elapsedMs <= 0 || bpm <= 0) return 0;
  return Math.floor((elapsedMs * bpm * PREVIEW_QUARTER_TICKS) / 60_000);
}

export function practicePreviewCycleMs(
  bpm = PREVIEW_BPM_DEFAULT,
  scaleId: PracticePreviewScaleId = DEFAULT_PREVIEW_SCALE_ID,
  key: PracticePreviewKeyId = DEFAULT_PREVIEW_KEY,
): number {
  const beats = previewCycleTicksForScale(scaleId, key) / BEAT;
  return beats * previewMsPerBeat(bpm);
}
