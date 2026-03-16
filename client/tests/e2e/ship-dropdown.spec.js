import { test, expect } from '@playwright/test';
import { registerFreshCommander } from './helpers/auth';

test('ship dropdown shows all ships including destroyed ones', async ({ page }) => {
  page.on('pageerror', err => console.log('PAGE ERROR:', err));

  const extraShips = [
    {
      ship_id: 'ship-active',
      name: 'Rescue Pod',
      ship_type: 'Scout',
      is_active: true,
      fuel: 50,
      max_fuel: 100,
      currentSector: { name: 'Alpha Gate' },
    },
    {
      ship_id: 'ship-destroyed-1',
      name: 'Wreck One',
      ship_type: 'Frigate',
      is_active: false,
      fuel: 0,
      max_fuel: 100,
      currentSector: { name: 'Alpha Gate' },
    },
    {
      ship_id: 'ship-destroyed-2',
      name: 'Wreck Two',
      ship_type: 'Destroyer',
      is_active: false,
      fuel: 0,
      max_fuel: 100,
      currentSector: { name: 'Alpha Gate' },
    }
  ];

  await registerFreshCommander(page, 'Dropdown');
  await page.route('**/api/ships/ship-active', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          ship: {
            ...extraShips[0],
            hull_points: 100,
            max_hull_points: 100,
            shield_points: 50,
            max_shield_points: 50,
            cargo_capacity: 50,
          }
        }
      })
    });
  });
  await page.route('**/api/ships', async (route, request) => {
    if (request.method() !== 'GET') {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          ships: extraShips,
          active_ship_id: extraShips[0].ship_id,
          count: extraShips.length
        }
      })
    });
  });
  await page.route('**/api/designer/design/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        design: { components: {} }
      })
    });
  });
  await page.route('**/api/fleets', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { fleets: [] }
      })
    });
  });

  await page.goto('/ships');
  await expect(page.getByRole('heading', { name: /Ship Status/i })).toBeVisible({ timeout: 5000 });

  // The dropdown button should be visible (thoder has 3 ships)
  const dropdownBtn = page.locator('button').filter({ has: page.locator('svg.lucide-chevron-down') });
  await expect(dropdownBtn).toBeVisible({ timeout: 3000 });
  console.log('Dropdown button visible');

  // Click it to open
  await dropdownBtn.click();

  // Scope to the dropdown panel
  const dropdown = page.locator('.z-50.w-72');
  await expect(dropdown).toBeVisible({ timeout: 3000 });

  // Should show fleet roster header
  await expect(dropdown.getByText(/Fleet Roster/i)).toBeVisible();
  console.log('Fleet roster dropdown opened');

  // Should show all 3 ships in the dropdown (each ship is a button row)
  const shipButtons = dropdown.locator('button');
  const shipCount = await shipButtons.count();
  console.log('Ship rows in dropdown:', shipCount);
  expect(shipCount).toBeGreaterThanOrEqual(3);
  console.log('All 3 ships visible in dropdown');

  // Should show destroyed badges for the 2 destroyed ships
  const destroyedBadges = dropdown.getByText('Destroyed');
  const count = await destroyedBadges.count();
  console.log('Destroyed badges count:', count);
  expect(count).toBe(2);

  // Should show active badge for the rescue pod
  await expect(dropdown.locator('span').getByText('Active', { exact: true })).toBeVisible();
  console.log('Active badge on rescue pod');

  // Click outside to close dropdown
  await page.locator('.fixed.inset-0').click();
  await expect(dropdown).not.toBeVisible();
  console.log('Dropdown closed');

  console.log('=== SHIP DROPDOWN TEST PASSED ===');
});
