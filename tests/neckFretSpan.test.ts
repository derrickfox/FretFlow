import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseGuitarProFile } from '../src/services/guitarProParser';
import type { GuitarNoteEvent } from '../src/types/guitar';
import {
  computeDisplayMaxFret,
  neckFretToLeftPercent,
  NECK_FRET_PADDING,
} from '../src/utils/neckFretSpan';
import { tabFretToNeckFret } from '../src/utils/stringTuning';

function loadBuffer(path: string): ArrayBuffer {
  const buf = readFileSync(path);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

function maxNeckFret(events: GuitarNoteEvent[]): number {
  let max = 0;
  for (const e of events) {
    max = Math.max(max, tabFretToNeckFret(e.fret, e.capo));
  }
  return max;
}

describe('neck fret span', () => {
  it('returns full neck when there are no events', () => {
    expect(computeDisplayMaxFret([], 0)).toBe(24);
  });

  it('adds padding past the highest used neck fret', () => {
    const events: GuitarNoteEvent[] = [
      {
        id: '0',
        trackIndex: 0,
        string: 1,
        fret: 7,
        startTick: 0,
        endTick: 100,
        startMs: 0,
        durationMs: 100,
        capo: 0,
      },
      {
        id: '1',
        trackIndex: 0,
        string: 2,
        fret: 12,
        startTick: 100,
        endTick: 200,
        startMs: 100,
        durationMs: 100,
        capo: 0,
      },
    ];
    expect(computeDisplayMaxFret(events)).toBe(12 + NECK_FRET_PADDING);
  });

  it('includes capo in the visible span', () => {
    const events: GuitarNoteEvent[] = [
      {
        id: '0',
        trackIndex: 0,
        string: 1,
        fret: 2,
        startTick: 0,
        endTick: 100,
        startMs: 0,
        durationMs: 100,
        capo: 5,
      },
    ];
    expect(computeDisplayMaxFret(events, 5)).toBe(tabFretToNeckFret(2, 5) + NECK_FRET_PADDING);
  });

  it('hey-joe guitar track uses a span well below 24 frets', async () => {
    const { result } = await parseGuitarProFile(loadBuffer('public/preloaded/hey-joe.gp'));
    const guitar = result.tracks.find((t) => t.isGuitar);
    const events = result.eventsByTrack.get(guitar!.index) ?? [];
    const displayMax = computeDisplayMaxFret(events, guitar!.capo);
    expect(displayMax).toBeLessThan(24);
    expect(displayMax).toBe(maxNeckFret(events) + NECK_FRET_PADDING);
  });

  it('never-going-back-again respects capo and padding', async () => {
    const { result } = await parseGuitarProFile(
      loadBuffer('public/preloaded/never-going-back-again.gp'),
    );
    const guitar = result.tracks.find((t) => t.isGuitar);
    const events = result.eventsByTrack.get(guitar!.index) ?? [];
    const displayMax = computeDisplayMaxFret(events, guitar!.capo);
    expect(displayMax).toBe(maxNeckFret(events) + NECK_FRET_PADDING);
    expect(displayMax).toBeGreaterThanOrEqual(guitar!.capo + NECK_FRET_PADDING);
  });

  it('maps neck frets across full width of the visible span', () => {
    const displayMax = 10;
    expect(neckFretToLeftPercent(0, displayMax, false)).toBeCloseTo(4.545, 2);
    expect(neckFretToLeftPercent(10, displayMax, false)).toBeCloseTo(95.455, 2);
    expect(neckFretToLeftPercent(5, displayMax, true)).toBeCloseTo(
      100 - neckFretToLeftPercent(5, displayMax, false),
      5,
    );
  });
});
