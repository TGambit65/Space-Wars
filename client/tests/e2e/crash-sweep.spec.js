import { test, expect } from '@playwright/test';
import { registerFreshCommander } from './helpers/auth';

test.describe('Crash sweep - all pages', () => {
  test.setTimeout(90000);
  test('Visit every page with zero crashes', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(`${err.message}`));

    await registerFreshCommander(page, 'Crash');

    const routes = [
      ['/', 'Dashboard'],
      ['/ships', 'Ships'],
      ['/designer', 'Shipyard'],
      ['/trading', 'Trading'],
      ['/combat', 'Combat'],
      ['/combat/history', 'Combat History'],
      ['/market', 'Market'],
      ['/missions', 'Missions'],
      ['/planets', 'Planets'],
      ['/colonies', 'Colonies'],
      ['/progression', 'Progression'],
      ['/crafting', 'Crafting'],
      ['/corporation', 'Corporation'],
      ['/automation', 'Automation'],
      ['/crew', 'Crew'],
    ];

    for (const [path, label] of routes) {
      console.log(`Visiting ${label} (${path})...`);
      await page.goto(path);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `test-results/screenshots/sweep-${label.toLowerCase().replace(/\s/g, '-')}.png`, fullPage: true });
    }

    console.log(`Total page errors: ${errors.length}`);
    if (errors.length > 0) {
      console.log('Errors:', errors);
    }
    expect(errors).toEqual([]);
  });
});
