/** Normalized note timeline — decoupled from Guitar Pro / alphaTab internals. */

export type GuitarNoteEvent = {
  id: string;
  trackIndex: number;
  /** alphaTab string index: 1 = lowest (thick E), increases toward treble */
  string: number;
  /** 0 = open / nut */
  fret: number;
  startMs: number;
  durationMs: number;
  noteName?: string;
  velocity?: number;
  measure?: number;
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

export type DisplayMode = 'live' | 'full';

export type PracticeSettings = {
  showNoteNames: boolean;
  leftHanded: boolean;
  showStandardTuning: boolean;
  /** How far ahead of the playhead upcoming notes appear on the neck */
  noteLookaheadMs: number;
  /** How long played notes stay visible after they end */
  noteLingerMs: number;
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
export const DEFAULT_NOTE_LOOKAHEAD_MS = 4000;

/** Min/max for the “notes linger” practice slider */
export const NOTE_LINGER_MIN_MS = 0;
export const NOTE_LINGER_MAX_MS = 10_000;
export const DEFAULT_NOTE_LINGER_MS = 3500;

export const DEFAULT_PRACTICE: PracticeSettings = {
  showNoteNames: false,
  leftHanded: false,
  showStandardTuning: true,
  noteLookaheadMs: DEFAULT_NOTE_LOOKAHEAD_MS,
  noteLingerMs: DEFAULT_NOTE_LINGER_MS,
  loopEnabled: false,
  loopStartMs: 0,
  loopEndMs: 0,
};

export const STANDARD_TUNING = ['E', 'A', 'D', 'G', 'B', 'E'] as const;

export const FRET_MARKERS = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24] as const;

export const MAX_FRET = 24;
