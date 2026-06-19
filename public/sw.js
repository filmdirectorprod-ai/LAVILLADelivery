/* La Villa PWA service worker.
   Goal: make the 3 apps installable and resilient, WITHOUT ever serving stale app
   code. Strategy:
   - Navigations (HTML): network-first → fall back to cache only when offline.
   - Same-origin static assets (icons, images, _next static): cache-first.
   - Never cache Supabase / API / auth callbacks (always go to network).
   Bump CACHE_VERSION to force-refresh clients. */
const CACHE_VERSION = 'lavilla-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;

self.addEventListener('install', (event) => {
  // Activate the new SW immediately on next load.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/brand/') ||
    /\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$/i.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Only handle our own origin; let Supabase / external calls pass straight through.
  if (url.origin !== self.location.origin) return;
  // Never intercept API / auth — these must always hit the network fresh.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/callback')) return;

  // HTML navigations: network-first (fresh app), cache fallback when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(STATIC_CACHE);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match(request);
          return cached || caches.match('/');
        }
      })(),
    );
    return;
  }

  // Static assets: cache-first.
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const fresh = await fetch(request);
        const cache = await caches.open(STATIC_CACHE);
        cache.put(request, fresh.clone());
        return fresh;
      })(),
    );
  }
});
