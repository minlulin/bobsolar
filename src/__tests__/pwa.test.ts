import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("PWA Manifest", () => {
  const manifestRoutePath = path.resolve(__dirname, "../app/manifest.ts");

  it("manifest route file exists", () => {
    expect(fs.existsSync(manifestRoutePath)).toBe(true);
  });

  it("all referenced icon files exist in public/", () => {
    const expectedIcons = [
      { src: "/icons/icon-192.png", sizes: "192x192" },
      { src: "/icons/icon-512.png", sizes: "512x512" },
    ];
    for (const icon of expectedIcons) {
      const iconPath = path.resolve(__dirname, "../../public", icon.src.replace(/^\//, ""));
      expect(fs.existsSync(iconPath), `Icon not found: ${icon.src}`).toBe(true);
    }
  });

  it("has installable manifest metadata", () => {
    const content = fs.readFileSync(manifestRoutePath, "utf-8");
    expect(content).toContain("192x192");
    expect(content).toContain("512x512");
    expect(content).toContain("standalone");
    expect(content).toContain("BOB Solar");
  });
});

describe("Service Worker Source", () => {
  const swPath = path.resolve(__dirname, "../../src/sw.ts");

  it("service worker source exists", () => {
    expect(fs.existsSync(swPath)).toBe(true);
  });

  it("defines offline fallback and runtime caching rules", () => {
    const content = fs.readFileSync(swPath, "utf-8");
    expect(content).toContain("offlineFallback");
    expect(content).toContain("runtimeCaching");
    expect(content).toContain("CacheFirst");
    expect(content).toContain("bobsolar-static-assets-v1");
    expect(content).toContain("bobsolar-next-data-v1");
  });
});

describe("Static Assets", () => {
  const iconsDir = path.resolve(__dirname, "../../public/icons");
  const fontsDir = path.resolve(__dirname, "../../public/fonts");
  const offlineFallbackPath = path.resolve(__dirname, "../../public/offline.html");

  it("icons directory exists", () => {
    expect(fs.existsSync(iconsDir)).toBe(true);
  });

  it("fonts directory exists", () => {
    expect(fs.existsSync(fontsDir)).toBe(true);
  });

  it("has at least one icon file", () => {
    const files = fs.readdirSync(iconsDir);
    expect(files.length).toBeGreaterThan(0);
  });
  it("offline fallback file exists", () => {
    expect(fs.existsSync(offlineFallbackPath)).toBe(true);
  });

  it("has at least one font file", () => {
    const files = fs.readdirSync(fontsDir);
    expect(files.length).toBeGreaterThan(0);
  });

  it("offline fallback file exists", () => {
    expect(fs.existsSync(offlineFallbackPath)).toBe(true);
  });
});
describe("Build Source Check", () => {
  it("manifest route handler source file exists", () => {
    const manifestRoute = path.resolve(__dirname, "../app/manifest.ts");
    expect(fs.existsSync(manifestRoute)).toBe(true);
  });
});
