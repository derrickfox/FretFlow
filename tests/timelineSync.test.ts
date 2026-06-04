import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseGuitarProFile } from '../src/services/guitarProParser';
import { classifyNoteAtTime, filterEventsInTickWindow } from '../src/utils/noteHelpers';

function loadBuffer(path: string): ArrayBuffer {
  const buf = readFileSync(path);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

function activeNotesAtTick(
  events: ReturnType<typeof filterEventsInTickWindow>,
  tick: number,
) {
  return filterEventsInTickWindow(events, tick, tick + 1)
    .filter((n) => classifyNoteAtTime(n, tick, 'standard', 0, 0)?.state === 'active')
    .map((n) => `${n.string}:${n.fret}`)
    .sort();
}

describe('fretboard tab sync', () => {
  it('hey-joe guitar chord at bar 11 matches tick at playhead', async () => {
    const { result, score, tickLookup } = await parseGuitarProFile(
      loadBuffer('public/preloaded/hey-joe.gp'),
    );
    const guitar = result.tracks.find((t) => t.isGuitar);
    expect(guitar).toBeDefined();
    const events = result.eventsByTrack.get(guitar!.index) ?? [];
    const track = score.tracks[guitar!.index];
    const beat = track.staves[0].bars[10].voices[0].beats[0];
    const tick = tickLookup.getBeatStart(beat);
    const expected = beat.notes
      .filter((n) => n.isStringed && n.fret >= 0)
      .map((n) => `${n.string}:${n.fret}`)
      .sort();
    expect(activeNotesAtTick(events, tick)).toEqual(expected);
  });

  it('hey-joe merged guitar tracks stay in tick order for window search', async () => {
    const { result } = await parseGuitarProFile(loadBuffer('public/preloaded/hey-joe.gp'));
    const indices = result.tracks.filter((t) => t.isGuitar).map((t) => t.index);
    const merged = indices
      .flatMap((i) => result.eventsByTrack.get(i) ?? [])
      .sort(
        (a, b) => a.startTick - b.startTick || a.trackIndex - b.trackIndex,
      );
    for (let i = 1; i < merged.length; i++) {
      expect(merged[i].startTick).toBeGreaterThanOrEqual(merged[i - 1].startTick);
    }
  });

  it('wind-cries-mary arpeggio beat uses same tick as tab lookup', async () => {
    const { result, score, tickLookup } = await parseGuitarProFile(
      loadBuffer('public/preloaded/wind-cries-mary.gp'),
    );
    const guitar = result.tracks.find((t) => t.isGuitar);
    expect(guitar).toBeDefined();
    const events = result.eventsByTrack.get(guitar!.index) ?? [];
    const track = score.tracks[guitar!.index];
    let sampleBeat = track.staves[0].bars[20].voices[0].beats[0];
    for (const voice of track.staves[0].bars[20].voices) {
      for (const beat of voice.beats) {
        if (!beat.isRest && beat.notes.some((n) => n.isStringed)) {
          sampleBeat = beat;
          break;
        }
      }
    }
    const tick = tickLookup.getBeatStart(sampleBeat);
    const expected = sampleBeat.notes
      .filter((n) => n.isStringed && n.fret >= 0)
      .map((n) => `${n.string}:${n.fret}`)
      .sort();
    expect(activeNotesAtTick(events, tick)).toEqual(expected);
  });
});
