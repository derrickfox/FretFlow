import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileUploader } from './components/FileUploader';
import { PreloadedSongsSelect } from './components/PreloadedSongsSelect';
import { getPreloadedSong, PRELOADED_SONGS } from './data/preloadedSongs';
import { TrackSelector } from './components/TrackSelector';
import { PlaybackControls } from './components/PlaybackControls';
import { GuitarNeck } from './components/GuitarNeck';
import { TabViewer } from './components/TabViewer';
import { SongInfoPanel } from './components/SongInfoPanel';
import { parseGuitarProFile, refreshEventsFromTickCache } from './services/guitarProParser';
import { playbackEngine } from './services/playbackEngine';
import type {
  DisplayMode,
  GuitarNoteEvent,
  ParseResult,
  PracticeSettings,
} from './types/guitar';
import {
  DEFAULT_PRACTICE,
  NOTE_LINGER_MAX_MS,
  NOTE_LINGER_MIN_MS,
  NOTE_LOOKAHEAD_MAX_MS,
  NOTE_LOOKAHEAD_MIN_MS,
  TRAILS_GLOW_LEAD_MAX,
  TRAILS_GLOW_LEAD_MIN,
  TRAILS_PEAK_GLOW_MAX,
  TRAILS_PEAK_GLOW_MIN,
} from './types/guitar';
import styles from './App.module.css';

function App() {
  const tabHostRef = useRef<HTMLDivElement>(null);
  const tabScrollRef = useRef<HTMLDivElement>(null);

  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [loading, setLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [neckTracks, setNeckTracks] = useState<number[]>([]);
  const [audioTracks, setAudioTracks] = useState<number[]>([]);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('standard');
  const [practice, setPractice] = useState<PracticeSettings>(DEFAULT_PRACTICE);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [currentTick, setCurrentTick] = useState(0);
  const [playbackTempo, setPlaybackTempo] = useState(120);
  const [totalMs, setTotalMs] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [preloadedSongId, setPreloadedSongId] = useState<string | null>(null);

  const noteCountByTrack = useMemo(() => {
    if (!parseResult) return new Map<number, number>();
    const counts = new Map<number, number>();
    for (const track of parseResult.tracks) {
      counts.set(track.index, parseResult.eventsByTrack.get(track.index)?.length ?? 0);
    }
    return counts;
  }, [parseResult]);

  // AI_CHANGE:
  // Tool: Cursor
  // Model: Composer
  // Timestamp: 2026-06-05T17:05:00-04:00
  // Purpose: Merge neck events sorted by startTick (not startMs).
  // Reason: Ms order diverges from MIDI ticks on multi-track GP files and breaks window search.
  const trackEvents: GuitarNoteEvent[] = useMemo(() => {
    if (!parseResult || neckTracks.length === 0) return [];
    const merged = neckTracks.flatMap((index) => parseResult.eventsByTrack.get(index) ?? []);
    merged.sort(
      (a, b) => a.startTick - b.startTick || a.trackIndex - b.trackIndex || a.string - b.string,
    );
    return merged;
  }, [parseResult, neckTracks]);

  const displayStringCount = useMemo(() => {
    if (!parseResult || neckTracks.length === 0) return 6;
    const counts = neckTracks.map(
      (index) => parseResult.tracks.find((t) => t.index === index)?.stringCount ?? 6,
    );
    return Math.max(6, ...counts);
  }, [parseResult, neckTracks]);

  // AI_CHANGE:
  // Tool: Cursor
  // Model: Composer
  // Timestamp: 2026-06-04T23:45:00-04:00
  // Purpose: Tab strip loads only guitar-classified tracks; audio still uses speaker toggles on full score.
  // Reason: Non-guitar staves (bass, vocals, drums) should not appear in the notation panel.
  /** All detected guitar tracks for tab notation (excludes bass, vocals, drums). */
  const tabNotationTracks = useMemo(() => {
    if (!parseResult) return [];
    return parseResult.tracks
      .filter((t) => t.isGuitar)
      .map((t) => t.index)
      .sort((a, b) => a - b);
  }, [parseResult?.tracks]);

  /** Stable key so tick-cache refresh does not retrigger alphaTab load. */
  const tabNotationTracksKey = tabNotationTracks.join(',');

  const selectedTracksLabel = useMemo(() => {
    if (!parseResult || neckTracks.length === 0) return undefined;
    const names = neckTracks
      .map((index) => parseResult.tracks.find((t) => t.index === index)?.name)
      .filter((name): name is string => Boolean(name));
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
  }, [parseResult, neckTracks]);

  useEffect(() => {
    playbackEngine.destroy();

    let lastPositionUpdate = 0;
    playbackEngine.attachCallbacks({
      onPosition: (pos) => {
        const now = performance.now();
        if (now - lastPositionUpdate < 32) return;
        lastPositionUpdate = now;
        setCurrentMs(pos.ms);
        setCurrentTick(pos.tick);
        setPlaybackTempo(pos.tempo);
      },
      onTimelineReady: (tickLookup, score) => {
        setParseResult((prev) =>
          prev ? refreshEventsFromTickCache(prev, score, tickLookup) : prev,
        );
      },
      onState: (playing, ready) => {
        setIsPlaying(playing);
        setIsReady(ready);
      },
      onReady: () => {
        const duration = playbackEngine.getTotalMs();
        setTotalMs(duration);
        setIsReady(true);
        if (duration > 0) {
          setPractice((p) => ({
            ...p,
            loopEndMs: duration,
          }));
        }
      },
      onError: (msg) => setPlaybackError(msg),
      onFinished: () => setIsPlaying(false),
    });
    return () => playbackEngine.destroy();
  }, []);

  // AI_CHANGE:
  // Tool: Cursor
  // Model: Composer
  // Timestamp: 2026-06-05T17:15:00-04:00
  // Purpose: Load alphaTab only when the GP file changes, not on tick-cache refresh.
  // Reason: onTimelineReady updated parseResult and re-ran load, leaving Play disabled and breaking audio.
  useEffect(() => {
    const host = tabHostRef.current;
    const scroll = tabScrollRef.current;
    if (!host || !scroll || !fileBytes || tabNotationTracks.length === 0) return;

    setPlaybackError(null);
    setIsReady(false);
    playbackEngine.loadFromBytes(
      fileBytes,
      tabNotationTracks,
      audioTracks,
      host,
      scroll,
    );
    playbackEngine.setSpeed(speed);
    playbackEngine.setMetronome(metronomeOn);
    playbackEngine.setLoop(practice.loopEnabled, practice.loopStartMs, practice.loopEndMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload song file only
  }, [fileBytes, tabNotationTracksKey]);

  useEffect(() => {
    if (!fileBytes || !isReady) return;
    playbackEngine.syncAudioTracks(audioTracks);
  }, [audioTracks, fileBytes, isReady]);

  useEffect(() => {
    playbackEngine.setSpeed(speed);
  }, [speed]);

  useEffect(() => {
    playbackEngine.setMetronome(metronomeOn);
  }, [metronomeOn]);

  useEffect(() => {
    playbackEngine.setLoop(practice.loopEnabled, practice.loopStartMs, practice.loopEndMs);
  }, [practice.loopEnabled, practice.loopStartMs, practice.loopEndMs]);

  const loadScoreFromBuffer = useCallback(async (buffer: ArrayBuffer) => {
    setLoading(true);
    setParseError(null);
    setPlaybackError(null);
    setParseResult(null);
    setFileBytes(null);
    setNeckTracks([]);
    setAudioTracks([]);
    setCurrentMs(0);
    setCurrentTick(0);
    setIsReady(false);

    try {
      const bytes = new Uint8Array(buffer);
      const { result } = await parseGuitarProFile(buffer);

      if (result.tracks.length === 0) {
        throw new Error('This file has no tracks.');
      }

      const guitarTracks = result.tracks.filter((t) => t.isGuitar);
      if (guitarTracks.length === 0) {
        setParseError('No guitar tracks detected. Bass, vocals, and drums are listed separately below.');
      }

      const eventsEmpty = result.tracks.every(
        (t) => (result.eventsByTrack.get(t.index)?.length ?? 0) === 0,
      );
      if (eventsEmpty) {
        throw new Error('No tab notes found in this file. The track may be empty or non-fretted.');
      }

      setParseResult(result);
      if (result.metadata.tempo) {
        setPlaybackTempo(result.metadata.tempo);
      }
      setFileBytes(bytes);
      setTotalMs(result.metadata.durationMs);
      setPractice((p) => ({
        ...p,
        loopEndMs: result.metadata.durationMs || 60000,
      }));

      const tracksWithNotes = result.tracks
        .filter((t) => (result.eventsByTrack.get(t.index)?.length ?? 0) > 0)
        .map((t) => t.index);
      const defaultGuitar = guitarTracks
        .filter((t) => (result.eventsByTrack.get(t.index)?.length ?? 0) > 0)
        .map((t) => t.index);
      const allIndices = result.tracks.map((t) => t.index);
      const defaultAudio = result.tracks
        .filter((t) => t.kind !== 'percussion')
        .map((t) => t.index);
      setNeckTracks(
        defaultGuitar.length > 0
          ? defaultGuitar
          : tracksWithNotes.length > 0
            ? tracksWithNotes
            : [result.tracks[0].index],
      );
      setAudioTracks(defaultAudio.length > 0 ? defaultAudio : allIndices);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse file');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setPreloadedSongId(null);
      await loadScoreFromBuffer(await file.arrayBuffer());
    },
    [loadScoreFromBuffer],
  );

  const handlePreloadedSong = useCallback(
    async (id: string) => {
      const song = getPreloadedSong(id);
      if (!song) return;

      setPreloadedSongId(id);
      try {
        const response = await fetch(song.url);
        if (!response.ok) {
          throw new Error(`Could not load "${song.label}".`);
        }
        await loadScoreFromBuffer(await response.arrayBuffer());
      } catch (err) {
        setPreloadedSongId(null);
        setParseError(err instanceof Error ? err.message : 'Failed to load song');
      }
    },
    [loadScoreFromBuffer],
  );

  const errorMessage = parseError ?? playbackError;

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerBrand}>
          <h1 className={styles.logo}>FretFlow</h1>
          <p className={styles.tagline}>Learn guitar songs on a living fretboard</p>
        </div>
        <div className={styles.headerCenter}>
          <PreloadedSongsSelect
            songs={PRELOADED_SONGS}
            selectedId={preloadedSongId}
            loading={loading}
            onSelect={handlePreloadedSong}
          />
        </div>
        <div className={styles.headerUpload}>
          <FileUploader
            compact
            onFileSelected={handleFile}
            loading={loading}
            error={parseError}
          />
        </div>
      </header>

      <main className={styles.main}>
        {parseResult ? (
          <div className={styles.playbackDock}>
            <PlaybackControls
              docked
              isPlaying={isPlaying}
              isReady={isReady}
              currentMs={currentMs}
              totalMs={totalMs || parseResult.metadata.durationMs}
              speed={speed}
              metronomeOn={metronomeOn}
              loopEnabled={practice.loopEnabled}
              loopStartMs={practice.loopStartMs}
              loopEndMs={practice.loopEndMs}
              onPlayPause={() => playbackEngine.playPause()}
              onRestart={() => playbackEngine.restart()}
              onSeek={(ms) => {
                playbackEngine.seek(ms);
                setCurrentMs(ms);
              }}
              onSpeedChange={setSpeed}
              onMetronomeToggle={() => setMetronomeOn((v) => !v)}
              onLoopEnabledChange={(enabled) =>
                setPractice((p) => ({ ...p, loopEnabled: enabled }))
              }
              onLoopRangeChange={(start, end) =>
                setPractice((p) => ({ ...p, loopStartMs: start, loopEndMs: end }))
              }
            />
          </div>
        ) : null}

        <section className={styles.stage}>
          <div className={styles.stageStack}>
            {parseResult ? (
              neckTracks.length > 0 && trackEvents.length > 0 ? (
                <GuitarNeck
                  events={trackEvents}
                  currentTick={currentTick}
                  playbackTempo={playbackTempo}
                  displayMode={displayMode}
                  practice={practice}
                  stringCount={displayStringCount}
                  neckTrackIndices={neckTracks}
                />
              ) : (
                <div className={styles.emptyStage}>
                  <p>
                    {neckTracks.length === 0
                      ? 'Turn on a track’s guitar icon to show notes on the fretboard.'
                      : 'The selected tracks have no fretted tab notes. Try other tracks.'}
                  </p>
                </div>
              )
            ) : (
              <div className={styles.emptyStage}>
                <p>Upload a Guitar Pro file to see the fretboard.</p>
              </div>
            )}

            <TabViewer
              visible={Boolean(parseResult && tabNotationTracks.length > 0)}
              scrollRef={tabScrollRef}
              hostRef={tabHostRef}
            />
          </div>
        </section>

        {(parseResult || (errorMessage && !parseError)) ? (
        <div className={styles.controls}>
          {parseResult ? (
            <div className={styles.controlsTop}>
              <SongInfoPanel
                metadata={parseResult.metadata}
                trackName={selectedTracksLabel}
                noteCount={trackEvents.length}
              />
              <div className={styles.trackPanel}>
                <TrackSelector
                  tracks={parseResult.tracks}
                  neckTrackIndices={neckTracks}
                  audioTrackIndices={audioTracks}
                  onNeckChange={setNeckTracks}
                  onAudioChange={setAudioTracks}
                  noteCountByTrack={noteCountByTrack}
                />
              </div>
            </div>
          ) : null}

          {parseResult ? (
            <div className={styles.controlsBottom}>
              <section className={styles.practice}>
                <h3 className={styles.sectionTitle}>Practice</h3>
                <div className={styles.toggleGrid}>
                  <label>
                    <input
                      type="checkbox"
                      checked={practice.showNoteNames}
                      onChange={(e) =>
                        setPractice((p) => ({ ...p, showNoteNames: e.target.checked }))
                      }
                    />
                    Note names on dots
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={practice.leftHanded}
                      onChange={(e) =>
                        setPractice((p) => ({ ...p, leftHanded: e.target.checked }))
                      }
                    />
                    Left-handed neck
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={practice.showStandardTuning}
                      onChange={(e) =>
                        setPractice((p) => ({ ...p, showStandardTuning: e.target.checked }))
                      }
                    />
                    Standard tuning labels
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={practice.showBendBadges}
                      onChange={(e) =>
                        setPractice((p) => ({ ...p, showBendBadges: e.target.checked }))
                      }
                    />
                    Bend amount labels
                  </label>
                </div>
                <label className={styles.lookaheadRow}>
                  <span className={styles.lookaheadLabel}>
                    Notes ahead{' '}
                    <strong>{(practice.noteLookaheadMs / 1000).toFixed(1)}s</strong>
                  </span>
                  <input
                    type="range"
                    className={styles.lookaheadSlider}
                    min={NOTE_LOOKAHEAD_MIN_MS}
                    max={NOTE_LOOKAHEAD_MAX_MS}
                    step={100}
                    value={practice.noteLookaheadMs}
                    onChange={(e) =>
                      setPractice((p) => ({
                        ...p,
                        noteLookaheadMs: Number(e.target.value),
                      }))
                    }
                    aria-label="How far ahead to show upcoming notes on the fretboard"
                  />
                  <span className={styles.lookaheadHints}>
                    <span>less clutter</span>
                    <span>more preview</span>
                  </span>
                </label>
                <label className={styles.lookaheadRow}>
                  <span className={styles.lookaheadLabel}>
                    Notes linger{' '}
                    <strong>{(practice.noteLingerMs / 1000).toFixed(1)}s</strong>
                  </span>
                  <input
                    type="range"
                    className={styles.lookaheadSlider}
                    min={NOTE_LINGER_MIN_MS}
                    max={NOTE_LINGER_MAX_MS}
                    step={100}
                    value={practice.noteLingerMs}
                    onChange={(e) =>
                      setPractice((p) => ({
                        ...p,
                        noteLingerMs: Number(e.target.value),
                      }))
                    }
                    aria-label="How long played notes stay visible on the fretboard"
                  />
                  <span className={styles.lookaheadHints}>
                    <span>fade fast</span>
                    <span>stay longer</span>
                  </span>
                </label>
                <div className={styles.modeRow}>
                  <span>Display</span>
                  <button
                    type="button"
                    className={displayMode === 'standard' ? styles.modeActive : styles.modeBtn}
                    onClick={() => setDisplayMode('standard')}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    className={displayMode === 'trails' ? styles.modeActive : styles.modeBtn}
                    onClick={() => setDisplayMode('trails')}
                  >
                    Trails
                  </button>
                </div>
                {displayMode === 'trails' ? (
                  <>
                    <label className={styles.lookaheadRow}>
                      <span className={styles.lookaheadLabel}>
                        Future glow{' '}
                        <strong>{practice.trailsPeakGlow}%</strong>
                      </span>
                      <input
                        type="range"
                        className={styles.lookaheadSlider}
                        min={TRAILS_PEAK_GLOW_MIN}
                        max={TRAILS_PEAK_GLOW_MAX}
                        step={5}
                        value={practice.trailsPeakGlow}
                        onChange={(e) =>
                          setPractice((p) => ({
                            ...p,
                            trailsPeakGlow: Number(e.target.value),
                          }))
                        }
                        aria-label="How brightly upcoming Trails notes glow at the cue"
                      />
                      <span className={styles.lookaheadHints}>
                        <span>subtle</span>
                        <span>brilliant</span>
                      </span>
                    </label>
                    <label className={styles.lookaheadRow}>
                      <span className={styles.lookaheadLabel}>
                        Start glowing{' '}
                        <strong>{practice.trailsGlowLeadPercent}%</strong>
                        <span className={styles.lookaheadSub}>
                          {' '}
                          of notes-ahead window
                        </span>
                      </span>
                      <input
                        type="range"
                        className={styles.lookaheadSlider}
                        min={TRAILS_GLOW_LEAD_MIN}
                        max={TRAILS_GLOW_LEAD_MAX}
                        step={5}
                        value={practice.trailsGlowLeadPercent}
                        onChange={(e) =>
                          setPractice((p) => ({
                            ...p,
                            trailsGlowLeadPercent: Number(e.target.value),
                          }))
                        }
                        aria-label="How early upcoming Trails notes begin to glow"
                      />
                      <span className={styles.lookaheadHints}>
                        <span>just before cue</span>
                        <span>earliest</span>
                      </span>
                    </label>
                  </>
                ) : null}
              </section>
            </div>
          ) : null}

          {errorMessage && !parseError ? (
            <p className={styles.playbackError}>{errorMessage}</p>
          ) : null}
        </div>
        ) : null}
      </main>

    </div>
  );
}

export default App;
