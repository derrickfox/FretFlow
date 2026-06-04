import { describe, expect, it } from 'vitest';
import type { GuitarNoteEvent } from '../src/types/guitar';
import { classifyNoteAtTime, trailsGlowFromPractice } from '../src/utils/noteHelpers';

function note(overrides: Partial<GuitarNoteEvent> & Pick<GuitarNoteEvent, 'startTick' | 'endTick'>): GuitarNoteEvent {
  return {
    id: '0',
    trackIndex: 0,
    string: 1,
    fret: 3,
    startMs: 0,
    durationMs: 100,
    ...overrides,
  };
}

describe('Trails display mode', () => {
  const ahead = 4000;
  const linger = 2000;

  it('ramps upcoming intensity as cue approaches', () => {
    const glow = trailsGlowFromPractice(100, 100);
    const far = classifyNoteAtTime(
      note({ startTick: 5000, endTick: 5200 }),
      1000,
      'trails',
      ahead,
      linger,
      glow,
    );
    const near = classifyNoteAtTime(
      note({ startTick: 5000, endTick: 5200 }),
      4800,
      'trails',
      ahead,
      linger,
      glow,
    );
    expect(far?.state).toBe('upcoming');
    expect(near?.state).toBe('upcoming');
    expect(far!.intensity).toBeLessThan(near!.intensity);
    expect(near!.intensity).toBeGreaterThan(0.85);
  });

  it('hides upcoming notes outside the glow-lead zone', () => {
    const glow = trailsGlowFromPractice(100, 50);
    const hidden = classifyNoteAtTime(
      note({ startTick: 5000, endTick: 5200 }),
      1000,
      'trails',
      ahead,
      linger,
      glow,
    );
    const visible = classifyNoteAtTime(
      note({ startTick: 5000, endTick: 5200 }),
      3500,
      'trails',
      ahead,
      linger,
      glow,
    );
    expect(hidden).toBeNull();
    expect(visible?.state).toBe('upcoming');
  });

  it('caps peak upcoming brightness', () => {
    const dim = trailsGlowFromPractice(40, 100);
    const atCue = classifyNoteAtTime(
      note({ startTick: 5000, endTick: 5200 }),
      4999,
      'trails',
      ahead,
      linger,
      dim,
    );
    expect(atCue?.intensity).toBeLessThanOrEqual(0.45);
  });

  it('smolders with falling intensity after note ends', () => {
    const justPlayed = classifyNoteAtTime(note({ startTick: 1000, endTick: 2000 }), 2000, 'trails', ahead, linger);
    const fading = classifyNoteAtTime(note({ startTick: 1000, endTick: 2000 }), 3500, 'trails', ahead, linger);
    const gone = classifyNoteAtTime(note({ startTick: 1000, endTick: 2000 }), 4500, 'trails', ahead, linger);
    expect(justPlayed?.state).toBe('smolder');
    expect(fading?.state).toBe('smolder');
    expect(justPlayed!.intensity).toBeGreaterThan(fading!.intensity);
    expect(gone).toBeNull();
  });
});
