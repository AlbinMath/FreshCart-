import { expect } from '@playwright/test';

async function login(page, email, password, role) {
  // Navigate to login page
  await page.goto('/login');
  
  // Wait for the page to load
  await page.waitForLoadState('networkidle');
  
  // Fill in email and password
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  
  // Submit the form
  await page.click('button[type="submit"]');
  
  // Wait for navigation or error
  await page.waitForLoadState('networkidle');
  
  // Check if login was successful based on role
  if (role === 'admin') {
    await page.waitForURL(/\/admin/);
    await expect(page).toHaveURL(/\/admin/);
  } else if (role === 'seller') {
    await page.waitForURL(/\/seller/);
    await expect(page).toHaveURL(/\/seller/);
  } else if (role === 'delivery') {
    await page.waitForURL(/\/delivery/);
    await expect(page).toHaveURL(/\/delivery/);
  } else if (role === 'customer') {
    await page.waitForURL(/\/$/);
    await expect(page).toHaveURL(/\/$/);
  }
}

async function logout(page) {
  // Click on the logout button
  await page.click('text=Logout');
  
  // Wait for navigation to login page
  await page.waitForURL(/\/login/);
  await expect(page).toHaveURL(/\/login/);
}

export { login, logout };