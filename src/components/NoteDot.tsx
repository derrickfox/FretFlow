import type { CSSProperties } from 'react';
import type { DisplayMode } from '../types/guitar';
import type { NoteBendInfo } from '../utils/bendDisplay';
import { formatBendLabel } from '../utils/bendDisplay';
import type { NoteVisualState } from '../utils/noteHelpers';
import type { TrackNoteColors } from '../utils/trackColors';
import styles from './NoteDot.module.css';

type NoteDotProps = {
  state: NoteVisualState;
  intensity?: number;
  displayMode?: DisplayMode;
  label?: string;
  leftHanded?: boolean;
  colors?: TrackNoteColors;
  bend?: NoteBendInfo;
};

export function NoteDot({
  state,
  intensity = 1,
  displayMode = 'standard',
  label,
  leftHanded,
  colors,
  bend,
}: NoteDotProps) {
  const trails = displayMode === 'trails';
  const classNames = [
    styles.dot,
    colors && state !== 'smolder' && state !== 'past' ? styles.custom : '',
    trails ? styles.trails : '',
    bend ? styles.hasBend : '',
    styles[state],
    leftHanded ? styles.leftHanded : '',
  ]
    .filter(Boolean)
    .join(' ');

  const trailStyle =
    trails && state !== 'full'
      ? ({ '--trail-intensity': String(intensity) } as CSSProperties)
      : undefined;

  const customStyle =
    colors && state !== 'past' && state !== 'smolder'
      ? { ...stateStyle(state, colors, intensity, trails), ...trailStyle }
      : trailStyle;

  return (
    <div
      className={classNames}
      style={customStyle}
      data-note-state={state}
      data-display-mode={displayMode}
      title={
        bend
          ? `${label ? `${label} · ` : ''}${formatBendLabel(bend)}`
          : label
      }
    >
      {bend ? (
        <span className={styles.bendBadge} aria-hidden>
          {formatBendLabel(bend)}
        </span>
      ) : null}
      {label ? <span className={styles.label}>{label}</span> : null}
    </div>
  );
}

function stateStyle(
  state: NoteVisualState,
  colors: TrackNoteColors,
  intensity: number,
  trails: boolean,
): CSSProperties | undefined {
  const i = trails ? intensity : 1;
  switch (state) {
    case 'active':
      return {
        background: colors.activeBg,
        boxShadow: colors.activeShadow,
        opacity: trails ? 1 : undefined,
        zIndex: 3,
      };
    case 'upcoming':
      return {
        background: colors.upcomingBg,
        border: `1px solid ${colors.upcomingBorder}`,
        opacity: trails ? 0.15 + i * 0.85 : 0.55,
        boxShadow: trails
          ? `0 0 ${4 + 14 * i}px rgba(120, 170, 255, ${0.15 + 0.55 * i})`
          : undefined,
        zIndex: 2,
      };
    case 'full':
      return {
        background: colors.fullBg,
        border: `1px solid ${colors.fullBorder}`,
        zIndex: 1,
      };
    default:
      return undefined;
  }
}
