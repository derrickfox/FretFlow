import { expect, test } from '@playwright/test';

async function loadSong(page: import('@playwright/test').Page, songId: string) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'FretFlow', exact: true })).toBeVisible();
  await page.getByLabel('Sample songs').selectOption(songId);
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled({
    timeout: 30_000,
  });
}

async function clickTabBeat(page: import('@playwright/test').Page, xRatio: number, yRatio: number) {
  const surface = page.locator('.at-surface');
  await expect(surface).toBeVisible({ timeout: 15_000 });
  const box = await surface.boundingBox();
  expect(box).not.toBeNull();
  const point = { x: box!.x + box!.width * xRatio, y: box!.y + box!.height * yRatio };
  await page.mouse.click(point.x, point.y);
  return point;
}

type SurfacePoint = {
  x: number;
  y: number;
};

async function clickTabSurfacePoint(page: import('@playwright/test').Page, point: SurfacePoint) {
  const viewportPoint = await page.evaluate(({ x, y }) => {
    const surface = document.querySelector('.at-surface') as HTMLElement | null;
    if (!surface) throw new Error('Missing alphaTab surface');
    const scroller = surface.closest('[class*="scroll"]') as HTMLElement | null;
    if (!scroller) throw new Error('Missing tab scroll container');

    // AI_CHANGE:
    // Tool: Codex
    // Model: GPT-5
    // Timestamp: 2026-06-25T17:18:07-04:00
    // Purpose: Snap e2e tab clicks to the nearest rendered note before selecting Repeat bounds.
    // Reason: The taller tab viewport changed scroll geometry, making raw surface coordinates miss note glyphs.
    scroller.scrollIntoView({ block: 'center', inline: 'nearest' });

    const surfaceRect = surface.getBoundingClientRect();
    let selected = { x, y };
    let selectedDistance = Number.POSITIVE_INFINITY;
    for (const node of surface.querySelectorAll('text')) {
      const text = (node.textContent ?? '').trim();
      if (!/^\d+$/.test(text)) continue;
      const rect = node.getBoundingClientRect();
      const center = {
        x: rect.x - surfaceRect.x + rect.width / 2,
        y: rect.y - surfaceRect.y + rect.height / 2,
      };
      const distance = Math.hypot(center.x - x, center.y - y);
      if (distance < selectedDistance) {
        selected = center;
        selectedDistance = distance;
      }
    }

    const targetTop = Math.max(0, selected.y - scroller.clientHeight / 2);
    scroller.scrollTop = targetTop;

    const rect = surface.getBoundingClientRect();
    return {
      x: rect.left + selected.x,
      y: rect.top + selected.y,
    };
  }, point);

  await page.mouse.click(viewportPoint.x, viewportPoint.y);
  return viewportPoint;
}

async function seekPlayback(page: import('@playwright/test').Page, ms: number) {
  await page.locator('input[aria-label="Playback position"]').evaluate((input, value) => {
    const slider = input as HTMLInputElement;
    slider.value = String(value);
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
  }, ms);
}

async function playbackPosition(page: import('@playwright/test').Page) {
  return Number(await page.locator('input[aria-label="Playback position"]').inputValue());
}

async function firstDenseTabNoteRun(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const surface = document.querySelector('.at-surface') as HTMLElement | null;
    if (!surface) throw new Error('Missing alphaTab surface');
    const surfaceRect = surface.getBoundingClientRect();
    const rows = new Map<number, Array<{ x: number; y: number }>>();

    for (const node of surface.querySelectorAll('text')) {
      const text = (node.textContent ?? '').trim();
      if (!/^\d+$/.test(text)) continue;
      const rect = node.getBoundingClientRect();
      const x = rect.x - surfaceRect.x + rect.width / 2;
      const y = rect.y - surfaceRect.y + rect.height / 2;
      if (x < 40 || y < 120) continue;
      const rowKey = Math.round(y / 10) * 10;
      const notes = rows.get(rowKey) ?? [];
      notes.push({ x: Math.round(x), y: Math.round(y) });
      rows.set(rowKey, notes);
    }

    const row = [...rows.values()]
      .map((notes) => notes.sort((a, b) => a.x - b.x))
      .find((notes) => notes.length >= 8);
    if (!row) throw new Error('Could not find a dense tab note row');

    return {
      start: row[1],
      end: row[Math.min(row.length - 2, 7)],
    };
  });
}

async function showOnlyTrackOne(page: import('@playwright/test').Page) {
  for (const label of [
    'Hide Gtr. 1 - Overdub on fretboard',
    'Hide Gtr. 2 on fretboard',
    'Hide Gtr. 2 - Overdub on fretboard',
  ]) {
    const button = page.locator(`button[aria-label="${label}"]`);
    if ((await button.count()) === 1) {
      await button.click();
      await page.waitForTimeout(300);
    }
  }
  await expect(page.locator('button[aria-label="Show Gtr. 2 on fretboard"]')).toHaveCount(1);
}

async function turnRepeatOff(page: import('@playwright/test').Page) {
  const enabled = page.locator('button[aria-label="Loop section on"]');
  if ((await enabled.count()) === 1) {
    await enabled.click();
  }
}

async function assertPlaybackCursorInsideLoop(page: import('@playwright/test').Page) {
  const rects = await page.evaluate(() => {
    const rectFor = (selector: string) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        centerX: r.x + r.width / 2,
        centerY: r.y + r.height / 2,
      };
    };
    return {
      start: rectFor('[data-testid="loop-start-marker"]'),
      end: rectFor('[data-testid="loop-end-marker"]'),
      cursor: rectFor('[data-testid="repeat-playback-cursor"]') ?? rectFor('.at-cursor-beat'),
    };
  });

  expect(rects.start).not.toBeNull();
  expect(rects.end).not.toBeNull();
  expect(rects.cursor).not.toBeNull();
  const start = rects.start!;
  const end = rects.end!;
  const cursor = rects.cursor!;
  const left = Math.min(start.centerX, end.centerX) - 36;
  const right = Math.max(start.centerX, end.centerX) + 36;
  const top = Math.min(start.y, end.y) - 12;
  const bottom = Math.max(start.y + start.height, end.y + end.height) + 12;

  expect(cursor.centerX).toBeGreaterThanOrEqual(left);
  expect(cursor.centerX).toBeLessThanOrEqual(right);
  expect(cursor.centerY).toBeGreaterThanOrEqual(top);
  expect(cursor.centerY).toBeLessThanOrEqual(bottom);
}

async function activeFretboardDotCount(page: import('@playwright/test').Page) {
  return page.locator('[data-note-state="active"]').count();
}

test.describe('fretboard UI', () => {
  test('hey-joe preloaded shows fretboard dots after parse', async ({ page }) => {
    await loadSong(page, 'hey-joe');

    await expect(page.locator('[data-fretboard-dots]').first()).toHaveAttribute(
      'data-fretboard-dots',
      /[1-9]\d*/,
      { timeout: 15_000 },
    );
  });

  test('playback produces active fretboard dots', async ({ page }) => {
    await loadSong(page, 'hey-joe');
    const playBtn = page.getByRole('button', { name: 'Play', exact: true });

    await playBtn.click();
    await page.waitForTimeout(1200);

    const active = page.locator('[data-note-state="active"]');
    const upcoming = page.locator('[data-note-state="upcoming"]');
    const total = (await active.count()) + (await upcoming.count());
    expect(total).toBeGreaterThan(0);
  });

  test('repeat selection commits from tab clicks and resets on new song load', async ({ page }) => {
    await loadSong(page, 'hey-joe');

    await page.getByRole('button', { name: 'Loop section off', exact: true }).click();
    await expect(
      page.getByText('Click a note on the tab to set the loop start. Click Loop again to cancel.'),
    ).toBeVisible();

    // AI_CHANGE:
    // Tool: Codex
    // Model: GPT-5
    // Timestamp: 2026-06-25T15:12:15-04:00
    // Purpose: Exercise Repeat exactly like the UI flow: Loop button, two beat clicks, then a song switch.
    // Reason: The previous e2e suite never covered stale Repeat state leaking between loaded songs.
    const startClick = await clickTabBeat(page, 0.11, 0.02);
    await expect(page.getByText('Now click a note to set the loop end.')).toBeVisible();
    const startMarker = page.getByTestId('loop-start-marker');
    await expect(startMarker).toBeVisible();
    const startMarkerBox = await startMarker.boundingBox();
    expect(startMarkerBox).not.toBeNull();
    expect(Math.abs(startMarkerBox!.x + startMarkerBox!.width / 2 - startClick.x)).toBeLessThan(8);
    const endClick = await clickTabBeat(page, 0.25, 0.02);

    await expect(page.getByRole('button', { name: 'Loop section on', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('input[aria-label="Loop start"]')).toHaveCount(0);
    await expect(page.locator('input[aria-label="Loop end"]')).toHaveCount(0);
    // AI_CHANGE:
    // Tool: Codex
    // Model: GPT-5
    // Timestamp: 2026-06-25T15:27:11-04:00
    // Purpose: Assert the B marker stays on the beat the user clicked, not a later playback boundary.
    // Reason: Repeat playback and visual marker placement are separate concerns after end-click duration fixes.
    const marker = page.getByTestId('loop-end-marker');
    await expect(marker).toBeVisible();
    const markerBox = await marker.boundingBox();
    expect(markerBox).not.toBeNull();
    const markerCenterX = markerBox!.x + markerBox!.width / 2;
    expect(Math.abs(markerCenterX - endClick.x)).toBeLessThan(8);

    await page.getByLabel('Sample songs').selectOption('wind-cries-mary');
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled({
      timeout: 30_000,
    });
    await expect(page.getByRole('button', { name: 'Loop section off', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(page.getByTestId('loop-start-marker')).toHaveCount(0);
    await expect(page.getByTestId('loop-end-marker')).toHaveCount(0);
    await expect(page.getByText('Now click a note to set the loop end.')).toHaveCount(0);
  });

  test('repeat playback stays inside three CKY mid-tab loop selections', async ({ page }) => {
    await loadSong(page, 'sink-into-the-underground');
    await showOnlyTrackOne(page);

    // AI_CHANGE:
    // Tool: Codex
    // Model: GPT-5
    // Timestamp: 2026-06-25T16:24:10-04:00
    // Purpose: Exercise Repeat on three middle/later CKY tab systems and assert the visible cursor stays inside A/B.
    // Reason: Beginning-of-song tests missed the bug where markers were correct but playback jumped to an earlier rendered system.
    const loopCases: Array<{ name: string; start: SurfacePoint; end: SurfacePoint }> = [
      {
        name: 'intro second system',
        start: { x: 416, y: 389 },
        end: { x: 739, y: 389 },
      },
      {
        name: 'repeated riff later system',
        start: { x: 417, y: 973 },
        end: { x: 739, y: 973 },
      },
      {
        name: 'verse lower system',
        start: { x: 333, y: 1563 },
        end: { x: 788, y: 1563 },
      },
    ];

    for (const loopCase of loopCases) {
      await turnRepeatOff(page);
      await seekPlayback(page, 0);
      await page.getByRole('button', { name: 'Loop section off', exact: true }).click();
      await expect(
        page.getByText('Click a note on the tab to set the loop start. Click Loop again to cancel.'),
      ).toBeVisible();

      const startClick = await clickTabSurfacePoint(page, loopCase.start);
      await expect(page.getByText('Now click a note to set the loop end.')).toBeVisible();
      const startMarker = page.getByTestId('loop-start-marker');
      await expect(startMarker).toBeVisible();
      const startMarkerBox = await startMarker.boundingBox();
      expect(startMarkerBox).not.toBeNull();
      expect(
        Math.abs(startMarkerBox!.x + startMarkerBox!.width / 2 - startClick.x),
        `${loopCase.name} A marker should land on clicked note`,
      ).toBeLessThan(8);

      const endClick = await clickTabSurfacePoint(page, loopCase.end);
      await expect(
        page.getByRole('button', { name: 'Loop section on', exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
      const endMarker = page.getByTestId('loop-end-marker');
      await expect(endMarker).toBeVisible();
      const endMarkerBox = await endMarker.boundingBox();
      expect(endMarkerBox).not.toBeNull();
      expect(
        Math.abs(endMarkerBox!.x + endMarkerBox!.width / 2 - endClick.x),
        `${loopCase.name} B marker should land on clicked note`,
      ).toBeLessThan(8);

      // AI_CHANGE:
      // Tool: Codex
      // Model: GPT-5
      // Timestamp: 2026-06-25T17:18:07-04:00
      // Purpose: Verify Repeat through tab markers and cursor behavior after removing dock sliders.
      // Reason: Loop sliders are no longer visible; the tab is the source of truth for A/B bounds.
      await page.getByRole('button', { name: 'Play', exact: true }).click();
      await page.waitForTimeout(250);
      await assertPlaybackCursorInsideLoop(page);
      await page.waitForTimeout(650);
      await assertPlaybackCursorInsideLoop(page);
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
    }
  });

  test('repeat first play stays playing and shows active fretboard dots immediately', async ({ page }) => {
    await loadSong(page, 'could-you-be-loved');

    const loopCase = await firstDenseTabNoteRun(page);
    await page.getByRole('button', { name: 'Loop section off', exact: true }).click();
    await expect(
      page.getByText('Click a note on the tab to set the loop start. Click Loop again to cancel.'),
    ).toBeVisible();

    await clickTabSurfacePoint(page, loopCase.start);
    await expect(page.getByText('Now click a note to set the loop end.')).toBeVisible();
    await clickTabSurfacePoint(page, loopCase.end);
    await expect(page.getByRole('button', { name: 'Loop section on', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // AI_CHANGE:
    // Tool: Codex
    // Model: GPT-5
    // Timestamp: 2026-06-25T16:44:30-04:00
    // Purpose: Assert first Repeat playback does not self-pause and immediately lights active fretboard notes.
    // Reason: Regressions appeared only after the first Play on a freshly selected loop, before the first loop completed.
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await expect
      .poll(() => activeFretboardDotCount(page), {
        message: 'active fretboard dots should appear on first Repeat play',
        timeout: 1000,
      })
      .toBeGreaterThan(0);
    await page.waitForTimeout(2400);
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await expect.poll(() => activeFretboardDotCount(page), { timeout: 1000 }).toBeGreaterThan(0);
  });

  test('repeat play-pause cycles always restart inside a mid-song loop', async ({ page }) => {
    await loadSong(page, 'sink-into-the-underground');
    await showOnlyTrackOne(page);

    await page.getByRole('button', { name: 'Loop section off', exact: true }).click();
    await expect(
      page.getByText('Click a note on the tab to set the loop start. Click Loop again to cancel.'),
    ).toBeVisible();
    await clickTabSurfacePoint(page, { x: 417, y: 973 });
    await expect(page.getByText('Now click a note to set the loop end.')).toBeVisible();
    await clickTabSurfacePoint(page, { x: 739, y: 973 });
    await expect(page.getByRole('button', { name: 'Loop section on', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // AI_CHANGE:
    // Tool: Codex
    // Model: GPT-5
    // Timestamp: 2026-06-25T18:12:34-04:00
    // Purpose: Exercise repeated Play/Pause starts after a mid-song Repeat loop is selected.
    // Reason: A stale alphaTab stop position made alternating Play clicks start at song beginning instead of the selected loop.
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await page.getByRole('button', { name: 'Play', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
      await expect
        .poll(() => playbackPosition(page), {
          message: `cycle ${cycle + 1} should not restart at the beginning of the song`,
          timeout: 1200,
        })
        .toBeGreaterThan(1000);
      await assertPlaybackCursorInsideLoop(page);
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    }
  });
});
