import { assetUrl } from '../utils/baseUrl';

export type PreloadedSong = {
  id: string;
  label: string;
  /** Path under `public/` served by Vite */
  url: string;
};

const PRELOADED_SONGS_RAW: PreloadedSong[] = [
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
  // AI_CHANGE:
  // Tool: Cursor
  // Model: Composer
  // Timestamp: 2026-06-05T09:24:00-04:00
  // Purpose: Adds Rock and Roll to the preloaded sample picker.
  // Reason: User provided Led Zeppelin GP file for the demo library.
  {
    id: 'rock-and-roll',
    label: 'Rock and Roll — Led Zeppelin',
    url: assetUrl('preloaded/rock-and-roll.gp'),
  },
  // AI_CHANGE:
  // Tool: Cursor
  // Model: Composer
  // Timestamp: 2026-06-05T09:25:00-04:00
  // Purpose: Adds Crazy Train to the preloaded sample picker.
  // Reason: User provided Ozzy Osbourne GP file for the demo library.
  {
    id: 'crazy-train',
    label: 'Crazy Train — Ozzy Osbourne',
    url: assetUrl('preloaded/crazy-train.gp'),
  },
  // AI_CHANGE:
  // Tool: Cursor
  // Model: Composer
  // Timestamp: 2026-06-05T11:51:00-04:00
  // Purpose: Adds Hysteria to the preloaded sample picker.
  // Reason: User provided Muse GP file for the demo library.
  {
    id: 'hysteria',
    label: 'Hysteria — Muse',
    url: assetUrl('preloaded/hysteria.gp'),
  },
  // AI_CHANGE:
  // Tool: Cursor
  // Model: Composer
  // Timestamp: 2026-06-05T12:00:00-04:00
  // Purpose: Adds four Beatles and Van Morrison tabs to the preloaded sample picker.
  // Reason: User provided GP files for the demo library.
  {
    id: 'ob-la-di-ob-la-da',
    label: 'Ob-La-Di, Ob-La-Da — The Beatles',
    url: assetUrl('preloaded/ob-la-di-ob-la-da.gp'),
  },
  {
    id: 'wild-night',
    label: 'Wild Night — Van Morrison',
    url: assetUrl('preloaded/wild-night.gp'),
  },
  {
    id: 'brown-eyed-girl',
    label: 'Brown Eyed Girl — Van Morrison',
    url: assetUrl('preloaded/brown-eyed-girl.gp'),
  },
  {
    id: 'im-looking-through-you',
    label: "I'm Looking Through You — The Beatles",
    url: assetUrl('preloaded/im-looking-through-you.gp'),
  },
  // AI_CHANGE:
  // Tool: Cursor
  // Model: Composer
  // Timestamp: 2026-06-05T12:12:00-04:00
  // Purpose: Adds Never Going Back Again (open tuning + capo 6) to sample picker.
  // Reason: User GP uses alternate tuning and capo; fretboard now supports both.
  {
    id: 'never-going-back-again',
    label: 'Never Going Back Again — Fleetwood Mac',
    url: assetUrl('preloaded/never-going-back-again.gp'),
  },
  // AI_CHANGE:
  // Tool: Cursor
  // Model: Composer
  // Timestamp: 2026-06-05T12:26:00-04:00
  // Purpose: Adds thirteen user-provided GP tabs to the preloaded sample picker.
  // Reason: Expands the demo library with rock, reggae, and classic hits for practice.
  {
    id: 'sink-into-the-underground',
    label: 'Sink Into the Underground — CKY',
    url: assetUrl('preloaded/sink-into-the-underground.gp'),
  },
  {
    id: 'flesh-into-gear',
    label: 'Flesh Into Gear — CKY',
    url: assetUrl('preloaded/flesh-into-gear.gp'),
  },
  {
    id: 'everlong',
    label: 'Everlong — Foo Fighters',
    url: assetUrl('preloaded/everlong.gp'),
  },
  {
    id: 'santeria',
    label: 'Santeria — Sublime',
    url: assetUrl('preloaded/santeria.gp'),
  },
  {
    id: 'my-name-is-jonas',
    label: 'My Name Is Jonas — Weezer',
    url: assetUrl('preloaded/my-name-is-jonas.gp'),
  },
  {
    id: 'the-world-has-turned-and-left-me-here',
    label: 'The World Has Turned and Left Me Here — Weezer',
    url: assetUrl('preloaded/the-world-has-turned-and-left-me-here.gp'),
  },
  {
    id: 'snow-hey-oh',
    label: 'Snow (Hey Oh) — Red Hot Chili Peppers',
    url: assetUrl('preloaded/snow-hey-oh.gp'),
  },
  {
    id: 'under-the-bridge',
    label: 'Under the Bridge — Red Hot Chili Peppers',
    url: assetUrl('preloaded/under-the-bridge.gp'),
  },
  {
    id: 'dont-stop-believin',
    label: "Don't Stop Believin' — Journey",
    url: assetUrl('preloaded/dont-stop-believin.gp'),
  },
  {
    id: 'could-you-be-loved',
    label: 'Could You Be Loved — Bob Marley',
    url: assetUrl('preloaded/could-you-be-loved.gp'),
  },
  {
    id: 'thunderstruck',
    label: 'Thunderstruck — AC/DC',
    url: assetUrl('preloaded/thunderstruck.gp'),
  },
  {
    id: 'money-for-nothing',
    label: 'Money for Nothing — Dire Straits',
    url: assetUrl('preloaded/money-for-nothing.gp'),
  },
  {
    id: 'free-bird',
    label: 'Free Bird — Lynyrd Skynyrd',
    url: assetUrl('preloaded/free-bird.gp'),
  },
  // AI_CHANGE:
  // Tool: Cursor
  // Model: Composer
  // Timestamp: 2026-06-05T14:10:00-04:00
  // Purpose: Adds seven jazz and blues GP files to the preloaded sample library.
  // Reason: User provided Autumn Leaves, Neon, The Thrill Is Gone, Take The A Train, Misty, Satin Doll, and Blue Bossa tabs.
  {
    id: 'the-thrill-is-gone',
    label: 'The Thrill Is Gone — B.B. King',
    url: assetUrl('preloaded/the-thrill-is-gone.gp'),
  },
  {
    id: 'blue-bossa',
    label: 'Blue Bossa — Clase De Música',
    url: assetUrl('preloaded/blue-bossa.gp'),
  },
  {
    id: 'satin-doll',
    label: 'Satin Doll — Duke Ellington',
    url: assetUrl('preloaded/satin-doll.gp'),
  },
  {
    id: 'misty',
    label: 'Misty — Joe Pass',
    url: assetUrl('preloaded/misty.gp'),
  },
  {
    id: 'take-the-a-train',
    label: 'Take The A Train — Joe Pass',
    url: assetUrl('preloaded/take-the-a-train.gp'),
  },
  {
    id: 'neon',
    label: 'Neon — John Mayer',
    url: assetUrl('preloaded/neon.gp'),
  },
  {
    id: 'autumn-leaves',
    label: 'Autumn Leaves — Paul Davids',
    url: assetUrl('preloaded/autumn-leaves.gp'),
  },
  // AI_CHANGE:
  // Tool: Cursor
  // Model: Composer
  // Timestamp: 2026-06-05T14:35:00-04:00
  // Purpose: Adds six rock and classic-rock GP files to the preloaded library.
  // Reason: User provided intro riff, Sultans Of Swing, Fortunate Son, Lookin' Out My Back Door, Watchtower, and The Trooper tabs.
  {
    id: 'fortunate-son',
    label: 'Fortunate Son — Creedence Clearwater Revival',
    url: assetUrl('preloaded/fortunate-son.gp'),
  },
  {
    id: 'lookin-out-my-back-door',
    label: "Lookin' Out My Back Door — Creedence Clearwater Revival",
    url: assetUrl('preloaded/lookin-out-my-back-door.gp'),
  },
  {
    id: 'money-for-nothing-intro-riff',
    label: 'Money for Nothing (Intro Riff) — Dire Straits',
    url: assetUrl('preloaded/money-for-nothing-intro-riff.gp'),
  },
  {
    id: 'sultans-of-swing',
    label: 'Sultans Of Swing — Dire Straits',
    url: assetUrl('preloaded/sultans-of-swing.gp'),
  },
  {
    id: 'the-trooper',
    label: 'The Trooper — Iron Maiden',
    url: assetUrl('preloaded/the-trooper.gp'),
  },
  {
    id: 'all-along-the-watchtower',
    label: 'All Along The Watchtower — The Jimi Hendrix Experience',
    url: assetUrl('preloaded/all-along-the-watchtower.gp'),
  },
  // AI_CHANGE:
  // Tool: Cursor
  // Model: Composer
  // Timestamp: 2026-06-05T15:20:00-04:00
  // Purpose: Adds Robert Johnson lead sheet as first MusicXML preloaded song.
  // Reason: User provided Come On In My Kitchen from iReal Pro for the demo library.
  {
    id: 'come-on-in-my-kitchen',
    label: 'Come On In My Kitchen — Robert Johnson',
    url: assetUrl('preloaded/come-on-in-my-kitchen.musicxml'),
  },
];

// AI_CHANGE:
// Tool: Cursor
// Model: Composer
// Timestamp: 2026-06-05T12:30:00-04:00
// Purpose: Sort sample-song picker by artist name, then title.
// Reason: User requested alphabetized dropdown as the library grew.

function artistFromPreloadedLabel(label: string): string {
  const sep = label.lastIndexOf(' — ');
  return sep >= 0 ? label.slice(sep + 3).trim() : label;
}

function sortPreloadedByArtist(songs: PreloadedSong[]): PreloadedSong[] {
  return [...songs].sort((a, b) => {
    const byArtist = artistFromPreloadedLabel(a.label).localeCompare(
      artistFromPreloadedLabel(b.label),
      'en',
      { sensitivity: 'base' },
    );
    if (byArtist !== 0) return byArtist;
    return a.label.localeCompare(b.label, 'en', { sensitivity: 'base' });
  });
}

export const PRELOADED_SONGS: PreloadedSong[] = sortPreloadedByArtist(PRELOADED_SONGS_RAW);

export function getPreloadedSong(id: string): PreloadedSong | undefined {
  return PRELOADED_SONGS.find((s) => s.id === id);
}
