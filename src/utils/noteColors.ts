// AI_CHANGE:
// Tool: Cursor
// Model: Composer
// Timestamp: 2026-06-05T15:00:00-04:00
// Purpose: Linger borders use the solid just-played picker color (same as fill base).
// Reason: User reported smolder/full borders still looked like the playing color.

import type { CSSProperties } from 'react';
import type { NoteVisualState } from './noteHelpers';

export type UserNoteColors = {
  upcoming: string;
  active: string;
  played: string;
};

export const DEFAULT_NOTE_COLOR_UPCOMING = '#FFE566';
export const DEFAULT_NOTE_COLOR_ACTIVE = '#E84830';
export const DEFAULT_NOTE_COLOR_PLAYED = '#6A8FC8';

type Rgb = { r: number; g: number; b: number };

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function parseHex(hex: string): Rgb {
  const raw = hex.trim().replace(/^#/, '');
  const normalized =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw.slice(0, 6);
  const n = Number.parseInt(normalized, 16);
  if (Number.isNaN(n)) return { r: 255, g: 255, b: 255 };
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
  };
}

function toHex({ r, g, b }: Rgb): string {
  const h = (v: number) => v.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Linear RGB blend; t=0 → from, t=1 → to (yellow + red → orange). */
export function blendHex(from: string, to: string, t: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  const mix = clamp01(t);
  return toHex({
    r: Math.round(a.r + (b.r - a.r) * mix),
    g: Math.round(a.g + (b.g - a.g) * mix),
    b: Math.round(a.b + (b.b - a.b) * mix),
  });
}

export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp01(alpha)})`;
}

function radialDotFill(hex: string, highlight = 0.22): string {
  const hi = blendHex(hex, '#ffffff', highlight);
  const lo = blendHex(hex, '#000000', 0.18);
  return `radial-gradient(circle at 35% 30%, ${hi}, ${hex} 55%, ${lo})`;
}

/** 0 = far upcoming color, 1 = active color at the cue. */
export function upcomingApproachBlend(ticksUntil: number, aheadTicks: number): number {
  return clamp01(1 - ticksUntil / Math.max(aheadTicks, 1));
}

/** Paints custom dots through CSS variables consumed by NoteDot.module.css. */
export function buildCustomNoteDotStyle(
  state: NoteVisualState,
  intensity: number,
  approachBlend: number,
  colors: UserNoteColors,
  trails: boolean,
): CSSProperties {
  const blend = clamp01(approachBlend);
  const i = clamp01(intensity);

  switch (state) {
    case 'upcoming': {
      const fill = blendHex(colors.upcoming, colors.active, blend);
      const border = blendHex(colors.upcoming, colors.active, Math.min(1, blend + 0.12));
      const visibility = trails
        ? Math.max(0.55, 0.4 + 0.6 * Math.max(i, blend * 0.85))
        : Math.max(0.65, 0.55 + 0.45 * blend);
      return {
        '--dot-fill': radialDotFill(fill, 0.15 + blend * 0.12),
        '--dot-border': border,
        '--dot-shadow': `0 0 ${4 + 14 * blend}px ${hexToRgba(fill, 0.35 + 0.5 * blend)}`,
        '--dot-opacity': String(visibility),
        zIndex: 2,
      } as CSSProperties;
    }
    case 'active':
      return {
        '--dot-fill': radialDotFill(colors.active, 0.28),
        '--dot-border': 'transparent',
        '--dot-shadow': `0 0 12px ${hexToRgba(colors.active, 0.85)}, 0 0 2px ${hexToRgba(colors.active, 0.45)}`,
        '--dot-opacity': '1',
        zIndex: 3,
      } as CSSProperties;
    case 'full': {
      const played = colors.played;
      return {
        '--dot-fill': radialDotFill(played, 0.12),
        '--dot-border': played,
        '--dot-shadow': `0 0 6px ${hexToRgba(played, 0.35)}`,
        '--dot-opacity': '0.6',
        zIndex: 1,
      } as CSSProperties;
    }
    case 'smolder': {
      const played = colors.played;
      return {
        '--dot-fill': radialDotFill(played, 0.1 + i * 0.1),
        '--dot-border': played,
        '--dot-shadow': `0 0 ${2 + 10 * i}px ${hexToRgba(played, 0.2 + 0.4 * i)}`,
        '--dot-opacity': String(0.3 + 0.6 * i),
        zIndex: 2,
      } as CSSProperties;
    }
    default:
      return {};
  }
}
