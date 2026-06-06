import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { config, proxy } from "@/proxy";

/**
 * Build a NextRequest for an absolute URL. We use a real http://localhost
 * base so `request.nextUrl` is a NextURL (with `pathname`, `searchParams`).
 * `Request`/`Response`/`URL` are global in Node 22+.
 */
function makeRequest(pathname: string, cookies: Record<string, string> = {}): NextRequest {
  const url = new URL(pathname, "http://localhost:3000");
  const headers = new Headers();
  for (const [name, value] of Object.entries(cookies)) {
    headers.set("cookie", `${name}=${value}`);
  }
  return new NextRequest(url, { headers });
}

function getLocation(response: Response): string {
  return response.headers.get("location") ?? "";
}

describe("proxy route check", () => {
  describe("dashboard path requires session cookie", () => {
    const dashboardPaths = [
      "/customers",
      "/customers/abc-123",
      "/finance",
      "/finance/capital-events",
      "/inventory",
      "/owner-portal",
      "/projects",
      "/projects/abc",
      "/purchases",
      "/quotations",
      "/settings",
      "/settings/profile",
      "/suppliers",
      "/vouchers",
      "/warranty",
    ];

    for (const path of dashboardPaths) {
      it(`redirects ${path} → /login (no cookie)`, () => {
        const response = proxy(makeRequest(path));
        expect(response.status).toBe(307);
        const location = getLocation(response);
        expect(location).toContain("/login");
        expect(new URL(location, "http://x").searchParams.get("next")).toBe(path);
      });

      it(`passes through ${path} when session cookie present`, () => {
        const response = proxy(makeRequest(path, { [SESSION_COOKIE_NAME]: "sealed-blob" }));
        expect(response.status).toBe(200);
        expect(getLocation(response)).toBe("");
      });
    }
  });

  describe("auth routes redirect away when session cookie present", () => {
    it("/login → / (with cookie)", () => {
      const response = proxy(makeRequest("/login", { [SESSION_COOKIE_NAME]: "sealed-blob" }));
      expect(response.status).toBe(307);
      expect(getLocation(response)).toBe("http://localhost:3000/");
    });

    it("/login passes through (no cookie)", () => {
      const response = proxy(makeRequest("/login"));
      expect(response.status).toBe(200);
      expect(getLocation(response)).toBe("");
    });
  });

  describe("public paths pass through", () => {
    const publicPaths = [
      "/",
      "/favicon.ico",
      "/_next/static/chunks/foo.js",
      "/_next/image?url=foo",
      "/robots.txt",
      "/sitemap.xml",
      "/api/anything",
      "/api/auth/login",
      "/api/backup/download",
      "/_next/data/abc/index.json",
    ];

    for (const path of publicPaths) {
      it(`passes through ${path} (no cookie)`, () => {
        const response = proxy(makeRequest(path));
        expect(response.status).toBe(200);
        expect(getLocation(response)).toBe("");
      });
    }
  });

  describe("path matching is exact-prefix", () => {
    it("does not match /settings-but-not-really (prefix must be segment)", () => {
      const response = proxy(makeRequest("/settings-but-not-really"));
      expect(response.status).toBe(200);
      expect(getLocation(response)).toBe("");
    });
  });
});

describe("proxy matcher config", () => {
  it("excludes /api/*", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        url: "http://localhost:3000/api/anything",
      }),
    ).toBe(false);
  });

  it("excludes _next/static", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        url: "http://localhost:3000/_next/static/chunks/foo.js",
      }),
    ).toBe(false);
  });

  it("excludes _next/image", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        url: "http://localhost:3000/_next/image",
      }),
    ).toBe(false);
  });

  it("excludes favicon.ico", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        url: "http://localhost:3000/favicon.ico",
      }),
    ).toBe(false);
  });

  it("excludes sitemap.xml and robots.txt", () => {
    expect(unstable_doesMiddlewareMatch({ config, url: "http://localhost:3000/sitemap.xml" })).toBe(
      false,
    );
    expect(unstable_doesMiddlewareMatch({ config, url: "http://localhost:3000/robots.txt" })).toBe(
      false,
    );
  });

  it("excludes common static asset extensions", () => {
    for (const asset of ["/logo.png", "/icon.svg", "/styles.css", "/font.woff2"]) {
      expect(unstable_doesMiddlewareMatch({ config, url: `http://localhost:3000${asset}` })).toBe(
        false,
      );
    }
  });

  it("matches dashboard routes", () => {
    expect(unstable_doesMiddlewareMatch({ config, url: "http://localhost:3000/customers" })).toBe(
      true,
    );
    expect(unstable_doesMiddlewareMatch({ config, url: "http://localhost:3000/finance" })).toBe(
      true,
    );
    expect(
      unstable_doesMiddlewareMatch({ config, url: "http://localhost:3000/settings/profile" }),
    ).toBe(true);
  });

  it("matches auth route /login", () => {
    expect(unstable_doesMiddlewareMatch({ config, url: "http://localhost:3000/login" })).toBe(true);
  });

  it("matches root /", () => {
    expect(unstable_doesMiddlewareMatch({ config, url: "http://localhost:3000/" })).toBe(true);
  });
});
