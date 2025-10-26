import { test, expect } from '@playwright/test';
import { login, logout } from './helpers/auth';

test.describe('Seller Products Tests', () => {
  test('Seller can access My Products page', async ({ page }) => {
    // Login as seller
    await login(page, 'albintomathewmo@gmail.com', 'Sevenseas01', 'seller');
    
    // Navigate to seller dashboard first
    await page.waitForURL(/\/seller/);
    
    // Click on "Add Product" button which navigates to /seller/products
    await page.click('button:has-text("Add Product")');
    
    // Verify we're on the correct page
    await expect(page.locator('h1:has-text("My Products")')).toBeVisible();
    
    // Check for product form elements
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="price"]')).toBeVisible();
    await expect(page.locator('input[name="stock"]')).toBeVisible();
    await expect(page.locator('button:has-text("Add Product")')).toBeVisible();
    
    // Check for existing products list
    await expect(page.locator('text=Your Products')).toBeVisible();
    
    await logout(page);
  });
});