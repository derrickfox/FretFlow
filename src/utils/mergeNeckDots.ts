// AI_CHANGE:
// Tool: Cursor
// Model: Composer
// Timestamp: 2026-06-05T00:25:00-04:00
// Purpose: Merge same-fret notes from multiple guitar tracks into one neck dot.
// Reason: Overlapping dots with offset were cluttered; blended hue shows both tracks at once.

import type { GuitarNoteEvent } from '../types/guitar';
import type { NoteVisualState } from './noteHelpers';

export type MergedNeckDot = {
  id: string;
  string: number;
  fret: number;
  state: NoteVisualState;
  trackIndices: number[];
  label?: string;
};

const STATE_RANK: Record<NoteVisualState, number> = {
  active: 4,
  upcoming: 3,
  full: 2,
  past: 1,
};

/**
 * Collapse multiple track events at the same string/fret into one dot
 * (colors are blended separately in trackColors).
 */
export function mergeNotesAtSameFret(
  items: { note: GuitarNoteEvent; state: NoteVisualState }[],
  showNoteNames: boolean,
): MergedNeckDot[] {
  const byFret = new Map<string, MergedNeckDot>();

  for (const { note, state } of items) {
    const key = `${note.string}-${note.fret}`;
    const existing = byFret.get(key);

    if (!existing) {
      byFret.set(key, {
        id: key,
        string: note.string,
        fret: note.fret,
        state,
        trackIndices: [note.trackIndex],
        label: showNoteNames ? note.noteName : undefined,
      });
      continue;
    }

    if (!existing.trackIndices.includes(note.trackIndex)) {
      existing.trackIndices.push(note.trackIndex);
    }
    if (STATE_RANK[state] > STATE_RANK[existing.state]) {
      existing.state = state;
    }
    if (showNoteNames && note.noteName) {
      const names = new Set((existing.label ?? '').split(' · ').filter(Boolean));
      names.add(note.noteName);
      existing.label = [...names].join(' · ');
    }
  }

  return [...byFret.values()];
}
