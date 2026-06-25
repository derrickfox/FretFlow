import type { PointerEvent, RefObject } from 'react';
import type { BeatClickRange, BeatTickRange, MarkerRect } from '../services/playbackEngine';
import { playbackEngine } from '../services/playbackEngine';
import { LoopMarkers } from './LoopMarkers';
import styles from './TabViewer.module.css';

type TabViewerProps = {
  visible: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  hostRef: RefObject<HTMLDivElement | null>;
  loopEnabled: boolean;
  /** Show only the start marker — used during the 'awaiting-end' phase of selection */
  showStartOnly: boolean;
  loopStartMs: number;
  loopStartMarkerRect?: MarkerRect | null;
  loopEndMs: number;
  loopEndMarkerRect?: MarkerRect | null;
  currentTick: number;
  loopPlaybackTickRange?: BeatTickRange | null;
  /** Selection-mode hint to colour the tab when waiting for a click */
  selecting: boolean;
  /** Bumped whenever alphaTab finishes a render so overlay markers can reposition */
  renderTick: number;
  onLoopRangeChange: (startMs: number, endMs: number) => void;
  onTabBeatClick: (beatRange: BeatClickRange) => void;
};

/**
 * Scroll container + mount point for alphaTab notation (tab syncs via playbackEngine).
 */
export function TabViewer({
  visible,
  scrollRef,
  hostRef,
  loopEnabled,
  showStartOnly,
  loopStartMs,
  loopStartMarkerRect,
  loopEndMs,
  loopEndMarkerRect,
  currentTick,
  loopPlaybackTickRange = null,
  selecting,
  renderTick,
  onLoopRangeChange,
  onTabBeatClick,
}: TabViewerProps) {
  if (!visible) return null;

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!selecting) return;
    const beatRange = playbackEngine.beatRangeAtClientPoint(event.clientX, event.clientY);
    if (!beatRange) return;
    event.preventDefault();
    onTabBeatClick(beatRange);
  };

  return (
    <section className={styles.panel} aria-label="Guitar tab notation">
      {/* AI_CHANGE:
          Tool: Codex
          Model: GPT-5
          Timestamp: 2026-06-25T17:47:42-04:00
          Purpose: Remove the visible tab header so notation starts immediately below the fretboard.
          Reason: The header repeated low-value labels and consumed practice viewport space. */}
      <div ref={scrollRef} className={styles.scroll}>
        <div
          className={`${styles.hostWrap} ${selecting ? styles.hostWrapSelecting : ''} ${
            loopPlaybackTickRange ? styles.hostWrapLooping : ''
          }`}
          onPointerDown={handlePointerDown}
        >
          <div ref={hostRef} className={styles.host} />
          <LoopMarkers
            visible={loopEnabled || showStartOnly}
            startOnly={showStartOnly}
            loopStartMs={loopStartMs}
            loopStartMarkerRect={loopStartMarkerRect}
            loopEndMs={loopEndMs}
            loopEndMarkerRect={loopEndMarkerRect}
            currentTick={currentTick}
            loopPlaybackTickRange={loopPlaybackTickRange}
            renderTick={renderTick}
            onChange={onLoopRangeChange}
          />
        </div>
      </div>
    </section>
  );
};
