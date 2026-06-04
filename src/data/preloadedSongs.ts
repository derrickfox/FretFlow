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
  {
    id: 'wind-cries-mary',
    label: 'The Wind Cries Mary — Jimi Hendrix',
    url: assetUrl('preloaded/wind-cries-mary.gp'),
  },
  // AI_CHANGE:
  // Tool: Cursor
  // Model: Composer
  // Timestamp: 2026-06-04T17:35:00-04:00
  // Purpose: Adds Hotel California solo as a sample song in the preloaded picker.
  // Reason: User provided Eagles GP file for the in-app demo library alongside existing samples.
  {
    id: 'hotel-california-solo',
    label: 'Hotel California (Solo) — Eagles',
    url: assetUrl('preloaded/hotel-california-solo.gp'),
  },
  // AI_CHANGE:
  // Tool: Cursor
  // Model: Composer
  // Timestamp: 2026-06-04T17:44:00-04:00
  // Purpose: Adds Stairway to Heaven guitar solo to the preloaded sample picker.
  // Reason: User provided Led Zeppelin GP file for the demo library.
  {
    id: 'stairway-to-heaven-solo',
    label: 'Stairway to Heaven (Solo) — Led Zeppelin',
    url: assetUrl('preloaded/stairway-to-heaven-solo.gp'),
  },
  // AI_CHANGE:
  // Tool: Cursor
  // Model: Composer
  // Timestamp: 2026-06-04T17:45:00-04:00
  // Purpose: Adds Layla to the preloaded sample picker.
  // Reason: User provided Derek and the Dominos GP file for the demo library.
  {
    id: 'layla',
    label: 'Layla — Derek and the Dominos',
    url: assetUrl('preloaded/layla.gp'),
  },
  // AI_CHANGE:
  // Tool: Cursor
  // Model: Composer
  // Timestamp: 2026-06-04T17:55:00-04:00
  // Purpose: Adds Bohemian Rhapsody solo to the preloaded sample picker.
  // Reason: User provided Queen GP file for the demo library.
  {
    id: 'bohemian-rhapsody-solo',
    label: 'Bohemian Rhapsody (Solo) — Queen',
    url: assetUrl('preloaded/bohemian-rhapsody-solo.gp'),
  },
  // AI_CHANGE:
  // Tool: Cursor
  // Model: Composer
  // Timestamp: 2026-06-04T17:56:00-04:00
  // Purpose: Adds Gimme Three Steps to the preloaded sample picker.
  // Reason: User provided Lynyrd Skynyrd GP file for the demo library.
  {
    id: 'gimme-three-steps',
    label: 'Gimme Three Steps — Lynyrd Skynyrd',
    url: assetUrl('preloaded/gimme-three-steps.gp'),
  },
  // AI_CHANGE:
  // Tool: Cursor
  // Model: Composer
  // Timestamp: 2026-06-04T18:06:00-04:00
  // Purpose: Adds We Are the Champions to the preloaded sample picker.
  // Reason: User provided Queen GP file for the demo library.
  {
    id: 'we-are-the-champions',
    label: 'We Are the Champions — Queen',
    url: assetUrl('preloaded/we-are-the-champions.gp'),
  },
  // AI_CHANGE:
  // Tool: Cursor
  // Model: Composer
  // Timestamp: 2026-06-04T18:08:00-04:00
  // Purpose: Adds Time to the preloaded sample picker.
  // Reason: User provided Pink Floyd GP file for the demo library.
  {
    id: 'time',
    label: 'Time — Pink Floyd',
    url: assetUrl('preloaded/time.gp'),
  },
  // AI_CHANGE:
  // Tool: Cursor
  // Model: Composer
  // Timestamp: 2026-06-04T18:16:00-04:00
  // Purpose: Adds Waltz #2 to the preloaded sample picker.
  // Reason: User provided Elliott Smith GP file for the demo library.
  {
    id: 'waltz-2',
    label: 'Waltz #2 — Elliott Smith',
    url: assetUrl('preloaded/waltz-2.gp'),
  },
];

export function getPreloadedSong(id: string): PreloadedSong | undefined {
  return PRELOADED_SONGS.find((s) => s.id === id);
}
