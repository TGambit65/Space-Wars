import { test, expect } from '@playwright/test';
import { registerFreshCommander } from './helpers/auth';

test.describe('Ship Edge Cases', () => {

  test('ships page shows proper error when all ships are destroyed', async ({ page }) => {
    page.on('pageerror', exception => console.log(`PAGE ERROR: "${exception}"`));

    // Register a fresh user
    await registerFreshCommander(page, 'Edge');
    await expect(page.getByRole('heading', { name: /Welcome, Commander/i })).toBeVisible({ timeout: 15000 });

    // Visit ships page - should work fine with a live ship
    await page.getByRole('link', { name: 'Ships', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Ship Status/i })).toBeVisible({ timeout: 5000 });
    console.log('Ships page works with active ship');

    const shipIds = ['destroyed-ship-1', 'destroyed-ship-2'];
    console.log(`Mocking ${shipIds.length} destroyed ships...`);

    // Deactivate each ship directly via database
    // Since we can't call a direct DB update from the browser,
    // we'll use the combat system or just reload the page and
    // mock the response. Instead, let's just verify the UI handles
    // the error case by intercepting the API.
    await page.route('**/api/ships', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            ships: shipIds.map(id => ({
              ship_id: id,
              name: 'Destroyed Ship',
              ship_type: 'scout',
              is_active: false,
              hull_points: 0,
              max_hull_points: 100,
            })),
            active_ship_id: null,
            count: shipIds.length
          }
        })
      });
    });

    // Reload ships page
    await page.goto('/ships');
    await page.waitForTimeout(2000);

    // Should show the "no active ships" error, NOT crash
    const errorText = page.getByText(/No active ships available/i);
    await expect(errorText).toBeVisible({ timeout: 5000 });
    console.log('Correct error message shown when all ships destroyed');

    // Page should NOT show "Failed to retrieve ship status" (the crash error)
    const crashError = page.getByText(/Failed to retrieve ship status/i);
    await expect(crashError).not.toBeVisible();
    console.log('No crash error shown');

    console.log('=== EDGE CASE TEST PASSED ===');
  });
});
