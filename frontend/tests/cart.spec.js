import { test, expect } from '@playwright/test';
import { login, logout } from './helpers/auth';

test.describe('Cart Tests', () => {
  test('Customer can add products to cart', async ({ page }) => {
    // Login as customer
    await login(page, 'albinmathew2026@mca.ajce.in', '123456', 'customer');
    
    // Navigate to home page to browse products
    await page.goto('/');
    
    // Wait for products to load
    await page.waitForLoadState('networkidle');
    
    // Find the first product and add it to cart
    const firstProduct = page.locator('.grid .bg-white.rounded-lg.shadow-md').first();
    await expect(firstProduct).toBeVisible();
    
    // Click add to cart button
    const addToCartButton = firstProduct.locator('button:has-text("Add to Cart")');
    await addToCartButton.click();
    
    // Wait for the alert and then navigate to cart
    await page.waitForTimeout(2000);
    
    // Navigate to cart page
    await page.goto('/cart');
    
    // Verify we're on the cart page
    await expect(page.locator('h1:has-text("Your Cart")')).toBeVisible();
    
    // Verify the product is in the cart by checking for cart item elements
    const cartItems = page.locator('.space-y-4 .bg-white.rounded-lg.shadow-md.p-6');
    await expect(cartItems).toHaveCount(1);
    
    // Verify quantity controls are present by checking for buttons with specific classes
    // The minus button has an SVG icon, not text
    const minusButton = page.locator('button.w-8.h-8.flex.items-center.justify-center.bg-gray-200.hover\\:bg-gray-300.rounded').first();
    await expect(minusButton).toBeVisible();
    
    // The plus button also has an SVG icon, not text
    const plusButton = page.locator('button.w-8.h-8.flex.items-center.justify-center.bg-gray-200.hover\\:bg-gray-300.rounded').nth(1);
    await expect(plusButton).toBeVisible();
    
    await logout(page);
  });
});