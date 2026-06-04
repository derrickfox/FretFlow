import { useMemo, type CSSProperties } from 'react';
import type { GuitarNoteEvent, PracticeSettings } from '../types/guitar';
import { FRET_MARKERS, MAX_FRET, STANDARD_TUNING } from '../types/guitar';
import type { DisplayMode } from '../types/guitar';
import {
  classifyNoteAtTime,
  extendWindowForSongStart,
  filterEventsInTickWindow,
  getPlaybackTickWindow,
  millisToTicks,
  stringToVisualRow,
  trailsGlowFromPractice,
} from '../utils/noteHelpers';
import {
  bendVisualLiftPx,
  shouldShowBendBadge,
  type BendVisualContext,
} from '../utils/bendDisplay';
import { mergeNotesAtSameFret } from '../utils/mergeNeckDots';
import { blendTrackNoteColors } from '../utils/trackColors';
import { NoteDot } from './NoteDot';
import styles from './GuitarNeck.module.css';

type GuitarNeckProps = {
  events: GuitarNoteEvent[];
  /** Synth midi tick from alphaTab — must match tab cursor */
  currentTick: number;
  /** Playback tempo (BPM) for ms→tick lookahead/linger */
  playbackTempo: number;
  displayMode: DisplayMode;
  practice: PracticeSettings;
  stringCount?: number;
  /** Track indices shown on the neck — used for per-track dot colors */
  neckTrackIndices: number[];
};

export function GuitarNeck({
  events,
  currentTick,
  playbackTempo,
  displayMode,
  practice,
  stringCount = 6,
  neckTrackIndices,
}: GuitarNeckProps) {
  const frets = useMemo(() => Array.from({ length: MAX_FRET + 1 }, (_, i) => i), []);
  const strings = useMemo(
    () =>
      practice.showStandardTuning
        ? [...STANDARD_TUNING].reverse()
        : Array.from({ length: stringCount }, (_, i) => `S${stringCount - i}`),
    [practice.showStandardTuning, stringCount],
  );

  const mergedDots = useMemo(() => {
    const { noteLookaheadMs, noteLingerMs } = practice;
    const tempo = Math.max(playbackTempo, 40);
    const ahead = millisToTicks(noteLookaheadMs, tempo);
    const baseWindow = getPlaybackTickWindow(
      currentTick,
      tempo,
      displayMode,
      noteLookaheadMs,
      noteLingerMs,
    );
    const firstNoteTick = events[0]?.startTick;
    const { start, end } = extendWindowForSongStart(
      baseWindow,
      currentTick,
      firstNoteTick,
      ahead,
    );
    const windowed = filterEventsInTickWindow(events, start, end);
    const linger = millisToTicks(noteLingerMs, tempo);
    const trailsGlow =
      displayMode === 'trails'
        ? trailsGlowFromPractice(practice.trailsPeakGlow, practice.trailsGlowLeadPercent)
        : undefined;
    const classified = windowed
      .map((note) => {
        const c = classifyNoteAtTime(
          note,
          currentTick,
          displayMode,
          ahead,
          linger,
          trailsGlow,
        );
        return c ? { note, classified: c } : null;
      })
      .filter((x): x is { note: GuitarNoteEvent; classified: NonNullable<ReturnType<typeof classifyNoteAtTime>> } =>
        x !== null,
      );
    return mergeNotesAtSameFret(classified, practice.showNoteNames);
  }, [
    events,
    currentTick,
    playbackTempo,
    displayMode,
    practice.noteLookaheadMs,
    practice.noteLingerMs,
    practice.trailsPeakGlow,
    practice.trailsGlowLeadPercent,
    practice.showNoteNames,
  ]);

  const neckClass = [
    styles.neck,
    practice.leftHanded ? styles.leftHanded : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={styles.wrapper}
      data-fretboard-dots={mergedDots.length}
      data-fretboard-events={events.length}
    >
      <div className={neckClass}>
        <div className={styles.fretNumbers}>
          <div className={styles.corner} />
          {frets.map((fret) => (
            <div key={fret} className={styles.fretNumber}>
              {fret}
            </div>
          ))}
        </div>

        <div
          className={styles.stringsBlock}
          style={{ '--string-count': String(stringCount) } as CSSProperties}
        >
          {strings.map((label, row) => (
            <div key={row} className={styles.stringRow}>
              <div className={styles.stringLabel}>{label}</div>
              <div className={styles.fretCells}>
                {frets.map((fret) => {
                  const isMarker = (FRET_MARKERS as readonly number[]).includes(fret);
                  return (
                    <div
                      key={fret}
                      className={`${styles.cell} ${isMarker ? styles.markerFret : ''} ${fret === 0 ? styles.nut : ''}`}
                    >
                      {fret === 12 && isMarker ? <span className={styles.doubleDot} /> : null}
                      {isMarker && fret !== 12 ? <span className={styles.fretDot} /> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className={styles.notesLayer}>
          {mergedDots.map((dot) => {
            const row = stringToVisualRow(dot.string, stringCount);
            const fretToLeft = (fret: number) =>
              practice.leftHanded
                ? 100 - ((fret + 0.5) / (MAX_FRET + 1)) * 100
                : ((fret + 0.5) / (MAX_FRET + 1)) * 100;
            const bendCtx: BendVisualContext | undefined = dot.bend
              ? {
                  state: dot.state,
                  currentTick,
                  startTick: dot.startTick,
                  endTick: dot.endTick,
                }
              : undefined;
            const leftPct = fretToLeft(dot.fret);
            const topPct = ((row + 0.5) / stringCount) * 100;
            const colors = blendTrackNoteColors(dot.trackIndices, neckTrackIndices);
            const bendLiftPx =
              dot.bend && bendCtx
                ? bendVisualLiftPx(dot.bend, bendCtx, stringCount)
                : 0;
            const showBadge = shouldShowBendBadge(
              dot.bend,
              practice.showBendBadges,
            );
            const isBending = bendLiftPx > 0.5;

            return (
              <div
                key={dot.id}
                className={`${styles.notePosition} ${isBending ? styles.bendLift : ''}`}
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  transform:
                    bendLiftPx > 0
                      ? `translateY(calc(-1 * ${bendLiftPx}px))`
                      : undefined,
                }}
              >
                <NoteDot
                  state={dot.state}
                  intensity={dot.intensity}
                  displayMode={displayMode}
                  label={dot.label}
                  leftHanded={practice.leftHanded}
                  colors={colors}
                  bend={showBadge ? dot.bend : undefined}
                />
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
}
