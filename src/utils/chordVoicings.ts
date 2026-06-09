import type { model } from '@coderline/alphatab';

/** alphaTab chord.strings order: index 0 = highest string, -1 = muted. */
export type ChordVoicing = readonly number[];

// AI_CHANGE:
// Tool: Cursor
// Model: Composer
// Timestamp: 2026-06-05T15:25:00-04:00
// Purpose: Default guitar voicings for chord-only MusicXML lead sheets.
// Reason: iReal Pro exports harmony without tab; FretFlow needs frets to paint the neck.

const VOICINGS: Record<string, ChordVoicing> = {
  Bb7: [-1, 6, 7, 8, 8, 6],
  F7: [-1, 5, 6, 5, 5, 5],
  Bb: [-1, 3, 3, 3, 3, 1],
  F: [-1, 5, 5, 5, 5, 5],
  A7: [-1, 2, 0, 2, 0, 0],
  D7: [-1, 2, 1, 2, 0, -1],
  E7: [0, 2, 0, 1, 0, 0],
  G7: [1, 0, 0, 0, 3, 3],
  C7: [-1, 3, 2, 3, 1, 0],
};

export function normalizeChordName(name: string): string {
  return name
    .replace(/△/g, 'M')
    .replace(/°/g, 'dim')
    .replace(/ø/g, 'm7b5')
    .replace(/♭/g, 'b')
    .replace(/♯/g, '#')
    .replace(/⍉/g, 'm7b5')
    .replace(/\s+/g, '')
    .trim();
}

function voicingFromChordStrings(strings: number[] | undefined): ChordVoicing | null {
  if (!strings?.length) return null;
  if (!strings.some((fret) => fret >= 0)) return null;
  return strings;
}

export function resolveChordVoicing(chord: model.Chord): ChordVoicing | null {
  const fromDiagram = voicingFromChordStrings(chord.strings);
  if (fromDiagram) return fromDiagram;

  const key = normalizeChordName(chord.name);
  return VOICINGS[key] ?? null;
}

/** Map alphaTab high-to-low voicing index to FretFlow string (1 = lowest). */
export function stringNumberForVoicingIndex(voicing: ChordVoicing, index: number): number {
  return voicing.length - index;
}
