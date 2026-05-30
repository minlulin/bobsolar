import type { Page } from "@playwright/test";

const BASE_URL = process.env["BASE_URL"] ?? "http://localhost:3000";

export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Username").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.waitForURL("**/(dashboard)**", { timeout: 15_000 });
}

export async function loginAsAdmin(page: Page): Promise<void> {
  const email = process.env["SEED_ADMIN_EMAIL"] ?? "admin";
  const password = process.env["SEED_ADMIN_PASSWORD"] ?? "admin123456!@";
  await login(page, email, password);
}

export async function navigateTo(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}${path}`);
  await page.waitForLoadState("networkidle");
}

export async function waitForToast(page: Page, text?: string): Promise<void> {
  const toast = page.locator("[data-sonner-toast]");
  await toast.first().waitFor({ state: "visible", timeout: 10_000 });
  if (text) {
    await toast.first().filter({ hasText: text }).waitFor({ state: "visible", timeout: 5_000 });
  }
}
