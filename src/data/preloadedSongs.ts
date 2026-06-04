import { assetUrl } from '../utils/baseUrl';

export type PreloadedSong = {
  id: string;
  label: string;
  /** Path under `public/` served by Vite */
  url: string;
};

export const PRELOADED_SONGS: PreloadedSong[] = [
  {
    id: 'been-smoking-too-long',
    label: 'Been Smoking Too Long — Nick Drake',
    url: assetUrl('preloaded/been-smoking-too-long.gp'),
  },
  {
    id: 'hey-joe',
    label: 'Hey Joe — Jimi Hendrix',
    url: assetUrl('preloaded/hey-joe.gp'),
  },
];

export function getPreloadedSong(id: string): PreloadedSong | undefined {
  return PRELOADED_SONGS.find((s) => s.id === id);
}
