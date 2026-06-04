import type { CSSProperties } from 'react';
import type { NoteVisualState } from '../utils/noteHelpers';
import type { TrackNoteColors } from '../utils/trackColors';
import styles from './NoteDot.module.css';

type NoteDotProps = {
  state: NoteVisualState;
  label?: string;
  leftHanded?: boolean;
  colors?: TrackNoteColors;
};

export function NoteDot({ state, label, leftHanded, colors }: NoteDotProps) {
  const classNames = [
    styles.dot,
    colors ? styles.custom : '',
    styles[state],
    leftHanded ? styles.leftHanded : '',
  ]
    .filter(Boolean)
    .join(' ');

  const customStyle =
    colors && state !== 'past'
      ? stateStyle(state, colors)
      : undefined;

  return (
    <div className={classNames} style={customStyle} title={label}>
      {label ? <span className={styles.label}>{label}</span> : null}
    </div>
  );
}

function stateStyle(
  state: NoteVisualState,
  colors: TrackNoteColors,
): CSSProperties | undefined {
  switch (state) {
    case 'active':
      return {
        background: colors.activeBg,
        boxShadow: colors.activeShadow,
        zIndex: 3,
      };
    case 'upcoming':
      return {
        background: colors.upcomingBg,
        border: `1px solid ${colors.upcomingBorder}`,
        opacity: 0.55,
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
