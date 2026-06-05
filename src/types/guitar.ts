/** Normalized note timeline — decoupled from Guitar Pro / alphaTab internals. */

import type { NoteBendInfo } from '../utils/bendDisplay';

export type GuitarNoteEvent = {
  id: string;
  trackIndex: number;
  /** alphaTab string index: 1 = lowest (thick E), increases toward treble */
  string: number;
  /** 0 = open / nut */
  fret: number;
  /** Midi tick when the note starts (matches player currentTick) */
  startTick: number;
  /** Midi tick when the note ends (exclusive) */
  endTick: number;
  /** Approximate ms from tick lookup — used for duration display only */
  startMs: number;
  durationMs: number;
  noteName?: string;
  velocity?: number;
  measure?: number;
  /** String bend from Guitar Pro, when present */
  bend?: NoteBendInfo;
  /** Capo on this note's track (tab fret is relative to capo). */
  capo: number;
};

import type { TrackKind } from '../utils/trackClassification';

export type TrackInfo = {
  index: number;
  name: string;
  shortName: string;
  kind: TrackKind;
  /** True when kind is guitar (not bass, vocals, drums, etc.). */
  isGuitar: boolean;
  /** @deprecated Use kind / isGuitar — kept for compatibility */
  isGuitarLike: boolean;
  stringCount: number;
  /** Capo fret from Guitar Pro (tab frets are relative to this). */
  capo: number;
  /** Open-string MIDI, top tab line first — matches alphaTab staff.tuning */
  tuningMidi: number[];
  tuningName?: string;
};

export type SongMetadata = {
  title: string;
  artist?: string;
  tempo?: number;
  durationMs: number;
};

export type ParseResult = {
  tracks: TrackInfo[];
  eventsByTrack: Map<number, GuitarNoteEvent[]>;
  metadata: SongMetadata;
};

/** Standard: fixed upcoming/active styling. Trails: ramp-up before cue, ember fade after. */
export type DisplayMode = 'standard' | 'trails';

export type PracticeSettings = {
  showNoteNames: boolean;
  leftHanded: boolean;
  showStandardTuning: boolean;
  /** Orange ↑/↕ bend labels on dots (vertical bend lift always on) */
  showBendBadges: boolean;
  /** How far ahead of the playhead upcoming notes appear on the neck */
  noteLookaheadMs: number;
  /** How long played notes stay visible after they end */
  noteLingerMs: number;
  /** Trails: peak upcoming brightness at the cue (0–100). */
  trailsPeakGlow: number;
  /** Trails: % of “notes ahead” window before dots start ramping (100 = earliest). */
  trailsGlowLeadPercent: number;
  noteColorUpcoming: string;
  noteColorActive: string;
  noteColorPlayed: string;
  loopEnabled: boolean;
  loopStartMs: number;
  loopEndMs: number;
};

export type PlaybackState = {
  isPlaying: boolean;
  isReady: boolean;
  currentMs: number;
  totalMs: number;
  speed: number;
  metronomeOn: boolean;
};

/** Min/max for the “notes ahead” practice slider */
export const NOTE_LOOKAHEAD_MIN_MS = 400;
export const NOTE_LOOKAHEAD_MAX_MS = 10_000;
export const DEFAULT_NOTE_LOOKAHEAD_MS = 600;

/** Min/max for the “notes linger” practice slider */
export const NOTE_LINGER_MIN_MS = 0;
export const NOTE_LINGER_MAX_MS = 10_000;
export const DEFAULT_NOTE_LINGER_MS = 200;

export const TRAILS_PEAK_GLOW_MIN = 15;
export const TRAILS_PEAK_GLOW_MAX = 100;
export const DEFAULT_TRAILS_PEAK_GLOW = 100;

export const TRAILS_GLOW_LEAD_MIN = 10;
export const TRAILS_GLOW_LEAD_MAX = 100;
export const DEFAULT_TRAILS_GLOW_LEAD_PERCENT = 25;

// AI_CHANGE:
// Tool: Cursor
// Model: Composer
// Timestamp: 2026-06-05T16:00:00-04:00
// Purpose: Note color pickers apply in Trails display only; Standard uses per-track hues.
// Reason: User wants generic track colors in Standard and custom pickers in Trails.

export const DEFAULT_PRACTICE: PracticeSettings = {
  showNoteNames: false,
  leftHanded: false,
  showStandardTuning: true,
  showBendBadges: false,
  noteLookaheadMs: DEFAULT_NOTE_LOOKAHEAD_MS,
  noteLingerMs: DEFAULT_NOTE_LINGER_MS,
  trailsPeakGlow: DEFAULT_TRAILS_PEAK_GLOW,
  trailsGlowLeadPercent: DEFAULT_TRAILS_GLOW_LEAD_PERCENT,
  noteColorUpcoming: '#FFE566',
  noteColorActive: '#E84830',
  noteColorPlayed: '#6A8FC8',
  loopEnabled: false,
  loopStartMs: 0,
  loopEndMs: 0,
};

export const STANDARD_TUNING = ['E', 'A', 'D', 'G', 'B', 'E'] as const;

export const FRET_MARKERS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24] as const;

export const MAX_FRET = 24;
