import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const appDir = path.join(process.cwd(), "src", "app", "(dashboard)");

const navigationRoutes = [
  { href: "/", routeFile: path.join(appDir, "page.tsx") },
  { href: "/customers", routeFile: path.join(appDir, "customers", "page.tsx") },
  { href: "/customers/[id]", routeFile: path.join(appDir, "customers", "[id]", "page.tsx") },
  { href: "/quotations", routeFile: path.join(appDir, "quotations", "page.tsx") },
  { href: "/quotations/new", routeFile: path.join(appDir, "quotations", "new", "page.tsx") },
  { href: "/projects", routeFile: path.join(appDir, "projects", "page.tsx") },
  { href: "/projects/new", routeFile: path.join(appDir, "projects", "new", "page.tsx") },
  { href: "/inventory", routeFile: path.join(appDir, "inventory", "page.tsx") },
  { href: "/finance", routeFile: path.join(appDir, "finance", "page.tsx") },
  { href: "/finance/expenses", routeFile: path.join(appDir, "finance", "expenses", "page.tsx") },
  { href: "/finance/ledger", routeFile: path.join(appDir, "finance", "ledger", "page.tsx") },
  { href: "/owner-portal", routeFile: path.join(appDir, "owner-portal", "page.tsx") },
  { href: "/warranty", routeFile: path.join(appDir, "warranty", "page.tsx") },
  { href: "/settings", routeFile: path.join(appDir, "settings", "page.tsx") },
] as const;

describe("dashboard navigation routes", () => {
  it("maps key sub-links to existing route files", () => {
    for (const route of navigationRoutes) {
      expect(existsSync(route.routeFile), `Missing route for ${route.href}`).toBe(true);
    }
  });
});
