import { describe, expect, it } from 'vitest';
import type { GuitarNoteEvent } from '../src/types/guitar';
import { classifyNoteAtTime } from '../src/utils/noteHelpers';

function note(overrides: Partial<GuitarNoteEvent> & Pick<GuitarNoteEvent, 'startTick' | 'endTick'>): GuitarNoteEvent {
  return {
    id: '0',
    trackIndex: 0,
    string: 1,
    fret: 3,
    startMs: 0,
    durationMs: 100,
    capo: 0,
    ...overrides,
  };
}

describe('All display mode', () => {
  it('shows every note as full except the one sounding now', () => {
    const past = classifyNoteAtTime(note({ startTick: 100, endTick: 200 }), 500, 'all', 1000, 500);
    const future = classifyNoteAtTime(note({ startTick: 2000, endTick: 2200 }), 500, 'all', 1000, 500);
    const active = classifyNoteAtTime(note({ startTick: 400, endTick: 600 }), 500, 'all', 1000, 500);

    expect(past?.state).toBe('full');
    expect(future?.state).toBe('full');
    expect(active?.state).toBe('active');
  });
});
