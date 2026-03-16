import { test, expect } from '@playwright/test';
import { registerFreshCommander } from './helpers/auth';

async function fetchJsonWithRetries(page, path, options = {}, validate = () => true) {
  let lastError = 'Request did not succeed';

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await page.evaluate(async ({ requestPath, requestOptions }) => {
      const response = await fetch(requestPath, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(requestOptions.headers || {}),
        },
        ...requestOptions,
        body: requestOptions.body ? JSON.stringify(requestOptions.body) : undefined,
      });

      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      return {
        ok: response.ok,
        status: response.status,
        data,
      };
    }, { requestPath: path, requestOptions: options });

    if (validate(result)) {
      return result.data;
    }

    lastError = `${result.status} ${JSON.stringify(result.data)}`;
    await page.waitForTimeout(400 * (attempt + 1));
  }

  throw new Error(lastError);
}

async function registerAndCreateColony(page) {
  const account = await registerFreshCommander(page, 'Voxel');
  const colonyName = `${account.username} Colony`;

  const shipsPayload = await fetchJsonWithRetries(
    page,
    '/api/ships',
    {},
    (result) => Boolean(result.ok && result.data?.data?.ships)
  );
  const colonyShip = shipsPayload.data?.ships?.find((ship) => ship.ship_type === 'Insta Colony Ship');
  expect(colonyShip).toBeTruthy();

  const startingSectorId = colonyShip.currentSector?.sector_id || colonyShip.current_sector_id;
  expect(startingSectorId).toBeTruthy();

  const queue = [{ sectorId: startingSectorId, depth: 0 }];
  const visited = new Set([startingSectorId]);
  let colonizablePlanet = null;
  let targetSectorId = startingSectorId;

  while (queue.length > 0 && !colonizablePlanet) {
    const { sectorId, depth } = queue.shift();
    const systemPayload = await fetchJsonWithRetries(
      page,
      `/api/sectors/${sectorId}/system`,
      {},
      (result) => Boolean(result.ok && result.data?.data?.planets)
    );
    colonizablePlanet = systemPayload.data?.planets?.find(
      (planet) => !planet.owner_user_id && !planet.colony && (planet.habitability ?? 0) > 0
    );
    if (colonizablePlanet) {
      targetSectorId = sectorId;
      break;
    }

    if (depth >= 2) continue;

    const adjacentPayload = await fetchJsonWithRetries(
      page,
      `/api/sectors/${sectorId}`,
      {},
      (result) => Boolean(result.ok && result.data?.data?.adjacentSectors)
    );
    const adjacentSectors = adjacentPayload.data?.adjacentSectors || [];
    for (const adjacent of adjacentSectors) {
      const adjacentSectorId = adjacent.sector?.sector_id;
      if (!adjacentSectorId || visited.has(adjacentSectorId)) continue;
      visited.add(adjacentSectorId);
      queue.push({ sectorId: adjacentSectorId, depth: depth + 1 });
    }
  }

  expect(colonizablePlanet).toBeTruthy();

  if (targetSectorId !== startingSectorId) {
    await fetchJsonWithRetries(
      page,
      `/api/ships/${colonyShip.ship_id}/move`,
      {
        method: 'POST',
        body: {
          target_sector_id: targetSectorId,
        },
      },
      (result) => result.ok
    );
  }

  await fetchJsonWithRetries(
    page,
    `/api/colonies/${colonizablePlanet.planet_id}/colonize`,
    {
      method: 'POST',
      body: {
        ship_id: colonyShip.ship_id,
        colony_name: colonyName,
      },
    },
    (result) => result.ok
  );

  await expect
    .poll(async () => fetchJsonWithRetries(
      page,
      '/api/colonies',
      {},
      (result) => result.ok
    ).then((data) => Array.isArray(data) ? data.some((entry) => entry.name === colonyName) : false), { timeout: 10000 })
    .toBeTruthy();

  const coloniesData = await fetchJsonWithRetries(
    page,
    '/api/colonies',
    {},
    (result) => result.ok
  );
  const colony = Array.isArray(coloniesData)
    ? coloniesData.find((entry) => entry.name === colonyName)
    : null;
  expect(colony).toBeTruthy();

  return { account, colony };
}

test.describe('Voxel Surface', () => {
  test('loads the Minecraft-style colony surface and captures a screenshot', async ({ page }) => {
    page.on('pageerror', (err) => console.log(`[PAGE ERROR] ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log(`[CONSOLE ERROR] ${msg.text()}`);
    });

    const { colony } = await registerAndCreateColony(page);

    await page.goto(`/colony/${colony.colony_id}/voxel`);

    await expect.poll(async () => page.locator('canvas').evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return (
        rect.width >= 400 &&
        rect.height >= 300 &&
        style.display !== 'none'
      );
    }), { timeout: 20000 }).toBeTruthy();
    await expect.poll(async () => {
      const raw = await page.evaluate(() => window.render_game_to_text?.() || null);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }, { timeout: 20000 }).toMatchObject({
      mode: 'voxel_surface',
      loading: false,
      error: null,
    });
    await expect(page.getByRole('button', { name: /Back/i })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=WASD - Move')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Mouse - Look')).toBeVisible({ timeout: 10000 });
    const voxelState = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
    expect(voxelState.player.y).toBeGreaterThan(35);
    expect(voxelState.groundY).toBeGreaterThanOrEqual(35);

    await page.waitForTimeout(2500);
    const stabilizedState = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
    expect(stabilizedState.player.y).toBeGreaterThan(stabilizedState.groundY);
    expect(stabilizedState.groundY).toBeGreaterThanOrEqual(35);
    await page.screenshot({
      path: 'test-results/screenshots/voxel-surface-overview.png',
      fullPage: true
    });
  });
});
