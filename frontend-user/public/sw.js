// VexaTrade user PWA service worker
// Keep the shell available offline without allowing stale HTML to pin an old
// authenticated application build. API and upload traffic is never intercepted.
const CACHE_NAME = 'vexatrade-v4';
const OFFLINE_URL = '/offline.html';
const STATIC_ASSETS = [
  '/offline.html',
  '/vexatrade-icon.svg',
  '/vexatrade-logo.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept API, upload, or other authenticated application data.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return;

  // Navigation requests must always use the current deployed HTML. Falling
  // back to offline.html is only for a genuine network failure.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Cache only immutable/static-looking assets. Do not turn arbitrary routes
  // into a stale cache entry.
  const isStaticAsset =
    ['script', 'style', 'image', 'font'].includes(request.destination) ||
    /\.(?:js|css|png|jpg|jpeg|webp|svg|ico|woff2?|ttf|otf)$/i.test(url.pathname);

  if (!isStaticAsset) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(request).then(cached => cached || caches.match(OFFLINE_URL)))
  );
});
