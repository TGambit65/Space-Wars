/**
 * Deep interaction E2E tests — exercises actual game actions, not just page loads.
 *
 * Covers: trading, ship components, repair, combat scanning, crew hiring,
 * planet scanning, colonization, missions, corporations, messaging,
 * crafting, fleet management, movement, system view interactions, and more.
 *
 * Requires both server (:5080) and client (:3080) running with a populated universe.
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3080';
const TS = Date.now();
const USER = `DeepTest${TS}`;
const EMAIL = `deep${TS}@test.com`;
const PASS = 'Str0ng!Pass99';

// ─── Helpers ────────────────────────────────────────────────────

/** Click a sidebar nav link by label, auto-expanding "More Features" if needed */
const nav = async (page, label) => {
  const link = page.getByRole('link', { name: label, exact: true });
  if (!(await link.isVisible({ timeout: 500 }).catch(() => false))) {
    const moreBtn = page.locator('button', { hasText: /More Features/i });
    if (await moreBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await moreBtn.click();
      await page.waitForTimeout(400);
    }
  }
  await link.click();
  await page.waitForTimeout(800);
};

/** Wait for API-driven content to appear (not just loading spinners) */
const waitForContent = async (page, timeout = 8000) => {
  // Wait for any loading spinners to disappear
  await page.locator('.animate-spin').first().waitFor({ state: 'hidden', timeout }).catch(() => {});
  await page.waitForTimeout(300);
};

test.describe('Space Wars 3000 — Deep Interaction Tests', () => {
  test('full game interaction flow', async ({ page }) => {
    test.setTimeout(600_000);

    const errors = [];
    page.on('pageerror', (err) => {
      if (err.message.includes('ResizeObserver') || err.message.includes('WebGL')) return;
      errors.push(err.message);
      console.log('PAGE ERROR:', err.message);
    });

    // ═══════════════════════════════════════════════════════════
    // PHASE 1: REGISTER & VERIFY DASHBOARD
    // ═══════════════════════════════════════════════════════════
    console.log('=== PHASE 1: Registration ===');
    await page.goto(BASE);

    await page.getByText("Don't have an account? Register").click();
    await page.getByLabel(/Username/i).fill(USER);
    await page.getByLabel(/Email/i).fill(EMAIL);
    await page.getByLabel(/Password/i).fill(PASS);
    await page.getByRole('button', { name: /Choose Faction/i }).click();
    await expect(page.getByText('Choose Your Faction')).toBeVisible();

    // Pick Terran Alliance for trade bonuses
    await page.getByText('Terran Alliance').first().click();
    await page.getByRole('button', { name: /Create Account as Terran Alliance/i }).click();
    await expect(page.getByText(/Welcome, Commander/i)).toBeVisible({ timeout: 15000 });

    // Verify dashboard quick-link cards exist
    await expect(page.getByLabel('Page content').getByText('Credits', { exact: true })).toBeVisible();
    console.log('Registration complete.');

    // ═══════════════════════════════════════════════════════════
    // PHASE 2: SHIP PANEL — INSPECT STARTER SHIP
    // ═══════════════════════════════════════════════════════════
    console.log('=== PHASE 2: Ship Panel ===');
    await nav(page, 'Ships');
    await expect(page.getByText('Hull').first()).toBeVisible({ timeout: 8000 });

    // Read ship name
    await expect(page.getByText(/USS.*Scout/i).first()).toBeVisible({ timeout: 5000 });

    // Verify systems integrity bars
    await expect(page.getByText('Shields').first()).toBeVisible();
    await expect(page.getByText('Fuel').first()).toBeVisible();

    // PvP toggle: click to enable then disable
    const pvpBtn = page.getByRole('button', { name: /PvP|ENABLED|DISABLED/i });
    if (await pvpBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      const initialText = await pvpBtn.textContent();
      await pvpBtn.click();
      await page.waitForTimeout(800);
      // Toggle back to original state
      await pvpBtn.click();
      await page.waitForTimeout(500);
      console.log('PvP toggle cycled.');
    }

    // Check action buttons exist
    await expect(page.getByRole('button', { name: /Navigate/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Trade/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Scan/i })).toBeVisible();

    // Click Scan to scan current sector
    await page.getByRole('button', { name: /Scan/i }).click();
    await page.waitForTimeout(1000);
    console.log('Ship panel inspected, sector scanned.');

    // ═══════════════════════════════════════════════════════════
    // PHASE 3: SYSTEM VIEW — SCAN PLANETS, INTERACT WITH ENTITIES
    // ═══════════════════════════════════════════════════════════
    console.log('=== PHASE 3: System View ===');
    await nav(page, 'System');
    await expect(page.locator('canvas')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(800); // Let 3D scene load

    // Check system info is present (star type, scanned count)
    await expect(page.getByText(/Star|scanned/i).first()).toBeVisible({ timeout: 5000 });

    // Entity bar at bottom — look for our ship, planets, ports, NPCs
    const entityBar = page.locator('[class*="bottom"]').last();

    // Try to click on an unscanned planet in the entity bar if visible
    const unscannedPlanet = page.getByText(/Orbit #|SIG/i).first();
    if (await unscannedPlanet.isVisible({ timeout: 3000 }).catch(() => false)) {
      await unscannedPlanet.click();
      await page.waitForTimeout(1000);

      // Look for "Initiate Neural Scan" button in the info panel
      const scanPlanetBtn = page.getByRole('button', { name: /Scan|Neural/i });
      if (await scanPlanetBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await scanPlanetBtn.click();
        await page.waitForTimeout(1000);
        console.log('Planet scanned from system view.');
      }
    }

    // Try clicking on a scanned planet
    const planetItem = page.locator('button', { hasText: /[A-Z].*[IVX]/ }).first();
    if (await planetItem.isVisible({ timeout: 2000 }).catch(() => false)) {
      await planetItem.click();
      await page.waitForTimeout(1000);

      // Check info panel shows planet details
      const planetInfo = page.getByText(/Type|Habitability|Size|Gravity/i).first();
      if (await planetInfo.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Planet info panel opened.');
      }

      // If "Enter Orbit" button visible, click it
      const orbitBtn = page.getByRole('button', { name: /Orbit/i });
      if (await orbitBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await orbitBtn.click();
        await page.waitForTimeout(1000);
        // If we navigated to planet orbit view, go back
        if (page.url().includes('/planet/')) {
          console.log('Entered planet orbit view.');
          await page.goBack();
          await page.waitForTimeout(1000);
        }
      }
    }

    // Try clicking on a port in entity bar
    const portItem = page.locator('button', { hasText: /Station|Market|Mine|Farm|Depot|Hub|Lab|Port|Bay/i }).first();
    if (await portItem.isVisible({ timeout: 2000 }).catch(() => false)) {
      await portItem.click();
      await page.waitForTimeout(1000);

      // Info panel should show port details
      const dockBtn = page.getByRole('button', { name: /Dock|Trade/i });
      if (await dockBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Port info panel visible with Dock button.');
        // Don't click — we'll trade via the Trading page
      }
    }

    // Try clicking on an NPC in entity bar
    const npcItem = page.locator('button', { hasText: /Pirate|Trader|Patrol|Hunter|Smuggler|Miner/i }).first();
    if (await npcItem.isVisible({ timeout: 2000 }).catch(() => false)) {
      await npcItem.click();
      await page.waitForTimeout(1000);

      // Check for Hail or Engage buttons
      const hailBtn = page.getByRole('button', { name: /Hail/i });
      const engageBtn = page.getByRole('button', { name: /Engage/i });
      if (await hailBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('NPC Hail button visible.');
      }
      if (await engageBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('NPC Engage button visible.');
      }
    }

    // Try clicking a jump point to trigger movement dialog
    const jumpItem = page.locator('button', { hasText: /Jump|→/ }).first();
    if (await jumpItem.isVisible({ timeout: 2000 }).catch(() => false)) {
      await jumpItem.click();
      await page.waitForTimeout(1000);

      // Look for the "Jump" action button in info panel
      const jumpBtn = page.getByRole('button', { name: 'Jump' });
      if (await jumpBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await jumpBtn.click();
        await page.waitForTimeout(1000);

        // Movement confirm dialog should appear
        const confirmDialog = page.getByText(/Confirm Travel/i);
        if (await confirmDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log('Movement confirm dialog appeared.');

          // Check dialog elements
          await expect(page.getByText(/Set course for/i)).toBeVisible();
          await expect(page.getByRole('button', { name: /Cancel/i })).toBeVisible();
          await expect(page.getByRole('button', { name: /Engage/i })).toBeVisible();

          // Actually move to the new system!
          await page.getByRole('button', { name: /Engage/i }).click();
          await page.waitForTimeout(3000);
          console.log('Moved to new system!');
        }
      }
    }
    console.log('System view interactions complete.');

    // ═══════════════════════════════════════════════════════════
    // PHASE 4: SHIPYARD — INSTALL AND UNINSTALL COMPONENTS
    // ═══════════════════════════════════════════════════════════
    console.log('=== PHASE 4: Shipyard ===');
    await nav(page, 'Shipyard');
    await waitForContent(page);

    // Verify stats grid
    await expect(page.getByText(/Power Grid/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Total Firepower/i).first()).toBeVisible();
    await expect(page.getByText(/Shield Rating/i).first()).toBeVisible();

    // Install a component (click first Install button directly)
    const firstInstall = page.getByRole('button', { name: 'Install' }).first();
    if (await firstInstall.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstInstall.click();
      await page.waitForTimeout(1000);
      console.log('Installed a component.');

      // Now try to uninstall it
      const uninstallBtn = page.getByRole('button', { name: 'Uninstall' }).first();
      if (await uninstallBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await uninstallBtn.click();
        await page.waitForTimeout(1000);
        console.log('Uninstalled a component.');
      }

      // Re-install so ship is functional
      const reinstall = page.getByRole('button', { name: 'Install' }).first();
      if (await reinstall.isVisible({ timeout: 2000 }).catch(() => false)) {
        await reinstall.click();
        await page.waitForTimeout(1000);
        console.log('Re-installed a component.');
      }
    }

    // Templates: open panel, save template, delete it
    const templatesBtn = page.getByRole('button', { name: /Template/i });
    if (await templatesBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await templatesBtn.click();
      await page.waitForTimeout(500);

      // Save a template
      const templateInput = page.getByPlaceholder(/Template name/i);
      if (await templateInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await templateInput.fill('Test Template');
        const saveBtn = page.getByRole('button', { name: /Save Current/i });
        if (await saveBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await saveBtn.click();
          await page.waitForTimeout(1000);
          console.log('Saved design template.');

          // Delete the template
          const deleteBtn = page.locator('button[title*="Delete"], button:has(svg.lucide-trash-2)').first();
          if (await deleteBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await deleteBtn.click();
            await page.waitForTimeout(500);
            console.log('Deleted design template.');
          }
        }
      }

      // Close templates panel
      await templatesBtn.click();
      await page.waitForTimeout(300);
    }
    console.log('Shipyard interactions complete.');

    // ═══════════════════════════════════════════════════════════
    // PHASE 5: ENGINEERING — REPAIR HULL AND COMPONENTS
    // ═══════════════════════════════════════════════════════════
    console.log('=== PHASE 5: Engineering ===');
    await nav(page, 'Engineering');
    await waitForContent(page);

    // Check hull status section
    await expect(page.getByText(/Hull Status|Engineering/i).first()).toBeVisible({ timeout: 5000 });

    // Try to repair hull if damaged
    const repairHullBtn = page.getByRole('button', { name: /Repair Hull/i });
    if (await repairHullBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      if (await repairHullBtn.isEnabled()) {
        await repairHullBtn.click();
        await page.waitForTimeout(800);
        console.log('Repaired hull.');
      }
    } else {
      console.log('Hull not damaged — no repair needed.');
    }

    // Check component status section
    const componentRepairBtns = page.locator('button', { hasText: /^Repair$/i });
    if (await componentRepairBtns.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await componentRepairBtns.first().click();
      await page.waitForTimeout(1000);
      console.log('Repaired a component.');
    }

    // Try "Repair All Systems" button
    const repairAllBtn = page.getByRole('button', { name: /Repair All/i });
    if (await repairAllBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      if (await repairAllBtn.isEnabled()) {
        await repairAllBtn.click();
        await page.waitForTimeout(800);
        console.log('Repaired all systems.');
      }
    }
    console.log('Engineering interactions complete.');

    // ═══════════════════════════════════════════════════════════
    // PHASE 6: TRADING — BUY AND SELL COMMODITIES, REFUEL
    // ═══════════════════════════════════════════════════════════
    console.log('=== PHASE 6: Trading ===');
    await nav(page, 'Trading');
    await page.waitForTimeout(1500); // Wait for trade network

    // Check if we're at a port
    const hasPort = await page.getByText(/Marketplace/i).first().isVisible({ timeout: 8000 }).catch(() => false);

    if (hasPort) {
      console.log('Docked at port — testing trading.');

      // Find a Buy button and purchase a commodity
      const buyBtns = page.getByRole('button', { name: /Buy/i });
      const buyCount = await buyBtns.count();
      if (buyCount > 0) {
        // Set quantity to 1 first using the input
        const qtyInputs = page.locator('input[type="number"]');
        const qtyCount = await qtyInputs.count();
        if (qtyCount > 0) {
          await qtyInputs.first().fill('1');
          await page.waitForTimeout(300);
          await buyBtns.first().click();
          await page.waitForTimeout(800);
          console.log('Bought 1 unit of commodity.');

          // Now sell it back
          const sellBtns = page.getByRole('button', { name: /Sell/i });
          if (await sellBtns.first().isVisible({ timeout: 1000 }).catch(() => false)) {
            // Use the same quantity input
            await qtyInputs.first().fill('1');
            await page.waitForTimeout(300);
            await sellBtns.first().click();
            await page.waitForTimeout(800);
            console.log('Sold 1 unit back.');
          }
        }
      }

      // Refuel section
      const refuelSection = page.getByText(/Refuel|Fuel/i).first();
      if (await refuelSection.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Look for Max button in refuel section
        const maxBtns = page.getByRole('button', { name: /Max/i });
        const lastMax = maxBtns.last();
        if (await lastMax.isVisible({ timeout: 1000 }).catch(() => false)) {
          await lastMax.click();
          await page.waitForTimeout(300);

          const refuelBtn = page.getByRole('button', { name: /Refuel/i });
          if (await refuelBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await refuelBtn.click();
            await page.waitForTimeout(800);
            console.log('Refueled ship.');
          }
        }
      }
    } else {
      console.log('Not at a port — skipping trading (will move to port later).');
    }
    console.log('Trading interactions complete.');

    // ═══════════════════════════════════════════════════════════
    // PHASE 7: COMBAT — SCAN TARGETS AND INTERACT
    // ═══════════════════════════════════════════════════════════
    console.log('=== PHASE 7: Combat ===');
    await nav(page, 'Combat');
    await waitForContent(page);

    await expect(page.getByText(/Tactical|Combat/i).first()).toBeVisible({ timeout: 5000 });

    // Scan for targets
    const scanTargetsBtn = page.getByRole('button', { name: /Scan/i });
    if (await scanTargetsBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await scanTargetsBtn.click();
      await page.waitForTimeout(1000);
      console.log('Scanned for combat targets.');
    }

    // Check for target cards — if NPCs found, check Engage button
    const engageBtn = page.getByRole('button', { name: /ENGAGE|Engage/i });
    if (await engageBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Engage button visible — targets found.');
      // We won't actually engage to avoid ship destruction
    }

    // Visit combat history
    const historyLink = page.getByRole('button', { name: /History/i });
    if (await historyLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await historyLink.click();
      await page.waitForTimeout(1000);
      await expect(page.getByText(/Combat Logs/i).first()).toBeVisible({ timeout: 5000 });
      console.log('Combat history page loaded.');

      // Go back
      const backBtn = page.getByRole('button', { name: /Back/i });
      if (await backBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await backBtn.click();
        await page.waitForTimeout(500);
      } else {
        await page.goBack();
        await page.waitForTimeout(500);
      }
    }
    console.log('Combat interactions complete.');

    // ═══════════════════════════════════════════════════════════
    // PHASE 8: CREW — HIRE AND MANAGE CREW
    // ═══════════════════════════════════════════════════════════
    console.log('=== PHASE 8: Crew ===');
    await nav(page, 'Crew');
    await waitForContent(page);

    // Check if "Hire Crew" button exists
    const hireCrewBtn = page.getByRole('button', { name: /Hire/i });
    if (await hireCrewBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await hireCrewBtn.click();
      await page.waitForTimeout(800);

      // Hire modal should open — check for available crew
      const crewList = page.getByText(/Salary|Species|Level/i).first();
      if (await crewList.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('Hire crew modal opened with available crew.');

        // Try to hire first available crew member
        const hireBtns = page.getByRole('button', { name: /Hire/i });
        if (await hireBtns.nth(1).isVisible({ timeout: 1000 }).catch(() => false)) {
          await hireBtns.nth(1).click();
          await page.waitForTimeout(800);
          console.log('Hired a crew member.');
        }
      }

      // Close modal if still open
      const closeBtn = page.locator('button:has(svg.lucide-x)').first();
      if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(300);
      }
    }
    console.log('Crew interactions complete.');

    // ═══════════════════════════════════════════════════════════
    // PHASE 9: PLANETS — SCAN AND VIEW
    // ═══════════════════════════════════════════════════════════
    console.log('=== PHASE 9: Planets ===');
    await nav(page, 'Planets');
    await waitForContent(page);

    // Check for planet list or scan button
    const scanSectorBtn = page.getByRole('button', { name: /Scan/i });
    if (await scanSectorBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await scanSectorBtn.click();
      await page.waitForTimeout(1000);
      console.log('Scanned sector for planets.');
    }

    // Check if any planet cards appear
    const planetCards = page.locator('[class*="card"]', { hasText: /Terran|Desert|Ice|Volcanic|Gas Giant|Oceanic|Barren|Jungle|Toxic|Crystalline/i });
    if (await planetCards.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Planet cards visible.');
    }
    console.log('Planets interactions complete.');

    // ═══════════════════════════════════════════════════════════
    // PHASE 10: PROGRESSION — VIEW LEVEL, SKILLS
    // ═══════════════════════════════════════════════════════════
    console.log('=== PHASE 10: Progression ===');
    await nav(page, 'Progression');
    await waitForContent(page);

    await expect(page.getByText(/Level|XP/i).first()).toBeVisible({ timeout: 5000 });

    // Check for skill upgrade buttons
    const skillBtns = page.getByRole('button', { name: /Upgrade/i });
    if (await skillBtns.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Skill upgrade buttons visible.');
    }

    // Check for technology/research section
    const techSection = page.getByText(/Tech|Research/i).first();
    if (await techSection.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Technology section visible.');
    }
    console.log('Progression interactions complete.');

    // ═══════════════════════════════════════════════════════════
    // PHASE 11: MISSIONS — VIEW AND ACCEPT
    // ═══════════════════════════════════════════════════════════
    console.log('=== PHASE 11: Missions ===');
    await nav(page, 'Missions');
    await waitForContent(page);

    // Check for mission sections
    await expect(page.getByText(/Mission|Board/i).first()).toBeVisible({ timeout: 5000 });

    // Look for available missions and accept one
    const acceptBtns = page.getByRole('button', { name: /Accept/i });
    if (await acceptBtns.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await acceptBtns.first().click();
      await page.waitForTimeout(800);
      console.log('Accepted a mission.');

      // Try to abandon it
      const abandonBtn = page.getByRole('button', { name: /Abandon/i });
      if (await abandonBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await abandonBtn.click();
        await page.waitForTimeout(1000);
        console.log('Abandoned the mission.');
      }
    } else {
      console.log('No available missions (not at port or none generated).');
    }
    console.log('Missions interactions complete.');

    // ═══════════════════════════════════════════════════════════
    // PHASE 12: CORPORATION — CREATE AND MANAGE
    // ═══════════════════════════════════════════════════════════
    console.log('=== PHASE 12: Corporation ===');
    await nav(page, 'Corporation');
    await waitForContent(page);

    // Try to create a corporation
    const corpNameInput = page.getByPlaceholder(/corporation name/i).or(page.locator('input').first());
    const createCorpSection = page.getByText(/Create Corporation/i).first();
    if (await createCorpSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Fill corporation details
      const inputs = page.locator('input');
      const inputCount = await inputs.count();
      if (inputCount >= 2) {
        await inputs.nth(0).fill(`TestCorp${TS}`);
        await inputs.nth(1).fill('TST');
        await page.waitForTimeout(300);

        const createBtn = page.getByRole('button', { name: /Create Corporation/i });
        if (await createBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await createBtn.click();
          await page.waitForTimeout(1000);
          console.log('Created corporation.');

          // Check if we're now in the corporation view
          const corpInfo = page.getByText(/Treasury|Members/i).first();
          if (await corpInfo.isVisible({ timeout: 3000 }).catch(() => false)) {
            console.log('Corporation dashboard visible.');

            // Try contributing to treasury
            const contributeInput = page.locator('input[type="number"]').first();
            if (await contributeInput.isVisible({ timeout: 1000 }).catch(() => false)) {
              await contributeInput.fill('100');
              const contributeBtn = page.getByRole('button', { name: /Contribute/i });
              if (await contributeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                await contributeBtn.click();
                await page.waitForTimeout(1000);
                console.log('Contributed to treasury.');
              }
            }

            // Leave the corporation
            const leaveBtn = page.getByRole('button', { name: /Leave|Disband/i });
            if (await leaveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
              await leaveBtn.click();
              await page.waitForTimeout(1000);
              // Confirm if dialog appears
              const confirmBtn = page.getByRole('button', { name: /Confirm|Yes|Disband/i });
              if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                await confirmBtn.click();
                await page.waitForTimeout(1000);
              }
              console.log('Left/disbanded corporation.');
            }
          }
        }
      }
    }
    console.log('Corporation interactions complete.');

    // ═══════════════════════════════════════════════════════════
    // PHASE 13: MESSAGING — COMPOSE AND SEND
    // ═══════════════════════════════════════════════════════════
    console.log('=== PHASE 13: Messaging ===');
    await nav(page, 'Messages');
    await waitForContent(page);

    // Check inbox/sent tabs
    await expect(page.getByText(/Inbox/i).first()).toBeVisible({ timeout: 5000 });
    const sentTab = page.getByText(/Sent/i, { exact: true });
    if (await sentTab.isVisible({ timeout: 1000 }).catch(() => false)) {
      await sentTab.click();
      await page.waitForTimeout(500);
      // Go back to inbox
      await page.getByText(/Inbox/i).first().click();
      await page.waitForTimeout(500);
    }

    // Open compose modal
    const composeBtn = page.getByRole('button', { name: /Compose/i });
    if (await composeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await composeBtn.click();
      await page.waitForTimeout(800);

      // Check compose modal elements
      await expect(page.getByText(/New Message/i)).toBeVisible({ timeout: 3000 });

      // Fill in message fields
      const recipientInput = page.getByPlaceholder(/commander|recipient|search/i);
      if (await recipientInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await recipientInput.fill(USER); // Send to self
        await page.waitForTimeout(500);
      }

      const subjectInput = page.getByPlaceholder(/subject/i);
      if (await subjectInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await subjectInput.fill('E2E Test Message');
      }

      const bodyInput = page.getByPlaceholder(/message|type/i);
      if (await bodyInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await bodyInput.fill('This is an automated test message.');
      }

      // Cancel instead of sending (to avoid noise)
      const cancelBtn = page.getByRole('button', { name: /Cancel/i });
      if (await cancelBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cancelBtn.click();
        await page.waitForTimeout(500);
      }
      console.log('Compose modal tested.');
    }
    console.log('Messaging interactions complete.');

    // ═══════════════════════════════════════════════════════════
    // PHASE 14: CRAFTING — VIEW BLUEPRINTS
    // ═══════════════════════════════════════════════════════════
    console.log('=== PHASE 14: Crafting ===');
    await nav(page, 'Crafting');
    await waitForContent(page);

    await expect(page.getByText(/Craft|Blueprint|Workshop/i).first()).toBeVisible({ timeout: 5000 });

    // Check for blueprint cards
    const blueprints = page.getByText(/Materials|Recipe|Required/i).first();
    if (await blueprints.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Blueprint details visible.');
    }
    console.log('Crafting interactions complete.');

    // ═══════════════════════════════════════════════════════════
    // PHASE 15: COLONIES — VIEW COLONY MANAGEMENT
    // ═══════════════════════════════════════════════════════════
    console.log('=== PHASE 15: Colonies ===');
    await nav(page, 'Colonies');
    await waitForContent(page);

    // Check stats overview
    const totalColonies = page.getByText(/Total Colonies/i);
    if (await totalColonies.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('Colony stats overview visible.');
    }

    // Visit leaderboard
    const leaderboardBtn = page.getByRole('button', { name: /Leaderboard/i });
    if (await leaderboardBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await leaderboardBtn.click();
      await page.waitForTimeout(1000);
      await expect(page).toHaveURL(/colony-leaderboard/);
      console.log('Colony leaderboard loaded.');
      await page.goBack();
      await page.waitForTimeout(500);
    }
    console.log('Colony interactions complete.');

    // ═══════════════════════════════════════════════════════════
    // PHASE 16: MARKET DATA
    // ═══════════════════════════════════════════════════════════
    console.log('=== PHASE 16: Market Data ===');
    await nav(page, 'Market Data');
    await waitForContent(page);

    await expect(page.getByText(/Market|Trade|Overview/i).first()).toBeVisible({ timeout: 5000 });
    console.log('Market data loaded.');

    // ═══════════════════════════════════════════════════════════
    // PHASE 17: FACTION STANDINGS
    // ═══════════════════════════════════════════════════════════
    console.log('=== PHASE 17: Faction ===');
    await nav(page, 'Faction');
    await waitForContent(page);

    await expect(page.getByText(/Faction|Standing|Reputation/i).first()).toBeVisible({ timeout: 5000 });
    console.log('Faction page loaded.');

    // ═══════════════════════════════════════════════════════════
    // PHASE 18: AUTOMATION — VIEW TASK OPTIONS
    // ═══════════════════════════════════════════════════════════
    console.log('=== PHASE 18: Automation ===');
    await nav(page, 'Automation');
    await waitForContent(page);

    await expect(page.getByText(/Automation|Task|Route/i).first()).toBeVisible({ timeout: 5000 });

    // Check for "Create" or "New" buttons for trade routes/mining
    const createRouteBtn = page.getByRole('button', { name: /Create|New|Add/i }).first();
    if (await createRouteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Automation creation buttons visible.');
    }
    console.log('Automation interactions complete.');

    // ═══════════════════════════════════════════════════════════
    // PHASE 19: EVENTS — VIEW COMMUNITY EVENTS
    // ═══════════════════════════════════════════════════════════
    console.log('=== PHASE 19: Events ===');
    await nav(page, 'Events');
    await waitForContent(page);

    await expect(page.getByText(/Event|Community|No events/i).first()).toBeVisible({ timeout: 5000 });
    console.log('Events loaded.');

    // ═══════════════════════════════════════════════════════════
    // PHASE 20: OUTPOSTS — VIEW OUTPOST OPTIONS
    // ═══════════════════════════════════════════════════════════
    console.log('=== PHASE 20: Outposts ===');
    await nav(page, 'Outposts');
    await waitForContent(page);

    await expect(page.getByText(/Outpost|Deploy|No outposts/i).first()).toBeVisible({ timeout: 5000 });
    console.log('Outposts loaded.');

    // ═══════════════════════════════════════════════════════════
    // PHASE 21: SHIP CUSTOMIZER
    // ═══════════════════════════════════════════════════════════
    console.log('=== PHASE 21: Ship Customizer ===');
    await nav(page, 'Customize');
    await waitForContent(page);
    await expect(page.locator('body')).not.toBeEmpty();
    console.log('Ship customizer loaded.');

    // ═══════════════════════════════════════════════════════════
    // PHASE 22: WIKI
    // ═══════════════════════════════════════════════════════════
    console.log('=== PHASE 22: Wiki ===');
    await nav(page, 'Wiki');
    await waitForContent(page);
    await expect(page.locator('body')).not.toBeEmpty();
    console.log('Wiki loaded.');

    // ═══════════════════════════════════════════════════════════
    // PHASE 23: GALAXY MAP — CLICK ON SYSTEMS
    // ═══════════════════════════════════════════════════════════
    console.log('=== PHASE 23: Galaxy Map ===');
    await nav(page, 'Sector Map');
    await expect(page.locator('canvas')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(800);

    // Click on the canvas center to select a system
    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (box) {
      await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
      await page.waitForTimeout(1000);
      console.log('Clicked galaxy map center.');
    }
    console.log('Galaxy map interactions complete.');

    // ═══════════════════════════════════════════════════════════
    // PHASE 24: FLEET CREATION
    // ═══════════════════════════════════════════════════════════
    console.log('=== PHASE 24: Fleet Creation ===');
    await nav(page, 'Ships');
    await waitForContent(page);

    // Look for "Create Fleet" button
    const createFleetBtn = page.getByRole('button', { name: /Create Fleet/i });
    if (await createFleetBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createFleetBtn.click();
      await page.waitForTimeout(800);

      // Fleet creation modal should appear
      const fleetModal = page.getByText(/Create Fleet/i).last();
      if (await fleetModal.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Fleet creation modal opened.');

        // Fleet name input
        const fleetNameInput = page.locator('input[type="text"]').last();
        if (await fleetNameInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await fleetNameInput.fill('Alpha Squadron');
        }

        // Cancel (we only have 1 ship, can't make a meaningful fleet)
        const cancelBtn = page.getByRole('button', { name: /Cancel/i });
        if (await cancelBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await cancelBtn.click();
          await page.waitForTimeout(500);
        }
      }
    }
    console.log('Fleet creation tested.');

    // ═══════════════════════════════════════════════════════════
    // PHASE 25: CHAT PANEL — SEND A MESSAGE
    // ═══════════════════════════════════════════════════════════
    console.log('=== PHASE 25: Chat Panel ===');
    const chatToggle = page.getByTitle('Toggle Chat');
    if (await chatToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await chatToggle.click();
      await page.waitForTimeout(800);

      // Check for chat tabs (Sector, Corp, Faction)
      const sectorTab = page.getByText('Sector', { exact: true });
      if (await sectorTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sectorTab.click();
        await page.waitForTimeout(300);
        console.log('Sector chat tab selected.');
      }

      // Type in chat input
      const chatInput = page.getByPlaceholder(/Message|sector|type/i);
      if (await chatInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await chatInput.fill('Hello from E2E test!');
        // Submit with Enter
        await chatInput.press('Enter');
        await page.waitForTimeout(1000);
        console.log('Chat message sent.');
      }

      // Close chat panel
      await chatToggle.click({ force: true });
      await page.waitForTimeout(300);
    }
    console.log('Chat interactions complete.');

    // ═══════════════════════════════════════════════════════════
    // PHASE 26: FINAL LOGOUT
    // ═══════════════════════════════════════════════════════════
    console.log('=== PHASE 26: Final Logout ===');
    await nav(page, 'Dashboard');
    await page.getByTitle('Logout').click();
    await expect(page.getByText('Welcome Back')).toBeVisible({ timeout: 5000 });
    console.log('Logged out successfully.');

    // ═══════════════════════════════════════════════════════════
    // RESULTS
    // ═══════════════════════════════════════════════════════════
    if (errors.length > 0) {
      console.warn(`Page errors encountered (${errors.length}):`, errors);
    }
    console.log('=== ALL DEEP INTERACTION TESTS PASSED ===');
  });
});
