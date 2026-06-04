/**
 * Converts alphaTab Score objects into FretFlow's normalized GuitarNoteEvent timeline.
 * Guitar Pro tab data (string + fret) is the source of truth — not MIDI note numbers.
 */

import type { model } from '@coderline/alphatab';
import type { GuitarNoteEvent, ParseResult, SongMetadata, TrackInfo } from '../types/guitar';
import {
  getScoreTempo,
  getTrackTuningMidi,
  loadScoreFromBytes,
} from './alphatabAdapter';
import { classifyTrackKind } from '../utils/trackClassification';
import { fretToNoteName } from '../utils/noteHelpers';

export type ParseOutcome = {
  result: ParseResult;
  /** Retained for alphaTab playback — not passed to fretboard components */
  score: model.Score;
};

export async function parseGuitarProFile(data: ArrayBuffer): Promise<ParseOutcome> {
  const bytes = new Uint8Array(data);
  const score = loadScoreFromBytes(bytes);
  return { result: buildParseResult(score), score };
}

function buildParseResult(score: model.Score): ParseResult {
  const tracks: TrackInfo[] = [];
  const eventsByTrack = new Map<number, GuitarNoteEvent[]>();

  score.tracks.forEach((track, index) => {
    const staff = track.staves[0];
    const stringCount = staff?.tuning?.length ?? 6;
    const kind = classifyTrackKind(track);
    const info: TrackInfo = {
      index,
      name: track.name || `Track ${index + 1}`,
      shortName: track.shortName || track.name || `T${index + 1}`,
      kind,
      isGuitar: kind === 'guitar',
      isGuitarLike: kind === 'guitar' || kind === 'bass',
      stringCount: Math.max(stringCount, 6),
    };
    tracks.push(info);
    eventsByTrack.set(index, extractTrackEvents(score, track, index));
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

function extractTrackEvents(
  score: model.Score,
  track: model.Track,
  trackIndex: number,
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

          const startMs =
            beat.absolutePlaybackStart != null
              ? ticksToMs(beat.absolutePlaybackStart, score, beat)
              : beat.timer ?? estimateStartMs(beat, score);
          const nextBeat = beat.nextBeat ?? beats[i + 1] ?? null;
          let durationMs = 120;
          if (
            nextBeat?.absolutePlaybackStart != null &&
            beat.absolutePlaybackStart != null
          ) {
            durationMs = Math.max(
              40,
              ticksToMs(nextBeat.absolutePlaybackStart - beat.absolutePlaybackStart, score, beat),
            );
          } else if (nextBeat?.timer != null && beat.timer != null) {
            durationMs = Math.max(40, nextBeat.timer - beat.timer);
          } else if (beat.playbackDuration > 0) {
            durationMs = ticksToMs(beat.playbackDuration, score, beat);
          }

          for (const note of beat.notes) {
            if (!note.isStringed) continue;
            if (note.fret < 0) continue;

            const id = `${trackIndex}-${idCounter++}`;
            events.push({
              id,
              trackIndex,
              string: note.string,
              fret: note.fret,
              startMs,
              durationMs,
              noteName: fretToNoteName(note.string, note.fret, tuningMidi),
              velocity: undefined,
              measure,
            });
          }
        }
      }
    }
  }

  events.sort((a, b) => a.startMs - b.startMs || a.string - b.string);
  return events;
}

function estimateStartMs(beat: model.Beat, score: model.Score): number {
  const tick = beat.absolutePlaybackStart ?? beat.playbackStart ?? 0;
  return ticksToMs(tick, score, beat);
}

function ticksToMs(ticks: number, score: model.Score, beat: model.Beat): number {
  const tempo =
    beat.voice.bar.masterBar.tempoAutomations[0]?.value ??
    score.masterBars[0]?.tempoAutomations?.[0]?.value ??
    120;
  const tpq = 960;
  return (ticks / tpq) * (60_000 / tempo);
}
