import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseGuitarProFile } from '../src/services/guitarProParser';
import {
  formatSupportedScoreExtensions,
  isValidScoreExtension,
  MUSICXML_EXTENSIONS,
} from '../src/utils/noteHelpers';

function loadBuffer(relativePath: string): ArrayBuffer {
  const bytes = readFileSync(resolve(process.cwd(), relativePath));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

describe('score file formats', () => {
  it('accepts MusicXML extensions in the uploader', () => {
    for (const ext of MUSICXML_EXTENSIONS) {
      expect(isValidScoreExtension(`song${ext}`)).toBe(true);
    }
    expect(isValidScoreExtension('song.mid')).toBe(false);
    expect(formatSupportedScoreExtensions()).toContain('.musicxml');
  });

  it('parses a minimal guitar MusicXML file with tab notes', async () => {
    const { result } = await parseGuitarProFile(
      loadBuffer('tests/fixtures/open-e-quarter.musicxml'),
    );
    expect(result.tracks.length).toBeGreaterThan(0);
    const track = result.tracks[0];
    const events = result.eventsByTrack.get(track.index) ?? [];
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].fret).toBe(0);
    expect(events[0].string).toBeGreaterThanOrEqual(0);
    expect(track.isGuitar).toBe(true);
  });
});
