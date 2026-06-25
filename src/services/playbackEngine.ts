/**
 * Playback engine wrapping alphaTab's AlphaTabApi.
 * UI components subscribe to callbacks — they never touch alphaTab directly.
 *
 * IMPORTANT: Do not subscribe to api.midiLoaded — its EventEmitter calls
 * player.loadedMidiInfo on register, which infinite-loops in alphaTab 1.8.x
 * (getter returns this.loadedMidiInfo). Use playerReady instead.
 */

import {
  StaveProfile,
  synth,
  type AlphaTabApi,
  type midi,
  type model,
  type rendering,
} from '@coderline/alphatab';
import { primeAudioContextOnUserGesture } from '../utils/mobileAudio';
import { createTabPlayerApi, DEFAULT_MASTER_VOLUME } from './alphatabAdapter';

export type PlaybackPosition = {
  ms: number;
  tick: number;
  tempo: number;
  isSeek: boolean;
};

export type BeatClickRange = {
  startMs: number;
  endMs: number;
  clickedMs: number;
  nextBoundaryMs: number | null;
  startTick: number;
  endTick: number;
  clickedTick: number;
  markerRect: MarkerRect | null;
};

export type MarkerRect = {
  x: number;
  y: number;
  height: number;
};

export type BeatTickRange = {
  startTick: number;
  endTick: number;
  nextTick: number | null;
};

export type PlaybackEngineCallbacks = {
  onPosition?: (position: PlaybackPosition) => void;
  onState?: (playing: boolean, ready: boolean) => void;
  onReady?: () => void;
  /** Fired with the player's tick cache so fretboard events match the tab cursor */
  onTimelineReady?: (tickLookup: midi.MidiTickLookup, score: model.Score) => void;
  onError?: (message: string) => void;
  onFinished?: () => void;
  /** Fired when the user clicks a beat in the rendered tab notation */
  onBeatClick?: (beatRange: BeatClickRange) => void;
  /** Fired after alphaTab finishes a (re)render — overlay markers need to recompute positions */
  onTabRendered?: () => void;
};

export class PlaybackEngine {
  private api: AlphaTabApi | null = null;
  private callbacks: PlaybackEngineCallbacks = {};
  private totalMs = 0;
  private currentMsCached = 0;
  private currentTickCached = 0;
  private playbackTempoCached = 120;
  private loopStart = 0;
  private loopEnd = 0;
  private loopEnabled = false;
  private loopPlaybackRange: BeatTickRange | null = null;
  private loopSeeking = false;
  private eventsWired = false;
  private songReady = false;
  private audioTrackIndices: number[] = [];
  private scoreBytes: Uint8Array | null = null;
  private displayTrackIndices: number[] = [];
  private tabResizeObserver: ResizeObserver | null = null;

  attachCallbacks(callbacks: PlaybackEngineCallbacks): void {
    this.callbacks = callbacks;
  }

  get hasApi(): boolean {
    return this.api != null;
  }

  /** Create alphaTab only when needed (keeps initial page load light and crash-free). */
  ensureMounted(container: HTMLElement, scrollElement: HTMLElement, displayedTrackCount: number): void {
    if (!this.api) {
      const layoutTracks = Math.max(displayedTrackCount, 1);
      this.api = createTabPlayerApi(container, scrollElement, layoutTracks);
      // AI_CHANGE:
      // Tool: Codex
      // Model: GPT-5
      // Timestamp: 2026-06-25T16:51:20-04:00
      // Purpose: Re-apply FretFlow's louder default after AlphaTabApi construction.
      // Reason: The player settings default can be overwritten during synth setup, so the live API also needs the intended startup volume.
      this.api.masterVolume = DEFAULT_MASTER_VOLUME;
      this.wireEvents();
    }
  }

  /** Keep playhead and play/pause state across tab re-renders. */
  private withPlaybackPreserved(run: () => void): void {
    const api = this.api;
    if (!api) return;

    const wasPlaying = this.isPlaying;
    const time = this.currentMsCached;

    run();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (time > 0) {
          api.timePosition = time;
          this.currentMsCached = time;
        }
        if (wasPlaying && api.playerState !== synth.PlayerState.Playing) {
          void api.play();
        }
        this.callbacks.onState?.(this.isPlaying, this.songReady);
      });
    });
  }

  private wireEvents(): void {
    const api = this.api;
    if (!api || this.eventsWired) return;
    this.eventsWired = true;

    // Safe: readyForPlayback checks isReadyForPlayback, not loadedMidiInfo
    api.playerReady.on(() => {
      try {
        this.totalMs = api.endTime;
      } catch {
        /* use cached total from parse */
      }
      this.syncAudioTracks(this.audioTrackIndices);
      if (this.displayTrackIndices.length > 0) {
        this.paintDisplayTracks(this.displayTrackIndices);
      }
      const tickCache = api.tickCache;
      const score = api.score;
      if (tickCache && score) {
        this.callbacks.onTimelineReady?.(tickCache, score);
      }
      this.markSongReady();
    });

    api.playerPositionChanged.on((args) => {
      this.currentMsCached = args.currentTime;
      this.currentTickCached = args.currentTick;
      this.playbackTempoCached = args.modifiedTempo;
      this.callbacks.onPosition?.({
        ms: args.currentTime,
        tick: args.currentTick,
        tempo: args.modifiedTempo,
        isSeek: args.isSeek,
      });

      if (
        this.loopEnabled &&
        this.loopPlaybackRange &&
        this.loopPlaybackRange.endTick > this.loopPlaybackRange.startTick &&
        args.currentTick >= this.loopPlaybackRange.endTick &&
        !this.loopSeeking
      ) {
        this.loopSeeking = true;
        api.tickPosition = this.loopPlaybackRange.startTick;
        this.currentTickCached = this.loopPlaybackRange.startTick;
        this.callbacks.onPosition?.({
          ms: this.currentMsCached,
          tick: this.currentTickCached,
          tempo: this.playbackTempoCached,
          isSeek: true,
        });
        requestAnimationFrame(() => {
          this.loopSeeking = false;
        });
        return;
      }

      if (
        this.loopEnabled &&
        !this.loopPlaybackRange &&
        this.loopEnd > this.loopStart &&
        args.currentTime >= this.loopEnd &&
        !this.loopSeeking
      ) {
        this.loopSeeking = true;
        api.timePosition = this.loopStart;
        requestAnimationFrame(() => {
          this.loopSeeking = false;
        });
      }
    });

    api.playerStateChanged.on((args) => {
      this.emitState(args.state === synth.PlayerState.Playing);
    });

    api.playerFinished.on(() => {
      if (
        this.loopEnabled &&
        this.loopPlaybackRange &&
        this.loopPlaybackRange.endTick > this.loopPlaybackRange.startTick
      ) {
        // AI_CHANGE:
        // Tool: Codex
        // Model: GPT-5
        // Timestamp: 2026-06-25T16:44:30-04:00
        // Purpose: Keep click-selected Repeat playback alive if alphaTab reports finished at a loop boundary.
        // Reason: Some repeat ranges can emit playerFinished before the position-change loop guard runs, which looks like the app paused itself.
        api.tickPosition = this.loopPlaybackRange.startTick;
        this.currentTickCached = this.loopPlaybackRange.startTick;
        this.callbacks.onPosition?.({
          ms: this.currentMsCached,
          tick: this.currentTickCached,
          tempo: this.playbackTempoCached,
          isSeek: true,
        });
        requestAnimationFrame(() => {
          if (this.loopEnabled && this.api?.playerState !== synth.PlayerState.Playing) {
            void this.api?.play();
          }
          this.emitState(true);
        });
        return;
      }
      this.callbacks.onFinished?.();
      this.emitState(false);
    });

    api.error.on((err: Error) => {
      this.callbacks.onError?.(err.message ?? 'Playback error');
    });

    // AI_CHANGE:
    // Tool: Cursor
    // Model: Composer
    // Timestamp: 2026-06-04T23:45:00-04:00
    // Purpose: Re-layout tab notation when the scroll panel width changes.
    // Reason: Stale page width during playback left the active system clipped on the right.
    api.postRenderFinished.on(() => {
      this.syncTabSurfaceOverflow();
      this.callbacks.onTabRendered?.();
    });

    // App-level loop selection uses beatRangeAtClientPoint so the marker can stay on
    // the real pointer coordinate instead of alphaTab's model beat boundary.
  }

  private observeTabPanelResize(scrollElement: HTMLElement): void {
    this.tabResizeObserver?.disconnect();
    if (typeof ResizeObserver === 'undefined') return;

    let resizeFrame = 0;
    this.tabResizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        const api = this.api;
        if (!api?.score) return;
        try {
          api.renderer.resizeRender();
        } catch {
          /* render may defer until fonts load */
        }
      });
    });
    this.tabResizeObserver.observe(scrollElement);
  }

  /** Match alphaTab Smooth-scroll canvas padding so glyphs past the last bar stay visible. */
  private syncTabSurfaceOverflow(): void {
    const api = this.api;
    if (!api?.canvasElement) return;

    const canvas = api.canvasElement as { element?: HTMLElement };
    const surface = canvas.element;
    if (!surface?.classList.contains('at-surface')) return;

    surface.style.overflow = 'visible';
    surface.style.boxSizing = 'content-box';
    surface.style.paddingRight = '48px';
  }

  private markSongReady(): void {
    this.songReady = true;
    this.callbacks.onReady?.();
    this.callbacks.onState?.(this.isPlaying, true);
  }

  /** Re-layout notation when the tab host gains size (alphaTab skips render at width 0). */
  requestRender(force = false): void {
    const api = this.api;
    if (!api?.score) return;
    if (!force && this.isPlaying) return;
    try {
      api.render();
    } catch {
      /* render may defer until fonts load */
    }
  }

  private resolveScoreTracks(trackIndices: number[]): model.Track[] {
    const api = this.api;
    if (!api?.score) return [];

    const byIndex = new Map(api.score.tracks.map((track) => [track.index, track]));
    return trackIndices
      .map((index) => byIndex.get(index))
      .filter((track): track is model.Track => track != null);
  }

  private syncTabLayoutSettings(displayedTrackCount: number): void {
    const api = this.api;
    if (!api) return;

    const multi = displayedTrackCount > 1;
    api.settings.display.staveProfile = multi ? StaveProfile.TabMixed : StaveProfile.Tab;
    api.settings.display.barsPerRow = multi ? 2 : 4;
    api.updateSettings();
  }

  private paintDisplayTracks(trackIndices: number[]): void {
    const api = this.api;
    if (!api?.score) return;

    const tracks = this.resolveScoreTracks(trackIndices);
    if (tracks.length === 0) return;

    this.syncTabLayoutSettings(tracks.length);
    // renderTracks already triggers a full render; a second render() mid-playback can leave partials clipped.
    api.renderTracks(tracks);
  }

  loadFromBytes(
    data: Uint8Array,
    displayTrackIndexes: number[],
    audioTrackIndexes: number[],
    host: HTMLElement,
    scrollElement: HTMLElement,
    /** Load every score track so later toggles can use renderTracks without reloading. */
    scoreTrackIndexes?: number[],
  ): void {
    this.scoreBytes = data;
    this.displayTrackIndices = [...displayTrackIndexes];
    this.audioTrackIndices = [...audioTrackIndexes];
    this.ensureMounted(
      host,
      scrollElement,
      Math.max(displayTrackIndexes.length, scoreTrackIndexes?.length ?? 1),
    );
    this.observeTabPanelResize(scrollElement);

    const api = this.api;
    if (!api) {
      this.callbacks.onError?.('Playback not initialized');
      return;
    }

    try {
      this.songReady = false;
      this.totalMs = 0;
      this.currentMsCached = 0;
      this.callbacks.onState?.(false, false);

      const loadIndexes =
        scoreTrackIndexes && scoreTrackIndexes.length > 0
          ? scoreTrackIndexes
          : displayTrackIndexes;

      const loadTracks = () => {
        const ok = api.load(
          data,
          loadIndexes.length > 0 ? loadIndexes : undefined,
        );
        if (!ok) {
          this.callbacks.onError?.('Unsupported file data for playback');
          return;
        }
        requestAnimationFrame(() => requestAnimationFrame(() => this.requestRender()));
      };

      if (host.clientWidth > 0) {
        loadTracks();
      } else {
        requestAnimationFrame(() => requestAnimationFrame(loadTracks));
      }
    } catch (err) {
      this.callbacks.onError?.(
        err instanceof Error ? err.message : 'Failed to load song for playback',
      );
    }
  }

  hasLoadedScore(data: Uint8Array): boolean {
    return this.scoreBytes === data && this.api?.score != null;
  }

  // AI_CHANGE:
  // Tool: Cursor
  // Model: Composer
  // Timestamp: 2026-06-10T18:10:00-04:00
  // Purpose: Swap tab tracks without tearing down the player or resetting the playhead.
  // Reason: User toggling neck tracks should not stop playback and jump to the start.
  setDisplayTracks(
    displayTrackIndexes: number[],
    _host: HTMLElement,
    _scrollElement: HTMLElement,
  ): void {
    if (displayTrackIndexes.length === 0) return;

    this.displayTrackIndices = [...displayTrackIndexes];

    const api = this.api;
    if (!api?.score) return;

    this.withPlaybackPreserved(() => {
      this.paintDisplayTracks(displayTrackIndexes);
    });
  }

  /** Mute/unmute score tracks to match speaker toggles (tab can show more tracks than play). */
  syncAudioTracks(audioTrackIndexes: number[]): void {
    this.audioTrackIndices = [...audioTrackIndexes];
    const apply = () => this.applyAudioTrackMute(audioTrackIndexes);
    if (this.songReady) {
      this.withPlaybackPreserved(apply);
    } else {
      apply();
    }
  }

  private applyAudioTrackMute(audioTrackIndexes: number[]): void {
    const api = this.api;
    if (!api?.score) return;

    const audible = new Set(audioTrackIndexes);
    for (const track of api.score.tracks) {
      api.changeTrackMute([track], !audible.has(track.index));
    }
  }

  getTotalMs(): number {
    return this.totalMs;
  }

  getCurrentMs(): number {
    return this.currentMsCached;
  }

  getCurrentTick(): number {
    return this.currentTickCached;
  }

  getPlaybackTempo(): number {
    return this.playbackTempoCached;
  }

  get isReady(): boolean {
    return this.songReady;
  }

  get isPlaying(): boolean {
    return this.api?.playerState === synth.PlayerState.Playing;
  }

  play(): boolean {
    const api = this.api;
    if (!api) return false;
    if (!this.songReady) {
      this.callbacks.onError?.(
        'Player is not ready yet. Wait a moment after the file loads, then try Play again.',
      );
      return false;
    }
    primeAudioContextOnUserGesture();
    try {
      if (
        this.loopEnabled &&
        this.loopPlaybackRange &&
        this.loopPlaybackRange.endTick > this.loopPlaybackRange.startTick &&
        (this.currentTickCached < this.loopPlaybackRange.startTick ||
          this.currentTickCached >= this.loopPlaybackRange.endTick)
      ) {
        // AI_CHANGE:
        // Tool: Codex
        // Model: GPT-5
        // Timestamp: 2026-06-25T16:24:10-04:00
        // Purpose: Enter click-selected Repeat ranges by tick so repeated systems seek to the selected visual occurrence.
        // Reason: The same millisecond range can map alphaTab's cursor to an earlier repeated system.
        api.tickPosition = this.loopPlaybackRange.startTick;
        this.currentTickCached = this.loopPlaybackRange.startTick;
        this.callbacks.onPosition?.({
          ms: this.currentMsCached,
          tick: this.currentTickCached,
          tempo: this.playbackTempoCached,
          isSeek: true,
        });
      } else if (
        this.loopEnabled &&
        this.loopEnd > this.loopStart &&
        (this.currentMsCached < this.loopStart || this.currentMsCached >= this.loopEnd)
      ) {
        // AI_CHANGE:
        // Tool: Codex
        // Model: GPT-5
        // Timestamp: 2026-06-25T15:44:17-04:00
        // Purpose: Enter the selected Repeat range before starting playback.
        // Reason: Pressing Play while the playhead was outside A/B made playback begin from a stale location.
        api.timePosition = this.loopStart;
        this.currentMsCached = this.loopStart;
        this.callbacks.onPosition?.({
          ms: this.currentMsCached,
          tick: this.currentTickCached,
          tempo: this.playbackTempoCached,
          isSeek: true,
        });
      }
      const started = api.play();
      if (!started) {
        this.callbacks.onError?.(
          'Could not start playback. Tap Play again, and check that your device is not muted.',
        );
      }
      return started;
    } catch {
      this.callbacks.onError?.(
        'Could not start playback. Your browser may block audio until you interact with the page.',
      );
      return false;
    }
  }

  pause(): void {
    const api = this.api;
    if (!api) return;
    api.pause();
    this.callbacks.onState?.(false, this.songReady);
  }

  playPause(): void {
    const api = this.api;
    if (!api || !this.songReady) {
      if (!this.songReady) {
        this.callbacks.onError?.(
          'Player is not ready yet. Wait a moment after the file loads, then try Play again.',
        );
      }
      return;
    }

    if (api.playerState === synth.PlayerState.Playing) {
      this.pause();
      return;
    }

    if (this.play()) {
      this.callbacks.onState?.(true, this.songReady);
    }
  }

  restart(): void {
    if (!this.api) return;
    this.api.stop();
    this.api.timePosition = this.loopEnabled ? this.loopStart : 0;
    this.currentMsCached = this.loopEnabled ? this.loopStart : 0;
    this.callbacks.onState?.(false, this.songReady);
    this.callbacks.onPosition?.({
      ms: this.currentMsCached,
      tick: this.currentTickCached,
      tempo: this.playbackTempoCached,
      isSeek: true,
    });
  }

  seek(ms: number): void {
    if (!this.api) return;
    const clamped = Math.max(0, Math.min(ms, this.totalMs || ms));
    this.api.timePosition = clamped;
    this.currentMsCached = clamped;
  }

  setSpeed(speed: number): void {
    if (this.api) this.api.playbackSpeed = speed;
  }

  setMetronome(enabled: boolean, volume = 0.35): void {
    if (!this.api) return;
    this.api.metronomeVolume = enabled ? volume : 0;
  }

  setLoop(enabled: boolean, startMs: number, endMs: number): void {
    this.loopEnabled = enabled;
    this.loopStart = startMs;
    this.loopEnd = endMs;
    this.applyPlaybackRange();
  }

  // AI_CHANGE:
  // Tool: Codex
  // Model: GPT-5
  // Timestamp: 2026-06-25T16:44:30-04:00
  // Purpose: Store click-selected Repeat tick bounds for FretFlow's own loop/cursor logic.
  // Reason: alphaTab playbackRange can stop playback at the range end, so Repeat must not rely on it.
  setLoopPlaybackRange(range: BeatTickRange | null): void {
    this.loopPlaybackRange = range;
    this.applyPlaybackRange();
  }

  private applyPlaybackRange(): void {
    const api = this.api;
    if (!api) return;
    api.playbackRange = null;
  }

  // AI_CHANGE:
  // Tool: Claude Code
  // Model: claude-opus-4-7
  // Timestamp: 2026-06-25T14:30:00-04:00
  // Purpose: Locate the BeatBounds (alphaTab pixel rect) for a given playback ms.
  // Reason: LoopMarkers overlay renders vertical handles aligned to beat columns on the tab canvas.
  /** Find the visible beat whose play time is at or just before the given ms. */
  findBeatBoundsForMs(ms: number): rendering.BeatBounds | null {
    const api = this.api;
    if (!api?.score) return null;
    const lookup = api.renderer?.boundsLookup;
    if (!lookup) return null;
    const beat = this.findClosestBeatByMs(ms);
    if (!beat) return null;
    return lookup.findBeat(beat);
  }

  markerRectForMs(ms: number): MarkerRect | null {
    const bounds = this.findBeatBoundsForMs(ms);
    if (!bounds) return null;
    return this.markerRectFromBounds(bounds);
  }

  // AI_CHANGE:
  // Tool: Claude Code
  // Model: claude-opus-4-7
  // Timestamp: 2026-06-25T14:30:00-04:00
  // Purpose: Convert a beat's tick position to ms using tickCache master bars.
  // Reason: api.load() does not populate beat.timer; click handler needs ms.
  private resolveBeatMs(beat: model.Beat): number | null {
    return this.resolveBeatRangeMs(beat, null)?.startMs ?? null;
  }

  // AI_CHANGE:
  // Tool: Codex
  // Model: GPT-5
  // Timestamp: 2026-06-25T16:24:10-04:00
  // Purpose: Resolve clicked Repeat beats from the rendered beat occurrence before falling back to first-match tick math.
  // Reason: The same model beat can render in multiple systems; Repeat must seek to the occurrence the user clicked.
  private resolveBeatRangeMs(
    beat: model.Beat,
    clickedBounds: rendering.BeatBounds | null,
  ): BeatClickRange | null {
    const api = this.api;
    const tickCache = api?.tickCache;
    if (!tickCache) return null;

    const tickRange = this.resolveBeatTickRange(beat, clickedBounds);
    if (!tickRange) return null;

    const startMs = this.ticksToMs(tickRange.startTick);
    if (startMs == null) return null;

    const nextBoundaryMs = tickRange.nextTick == null ? null : this.ticksToMs(tickRange.nextTick);
    let endMs = this.ticksToMs(tickRange.endTick) ?? startMs;
    if (endMs <= startMs + 1) {
      if (nextBoundaryMs != null) {
        endMs = nextBoundaryMs;
      }
    }
    return {
      startMs,
      endMs: Math.max(endMs, startMs),
      clickedMs: startMs,
      nextBoundaryMs,
      startTick: tickRange.startTick,
      endTick: tickRange.endTick,
      clickedTick: tickRange.startTick,
      markerRect: clickedBounds ? this.markerRectFromBounds(clickedBounds) : this.beatMarkerRect(beat),
    };
  }

  private resolveBeatTickRange(
    beat: model.Beat,
    clickedBounds: rendering.BeatBounds | null,
  ): BeatTickRange | null {
    const api = this.api;
    const tickCache = api?.tickCache;
    if (!tickCache) return null;

    const renderedOccurrence = clickedBounds ? this.renderedOccurrenceIndex(beat, clickedBounds) : 0;
    let seen = 0;
    let lastMatch: BeatTickRange | null = null;

    for (const masterBarLookup of tickCache.masterBars) {
      let slice = masterBarLookup.firstBeat;
      while (slice) {
        for (const item of slice.highlightedBeats) {
          if (item.beat !== beat) continue;
          if (item.playbackStart !== slice.start) continue;

          const startTick = masterBarLookup.start + item.playbackStart;
          const range = tickCache.getRelativeBeatPlaybackRange(beat);
          let endTick = startTick + Math.max(beat.playbackDuration ?? 0, 1);
          if (range) {
            endTick = masterBarLookup.start + range.endTick;
          } else {
            const sliceEnd = masterBarLookup.start + slice.end;
            if (sliceEnd > startTick) endTick = sliceEnd;
          }
          if (endTick <= startTick) endTick = startTick + 1;
          const match = { startTick, endTick, nextTick: endTick };
          lastMatch = match;
          if (seen === renderedOccurrence) return match;
          seen += 1;
          break;
        }
        slice = slice.nextBeat;
      }
    }

    if (lastMatch) return lastMatch;

    let startTick: number;
    try {
      startTick = tickCache.getBeatStart(beat);
    } catch {
      startTick = beat.absolutePlaybackStart;
    }
    let endTick = startTick + Math.max(beat.playbackDuration ?? 0, 1);
    try {
      const masterBarLookup = tickCache.getMasterBar(beat.voice.bar.masterBar);
      const range = tickCache.getRelativeBeatPlaybackRange(beat);
      if (range) {
        endTick = masterBarLookup.start + range.endTick;
      } else if (beat.nextBeat) {
        const nextStart = tickCache.getBeatStart(beat.nextBeat);
        if (nextStart > startTick) endTick = nextStart;
      }
    } catch {
      /* keep playbackDuration fallback */
    }
    if (endTick <= startTick) endTick = startTick + 1;
    return { startTick, endTick, nextTick: endTick };
  }

  private renderedOccurrenceIndex(
    beat: model.Beat,
    clickedBounds: rendering.BeatBounds,
  ): number {
    const allBounds = this.api?.renderer?.boundsLookup?.findBeats(beat) ?? null;
    if (!allBounds || allBounds.length === 0) return 0;
    const exact = allBounds.indexOf(clickedBounds);
    if (exact >= 0) return exact;

    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < allBounds.length; i++) {
      const bounds = allBounds[i];
      const dx = bounds.onNotesX - clickedBounds.onNotesX;
      const dy = bounds.visualBounds.y - clickedBounds.visualBounds.y;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestIndex = i;
        bestDistance = distance;
      }
    }
    return bestIndex;
  }

  private beatBoundsAtPoint(
    beat: model.Beat,
    x: number,
    y: number,
  ): rendering.BeatBounds | null {
    const allBounds = this.api?.renderer?.boundsLookup?.findBeats(beat) ?? null;
    if (!allBounds || allBounds.length === 0) return this.api?.renderer?.boundsLookup?.findBeat(beat) ?? null;

    let best: { bounds: rendering.BeatBounds; distance: number } | null = null;
    for (const bounds of allBounds) {
      const v = bounds.visualBounds;
      const withinY = y >= v.y - 12 && y <= v.y + v.h + 12;
      const dx = Math.abs(x - bounds.onNotesX);
      const dy = y < v.y ? v.y - y : y > v.y + v.h ? y - (v.y + v.h) : 0;
      const distance = dx * dx + dy * dy;
      if (withinY && (!best || distance < best.distance)) {
        best = { bounds, distance };
      }
    }
    if (best) return best.bounds;

    for (const bounds of allBounds) {
      const dx = x - bounds.onNotesX;
      const v = bounds.visualBounds;
      const centerY = v.y + v.h / 2;
      const dy = y - centerY;
      const distance = dx * dx + dy * dy;
      if (!best || distance < best.distance) {
        best = { bounds, distance };
      }
    }
    return best?.bounds ?? null;
  }

  private beatMarkerRect(beat: model.Beat): MarkerRect | null {
    const lookup = this.api?.renderer?.boundsLookup;
    if (!lookup) return null;
    const bounds = lookup.findBeat(beat);
    if (!bounds) return null;
    return this.markerRectFromBounds(bounds);
  }

  private markerRectFromBounds(bounds: rendering.BeatBounds): MarkerRect {
    const system = bounds.barBounds?.masterBarBounds?.staffSystemBounds;
    const v = bounds.visualBounds;
    const sysY = system?.visualBounds.y ?? v.y;
    const sysH = system?.visualBounds.h ?? v.h;
    return {
      x: bounds.onNotesX,
      y: sysY,
      height: sysH,
    };
  }

  /** Walks tickCache master bars (which include tempoChanges) to map ticks→ms. */
  private ticksToMs(targetTick: number): number | null {
    const tickCache = this.api?.tickCache;
    if (!tickCache) return null;
    const QPQ = 960; // MidiUtils.QuarterTime
    let cumulativeMs = 0;
    for (const mb of tickCache.masterBars) {
      const barStart = mb.start;
      const barEnd = mb.end;
      const upper = Math.min(targetTick, barEnd);
      if (upper <= barStart) break;
      const changes = mb.tempoChanges;
      if (changes.length === 0) {
        // Fallback: assume initial score tempo
        const tempo = this.api?.score?.tempo ?? 120;
        cumulativeMs += ((upper - barStart) * 60000) / (tempo * QPQ);
      } else {
        let cursor = barStart;
        for (let i = 0; i < changes.length; i++) {
          const change = changes[i];
          const changeAbsTick = barStart + change.tick;
          const nextChangeAbsTick =
            i + 1 < changes.length ? barStart + changes[i + 1].tick : barEnd;
          const segStart = Math.max(cursor, changeAbsTick);
          const segEnd = Math.min(upper, nextChangeAbsTick);
          if (segEnd > segStart) {
            cumulativeMs += ((segEnd - segStart) * 60000) / (change.tempo * QPQ);
            cursor = segEnd;
          }
          if (cursor >= upper) break;
        }
      }
      if (targetTick <= barEnd) break;
    }
    return cumulativeMs;
  }

  /** Walks displayed tracks looking for the beat whose ms time best matches the target. */
  private findClosestBeatByMs(targetMs: number): model.Beat | null {
    const api = this.api;
    if (!api?.score) return null;
    const trackSet = new Set(
      this.displayTrackIndices.length > 0
        ? this.displayTrackIndices
        : api.score.tracks.map((t) => t.index),
    );
    let best: { beat: model.Beat; delta: number } | null = null;
    for (const track of api.score.tracks) {
      if (!trackSet.has(track.index)) continue;
      for (const staff of track.staves) {
        for (const bar of staff.bars) {
          for (const voice of bar.voices) {
            for (const beat of voice.beats) {
              const t = this.resolveBeatMs(beat);
              if (t == null) continue;
              const delta = Math.abs(t - targetMs);
              if (!best || delta < best.delta) best = { beat, delta };
              if (t > targetMs && best && delta > best.delta) break;
            }
          }
        }
      }
    }
    return best?.beat ?? null;
  }

  /**
   * Given a screen-space pointer (clientX/clientY), return the beat ms at that
   * location on the tab canvas, or null if the pointer is outside the notation.
   */
  beatTimeAtClientPoint(clientX: number, clientY: number): number | null {
    return this.beatRangeAtClientPoint(clientX, clientY)?.startMs ?? null;
  }

  // AI_CHANGE:
  // Tool: Codex
  // Model: GPT-5
  // Timestamp: 2026-06-25T16:24:10-04:00
  // Purpose: Resolve a tab pointer click through the rendered beat occurrence and preserve the clicked x-coordinate for the marker.
  // Reason: Repeated systems can share model beats; Repeat must seek to the occurrence the user clicked while still drawing A/B at the pointer.
  beatRangeAtClientPoint(clientX: number, clientY: number): BeatClickRange | null {
    const api = this.api;
    if (!api?.canvasElement) return null;
    const lookup = api.renderer?.boundsLookup;
    if (!lookup) return null;
    const surface = (api.canvasElement as { element?: HTMLElement }).element;
    if (!surface) return null;
    const rect = surface.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const beat = lookup.getBeatAtPos(x, y);
    if (!beat) return null;
    const clickedBounds = this.beatBoundsAtPoint(beat, x, y);
    const range = this.resolveBeatRangeMs(beat, clickedBounds);
    if (!range) return null;
    const markerRect = range.markerRect ? { ...range.markerRect, x } : null;
    const clickedMs = this.interpolateBeatClickMs(range, x, clickedBounds);
    const clickedTick = this.interpolateBeatClickTick(range, x, clickedBounds);
    return {
      ...range,
      clickedMs,
      clickedTick,
      markerRect,
    };
  }

  private interpolateBeatClickMs(
    range: BeatClickRange,
    x: number,
    clickedBounds: rendering.BeatBounds | null,
  ): number {
    const markerX = clickedBounds?.onNotesX ?? range.markerRect?.x ?? x;
    const nextX = clickedBounds ? this.nextRenderedBeatX(clickedBounds) : null;
    const visualWidth = nextX != null && nextX > markerX ? nextX - markerX : 80;
    const ratio = Math.max(0, Math.min(1, (x - markerX) / visualWidth));
    const timeWidth = Math.max(range.nextBoundaryMs ?? range.endMs, range.endMs, range.startMs + 1);
    return range.startMs + ratio * (timeWidth - range.startMs);
  }

  private interpolateBeatClickTick(
    range: BeatClickRange,
    x: number,
    clickedBounds: rendering.BeatBounds | null,
  ): number {
    const markerX = clickedBounds?.onNotesX ?? range.markerRect?.x ?? x;
    const nextX = clickedBounds ? this.nextRenderedBeatX(clickedBounds) : null;
    const visualWidth = nextX != null && nextX > markerX ? nextX - markerX : 80;
    const ratio = Math.max(0, Math.min(1, (x - markerX) / visualWidth));
    const tickWidth = Math.max(range.endTick - range.startTick, 1);
    return Math.round(range.startTick + ratio * tickWidth);
  }

  private nextRenderedBeatX(bounds: rendering.BeatBounds): number | null {
    const beats = bounds.barBounds?.beats ?? [];
    let next: number | null = null;
    for (const candidate of beats) {
      if (candidate === bounds) continue;
      if (candidate.onNotesX <= bounds.onNotesX + 1) continue;
      if (next == null || candidate.onNotesX < next) next = candidate.onNotesX;
    }
    return next;
  }

  /** Stop synth output immediately (used on unload and before destroy). */
  stopPlayback(): void {
    const api = this.api;
    if (!api) return;
    try {
      if (api.playerState === synth.PlayerState.Playing) {
        api.pause();
      }
    } catch {
      /* audio node may already be torn down */
    }
    try {
      api.stop();
    } catch {
      /* ignore */
    }
  }

  destroy(): void {
    this.tabResizeObserver?.disconnect();
    this.tabResizeObserver = null;

    const api = this.api;
    if (api) {
      this.stopPlayback();
      try {
        api.destroy();
      } catch {
        /* ignore teardown races on navigation */
      }
    }
    this.api = null;
    this.eventsWired = false;
    this.songReady = false;
    this.scoreBytes = null;
    this.currentMsCached = 0;
    this.currentTickCached = 0;
    this.callbacks.onState?.(false, false);
  }

  private emitState(playing?: boolean): void {
    this.callbacks.onState?.(playing ?? this.isPlaying, this.songReady);
  }
}

export const playbackEngine = new PlaybackEngine();

// AI_CHANGE:
// Tool: Cursor
// Model: Composer
// Timestamp: 2026-06-05T17:25:00-04:00
// Purpose: Stop alphaTab audio when the tab navigates away or reloads.
// Reason: React cleanup can run too late; the synth worklet kept playing after refresh.
if (typeof window !== 'undefined') {
  const w = window as Window & { __ffPlaybackTeardown?: boolean };
  if (!w.__ffPlaybackTeardown) {
    w.__ffPlaybackTeardown = true;
    const stopOnLeave = () => playbackEngine.destroy();
    window.addEventListener('pagehide', stopOnLeave);
    window.addEventListener('beforeunload', stopOnLeave);
  }
}
