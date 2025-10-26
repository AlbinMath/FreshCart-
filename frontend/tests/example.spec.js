import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/FreshCart/);
});

test('get started link', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('text=Welcome to FreshCart')).toBeVisible();
});