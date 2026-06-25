import type { ParseResult, TrackInfo } from '../types/guitar';

// AI_CHANGE:
// Tool: Cursor
// Model: Composer
// Timestamp: 2026-06-12T09:30:00-04:00
// Purpose: Pick sensible default fretboard tracks when a score loads.
// Reason: Hotel California GP includes a capo-7 rhythm track; auto-selecting every guitar
// track showed Capo 7 even though the solo part is played without a capo.

function tracksWithNotes(result: ParseResult, candidates: TrackInfo[]): TrackInfo[] {
  return candidates.filter(
    (t) => (result.eventsByTrack.get(t.index)?.length ?? 0) > 0,
  );
}

function isSoloTrackName(name: string): boolean {
  return /\bsolo\b/i.test(name) && !/\brhythm\b/i.test(name);
}

/** Prefer a single solo guitar track; otherwise one guitar track; else all guitar tracks with notes. */
export function pickDefaultNeckTrackIndices(result: ParseResult): number[] {
  const guitarTracks = tracksWithNotes(
    result,
    result.tracks.filter((t) => t.isGuitar),
  );
  if (guitarTracks.length === 0) {
    const anyWithNotes = tracksWithNotes(result, result.tracks);
    if (anyWithNotes.length === 0) return [result.tracks[0]?.index ?? 0];
    return anyWithNotes.map((t) => t.index);
  }

  const soloTracks = guitarTracks.filter((t) => isSoloTrackName(t.name));
  if (soloTracks.length === 1) {
    return [soloTracks[0].index];
  }
  if (soloTracks.length > 1) {
    const mainSolo =
      soloTracks.find((t) => /^guitar solo$/i.test(t.name.trim())) ?? soloTracks[0];
    return [mainSolo.index];
  }

  if (guitarTracks.length === 1) {
    return [guitarTracks[0].index];
  }

  return guitarTracks.map((t) => t.index);
}

/** Capo badge / bar when multiple neck tracks may use different capos. */
export function capoFretForNeckTracks(tracks: TrackInfo[]): number {
  if (tracks.length === 0) return 0;
  const capos = [...new Set(tracks.map((t) => t.capo ?? 0))];
  return capos.length === 1 ? capos[0] : 0;
}
