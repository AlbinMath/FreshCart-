import { test, expect } from '@playwright/test';
import { login, logout } from './helpers/auth';

test.describe('Authentication Tests', () => {
  test('Admin login with freshcart912@gmail.com and Admin@123', async ({ page }) => {
    await login(page, 'freshcart912@gmail.com', 'Admin@123', 'admin');
    // Verify admin dashboard elements
    await expect(page.locator('h1:has-text("Dashboard Overview")')).toBeVisible();
    await logout(page);
  });

  test('Seller login with albintomathewmo@gmail.com and Sevenseas01', async ({ page }) => {
    await login(page, 'albintomathewmo@gmail.com', 'Sevenseas01', 'seller');
    // Verify seller dashboard elements
    await expect(page.locator('h1:has-text("Store Overview")')).toBeVisible();
    await logout(page);
  });

  test('Delivery login with lijithmk2026@mca.ajce.in and LijithMK@2026', async ({ page }) => {
    await login(page, 'lijithmk2026@mca.ajce.in', 'LijithMK@2026', 'delivery');
    // Verify delivery dashboard elements
    await expect(page.locator('h1:has-text("Delivery Status")')).toBeVisible();
    await logout(page);
  });

  test('Customer login with albinmathew2026@mca.ajce.in and 123456', async ({ page }) => {
    await login(page, 'albinmathew2026@mca.ajce.in', '123456', 'customer');
    // Verify customer homepage elements
    await expect(page.locator('h1:has-text("Welcome to FreshCart")')).toBeVisible();
    await logout(page);
  });
});