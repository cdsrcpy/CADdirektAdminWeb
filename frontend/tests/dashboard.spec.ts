import { test, expect } from '@playwright/test';

test.describe('CADdirekt Administration Portal - End-to-End Tests', () => {

  test('Regular admin (CADshop) login and role-based restore restrictions', async ({ page }) => {
    // Go to login page
    await page.goto('/');

    // Verify title/header
    await expect(page.locator('h1')).toContainText('CADdirekt');

    // Login as Regular Admin (CADshop / SF)
    await page.fill('input[placeholder="Enter username"]', 'CADshop');
    await page.fill('input[placeholder="Enter password"]', 'SF');
    await page.click('button[type="submit"]');

    // Verify redirect to Customer Grid
    await expect(page.locator('h2')).toContainText('Customer License Matrix');

    // Verify Username display in sidebar
    await expect(page.locator('aside')).toContainText('CADshop');
    await expect(page.locator('aside')).toContainText('Admin');

    // Go to Restore Keys tab
    await page.click('button:has-text("Restore Keys")');
    await expect(page.locator('h2')).toContainText('Restore Backup License Keys');

    // Verify restricted products options (SkalaFormat only)
    const options = page.locator('select.form-input option');
    await expect(options).toHaveCount(2);
    await expect(options.nth(0)).toContainText('CADdirekt SkalaFormat LT');
    await expect(options.nth(1)).toContainText('CADdirekt SkalaFormat LT Upgrade');

    // Logout
    await page.click('button:has-text("Log Out")');
    await expect(page.locator('h3')).toContainText('Log In');
  });

  test('Super Admin (CADdirekt) login and portal operations', async ({ page }) => {
    // Set longer timeout for database query latency
    test.setTimeout(60000);
    // Go to login page
    await page.goto('/');

    // Login as Super Admin (CADdirekt / patrik)
    await page.fill('input[placeholder="Enter username"]', 'CADdirekt');
    await page.fill('input[placeholder="Enter password"]', 'patrik');
    await page.click('button[type="submit"]');

    // Verify redirect to Customer Grid
    await expect(page.locator('h2')).toContainText('Customer License Matrix');
    await expect(page.locator('aside')).toContainText('CADdirekt');
    await expect(page.locator('aside')).toContainText('Super Admin');

    // 1. Grid Interactions: Toggle Simplified View
    // Count columns before toggling
    const initialHeaderCount = await page.locator('table.data-table th').count();
    // Use precise selector matching Simplified View checkbox label
    await page.locator('label:has-text("Simplified View") input').check();
    const simplifiedHeaderCount = await page.locator('table.data-table th').count();
    expect(simplifiedHeaderCount).toBeLessThan(initialHeaderCount);

    // Uncheck Simplified View
    await page.locator('label:has-text("Simplified View") input').uncheck();

    // 2. Open Product Filter dropdown
    await page.click('button:has-text("All Products")');
    // Verify grouping titles are present
    await expect(page.locator('text=CADdirekt Products')).toBeVisible();
    await expect(page.locator('text=Bluebeam / Add-on')).toBeVisible();
    // Close dropdown
    await page.click('h2'); // Click outside

    // 3. Calculation breakdown "Show Calc"
    // Wait for customer data rows to load (waiting for loading state to disappear)
    await expect(page.locator('text=Loading license data...')).not.toBeVisible({ timeout: 45000 });
    const firstRow = page.locator('table.data-table tbody tr').first();
    await expect(firstRow).not.toContainText('No keys matched');
    await firstRow.click();
    
    // Check details sidebar is visible
    await expect(page.locator('h4:has-text("License details")')).toBeVisible();

    // Click "Show Calc"
    await page.click('button:has-text("Show Calc")');
    await expect(page.locator('h4:has-text("Days Left Calculation Breakdown")')).toBeVisible();
    // Wait for details loading
    await expect(page.locator('pre')).toBeVisible();
    // Close calculation details popup
    await page.click('button:has-text("Close Summary")');

    // 4. Link parent-child keys modal
    await page.click('button:has-text("Link Keys")');
    await expect(page.locator('h4:has-text("Establish Parent-Child License Link")')).toBeVisible();
    await page.click('button:has-text("Cancel")');

    // 5. Restore Keys - Super Admin unrestricted access
    await page.click('button:has-text("Restore Keys")');
    await expect(page.locator('h2')).toContainText('Restore Backup License Keys');
    const options = page.locator('select.form-input option');
    expect(await options.count()).toBeGreaterThan(2); // Super Admin has access to all products

    // 6. Reseller Directory: Add and delete
    await page.click('button:has-text("Resellers List")');
    await expect(page.locator('h2')).toContainText('Reseller Directory');

    const timestamp = Date.now();
    const resellerName = `Test Reseller ${timestamp}`;
    await page.fill('input[placeholder="Enter reseller name"]', resellerName);
    await page.fill('input[placeholder="Location details..."]', 'Sweden HQ');
    await page.click('button[type="submit"]');

    // Verify added reseller is in the grid
    await expect(page.locator('table.data-table')).toContainText(resellerName);

    // Delete the reseller
    // Find the row containing our reseller name and click its delete button
    const deleteBtn = page.locator(`tr:has-text("${resellerName}")`).locator('button:has(svg.lucide-trash2)');
    
    // Accept confirm dialog
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('Are you sure you want to delete this reseller?');
      await dialog.accept();
    });
    await deleteBtn.click();

    // Verify it is removed from the grid
    await expect(page.locator('table.data-table')).not.toContainText(resellerName);

    // Logout
    await page.click('button:has-text("Log Out")');
  });
});
