import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

clientsClaim();

// Inject the precache manifest (filled in by vite-plugin-pwa at build time)
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// SPA navigation: serve index.html from cache for all same-origin navigation requests
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({ cacheName: 'pages-cache' })
);

// Cache the resources API responses
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/resources'),
  new CacheFirst({ cacheName: 'cms-resources-cache' })
);

// Fallback: when any navigation request fails (e.g. offline + not cached), serve offline.html
setCatchHandler(async ({ request }) => {
  if (request.destination === 'document') {
    const offlinePage = await caches.match('/offline.html');
    return offlinePage ?? Response.error();
  }
  return Response.error();
});
