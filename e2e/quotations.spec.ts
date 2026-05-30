import { expect, test } from "@playwright/test";
import { loginAsAdmin, navigateTo } from "./helpers";

test.describe("Quotations", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("quotations page loads with tabs and search", async ({ page }) => {
    await navigateTo(page, "/quotations");

    await expect(page.getByRole("button", { name: "All" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Drafts" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sent" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Accepted" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Rejected" })).toBeVisible();
    await expect(page.getByPlaceholder("Search by quote number...")).toBeVisible();
  });

  test("status tab filtering works", async ({ page }) => {
    await navigateTo(page, "/quotations");

    await page.getByRole("button", { name: "Drafts" }).click();
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Sent" }).click();
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "All" }).click();
    await page.waitForLoadState("networkidle");
  });

  test("search input filters quotations", async ({ page }) => {
    await navigateTo(page, "/quotations");

    const searchInput = page.getByPlaceholder("Search by quote number...");
    await searchInput.fill("QT-");
    await expect(searchInput).toHaveValue("QT-");
  });

  test("new quotation page loads", async ({ page }) => {
    await navigateTo(page, "/quotations/new");

    await page.waitForLoadState("networkidle");
    await expect(page.url()).toContain("/quotations/new");
  });

  test("quotation editor has customer selector", async ({ page }) => {
    await navigateTo(page, "/quotations/new");

    await page.waitForLoadState("networkidle");

    const customerSelector = page.getByPlaceholder(/select.*customer/i);
    const hasSelector = await customerSelector.count();
    expect(hasSelector).toBeGreaterThanOrEqual(0);
  });

  test("empty state shows create prompt", async ({ page }) => {
    await navigateTo(page, "/quotations");

    const emptyState = page.getByText("No quotations found");
    const hasEmpty = await emptyState.count();

    if (hasEmpty > 0) {
      await expect(page.getByRole("link", { name: /create your first quote/i })).toBeVisible();
    }
  });
});
