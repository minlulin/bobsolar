import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('PWA Manifest', () => {
  const manifestRoutePath = path.resolve(__dirname, '../app/manifest.ts');

  it('manifest route file exists', () => {
    expect(fs.existsSync(manifestRoutePath)).toBe(true);
  });

  it('all referenced icon files exist in public/', () => {
    const expectedIcons = [
      { src: '/icons/icon-192.png', sizes: '192x192' },
      { src: '/icons/icon-512.png', sizes: '512x512' },
    ];
    for (const icon of expectedIcons) {
      const iconPath = path.resolve(__dirname, '../../public', icon.src.replace(/^\//, ''));
      expect(fs.existsSync(iconPath), `Icon not found: ${icon.src}`).toBe(true);
    }
  });

  it('has 192x192 and 512x512 icon references', () => {
    const content = fs.readFileSync(manifestRoutePath, 'utf-8');
    expect(content).toContain('192x192');
    expect(content).toContain('512x512');
    expect(content).toContain('standalone');
    expect(content).toContain('BOB Solar');
  });
});

describe('Service Worker', () => {
  const swPath = path.resolve(__dirname, '../../public/sw.js');

  it('sw.js exists in build output', () => {
    expect(fs.existsSync(swPath)).toBe(true);
  });

  it('sw.js has content', () => {
    const content = fs.readFileSync(swPath, 'utf-8');
    expect(content.length).toBeGreaterThan(0);
  });
});

describe('Static Assets', () => {
  const iconsDir = path.resolve(__dirname, '../../public/icons');
  const fontsDir = path.resolve(__dirname, '../../public/fonts');

  it('icons directory exists', () => {
    expect(fs.existsSync(iconsDir)).toBe(true);
  });

  it('fonts directory exists', () => {
    expect(fs.existsSync(fontsDir)).toBe(true);
  });

  it('has at least one icon file', () => {
    const files = fs.readdirSync(iconsDir);
    expect(files.length).toBeGreaterThan(0);
  });

  it('has at least one font file', () => {
    const files = fs.readdirSync(fontsDir);
    expect(files.length).toBeGreaterThan(0);
  });
});

describe('Build Output Check', () => {
  const nextDir = path.resolve(__dirname, '../../.next');

  it('.next directory exists (build has been run)', () => {
    expect(fs.existsSync(nextDir)).toBe(true);
  });

  it('manifest route handler exists (dynamic)', () => {
    // The manifest is a dynamic route: src/app/manifest.ts
    // It's served at /manifest.webmanifest at runtime via Next.js Route Handler
    const manifestRoute = path.resolve(__dirname, '../app/manifest.ts');
    expect(fs.existsSync(manifestRoute)).toBe(true);
  });
});