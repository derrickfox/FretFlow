import type { RefObject } from 'react';
import styles from './TabViewer.module.css';

type TabViewerProps = {
  visible: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  hostRef: RefObject<HTMLDivElement | null>;
};

/**
 * Scroll container + mount point for alphaTab notation (tab syncs via playbackEngine).
 */
export function TabViewer({ visible, scrollRef, hostRef }: TabViewerProps) {
  if (!visible) return null;

  return (
    <section className={styles.panel} aria-label="Guitar tab notation">
      <div className={styles.panelHeader}>
        <h2 className={styles.title}>Tab</h2>
        <span className={styles.hint}>Scrolls with playback</span>
      </div>
      <div ref={scrollRef} className={styles.scroll}>
        <div ref={hostRef} className={styles.host} />
      </div>
    </section>
  );
};
