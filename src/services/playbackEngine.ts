/**
 * Playback engine wrapping alphaTab's AlphaTabApi.
 * UI components subscribe to callbacks — they never touch alphaTab directly.
 *
 * IMPORTANT: Do not subscribe to api.midiLoaded — its EventEmitter calls
 * player.loadedMidiInfo on register, which infinite-loops in alphaTab 1.8.x
 * (getter returns this.loadedMidiInfo). Use playerReady instead.
 */

import { synth, type AlphaTabApi, type midi, type model } from '@coderline/alphatab';
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
  private mountedDisplayCount = 0;
  private scoreBytes: Uint8Array | null = null;

  attachCallbacks(callbacks: PlaybackEngineCallbacks): void {
    this.callbacks = callbacks;
  }

  get hasApi(): boolean {
    return this.api != null;
  }

  /** Create alphaTab only when needed (keeps initial page load light and crash-free). */
  ensureMounted(container: HTMLElement, scrollElement: HTMLElement, displayedTrackCount: number): void {
    if (this.api && this.mountedDisplayCount !== displayedTrackCount) {
      this.destroy();
    }
    if (!this.api) {
      this.api = createTabPlayerApi(container, scrollElement, displayedTrackCount);
      this.mountedDisplayCount = displayedTrackCount;
      this.wireEvents();
    }
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
  }

  private markSongReady(): void {
    this.songReady = true;
    this.callbacks.onReady?.();
    this.callbacks.onState?.(this.isPlaying, true);
  }

  /** Re-layout notation when the tab host gains size (alphaTab skips render at width 0). */
  requestRender(): void {
    const api = this.api;
    if (!api?.score || this.isPlaying) return;
    try {
      api.render();
    } catch {
      /* render may defer until fonts load */
    }
  }

  loadFromBytes(
    data: Uint8Array,
    displayTrackIndexes: number[],
    audioTrackIndexes: number[],
    host: HTMLElement,
    scrollElement: HTMLElement,
  ): void {
    this.scoreBytes = data;
    this.audioTrackIndices = [...audioTrackIndexes];
    this.ensureMounted(host, scrollElement, Math.max(displayTrackIndexes.length, 1));

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

      const loadTracks = () => {
        const ok = api.load(
          data,
          displayTrackIndexes.length > 0 ? displayTrackIndexes : undefined,
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
  // Timestamp: 2026-06-08T14:15:00-04:00
  // Purpose: Re-render tab notation when fretboard track selection changes.
  // Reason: Tab strip should match guitar-icon selection without reloading the whole score.
  setDisplayTracks(
    displayTrackIndexes: number[],
    host: HTMLElement,
    scrollElement: HTMLElement,
  ): void {
    if (!this.scoreBytes) return;

    if (displayTrackIndexes.length === 0) {
      return;
    }

    const api = this.api;
    if (api?.score && this.mountedDisplayCount === displayTrackIndexes.length) {
      const tracks = displayTrackIndexes
        .map((index) => api.score!.tracks[index])
        .filter((track): track is model.Track => track != null);
      if (tracks.length === 0) return;

      const time = this.currentMsCached;
      api.renderTracks(tracks);
      requestAnimationFrame(() => requestAnimationFrame(() => this.requestRender()));
      if (time > 0) {
        api.timePosition = time;
      }
      return;
    }

    this.loadFromBytes(
      this.scoreBytes,
      displayTrackIndexes,
      this.audioTrackIndices,
      host,
      scrollElement,
    );
  }

  /** Mute/unmute score tracks to match speaker toggles (tab can show more tracks than play). */
  syncAudioTracks(audioTrackIndexes: number[]): void {
    this.audioTrackIndices = [...audioTrackIndexes];
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
