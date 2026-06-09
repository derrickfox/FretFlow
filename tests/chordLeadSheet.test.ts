import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseGuitarProFile } from '../src/services/guitarProParser';
import { loadScoreFromBytes } from '../src/services/alphatabAdapter';

function loadBuffer(relativePath: string): ArrayBuffer {
  const bytes = readFileSync(resolve(process.cwd(), relativePath));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

describe('chord lead sheet', () => {
  it('inspects Come On In My Kitchen harmony beats', async () => {
    const buffer = loadBuffer('public/preloaded/come-on-in-my-kitchen.musicxml');
    const { score, tickLookup } = loadScoreFromBytes(new Uint8Array(buffer));
    const track = score.tracks[0];
    let chordBeats = 0;
    let chordsWithFrets = 0;
    const names = new Set<string>();
    for (const staff of track.staves) {
      for (const bar of staff.bars) {
        for (const voice of bar.voices) {
          for (const beat of voice.beats) {
            const chord = beat.chord;
            if (!chord) continue;
            chordBeats++;
            names.add(chord.name);
            if (chord.strings?.some((f) => f >= 0)) chordsWithFrets++;
          }
        }
      }
    }
    expect(chordBeats).toBeGreaterThan(0);
    expect(chordsWithFrets).toBe(0);
    expect([...names]).toEqual(expect.arrayContaining(['Bb7', 'F7']));
    expect(tickLookup.masterBars.length).toBeGreaterThan(0);

    const { result } = await parseGuitarProFile(buffer);
    const parsedTrack = result.tracks[0];
    const events = result.eventsByTrack.get(0) ?? [];
    expect(parsedTrack.isChordSheet).toBe(true);
    expect(parsedTrack.isGuitar).toBe(true);
    expect(events.length).toBeGreaterThan(0);
    expect(events.some((e) => e.noteName === 'Bb7')).toBe(true);
    expect(events.some((e) => e.noteName === 'F7')).toBe(true);
  });
});
