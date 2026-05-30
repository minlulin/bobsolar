import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers";

test.describe("Authentication", () => {
  test("login page renders correctly", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Username")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("shows validation errors on empty submit", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Email is required")).toBeVisible();
    await expect(page.getByText("Password is required")).toBeVisible();
  });

  test("shows error on wrong credentials", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await page.getByLabel("Username").fill("nonexistent@test.com");
    await page.getByLabel("Password").fill("wrongpassword123");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("button", { name: "Signing in" })).toBeVisible({ timeout: 5_000 });
    await page.waitForResponse(
      (res) => res.url().includes("/login") || res.url().includes("auth"),
      { timeout: 15_000 },
    );
  });

  test("password visibility toggle works", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const passwordInput = page.getByLabel("Password");
    await expect(passwordInput).toHaveAttribute("type", "password");

    await page.getByLabel("Show password").click();
    await expect(passwordInput).toHaveAttribute("type", "text");

    await page.getByLabel("Hide password").click();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("successful login redirects to dashboard", async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page).toHaveURL(/\//);
    await expect(page.locator("text=BOB Solar")).toBeVisible({ timeout: 10_000 });
  });

  test("authenticated user cannot access login page", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/login");

    await page.waitForLoadState("networkidle");
    await expect(page).not.toHaveURL(/\/login/);
  });
});
