import { formatTime } from '../utils/noteHelpers';
import { primeAudioContextOnUserGesture } from '../utils/mobileAudio';
import { LoopIcon, PauseIcon, PlayIcon } from './PlaybackIcons';
import styles from './PlaybackControls.module.css';

const SPEEDS = [0.5, 0.75, 1, 1.25] as const;

type LoopSelectionMode = 'idle' | 'awaiting-start' | 'awaiting-end';

type PlaybackControlsProps = {
  /** Compact horizontal layout for the sticky top playback bar */
  docked?: boolean;
  isPlaying: boolean;
  isReady: boolean;
  currentMs: number;
  totalMs: number;
  speed: number;
  metronomeOn: boolean;
  loopEnabled: boolean;
  loopStartMs: number;
  loopEndMs: number;
  loopSelectionMode?: LoopSelectionMode;
  onPlayPause: () => void;
  onRestart: () => void;
  onSeek: (ms: number) => void;
  onSpeedChange: (speed: number) => void;
  onMetronomeToggle: () => void;
  /** Optional: when provided, the Loop button delegates to this instead of toggling */
  onLoopButtonClick?: () => void;
  onLoopEnabledChange: (enabled: boolean) => void;
  onLoopRangeChange: (startMs: number, endMs: number) => void;
};

export function PlaybackControls({
  docked = false,
  isPlaying,
  isReady,
  currentMs,
  totalMs,
  speed,
  metronomeOn,
  loopEnabled,
  loopStartMs,
  loopEndMs,
  loopSelectionMode = 'idle',
  onPlayPause,
  onRestart,
  onSeek,
  onSpeedChange,
  onMetronomeToggle,
  onLoopButtonClick,
  onLoopEnabledChange,
  onLoopRangeChange,
}: PlaybackControlsProps) {
  const selecting = loopSelectionMode !== 'idle';
  const handleLoopButton = () => {
    if (onLoopButtonClick) onLoopButtonClick();
    else onLoopEnabledChange(!loopEnabled);
  };
  const selectionHint =
    loopSelectionMode === 'awaiting-start'
      ? 'Click a note on the tab to set the loop start. Click Loop again to cancel.'
      : loopSelectionMode === 'awaiting-end'
      ? 'Now click a note to set the loop end.'
      : null;
  const max = Math.max(totalMs, 1);
  const loopStartMax = Math.max(loopEndMs - 500, 0);
  const loopEndMin = Math.min(loopStartMs + 500, max);

  const handlePlayPause = () => {
    primeAudioContextOnUserGesture();
    onPlayPause();
  };

  if (docked) {
    return (
      <section className={`${styles.panel} ${styles.panelDocked}`}>
        <div className={styles.dockBar}>
          <div className={styles.transport}>
            {/* AI_CHANGE:
                Tool: Codex
                Model: GPT-5
                Timestamp: 2026-06-25T17:18:07-04:00
                Purpose: Keep the docked transport focused on play/pause and Repeat.
                Reason: Restart and Metronome controls were removed from the primary practice dock per user annotation. */}
            <button
              type="button"
              className={styles.iconBtnPrimary}
              onClick={handlePlayPause}
              disabled={!isReady}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button
              type="button"
              className={`${styles.iconBtn} ${
                loopEnabled || selecting ? styles.iconBtnOn : ''
              } ${selecting ? styles.iconBtnSelecting : ''}`}
              onClick={handleLoopButton}
              disabled={!isReady}
              aria-label={
                selecting
                  ? 'Cancel loop selection'
                  : loopEnabled
                  ? 'Loop section on'
                  : 'Loop section off'
              }
              aria-pressed={loopEnabled || selecting}
              title={
                selecting
                  ? 'Click again to cancel loop selection'
                  : loopEnabled
                  ? 'Loop on — click to turn off'
                  : 'Loop section — click then pick start/end on the tab'
              }
            >
              <LoopIcon />
            </button>
          </div>

          <div className={styles.timeline}>
            <span className={styles.time}>{formatTime(currentMs)}</span>
            <input
              type="range"
              className={styles.seek}
              min={0}
              max={max}
              value={Math.min(currentMs, max)}
              onChange={(e) => onSeek(Number(e.target.value))}
              disabled={!isReady}
              aria-label="Playback position"
            />
            <span className={styles.time}>{formatTime(totalMs)}</span>
          </div>

          <div className={styles.speedSegment} role="group" aria-label="Playback speed">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                className={`${styles.speedChip} ${speed === s ? styles.speedChipOn : ''}`}
                onClick={() => onSpeedChange(s)}
                disabled={!isReady}
                aria-pressed={speed === s}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {selectionHint ? (
          <p className={styles.loopHint} role="status">
            {selectionHint}
          </p>
        ) : null}

        {/* AI_CHANGE:
            Tool: Codex
            Model: GPT-5
            Timestamp: 2026-06-25T17:18:07-04:00
            Purpose: Remove duplicate docked loop sliders while preserving tab-marker Repeat editing.
            Reason: Users now set Repeat bounds directly on the tab, so the extra sliders cluttered the dock. */}

        {!isReady ? <p className={styles.hintDocked}>Loading audio…</p> : null}
      </section>
    );
  }

  return (
    <section className={styles.panel}>
      <div className={styles.buttons}>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={handlePlayPause}
          disabled={!isReady}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button type="button" className={styles.btn} onClick={onRestart} disabled={!isReady}>
          Restart
        </button>
        <button
          type="button"
          className={`${styles.btn} ${metronomeOn ? styles.active : ''}`}
          onClick={onMetronomeToggle}
          disabled={!isReady}
          title="Metronome"
        >
          {`Metronome ${metronomeOn ? 'On' : 'Off'}`}
        </button>
      </div>

      <div className={styles.timeRow}>
        <span>{formatTime(currentMs)}</span>
        <input
          type="range"
          className={styles.seek}
          min={0}
          max={max}
          value={Math.min(currentMs, max)}
          onChange={(e) => onSeek(Number(e.target.value))}
          disabled={!isReady}
        />
        <span>{formatTime(totalMs)}</span>
      </div>

      <div className={styles.speedRow}>
        <span className={styles.speedLabel}>Speed</span>
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            className={`${styles.speedBtn} ${speed === s ? styles.speedActive : ''}`}
            onClick={() => onSpeedChange(s)}
            disabled={!isReady}
          >
            {s}x
          </button>
        ))}
      </div>

      <div className={styles.loopBlock}>
        <label className={styles.loopLabel}>
          <input
            type="checkbox"
            checked={loopEnabled}
            onChange={(e) => onLoopEnabledChange(e.target.checked)}
            disabled={!isReady}
          />
          Loop section
        </label>
        <div className={styles.loopSliders}>
          <label>
            Start {formatTime(loopStartMs)}
            <input
              type="range"
              min={0}
              max={loopStartMax}
              value={Math.min(loopStartMs, loopStartMax)}
              onChange={(e) => onLoopRangeChange(Number(e.target.value), loopEndMs)}
              disabled={!isReady || !loopEnabled}
            />
          </label>
          <label>
            End {formatTime(loopEndMs)}
            <input
              type="range"
              min={loopEndMin}
              max={max}
              value={Math.min(loopEndMs, max)}
              onChange={(e) => onLoopRangeChange(loopStartMs, Number(e.target.value))}
              disabled={!isReady || !loopEnabled}
            />
          </label>
        </div>
      </div>

      {!isReady ? (
        <p className={styles.hint}>Loading audio… enable Play once this message disappears.</p>
      ) : null}
    </section>
  );
}
