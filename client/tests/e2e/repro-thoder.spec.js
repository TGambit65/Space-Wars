import { test, expect } from '@playwright/test';
import { registerFreshCommander } from './helpers/auth';

test('reproduce thoder ships page error', async ({ page }) => {
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('BROWSER ERROR:', msg.text());
  });
  page.on('pageerror', exception => console.log('PAGE ERROR:', exception));

  // Register a fresh user
  const { username } = await registerFreshCommander(page, 'Repro');
  await expect(page.getByRole('heading', { name: /Welcome, Commander/i })).toBeVisible({ timeout: 15000 });
  console.log('Registered:', username);

  // Mock the ships API to return all is_active: false (thoder's state)
  await page.route('**/api/ships', async (route, request) => {
    if (request.method() === 'GET' && !request.url().includes('/ships/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            ships: [
              { ship_id: 'fake-1', name: "thoder's Scout", ship_type: 'scout', is_active: false, hull_points: 0, max_hull_points: 100 },
              { ship_id: 'fake-2', name: "thoder's Colony Ship", ship_type: 'colony_ship', is_active: false, hull_points: 0, max_hull_points: 100 }
            ],
            active_ship_id: 'fake-2',
            count: 2
          }
        })
      });
    } else {
      await route.continue();
    }
  });

  // Navigate to ships
  await page.goto('/ships');
  await page.waitForTimeout(3000);

  // Take screenshot for debugging
  const bodyText = await page.locator('body').innerText();
  console.log('Page text:', bodyText.substring(0, 500));

  // Should show our new error, NOT the crash
  const pageBody = page.locator('body');
  const oldError = page.getByText(/Failed to retrieve ship status/i);

  const newVisible = /No active ships available/i.test(bodyText);
  const oldVisible = await oldError.isVisible().catch(() => false);

  console.log('New error visible:', newVisible);
  console.log('Old error visible:', oldVisible);

  if (newVisible) {
    console.log('FIX WORKS - correct message shown');
  } else if (oldVisible) {
    console.log('BUG STILL PRESENT - old crash message shown');
  } else {
    console.log('UNEXPECTED STATE - neither message shown');
  }

  await expect(pageBody).toContainText(/No active ships available/i);
});
