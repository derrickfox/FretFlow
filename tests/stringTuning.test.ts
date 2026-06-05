import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseGuitarProFile } from '../src/services/guitarProParser';
import {
  isStandardTuning,
  neckStringLabels,
  pitchMidiForFrettedNote,
  tabFretToNeckFret,
} from '../src/utils/stringTuning';

function loadBuffer(path: string): ArrayBuffer {
  const buf = readFileSync(path);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

describe('string tuning and capo', () => {
  it('maps tab frets to absolute neck positions with capo', () => {
    expect(tabFretToNeckFret(0, 6)).toBe(6);
    expect(tabFretToNeckFret(3, 7)).toBe(10);
  });

  it('computes pitch with capo and open tuning', () => {
    const tuning = [64, 59, 55, 50, 43, 36];
    expect(pitchMidiForFrettedNote(1, 0, tuning, 6)).toBe(42);
    expect(isStandardTuning([64, 59, 55, 50, 45, 40])).toBe(true);
    expect(isStandardTuning(tuning)).toBe(false);
    expect(neckStringLabels(tuning, 6)[5]).toBe('C2');
  });

  it('never-going-back-again has capo 6 and non-standard tuning', async () => {
    const { result } = await parseGuitarProFile(
      loadBuffer('public/preloaded/never-going-back-again.gp'),
    );
    const guitar = result.tracks.find((t) => t.isGuitar);
    expect(guitar?.capo).toBe(6);
    expect(isStandardTuning(guitar!.tuningMidi)).toBe(false);
    const events = result.eventsByTrack.get(guitar!.index) ?? [];
    expect(events[0]?.capo).toBe(6);
  });

  it('hotel-california-solo capo offsets events on the neck', async () => {
    const { result } = await parseGuitarProFile(
      loadBuffer('public/preloaded/hotel-california-solo.gp'),
    );
    const guitar = result.tracks.find((t) => t.isGuitar && t.capo > 0);
    expect(guitar?.capo).toBe(7);
    const events = result.eventsByTrack.get(guitar!.index) ?? [];
    const sample = events.find((e) => e.fret > 0);
    expect(sample).toBeDefined();
    expect(tabFretToNeckFret(sample!.fret, sample!.capo)).toBeGreaterThan(sample!.capo);
  });
});
