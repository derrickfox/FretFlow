// AI_CHANGE:
// Tool: Cursor
// Model: Composer
// Timestamp: 2026-06-04T17:36:00-04:00
// Purpose: Parse GP bend graphs; lift dots vertically during bends (badges when lift is tiny).
// Reason: Bends read like pushing the string up, not sliding to a higher fret.

/**
 * Guitar Pro string bends → fretboard labels and target-fret hints.
 * alphaTab stores bend heights in quarter-tone units (value / 2 = semitones).
 */

import { model } from '@coderline/alphatab';

const { BendType } = model;

export type BendCategory = 'up' | 'down' | 'hold' | 'up-down' | 'pre';

export type BendGraphPoint = {
  /** 0–60, fraction through the note where this height applies */
  offset: number;
  semitones: number;
};

export type NoteBendInfo = {
  category: BendCategory;
  /** Pitch offset at note start (prebend / first graph point). */
  startSemitones: number;
  /** Highest offset reached on this note. */
  peakSemitones: number;
  /** Offset at note end (releases). */
  endSemitones: number;
  /** GP bend curve for playback-synced dot motion */
  graph?: BendGraphPoint[];
};

/** alphaTab bend graph uses 0–60 across the note duration */
export const BEND_GRAPH_MAX_OFFSET = 60;

export function bendValueToSemitones(value: number): number {
  return value / 2;
}

export function formatBendAmount(semitones: number): string {
  if (semitones <= 0) return '0';
  const rounded = Math.round(semitones * 2) / 2;
  const whole = Math.floor(rounded);
  const hasHalf = Math.abs(rounded - whole - 0.5) < 0.01;
  if (whole === 0) return hasHalf ? '½' : String(rounded);
  return hasHalf ? `${whole}½` : String(whole);
}

export function formatBendLabel(bend: NoteBendInfo): string {
  const peak = formatBendAmount(bend.peakSemitones);
  const end = formatBendAmount(bend.endSemitones);
  switch (bend.category) {
    case 'up':
      return `↑${peak}`;
    case 'down':
      return `↓${end}`;
    case 'hold':
      return bend.peakSemitones > 0 ? `═${peak}` : '═';
    case 'up-down':
      return `↕${peak}`;
    case 'pre':
      return `⊏${formatBendAmount(bend.startSemitones)}`;
    default:
      return `↑${peak}`;
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function interpolateBendGraph(
  graph: BendGraphPoint[],
  progress: number,
): number {
  if (graph.length === 0) return 0;
  if (graph.length === 1) return graph[0].semitones;

  const t = progress * BEND_GRAPH_MAX_OFFSET;
  if (t <= graph[0].offset) return graph[0].semitones;

  for (let i = 1; i < graph.length; i++) {
    const prev = graph[i - 1];
    const next = graph[i];
    if (t <= next.offset) {
      const span = next.offset - prev.offset;
      const u = span > 0 ? (t - prev.offset) / span : 0;
      return prev.semitones + u * (next.semitones - prev.semitones);
    }
  }

  return graph[graph.length - 1].semitones;
}

function bendOffsetFromCategory(
  bend: NoteBendInfo,
  progress: number,
): number {
  const { category, startSemitones, peakSemitones, endSemitones } = bend;

  switch (category) {
    case 'pre':
      return startSemitones + (peakSemitones - startSemitones) * progress;
    case 'hold':
      return peakSemitones;
    case 'down':
      return startSemitones + (endSemitones - startSemitones) * progress;
    case 'up-down': {
      if (progress <= 0.5) {
        const u = progress * 2;
        return startSemitones + (peakSemitones - startSemitones) * u;
      }
      const u = (progress - 0.5) * 2;
      return peakSemitones + (endSemitones - peakSemitones) * u;
    }
    case 'up':
    default:
      return startSemitones + (peakSemitones - startSemitones) * progress;
  }
}

export type BendVisualContext = {
  state: 'active' | 'upcoming' | 'full' | 'smolder' | 'past';
  currentTick: number;
  startTick: number;
  endTick: number;
};

/**
 * Current bend depth in semitones (from GP graph / playback progress).
 */
export function bendCurrentSemitones(
  bend: NoteBendInfo,
  ctx: BendVisualContext,
): number {
  const { state, currentTick, startTick, endTick } = ctx;
  const duration = Math.max(endTick - startTick, 1);

  let progress = 0;
  if (state === 'active') {
    progress = clamp01((currentTick - startTick) / duration);
  } else if (state === 'smolder') {
    progress = 1;
  } else if (state === 'upcoming' || state === 'full') {
    progress = 0;
  } else {
    return 0;
  }

  const offset =
    bend.graph && bend.graph.length > 0
      ? interpolateBendGraph(bend.graph, progress)
      : bendOffsetFromCategory(bend, progress);

  return Math.max(0, offset);
}

/** @deprecated Alias for bendCurrentSemitones */
export const bendVisualOffsetSemitones = bendCurrentSemitones;

/** Pixels to nudge the dot upward (like pushing the string toward the ceiling). */
export function bendVisualLiftPx(
  bend: NoteBendInfo,
  ctx: BendVisualContext,
  stringCount: number,
): number {
  const semitones = bendCurrentSemitones(bend, ctx);
  if (semitones <= 0) return 0;
  const pxPerSemitone = Math.max(5, 34 / Math.max(stringCount, 4));
  return Math.min(semitones * pxPerSemitone, pxPerSemitone * 2.75);
}

/** Whether to render the small bend label on a dot (lift animation is separate). */
export function shouldShowBendBadge(
  bend: NoteBendInfo | undefined,
  showBendBadges: boolean,
): boolean {
  return showBendBadges && bend != null;
}

function categoryFromBendType(
  bendType: model.BendType,
  start: number,
  peak: number,
  end: number,
  continued: boolean,
): BendCategory {
  switch (bendType) {
    case BendType.Release:
      return 'down';
    case BendType.Hold:
      return 'hold';
    case BendType.Prebend:
      return 'pre';
    case BendType.PrebendBend:
      return start > 0 ? 'pre' : 'up';
    case BendType.PrebendRelease:
      return start > 0 ? 'pre' : 'down';
    case BendType.BendRelease:
      return 'up-down';
    case BendType.Bend:
      return 'up';
    case BendType.Custom:
      if (end < peak - 0.01 && peak > start) return 'up-down';
      if (end < start - 0.01 || (continued && end < peak)) return 'down';
      if (peak > start + 0.01) return 'up';
      if (start > 0 && Math.abs(end - start) < 0.01) return 'hold';
      return peak > 0 ? 'up' : 'hold';
    default:
      if (continued) return 'hold';
      return peak > start ? 'up' : 'hold';
  }
}

function collectBendPoints(note: model.Note): { offset: number; value: number }[] {
  if (note.bendPoints?.length) {
    return note.bendPoints.map((p) => ({ offset: p.offset, value: p.value }));
  }
  if (note.isContinuedBend && note.bendOrigin?.bendPoints?.length) {
    const pts = note.bendOrigin.bendPoints;
    const last = pts[pts.length - 1];
    return [{ offset: 0, value: last.value }];
  }
  return [];
}

/**
 * Reads alphaTab bend metadata for a fretted note.
 */
export function extractNoteBendInfo(note: model.Note): NoteBendInfo | undefined {
  const points = collectBendPoints(note);
  const hasGraph = points.length > 0;
  const continued = note.isContinuedBend;
  const typed = note.bendType !== BendType.None;

  if (!hasGraph && !continued && !typed) return undefined;

  if (hasGraph) {
    const semis = points.map((p) => bendValueToSemitones(p.value));
    const startSemitones = semis[0];
    const peakSemitones = Math.max(...semis);
    const endSemitones = semis[semis.length - 1];
    const category = categoryFromBendType(
      note.bendType,
      startSemitones,
      peakSemitones,
      endSemitones,
      continued,
    );
    return {
      category,
      startSemitones,
      peakSemitones,
      endSemitones,
      graph: points.map((p) => ({
        offset: p.offset,
        semitones: bendValueToSemitones(p.value),
      })),
    };
  }

  const held = bendValueToSemitones(note.initialBendValue);
  if (held <= 0 && !continued) return undefined;

  return {
    category: continued ? 'hold' : 'pre',
    startSemitones: held,
    peakSemitones: held,
    endSemitones: held,
  };
}
