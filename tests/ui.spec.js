import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Seven Card Show UI & Accessibility', () => {
  
  test('Main menu loads and has no obvious a11y violations', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Seven-Card Show/);
    
    await expect(page.locator('text=SEVEN-CARD')).toBeVisible();
    await expect(page.locator('text=Play Single Round')).toBeVisible();
    await expect(page.locator('text=Play Elimination')).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Can navigate to setup and start a Single Round game', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Play Single Round');
    await expect(page.locator('text=Single Round Setup')).toBeVisible();
    
    // Add a 3rd player
    await page.click('text=+ Add Player');
    await expect(page.locator('text=Players (3 / 6)')).toBeVisible();

    // Start game
    await page.click('text=Start Game');
    
    // Check if game screen loaded (cards should be visible)
    await expect(page.locator('.game-screen')).toBeVisible();
  });
  
  test('UI Edge Cases: Rapid clicks on start game', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Play Single Round');
    
    // Rapidly double click Start Game
    await page.click('text=Start Game', { clickCount: 3 });
    await expect(page.locator('.game-screen')).toBeVisible();
    
    // Ensure only one game UI is rendered
    const gameScreens = await page.locator('.game-screen').count();
    expect(gameScreens).toBe(1);
  });

  test('Multi-session isolation (two different browser contexts)', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    await page1.goto('/');
    await page2.goto('/');

    await page1.click('text=Play Single Round');
    await page2.click('text=Play Elimination');

    await expect(page1.locator('text=Single Round Setup')).toBeVisible();
    await expect(page2.locator('text=Elimination Setup')).toBeVisible();
  });
});
