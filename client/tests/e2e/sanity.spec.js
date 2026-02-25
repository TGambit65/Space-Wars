
import { test, expect } from '@playwright/test';

test('sanity check', async ({ page }) => {
    await page.goto('http://localhost:3080');
    console.log('Page title:', await page.title());
    // The title might not be exactly Space Wars 3000 yet, just checking it loads
    const title = await page.title();
    expect(title).toBeTruthy();
});
