import { test, expect } from '@playwright/test';

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
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const username = `ColonyTest${stamp}`;
  const email = `colony${stamp}@test.com`;
  const password = 'Str0ng!Pass99';
  const colonyName = `${username} Colony`;

  await page.goto('/');
  await page.getByText("Don't have an account? Register").click();
  await page.getByLabel(/Username/i).fill(username);
  await page.getByLabel(/Email/i).fill(email);
  await page.getByLabel(/Password/i).fill(password);
  await page.getByRole('button', { name: /Choose Faction/i }).click();
  await expect(page.getByText('Choose Your Faction')).toBeVisible();
  await page.getByText('Terran Alliance').first().click();
  await page.getByRole('button', { name: /Create Account as Terran Alliance/i }).click();
  await expect(page.getByText(/Welcome, Commander/i)).toBeVisible({ timeout: 15000 });
  await page.waitForLoadState('networkidle').catch(() => {});

  const shipsPayload = await fetchJsonWithRetries(
    page,
    '/api/ships',
    {},
    (result) => Boolean(result.ok && result.data?.data?.ships)
  );
  const colonyShip = shipsPayload.data?.ships?.find((ship) => ship.ship_type === 'Insta Colony Ship');
  expect(colonyShip).toBeTruthy();

  const sectorId = colonyShip.currentSector?.sector_id || colonyShip.current_sector_id;
  expect(sectorId).toBeTruthy();

  const systemPayload = await fetchJsonWithRetries(
    page,
    `/api/sectors/${sectorId}/system`,
    {},
    (result) => Boolean(result.ok && result.data?.data?.planets)
  );
  const colonizablePlanet = systemPayload.data?.planets?.find(
    (planet) => !planet.owner_user_id && !planet.colony && (planet.habitability ?? 0) > 0
  );
  expect(colonizablePlanet).toBeTruthy();

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
    .poll(async () => {
      const coloniesPayload = await fetchJsonWithRetries(
        page,
        '/api/colonies',
        {},
        (result) => result.ok
      );
      return Array.isArray(coloniesPayload)
        ? coloniesPayload.some((colony) => colony.name === colonyName)
        : false;
    }, { timeout: 10000 })
    .toBe(true);

  return { colonyName };
}

test.describe('Colony Buildings Screenshot', () => {
  test('Navigate to colony and screenshot buildings menu', async ({ page }) => {
    page.on('pageerror', (err) => console.log(`[PAGE ERROR] ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log(`[CONSOLE ERROR] ${msg.text()}`);
    });

    const { colonyName } = await registerAndCreateColony(page);

    await page.goto('/colonies');
    await page.getByRole('heading', { name: 'Colony Management' }).waitFor({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: colonyName, exact: true }).first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/screenshots/col-06-colonies-page.png', fullPage: true });

    await page.getByRole('heading', { name: colonyName, exact: true }).first().click();
    await expect(page.getByRole('button', { name: 'Buildings', exact: true })).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/screenshots/col-07-colony-overview.png', fullPage: true });

    await page.getByRole('button', { name: 'Buildings', exact: true }).click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/screenshots/col-08-buildings-menu.png', fullPage: true });

    const wondersTab = page.getByRole('button', { name: 'Wonders', exact: true });
    if (await wondersTab.isVisible()) {
      await wondersTab.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'test-results/screenshots/col-09-wonders-tab.png', fullPage: true });
    }
  });
});
