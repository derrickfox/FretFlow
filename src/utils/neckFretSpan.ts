// AI_CHANGE:
// Tool: Cursor
// Model: Composer
// Timestamp: 2026-06-05T22:45:00-04:00
// Purpose: Compute how many frets to show on the neck from the highest note in the song.
// Reason: Most songs stay below fret 24; extra padding is wasted — zoom the used range to full width.

import { MAX_FRET, type GuitarNoteEvent } from '../types/guitar';
import { tabFretToNeckFret } from './stringTuning';

/** Frets shown past the highest played note on the neck. */
export const NECK_FRET_PADDING = 2;

/**
 * Highest fret index to render (inclusive). Nut is 0.
 * Uses neck positions (capo + tab fret). Falls back to MAX_FRET when there are no events.
 */
export function computeDisplayMaxFret(
  events: GuitarNoteEvent[],
  capoFret = 0,
): number {
  let maxUsed = Math.max(0, capoFret);

  for (const event of events) {
    const neckFret = tabFretToNeckFret(event.fret, event.capo);
    if (neckFret > maxUsed) maxUsed = neckFret;
  }

  if (events.length === 0 && capoFret === 0) {
    return MAX_FRET;
  }

  return Math.min(MAX_FRET, maxUsed + NECK_FRET_PADDING);
}

/** 0–1 horizontal position for a neck fret within the visible span. */
export function neckFretToLeftPercent(
  neckFret: number,
  displayMaxFret: number,
  leftHanded: boolean,
): number {
  const span = displayMaxFret + 1;
  const pct = ((neckFret + 0.5) / span) * 100;
  return leftHanded ? 100 - pct : pct;
}
