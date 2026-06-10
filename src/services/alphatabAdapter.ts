/**
 * alphaTab adapter — all third-party Guitar Pro / playback wiring lives here.
 *
 * Parsing: ScoreLoader reads binary GP data and builds alphaTab's Score model.
 * Timing: MidiFileGenerator walks the score and sets beat.timer (ms) on each beat.
 * Playback: AlphaTabApi + alphaSynth uses the same score for audio (not MIDI fret positions).
 *
 * MIDI fallback hook: add a parallel importer in guitarProParser that maps MIDI note events
 * to frets only when tab data is missing (not used today — tab is source of truth).
 *
 * Built-in song library hook: load ArrayBuffer from /songs/*.gp and call parseScoreFromBytes.
 */

import {
  AlphaTabApi,
  importer,
  midi,
  PlayerOutputMode,
  Settings,
  type json,
  type model,
} from '@coderline/alphatab';
import { assetUrl } from '../utils/baseUrl';
import { isIOSWebKit } from '../utils/mobileAudio';
import { classifyTrackKind, isGuitarLikeKind } from '../utils/trackClassification';

export const ALPHATAB_FONT_DIR = assetUrl('font/');
export const ALPHATAB_SOUND_FONT = assetUrl('soundfont/sonivox.sf2');

export function createAlphaTabSettings(): Settings {
  return new Settings();
}

// AI_CHANGE:
// Tool: Cursor
// Model: Composer
// Timestamp: 2026-06-04T23:00:00-04:00
// Purpose: Visible tab renderer settings with playback cursor and in-panel auto-scroll.
// Reason: Songsterr-style tab strip below the fretboard, synced to the playhead.

export function createTabPlayerSettings(
  scrollElement: HTMLElement,
  displayedTrackCount: number,
): json.SettingsJson {
  return {
    core: {
      fontDirectory: ALPHATAB_FONT_DIR,
      // AI_CHANGE:
      // Tool: Cursor
      // Model: Composer
      // Timestamp: 2026-06-05T17:10:00-04:00
      // Purpose: Disable lazy partial loading inside our scroll panel.
      // Reason: IntersectionObserver never painted rows — blank TAB with only cursor bars.
      enableLazyLoading: false,
    },
    player: {
      enablePlayer: true,
      enableCursor: true,
      enableAnimatedBeatCursor: true,
      enableElementHighlighting: true,
      enableUserInteraction: true,
      soundFont: ALPHATAB_SOUND_FONT,
      playerMode: 'EnabledSynthesizer',
      // AI_CHANGE:
      // Tool: Cursor
      // Model: Composer
      // Timestamp: 2026-06-05T09:35:00-04:00
      // Purpose: Use ScriptProcessor synth output on iOS/iPadOS WebKit.
      // Reason: AudioWorklets often load but produce no audio on mobile Safari/Chrome.
      outputMode: isIOSWebKit()
        ? PlayerOutputMode.WebAudioScriptProcessor
        : PlayerOutputMode.WebAudioAudioWorklets,
      scrollElement,
      scrollMode: 'OffScreen',
      scrollOffsetY: 48,
      scrollSpeed: 280,
      nativeBrowserSmoothScroll: true,
    },
    display: {
      scale: 1.05,
      staveProfile: displayedTrackCount > 1 ? 'TabMixed' : 'Tab',
      layoutMode: 'Page',
      barsPerRow: displayedTrackCount > 1 ? 2 : 4,
      // AI_CHANGE:
      // Tool: Cursor
      // Model: Composer
      // Timestamp: 2026-06-04T23:45:00-04:00
      // Purpose: Extra right inset so bend/slide glyphs on the last bar are not clipped.
      // Reason: Page layout scales bars to container width; articulations extend past bar bounds.
      padding: [10, 10, 44, 10],
      resources: {
        staffLineColor: 'rgb(70, 76, 92)',
        barSeparatorColor: 'rgb(22, 26, 36)',
        mainGlyphColor: 'rgb(10, 12, 20)',
        secondaryGlyphColor: 'rgb(50, 58, 72)',
        barNumberColor: 'rgb(150, 32, 32)',
        scoreInfoColor: 'rgb(22, 26, 36)',
        tablatureFont: '15px Arial, sans-serif',
        graceFont: '12px Arial, sans-serif',
      },
    },
  };
}

export type ScoreLoadResult = {
  score: model.Score;
  /** Same tick timeline the synth player uses for the cursor */
  tickLookup: midi.MidiTickLookup;
};

/**
 * Loads and finishes a score, then runs MIDI generation to build the tick lookup table.
 */
export function loadScoreFromBytes(data: Uint8Array): ScoreLoadResult {
  const settings = createAlphaTabSettings();
  let score: model.Score;
  try {
    score = importer.ScoreLoader.loadScoreFromBytes(data, settings);
  } catch (err) {
    if (err instanceof importer.UnsupportedFormatError) {
      throw new Error(
        'Unsupported file format. FretFlow accepts Guitar Pro (GP3–GP8, GPX) and MusicXML (.xml, .musicxml, .mxl).',
        { cause: err },
      );
    }
    throw new Error('Could not parse this score file. The file may be corrupt or encrypted.', {
      cause: err,
    });
  }

  score.finish(settings);
  enableBeatTimers(score);
  const midiFile = new midi.MidiFile();
  const handler = new midi.AlphaSynthMidiFileHandler(midiFile);
  const generator = new midi.MidiFileGenerator(score, settings, handler);
  generator.generate();
  return { score, tickLookup: generator.tickLookup };
}

/** Ensures beat.timer (ms) is populated for tab→timeline conversion (GP files often omit timers). */
function enableBeatTimers(score: model.Score): void {
  for (const track of score.tracks) {
    for (const staff of track.staves) {
      for (const bar of staff.bars) {
        for (const voice of bar.voices) {
          for (const beat of voice.beats) {
            beat.showTimer = true;
          }
        }
      }
    }
  }
}

export function createTabPlayerApi(
  container: HTMLElement,
  scrollElement: HTMLElement,
  displayedTrackCount: number,
): AlphaTabApi {
  return new AlphaTabApi(
    container,
    createTabPlayerSettings(scrollElement, displayedTrackCount),
  );
}

export function getScoreTempo(score: model.Score): number | undefined {
  const first = score.masterBars[0];
  const tempo = first?.tempoAutomations?.[0]?.value;
  return tempo !== undefined ? tempo : undefined;
}

export function getTrackTuningMidi(track: model.Track): number[] | undefined {
  const staff = track.staves[0];
  if (!staff?.isStringed) return undefined;
  const tuning = staff.tuning;
  return tuning?.length ? tuning : undefined;
}

/** True for guitar or bass tracks (fretted string instruments). */
export function isGuitarLikeTrack(track: model.Track): boolean {
  return isGuitarLikeKind(classifyTrackKind(track));
}

export function isGuitarTrack(track: model.Track): boolean {
  return classifyTrackKind(track) === 'guitar';
}
