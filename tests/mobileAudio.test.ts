import { afterEach, describe, expect, it, vi } from 'vitest';
import { isIOSWebKit } from '../src/utils/mobileAudio';

describe('mobileAudio', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('detects iPhone user agents', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      maxTouchPoints: 5,
    });
    expect(isIOSWebKit()).toBe(true);
  });

  it('detects iPadOS desktop-mode user agents', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      maxTouchPoints: 5,
    });
    expect(isIOSWebKit()).toBe(true);
  });

  it('does not flag desktop Mac without touch', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      maxTouchPoints: 0,
    });
    expect(isIOSWebKit()).toBe(false);
  });
});
