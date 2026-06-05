// AI_CHANGE:
// Tool: Cursor
// Model: Composer
// Timestamp: 2026-06-05T00:25:00-04:00
// Purpose: Merge same-fret notes from multiple guitar tracks into one neck dot.
// Reason: Overlapping dots with offset were cluttered; blended hue shows both tracks at once.

import type { GuitarNoteEvent } from '../types/guitar';
import type { NoteBendInfo } from './bendDisplay';
import type { ClassifiedNote, NoteVisualState } from './noteHelpers';

/** Live cues vs fading linger are merged separately so both can show at one fret. */
export type NeckDotLayer = 'live' | 'linger';

export type MergedNeckDot = {
  id: string;
  string: number;
  fret: number;
  layer: NeckDotLayer;
  state: NoteVisualState;
  intensity: number;
  approachBlend: number;
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

// AI_CHANGE:
// Tool: Cursor
// Model: Composer
// Timestamp: 2026-06-05T15:00:00-04:00
// Purpose: Merge live and linger dots separately at each string/fret.
// Reason: Active notes were replacing just-played linger and inheriting playing-color borders.
const LIVE_STATE_RANK: Record<'active' | 'upcoming', number> = {
  active: 2,
  upcoming: 1,
};

const LINGER_STATE_RANK: Record<'smolder' | 'full', number> = {
  smolder: 2,
  full: 1,
};

function neckDotLayer(state: NoteVisualState): NeckDotLayer {
  return state === 'smolder' || state === 'full' ? 'linger' : 'live';
}

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
    const { state, intensity, approachBlend = 0 } = classified;
    const layer = neckDotLayer(state);
    const key = `${note.string}-${note.fret}-${layer}`;
    const existing = byFret.get(key);

    if (!existing) {
      byFret.set(key, {
        id: key,
        string: note.string,
        fret: note.fret,
        layer,
        state,
        intensity,
        approachBlend,
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

    const shouldReplace =
      layer === 'live'
        ? LIVE_STATE_RANK[state as 'active' | 'upcoming'] >
          LIVE_STATE_RANK[existing.state as 'active' | 'upcoming']
        : LINGER_STATE_RANK[state as 'smolder' | 'full'] >
          LINGER_STATE_RANK[existing.state as 'smolder' | 'full'];

    if (shouldReplace) {
      existing.state = state;
      existing.intensity = intensity;
      existing.approachBlend = approachBlend;
      existing.startTick = note.startTick;
      existing.endTick = note.endTick;
      existing.capo = note.capo;
      if (note.bend) existing.bend = note.bend;
    } else if (state === existing.state) {
      existing.intensity = Math.max(existing.intensity, intensity);
      existing.approachBlend = Math.max(existing.approachBlend, approachBlend);
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
