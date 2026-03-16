import { test, expect } from '@playwright/test';
import { registerFreshCommander } from './helpers/auth';

const getActionPanel = async (page) => {
  const modal = page.locator('.z-50.backdrop-blur-sm');
  if (await modal.isVisible({ timeout: 1500 }).catch(() => false)) return modal;

  const sidePanel = page.locator('.absolute.top-4.right-4');
  if (await sidePanel.isVisible({ timeout: 1500 }).catch(() => false)) return sidePanel;

  return null;
};

const nav = async (page, label) => {
  const link = page.getByRole('link', { name: label, exact: true });
  if (!(await link.isVisible().catch(() => false))) {
    const moreBtn = page.getByRole('button', { name: 'More Features', exact: true });
    if (await moreBtn.isVisible().catch(() => false)) {
      await moreBtn.click();
    }
  }
  await page.getByRole('link', { name: label, exact: true }).click();
};

test.describe('System View Navigation Hub', () => {

  test('register, visit ships, navigate to system view, interact with ship and jump points', async ({ page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') console.log('BROWSER ERROR:', msg.text());
    });
    page.on('pageerror', exception => console.log(`PAGE ERROR: "${exception}"`));

    // === Register ===
    const account = await registerFreshCommander(page, 'Nav');
    await expect(page.getByRole('heading', { name: /Welcome, Commander/i })).toBeVisible({ timeout: 15000 });
    console.log('Registered:', account.username);

    // === Ships page loads ===
    await page.getByRole('link', { name: 'Ships', exact: true }).click();
    await expect(page).toHaveURL(/ships/);
    await expect(page.getByRole('heading', { name: /Ship Status/i })).toBeVisible({ timeout: 5000 });
    console.log('Ships page OK');

    // === Navigate button goes to /system ===
    const navBtn = page.getByRole('button', { name: /Navigate/i });
    await expect(navBtn).toBeVisible();
    await navBtn.click();
    await expect(page).toHaveURL(/system/);
    console.log('Navigate button -> /system OK');

    // === System View loads ===
    // Wait for the canvas container to appear (Three.js scene)
    // The system view has a star name in top-left
    await page.waitForTimeout(2000); // Give Three.js time to render

    // Check the top-left system info overlay exists
    const systemInfo = page.locator('.absolute.top-4.left-4');
    await expect(systemInfo).toBeVisible({ timeout: 10000 });
    console.log('System View loaded');

    // Check for sector map link in the system overlay (not the sidebar)
    const sectorMapLink = page.locator('.absolute.top-4.left-4').getByText('Sector Map');
    await expect(sectorMapLink).toBeVisible();
    console.log('Sector Map link visible');

    // Check for ship name in the top-left info
    await expect(systemInfo).toContainText(/Ship:/);
    console.log('Ship name shown in system info');

    // === Entity bar at bottom ===
    const entityBar = page.locator('.absolute.bottom-4');
    await expect(entityBar).toBeVisible({ timeout: 5000 });
    console.log('Entity bar visible');

    // Check for the player ship button in entity bar
    const shipButton = entityBar.locator('button').first();
    await expect(shipButton).toBeVisible();
    console.log('Ship button in entity bar OK');

    // Click the ship button in the entity bar to open the command modal
    await shipButton.click();
    await page.waitForTimeout(500);

    // Check if ship command modal opened (z-50 overlay with inset-0)
    const actionPanel = await getActionPanel(page);
    expect(actionPanel).toBeTruthy();
    console.log('Ship command panel opened');

    // Check modal has trade, scan, repair, sector map buttons
    await expect(actionPanel.getByRole('button', { name: /Trade/i })).toBeVisible();
    await expect(actionPanel.getByRole('button', { name: /Scan/i })).toBeVisible();
    await expect(actionPanel.getByRole('button', { name: /Repair/i })).toBeVisible();
    await expect(actionPanel.getByRole('button', { name: /Sector Map/i })).toBeVisible();
    console.log('Action buttons OK');

    // Check hull/shields/fuel bars are shown
    await expect(actionPanel.getByText('Hull')).toBeVisible();
    await expect(actionPanel.getByText('Shields')).toBeVisible();
    await expect(actionPanel.getByText('Fuel')).toBeVisible();
    console.log('Ship status bars OK');

    // Close the modal via X button
    await actionPanel.locator('button').first().click();
    console.log('Action panel closed');

    // === Check jump points section in entity bar ===
    const jumpLabel = entityBar.getByText('Jump');
    const hasJumpPoints = await jumpLabel.isVisible().catch(() => false);
    if (hasJumpPoints) {
      console.log('Jump points section visible in entity bar');

      // Click a jump point in the entity bar
      const jumpButton = entityBar.locator('button').filter({ has: page.locator('svg.text-cyan-400, svg.text-purple-400') }).first();
      if (await jumpButton.isVisible()) {
        await jumpButton.click();
        await page.waitForTimeout(500);

        // Check info panel shows jump point details
        const infoPanel = page.locator('.absolute.top-4.right-4');
        if (await infoPanel.isVisible()) {
          console.log('Jump point info panel opened');

          // Check for Jump button in info panel
          const jumpBtn = infoPanel.getByRole('button', { name: /Jump/i });
          if (await jumpBtn.isVisible()) {
            console.log('Jump button visible in info panel');

            // Actually jump!
            await jumpBtn.click();
            await page.waitForTimeout(3000); // Wait for movement + scene rebuild

            // After jump, the system info should update (different system name possibly)
            await expect(systemInfo).toBeVisible();
            console.log('Jumped to new system successfully');
          }
        }
      }
    } else {
      console.log('No jump points visible (system may have no neighbors displayed yet)');
    }

    // === Navigate to Sector Map from system view ===
    await sectorMapLink.click();
    await expect(page).toHaveURL(/map/);
    console.log('Navigated to sector map from system view');

    // === Go back to system view ===
    await page.goto('/system');
    await page.waitForTimeout(2000);
    await expect(page.locator('.absolute.top-4.left-4')).toBeVisible({ timeout: 10000 });
    console.log('System view reloaded OK');

    // === Visit other pages to make sure nothing is broken ===
    const pages = [
      { link: 'Trading', url: /trading/ },
      { link: 'Combat', url: /combat/ },
      { link: 'Colonies', url: /colonies/ },
      { link: 'Engineering', url: /repair/ },
      { link: 'Crew', url: /crew/ },
      { link: 'Progression', url: /progression/ },
      { link: 'Crafting', url: /crafting/ },
      { link: 'Missions', url: /missions/ },
    ];

    for (const p of pages) {
      await nav(page, p.link);
      await expect(page).toHaveURL(p.url, { timeout: 5000 });
      await page.waitForTimeout(500);
      console.log(`${p.link} page OK`);
    }

    console.log('=== ALL SYSTEM NAV TESTS PASSED ===');
  });
});
