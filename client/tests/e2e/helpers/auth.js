import { expect } from '@playwright/test';

async function isCommanderLoaded(page) {
  const heading = page.getByRole('heading', { name: /Welcome, Commander/i });
  const logout = page.getByRole('button', { name: /Logout/i });

  if (await heading.isVisible().catch(() => false)) {
    return true;
  }

  return logout.isVisible().catch(() => false);
}

export async function registerFreshCommander(page, prefix = 'TestPilot') {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const username = `${prefix}${stamp}`;
  const email = `${username.toLowerCase()}@test.com`;
  const password = 'Str0ng!Pass99';

  await page.goto('/');
  if (await isCommanderLoaded(page)) {
    await page.getByRole('button', { name: /Logout/i }).click();
    await expect(page.getByRole('heading', { name: /Welcome Back|Create Account/i })).toBeVisible();
  }

  await page.getByText("Don't have an account? Register").click();
  await page.getByLabel(/Username/i).fill(username);
  await page.getByLabel(/Email/i).fill(email);
  await page.getByLabel(/Password/i).fill(password);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (await isCommanderLoaded(page)) {
      return { username, email, password };
    }

    const createButtonVisible = await page
      .getByRole('button', { name: /Create Account as Terran Alliance/i })
      .isVisible()
      .catch(() => false);

    if (!createButtonVisible) {
      const chooseFactionButton = page.getByRole('button', { name: /Choose Faction/i });
      const registerLink = page.getByText("Don't have an account? Register");

      if (await chooseFactionButton.isVisible().catch(() => false)) {
        await chooseFactionButton.click();
      } else if (await registerLink.isVisible().catch(() => false)) {
        await registerLink.click();
      }

      await expect(page.getByText('Choose Your Faction')).toBeVisible();
      await page.getByText('Terran Alliance').first().click();
    }

    await page.getByRole('button', { name: /Create Account as Terran Alliance/i }).click();

    const authenticated = await expect
      .poll(() => isCommanderLoaded(page), { timeout: 8000 })
      .toBeTruthy()
      .then(() => true)
      .catch(() => false);

    if (authenticated) {
      return { username, email, password };
    }

    await page.waitForTimeout(1000 * (attempt + 1));
  }

  await page.getByText(/Already have an account\? Login/i).click().catch(() => {});
  await page.getByLabel(/Username/i).fill(username);
  await page.getByLabel(/Password/i).fill(password);
  await page.getByRole('button', { name: /Login/i }).click();
  await expect(page.getByText(/Welcome, Commander/i)).toBeVisible({ timeout: 15000 });

  return { username, email, password };
}
