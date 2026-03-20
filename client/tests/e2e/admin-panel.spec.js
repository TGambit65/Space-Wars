import { test, expect } from '@playwright/test';
import { registerFreshCommander } from './helpers/auth.js';

// We register a fresh user, then promote via API before navigating to /admin
async function setupAdmin(page) {
  const creds = await registerFreshCommander(page, 'Admin');

  // Promote to admin via direct API call using the page's auth context
  await page.evaluate(async (username) => {
    const token = localStorage.getItem('sw3k_token');
    // We need admin to promote — use a workaround: call the server directly
    const res = await fetch('/api/auth/profile', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    return data;
  }, creds.username);

  return creds;
}

test.describe('Admin Panel', () => {
  let adminCreds;

  test.beforeAll(async ({ browser }) => {
    // Register admin user and promote via DB
    const page = await browser.newPage();
    adminCreds = await registerFreshCommander(page, 'Admin');

    // Promote to admin via server-side script
    const { execSync } = await import('child_process');
    execSync(`cd /media/thoder/Share/Projects/Space-Wars/server && node -e "
      const { User } = require('./src/models');
      (async () => {
        await User.update({ is_admin: true }, { where: { username: '${adminCreds.username}' } });
        process.exit(0);
      })();
    "`, { timeout: 10000 });

    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check if already logged in
    if (await page.getByText(/Commander/i).first().isVisible().catch(() => false)) {
      // Check if it's the right user, if not logout
      await page.goto('/admin');
      const isAdmin = await page.getByRole('heading', { name: /Administration/i }).isVisible({ timeout: 3000 }).catch(() => false);
      if (isAdmin) return;
      // Not admin, logout and re-login
      await page.goto('/');
    }

    // Switch to login if on register
    const loginLink = page.getByText(/Already have an account/i);
    if (await loginLink.isVisible().catch(() => false)) {
      await loginLink.click();
      await page.waitForTimeout(300);
    }

    // Fill and submit login
    await page.locator('#username').waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('#username').fill(adminCreds.username);
    await page.locator('#password').fill(adminCreds.password);
    await page.getByRole('button', { name: /Login/i }).click();
    await expect(page.getByText(/Commander/i).first()).toBeVisible({ timeout: 15000 });

    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: /Administration/i })).toBeVisible({ timeout: 10000 });
  });

  const adminContent = (page) => page.locator('.max-w-5xl');

  test('should render all 9 tabs', async ({ page }) => {
    const tabLabels = ['Universe', 'Server', 'Economy', 'Players', 'NPCs', 'AI Config', 'Wars', 'Events', 'Audit Log'];
    for (const label of tabLabels) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
  });

  test('Universe tab loads stats', async ({ page }) => {
    await expect(adminContent(page).getByText('Current Universe Stats')).toBeVisible({ timeout: 10000 });
    await expect(adminContent(page).getByText('Systems')).toBeVisible();
    await expect(adminContent(page).getByText('Hyperlanes')).toBeVisible();
  });

  test('Server tab loads tick status', async ({ page }) => {
    await page.getByRole('button', { name: 'Server' }).click();
    await expect(adminContent(page).getByText('Tick System')).toBeVisible({ timeout: 10000 });
    await expect(adminContent(page).getByText(/RUNNING|STOPPED/)).toBeVisible();
    await expect(adminContent(page).getByText('Tactical Ticks')).toBeVisible();
    await expect(adminContent(page).getByText('Server Info')).toBeVisible();
  });

  test('Economy tab loads overview', async ({ page }) => {
    await page.getByRole('button', { name: 'Economy' }).click();
    await expect(adminContent(page).getByText('Market Health')).toBeVisible({ timeout: 10000 });
    await expect(adminContent(page).getByText('Active Ports')).toBeVisible();
    await expect(adminContent(page).getByText('Transfer Ledger')).toBeVisible();
  });

  test('Players tab loads user list', async ({ page }) => {
    await page.getByRole('button', { name: 'Players' }).click();
    await expect(page.getByPlaceholder('Search username or email...')).toBeVisible({ timeout: 10000 });
    // Table should have at least one user row
    await expect(adminContent(page).locator('table tbody tr').first()).toBeVisible({ timeout: 10000 });
  });

  test('Wars tab loads and shows declare form', async ({ page }) => {
    await page.getByRole('button', { name: 'Wars' }).click();
    await expect(adminContent(page).getByRole('heading', { name: 'Declare War' })).toBeVisible({ timeout: 10000 });
    await expect(adminContent(page).getByText('War History')).toBeVisible();
    await expect(adminContent(page).locator('label').filter({ hasText: 'Attacker' })).toBeVisible();
    await expect(adminContent(page).locator('label').filter({ hasText: 'Defender' })).toBeVisible();
  });

  test('Events tab loads', async ({ page }) => {
    await page.getByRole('button', { name: 'Events' }).click();
    await expect(adminContent(page).getByText('Create Event')).toBeVisible({ timeout: 10000 });
    await expect(adminContent(page).getByText('All Events')).toBeVisible();
  });

  test('Audit Log tab loads with filters', async ({ page }) => {
    await page.getByRole('button', { name: 'Audit Log' }).click();
    await expect(adminContent(page).getByRole('heading', { name: 'Audit Log' })).toBeVisible({ timeout: 10000 });
    await expect(adminContent(page).getByText('Total (24h)')).toBeVisible();
    await expect(adminContent(page).getByText('Denials (24h)')).toBeVisible();
    await expect(adminContent(page).getByRole('button', { name: 'Filter' })).toBeVisible();
  });
});
