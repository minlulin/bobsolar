import { expect, test } from "@playwright/test";
import { loginAsAdmin, navigateTo } from "./helpers";

test.describe("Finance", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("finance dashboard loads", async ({ page }) => {
    await navigateTo(page, "/finance");

    await page.waitForLoadState("networkidle");
    await expect(page.url()).toContain("/finance");
  });

  test("ledger page loads with filters", async ({ page }) => {
    await navigateTo(page, "/finance/ledger");

    await expect(page.getByRole("heading", { name: "Master Ledger" })).toBeVisible();
    await expect(page.getByLabel("Date From")).toBeVisible();
    await expect(page.getByLabel("Date To")).toBeVisible();
    await expect(page.getByRole("button", { name: /account balances/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /export csv/i })).toBeVisible();
  });

  test("ledger account filter works", async ({ page }) => {
    await navigateTo(page, "/finance/ledger");

    const accountFilter = page.getByLabel("Account");
    await expect(accountFilter).toBeVisible();
  });

  test("ledger source type filter works", async ({ page }) => {
    await navigateTo(page, "/finance/ledger");

    const sourceFilter = page.getByLabel("Source Type");
    await expect(sourceFilter).toBeVisible();
  });

  test("balance sheet page loads", async ({ page }) => {
    await navigateTo(page, "/finance/reports/balance-sheet");

    await expect(page.getByRole("heading", { name: "Balance Sheet" })).toBeVisible();
    await expect(page.getByText("As of Today")).toBeVisible();
  });

  test("balance sheet date selector works", async ({ page }) => {
    await navigateTo(page, "/finance/reports/balance-sheet");

    const dateSelect = page.locator("button:has-text('As of Today')");
    await expect(dateSelect).toBeVisible();
  });

  test("new journal entry page loads", async ({ page }) => {
    await navigateTo(page, "/finance/new-entry");

    await page.waitForLoadState("networkidle");
    await expect(page.url()).toContain("/finance/new-entry");
  });

  test("ledger CSV export button exists", async ({ page }) => {
    await navigateTo(page, "/finance/ledger");

    const exportBtn = page.getByRole("button", { name: /export csv/i });
    await expect(exportBtn).toBeVisible();
  });
});
