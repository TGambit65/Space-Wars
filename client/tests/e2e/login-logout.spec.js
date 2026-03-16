import { test, expect } from '@playwright/test';
import { registerFreshCommander } from './helpers/auth';

test('can log out and log back in with same account', async ({ page }) => {
  page.on('pageerror', err => console.log('PAGE ERROR:', err));
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warn') {
      console.log(`CONSOLE ${msg.type()}: ${msg.text()}`);
    }
  });

  // Step 1: Register a fresh user
  const { username, password } = await registerFreshCommander(page, 'Login');
  await expect(page.getByRole('heading', { name: /Welcome, Commander/i })).toBeVisible({ timeout: 15000 });
  console.log(`Registered as: ${username}`);

  // Step 2: Verify we're logged in by checking the dashboard
  const profileAfterRegister = await page.evaluate(async () => {
    const response = await fetch('/api/auth/profile', { credentials: 'include' });
    const body = await response.json();
    return { ok: response.ok, body };
  });
  console.log('Profile after register:', profileAfterRegister.body?.data?.username);
  expect(profileAfterRegister.ok).toBe(true);

  // Step 3: Log out
  const logoutBtn = page.getByRole('button', { name: /Logout|Log Out|Sign Out/i });
  await expect(logoutBtn).toBeVisible({ timeout: 5000 });
  const logoutResponsePromise = page.waitForResponse(resp =>
    resp.url().includes('/api/auth/logout') && resp.request().method() === 'POST'
  );
  await logoutBtn.click();
  await logoutResponsePromise;
  console.log('Clicked logout');

  // Step 4: Verify we're on the login screen
  await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible({ timeout: 5000 });
  const cookiesAfterLogout = await page.context().cookies();
  const authCookieAfterLogout = cookiesAfterLogout.find(cookie => cookie.name === 'sw3k_auth');
  console.log('Auth cookie after logout:', authCookieAfterLogout ? 'present' : 'cleared');
  expect(authCookieAfterLogout).toBeUndefined();
  console.log('Login screen visible after logout');

  // Step 5: Log back in with same credentials
  await page.getByLabel(/Username/i).fill(username);
  await page.getByLabel(/Password/i).fill(password);

  // Listen for network response BEFORE clicking
  const loginResponsePromise = page.waitForResponse(resp =>
    resp.url().includes('/api/auth/login') && resp.request().method() === 'POST'
  );

  await page.getByRole('button', { name: /Login/i }).click();
  console.log('Clicked login button');

  // Step 6: Check the API response
  const loginResponse = await loginResponsePromise;
  const loginStatus = loginResponse.status();
  const loginBody = await loginResponse.json();
  console.log('Login response status:', loginStatus);
  console.log('Login response body:', JSON.stringify(loginBody).substring(0, 200));

  if (loginStatus !== 200) {
    // If login failed, check what error we get
    console.log('LOGIN FAILED!');
    console.log('Full response:', JSON.stringify(loginBody));

    // Check if error is shown on the page
    await page.waitForTimeout(2000);
    const pageContent = await page.textContent('body');
    console.log('Page content after failed login:', pageContent?.substring(0, 500));
  }

  // Step 7: Verify we're logged in again
  await expect(page.getByRole('heading', { name: /Welcome, Commander/i })).toBeVisible({ timeout: 15000 });
  console.log('Successfully logged back in!');

  const profileAfterRelogin = await page.evaluate(async () => {
    const response = await fetch('/api/auth/profile', { credentials: 'include' });
    const body = await response.json();
    return { ok: response.ok, body };
  });
  console.log('Profile after re-login:', profileAfterRelogin.body?.data?.username);
  expect(profileAfterRelogin.ok).toBe(true);
  expect(profileAfterRelogin.body?.data?.username).toBe(username);
  const cookiesAfterRelogin = await page.context().cookies();
  expect(cookiesAfterRelogin.some(cookie => cookie.name === 'sw3k_auth')).toBe(true);

  console.log('=== LOGIN/LOGOUT TEST PASSED ===');
});

test('shows error message on wrong password (no page reload)', async ({ page }) => {
  page.on('pageerror', err => console.log('PAGE ERROR:', err));

  // Step 1: Register
  const { username } = await registerFreshCommander(page, 'ErrTest');
  await expect(page.getByRole('heading', { name: /Welcome, Commander/i })).toBeVisible({ timeout: 15000 });

  // Step 2: Logout
  await page.getByRole('button', { name: /Logout|Log Out|Sign Out/i }).click();
  await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible({ timeout: 5000 });

  // Step 3: Try wrong password
  await page.getByLabel(/Username/i).fill(username);
  await page.getByLabel(/Password/i).fill('WrongPassword@123');

  // Track if navigation happens (page reload)
  let navigated = false;
  page.on('framenavigated', () => { navigated = true; });

  await page.getByRole('button', { name: /Login/i }).click();

  // Wait a bit for the error to appear
  await page.waitForTimeout(3000);

  console.log('Page navigated (reloaded)?', navigated);

  // Check current URL
  console.log('Current URL:', page.url());

  // The error message should be visible
  const errorVisible = await page.getByText(/Invalid credentials/i).isVisible().catch(() => false);
  console.log('Error message visible:', errorVisible);

  // Check if we're still on login page (not reloaded to a blank state)
  const welcomeBack = await page.getByRole('heading', { name: /Welcome Back/i }).isVisible().catch(() => false);
  console.log('Still on login page:', welcomeBack);

  // This should NOT have caused a page reload
  expect(navigated).toBe(false);
  expect(errorVisible).toBe(true);
});
