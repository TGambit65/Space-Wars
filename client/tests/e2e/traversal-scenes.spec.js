import { test, expect } from '@playwright/test';
import { registerFreshCommander } from './helpers/auth';

async function getActiveShipId(page) {
  return page.evaluate(async () => {
    const response = await fetch('/api/ships', { credentials: 'include' });
    const payload = await response.json();
    const ships = payload?.data?.ships || [];
    return payload?.data?.active_ship_id || ships[0]?.ship_id || null;
  });
}

async function getTraversalState(page) {
  return page.evaluate(() => {
    const raw = window.render_game_to_text?.() || null;
    return raw ? JSON.parse(raw) : null;
  });
}

function traversalStatePoll(page) {
  return expect.poll(async () => {
    const raw = await page.evaluate(() => window.render_game_to_text?.() || null);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, { timeout: 20000 });
}

async function installMockGamepad(page) {
  await page.addInitScript(() => {
    const createButtons = () => Array.from({ length: 16 }, () => ({
      pressed: false,
      touched: false,
      value: 0,
    }));

    window.__mockGamepad = {
      id: 'Playwright Mock Gamepad',
      index: 0,
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: createButtons(),
      timestamp: Date.now(),
    };

    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => [window.__mockGamepad],
    });
  });
}

async function setMockGamepadButton(page, index, pressed) {
  await page.evaluate(({ index, pressed }) => {
    if (!window.__mockGamepad) return;
    window.__mockGamepad.buttons[index] = {
      pressed,
      touched: pressed,
      value: pressed ? 1 : 0,
    };
    window.__mockGamepad.timestamp = Date.now();
  }, { index, pressed });
}

async function dispatchTraversalKey(page, type, code) {
  await page.evaluate(({ type, code }) => {
    document.dispatchEvent(new KeyboardEvent(type, {
      code,
      key: code === 'KeyW' ? 'w' : code,
      bubbles: true,
    }));
  }, { type, code });
}

test.describe('Traversal scenes', () => {
  test('boards ship interior and derelict scenes with shared interactions', async ({ page }) => {
    page.on('pageerror', (err) => console.log(`[PAGE ERROR] ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log(`[CONSOLE ERROR] ${msg.text()}`);
    });

    await registerFreshCommander(page, 'Traversal');

    const shipId = await getActiveShipId(page);
    expect(shipId).toBeTruthy();

    await page.goto('/ships');
    await expect(page.getByText(/Ship Status/i)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /Board Interior/i }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: /Board Interior/i })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /Board Interior/i }).click();
    await expect(page.getByText(/Ship Interior/i)).toBeVisible({ timeout: 15000 });
    await traversalStatePoll(page).toMatchObject({
      mode: 'ship_interior',
      loading: false,
      error: null,
      previewMode: true,
    });

    await page.getByRole('button', { name: /Deploy Team/i }).click();
    await expect
      .poll(async () => (await getTraversalState(page))?.previewMode, { timeout: 10000 })
      .toBeFalsy();
    await expect(page.getByText(/Bridge Console/i)).toBeVisible({ timeout: 10000 });
    await page.keyboard.press('e');
    await expect(page.getByText(/Bridge telemetry synchronized/i).first()).toBeVisible({ timeout: 10000 });

    await page.goto('/ships');
    await expect(page.getByText(/Ship Status/i)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /Board Derelict/i }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('button', { name: /Board Derelict/i })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /Board Derelict/i }).click();
    await expect(page.getByText(/Derelict Boarding/i)).toBeVisible({ timeout: 15000 });
    await traversalStatePoll(page).toMatchObject({
      mode: 'derelict_boarding',
      loading: false,
      error: null,
      previewMode: true,
    });

    await page.getByRole('button', { name: /Deploy Team/i }).click();
    await expect
      .poll(async () => (await getTraversalState(page))?.previewMode, { timeout: 10000 })
      .toBeFalsy();
    await expect(page.getByText(/Data Core/i)).toBeVisible({ timeout: 10000 });
    await page.keyboard.press('e');
    await expect(page.getByText(/Recovered fragmented jump telemetry/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('gamepad deploy does not auto-interact and neutral gamepad does not suppress keyboard movement', async ({ page }) => {
    await registerFreshCommander(page, 'TraversalPad');
    await installMockGamepad(page);

    await page.goto('/ships');
    await expect(page.getByText(/Ship Status/i)).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /Board Interior/i }).click();
    await traversalStatePoll(page).toMatchObject({
      mode: 'ship_interior',
      loading: false,
      error: null,
      previewMode: true,
    });
    await expect
      .poll(async () => (await getTraversalState(page))?.input?.gamepadActive, { timeout: 10000 })
      .toBeTruthy();

    await setMockGamepadButton(page, 0, true);
    await expect
      .poll(async () => (await getTraversalState(page))?.previewMode, { timeout: 10000 })
      .toBeFalsy();
    await setMockGamepadButton(page, 0, false);

    await page.waitForTimeout(300);
    const stateAfterDeploy = await getTraversalState(page);
    expect(stateAfterDeploy?.recentAction ?? null).toBeNull();
    await expect(page).toHaveURL(/interior/);

    await dispatchTraversalKey(page, 'keydown', 'KeyW');
    await expect
      .poll(async () => {
        const state = await getTraversalState(page);
        return state?.movement?.keyboard?.forward ?? null;
      }, { timeout: 10000 })
      .toBeTruthy();
    await expect
      .poll(async () => {
        const state = await getTraversalState(page);
        return state?.movement?.combined?.forward ?? null;
      }, { timeout: 10000 })
      .toBeTruthy();
    await dispatchTraversalKey(page, 'keyup', 'KeyW');
  });
});
