import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for CSRF protection middleware.
 */

describe("CSRF protection", () => {
  describe("withCsrf", () => {
    beforeEach(() => {
      vi.resetModules();
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.resetModules();
    });

    it("allows GET requests without origin check", async () => {
      const { withCsrf } = await import("./csrf");
      const handler = vi.fn(async () => new Response("ok"));
      const wrapped = withCsrf(handler);

      const req = new NextRequest("http://localhost/api/chat", {
        method: "GET",
      });

      const response = await wrapped(req);
      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalled();
    });

    it("allows HEAD requests without origin check", async () => {
      const { withCsrf } = await import("./csrf");
      const handler = vi.fn(async () => new Response("ok"));
      const wrapped = withCsrf(handler);

      const req = new NextRequest("http://localhost/api/chat", {
        method: "HEAD",
      });

      const response = await wrapped(req);
      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalled();
    });

    it("allows OPTIONS requests without origin check", async () => {
      const { withCsrf } = await import("./csrf");
      const handler = vi.fn(async () => new Response("ok"));
      const wrapped = withCsrf(handler);

      const req = new NextRequest("http://localhost/api/chat", {
        method: "OPTIONS",
      });

      const response = await wrapped(req);
      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalled();
    });

    it("skips origin check in development for POST", async () => {
      vi.stubEnv("NODE_ENV", "development");

      const { withCsrf } = await import("./csrf");
      const handler = vi.fn(async () => new Response("ok"));
      const wrapped = withCsrf(handler);

      const req = new NextRequest("http://localhost/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ test: true }),
      });

      const response = await wrapped(req);
      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalled();
    });

    it("blocks POST from different origin in production", async () => {
      vi.stubEnv("NODE_ENV", "production");

      const { withCsrf } = await import("./csrf");
      const handler = vi.fn(async () => new Response("ok"));
      const wrapped = withCsrf(handler);

      const req = new NextRequest("https://bobsolar.com/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.com",
          host: "bobsolar.com",
        },
        body: JSON.stringify({ test: true }),
      });

      const response = await wrapped(req);
      expect(response.status).toBe(403);
      expect(handler).not.toHaveBeenCalled();
    });

    it("allows POST from same origin in production", async () => {
      vi.stubEnv("NODE_ENV", "production");

      const { withCsrf } = await import("./csrf");
      const handler = vi.fn(async () => new Response("ok"));
      const wrapped = withCsrf(handler);

      const req = new NextRequest("https://bobsolar.com/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://bobsolar.com",
          host: "bobsolar.com",
        },
        body: JSON.stringify({ test: true }),
      });

      const response = await wrapped(req);
      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalled();
    });

    it("falls back to Referer header when Origin is missing", async () => {
      vi.stubEnv("NODE_ENV", "production");

      const { withCsrf } = await import("./csrf");
      const handler = vi.fn(async () => new Response("ok"));
      const wrapped = withCsrf(handler);

      const req = new NextRequest("https://bobsolar.com/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          referer: "https://evil.com/attack",
          host: "bobsolar.com",
        },
        body: JSON.stringify({ test: true }),
      });

      const response = await wrapped(req);
      expect(response.status).toBe(403);
      expect(handler).not.toHaveBeenCalled();
    });

    it("blocks POST with no origin or referer header", async () => {
      vi.stubEnv("NODE_ENV", "production");

      const { withCsrf } = await import("./csrf");
      const handler = vi.fn(async () => new Response("ok"));
      const wrapped = withCsrf(handler);

      const req = new NextRequest("https://bobsolar.com/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          host: "bobsolar.com",
        },
        body: JSON.stringify({ test: true }),
      });

      const response = await wrapped(req);
      expect(response.status).toBe(403);
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
