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
  /** User color picker styles override track hues when enabled. */
  useCustomColors?: boolean;
  customStyle?: CSSProperties;
  bend?: NoteBendInfo;
};

export function NoteDot({
  state,
  intensity = 1,
  displayMode = 'standard',
  label,
  leftHanded,
  colors,
  useCustomColors = false,
  customStyle,
  bend,
}: NoteDotProps) {
  const trails = displayMode === 'trails';
  const classNames = [
    styles.dot,
    useCustomColors ? styles.customColors : '',
    useCustomColors && state === 'active' ? styles.customActive : '',
    useCustomColors && state === 'smolder' && trails ? styles.customSmolderAnim : '',
    !useCustomColors && colors && state !== 'past' ? styles.custom : '',
    !useCustomColors && trails ? styles.trails : '',
    !useCustomColors ? styles[state] : '',
    bend ? styles.hasBend : '',
    leftHanded ? styles.leftHanded : '',
  ]
    .filter(Boolean)
    .join(' ');

  const inlineStyle = useCustomColors
    ? customStyle
    : colors && state !== 'past' && state !== 'smolder'
      ? {
          ...stateStyle(state, colors, intensity, trails),
          ...(trails && state !== 'full'
            ? ({ '--trail-intensity': String(intensity) } as CSSProperties)
            : undefined),
        }
      : trails && state !== 'full'
        ? ({ '--trail-intensity': String(intensity) } as CSSProperties)
        : undefined;

  return (
    <div
      className={classNames}
      style={inlineStyle}
      data-note-state={state}
      data-display-mode={displayMode}
      data-custom-colors={useCustomColors ? 'true' : undefined}
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
