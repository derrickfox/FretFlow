import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseGuitarProFile } from '../src/services/guitarProParser';
import {
  bendCurrentSemitones,
  bendVisualLiftPx,
  formatBendAmount,
  formatBendLabel,
  interpolateBendGraph,
  shouldShowBendBadge,
} from '../src/utils/bendDisplay';

function loadBuffer(path: string): ArrayBuffer {
  const buf = readFileSync(path);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

describe('bend display', () => {
  it('formats semitone amounts for tab-style labels', () => {
    expect(formatBendAmount(0.5)).toBe('½');
    expect(formatBendAmount(1)).toBe('1');
    expect(formatBendAmount(1.5)).toBe('1½');
  });

  it('formats bend label with direction arrow', () => {
    expect(
      formatBendLabel({
        category: 'up',
        startSemitones: 0,
        peakSemitones: 1,
        endSemitones: 1,
      }),
    ).toBe('↑1');
  });

  it('interpolates bend graph across note progress', () => {
    const graph = [
      { offset: 0, semitones: 0 },
      { offset: 60, semitones: 2 },
    ];
    expect(interpolateBendGraph(graph, 0)).toBe(0);
    expect(interpolateBendGraph(graph, 0.5)).toBe(1);
    expect(interpolateBendGraph(graph, 1)).toBe(2);
  });

  it('tracks bend depth while note is active', () => {
    const bend = {
      category: 'up' as const,
      startSemitones: 0,
      peakSemitones: 2,
      endSemitones: 2,
    };
    const ctx = {
      state: 'active' as const,
      currentTick: 50,
      startTick: 0,
      endTick: 100,
    };
    expect(bendCurrentSemitones(bend, ctx)).toBe(1);
  });

  it('shows bend badge only when practice toggle is on', () => {
    const bend = {
      category: 'up' as const,
      startSemitones: 0,
      peakSemitones: 2,
      endSemitones: 2,
    };
    expect(shouldShowBendBadge(bend, false)).toBe(false);
    expect(shouldShowBendBadge(bend, true)).toBe(true);
    expect(shouldShowBendBadge(undefined, true)).toBe(false);
  });

  it('maps bend depth to upward pixel lift', () => {
    const bend = {
      category: 'up' as const,
      startSemitones: 0,
      peakSemitones: 2,
      endSemitones: 2,
    };
    const ctx = {
      state: 'active' as const,
      currentTick: 100,
      startTick: 0,
      endTick: 100,
    };
    expect(bendVisualLiftPx(bend, ctx, 6)).toBeGreaterThan(0);
  });

  it('hotel-california solo includes bend metadata on events', async () => {
    const { result } = await parseGuitarProFile(
      loadBuffer('public/preloaded/hotel-california-solo.gp'),
    );
    const guitar = result.tracks.find((t) => t.isGuitar);
    expect(guitar).toBeDefined();
    const events = result.eventsByTrack.get(guitar!.index) ?? [];
    const withBend = events.filter((e) => e.bend != null);
    expect(withBend.length).toBeGreaterThan(5);
    expect(withBend.some((e) => e.bend!.peakSemitones >= 0.5)).toBe(true);
  });
});
