// frontend-user/public/sw.js
// Service Worker for VexaTrade PWA – with offline fallback

const CACHE_NAME = 'vexatrade-v2';
const OFFLINE_URL = '/offline.html';

// Assets to cache on install
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',        // ← ADDED: cache the offline page
  '/vexatrade-icon.svg',
  '/vexatrade-logo.svg'
  // Add other static assets like CSS/JS if needed (they are usually cached by the build)
];

// Install event – cache assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching assets...');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event – clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
    .then(() => self.clients.claim())
  );
});

// Fetch event – serve from cache, fallback to network, and offline page if network fails
self.addEventListener('fetch', event => {
  event.respondWith(
    // Try the network first
    fetch(event.request)
      .then(response => {
        // If response is valid, cache it for next time (optional)
        if (response && response.status === 200) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, cloned);
          });
        }
        return response;
      })
      .catch(() => {
        // Network request failed – return cached offline page
        return caches.match(OFFLINE_URL);
      })
  );
});
