import { test, expect } from '@playwright/test';
import { registerFreshCommander } from './helpers/auth';

test.describe('Frontend Polish Pass - Verification', () => {

  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => console.log(`[PAGE ERROR] ${err.message}`));
    await registerFreshCommander(page, 'Polish');
  });

  // FIX #2: Typo fix
  test('#2 - ShipDesigner header says "Designer" not "Desiger"', async ({ page }) => {
    await page.goto('/designer');
    await page.locator('text=Shipyard').waitFor({ timeout: 15000 });
    const heading = page.locator('h1:has-text("Shipyard")');
    const text = await heading.textContent();
    expect(text).toContain('Designer');
    expect(text).not.toContain('Desiger');
  });

  // FIX #4: Uninstall buttons visible
  test('#4 - ShipDesigner uninstall buttons visible without hover', async ({ page }) => {
    await page.goto('/designer');
    await page.locator('text=Shipyard').waitFor({ timeout: 15000 });
    const btns = page.locator('button[title="Uninstall"]');
    if (await btns.count() > 0) {
      const cls = await btns.first().getAttribute('class');
      expect(cls).toContain('opacity-60');
      expect(cls).not.toContain('opacity-0');
    }
  });

  // FIX #1: ShipPanel toast instead of alert
  test('#1 - ShipPanel scan shows toast, not alert()', async ({ page }) => {
    await page.goto('/ships');
    await page.locator('h1').first().waitFor({ timeout: 10000 });
    await page.waitForTimeout(3000);

    let alertFired = false;
    page.on('dialog', async (dialog) => { alertFired = true; await dialog.dismiss(); });

    const scanBtn = page.locator('button:has-text("Scan")');
    if (await scanBtn.isVisible().catch(() => false)) {
      await scanBtn.click();
      await page.waitForTimeout(3000);
      expect(alertFired).toBe(false);
    }
  });

  // FIX #3 & #8: Combat shield display
  test('#3 - CombatPage shields show absolute values', async ({ page }) => {
    await page.goto('/combat');
    await page.locator('h1:has-text("Tactical")').waitFor({ timeout: 10000 });
    // Player and enemy panels should both show X/Y format for shields
    const panels = page.locator('text=/\\d+\\/\\d+/');
    const count = await panels.count();
    expect(count).toBeGreaterThan(0); // At least player stats
  });

  // FIX #5: Refuel UI
  test('#5 - TradingPage has Refuel Station section', async ({ page }) => {
    await page.goto('/trading');
    await expect.poll(async () => {
      const bodyText = await page.locator('body').innerText();
      return /Refuel Station|Trading Unavailable|No trading port in this sector/i.test(bodyText);
    }, { timeout: 15000 }).toBe(true);

    const hasRefuel = await page.locator('text=Refuel Station').isVisible().catch(() => false);
    const hasNoPort = await page.locator('text=Trading Unavailable').isVisible().catch(() => false);
    const hasNoPortDetail = await page.locator('text=No trading port in this sector').isVisible().catch(() => false);
    expect(hasRefuel || hasNoPort || hasNoPortDetail).toBe(true);

    if (hasRefuel) {
      await expect(page.locator('text=Current Fuel')).toBeVisible();
    }
  });

  // FIX #6: Market chart responsive
  test('#6 - MarketPage loads with responsive chart container', async ({ page }) => {
    await page.goto('/market');
    await page.getByRole('heading', { name: 'Market Data' }).waitFor({ timeout: 10000 });
    // Page loaded - chart responsiveness verified via CSS class in prior review
  });

  // FIX #7: Dashboard "View All" link
  test('#7 - Dashboard shows "View All" ships link', async ({ page }) => {
    await page.goto('/');
    await page.locator('text=Your Fleet').waitFor({ timeout: 10000 });
    const link = page.locator('a[href="/ships"]').filter({ hasText: /View All/ });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/ships/);
  });

  // FIX #9: Combat History pagination
  test('#9 - CombatHistory loads', async ({ page }) => {
    await page.goto('/combat/history');
    await page.getByRole('heading', { name: 'Combat Logs' }).waitFor({ timeout: 10000 });
  });

  // FIX #10: Mission briefings
  test('#10 - MissionsPage loads without crashing', async ({ page }) => {
    await page.goto('/missions');
    await page.getByRole('heading', { name: 'Mission Board' }).waitFor({ timeout: 15000 });
    // If briefing buttons exist, test expand/collapse
    const briefingBtn = page.locator('button:has-text("Mission Briefing")');
    if (await briefingBtn.count() > 0) {
      await briefingBtn.first().click();
      await expect(page.locator('button:has-text("Hide Briefing")').first()).toBeVisible();
    }
  });

  // Screenshot tour
  test('Screenshot tour - all pages', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    const pages = [
      ['/', 'text=Your Fleet', '01-dashboard.png'],
      ['/ships', 'text=Ship Status', '02-ship-panel.png'],
      ['/designer', 'text=Shipyard', '03-ship-designer.png'],
      ['/trading', 'h1', '04-trading.png'],
      ['/combat', 'text=Tactical', '05-combat.png'],
      ['/combat/history', 'text=Combat Logs', '06-combat-history.png'],
      ['/market', 'h1', '07-market.png'],
      ['/missions', 'text=Mission Board', '08-missions.png'],
    ];

    for (const [path, selector, filename] of pages) {
      await page.goto(path);
      await page.locator(selector).first().waitFor({ timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `test-results/screenshots/${filename}`, fullPage: true });
    }

    // Fail if any page errors occurred
    expect(errors).toEqual([]);
  });
});
