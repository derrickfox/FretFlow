import type { model } from '@coderline/alphatab';

// AI_CHANGE:
// Tool: Cursor
// Model: Composer
// Timestamp: 2026-06-04T23:45:00-04:00
// Purpose: Classify GP tracks as guitar, bass, percussion, or other for tab vs fretboard.
// Reason: Tab notation should show guitar staves only; bass/vocals/drums stay in track list with labels.

/** How we classify a score track for fretboard vs tab display. */
export type TrackKind = 'guitar' | 'bass' | 'percussion' | 'other';

/** GM programs commonly used for guitar (24–31). */
const GUITAR_MIDI_PROGRAMS = new Set([24, 25, 26, 27, 28, 29, 30, 31]);

/** GM programs for bass (32–39). */
const BASS_MIDI_PROGRAMS = new Set([32, 33, 34, 35, 36, 37, 38, 39]);

function trackName(track: model.Track): string {
  return `${track.name} ${track.shortName}`.toLowerCase();
}

function isBassName(name: string): boolean {
  if (/bass\s+guitar|guitar\s+bass/.test(name)) return false;
  return /\bbass\b|contrabass|double bass/.test(name);
}

function isGuitarName(name: string): boolean {
  if (isBassName(name)) return false;
  return /guitar|gtr|acoustic|electric|classical|nylon|steel|slide/.test(name);
}

function isVocalOrNonTabName(name: string): boolean {
  return /vocal|voice|lyric|sing|choir|harmonica|piano|keyboard|synth|drum|percussion|strings|violin|cello|flute|sax|trumpet|organ/.test(
    name,
  );
}

/** Open-string MIDI of lowest string — bass tunings sit roughly ≤ 35. */
function lowestOpenStringMidi(track: model.Track): number | undefined {
  const tuning = track.staves[0]?.tuning;
  if (!tuning?.length) return undefined;
  return Math.min(...tuning);
}

/**
 * Classifies a Guitar Pro track using MIDI program, string count/tuning, and name.
 * Vocals on a 6-string staff are "other", not guitar. Bass is separate from guitar.
 */
export function classifyTrackKind(track: model.Track): TrackKind {
  if (track.isPercussion) return 'percussion';

  const name = trackName(track);
  const staff = track.staves[0];
  const program = track.playbackInfo?.program ?? -1;
  const stringCount = staff?.tuning?.length ?? 0;
  const lowest = lowestOpenStringMidi(track);

  // AI_CHANGE:
  // Tool: Cursor
  // Model: Composer
  // Timestamp: 2026-06-05T15:05:00-04:00
  // Purpose: Classify MusicXML guitar parts before the isStringed gate.
  // Reason: MusicXML imports often omit staff tuning while still carrying tablature.
  if (isGuitarName(name) && GUITAR_MIDI_PROGRAMS.has(program)) return 'guitar';
  if (isBassName(name) || BASS_MIDI_PROGRAMS.has(program)) return 'bass';
  if (stringCount > 0 && stringCount <= 5 && lowest != null && lowest <= 35) return 'bass';

  if (!staff?.isStringed || stringCount < 4) return 'other';

  if (isVocalOrNonTabName(name) && !isGuitarName(name)) return 'other';

  if (GUITAR_MIDI_PROGRAMS.has(program) && stringCount >= 6) return 'guitar';
  if (isGuitarName(name) && stringCount >= 6) return 'guitar';

  // Fretted 6-string staff with generic program — still guitar-like for GP exports
  if (stringCount >= 6 && !isVocalOrNonTabName(name)) {
    return 'guitar';
  }

  if (/ukulele|banjo|mandolin/.test(name) && stringCount >= 4) return 'guitar';

  return 'other';
}

export function isGuitarTrackKind(kind: TrackKind): boolean {
  return kind === 'guitar';
}

export function isBassTrackKind(kind: TrackKind): boolean {
  return kind === 'bass';
}

/** @deprecated Use track.kind — true for guitar only (excludes bass). */
export function isGuitarLikeKind(kind: TrackKind): boolean {
  return kind === 'guitar' || kind === 'bass';
}
