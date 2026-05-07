/* ═══════════════════════════════════════════════════════════════
   SIGNAL TOOLKIT — SERVICE WORKER
   True Offline PWA — iOS Install Compatible
   Version: 2026.05.07-v2
   ═══════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'signal-toolkit-v2-20260507';
const ASSETS = [
  './',
  './index.html',
  './service-worker.js'
];

/* ── INSTALL: Cache core assets ── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS);
      })
      .then(() => {
        return self.skipWaiting();
      })
      .catch((err) => {
        console.warn('[Signal SW] Cache install failed:', err);
      })
  );
});

/* ── ACTIVATE: Clean old caches ── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

/* ── FETCH: Cache-first strategy with network fallback ── */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  /* Skip non-GET requests */
  if (request.method !== 'GET') return;

  /* Skip chrome-extension and other non-http schemes */
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        /* Return cached version immediately if available */
        if (cachedResponse) {
          /* Refresh cache in background (stale-while-revalidate) */
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.ok) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, networkResponse.clone());
                });
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        /* Not in cache — fetch from network */
        return fetch(request)
          .then((networkResponse) => {
            if (!networkResponse || !networkResponse.ok) {
              return networkResponse;
            }
            /* Cache the new response */
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, networkResponse.clone());
            });
            return networkResponse;
          })
          .catch(() => {
            /* Complete offline — return fallback */
            if (request.mode === 'navigate') {
              return caches.match('./index.html');
            }
            return new Response('Offline — resource unavailable', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

/* ── BACKGROUND SYNC: Queue actions for when online returns ── */
self.addEventListener('sync', (event) => {
  if (event.tag === 'signal-sync') {
    event.waitUntil(Promise.resolve());
  }
});

/* ── PUSH: Handle push notifications (future expansion) ── */
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'Signal Toolkit', {
        body: data.body || 'Update available',
        icon: './icon-192.png',
        badge: './icon-72.png',
        data: data.url || './'
      })
    );
  }
});

/* ── NOTIFICATION CLICK ── */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || './')
  );
});

console.log('[Signal SW] Service Worker loaded v2');
