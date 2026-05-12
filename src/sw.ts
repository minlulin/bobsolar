import { defaultCache } from '@serwist/next/worker';
import { CacheFirst, Serwist, StaleWhileRevalidate } from 'serwist';
import { ExpirationPlugin } from 'serwist/expiration';

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST:
    | (string | { url: string; revision: string | null })[]
    | undefined;
};

const staticAssetCache = new CacheFirst({
  cacheName: 'bobsolar-static-assets-v1',
  plugins: [
    new ExpirationPlugin({
      maxEntries: 250,
      maxAgeSeconds: 60 * 60 * 24 * 30,
    }),
  ],
});

const nextDataCache = new StaleWhileRevalidate({
  cacheName: 'bobsolar-next-data-v1',
  plugins: [
    new ExpirationPlugin({
      maxEntries: 80,
      maxAgeSeconds: 60 * 60,
    }),
  ],
});

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST ?? [],
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    ...defaultCache,
    {
      matcher: ({ request, url }) =>
        request.method === 'GET' &&
        url.origin === self.location.origin &&
        (url.pathname.startsWith('/icons/') ||
          url.pathname.startsWith('/fonts/') ||
          url.pathname.endsWith('.css') ||
          url.pathname.endsWith('.woff2')),
      handler: staticAssetCache,
    },
    {
      matcher: ({ request, url }) =>
        request.method === 'GET' &&
        url.origin === self.location.origin &&
        url.pathname.startsWith('/_next/data/'),
      handler: nextDataCache,
    },
  ],
});

const OFFLINE_FALLBACK_URL = '/offline.html';

serwist.addEventListeners();

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(serwist.cacheNames.precache)
      .then((cache) => cache.add(OFFLINE_FALLBACK_URL)),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(OFFLINE_FALLBACK_URL);
      if (cached) return cached;
      return new Response('Offline', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
        },
      });
    }),
  );
});
