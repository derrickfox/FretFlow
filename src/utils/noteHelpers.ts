// AI_CHANGE:
// Tool: Cursor
// Model: Composer
// Timestamp: 2026-06-05T00:10:00-04:00
// Purpose: Note time window driven by practice lookahead/linger sliders instead of fixed constants.
// Reason: User-adjustable sliders control how far ahead notes preview and how long they stay after playing.

import type { GuitarNoteEvent } from '../types/guitar';

/** Open-string MIDI (alphaTab string 1 = low E … 6 = high E). */
const STANDARD_OPEN_MIDI: Record<number, number> = {
  1: 40,
  2: 45,
  3: 50,
  4: 55,
  5: 59,
  6: 64,
};

/**
 * Maps alphaTab string + fret to a note name using staff tuning (MIDI real value).
 * Falls back to standard 6-string tuning when tuning is unavailable.
 */
export function fretToNoteName(
  stringIndex: number,
  fret: number,
  tuningMidi?: number[],
): string | undefined {
  let midi: number | undefined;

  if (tuningMidi && stringIndex >= 1 && stringIndex <= tuningMidi.length) {
    midi = tuningMidi[stringIndex - 1] + fret;
  } else {
    midi = STANDARD_OPEN_MIDI[stringIndex];
    if (midi !== undefined) midi += fret;
  }

  if (midi === undefined) return undefined;
  return midiToName(midi);
}

function midiToName(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  return `${names[((midi % 12) + 12) % 12]}${octave}`;
}

/** Visual row index 0 = top string on neck (high E), 5 = low E — matches tab bottom-to-top flip. */
export function stringToVisualRow(stringIndex: number, stringCount = 6): number {
  return stringCount - stringIndex;
}

export function visualRowToString(row: number, stringCount = 6): number {
  return stringCount - row;
}

export type NoteVisualState = 'active' | 'upcoming' | 'past' | 'full';

export function classifyNoteAtTime(
  note: GuitarNoteEvent,
  currentMs: number,
  mode: 'live' | 'full',
  lookaheadMs: number,
  lingerMs: number,
): NoteVisualState | null {
  const end = note.startMs + note.durationMs;
  const ahead = Math.max(0, lookaheadMs);
  const linger = Math.max(0, lingerMs);
  const windowStart = currentMs - linger;

  if (mode === 'full') {
    const windowEnd = currentMs + ahead;
    if (note.startMs > windowEnd) return null;
    if (end < windowStart) return null;
    if (currentMs >= note.startMs && currentMs < end) return 'active';
    if (note.startMs > currentMs) return 'upcoming';
    return 'full';
  }

  if (currentMs >= note.startMs && currentMs < end) return 'active';
  if (note.startMs > currentMs && note.startMs <= currentMs + ahead) {
    return 'upcoming';
  }
  if (end <= currentMs && end >= windowStart) return 'full';
  // At rest (start of song), preview the opening phrase so the neck is not empty
  if (currentMs < 80 && note.startMs <= ahead) {
    return 'upcoming';
  }
  return null;
}

/** Events must be sorted by startMs. Returns notes that overlap [windowStart, windowEnd]. */
export function filterEventsInTimeWindow(
  events: GuitarNoteEvent[],
  windowStart: number,
  windowEnd: number,
): GuitarNoteEvent[] {
  if (events.length === 0) return [];

  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid].startMs + events[mid].durationMs < windowStart) lo = mid + 1;
    else hi = mid;
  }

  const result: GuitarNoteEvent[] = [];
  for (let i = lo; i < events.length; i++) {
    const note = events[i];
    if (note.startMs > windowEnd) break;
    if (note.startMs + note.durationMs >= windowStart) result.push(note);
  }
  return result;
}

export function getPlaybackTimeWindow(
  currentMs: number,
  lookaheadMs: number,
  lingerMs: number,
): { start: number; end: number } {
  const ahead = Math.max(0, lookaheadMs);
  const linger = Math.max(0, lingerMs);
  return {
    start: currentMs - linger,
    end: currentMs + ahead,
  };
}

export function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export const GP_EXTENSIONS = [
  '.gp',
  '.gp3',
  '.gp4',
  '.gp5',
  '.gpx',
  '.gp7',
] as const;

export function isValidGpExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  return GP_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
