// AI_CHANGE:
// Tool: Cursor
// Model: Composer
// Timestamp: 2026-06-05T00:25:00-04:00
// Purpose: Merge same-fret notes from multiple guitar tracks into one neck dot.
// Reason: Overlapping dots with offset were cluttered; blended hue shows both tracks at once.

import type { GuitarNoteEvent } from '../types/guitar';
import type { NoteBendInfo } from './bendDisplay';
import type { ClassifiedNote, NoteVisualState } from './noteHelpers';

export type MergedNeckDot = {
  id: string;
  string: number;
  fret: number;
  state: NoteVisualState;
  intensity: number;
  trackIndices: number[];
  label?: string;
  bend?: NoteBendInfo;
  startTick: number;
  endTick: number;
  capo: number;
};

function mergeBend(a?: NoteBendInfo, b?: NoteBendInfo): NoteBendInfo | undefined {
  if (!a) return b;
  if (!b) return a;
  return a.peakSemitones >= b.peakSemitones ? a : b;
}

const STATE_RANK: Record<NoteVisualState, number> = {
  active: 5,
  upcoming: 4,
  smolder: 3,
  full: 2,
  past: 1,
};

/**
 * Collapse multiple track events at the same string/fret into one dot
 * (colors are blended separately in trackColors).
 */
export function mergeNotesAtSameFret(
  items: { note: GuitarNoteEvent; classified: ClassifiedNote }[],
  showNoteNames: boolean,
): MergedNeckDot[] {
  const byFret = new Map<string, MergedNeckDot>();

  for (const { note, classified } of items) {
    const { state, intensity } = classified;
    const key = `${note.string}-${note.fret}`;
    const existing = byFret.get(key);

    if (!existing) {
      byFret.set(key, {
        id: key,
        string: note.string,
        fret: note.fret,
        state,
        intensity,
        trackIndices: [note.trackIndex],
        label: showNoteNames ? note.noteName : undefined,
        bend: note.bend,
        startTick: note.startTick,
        endTick: note.endTick,
        capo: note.capo,
      });
      continue;
    }

    if (!existing.trackIndices.includes(note.trackIndex)) {
      existing.trackIndices.push(note.trackIndex);
    }
    if (STATE_RANK[state] > STATE_RANK[existing.state]) {
      existing.state = state;
      existing.intensity = intensity;
      existing.startTick = note.startTick;
      existing.endTick = note.endTick;
      existing.capo = note.capo;
      if (note.bend) existing.bend = note.bend;
    } else if (state === existing.state) {
      existing.intensity = Math.max(existing.intensity, intensity);
    }
    if (showNoteNames && note.noteName) {
      const names = new Set((existing.label ?? '').split(' · ').filter(Boolean));
      names.add(note.noteName);
      existing.label = [...names].join(' · ');
    }
    existing.bend = mergeBend(existing.bend, note.bend);
  }

  return [...byFret.values()];
}
