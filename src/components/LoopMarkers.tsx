// AI_CHANGE:
// Tool: Claude Code
// Model: claude-opus-4-7
// Timestamp: 2026-06-25T14:30:00-04:00
// Purpose: Render draggable start/end markers anchored to alphaTab beat bounds.
// Reason: New click-to-set + grab-and-slide loop UX needs visible handles on the tab.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MarkerRect } from '../services/playbackEngine';
import type { BeatTickRange } from '../services/playbackEngine';
import { playbackEngine } from '../services/playbackEngine';
import styles from './LoopMarkers.module.css';

type LoopMarkersProps = {
  visible: boolean;
  /** Show only the start marker (no drag) — used during the click-to-set flow */
  startOnly?: boolean;
  loopStartMs: number;
  /** Optional visual anchor for A when click timing and rendered beat lookup differ. */
  loopStartMarkerRect?: MarkerRect | null;
  loopEndMs: number;
  /** Optional visual anchor for B when playback end differs from the clicked beat. */
  loopEndMarkerRect?: MarkerRect | null;
  /** Bumped by App whenever alphaTab finishes a render so positions recompute */
  renderTick: number;
  currentTick: number;
  loopPlaybackTickRange?: BeatTickRange | null;
  onChange: (startMs: number, endMs: number) => void;
};

function computeRect(ms: number): MarkerRect | null {
  return playbackEngine.markerRectForMs(ms);
}

export function LoopMarkers({
  visible,
  startOnly = false,
  loopStartMs,
  loopStartMarkerRect = null,
  loopEndMs,
  loopEndMarkerRect = null,
  renderTick,
  currentTick,
  loopPlaybackTickRange = null,
  onChange,
}: LoopMarkersProps) {
  const [startRect, setStartRect] = useState<MarkerRect | null>(null);
  const [endRect, setEndRect] = useState<MarkerRect | null>(null);
  const draggingRef = useRef<'start' | 'end' | null>(null);
  const liveRef = useRef({ start: loopStartMs, end: loopEndMs });

  useEffect(() => {
    liveRef.current = { start: loopStartMs, end: loopEndMs };
  }, [loopStartMs, loopEndMs]);

  const reposition = useCallback(() => {
    setStartRect(loopStartMarkerRect ?? computeRect(loopStartMs));
    setEndRect(loopEndMarkerRect ?? computeRect(loopEndMs));
  }, [loopStartMarkerRect, loopStartMs, loopEndMarkerRect, loopEndMs]);

  useLayoutEffect(() => {
    if (!visible) return;
    reposition();
  }, [visible, reposition, renderTick]);

  useEffect(() => {
    if (!visible) return;
    const handle = window.setTimeout(reposition, 50);
    return () => window.clearTimeout(handle);
  }, [visible, reposition]);

  const handlePointerDown = useCallback(
    (which: 'start' | 'end') => (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      draggingRef.current = which;
      (event.target as Element).setPointerCapture?.(event.pointerId);
    },
    [],
  );

  useEffect(() => {
    if (!visible) return;
    const onMove = (event: PointerEvent) => {
      const which = draggingRef.current;
      if (!which) return;
      const ms = playbackEngine.beatTimeAtClientPoint(event.clientX, event.clientY);
      if (ms == null) return;
      const { start, end } = liveRef.current;
      const MIN_SPAN = 250;
      if (which === 'start') {
        const next = Math.min(ms, Math.max(end - MIN_SPAN, 0));
        if (next === start) return;
        liveRef.current = { start: next, end };
        onChange(next, end);
      } else {
        const next = Math.max(ms, start + MIN_SPAN);
        if (next === end) return;
        liveRef.current = { start, end: next };
        onChange(start, next);
      }
    };
    const onUp = () => {
      draggingRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [visible, onChange]);

  const region = useMemo(() => {
    if (startOnly) return null;
    if (!startRect || !endRect) return null;
    const left = Math.min(startRect.x, endRect.x);
    const right = Math.max(startRect.x, endRect.x);
    const top = Math.min(startRect.y, endRect.y);
    const bottom = Math.max(
      startRect.y + startRect.height,
      endRect.y + endRect.height,
    );
    if (Math.abs(startRect.y - endRect.y) > 1) return null;
    return { left, top, width: right - left, height: bottom - top };
  }, [startRect, endRect]);

  const playbackCursor = useMemo(() => {
    if (startOnly || !startRect || !endRect || !loopPlaybackTickRange) return null;
    const span = loopPlaybackTickRange.endTick - loopPlaybackTickRange.startTick;
    if (span <= 0 || Math.abs(startRect.y - endRect.y) > 1) return null;
    const ratio = Math.max(
      0,
      Math.min(1, (currentTick - loopPlaybackTickRange.startTick) / span),
    );
    return {
      x: startRect.x + (endRect.x - startRect.x) * ratio,
      y: startRect.y,
      height: startRect.height,
    };
  }, [currentTick, endRect, loopPlaybackTickRange, startOnly, startRect]);

  if (!visible) return null;

  return (
    <div className={styles.overlay} aria-hidden="true">
      {region ? (
        <div
          className={styles.region}
          style={{
            left: `${region.left}px`,
            top: `${region.top}px`,
            width: `${region.width}px`,
            height: `${region.height}px`,
          }}
        />
      ) : null}
      {startRect ? (
        <div
          className={`${styles.marker} ${styles.markerStart}`}
          style={{
            left: `${startRect.x - 1}px`,
            top: `${startRect.y}px`,
            height: `${startRect.height}px`,
          }}
          onPointerDown={handlePointerDown('start')}
          role="slider"
          aria-label="Loop start"
          data-testid="loop-start-marker"
        >
          <div className={styles.markerLine} />
          <div className={styles.handle}>A</div>
        </div>
      ) : null}
      {playbackCursor ? (
        <div
          className={styles.playbackCursor}
          style={{
            left: `${playbackCursor.x - 1}px`,
            top: `${playbackCursor.y}px`,
            height: `${playbackCursor.height}px`,
          }}
          data-testid="repeat-playback-cursor"
        />
      ) : null}
      {endRect && !startOnly ? (
        <div
          className={`${styles.marker} ${styles.markerEnd}`}
          style={{
            left: `${endRect.x - 1}px`,
            top: `${endRect.y}px`,
            height: `${endRect.height}px`,
          }}
          onPointerDown={handlePointerDown('end')}
          role="slider"
          aria-label="Loop end"
          data-testid="loop-end-marker"
        >
          <div className={styles.markerLine} />
          <div className={styles.handle}>B</div>
        </div>
      ) : null}
    </div>
  );
}
