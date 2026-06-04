import { formatTime } from '../utils/noteHelpers';
import {
  LoopIcon,
  MetronomeIcon,
  PauseIcon,
  PlayIcon,
  RestartIcon,
} from './PlaybackIcons';
import styles from './PlaybackControls.module.css';

const SPEEDS = [0.5, 0.75, 1, 1.25] as const;

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
  onPlayPause: () => void;
  onRestart: () => void;
  onSeek: (ms: number) => void;
  onSpeedChange: (speed: number) => void;
  onMetronomeToggle: () => void;
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
  onPlayPause,
  onRestart,
  onSeek,
  onSpeedChange,
  onMetronomeToggle,
  onLoopEnabledChange,
  onLoopRangeChange,
}: PlaybackControlsProps) {
  const max = Math.max(totalMs, 1);
  const loopStartMax = Math.max(loopEndMs - 500, 0);
  const loopEndMin = Math.min(loopStartMs + 500, max);

  if (docked) {
    return (
      <section className={`${styles.panel} ${styles.panelDocked}`}>
        <div className={styles.dockBar}>
          <div className={styles.transport}>
            <button
              type="button"
              className={styles.iconBtnPrimary}
              onClick={onPlayPause}
              disabled={!isReady}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={onRestart}
              disabled={!isReady}
              aria-label="Restart"
              title="Restart"
            >
              <RestartIcon />
            </button>
            <button
              type="button"
              className={`${styles.iconBtn} ${metronomeOn ? styles.iconBtnOn : ''}`}
              onClick={onMetronomeToggle}
              disabled={!isReady}
              aria-label={metronomeOn ? 'Metronome on' : 'Metronome off'}
              aria-pressed={metronomeOn}
              title="Metronome"
            >
              <MetronomeIcon />
            </button>
            <button
              type="button"
              className={`${styles.iconBtn} ${loopEnabled ? styles.iconBtnOn : ''}`}
              onClick={() => onLoopEnabledChange(!loopEnabled)}
              disabled={!isReady}
              aria-label={loopEnabled ? 'Loop section on' : 'Loop section off'}
              aria-pressed={loopEnabled}
              title="Loop section"
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

        {loopEnabled ? (
          <div className={styles.loopBar}>
            <span className={styles.loopTime}>{formatTime(loopStartMs)}</span>
            <input
              type="range"
              className={styles.loopRange}
              min={0}
              max={loopStartMax}
              value={Math.min(loopStartMs, loopStartMax)}
              onChange={(e) => onLoopRangeChange(Number(e.target.value), loopEndMs)}
              disabled={!isReady}
              aria-label="Loop start"
            />
            <span className={styles.loopDivider} aria-hidden="true">
              –
            </span>
            <input
              type="range"
              className={styles.loopRange}
              min={loopEndMin}
              max={max}
              value={Math.min(loopEndMs, max)}
              onChange={(e) => onLoopRangeChange(loopStartMs, Number(e.target.value))}
              disabled={!isReady}
              aria-label="Loop end"
            />
            <span className={styles.loopTime}>{formatTime(loopEndMs)}</span>
          </div>
        ) : null}

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
          onClick={onPlayPause}
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
