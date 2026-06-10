/**
 * Playback engine wrapping alphaTab's AlphaTabApi.
 * UI components subscribe to callbacks — they never touch alphaTab directly.
 *
 * IMPORTANT: Do not subscribe to api.midiLoaded — its EventEmitter calls
 * player.loadedMidiInfo on register, which infinite-loops in alphaTab 1.8.x
 * (getter returns this.loadedMidiInfo). Use playerReady instead.
 */

import { StaveProfile, synth, type AlphaTabApi, type midi, type model } from '@coderline/alphatab';
import { primeAudioContextOnUserGesture } from '../utils/mobileAudio';
import { createTabPlayerApi } from './alphatabAdapter';

export type PlaybackPosition = {
  ms: number;
  tick: number;
  tempo: number;
  isSeek: boolean;
};

export type PlaybackEngineCallbacks = {
  onPosition?: (position: PlaybackPosition) => void;
  onState?: (playing: boolean, ready: boolean) => void;
  onReady?: () => void;
  /** Fired with the player's tick cache so fretboard events match the tab cursor */
  onTimelineReady?: (tickLookup: midi.MidiTickLookup, score: model.Score) => void;
  onError?: (message: string) => void;
  onFinished?: () => void;
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
    });
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
