import type { TrackInfo } from '../types/guitar';
import { getTrackNoteColors } from '../utils/trackColors';
import { GuitarIcon, SpeakerIcon } from './TrackIcons';
import styles from './TrackSelector.module.css';

type TrackSelectorProps = {
  tracks: TrackInfo[];
  neckTrackIndices: number[];
  audioTrackIndices: number[];
  onNeckChange: (indices: number[]) => void;
  onAudioChange: (indices: number[]) => void;
  noteCountByTrack?: Map<number, number>;
};

function toggleIndex(indices: number[], index: number): number[] {
  if (indices.includes(index)) {
    return indices.filter((i) => i !== index);
  }
  return [...indices, index].sort((a, b) => a - b);
}

export function TrackSelector({
  tracks,
  neckTrackIndices,
  audioTrackIndices,
  onNeckChange,
  onAudioChange,
  noteCountByTrack,
}: TrackSelectorProps) {
  if (tracks.length === 0) {
    return <p className={styles.empty}>This file has no tracks.</p>;
  }

  const neckSet = new Set(neckTrackIndices);
  const audioSet = new Set(audioTrackIndices);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.label}>Tracks</span>
        <div className={styles.legend} title="Guitar = notes on neck · Speaker = audio">
          <GuitarIcon className={styles.legendIcon} />
          <SpeakerIcon className={styles.legendIcon} />
        </div>
      </div>

      <ul className={styles.list} role="group" aria-label="Tracks">
        {tracks.map((track) => {
          const noteCount = noteCountByTrack?.get(track.index);
          const onNeck = neckSet.has(track.index);
          const onAudio = audioSet.has(track.index);
          const swatch =
            onNeck && neckTrackIndices.length > 0
              ? getTrackNoteColors(track.index, neckTrackIndices).activeBg
              : undefined;

          const kindLabel =
            track.kind === 'guitar'
              ? 'guitar'
              : track.kind === 'bass'
                ? 'bass'
                : track.kind === 'percussion'
                  ? 'drums'
                  : 'other';
          const meta = [
            kindLabel,
            `${track.stringCount} strings`,
            noteCount != null ? `${noteCount} notes` : null,
          ]
            .filter(Boolean)
            .join(' · ');

          return (
            <li key={track.index}>
              <div className={styles.trackRow}>
                <div className={styles.toggles}>
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${onNeck ? styles.iconBtnOn : ''}`}
                    aria-pressed={onNeck}
                    aria-label={`${onNeck ? 'Hide' : 'Show'} ${track.name} on fretboard`}
                    title="Show notes on fretboard"
                    onClick={() => onNeckChange(toggleIndex(neckTrackIndices, track.index))}
                  >
                    <GuitarIcon />
                  </button>
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${styles.iconBtnAudio} ${onAudio ? styles.iconBtnOn : ''}`}
                    aria-pressed={onAudio}
                    aria-label={`${onAudio ? 'Mute' : 'Play'} ${track.name}`}
                    title="Play track audio"
                    onClick={() => onAudioChange(toggleIndex(audioTrackIndices, track.index))}
                  >
                    <SpeakerIcon />
                  </button>
                </div>
                <div className={styles.trackInfo}>
                  <span className={styles.trackNameRow}>
                    {swatch ? (
                      <span
                        className={styles.colorSwatch}
                        style={{ background: swatch }}
                        aria-hidden="true"
                      />
                    ) : null}
                    <span className={styles.trackName}>{track.name}</span>
                  </span>
                  <span className={styles.trackMeta}>{meta}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {neckTrackIndices.length === 0 ? (
        <p className={styles.hint}>Enable a guitar icon to show notes on the fretboard and tab.</p>
      ) : null}
      {audioTrackIndices.length === 0 ? (
        <p className={styles.hint}>Enable a speaker icon to hear playback.</p>
      ) : null}
    </div>
  );
}
