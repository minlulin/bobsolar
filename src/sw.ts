import { defaultCache } from "@serwist/next/worker";
import { CacheFirst, cacheNames, ExpirationPlugin, Serwist, StaleWhileRevalidate } from "serwist";

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (string | { url: string; revision: string | null })[] | undefined;
};

interface FetchEvent extends Event {
  readonly request: Request;
  respondWith(response: Response | Promise<Response>): void;
}

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
});

const offlineFallback = "/offline.html";

serwist.addEventListeners();

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheNames.precache).then((cache) => cache.add(offlineFallback)));
});

self.addEventListener("fetch", (event: FetchEvent) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(offlineFallback);
      if (cached) return cached;
      return new Response("Offline", {
        status: 503,
        statusText: "Service Unavailable",
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }),
  );
});
