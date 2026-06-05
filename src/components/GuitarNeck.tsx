import { useMemo, type CSSProperties } from 'react';
import type { GuitarNoteEvent, PracticeSettings } from '../types/guitar';
import { FRET_MARKERS } from '../types/guitar';
import {
  formatTuningDetail,
  isStandardTuning,
  neckStringLabels,
  tabFretToNeckFret,
} from '../utils/stringTuning';
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
import { buildCustomNoteDotStyle } from '../utils/noteColors';
import { mergeNotesAtSameFret } from '../utils/mergeNeckDots';
import { blendTrackNoteColors } from '../utils/trackColors';
import {
  computeDisplayMaxFret,
  neckFretToLeftPercent,
} from '../utils/neckFretSpan';
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
  /** Capo fret to mark on the neck (max among visible guitar tracks). */
  capoFret?: number;
  /** Open-string MIDI top → bottom for labels (from primary neck track). */
  tuningMidi?: number[];
  tuningName?: string;
  /** Capo/tuning badges above the neck (off in practice preview). */
  showSetupBadges?: boolean;
};

export function GuitarNeck({
  events,
  currentTick,
  playbackTempo,
  displayMode,
  practice,
  stringCount = 6,
  neckTrackIndices,
  capoFret = 0,
  tuningMidi,
  tuningName,
  showSetupBadges = true,
}: GuitarNeckProps) {
  const displayMaxFret = useMemo(
    () => computeDisplayMaxFret(events, capoFret),
    [events, capoFret],
  );
  const frets = useMemo(
    () => Array.from({ length: displayMaxFret + 1 }, (_, i) => i),
    [displayMaxFret],
  );
  const strings = useMemo(() => {
    if (!practice.showStandardTuning) {
      return Array.from({ length: stringCount }, (_, i) => `S${stringCount - i}`);
    }
    if (tuningMidi?.length) {
      return neckStringLabels(tuningMidi, stringCount);
    }
    return neckStringLabels([64, 59, 55, 50, 45, 40], stringCount);
  }, [practice.showStandardTuning, stringCount, tuningMidi]);

  const useCustomColors = displayMode === 'trails';

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
        ? trailsGlowFromPractice(practice.trailsPeakGlow, 100)
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
    practice.showNoteNames,
  ]);

  const liveFretsOnNeck = useMemo(
    () =>
      new Set(
        mergedDots
          .filter((d) => d.layer === 'live')
          .map((d) => `${d.string}-${d.fret}`),
      ),
    [mergedDots],
  );

  const neckClass = [
    styles.neck,
    practice.leftHanded ? styles.leftHanded : '',
  ]
    .filter(Boolean)
    .join(' ');

  const standardTuning = tuningMidi ? isStandardTuning(tuningMidi) : true;
  const tuningDetail =
    tuningMidi && !standardTuning
      ? tuningName?.trim() || formatTuningDetail(tuningMidi, stringCount)
      : undefined;

  return (
    <div
      className={styles.wrapper}
      data-fretboard-dots={mergedDots.length}
      data-fretboard-events={events.length}
    >
      <div
        className={neckClass}
        style={{ '--fret-count': String(displayMaxFret + 1) } as CSSProperties}
      >
        {showSetupBadges && (capoFret > 0 || tuningMidi) && (
          <div className={styles.neckSetup}>
            {capoFret > 0 ? (
              <span className={styles.capoBadge}>Capo {capoFret}</span>
            ) : null}
            {tuningMidi ? (
              <div className={styles.tuningBadgeGroup}>
                <span className={styles.tuningBadge}>
                  {standardTuning ? 'Standard' : 'Alternate tuning'}
                </span>
                {tuningDetail ? (
                  <span className={styles.tuningDetail}>{tuningDetail}</span>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
        <div className={styles.fretNumbers}>
          <div className={styles.corner} />
          {frets.map((fret) => (
            <div
              key={fret}
              className={`${styles.fretNumber} ${fret === capoFret && capoFret > 0 ? styles.capoFretNumber : ''}`}
            >
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
                  const behindCapo = capoFret > 0 && fret > 0 && fret < capoFret;
                  const isCapoFret = capoFret > 0 && fret === capoFret;
                  return (
                    <div
                      key={fret}
                      className={`${styles.cell} ${isMarker ? styles.markerFret : ''} ${fret === 0 ? styles.nut : ''} ${behindCapo ? styles.behindCapo : ''} ${isCapoFret ? styles.capoFretCell : ''}`}
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
          {capoFret > 0 ? (
            <div
              className={styles.capoBar}
              style={{
                left: `${neckFretToLeftPercent(capoFret, displayMaxFret, practice.leftHanded)}%`,
              }}
              aria-hidden
            />
          ) : null}
          {mergedDots.map((dot) => {
            const row = stringToVisualRow(dot.string, stringCount);
            const bendCtx: BendVisualContext | undefined = dot.bend
              ? {
                  state: dot.state,
                  currentTick,
                  startTick: dot.startTick,
                  endTick: dot.endTick,
                }
              : undefined;
            const neckFret = tabFretToNeckFret(dot.fret, dot.capo);
            const leftPct = neckFretToLeftPercent(
              neckFret,
              displayMaxFret,
              practice.leftHanded,
            );
            const topPct = ((row + 0.5) / stringCount) * 100;
            const trackColors = blendTrackNoteColors(
              dot.trackIndices,
              neckTrackIndices,
            );
            const customDotStyle = useCustomColors
              ? buildCustomNoteDotStyle(
                  dot.state,
                  dot.intensity,
                  dot.approachBlend,
                  {
                    upcoming: practice.noteColorUpcoming,
                    active: practice.noteColorActive,
                    played: practice.noteColorPlayed,
                  },
                  true,
                )
              : undefined;
            const bendLiftPx =
              dot.bend && bendCtx
                ? bendVisualLiftPx(dot.bend, bendCtx, stringCount)
                : 0;
            const showBadge = shouldShowBendBadge(
              dot.bend,
              practice.showBendBadges,
            );
            const isBending = bendLiftPx > 0.5;
            const lingerSharesFret =
              dot.layer === 'linger' &&
              liveFretsOnNeck.has(`${dot.string}-${dot.fret}`);
            const positionTransform = [
              lingerSharesFret ? 'translate(3px, -3px)' : null,
              bendLiftPx > 0
                ? `translateY(calc(-1 * ${bendLiftPx}px))`
                : null,
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <div
                key={dot.id}
                className={`${styles.notePosition} ${isBending ? styles.bendLift : ''}`}
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  transform: positionTransform || undefined,
                }}
              >
                <NoteDot
                  state={dot.state}
                  intensity={dot.intensity}
                  displayMode={displayMode}
                  label={dot.label}
                  leftHanded={practice.leftHanded}
                  colors={useCustomColors ? undefined : trackColors}
                  useCustomColors={useCustomColors}
                  customStyle={customDotStyle}
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
