/**
 * Playback engine wrapping alphaTab's AlphaTabApi.
 * UI components subscribe to callbacks — they never touch alphaTab directly.
 *
 * IMPORTANT: Do not subscribe to api.midiLoaded — its EventEmitter calls
 * player.loadedMidiInfo on register, which infinite-loops in alphaTab 1.8.x
 * (getter returns this.loadedMidiInfo). Use playerReady instead.
 */

import { synth, type AlphaTabApi } from '@coderline/alphatab';
import { createTabPlayerApi } from './alphatabAdapter';

export type PlaybackEngineCallbacks = {
  onPosition?: (ms: number, isSeek: boolean) => void;
  onState?: (playing: boolean, ready: boolean) => void;
  onReady?: () => void;
  onError?: (message: string) => void;
  onFinished?: () => void;
};

export class PlaybackEngine {
  private api: AlphaTabApi | null = null;
  private callbacks: PlaybackEngineCallbacks = {};
  private totalMs = 0;
  private currentMsCached = 0;
  private loopStart = 0;
  private loopEnd = 0;
  private loopEnabled = false;
  private loopSeeking = false;
  private eventsWired = false;
  private songReady = false;
  private audioTrackIndices: number[] = [];
  private mountedDisplayCount = 0;

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
      this.markSongReady();
    });

    api.playerPositionChanged.on((args) => {
      this.currentMsCached = args.currentTime;
      this.callbacks.onPosition?.(args.currentTime, args.isSeek);

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

  loadFromBytes(
    data: Uint8Array,
    displayTrackIndexes: number[],
    audioTrackIndexes: number[],
    host: HTMLElement,
    scrollElement: HTMLElement,
  ): void {
    this.audioTrackIndices = [...audioTrackIndexes];
    this.ensureMounted(host, scrollElement, displayTrackIndexes.length);

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

      const ok = api.load(
        data,
        displayTrackIndexes.length > 0 ? displayTrackIndexes : undefined,
      );
      if (!ok) {
        this.callbacks.onError?.('Unsupported file data for playback');
      }
    } catch (err) {
      this.callbacks.onError?.(
        err instanceof Error ? err.message : 'Failed to load song for playback',
      );
    }
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

  get isReady(): boolean {
    return this.songReady;
  }

  get isPlaying(): boolean {
    return this.api?.playerState === synth.PlayerState.Playing;
  }

  async play(): Promise<boolean> {
    const api = this.api;
    if (!api) return false;
    if (!this.songReady) {
      this.callbacks.onError?.(
        'Player is not ready yet. Wait a moment after the file loads, then try Play again.',
      );
      return false;
    }
    try {
      return api.play();
    } catch {
      this.callbacks.onError?.(
        'Could not start playback. Your browser may block autoplay until you interact with the page.',
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
    if (!api || !this.songReady) return;

    if (api.playerState === synth.PlayerState.Playing) {
      this.pause();
      return;
    }

    try {
      const started = api.play();
      this.callbacks.onState?.(started, this.songReady);
    } catch {
      this.callbacks.onError?.('Could not start playback.');
      this.callbacks.onState?.(false, this.songReady);
    }
  }

  restart(): void {
    if (!this.api) return;
    this.api.stop();
    this.api.timePosition = this.loopEnabled ? this.loopStart : 0;
    this.currentMsCached = this.loopEnabled ? this.loopStart : 0;
    this.callbacks.onState?.(false, this.songReady);
    this.callbacks.onPosition?.(this.currentMsCached, true);
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

  destroy(): void {
    this.api?.destroy();
    this.api = null;
    this.eventsWired = false;
    this.songReady = false;
  }

  private emitState(playing?: boolean): void {
    this.callbacks.onState?.(playing ?? this.isPlaying, this.songReady);
  }
}

export const playbackEngine = new PlaybackEngine();
