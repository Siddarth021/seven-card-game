import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { width: 320, height: 568, name: 'iPhone SE (1st gen)' },
  { width: 375, height: 667, name: 'iPhone 8' },
  { width: 390, height: 844, name: 'iPhone 12' },
  { width: 414, height: 896, name: 'iPhone 11 Pro Max' }
];

for (const vp of VIEWPORTS) {
  test(`Mobile Layout Test - ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    
    // 1. Open home page
    await page.goto('/');
    await expect(page.locator('text=SEVEN-CARD')).toBeVisible();

    // 2. Start Single Round
    await page.click('text=Play Single Round');
    await expect(page.locator('text=Single Round Setup')).toBeVisible();

    // 3. Start Game
    await page.click('text=Start Game');
    
    // Verify gameplay screen loaded
    await expect(page.locator('.game-screen')).toBeVisible();

    // Wait a bit to ensure it rendered correctly
    await page.waitForTimeout(500);
    
    // Go back to home
    await page.goto('/');
    
    // 4. Start Elimination Mode
    await page.click('text=Play Elimination');
    await expect(page.locator('text=Elimination Setup')).toBeVisible();
    await page.click('text=Start Game');
    await expect(page.locator('.game-screen')).toBeVisible();
  });
}
