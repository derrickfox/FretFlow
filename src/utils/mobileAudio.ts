// AI_CHANGE:
// Tool: Cursor
// Model: Composer
// Timestamp: 2026-06-05T09:35:00-04:00
// Purpose: Detect iOS/iPadOS WebKit and prime AudioContext on user gestures.
// Reason: Mobile Safari/Chrome often stay silent with AudioWorklets; resume must run in the gesture stack.

/** iPhone, iPad, iPod, and iPadOS desktop-mode (Macintosh + touch). */
export function isIOSWebKit(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua);
}

/**
 * Runs synchronously inside click/touch handlers so iOS keeps the user-gesture
 * chain before alphaTab starts playback.
 */
export function primeAudioContextOnUserGesture(): void {
  if (typeof window === 'undefined') return;

  type ACtor = typeof AudioContext;
  const w = window as Window & { webkitAudioContext?: ACtor };
  const AC = window.AudioContext ?? w.webkitAudioContext;
  if (!AC) return;

  try {
    const ctx = new AC();
    if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
      void ctx.resume();
    }
    if (isIOSWebKit()) {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    }
    void ctx.close();
  } catch {
    /* best-effort unlock */
  }
}
