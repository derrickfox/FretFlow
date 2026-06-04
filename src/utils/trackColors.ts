export type TrackNoteColors = {
  activeBg: string;
  activeShadow: string;
  upcomingBg: string;
  upcomingBorder: string;
  fullBg: string;
  fullBorder: string;
};

/** Distinct hues for simultaneous multi-track fretboard display */
const TRACK_HUES = [42, 205, 145, 275, 8, 28, 320, 175] as const;

function hsl(h: number, s: number, l: number, a = 1): string {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

export function getTrackHue(trackIndex: number, neckTrackOrder: readonly number[]): number {
  const slot = neckTrackOrder.indexOf(trackIndex);
  return TRACK_HUES[(slot >= 0 ? slot : trackIndex) % TRACK_HUES.length];
}

/** Circular mean so e.g. yellow + blue hues mix toward green */
function blendHues(hues: number[]): number {
  if (hues.length === 0) return TRACK_HUES[0];
  if (hues.length === 1) return hues[0];
  let x = 0;
  let y = 0;
  for (const hue of hues) {
    const rad = (hue * Math.PI) / 180;
    x += Math.cos(rad);
    y += Math.sin(rad);
  }
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

function colorsFromHue(hue: number): TrackNoteColors {
  return {
    activeBg: `radial-gradient(circle at 35% 30%, ${hsl(hue, 95, 88)}, ${hsl(hue, 85, 58)} 55%, ${hsl(hue, 75, 42)})`,
    activeShadow: `0 0 12px ${hsl(hue, 90, 55, 0.85)}, 0 0 2px ${hsl(hue, 30, 95, 0.9)}`,
    upcomingBg: hsl(hue, 70, 55, 0.45),
    upcomingBorder: hsl(hue, 75, 72, 0.65),
    fullBg: hsl(hue, 55, 48, 0.38),
    fullBorder: hsl(hue, 50, 62, 0.5),
  };
}

export function getTrackNoteColors(
  trackIndex: number,
  neckTrackOrder: readonly number[],
): TrackNoteColors {
  return colorsFromHue(getTrackHue(trackIndex, neckTrackOrder));
}

/** One dot at the same fret — mix track hues (yellow + blue → green). */
export function blendTrackNoteColors(
  trackIndices: number[],
  neckTrackOrder: readonly number[],
): TrackNoteColors {
  const unique = [...new Set(trackIndices)];
  if (unique.length <= 1) {
    return getTrackNoteColors(unique[0] ?? 0, neckTrackOrder);
  }
  const hues = unique.map((ti) => getTrackHue(ti, neckTrackOrder));
  return colorsFromHue(blendHues(hues));
}
