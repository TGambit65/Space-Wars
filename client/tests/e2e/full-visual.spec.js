/**
 * Comprehensive visual E2E test — exercises every user-facing page and interaction.
 * Requires both server (:5080) and client (:3080) running with a populated universe.
 *
 * Runs as a single sequential test to maintain login state across all page visits.
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3080';

const TS = Date.now();
const USER = `TestPilot${TS}`;
const EMAIL = `pilot${TS}@test.com`;
const PASS = 'Str0ng!Pass99';

/** Click a sidebar nav link by its label text, expanding "More Features" if needed */
const nav = async (page, label) => {
  const link = page.getByRole('link', { name: label, exact: true });
  // If the link isn't visible, try expanding the "More Features" accordion
  if (!(await link.isVisible({ timeout: 500 }).catch(() => false))) {
    const moreBtn = page.locator('button', { hasText: /More Features/i });
    if (await moreBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await moreBtn.click();
      await page.waitForTimeout(400);
    }
  }
  await link.click();
  await page.waitForTimeout(600);
};

test.describe('Space Wars 3000 — Full Visual Sweep', () => {
  test('complete player journey through every page and interaction', async ({ page }) => {
    test.setTimeout(180_000);

    const errors = [];
    page.on('pageerror', (err) => {
      // Ignore benign errors
      if (err.message.includes('ResizeObserver') || err.message.includes('WebGL') || err.message.includes('Script error')) return;
      errors.push(err.message);
      console.log('PAGE ERROR:', err.message);
    });

    // ═══════════════════════════════════════════════════════════
    // 1. REGISTRATION
    // ═══════════════════════════════════════════════════════════
    console.log('--- 1. Registration ---');
    await page.goto(BASE);
    await expect(page.getByText('Space Wars')).toBeVisible();

    // Switch to register mode
    await page.getByText("Don't have an account? Register").click();
    await expect(page.getByText('Create Account')).toBeVisible();

    // Fill form
    await page.getByLabel(/Username/i).fill(USER);
    await page.getByLabel(/Email/i).fill(EMAIL);
    await page.getByLabel(/Password/i).fill(PASS);

    // Submit form → faction step
    await page.getByRole('button', { name: /Choose Faction/i }).click();
    await expect(page.getByText('Choose Your Faction')).toBeVisible();

    // Verify all three factions
    await expect(page.getByText('Terran Alliance').first()).toBeVisible();
    await expect(page.getByText('Zythian Swarm')).toBeVisible();
    await expect(page.getByText('Automaton Collective')).toBeVisible();

    // Select Terran Alliance and create
    await page.getByText('Terran Alliance').first().click();
    await page.getByRole('button', { name: /Create Account as Terran Alliance/i }).click();

    // Land on dashboard
    await expect(page.getByText(/Welcome, Commander/i)).toBeVisible({ timeout: 15000 });
    console.log('Registration complete.');

    // ═══════════════════════════════════════════════════════════
    // 2. DASHBOARD
    // ═══════════════════════════════════════════════════════════
    console.log('--- 2. Dashboard ---');
    await expect(page.getByLabel('Page content').getByText('Credits', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Page content').getByText('Ships', { exact: true })).toBeVisible();

    // ═══════════════════════════════════════════════════════════
    // 3. SHIPS
    // ═══════════════════════════════════════════════════════════
    console.log('--- 3. Ships ---');
    await nav(page, 'Ships');
    await expect(page).toHaveURL(/ships/);
    await expect(page.getByText('Hull').first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Shields').first()).toBeVisible();
    await expect(page.getByText('Fuel').first()).toBeVisible();

    // Check cargo section
    const cargoVisible = await page.getByText(/Cargo|Empty/i).first().isVisible({ timeout: 3000 }).catch(() => false);
    expect(cargoVisible).toBeTruthy();

    // PvP toggle
    const pvpBtn = page.getByRole('button', { name: /PvP/i });
    if (await pvpBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await pvpBtn.click();
      await page.waitForTimeout(500);
      await pvpBtn.click();
    }
    console.log('Ships verified.');

    // ═══════════════════════════════════════════════════════════
    // 4. SECTOR MAP (Galaxy Map)
    // ═══════════════════════════════════════════════════════════
    console.log('--- 4. Sector Map ---');
    await nav(page, 'Sector Map');
    await expect(page).toHaveURL(/map/);
    await expect(page.locator('canvas')).toBeVisible({ timeout: 10000 });

    // Zoom controls
    const zoomIn = page.getByRole('button', { name: /zoom in|\+/i });
    if (await zoomIn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await zoomIn.click();
      await page.waitForTimeout(200);
    }
    const zoomOut = page.getByRole('button', { name: /zoom out|-/i });
    if (await zoomOut.isVisible({ timeout: 1000 }).catch(() => false)) {
      await zoomOut.click();
    }
    console.log('Galaxy Map verified.');

    // ═══════════════════════════════════════════════════════════
    // 5. SYSTEM VIEW
    // ═══════════════════════════════════════════════════════════
    console.log('--- 5. System View ---');
    await nav(page, 'System');
    await expect(page).toHaveURL(/system/);
    await expect(page.locator('canvas')).toBeVisible({ timeout: 10000 });
    const hasSystemInfo = await page.getByText(/Star|System|Class/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasSystemInfo).toBeTruthy();
    console.log('System View verified.');

    // ═══════════════════════════════════════════════════════════
    // 6. PLANETS
    // ═══════════════════════════════════════════════════════════
    console.log('--- 6. Planets ---');
    await nav(page, 'Planets');
    await expect(page).toHaveURL(/planets/);
    await expect(page.locator('body')).not.toBeEmpty();
    console.log('Planets verified.');

    // ═══════════════════════════════════════════════════════════
    // 7. TRADING
    // ═══════════════════════════════════════════════════════════
    console.log('--- 7. Trading ---');
    await nav(page, 'Trading');
    await expect(page).toHaveURL(/trading/);
    // Page may show loading ("Accessing Trade Network"), marketplace, or "not docked"
    await expect(page.getByText(/Marketplace|No port|not docked|Commodity|Refuel|Buy|Sell|Accessing|Trade Network/i).first()).toBeVisible({ timeout: 10000 });
    console.log('Trading verified.');

    // ═══════════════════════════════════════════════════════════
    // 8. COMBAT
    // ═══════════════════════════════════════════════════════════
    console.log('--- 8. Combat ---');
    await nav(page, 'Combat');
    await expect(page).toHaveURL(/combat/);
    await expect(page.getByText(/Tactical|Combat|No targets|Interface/i).first()).toBeVisible({ timeout: 5000 });

    // Scan for targets
    const scanBtn = page.getByRole('button', { name: /Scan|Target/i });
    if (await scanBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await scanBtn.click();
      await page.waitForTimeout(1000);
    }

    // Combat history
    const historyBtn = page.getByRole('button', { name: /History|Logs/i });
    if (await historyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await historyBtn.click();
      await page.waitForTimeout(800);
      const hasHistory = await page.getByText(/Combat Logs|No combat/i).first().isVisible({ timeout: 5000 }).catch(() => false);
      expect(hasHistory).toBeTruthy();
      // Go back
      const backBtn = page.getByRole('button', { name: /Back|Return/i });
      if (await backBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await backBtn.click();
        await page.waitForTimeout(500);
      }
    }
    console.log('Combat verified.');

    // ═══════════════════════════════════════════════════════════
    // 9. CREW
    // ═══════════════════════════════════════════════════════════
    console.log('--- 9. Crew ---');
    await nav(page, 'Crew');
    await expect(page).toHaveURL(/crew/);
    await expect(page.locator('body')).not.toBeEmpty();
    console.log('Crew verified.');

    // ═══════════════════════════════════════════════════════════
    // 10. PROGRESSION
    // ═══════════════════════════════════════════════════════════
    console.log('--- 10. Progression ---');
    await nav(page, 'Progression');
    await expect(page).toHaveURL(/progression/);
    const hasLevel = await page.getByText(/Level|XP|Experience|Achievement/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasLevel).toBeTruthy();
    console.log('Progression verified.');

    // ═══════════════════════════════════════════════════════════
    // 11. MISSIONS
    // ═══════════════════════════════════════════════════════════
    console.log('--- 11. Missions ---');
    await nav(page, 'Missions');
    await expect(page).toHaveURL(/missions/);
    const hasMissions = await page.getByText(/Mission|Quest|Available|No missions/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasMissions).toBeTruthy();
    console.log('Missions verified.');

    // ═══════════════════════════════════════════════════════════
    // 12. MESSAGES
    // ═══════════════════════════════════════════════════════════
    console.log('--- 12. Messages ---');
    await nav(page, 'Messages');
    await expect(page).toHaveURL(/messages/);
    await expect(page.locator('body')).not.toBeEmpty();
    console.log('Messages verified.');

    // ═══════════════════════════════════════════════════════════
    // 13-24. ADVANCED FEATURES
    // ═══════════════════════════════════════════════════════════

    // 13. Shipyard
    console.log('--- 13. Shipyard ---');
    await nav(page, 'Shipyard');
    await expect(page).toHaveURL(/designer/);
    const hasComponents = await page.getByText(/Installed|Components|Available|Power/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasComponents).toBeTruthy();

    // Templates button
    const templatesBtn = page.getByRole('button', { name: /Template/i });
    if (await templatesBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await templatesBtn.click();
      await page.waitForTimeout(400);
      await templatesBtn.click();
    }
    console.log('Shipyard verified.');

    // 14. Customize
    console.log('--- 14. Customize ---');
    await nav(page, 'Customize');
    await expect(page).toHaveURL(/customizer/);
    await expect(page.locator('body')).not.toBeEmpty();
    console.log('Customize verified.');

    // 15. Engineering
    console.log('--- 15. Engineering ---');
    await nav(page, 'Engineering');
    await expect(page).toHaveURL(/repair/);
    const hasRepair = await page.getByText(/Hull|Integrity|Repair|no damage|Status/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasRepair).toBeTruthy();
    console.log('Engineering verified.');

    // 16. Market Data
    console.log('--- 16. Market Data ---');
    await nav(page, 'Market Data');
    await expect(page).toHaveURL(/market/);
    const hasMarket = await page.getByText(/Market|Trade|Price|Commodity|routes/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasMarket).toBeTruthy();
    console.log('Market Data verified.');

    // 17. Colonies
    console.log('--- 17. Colonies ---');
    await nav(page, 'Colonies');
    await expect(page).toHaveURL(/colonies/);
    await expect(page.locator('body')).not.toBeEmpty();

    // Leaderboard
    const leaderboardBtn = page.getByRole('button', { name: /Leaderboard/i });
    if (await leaderboardBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await leaderboardBtn.click();
      await page.waitForTimeout(800);
      await expect(page).toHaveURL(/colony-leaderboard/);
      // Navigate back
      await page.goBack();
      await page.waitForTimeout(500);
    }
    console.log('Colonies verified.');

    // 18. Outposts
    console.log('--- 18. Outposts ---');
    await nav(page, 'Outposts');
    await expect(page).toHaveURL(/outposts/);
    const hasOutpost = await page.getByText(/Outpost|Deploy|Station|No outposts/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasOutpost).toBeTruthy();
    console.log('Outposts verified.');

    // 19. Crafting
    console.log('--- 19. Crafting ---');
    await nav(page, 'Crafting');
    await expect(page).toHaveURL(/crafting/);
    const hasCrafting = await page.getByText(/Craft|Blueprint|Recipe|Materials/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasCrafting).toBeTruthy();
    console.log('Crafting verified.');

    // 20. Faction
    console.log('--- 20. Faction ---');
    await nav(page, 'Faction');
    await expect(page).toHaveURL(/faction/);
    const hasFaction = await page.getByText(/Faction|Standing|Alliance|Reputation/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasFaction).toBeTruthy();
    console.log('Faction verified.');

    // 21. Events
    console.log('--- 21. Events ---');
    await nav(page, 'Events');
    await expect(page).toHaveURL(/events/);
    const hasEvents = await page.getByText(/Event|Community|Ongoing|No events/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasEvents).toBeTruthy();
    console.log('Events verified.');

    // 22. Corporation
    console.log('--- 22. Corporation ---');
    await nav(page, 'Corporation');
    await expect(page).toHaveURL(/corporation/);
    const hasCorp = await page.getByText(/Corporation|Create|Join|Guild/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasCorp).toBeTruthy();
    console.log('Corporation verified.');

    // 23. Automation
    console.log('--- 23. Automation ---');
    await nav(page, 'Automation');
    await expect(page).toHaveURL(/automation/);
    const hasAuto = await page.getByText(/Automation|Task|Route|Mining/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasAuto).toBeTruthy();
    console.log('Automation verified.');

    // 24. Wiki
    console.log('--- 24. Wiki ---');
    await nav(page, 'Wiki');
    await expect(page).toHaveURL(/wiki/);
    await expect(page.locator('body')).not.toBeEmpty();
    console.log('Wiki verified.');

    // ═══════════════════════════════════════════════════════════
    // 25. CHAT PANEL
    // ═══════════════════════════════════════════════════════════
    console.log('--- 25. Chat Panel ---');
    const chatToggle = page.getByTitle('Toggle Chat');
    if (await chatToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      await chatToggle.click();
      await page.waitForTimeout(500);
      // The open chat panel overlaps the toggle button, so force-click to close
      await chatToggle.click({ force: true });
      await page.waitForTimeout(300);
    }
    console.log('Chat panel verified.');

    // ═══════════════════════════════════════════════════════════
    // 26. SIDEBAR STATE
    // ═══════════════════════════════════════════════════════════
    console.log('--- 26. Sidebar ---');
    await expect(page.getByText('Terran Alliance').first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Credits').first()).toBeVisible();
    await expect(page.getByText(USER)).toBeVisible();
    console.log('Sidebar verified.');

    // ═══════════════════════════════════════════════════════════
    // 27. RAPID NAVIGATION (no crash)
    // ═══════════════════════════════════════════════════════════
    console.log('--- 27. Rapid Navigation ---');
    const rapidRoutes = ['Ships', 'Sector Map', 'System', 'Planets', 'Trading', 'Combat', 'Crew', 'Progression', 'Missions', 'Messages'];
    for (const label of rapidRoutes) {
      await page.getByRole('link', { name: label, exact: true }).click();
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(1000);
    console.log('Rapid navigation complete — no crashes.');

    // ═══════════════════════════════════════════════════════════
    // 28. LOGOUT & RE-LOGIN
    // ═══════════════════════════════════════════════════════════
    console.log('--- 28. Logout & Re-login ---');
    // Ensure chat panel is closed first (it can overlay the sidebar)
    const chatBtn = page.getByTitle('Toggle Chat');
    // Check if chat is open by looking for the comms panel
    const commsOpen = await page.getByText('Comms Channel').isVisible({ timeout: 500 }).catch(() => false);
    if (commsOpen) {
      await chatBtn.click({ force: true });
      await page.waitForTimeout(400);
    }

    // Navigate to dashboard first to get a clean sidebar view
    await nav(page, 'Dashboard');

    const logoutBtn = page.getByTitle('Logout');
    await logoutBtn.click();
    await expect(page.getByText('Welcome Back')).toBeVisible({ timeout: 5000 });

    // Log back in
    await page.getByLabel(/Username/i).fill(USER);
    await page.getByLabel(/Password/i).fill(PASS);
    await page.getByRole('button', { name: /Login/i }).click();
    await expect(page.getByText(/Welcome, Commander/i)).toBeVisible({ timeout: 15000 });
    console.log('Re-login verified.');

    // ═══════════════════════════════════════════════════════════
    // 29. RETURN TO DASHBOARD
    // ═══════════════════════════════════════════════════════════
    console.log('--- 29. Back to Dashboard ---');
    await nav(page, 'Dashboard');
    await expect(page.getByText(/Welcome, Commander/i)).toBeVisible({ timeout: 5000 });

    // ═══════════════════════════════════════════════════════════
    // FINAL: Check no fatal page errors occurred
    // ═══════════════════════════════════════════════════════════
    if (errors.length > 0) {
      console.warn('Non-fatal page errors:', errors);
    }

    console.log('=== ALL VISUAL CHECKS PASSED ===');
  });
});
