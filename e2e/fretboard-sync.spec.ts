import { expect, test } from '@playwright/test';

test.describe('fretboard UI', () => {
  test('hey-joe preloaded shows fretboard dots after parse', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Sample songs').selectOption('hey-joe');

    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled({
      timeout: 30_000,
    });

    await expect(page.locator('[data-fretboard-dots]').first()).toHaveAttribute(
      'data-fretboard-dots',
      /[1-9]\d*/,
      { timeout: 15_000 },
    );
  });

  test('playback produces active fretboard dots', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Sample songs').selectOption('hey-joe');
    const playBtn = page.getByRole('button', { name: 'Play', exact: true });
    await expect(playBtn).toBeEnabled({ timeout: 30_000 });

    await playBtn.click();
    await page.waitForTimeout(1200);

    const active = page.locator('[data-note-state="active"]');
    const upcoming = page.locator('[data-note-state="upcoming"]');
    const total = (await active.count()) + (await upcoming.count());
    expect(total).toBeGreaterThan(0);
  });
});
