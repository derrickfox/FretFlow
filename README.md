# FretFlow

FretFlow is a React + TypeScript web app that teaches guitar songs by animating tab notes on a virtual fretboard in sync with playback. Upload a Guitar Pro file, pick a guitar track, press play, and watch each string/fret light up at the right time.

## Requirements

- Node.js 18+
- npm 9+

## Install

```bash
cd FretFlow
npm install
```

## Run locally

```bash
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

## Build for production

```bash
npm run build
npm run preview
```

## Repository

Standalone repo: [github.com/derrickfox/FretFlow](https://github.com/derrickfox/FretFlow)

## Profolio deployment

Built into the portfolio at `/apps/fretflow/` via `Profolio_Project`:

```bash
cd ../Profolio_Project
npm run build:apps:fretflow
npm run deploy:hosting
```

## How to upload a `.gp` file

1. Start the dev server.
2. Drag a Guitar Pro file onto the upload area, or click to browse.
3. Wait for parsing to finish — detected tracks appear in the sidebar.
4. Choose a track (guitar-like tracks are listed by default).
5. Press **Play** (browser autoplay policies may require a click first).

## Supported file formats

FretFlow uses [alphaTab](https://alphatab.net/) for parsing and playback. Extensions accepted by the uploader:

| Extension | Guitar Pro version |
|-----------|-------------------|
| `.gp3`    | Guitar Pro 3    |
| `.gp4`    | Guitar Pro 4    |
| `.gp5`    | Guitar Pro 5    |
| `.gp`     | Often GP5 container |
| `.gpx`    | Guitar Pro 6    |
| `.gp7`    | Guitar Pro 7    |

alphaTab also supports **Guitar Pro 8** binaries when they use supported importers; try your file and check the error message if import fails.

## Architecture

```
src/
  components/     UI (fretboard, upload, controls)
  services/
    alphatabAdapter.ts   alphaTab settings, score load, MIDI timing pass
    guitarProParser.ts   Score → GuitarNoteEvent[]
    playbackEngine.ts    AlphaTabApi playback wrapper
  types/guitar.ts        Normalized note model
  utils/noteHelpers.ts   Fret/string helpers, time formatting
```

- **Tab data is the source of truth** for string and fret positions (not MIDI note numbers).
- **Timing**: `MidiFileGenerator` fills `beat.timer` (milliseconds) on each beat after `score.finish()`.
- **Playback**: alphaSynth plays the score; `playerPositionChanged` drives the fretboard clock.

## Known limitations

- **Encrypted / DRM Guitar Pro files** may fail to parse.
- **Non-guitar tracks** (piano, drums) have no string/fret data and are hidden unless “Show all tracks” is enabled.
- **Very large scores** may take several seconds to parse and build MIDI on first load.
- **Autoplay**: some browsers block audio until the user interacts with the page.
- **Loop ranges** use millisecond seek in the playback engine; fine-grained beat snapping can be improved later.
- **Pitch-preserving slow-down** beyond alphaTab’s `playbackSpeed` is not customized; extreme speeds may affect perceived pitch slightly depending on the synthesizer.
- The hidden alphaTab renderer uses a minimal layout; the UI focuses on the custom fretboard, not full sheet music.

## Future ideas

- Built-in song library (`public/songs/` + catalog UI) — hook noted in `alphatabAdapter.ts`
- MIDI-only fallback when tab staves are missing — hook in `guitarProParser.ts`
- Fingering overlays, bend/vibrato indicators, and right-hand stroke animation
- Microphone pitch feedback for practice mode
- Export loop sections as practice clips
- Offline PWA cache for soundfont and fonts

## License

App code: project default. alphaTab is [MPL-2.0](https://github.com/CoderLine/alphaTab).
