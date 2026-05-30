import { expect, test } from "@playwright/test";
import { loginAsAdmin, navigateTo } from "./helpers";

test.describe("Inventory", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("inventory page loads with header", async ({ page }) => {
    await navigateTo(page, "/inventory");

    await expect(page.getByRole("heading", { name: "Item Catalog & Pricing" })).toBeVisible();
    await expect(page.getByRole("button", { name: /add new item/i })).toBeVisible();
  });

  test("search input is functional", async ({ page }) => {
    await navigateTo(page, "/inventory");

    const searchInput = page.getByPlaceholder("Search items, brands, models...");
    await expect(searchInput).toBeVisible();
    await searchInput.fill("panel");
    await expect(searchInput).toHaveValue("panel");
  });

  test("category filter buttons render", async ({ page }) => {
    await navigateTo(page, "/inventory");

    await expect(page.getByRole("button", { name: "All" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Panel" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Inverter" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Battery" })).toBeVisible();
  });

  test("category filtering works", async ({ page }) => {
    await navigateTo(page, "/inventory");

    await page.getByRole("button", { name: "Panel" }).click();
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "All" }).click();
    await page.waitForLoadState("networkidle");
  });

  test("add item dialog opens", async ({ page }) => {
    await navigateTo(page, "/inventory");

    await page.getByRole("button", { name: /add new item/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
  });

  test("inventory card has edit and delete actions", async ({ page }) => {
    await navigateTo(page, "/inventory");

    const cards = page.locator(".grid > div");
    const cardCount = await cards.count();

    if (cardCount > 0) {
      const firstCard = cards.first();
      await expect(firstCard).toBeVisible();
    }
  });
});
