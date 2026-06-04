import { useMemo } from 'react';
import type { GuitarNoteEvent, PracticeSettings } from '../types/guitar';
import { FRET_MARKERS, MAX_FRET, STANDARD_TUNING } from '../types/guitar';
import type { DisplayMode } from '../types/guitar';
import {
  classifyNoteAtTime,
  filterEventsInTimeWindow,
  getPlaybackTimeWindow,
  stringToVisualRow,
} from '../utils/noteHelpers';
import { mergeNotesAtSameFret } from '../utils/mergeNeckDots';
import { blendTrackNoteColors } from '../utils/trackColors';
import { NoteDot } from './NoteDot';
import styles from './GuitarNeck.module.css';

type GuitarNeckProps = {
  events: GuitarNoteEvent[];
  currentMs: number;
  displayMode: DisplayMode;
  practice: PracticeSettings;
  stringCount?: number;
  /** Track indices shown on the neck — used for per-track dot colors */
  neckTrackIndices: number[];
};

export function GuitarNeck({
  events,
  currentMs,
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
    const { start, end } = getPlaybackTimeWindow(currentMs, noteLookaheadMs, noteLingerMs);
    const windowed = filterEventsInTimeWindow(events, start, end);
    const classified = windowed
      .map((note) => ({
        note,
        state: classifyNoteAtTime(
          note,
          currentMs,
          displayMode,
          noteLookaheadMs,
          noteLingerMs,
        ),
      }))
      .filter((x): x is { note: GuitarNoteEvent; state: NonNullable<ReturnType<typeof classifyNoteAtTime>> } =>
        x.state !== null,
      );
    return mergeNotesAtSameFret(classified, practice.showNoteNames);
  }, [
    events,
    currentMs,
    displayMode,
    practice.noteLookaheadMs,
    practice.noteLingerMs,
    practice.showNoteNames,
  ]);

  const neckClass = [
    styles.neck,
    practice.leftHanded ? styles.leftHanded : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.wrapper}>
      <div className={neckClass}>
        <div className={styles.fretNumbers}>
          <div className={styles.corner} />
          {frets.map((fret) => (
            <div key={fret} className={styles.fretNumber}>
              {fret}
            </div>
          ))}
        </div>

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
            const leftPct = practice.leftHanded
              ? 100 - ((dot.fret + 0.5) / (MAX_FRET + 1)) * 100
              : ((dot.fret + 0.5) / (MAX_FRET + 1)) * 100;
            const topPct = ((row + 0.5) / stringCount) * 100;
            const colors = blendTrackNoteColors(dot.trackIndices, neckTrackIndices);

            return (
              <div
                key={dot.id}
                className={styles.notePosition}
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                }}
              >
                <NoteDot
                  state={dot.state}
                  label={dot.label}
                  leftHanded={practice.leftHanded}
                  colors={colors}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
