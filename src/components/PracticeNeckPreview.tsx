import { useEffect, useMemo, useState } from 'react';
import type { DisplayMode, PracticeSettings } from '../types/guitar';
import {
  buildPreviewEventsForScale,
  DEFAULT_PREVIEW_KEY,
  DEFAULT_PREVIEW_SCALE_ID,
  PRACTICE_PREVIEW_KEYS,
  PRACTICE_PREVIEW_SCALES,
  PREVIEW_BPM_DEFAULT,
  PREVIEW_BPM_MAX,
  PREVIEW_BPM_MIN,
  type PracticePreviewKeyId,
  type PracticePreviewScaleId,
  practicePreviewCycleMs,
  previewCycleTicksForScale,
  previewScaleHint,
  previewTickAtElapsedMs,
} from '../data/practicePreviewNotes';
import { STANDARD_TUNING_TOP_DOWN } from '../utils/stringTuning';
import { GuitarNeck } from './GuitarNeck';
import styles from './PracticeNeckPreview.module.css';

type PracticeNeckPreviewProps = {
  practice: PracticeSettings;
  displayMode: DisplayMode;
};

export function PracticeNeckPreview({
  practice,
  displayMode,
}: PracticeNeckPreviewProps) {
  const [previewBpm, setPreviewBpm] = useState(PREVIEW_BPM_DEFAULT);
  const [scaleId, setScaleId] = useState<PracticePreviewScaleId>(
    DEFAULT_PREVIEW_SCALE_ID,
  );
  const [previewKey, setPreviewKey] = useState<PracticePreviewKeyId>(
    DEFAULT_PREVIEW_KEY,
  );
  const [previewTick, setPreviewTick] = useState(0);
  const [loopPhase, setLoopPhase] = useState(0);

  const previewEvents = useMemo(
    () => buildPreviewEventsForScale(scaleId, previewKey),
    [scaleId, previewKey],
  );
  const cycleTicks = useMemo(
    () => previewCycleTicksForScale(scaleId, previewKey),
    [scaleId, previewKey],
  );

  const cycleMs = useMemo(
    () => practicePreviewCycleMs(previewBpm, scaleId, previewKey),
    [previewBpm, scaleId, previewKey],
  );

  useEffect(() => {
    const started = performance.now();
    let frame = 0;

    const step = (now: number) => {
      const elapsed = now - started;
      const tick = previewTickAtElapsedMs(elapsed, previewBpm) % cycleTicks;
      setPreviewTick(tick);
      setLoopPhase(tick / cycleTicks);
      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [previewBpm, cycleTicks]);

  const tuningMidi = practice.showStandardTuning
    ? [...STANDARD_TUNING_TOP_DOWN]
    : undefined;

  const loopSeconds = Math.round(cycleMs / 1000);
  const quarterMs = Math.round(60_000 / previewBpm);
  const hint = previewScaleHint(scaleId, previewKey);

  return (
    <div className={styles.wrap} aria-label="Practice settings preview">
      <div className={styles.header}>
        <span className={styles.title}>Preview</span>
        <span className={styles.hint}>
          ~{loopSeconds}s loop · one note per beat (~{quarterMs}ms) · {hint}
        </span>
      </div>
      <div className={styles.progressTrack} aria-hidden>
        <div className={styles.progressFill} style={{ width: `${loopPhase * 100}%` }} />
      </div>
      <div className={styles.neckShell}>
        <GuitarNeck
          events={previewEvents}
          currentTick={previewTick}
          playbackTempo={previewBpm}
          displayMode={displayMode}
          practice={practice}
          stringCount={6}
          neckTrackIndices={[0]}
          capoFret={0}
          tuningMidi={tuningMidi}
          showSetupBadges={false}
        />
      </div>
      <div className={styles.scaleControls}>
        <label className={styles.scaleRow}>
          <span className={styles.scaleLabel}>Key</span>
          <select
            className={styles.scaleSelect}
            value={previewKey}
            onChange={(e) => setPreviewKey(e.target.value as PracticePreviewKeyId)}
            aria-label="Preview scale key"
          >
            {PRACTICE_PREVIEW_KEYS.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.scaleRow}>
          <span className={styles.scaleLabel}>Scale</span>
          <select
            className={styles.scaleSelect}
            value={scaleId}
            onChange={(e) => setScaleId(e.target.value as PracticePreviewScaleId)}
            aria-label="Preview scale pattern"
          >
            {PRACTICE_PREVIEW_SCALES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={styles.tempoRow}>
        <span className={styles.tempoLabel}>
          Preview tempo <strong>{previewBpm} BPM</strong>
        </span>
        <input
          type="range"
          className={styles.tempoSlider}
          min={PREVIEW_BPM_MIN}
          max={PREVIEW_BPM_MAX}
          step={4}
          value={previewBpm}
          onChange={(e) => setPreviewBpm(Number(e.target.value))}
          aria-label="Preview playback tempo in beats per minute"
        />
        <span className={styles.tempoHints}>
          <span>slower</span>
          <span>faster</span>
        </span>
      </label>
    </div>
  );
}
