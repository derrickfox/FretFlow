import { describe, expect, it } from 'vitest';
import {
  buildPreviewEventsForScale,
  PRACTICE_PREVIEW_CYCLE_TICKS,
  PRACTICE_PREVIEW_EVENTS,
  PRACTICE_PREVIEW_SCALES,
  PREVIEW_BPM_DEFAULT,
  PREVIEW_BPM_LIBRARY_MAX,
  PREVIEW_BPM_MAX,
  PREVIEW_BPM_MIN,
  PREVIEW_QUARTER_TICKS,
  practicePreviewCycleMs,
  previewMsPerBeat,
  previewTickAtElapsedMs,
} from '../src/data/practicePreviewNotes';
import { classifyNoteAtTime, millisToTicks } from '../src/utils/noteHelpers';
import { pitchMidiForFrettedNote } from '../src/utils/stringTuning';

const PREVIEW_TUNING = [64, 59, 55, 50, 45, 40];

describe('practice preview notes', () => {
  it('runs an up-then-down C major scale with many single-note onsets', () => {
    expect(PRACTICE_PREVIEW_EVENTS.length).toBeGreaterThanOrEqual(30);
    const uniqueStarts = new Set(PRACTICE_PREVIEW_EVENTS.map((e) => e.startTick));
    expect(uniqueStarts.size).toBeGreaterThanOrEqual(30);

    const ordered = [...PRACTICE_PREVIEW_EVENTS].sort(
      (a, b) => a.startTick - b.startTick || a.string - b.string,
    );
    const peakIndex = ordered.findIndex((e) => e.fret === 8 && e.string === 1);
    expect(peakIndex).toBeGreaterThan(10);
    const beforePeak = ordered.slice(0, peakIndex + 1);
    const afterPeak = ordered.slice(peakIndex + 1);
    expect(beforePeak[beforePeak.length - 1].fret).toBe(8);
    expect(afterPeak[0].fret).toBeLessThan(8);
  });

  it('preview tick clock matches millisToTicks (same as live playback)', () => {
    for (const bpm of [80, 120, 172]) {
      const quarterMs = previewMsPerBeat(bpm);
      expect(previewTickAtElapsedMs(quarterMs, bpm)).toBe(PREVIEW_QUARTER_TICKS);
      expect(previewTickAtElapsedMs(quarterMs, bpm)).toBe(millisToTicks(quarterMs, bpm));
    }
  });

  it('spaces scale onsets one quarter note apart at any BPM', () => {
    const starts = [...new Set(PRACTICE_PREVIEW_EVENTS.map((e) => e.startTick))].sort(
      (a, b) => a - b,
    );
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i] - starts[i - 1]).toBe(PREVIEW_QUARTER_TICKS);
    }
    const bpm = 172;
    const onsetMs = previewMsPerBeat(bpm);
    expect(onsetMs).toBeCloseTo(348.8, 0);
  });

  it('maps preview BPM to wall-clock loop duration', () => {
    expect(PREVIEW_BPM_MAX).toBe(PREVIEW_BPM_LIBRARY_MAX);
    expect(PREVIEW_BPM_MIN).toBeLessThan(PREVIEW_BPM_DEFAULT);
    const slow = practicePreviewCycleMs(PREVIEW_BPM_MIN);
    const fast = practicePreviewCycleMs(PREVIEW_BPM_MAX);
    expect(slow).toBeGreaterThan(fast);
    expect(PRACTICE_PREVIEW_CYCLE_TICKS).toBeGreaterThan(960 * 35);
  });

  it('builds a loop for every preview scale option', () => {
    for (const scale of PRACTICE_PREVIEW_SCALES) {
      const events = buildPreviewEventsForScale(scale.id, scale.referenceKey);
      expect(events.length).toBeGreaterThanOrEqual(10);
      const uniqueStarts = new Set(events.map((e) => e.startTick));
      expect(uniqueStarts.size).toBe(events.length);
    }
  });

  it('transposes major scale up two semitones for D', () => {
    const c = buildPreviewEventsForScale('major', 'C');
    const d = buildPreviewEventsForScale('major', 'D');
    expect(c.length).toBe(d.length);
    const cFirst = c[0]!;
    const dFirst = d[0]!;
    expect(dFirst.fret - cFirst.fret).toBe(2);
  });

  it('preserves pitch classes when changing preview key', () => {
    const cEvents = buildPreviewEventsForScale('major', 'C');
    const gEvents = buildPreviewEventsForScale('major', 'G');
    const cPitch = pitchMidiForFrettedNote(
      cEvents[0]!.string,
      cEvents[0]!.fret,
      PREVIEW_TUNING,
      0,
    )! % 12;
    const gPitch = pitchMidiForFrettedNote(
      gEvents[0]!.string,
      gEvents[0]!.fret,
      PREVIEW_TUNING,
      0,
    )! % 12;
    expect((gPitch - cPitch + 12) % 12).toBe(7);
  });

  it('shows visible dots mid-scale with default practice window', () => {
    const tick = 960 * 12;
    const ahead = millisToTicks(600, PREVIEW_BPM_DEFAULT);
    const linger = millisToTicks(200, PREVIEW_BPM_DEFAULT);
    const visible = PRACTICE_PREVIEW_EVENTS.filter(
      (n) => classifyNoteAtTime(n, tick, 'trails', ahead, linger) != null,
    );
    expect(visible.length).toBeGreaterThanOrEqual(1);
  });
});
