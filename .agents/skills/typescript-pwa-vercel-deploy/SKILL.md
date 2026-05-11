---
name: typescript-pwa-vercel-deploy
description: >
  Strict TypeScript configuration with all compiler flags enabled and no implicit
  any allowed, PWA enablement with Serwist, and production-grade Vercel deployment
  for modern web applications.
  Enforces SSoT, tagged union types, exhaustive enums, and
  eliminates any/every implicit `any`.
---

# TypeScript PWA Vercel Deploy — Strict Mode Skill

## Purpose

This skill provides a **single source of truth (SSoT)** for:

1. **TypeScript strict-mode configuration** — All strict compiler flags enabled,
   no implicit `any`, `unknown` for validated external inputs, and exhaustive
   type-safe patterns.
2. **PWA integration** — Web app manifest, Serwist-based service worker with
   runtime caching, offline fallback, and installability.
3. **Vercel deployment** — Build pipeline, static asset handling, headers,
   rewrites, environment variable governance, and preview/changelog workflows.

### Strictness categories

- **Compiler safety**: `strict`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`.
- **Code quality**: `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`.
- **Type architecture**: tagged unions, exhaustiveness checks, enums over magic values.

---

## Enum-Driven Architecture (No Plain Strings or Numbers)

All configuration dimensions are expressed as **enumerations** to eliminate
magic values and ensure compile-time exhaustiveness checking.

```typescript
// ─── TypeScript Strictness Level ─────────────────────────────────────────────
export enum TypeScriptStrictnessLevel {
  /// All strict flags on; no implicit any.
  MAXIMUM = 'maximum',
  /// Same as MAXIMUM but with skipLibCheck: true for legacy dependencies.
  PRAGMATIC = 'pragmatic',
}

// ─── PWA Caching Strategy ────────────────────────────────────────────────────
export enum PwaCacheStrategy {
  /// Network-first, fallback to cache.
  NETWORK_FIRST = 'NetworkFirst',
  /// Cache-first, fallback to network.
  CACHE_FIRST = 'CacheFirst',
  /// Stale-while-revalidate.
  STALE_WHILE_REVALIDATE = 'StaleWhileRevalidate',
  /// Network-only (no offline).
  NETWORK_ONLY = 'NetworkOnly',
  /// Cache-only (fully offline).
  CACHE_ONLY = 'CacheOnly',
}

// ─── Vercel Deployment Environment ───────────────────────────────────────────
export enum VercelEnvironment {
  PRODUCTION = 'production',
  PREVIEW = 'preview',
  DEVELOPMENT = 'development',
}

// ─── Framework Adapter ────────────────────────────────────────────────────────
export enum FrameworkAdapter {
  NEXT_JS = 'nextjs',
  VITE = 'vite',
  PLAIN_TYPESCRIPT = 'plain-typescript',
}
```

> **Rule:** Every plain string literal or numeric literal used in configuration
> or routing **must** be replaced with an enum member. Violations are caught by
> `noUnusedLocals` + `noFallthroughCasesInSwitch` at compile time.

---

## 1. TypeScript Configuration (Strictest Possible)

### 1.1 Base `tsconfig.json` (Framework-agnostic)

```jsonc
{
  "compilerOptions": {
    // ── Language & Environment ──────────────────────────────────────────
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",

    // ── Emit ────────────────────────────────────────────────────────────
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "removeComments": false,
    "importHelpers": true,

    // ── Interop Constraints ─────────────────────────────────────────────
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "resolveJsonModule": true,

    // ── Strict Flags — ALL ENABLED ──────────────────────────────────────
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "useUnknownInCatchVariables": true,
    "alwaysStrict": true,

    // ── Additional Safety Checks ────────────────────────────────────────
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "allowUnusedLabels": false,
    "allowUnreachableCode": false,
    "exactOptionalPropertyTypes": true,

    // ── Completeness ────────────────────────────────────────────────────
    "skipLibCheck": false,
    "skipDefaultLibCheck": false
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### 1.2 Framework-Specific Extensions

#### Next.js

```jsonc
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "incremental": true,
    "noEmit": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": [
    "next-env.d.ts",
    "src/**/*.ts",
    "src/**/*.tsx",
    ".next/types/**/*.ts"
  ]
}
```

#### Vite

```jsonc
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src/**/*", "vite-env.d.ts"]
}
```

#### Plain TypeScript / React

```jsonc
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "outDir": "./dist"
  }
}
```

### 1.3 Service Worker `tsconfig.sw.json`

```jsonc
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2022", "WebWorker"],
    "types": ["@serwist/next/worker"],
    "jsx": "react-jsx",
    "incremental": true,
    "noEmit": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src/sw.ts"],
  "exclude": ["node_modules"]
}
```

---

## 2. Type Patterns (Zero `any`, Zero Magic Values)

### 2.1 Tagged Unions Over Plain-String Literals

```typescript
// ─── BAD ──────────────────────────────────────────────────────────────────────
type Route = string; // any string; fragile
function navigate(path: Route): void { /* … */ }

// ─── GOOD ─────────────────────────────────────────────────────────────────────
enum AppRoute {
  HOME = '/',
  DASHBOARD = '/dashboard',
  SETTINGS = '/settings',
  /** Catch‑all for 404 handling */
  NOT_FOUND = '/404',
}

function navigate(route: AppRoute): void {
  switch (route) {
    case AppRoute.HOME:       window.location.href = AppRoute.HOME;       break;
    case AppRoute.DASHBOARD:  window.location.href = AppRoute.DASHBOARD;  break;
    case AppRoute.SETTINGS:   window.location.href = AppRoute.SETTINGS;   break;
    case AppRoute.NOT_FOUND:  window.location.href = AppRoute.NOT_FOUND;  break;
    default:
      // Exhaustiveness check — compile error if a new member is added
      // without a corresponding case branch.
      const _exhaustive: never = route;
      throw new Error(`Unhandled route: ${_exhaustive satisfies never}`);
  }
}
```

### 2.2 Discriminated Union for API Responses

```typescript
enum ApiResponseKind {
  SUCCESS = 'success',
  ERROR = 'error',
  LOADING = 'loading',
}

interface ApiSuccess<T> {
  readonly kind: ApiResponseKind.SUCCESS;
  readonly data: T;
  readonly timestamp: Date;
}

interface ApiError {
  readonly kind: ApiResponseKind.ERROR;
  readonly error: Error;
  readonly code: number;
}

interface ApiLoading {
  readonly kind: ApiResponseKind.LOADING;
}

type ApiResponse<T> = ApiSuccess<T> | ApiError | ApiLoading;

// Usage — exhaustive narrowing with no `any`:
function handleResponse<T>(response: ApiResponse<T>): string {
  switch (response.kind) {
    case ApiResponseKind.SUCCESS:
      return `OK: ${JSON.stringify(response.data)}`;
    case ApiResponseKind.ERROR:
      return `Error ${response.code}: ${response.error.message}`;
    case ApiResponseKind.LOADING:
      return 'Loading…';
    default:
      const _never: never = response;
      throw new Error(`Unexpected kind: ${_never satisfies never}`);
  }
}
```

### 2.3 Unknown Over Any for External Data

```typescript
function isStringArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.every((item): item is string => typeof item === 'string')
  );
}

function processExternalPayload(payload: unknown): void {
  // ❌ const data: any = payload;
  // ❌ const data: string[] = payload as string[];

  if (!isStringArray(payload)) {
    throw new TypeError('Expected string array');
  }

  // ✅ payload is now `readonly string[]`
  for (const item of payload) {
    console.log(item.toUpperCase());
  }
}
```

### 2.4 Catch-Clause Typing

```typescript
try {
  await riskyOperation();
} catch (error: unknown) {
  // error is `unknown` (requires useUnknownInCatchVariables)
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error('Non‑Error thrown:', error);
  }
}
```

---

## 3. PWA Integration (Serwist + Web Manifest)

### 3.1 Web Application Manifest

Place at `public/manifest.webmanifest`:

```jsonc
{
  "name": "Your App Name",
  "short_name": "App",
  "description": "Progressive web application with offline support",
  "start_url": ".",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "categories": ["productivity", "utilities"],
  "lang": "en-US",
  "orientation": "any"
}
```

### 3.2 Service Worker (`src/sw.ts`)

```typescript
import { defaultCache } from '@serwist/next/worker';
import { Serwist, type PrecacheEntry } from 'serwist';

declare const self: ServiceWorkerGlobalScope & {
  readonly __SW_MANIFEST: PrecacheEntry[] | undefined;
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST ?? [],
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
```

### 3.3 PWA Caching Strategy Enum Usage

```typescript
import { PwaCacheStrategy } from './enums';

interface RuntimeCacheRule {
  readonly urlPattern: RegExp;
  readonly strategy: PwaCacheStrategy;
  readonly maxEntries?: number;
  readonly maxAgeSeconds?: number;
}

const API_CACHE_RULES: readonly RuntimeCacheRule[] = [
  {
    urlPattern: /^https?:\/\/api\.example\.com\/.*/,
    strategy: PwaCacheStrategy.NETWORK_FIRST,
    maxEntries: 50,
    maxAgeSeconds: 300,
  },
  {
    urlPattern: /\.(png|jpg|svg|webp)$/,
    strategy: PwaCacheStrategy.CACHE_FIRST,
    maxEntries: 200,
    maxAgeSeconds: 86_400, // 24 hours
  },
] as const satisfies readonly RuntimeCacheRule[];
```

### 3.4 Offline Fallback Page

Serve `public/offline.html` as a fallback for navigation requests when
offline. Configure your service worker to return this page for any
navigation that fails:

```typescript
// Inside service worker `fetch` handler:
self.addEventListener('fetch', (event: FetchEvent) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(
        () => caches.match('/offline.html') as Promise<Response>,
      ),
    );
  }
});
```

### 3.5 PWA Icons

Use a tool such as [PWABuilder Image
Generator](https://github.com/pwa-builder/PWABuilder/tree/main/image-generator)
or `@vite-pwa/assets-generator` to produce all required icon sizes:

```
public/icons/
├── icon-72x72.png
├── icon-96x96.png
├── icon-128x128.png
├── icon-144x144.png
├── icon-152x152.png
├── icon-192x192.png
├── icon-384x384.png
└── icon-512x512.png
```

---

## 4. Vercel Deployment

### 4.1 `vercel.json` (SSoT for Hosting Configuration)

```jsonc
{
  // ── Build & Install ───────────────────────────────────────────────────
  "buildCommand": "pnpm typecheck && pnpm lint && pnpm build",
  "installCommand": "pnpm install --frozen-lockfile",

  // ── Output ────────────────────────────────────────────────────────────
  "outputDirectory": ".next",        // Next.js; use "dist" for Vite
  "devCommand": "pnpm dev",

  // ── Framework ─────────────────────────────────────────────────────────
  "framework": "nextjs",             // or "vite", null for static

  // ── Routing & Headers ─────────────────────────────────────────────────
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options",        "value": "DENY" },
        { "key": "X-XSS-Protection",       "value": "1; mode=block" },
        { "key": "Referrer-Policy",        "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy",     "value": "camera=(), microphone=(), geolocation=()" }
      ]
    },
    {
      "source": "/sw.js",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" },
        { "key": "Service-Worker-Allowed", "value": "/" }
      ]
    },
    {
      "source": "/manifest.webmanifest",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" },
        { "key": "Content-Type",  "value": "application/manifest+json" }
      ]
    }
  ],

  // ── Redirects & Rewrites ──────────────────────────────────────────────
  "redirects": [
    {
      "source": "/old-path",
      "destination": "/new-path",
      "permanent": true
    }
  ],

  // ── Environment Variable Governance ───────────────────────────────────
  "env": {
    "NEXT_PUBLIC_APP_URL": "@app_url",
    "SENTRY_DSN": "@sentry_dsn"
  },

  // ── Regions ───────────────────────────────────────────────────────────
  "regions": ["iad1"],

  // ── Functions (Serverless) ────────────────────────────────────────────
  "functions": {
    "api/**/*.ts": { "memory": 1024, "maxDuration": 30 }
  }
}
```

### 4.2 Environment Variables (No Plain Secrets in Code)

| Variable                    | Scope            | Description                          |
|-----------------------------|------------------|--------------------------------------|
| `NEXT_PUBLIC_APP_URL`       | Public / Next.js | Canonical URL of the deployed app.   |
| `SENTRY_DSN`                | Private          | Sentry error tracking DSN.           |
| `DATABASE_URL`              | Private          | Connection string for the database.  |

All secrets **must** be stored in Vercel Project Environment Variables, not
in `.env` files committed to the repository.

### 4.3 CI/CD Pipeline Scripts (`package.json`)

```jsonc
{
  "scripts": {
    // ── Development ─────────────────────────────────────────────────────
    "dev": "next dev",

    // ── Quality Gates ───────────────────────────────────────────────────
    "typecheck": "tsc --noEmit",
    "typecheck:watch": "tsc --noEmit --watch",
    "lint": "eslint src",
    "lint:fix": "eslint src --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",

    // ── Build ───────────────────────────────────────────────────────────
    "build": "next build",

    // ── Green Pipeline ──────────────────────────────────────────────────
    "green:code": "pnpm typecheck && pnpm lint && pnpm format:check && pnpm test",
    "green": "pnpm green:code && pnpm build"
  }
}
```

### 4.4 Vercel CLI Deployment Commands

```bash
# Install the CLI
pnpm add -g vercel

# Login
vercel login

# Link existing project
vercel link

# Deploy preview
vercel

# Deploy to production
vercel --prod

# Inspect environment variables
vercel env pull .env.local

# List deployments
vercel list

# Promote preview to production
vercel promote <deployment-url>
```

### 4.5 Preview Deployments & Changelog

Every push to a non-production branch creates a **preview deployment** with
a unique URL. Use `vercel.json` redirects to point changelog routes:

```jsonc
{
  "redirects": [
    {
      "source": "/changelog",
      "destination": "https://github.com/owner/repo/releases",
      "permanent": false
    }
  ]
}
```

---

## 5. Framework-Specific Guidance

### 5.1 Next.js

- Use `@serwist/next` for service worker integration.
- Place PWA icons in `public/icons/`.
- Configure `next.config.ts` to output `standalone` for Node.js server
  deployments on Vercel Pro/Enterprise.

### 5.2 Vite

- Use `vite-plugin-pwa` (`@vite-pwa/plugin`) with `injectRegister: 'auto'`.
- Output to `dist/` and set `"outputDirectory": "dist"` in `vercel.json`.
- Use `import.meta.env` for environment variables (Vite convention).

### 5.3 Plain TypeScript / React (No Framework)

- Bundle with `esbuild` or `tsup` and output a single `index.html` + JS bundle.
- Set `"outputDirectory": "dist"` in `vercel.json`.
- Register the service worker manually:

```typescript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((reg: ServiceWorkerRegistration) => {
      console.log('SW registered:', reg.scope);
    })
    .catch((error: unknown) => {
      if (error instanceof Error) {
        console.error('SW registration failed:', error.message);
      }
    });
}
```

---

## 6. Code Review Checklist

- [ ] **No `any` types** anywhere in source (enforced by `noImplicitAny: true` +
      ESLint `@typescript-eslint/no-explicit-any: 'error'`).
- [ ] **All functions have explicit return types** (enforced by
      `explicit-function-return-type` rule).
- [ ] **All parameters have explicit types** — no inferred `parameter` of type
      `any`.
- [ ] **No plain string or numeric literals** used as identifiers or routing
      values — every literal is defined in an enum.
- [ ] **`null`/`undefined` handling** is explicit via `strictNullChecks` and
      type narrowing.
- [ ] **Array access** is guarded for `undefined` (`noUncheckedIndexedAccess`).
- [ ] **Catch clauses** use `error: unknown` and narrow with
      `instanceof Error`.
- [ ] **No `// @ts-ignore`** or `// @ts-expect-error` without a documented
      justification.
- [ ] **Discriminated unions** used instead of `any`-carrying generic objects.
- [ ] **PWA manifest** is present at `public/manifest.webmanifest` with valid
      icons.
- [ ] **Service worker** registers successfully on localhost and in preview
      deployments.
- [ ] **Vercel headers** include security headers (`X-Content-Type-Options`,
      `X-Frame-Options`, etc.).
- [ ] **Environment variables** are synced with Vercel project settings, not
      hardcoded.
- [ ] **Build pipeline** succeeds: `pnpm green` passes cleanly.

---

## 7. Related Skills

| Skill                         | Purpose                                   |
|-------------------------------|-------------------------------------------|
| `neon-postgres`               | Neon Serverless Postgres database setup.  |
| `coding-standards`            | Baseline naming, readability, immutability. |
| `typescript-pwa-vercel-deploy`| (this skill)                              |

---

## 8. Recipe Summary

```
User Request
    │
    ▼
[1] Identify Framework Adapter (Next.js / Vite / Plain)
    │
    ▼
[2] Generate strict tsconfig.json (base + framework)
    │
    ▼
[3] Eliminate `any` → tagged unions / discriminated unions / enums
    │
    ▼
[4] Add PWA: manifest.webmanifest, icons, sw.ts
    │
    ▼
[5] Configure Vercel: vercel.json → headers, caching, env
    │
    ▼
[6] Verify: pnpm green && vercel deploy
    │
    ▼
[Done] Strict TypeScript PWA on Vercel