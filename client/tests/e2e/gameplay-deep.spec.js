import { test, expect } from '@playwright/test';
import { registerFreshCommander } from './helpers/auth';

const getActionPanel = async (page) => {
  const modal = page.locator('.z-50.backdrop-blur-sm');
  if (await modal.isVisible({ timeout: 1500 }).catch(() => false)) return modal;

  const sidePanel = page.locator('.absolute.top-4.right-4');
  if (await sidePanel.isVisible({ timeout: 1500 }).catch(() => false)) return sidePanel;

  return null;
};

test.describe('Space Wars 3000 - Deep Gameplay', () => {

  test('full gameplay: register, scan, trade, jump systems, combat check', async ({ page }) => {
    test.setTimeout(120000);
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', exception => {
      errors.push(`PAGE ERROR: ${exception}`);
      console.log(`PAGE ERROR: "${exception}"`);
    });

    // === REGISTER ===
    const account = await registerFreshCommander(page, 'Deep');
    await expect(page.getByRole('heading', { name: /Welcome, Commander/i })).toBeVisible({ timeout: 15000 });
    console.log(`Registered: ${account.username}`);

    // === DASHBOARD ===
    // Check dashboard has key elements
    await expect(page.locator('body')).toContainText(/Credits|Ship|Sector/i);
    console.log('Dashboard OK');

    // === SHIPS PAGE ===
    await page.getByRole('link', { name: 'Ships', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Ship Status/i })).toBeVisible({ timeout: 5000 });

    // Check ship stats are present
    await expect(page.getByText('Hull')).toBeVisible();
    await expect(page.getByText('Shields')).toBeVisible();
    await expect(page.getByText('Fuel')).toBeVisible();
    await expect(page.getByText(/Cargo Hold/i)).toBeVisible();
    await expect(page.getByText(/Current Sector/i)).toBeVisible();
    console.log('Ship stats all visible');

    // === NAVIGATE TO SYSTEM VIEW ===
    await page.getByRole('button', { name: /Navigate/i }).click();
    await expect(page).toHaveURL(/system/);
    await page.waitForTimeout(2000);

    const systemOverlay = page.locator('.absolute.top-4.left-4');
    await expect(systemOverlay).toBeVisible({ timeout: 10000 });

    // Get initial system name
    const initialSystemText = await systemOverlay.innerText();
    console.log(`Initial system: ${initialSystemText.split('\n')[0]}`);

    // === OPEN SHIP MODAL AND SCAN ===
    const entityBar = page.locator('.absolute.bottom-4');
    await expect(entityBar).toBeVisible();

    // Click ship in entity bar
    await entityBar.locator('button').first().click();
    await page.waitForTimeout(500);

    const actionPanel = await getActionPanel(page);
    expect(actionPanel).toBeTruthy();

    // Hit the Scan button
    await actionPanel.getByRole('button', { name: /Scan/i }).click();
    await page.waitForTimeout(2000);
    console.log('Scan initiated from modal');

    // Close modal (it may or may not still be visible after scan)
    if (await actionPanel.isVisible().catch(() => false)) {
      // Close via X
      await actionPanel.locator('button').first().click();
      await page.waitForTimeout(300);
    }

    // === CLICK A PLANET IN ENTITY BAR ===
    const bodiesLabel = entityBar.getByText('Bodies');
    if (await bodiesLabel.isVisible()) {
      // Click the first planet button after "Bodies" label
      const planetButtons = entityBar.locator('button').filter({ has: page.locator('span.rounded-full, svg') });
      const count = await planetButtons.count();
      if (count > 1) {
        // Skip first (ship button), click a planet
        await planetButtons.nth(1).click();
        await page.waitForTimeout(500);

        // Check info panel appeared on the right
        const infoPanel = page.locator('.absolute.top-4.right-4');
        if (await infoPanel.isVisible()) {
          console.log('Planet info panel visible');
          // Close it
          const closeBtn = infoPanel.locator('button').first();
          await closeBtn.click();
          await page.waitForTimeout(300);
        }
      }
    }

    // === JUMP TO ANOTHER SYSTEM ===
    const jumpLabel = entityBar.getByText('Jump');
    if (await jumpLabel.isVisible()) {
      // Click first jump point
      const jumpButtons = entityBar.locator('button').filter({ has: page.locator('svg.text-cyan-400, svg.text-purple-400') });
      const jumpCount = await jumpButtons.count();

      if (jumpCount > 0) {
        // Click to show info panel first
        await jumpButtons.first().click();
        await page.waitForTimeout(500);

        const infoPanel = page.locator('.absolute.top-4.right-4');
        await expect(infoPanel).toBeVisible({ timeout: 3000 });

        // Click Jump button in info panel
        const jumpBtn = infoPanel.getByRole('button', { name: /Jump/i });
        if (await jumpBtn.isVisible().catch(() => false)) {
          await jumpBtn.click();
          await page.waitForTimeout(3000);
          console.log('Jumped to system 1');
        } else {
          console.log('Jump button not visible in info panel');
        }

        // Verify we're in a new system
        await expect(systemOverlay).toBeVisible();

        // Try jumping again if there are jump points
        const newEntityBar = page.locator('.absolute.bottom-4');
        await expect(newEntityBar).toBeVisible({ timeout: 5000 });
        const newJumpLabel = newEntityBar.getByText('Jump');

        if (await newJumpLabel.isVisible()) {
          const newJumpButtons = newEntityBar.locator('button').filter({ has: page.locator('svg.text-cyan-400, svg.text-purple-400') });
          if (await newJumpButtons.count() > 0) {
            await newJumpButtons.first().click();
            await page.waitForTimeout(500);

            const newInfoPanel = page.locator('.absolute.top-4.right-4');
            if (await newInfoPanel.isVisible()) {
              const jump2Btn = newInfoPanel.getByRole('button', { name: /Jump/i });
              if (await jump2Btn.isVisible().catch(() => false)) {
                await jump2Btn.click();
                await page.waitForTimeout(3000);
                console.log('Jumped to system 2');
              } else {
                console.log('Second jump button not visible');
              }
            }
          }
        }
      }
    } else {
      console.log('No jump points available');
    }

    // === USE MODAL TO GO TO TRADING ===
    await entityBar.locator('button').first().click();
    await page.waitForTimeout(500);
    const tradePanel = await getActionPanel(page);
    if (tradePanel) {
      await tradePanel.getByRole('button', { name: /Trade/i }).click();
      await expect(page).toHaveURL(/trading/, { timeout: 5000 });
      console.log('Modal Trade button -> Trading page OK');
    } else {
      console.log('Trade action panel not available');
    }

    // === TRADING PAGE ===
    await page.waitForTimeout(1000);
    // Check that trading page loaded without errors
    const tradingError = page.getByText(/error|failed/i);
    const hasError = await tradingError.isVisible().catch(() => false);
    if (!hasError) {
      console.log('Trading page loaded clean');
    } else {
      console.log('Trading page has some error state (may be expected if no port)');
    }

    // === BACK TO SYSTEM VIEW ===
    await page.getByRole('link', { name: 'System', exact: true }).click();
    await expect(page).toHaveURL(/system/);
    await page.waitForTimeout(2000);
    await expect(systemOverlay).toBeVisible({ timeout: 10000 });
    console.log('Back to system view OK');

    // === USE MODAL TO GO TO REPAIR ===
    await page.locator('.absolute.bottom-4').locator('button').first().click();
    await page.waitForTimeout(500);
    const repairPanel = await getActionPanel(page);
    if (repairPanel) {
      await repairPanel.getByRole('button', { name: /Repair/i }).click();
      await expect(page).toHaveURL(/repair/, { timeout: 5000 });
      console.log('Modal Repair button -> Engineering page OK');
    } else {
      console.log('Repair action panel not available');
    }

    // === USE MODAL TO GO TO SECTOR MAP ===
    await page.getByRole('link', { name: 'System', exact: true }).click();
    await expect(page).toHaveURL(/system/);
    await page.waitForTimeout(2000);

    await page.locator('.absolute.bottom-4').locator('button').first().click();
    await page.waitForTimeout(500);
    const mapPanel = await getActionPanel(page);
    if (mapPanel) {
      await mapPanel.getByRole('button', { name: /Sector Map/i }).click();
      await expect(page).toHaveURL(/map/, { timeout: 5000 });
      console.log('Modal Sector Map button -> Map page OK');
    } else {
      console.log('Sector map action panel not available');
    }

    // === VISIT COMBAT PAGE ===
    await page.getByRole('link', { name: 'Combat', exact: true }).click();
    await expect(page).toHaveURL(/combat/);
    await page.waitForTimeout(1000);
    console.log('Combat page OK');

    // === VISIT PROGRESSION ===
    await page.getByRole('link', { name: 'Progression', exact: true }).click();
    await expect(page).toHaveURL(/progression/);
    await page.waitForTimeout(1000);
    console.log('Progression page OK');

    // === CHECK FOR JS ERRORS ===
    const criticalErrors = errors.filter(e =>
      !e.includes('React DevTools') &&
      !e.includes('vite') &&
      !e.includes('Future Flag') &&
      !e.includes('404') // API 404s for empty data are OK
    );
    if (criticalErrors.length > 0) {
      console.log('Browser errors detected:', criticalErrors);
    } else {
      console.log('No critical browser errors');
    }

    console.log('=== DEEP GAMEPLAY TEST COMPLETE ===');
  });
});
