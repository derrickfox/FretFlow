import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseGuitarProFile } from '../src/services/guitarProParser';
import {
  classifyNoteAtTime,
  extendWindowForSongStart,
  filterEventsInTickWindow,
  getPlaybackTickWindow,
  millisToTicks,
} from '../src/utils/noteHelpers';
import type { GuitarNoteEvent } from '../src/types/guitar';

function loadBuffer(path: string): ArrayBuffer {
  const buf = readFileSync(path);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

function mergeTracks(eventsByTrack: Map<number, GuitarNoteEvent[]>, indices: number[]) {
  const merged = indices.flatMap((i) => eventsByTrack.get(i) ?? []);
  merged.sort(
    (a, b) => a.startTick - b.startTick || a.trackIndex - b.trackIndex || a.string - b.string,
  );
  return merged;
}

describe('fretboard window at song start', () => {
  it('hey-joe shows opening dots at tick 0 with score tempo', async () => {
    const { result } = await parseGuitarProFile(loadBuffer('public/preloaded/hey-joe.gp'));
    const guitarIndices = result.tracks.filter((t) => t.isGuitar).map((t) => t.index);
    const events = mergeTracks(result.eventsByTrack, guitarIndices);
    const tempo = result.metadata.tempo ?? 120;
    const ahead = millisToTicks(4000, tempo);
    const linger = millisToTicks(3500, tempo);
    const base = getPlaybackTickWindow(0, tempo, 'standard', 4000, 3500);
    const { start, end } = extendWindowForSongStart(base, 0, events[0]?.startTick, ahead);
    const windowed = filterEventsInTickWindow(events, start, end);
    expect(events[0]?.startTick).toBeDefined();
    expect(end).toBeGreaterThan(events[0]!.startTick);
    expect(windowed.length).toBeGreaterThan(0);
    const visible = windowed.filter(
      (n) => classifyNoteAtTime(n, 0, 'standard', ahead, linger) !== null,
    );
    expect(visible.length).toBeGreaterThan(0);
  });

  it('extends window when player reports tick 1 before first note', () => {
    const tempo = 84;
    const ahead = millisToTicks(4000, tempo);
    const base = getPlaybackTickWindow(1, tempo, 'standard', 4000, 3500);
    const extended = extendWindowForSongStart(base, 1, 5760, ahead);
    expect(extended.end).toBeGreaterThan(5760);
  });

  it('ms sort breaks tick order on multi-track merge', async () => {
    const { result } = await parseGuitarProFile(loadBuffer('public/preloaded/hey-joe.gp'));
    const guitarIndices = result.tracks.filter((t) => t.isGuitar).map((t) => t.index);
    const byMs = guitarIndices
      .flatMap((i) => result.eventsByTrack.get(i) ?? [])
      .sort((a, b) => a.startMs - b.startMs);
    let outOfOrder = 0;
    for (let i = 1; i < byMs.length; i++) {
      if (byMs[i].startTick < byMs[i - 1].startTick) outOfOrder++;
    }
    expect(outOfOrder).toBeGreaterThan(0);
  });
});
