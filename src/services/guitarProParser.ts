/**
 * Converts alphaTab Score objects into FretFlow's normalized GuitarNoteEvent timeline.
 * Guitar Pro tab data (string + fret) is the source of truth — not MIDI note numbers.
 *
 * Timing uses MidiTickLookup (synth ticks) so the neck follows player currentTick,
 * the same clock as the tab cursor.
 */

import type { midi, model } from '@coderline/alphatab';
import type { GuitarNoteEvent, ParseResult, SongMetadata, TrackInfo } from '../types/guitar';
import {
  getScoreTempo,
  getTrackTuningMidi,
  loadScoreFromBytes,
} from './alphatabAdapter';
import { extractChordVoicingEvents, trackHasChordBeats } from '../utils/chordEvents';
import { classifyTrackKind } from '../utils/trackClassification';
import { extractNoteBendInfo } from '../utils/bendDisplay';
import { fretToNoteName } from '../utils/noteHelpers';

export type ParseOutcome = {
  result: ParseResult;
  score: model.Score;
  tickLookup: midi.MidiTickLookup;
};

export async function parseGuitarProFile(data: ArrayBuffer): Promise<ParseOutcome> {
  const bytes = new Uint8Array(data);
  const { score, tickLookup } = loadScoreFromBytes(bytes);
  return { result: buildParseResult(score, tickLookup), score, tickLookup };
}

/** Rebuild note events when the player's tick cache is available (after playerReady). */
export function refreshEventsFromTickCache(
  result: ParseResult,
  score: model.Score,
  tickLookup: midi.MidiTickLookup,
): ParseResult {
  return buildParseResult(score, tickLookup, result.tracks);
}

function resolveTrackEvents(
  track: model.Track,
  trackIndex: number,
  tickLookup: midi.MidiTickLookup,
): { events: GuitarNoteEvent[]; isChordSheet: boolean } {
  const tabEvents = extractTabNoteEvents(track, trackIndex, tickLookup);
  if (tabEvents.length > 0) {
    return { events: tabEvents, isChordSheet: false };
  }
  const chordEvents = trackHasChordBeats(track)
    ? extractChordVoicingEvents(track, trackIndex, tickLookup)
    : [];
  return { events: chordEvents, isChordSheet: chordEvents.length > 0 };
}

function buildParseResult(
  score: model.Score,
  tickLookup: midi.MidiTickLookup,
  existingTracks?: TrackInfo[],
): ParseResult {
  const eventsByTrack = new Map<number, GuitarNoteEvent[]>();
  const trackEventsMeta = new Map<number, { isChordSheet: boolean }>();
  for (const track of score.tracks) {
    const { events, isChordSheet } = resolveTrackEvents(track, track.index, tickLookup);
    eventsByTrack.set(track.index, events);
    trackEventsMeta.set(track.index, { isChordSheet });
  }

  const tracks: TrackInfo[] =
    existingTracks ??
    score.tracks.map((track, index) => {
      const staff = track.staves[0];
      const stringCount = staff?.tuning?.length ?? 6;
      const kind = classifyTrackKind(track);
      const tuningMidi = [...(staff?.tuning ?? [])];
      const isChordSheet = trackEventsMeta.get(track.index)?.isChordSheet ?? false;
      return {
        index,
        name: track.name || `Track ${index + 1}`,
        shortName: track.shortName || track.name || `T${index + 1}`,
        kind,
        isGuitar: kind === 'guitar' || isChordSheet,
        isChordSheet,
        isGuitarLike: kind === 'guitar' || kind === 'bass' || isChordSheet,
        stringCount: Math.max(stringCount, 6),
        capo: staff?.capo ?? 0,
        tuningMidi,
        tuningName: staff?.tuningName || undefined,
      };
    });

  const metadata: SongMetadata = {
    title: score.title || score.album || 'Untitled',
    artist: score.artist,
    tempo: getScoreTempo(score),
    durationMs: computeDurationMs(eventsByTrack),
  };

  return { tracks, eventsByTrack, metadata };
}

function computeDurationMs(eventsByTrack: Map<number, GuitarNoteEvent[]>): number {
  let max = 0;
  for (const events of eventsByTrack.values()) {
    for (const e of events) {
      if (e.startMs < 0 || e.startMs > 3_600_000) continue;
      max = Math.max(max, e.startMs + e.durationMs);
    }
  }
  if (max > 0 && max < 3_600_000) return max;
  return 0;
}

// AI_CHANGE:
// Tool: Cursor
// Model: Composer
// Timestamp: 2026-06-05T22:30:00-04:00
// Purpose: Expand note events from MidiTickLookup.masterBars so repeat passes get playback ticks.
// Reason: getBeatStart() is first-pass only; after a GP repeat, player currentTick leaves event ticks behind.
function extractTabNoteEvents(
  track: model.Track,
  trackIndex: number,
  tickLookup: midi.MidiTickLookup,
): GuitarNoteEvent[] {
  const events: GuitarNoteEvent[] = [];
  const staff = track.staves[0];
  const tuningMidi = staff?.tuning?.length ? [...staff.tuning] : (getTrackTuningMidi(track) ?? []);
  const capo = staff?.capo ?? 0;
  let idCounter = 0;

  const beatMeta = new Map<
    number,
    { startMs: number; durationMs: number; measure: number }
  >();
  for (const trackStaff of track.staves) {
    for (const bar of trackStaff.bars) {
      const measure = bar.index + 1;
      for (const voice of bar.voices) {
        if (voice.isEmpty) continue;
        const beats = voice.beats;
        for (let i = 0; i < beats.length; i++) {
          const beat = beats[i];
          if (beat.isRest || beat.isEmpty) continue;
          const startMs = beat.timer ?? 0;
          const nextBeat = beat.nextBeat ?? beats[i + 1] ?? null;
          const durationMs =
            nextBeat?.timer != null && beat.timer != null
              ? Math.max(40, nextBeat.timer - beat.timer)
              : 120;
          beatMeta.set(beat.id, { startMs, durationMs, measure });
        }
      }
    }
  }

  for (const masterBarLookup of tickLookup.masterBars) {
    let slice = masterBarLookup.firstBeat;
    while (slice) {
      for (const item of slice.highlightedBeats) {
        const beat = item.beat;
        if (beat.voice.bar.staff.track.index !== trackIndex) continue;
        if (beat.isRest || beat.isEmpty) continue;
        // Match tab cursor: beat is visible when its playback start aligns with this slice.
        if (item.playbackStart !== slice.start) continue;

        const startTick = masterBarLookup.start + item.playbackStart;
        const range = tickLookup.getRelativeBeatPlaybackRange(beat);
        let endTick = startTick + Math.max(beat.playbackDuration, 1);
        if (range) {
          endTick = masterBarLookup.start + range.endTick;
        } else {
          const sliceEnd = masterBarLookup.start + slice.end;
          if (sliceEnd > startTick) endTick = sliceEnd;
        }
        if (endTick <= startTick) endTick = startTick + 1;

        const meta = beatMeta.get(beat.id) ?? {
          startMs: 0,
          durationMs: 120,
          measure: beat.voice.bar.index + 1,
        };

        for (const note of beat.notes) {
          if (!note.isStringed || note.fret < 0) continue;

          const bend = extractNoteBendInfo(note);

          events.push({
            id: `${trackIndex}-${idCounter++}`,
            trackIndex,
            string: note.string,
            fret: note.fret,
            startTick,
            endTick,
            startMs: meta.startMs,
            durationMs: meta.durationMs,
            noteName: fretToNoteName(note.string, note.fret, tuningMidi, capo),
            measure: meta.measure,
            capo,
            ...(bend ? { bend } : {}),
          });
        }
      }
      slice = slice.nextBeat;
    }
  }

  events.sort((a, b) => a.startTick - b.startTick || a.string - b.string);
  return events;
}
