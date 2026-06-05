// AI_CHANGE:
// Tool: Cursor
// Model: Composer
// Timestamp: 2026-06-05T17:05:00-04:00
// Purpose: Tick-based fretboard timing; extendWindowForSongStart; classify uses filter window only.
// Reason: Ms/tick drift vs tab; tick 1 before play skipped preview; `ahead` typo broke Live mode.
// Timestamp: 2026-06-05T18:00:00-04:00
// Purpose: Standard vs Trails display modes with intensity ramp and smolder fade.
// Reason: Trails needs progressive upcoming glow and orangy-red decay after notes play.

import type { DisplayMode, GuitarNoteEvent } from '../types/guitar';
import { upcomingApproachBlend } from './noteColors';
import { midiToShortName, pitchMidiForFrettedNote } from './stringTuning';

const QUARTER_TICKS = 960;

export function millisToTicks(ms: number, tempoBpm: number): number {
  if (ms <= 0 || tempoBpm <= 0) return 0;
  return Math.round((ms * tempoBpm * QUARTER_TICKS) / 60_000);
}

export function fretToNoteName(
  stringIndex: number,
  tabFret: number,
  tuningTopToBottom?: number[],
  capo = 0,
): string | undefined {
  const tuning = tuningTopToBottom?.length
    ? tuningTopToBottom
    : [64, 59, 55, 50, 45, 40];
  const pitch = pitchMidiForFrettedNote(stringIndex, tabFret, tuning, capo);
  return pitch != null ? midiToShortName(pitch) : undefined;
}

/** Visual row index 0 = top string on neck (high E), 5 = low E — matches tab bottom-to-top flip. */
export function stringToVisualRow(stringIndex: number, stringCount = 6): number {
  return stringCount - stringIndex;
}

export function visualRowToString(row: number, stringCount = 6): number {
  return stringCount - row;
}

export type NoteVisualState = 'active' | 'upcoming' | 'past' | 'full' | 'smolder';

export type ClassifiedNote = {
  state: NoteVisualState;
  /** 0–1 strength for Trails ramp / smolder (1 = full brightness at cue or just played). */
  intensity: number;
  /** 0–1 blend from upcoming color → active color as the cue nears. */
  approachBlend?: number;
};

/** Trails upcoming ramp: peak brightness and how much of the ahead window glows. */
export type TrailsGlowSettings = {
  /** 0–1 brightness at the moment the note is played */
  peakGlow: number;
  /** 0–1 share of lookahead window where upcoming dots ramp in */
  glowLeadRatio: number;
};

const TRAILS_FLOOR_GLOW = 0.08;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function trailsGlowFromPractice(
  peakPercent: number,
  leadPercent: number,
): TrailsGlowSettings {
  return {
    peakGlow: clamp01(peakPercent / 100),
    glowLeadRatio: clamp01(leadPercent / 100),
  };
}

/** Upcoming Trails intensity; null if outside the glow-lead zone. */
function trailsUpcomingIntensity(
  ticksUntil: number,
  ahead: number,
  glow: TrailsGlowSettings,
): number | null {
  const leadTicks = Math.max(1, Math.round(ahead * glow.glowLeadRatio));
  if (ticksUntil > leadTicks) return null;
  const ramp = 1 - ticksUntil / leadTicks;
  const peak = glow.peakGlow;
  return clamp01(TRAILS_FLOOR_GLOW + ramp * (peak - TRAILS_FLOOR_GLOW));
}

export function classifyNoteAtTime(
  note: GuitarNoteEvent,
  currentTick: number,
  mode: DisplayMode,
  lookaheadTicks: number,
  lingerTicks: number,
  trailsGlow?: TrailsGlowSettings,
): ClassifiedNote | null {
  if (mode === 'trails') {
    const glow =
      trailsGlow ?? trailsGlowFromPractice(100, 100);
    return classifyNoteTrails(note, currentTick, lookaheadTicks, lingerTicks, glow);
  }

  if (currentTick >= note.startTick && currentTick < note.endTick) {
    return { state: 'active', intensity: 1 };
  }

  if (note.startTick > currentTick) {
    const ticksUntil = note.startTick - currentTick;
    return {
      state: 'upcoming',
      intensity: 1,
      approachBlend: upcomingApproachBlend(ticksUntil, lookaheadTicks),
    };
  }
  if (note.endTick <= currentTick && currentTick - note.endTick <= lingerTicks) {
    return { state: 'full', intensity: 1 };
  }
  if (currentTick <= 0 && note.startTick <= lookaheadTicks) {
    return {
      state: 'upcoming',
      intensity: 1,
      approachBlend: upcomingApproachBlend(note.startTick, lookaheadTicks),
    };
  }
  return null;
}

/** Trails: dim → bright as cue nears; ember orangy-red fade after played. */
function classifyNoteTrails(
  note: GuitarNoteEvent,
  currentTick: number,
  lookaheadTicks: number,
  lingerTicks: number,
  glow: TrailsGlowSettings,
): ClassifiedNote | null {
  const ahead = Math.max(lookaheadTicks, 1);
  const linger = Math.max(lingerTicks, 1);

  if (currentTick >= note.startTick && currentTick < note.endTick) {
    return { state: 'active', intensity: 1 };
  }

  if (note.startTick > currentTick) {
    const ticksUntil = note.startTick - currentTick;
    const intensity = trailsUpcomingIntensity(ticksUntil, ahead, glow);
    if (intensity == null) return null;
    return {
      state: 'upcoming',
      intensity,
      approachBlend: upcomingApproachBlend(ticksUntil, ahead),
    };
  }

  if (note.endTick <= currentTick) {
    const ticksSince = currentTick - note.endTick;
    if (ticksSince > linger) return null;
    const fade = 1 - ticksSince / linger;
    return { state: 'smolder', intensity: clamp01(fade) };
  }

  if (currentTick <= 0 && note.startTick <= ahead) {
    const intensity = trailsUpcomingIntensity(note.startTick, ahead, glow);
    if (intensity == null) return null;
    return {
      state: 'upcoming',
      intensity,
      approachBlend: upcomingApproachBlend(note.startTick, ahead),
    };
  }

  return null;
}

/** Extend lookahead at the start so the first audible beat is inside the tick window. */
export function extendWindowForSongStart(
  window: { start: number; end: number },
  currentTick: number,
  firstNoteTick: number | undefined,
  lookaheadTicks: number,
): { start: number; end: number } {
  if (firstNoteTick == null || firstNoteTick <= 0) return window;
  // Player often reports tick 1 before play; keep the opening phrase visible until we reach it.
  if (currentTick >= firstNoteTick) return window;
  if (window.end >= firstNoteTick + lookaheadTicks) return window;
  return { start: window.start, end: firstNoteTick + lookaheadTicks };
}

/** Events must be sorted by startTick. Returns notes that overlap [windowStart, windowEnd]. */
export function filterEventsInTickWindow(
  events: GuitarNoteEvent[],
  windowStart: number,
  windowEnd: number,
): GuitarNoteEvent[] {
  if (events.length === 0) return [];

  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid].endTick <= windowStart) lo = mid + 1;
    else hi = mid;
  }

  const result: GuitarNoteEvent[] = [];
  for (let i = lo; i < events.length; i++) {
    const note = events[i];
    if (note.startTick > windowEnd) break;
    if (note.endTick > windowStart) result.push(note);
  }
  return result;
}

export function getPlaybackTickWindow(
  currentTick: number,
  tempoBpm: number,
  _mode: DisplayMode,
  lookaheadMs: number,
  lingerMs: number,
): { start: number; end: number } {
  const ahead = millisToTicks(lookaheadMs, tempoBpm);
  const linger = millisToTicks(lingerMs, tempoBpm);
  return {
    start: currentTick - linger,
    end: currentTick + ahead,
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
