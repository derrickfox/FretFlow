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

function buildParseResult(
  score: model.Score,
  tickLookup: midi.MidiTickLookup,
  existingTracks?: TrackInfo[],
): ParseResult {
  const tracks: TrackInfo[] =
    existingTracks ??
    score.tracks.map((track, index) => {
      const staff = track.staves[0];
      const stringCount = staff?.tuning?.length ?? 6;
      const kind = classifyTrackKind(track);
      return {
        index,
        name: track.name || `Track ${index + 1}`,
        shortName: track.shortName || track.name || `T${index + 1}`,
        kind,
        isGuitar: kind === 'guitar',
        isGuitarLike: kind === 'guitar' || kind === 'bass',
        stringCount: Math.max(stringCount, 6),
      };
    });

  const eventsByTrack = new Map<number, GuitarNoteEvent[]>();
  for (const track of score.tracks) {
    eventsByTrack.set(track.index, extractTrackEvents(track, track.index, tickLookup));
  }

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

function extractTrackEvents(
  track: model.Track,
  trackIndex: number,
  tickLookup: midi.MidiTickLookup,
): GuitarNoteEvent[] {
  const events: GuitarNoteEvent[] = [];
  const tuningMidi = getTrackTuningMidi(track);
  let idCounter = 0;

  for (const staff of track.staves) {
    for (const bar of staff.bars) {
      const measure = bar.index + 1;
      for (const voice of bar.voices) {
        if (voice.isEmpty) continue;
        const beats = voice.beats;
        for (let i = 0; i < beats.length; i++) {
          const beat = beats[i];
          if (beat.isRest || beat.isEmpty) continue;

          const startTick = tickLookup.getBeatStart(beat);
          const range = tickLookup.getRelativeBeatPlaybackRange(beat);
          let endTick = startTick + Math.max(beat.playbackDuration, 1);
          if (range) {
            const masterStart = tickLookup.getMasterBarStart(beat.voice.bar.masterBar);
            endTick = masterStart + range.endTick;
          } else {
            const nextBeat = beat.nextBeat ?? beats[i + 1] ?? null;
            if (nextBeat) {
              const nextStart = tickLookup.getBeatStart(nextBeat);
              if (nextStart > startTick) endTick = nextStart;
            }
          }
          if (endTick <= startTick) endTick = startTick + 1;

          const startMs = beat.timer ?? 0;
          const nextBeat = beat.nextBeat ?? beats[i + 1] ?? null;
          const durationMs =
            nextBeat?.timer != null && beat.timer != null
              ? Math.max(40, nextBeat.timer - beat.timer)
              : 120;

          for (const note of beat.notes) {
            if (!note.isStringed) continue;
            if (note.fret < 0) continue;

            const bend = extractNoteBendInfo(note);

            events.push({
              id: `${trackIndex}-${idCounter++}`,
              trackIndex,
              string: note.string,
              fret: note.fret,
              startTick,
              endTick,
              startMs,
              durationMs,
              noteName: fretToNoteName(note.string, note.fret, tuningMidi),
              measure,
              ...(bend ? { bend } : {}),
            });
          }
        }
      }
    }
  }

  events.sort((a, b) => a.startTick - b.startTick || a.string - b.string);
  return events;
}
