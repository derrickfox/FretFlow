import type { midi, model } from '@coderline/alphatab';
import type { GuitarNoteEvent } from '../types/guitar';
import { resolveChordVoicing, stringNumberForVoicingIndex } from './chordVoicings';

// AI_CHANGE:
// Tool: Cursor
// Model: Composer
// Timestamp: 2026-06-05T15:25:00-04:00
// Purpose: Turn chord-symbol beats into fretboard note events for lead sheets.
// Reason: MusicXML harmony has no tablature but should still drive the practice neck.

export function trackHasChordBeats(track: model.Track): boolean {
  for (const staff of track.staves) {
    for (const bar of staff.bars) {
      for (const voice of bar.voices) {
        for (const beat of voice.beats) {
          if (beat.chord) return true;
        }
      }
    }
  }
  return false;
}

export function extractChordVoicingEvents(
  track: model.Track,
  trackIndex: number,
  tickLookup: midi.MidiTickLookup,
): GuitarNoteEvent[] {
  const events: GuitarNoteEvent[] = [];
  const staff = track.staves[0];
  const capo = staff?.capo ?? 0;
  const seenBeatIds = new Set<number>();
  let idCounter = 0;

  for (const trackStaff of track.staves) {
    for (const bar of trackStaff.bars) {
      const measure = bar.index + 1;
      for (const voice of bar.voices) {
        for (const beat of voice.beats) {
          const chord = beat.chord;
          if (!chord || seenBeatIds.has(beat.id)) continue;
          seenBeatIds.add(beat.id);

          const voicing = resolveChordVoicing(chord);
          if (!voicing) continue;

          const masterBarLookup = tickLookup.getMasterBar(beat.voice.bar.masterBar);
          const startTick = tickLookup.getBeatStart(beat);
          const range = tickLookup.getRelativeBeatPlaybackRange(beat);
          let endTick = startTick + Math.max(beat.playbackDuration, 1);
          if (range) {
            endTick = masterBarLookup.start + range.endTick;
          } else if (beat.nextBeat) {
            const nextStart = tickLookup.getBeatStart(beat.nextBeat);
            if (nextStart > startTick) endTick = nextStart;
          }
          if (endTick <= startTick) endTick = startTick + 1;

          const startMs = beat.timer ?? 0;
          const durationMs =
            beat.nextBeat?.timer != null && beat.timer != null
              ? Math.max(40, beat.nextBeat.timer - beat.timer)
              : Math.max(40, (endTick - startTick) * 0.5);

          for (let i = 0; i < voicing.length; i++) {
            const fret = voicing[i];
            if (fret < 0) continue;

            events.push({
              id: `${trackIndex}-ch-${idCounter++}`,
              trackIndex,
              string: stringNumberForVoicingIndex(voicing, i),
              fret,
              startTick,
              endTick,
              startMs,
              durationMs,
              noteName: chord.name,
              measure,
              capo,
            });
          }
        }
      }
    }
  }

  events.sort((a, b) => a.startTick - b.startTick || a.string - b.string);
  return events;
}
