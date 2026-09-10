/* La Villa PWA service worker.
   Goal: make the 3 apps installable and resilient, WITHOUT ever serving stale app
   code. Strategy:
   - Navigations (HTML): network-first → fall back to cache only when offline.
   - Same-origin static assets (icons, images, _next static): cache-first.
   - Never cache Supabase / API / auth callbacks (always go to network).
   - Redirected navigations (auth middleware → /onboarding, /admin, …) are rebuilt
     into a plain response: a Response with `redirected === true` cannot be returned
     to a navigation — the browser fails it and shows a BLANK page.
   Bump CACHE_VERSION to force-refresh clients. */
const CACHE_VERSION = 'lavilla-v5';
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
          // If the fetch followed a redirect (the auth middleware sends an
          // unauthenticated visitor to /onboarding, or a signed-in user from a
          // sign-in page to their surface), `fresh.redirected` is true. Returning
          // such a response to a NAVIGATION makes the browser fail the load and
          // show a blank page — which is exactly what every installed app hit,
          // because each start_url redirects in a common auth state. Rebuild it
          // into a plain response (clears the flag) and don't cache redirects.
          if (fresh.redirected) {
            const headers = new Headers(fresh.headers);
            headers.delete('content-encoding'); // body below is already decoded
            headers.delete('content-length');
            const body = await fresh.arrayBuffer();
            return new Response(body, { status: fresh.status, statusText: fresh.statusText, headers });
          }
          const cache = await caches.open(STATIC_CACHE);
          // Never let a cache write break the navigation (e.g. Vary: *).
          cache.put(request, fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          const cached = await caches.match(request);
          return cached || (await caches.match('/')) || Response.error();
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

/* ---- Web Push ---- */
function targetUrl(d) {
  if (d && d.kind === 'support_staff') return '/admin/support'; // driver wrote → gérant
  if (d && d.kind === 'support_driver') return '/driver/support'; // gérant replied → livreur
  if (!d || !d.order_id) return '/';
  if (d.kind === 'call') return '/call/' + d.order_id;
  if (d.kind === 'message') return '/chat/' + d.order_id;
  return '/tracking/' + d.order_id; // order status → customer tracking
}

self.addEventListener('push', (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = { body: event.data ? event.data.text() : '' };
  }
  const title = d.title || 'La Villa';
  const options = {
    body: d.body || '',
    icon: '/icons/client-192.png',
    badge: '/icons/client-192.png',
    data: { url: targetUrl(d), kind: d.kind, order_id: d.order_id },
    vibrate: d.kind === 'call' ? [120, 60, 120, 60, 120] : [80, 40, 80],
    tag: d.kind === 'call' ? 'lv-call' : undefined,
    renotify: d.kind === 'call' || undefined,
    requireInteraction: d.kind === 'call' || undefined,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const d = event.notification.data || {};
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (all.length) {
        const c = all[0];
        // Route inside the already-installed app, by its role prefix.
        let path = d.url || '/';
        const isSupport = d.kind === 'support_staff' || d.kind === 'support_driver';
        try {
          const p = new URL(c.url).pathname;
          if (isSupport) path = d.url; // support already targets the right section
          else if (p.startsWith('/admin')) path = '/admin/orders';
          else if (p.startsWith('/driver')) path = d.order_id ? '/driver/order/' + d.order_id : '/driver';
        } catch {
          /* ignore */
        }
        try {
          await c.navigate(path);
        } catch {
          /* navigation may be blocked — focus anyway */
        }
        return c.focus();
      }
      return self.clients.openWindow(d.url || '/');
    })(),
  );
});
