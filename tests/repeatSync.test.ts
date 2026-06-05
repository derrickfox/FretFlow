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

/** First master-bar lookup occurrence for a bar index (canonical first pass). */
function firstPassTickForBeat(
  tickLookup: Awaited<ReturnType<typeof parseGuitarProFile>>['tickLookup'],
  beat: { id: number; voice: { bar: { index: number } } },
): number {
  return tickLookup.getBeatStart(beat as never);
}

/** Playback tick for the Nth expanded occurrence of a master bar (0 = first pass). */
function expandedBarStartTick(
  tickLookup: Awaited<ReturnType<typeof parseGuitarProFile>>['tickLookup'],
  barIndex: number,
  occurrence: number,
): number {
  let seen = 0;
  for (const mb of tickLookup.masterBars) {
    if (mb.masterBar.index !== barIndex) continue;
    if (seen === occurrence) return mb.start;
    seen++;
  }
  throw new Error(`bar ${barIndex} occurrence ${occurrence} not found`);
}

describe('repeat playback sync', () => {
  it('never-going-back-again events cover expanded timeline past first repeat', async () => {
    const { result, score, tickLookup } = await parseGuitarProFile(
      loadBuffer('public/preloaded/never-going-back-again.gp'),
    );
    const guitar = result.tracks.find((t) => t.isGuitar);
    expect(guitar).toBeDefined();
    const events = result.eventsByTrack.get(guitar!.index) ?? [];
    const track = score.tracks[guitar!.index];

    const repeatBarIndex = score.masterBars.findIndex((mb) => mb.isRepeatStart);
    expect(repeatBarIndex).toBeGreaterThanOrEqual(0);

    const repeatBeat = track.staves[0].bars[repeatBarIndex].voices[0].beats.find(
      (b) => !b.isRest && b.notes.some((n) => n.isStringed && n.fret >= 0),
    );
    expect(repeatBeat).toBeDefined();

    const firstTick = firstPassTickForBeat(tickLookup, repeatBeat!);
    const secondPassTick =
      expandedBarStartTick(tickLookup, repeatBarIndex, 1) +
      (firstTick - expandedBarStartTick(tickLookup, repeatBarIndex, 0));

    const expected = repeatBeat!.notes
      .filter((n) => n.isStringed && n.fret >= 0)
      .map((n) => `${n.string}:${n.fret}`)
      .sort();

    expect(activeNotesAtTick(events, firstTick)).toEqual(expected);
    expect(activeNotesAtTick(events, secondPassTick)).toEqual(expected);

    const maxEventEnd = Math.max(...events.map((e) => e.endTick));
    const maxLookupEnd = Math.max(...tickLookup.masterBars.map((m) => m.end));
    expect(maxEventEnd).toBeGreaterThanOrEqual(maxLookupEnd - 960);
  });

  it('hey-joe first-pass ticks still match after expanded extraction', async () => {
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
});
