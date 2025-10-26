# Playwright Tests for FreshCart

This directory contains end-to-end tests for the FreshCart application using Playwright.

## Test Structure

- `auth.spec.js` - Authentication tests for all user roles
- `seller-products.spec.js` - Seller dashboard and product management tests
- `registration.spec.js` - User registration tests
- `cart.spec.js` - Shopping cart functionality tests
- `example.spec.js` - Simple example tests to verify setup
- `helpers/` - Helper functions for common test operations

## Running Tests

### Install Dependencies

First, make sure you have installed Playwright:

```bash
npm install -D @playwright/test
npx playwright install chromium
```

### Run All Tests

```bash
npm test
```

### Run Tests in UI Mode

```bash
npm run test:ui
```

### Run Specific Test File

```bash
npx playwright test auth.spec.js
```

## Test Accounts

The tests use the following accounts:

- Admin: freshcart912@gmail.com / Admin@123
- Seller: albintomathewmo@gmail.com / Sevenseas01
- Delivery: lijithmk2026@mca.ajce.in / LijithMK@2026
- Customer: albinmathew2026@mca.ajce.in / 123456

## Test Coverage

The tests cover:

1. Authentication flows for all user roles
2. Seller dashboard access and product management
3. User registration flows
4. Adding products to cart functionality

## Reporting

After running tests, HTML reports are generated in the `playwright-report` directory.