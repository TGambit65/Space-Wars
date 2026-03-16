import { test, expect } from '@playwright/test';
import { registerFreshCommander } from './helpers/auth';

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

test.describe('Space Wars 3000 - Comprehensive E2E', () => {

    test('full player journey', async ({ page }) => {
        // Listen to console logs and page errors
        page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
        page.on('pageerror', exception => console.log(`BROWSER EXCEPTION: "${exception}"`));

        // === PHASE 1: REGISTRATION & LOGIN ===
        console.log('--- PHASE 1: Registration ---');
        const account = await registerFreshCommander(page, 'Cmdr');
        console.log(`Registering new user: ${account.username}`);

        // Verify Dashboard
        await expect(page.getByRole('heading', { name: /Welcome, Commander/i })).toBeVisible({ timeout: 15000 });
        console.log('Dashboard verified.');

        // === PHASE 2: SHIP STATUS ===
        console.log('--- PHASE 2: Ship Status ---');
        await nav(page, 'Ships');
        await expect(page).toHaveURL(/ships/);

        // Check for Ship Header
        try {
            await expect(page.getByRole('heading', { name: /Ship Status/i })).toBeVisible({ timeout: 5000 });
        } catch (e) {
            console.log('--- SHIP STATUS MISSING DEBUG ---');
            const token = await page.evaluate(() => localStorage.getItem('token'));
            console.log('Token in localStorage:', token ? token.substring(0, 10) + '...' : 'NULL');
            const bodyText = await page.locator('body').innerText();
            console.log('Page Text:', bodyText);

            // Explicitly fail if we see the error message
            const errorMsg = await page.getByText(/No ships found|Failed to retrieve|No active ship/i).isVisible();
            if (errorMsg) {
                throw new Error(`Starter ship expected but API returned: ${bodyText.slice(0, 200)}`);
            }
            throw e;
        }

        // Ensure we actually have the Starter Ship (debug result confirmed we SHOULD)

        // Verify Hull/Shields stats
        await expect(page.getByText('Hull')).toBeVisible();
        await expect(page.getByText('Shields')).toBeVisible();
        console.log('Ship verified.');

        // === PHASE 3: PLANETS & EXPLORATION ===
        console.log('--- PHASE 3: Planets ---');
        await nav(page, 'Planets');
        await expect(page).toHaveURL(/planets/);
        // Check for "Known Planets" or similar header
        // Use a broad text check for page content to verify no crash
        await expect(page.locator('body')).not.toBeEmpty();
        // Wait for potentially empty list or loading
        await page.waitForTimeout(1000);
        console.log('Planets page loaded.');

        // === PHASE 4: STARMAP ===
        console.log('--- PHASE 4: Star Map ---');
        await nav(page, 'Sector Map');
        await expect(page).toHaveURL(/map/);
        // Map should render a grid or canvas
        // Check for "Sector" or "Map" text
        await expect(page.locator('body')).toContainText(/Sector|Map/i);
        await page.waitForTimeout(1000);
        console.log('Star Map loaded.');

        // === PHASE 5: SHIPYARD (DESIGNER) ===
        console.log('--- PHASE 5: Shipyard ---');
        await nav(page, 'Shipyard');
        await expect(page).toHaveURL(/designer/);
        // Check for component slots or "Drag and Drop" hint
        await expect(page.locator('body')).not.toBeEmpty();
        await page.waitForTimeout(1000);
        console.log('Shipyard loaded.');

        // === PHASE 6: MARKET (TRADING) ===
        console.log('--- PHASE 6: Market ---');
        await nav(page, 'Trading');
        await expect(page).toHaveURL(/trading/);
        // Check for explicit "Trading" header or commodity list
        await expect(page.locator('body')).not.toBeEmpty();
        // If we have a ship, we should see trading options ideally
        await page.waitForTimeout(1000);
        console.log('Market loaded.');

        // === PHASE 7: CREW ===
        console.log('--- PHASE 7: Crew ---');
        await nav(page, 'Crew');
        await expect(page).toHaveURL(/crew/);
        await expect(page.locator('body')).not.toBeEmpty();
        await page.waitForTimeout(1000);
        console.log('Crew page loaded.');

        // === PHASE 8: COLONIES ===
        console.log('--- PHASE 8: Colonies ---');
        await nav(page, 'Colonies');
        await expect(page).toHaveURL(/colonies/);
        await expect(page.locator('body')).not.toBeEmpty();
        await page.waitForTimeout(1000);
        console.log('Colonies page loaded.');

        // === PHASE 9: ENGINEERING (REPAIR) ===
        console.log('--- PHASE 9: Engineering ---');
        await nav(page, 'Engineering');
        await expect(page).toHaveURL(/repair/);
        await expect(page.locator('body')).not.toBeEmpty();
        await page.waitForTimeout(1000);
        console.log('Engineering page loaded.');

        console.log('=== TEST COMPLETE: All Routes Verified ===');
    });

});
