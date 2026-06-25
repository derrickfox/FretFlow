import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseGuitarProFile } from '../src/services/guitarProParser';
import {
  capoFretForNeckTracks,
  pickDefaultNeckTrackIndices,
} from '../src/utils/defaultNeckTracks';

function loadBuffer(path: string): ArrayBuffer {
  const buf = readFileSync(path);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

describe('default neck track selection', () => {
  it('hotel-california-solo defaults to Guitar Solo without capo', async () => {
    const { result } = await parseGuitarProFile(
      loadBuffer('public/preloaded/hotel-california-solo.gp'),
    );
    const indices = pickDefaultNeckTrackIndices(result);
    expect(indices).toEqual([0]);
    const selected = indices.map((i) => result.tracks.find((t) => t.index === i)!);
    expect(selected[0].name).toBe('Guitar Solo');
    expect(capoFretForNeckTracks(selected)).toBe(0);
  });

  it('capoFretForNeckTracks returns 0 when visible tracks disagree on capo', () => {
    expect(
      capoFretForNeckTracks([
        { capo: 0 } as never,
        { capo: 7 } as never,
      ]),
    ).toBe(0);
    expect(
      capoFretForNeckTracks([
        { capo: 6 } as never,
        { capo: 6 } as never,
      ]),
    ).toBe(6);
  });
});
