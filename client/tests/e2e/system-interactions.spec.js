import { test, expect } from '@playwright/test';
import { registerFreshCommander } from './helpers/auth';

test('ship click shows info in side panel (not fullscreen modal)', async ({ page }) => {
  page.on('pageerror', err => console.log('PAGE ERROR:', err));

  await registerFreshCommander(page, 'SidePanel');
  await expect(page.getByRole('heading', { name: /Welcome, Commander/i })).toBeVisible({ timeout: 15000 });

  // Navigate to system view
  await page.getByRole('link', { name: 'System', exact: true }).click();

  // Wait for the entity bar (bottom bar) to load with ship data
  const entityBar = page.locator('.absolute.bottom-4');
  await expect(entityBar).toBeVisible({ timeout: 10000 });

  // Find the ship button in the entity bar (contains the ship name)
  const shipBtn = entityBar.locator('button').filter({ has: page.locator('svg.lucide-rocket') });
  await expect(shipBtn).toBeVisible({ timeout: 5000 });
  console.log('Ship button found in entity bar');

  // Click the ship button
  await shipBtn.click();
  await page.waitForTimeout(500);

  // Verify NO fullscreen modal (the old behavior had inset-0 bg-black/50 z-50)
  const fullscreenOverlay = page.locator('div.absolute.inset-0.z-50');
  const overlayVisible = await fullscreenOverlay.isVisible().catch(() => false);
  console.log('Fullscreen overlay visible:', overlayVisible);
  expect(overlayVisible).toBe(false);

  // Should see side info panel on the right
  const sidePanel = page.locator('.absolute.top-4.right-4');
  await expect(sidePanel).toBeVisible({ timeout: 3000 });
  console.log('Side panel visible');

  // Panel should show ship-related content (action buttons)
  await expect(sidePanel.getByText(/Trade/i).first()).toBeVisible({ timeout: 3000 });
  await expect(sidePanel.getByText(/Scan/i).first()).toBeVisible();
  await expect(sidePanel.getByText(/Repair/i).first()).toBeVisible();
  await expect(sidePanel.getByText(/Sector Map/i).first()).toBeVisible();
  console.log('Ship action buttons visible in side panel');

  console.log('=== SHIP SIDE PANEL TEST PASSED ===');
});
