import type { SongMetadata } from '../types/guitar';
import styles from './SongInfoPanel.module.css';

type SongInfoPanelProps = {
  metadata: SongMetadata | null;
  trackName?: string;
  noteCount?: number;
  capoFret?: number;
  tuningHeadline?: string;
  tuningDetail?: string;
};

export function SongInfoPanel({
  metadata,
  trackName,
  noteCount,
  capoFret,
  tuningHeadline,
  tuningDetail,
}: SongInfoPanelProps) {
  if (!metadata) {
    return (
      <section className={styles.panel}>
        <p className={styles.placeholder}>Upload a tab file to see song info.</p>
      </section>
    );
  }

  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>{metadata.title}</h2>
      {metadata.artist ? <p className={styles.artist}>{metadata.artist}</p> : null}
      <dl className={styles.meta}>
        {metadata.tempo != null ? (
          <>
            <dt>Tempo</dt>
            <dd>{Math.round(metadata.tempo)} BPM</dd>
          </>
        ) : null}
        {trackName ? (
          <>
            <dt>Tracks</dt>
            <dd>{trackName}</dd>
          </>
        ) : null}
        {noteCount != null ? (
          <>
            <dt>Notes</dt>
            <dd>{noteCount}</dd>
          </>
        ) : null}
        {capoFret != null && capoFret > 0 ? (
          <>
            <dt>Capo</dt>
            <dd>Fret {capoFret}</dd>
          </>
        ) : null}
        {tuningHeadline ? (
          <>
            <dt>Tuning</dt>
            <dd>
              {tuningHeadline}
              {tuningDetail ? (
                <>
                  <br />
                  <span className={styles.tuningDetail}>{tuningDetail}</span>
                </>
              ) : null}
            </dd>
          </>
        ) : null}
      </dl>
    </section>
  );
}
