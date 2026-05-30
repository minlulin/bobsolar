import { expect, test } from "@playwright/test";
import { loginAsAdmin, navigateTo } from "./helpers";

test.describe("Customers", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("customers page loads and shows header", async ({ page }) => {
    await navigateTo(page, "/customers");

    await expect(page.getByRole("heading", { name: "Customers" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Customer" })).toBeVisible();
  });

  test("search input is functional", async ({ page }) => {
    await navigateTo(page, "/customers");

    const searchInput = page.getByPlaceholder("Search customers by name, phone or email...");
    await expect(searchInput).toBeVisible();
    await searchInput.fill("test");
    await expect(searchInput).toHaveValue("test");
  });

  test("add customer dialog opens and closes", async ({ page }) => {
    await navigateTo(page, "/customers");

    await page.getByRole("button", { name: "Add Customer" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Add New Customer")).toBeVisible();

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("create new customer with valid data", async ({ page }) => {
    await navigateTo(page, "/customers");

    await page.getByRole("button", { name: "Add Customer" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Customer Name").fill("E2E Test Customer");
    await dialog.getByLabel("Phone Number").fill("09123456789");
    await dialog.getByLabel("Email (Optional)").fill("e2etest@example.com");
    await dialog.getByLabel("Address").fill("123 Test Street");
    await dialog.getByLabel("City").fill("Yangon");

    await dialog.getByRole("button", { name: "Add Customer" }).click();

    await page.waitForResponse((res) => res.url().includes("customer") && res.status() < 500, {
      timeout: 15_000,
    });

    await expect(dialog).not.toBeVisible({ timeout: 10_000 });
  });

  test("create customer validation shows errors", async ({ page }) => {
    await navigateTo(page, "/customers");

    await page.getByRole("button", { name: "Add Customer" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Add Customer" }).click();

    await expect(dialog.getByText("Name is required")).toBeVisible();
  });

  test("customer detail page navigates correctly", async ({ page }) => {
    await navigateTo(page, "/customers");

    const customerCard = page.locator("[data-testid]").first();
    const hasCards = await customerCard.count();

    if (hasCards > 0) {
      await customerCard.click();
      await page.waitForLoadState("networkidle");
      await expect(page.url()).toContain("/customers/");
    }
  });
});
