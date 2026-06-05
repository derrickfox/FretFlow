import { describe, expect, it } from 'vitest';
import {
  blendHex,
  buildCustomNoteDotStyle,
  upcomingApproachBlend,
} from '../src/utils/noteColors';
import { mergeNotesAtSameFret } from '../src/utils/mergeNeckDots';
import { classifyNoteAtTime, millisToTicks } from '../src/utils/noteHelpers';
import type { GuitarNoteEvent } from '../src/types/guitar';

const sampleNote = (startTick: number): GuitarNoteEvent => ({
  id: 'n',
  trackIndex: 0,
  string: 1,
  fret: 5,
  startTick,
  endTick: startTick + 960,
  startMs: 0,
  durationMs: 100,
  capo: 0,
});

describe('note colors', () => {
  it('blends yellow toward red through orange at midpoint', () => {
    const yellow = '#FFFF00';
    const red = '#FF0000';
    const mid = blendHex(yellow, red, 0.5);
    expect(mid.toLowerCase()).toBe('#ff8000');
    expect(blendHex(yellow, red, 0).toLowerCase()).toBe(yellow.toLowerCase());
    expect(blendHex(yellow, red, 1).toLowerCase()).toBe(red.toLowerCase());
  });

  it('approach blend increases as the cue nears', () => {
    expect(upcomingApproachBlend(960, 960)).toBe(0);
    expect(upcomingApproachBlend(480, 960)).toBe(0.5);
    expect(upcomingApproachBlend(0, 960)).toBe(1);
  });

  it('buildCustomNoteDotStyle uses a strong border for active notes', () => {
    const colors = {
      upcoming: '#FFFF00',
      active: '#FF0000',
      played: '#0000FF',
    };
    const active = buildCustomNoteDotStyle('active', 1, 0, colors, true);
    expect(String(active['--dot-border' as keyof typeof active]).toLowerCase()).not.toBe(
      'transparent',
    );
    expect(String(active['--dot-shadow' as keyof typeof active])).toContain('0 0 0 2px');
  });

  it('buildCustomNoteDotStyle uses played color for smolder borders', () => {
    const colors = {
      upcoming: '#FFFF00',
      active: '#FF0000',
      played: '#0000FF',
    };
    const smolder = buildCustomNoteDotStyle('smolder', 0.8, 0, colors, true);
    const upcoming = buildCustomNoteDotStyle('upcoming', 0.2, 0, colors, true);
    expect(String(smolder['--dot-border' as keyof typeof smolder]).toLowerCase()).toBe(
      '#0000ff',
    );
    expect(String(upcoming['--dot-border' as keyof typeof upcoming]).toLowerCase()).toContain('#ff');
    expect(Number(upcoming['--dot-opacity' as keyof typeof upcoming])).toBeGreaterThanOrEqual(0.55);
  });

  it('mergeNotesAtSameFret keeps linger and live dots separate at the same fret', () => {
    const note = (id: string, startTick: number): GuitarNoteEvent => ({
      ...sampleNote(startTick),
      id,
    });
    const merged = mergeNotesAtSameFret(
      [
        { note: note('linger', 1000), classified: { state: 'smolder', intensity: 0.9, approachBlend: 0 } },
        { note: note('next', 2000), classified: { state: 'upcoming', intensity: 0.4, approachBlend: 0.2 } },
      ],
      false,
    );
    expect(merged).toHaveLength(2);
    expect(merged.find((d) => d.layer === 'linger')?.state).toBe('smolder');
    expect(merged.find((d) => d.layer === 'live')?.state).toBe('upcoming');
  });

  it('mergeNotesAtSameFret does not hide smolder when another track is still active', () => {
    const note = (trackIndex: number, startTick: number): GuitarNoteEvent => ({
      ...sampleNote(startTick),
      id: `${trackIndex}-${startTick}`,
      trackIndex,
    });
    const merged = mergeNotesAtSameFret(
      [
        { note: note(0, 1000), classified: { state: 'smolder', intensity: 0.8, approachBlend: 0 } },
        { note: note(1, 1200), classified: { state: 'active', intensity: 1, approachBlend: 0 } },
      ],
      false,
    );
    expect(merged).toHaveLength(2);
    expect(merged.find((d) => d.layer === 'linger')?.state).toBe('smolder');
    expect(merged.find((d) => d.layer === 'live')?.state).toBe('active');
  });

  it('classifyNoteAtTime exposes approachBlend for upcoming notes', () => {
    const ahead = 1000;
    const note = sampleNote(1500);
    const result = classifyNoteAtTime(note, 1000, 'standard', ahead, 0);
    expect(result?.state).toBe('upcoming');
    expect(result?.approachBlend).toBeCloseTo(0.5, 1);
  });
});
