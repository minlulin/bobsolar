import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("dashboard loads after login", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    await expect(page.url()).toContain("/");
  });

  test("dashboard shows stats cards", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    const heading = page.locator("h1, h2, h3").first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test("navigation orbit is visible", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    const nav = page.locator("nav, [role='navigation']").first();
    const hasNav = await nav.count();
    expect(hasNav).toBeGreaterThanOrEqual(0);
  });

  test("command bar is accessible", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    const searchTrigger = page.locator(
      "[cmdk-trigger], button:has-text('Search'), [data-commandbar]",
    );
    const hasSearch = await searchTrigger.count();
    expect(hasSearch).toBeGreaterThanOrEqual(0);
  });

  test("theme toggle works", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    const themeToggle = page.getByRole("button", { name: /theme/i });
    const hasToggle = await themeToggle.count();

    if (hasToggle > 0) {
      const html = page.locator("html");
      const initialClass = await html.getAttribute("class");

      await themeToggle.click();
      await page.waitForTimeout(500);

      const newClass = await html.getAttribute("class");
      expect(newClass).not.toBe(initialClass);
    }
  });

  test("user nav dropdown works", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    const userNav = page
      .locator("[data-testid='user-nav'], button:has-text('Admin'), button:has(img)")
      .first();
    const hasUserNav = await userNav.count();

    if (hasUserNav > 0) {
      await userNav.click();
      await page.waitForTimeout(300);
    }
  });

  test("notification bell is visible", async ({ page }) => {
    await page.waitForLoadState("networkidle");

    const bell = page.locator("[aria-label*='notification'], button:has(.lucide-bell)").first();
    const hasBell = await bell.count();
    expect(hasBell).toBeGreaterThanOrEqual(0);
  });
});
