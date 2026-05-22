import { defaultCache } from "@serwist/next/worker";
import { CacheFirst, ExpirationPlugin, Serwist, StaleWhileRevalidate } from "serwist";

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (string | { url: string; revision: string | null })[] | undefined;
};

const staticAssetCache = new CacheFirst({
  cacheName: "bobsolar-static-assets-v1",
  plugins: [
    new ExpirationPlugin({
      maxEntries: 250,
      maxAgeSeconds: 60 * 60 * 24 * 30,
    }),
  ],
});

const nextDataCache = new StaleWhileRevalidate({
  cacheName: "bobsolar-next-data-v1",
  plugins: [
    new ExpirationPlugin({
      maxEntries: 80,
      maxAgeSeconds: 60 * 60,
    }),
  ],
});

const offlineFallback = "/offline.html";

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST ?? [],
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    ...defaultCache,
    {
      matcher: ({ request, url }: { request: Request; url: URL }): boolean =>
        request.method === "GET" &&
        url.origin === self.location.origin &&
        (url.pathname.startsWith("/icons/") ||
          url.pathname.startsWith("/fonts/") ||
          url.pathname.endsWith(".css") ||
          url.pathname.endsWith(".woff2")),
      handler: staticAssetCache,
    },
    {
      matcher: ({ request, url }: { request: Request; url: URL }): boolean =>
        request.method === "GET" &&
        url.origin === self.location.origin &&
        url.pathname.startsWith("/_next/data/"),
      handler: nextDataCache,
    },
  ],
  fallbacks: {
    entries: [
      {
        url: offlineFallback,
        matcher({ request }) {
          return request.mode === "navigate";
        },
      },
    ],
  },
});

serwist.addEventListeners();
