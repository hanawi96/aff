/**
 * Admin mobile PWA — service worker (nhẹ).
 * Scope rộng (/) để /login.html vẫn ở trong standalone; chỉ can thiệp admin + login + asset.
 * API cross-origin: không đụng.
 */
const CACHE_VERSION = 'admin-m-v2';
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/admin/m.html',
  '/admin/manifest.webmanifest',
  '/admin/icons/icon-192.png',
  '/admin/icons/icon-512.png',
  '/admin/icons/apple-touch-icon.png',
  '/assets/css/admin-tailwind-built.css?v=6',
  '/login.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) =>
        Promise.all(
          PRECACHE_URLS.map((u) =>
            cache.add(u).catch(() => null)
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

function isCrossOriginOrApi(url) {
  if (url.origin !== self.location.origin) return true;
  return url.pathname.startsWith('/api');
}

function isAdminNav(url) {
  const p = url.pathname;
  return p.startsWith('/admin/') || p === '/login.html' || p === '/login';
}

function isStaticAsset(url) {
  if (url.origin !== self.location.origin) return false;
  const p = url.pathname;
  return (
    p.startsWith('/assets/') ||
    p.startsWith('/admin/icons/') ||
    p.endsWith('.webmanifest') ||
    /\.(css|js|png|svg|ico|woff2?)$/i.test(p)
  );
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      cache.put(request, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const fallback = await cache.match('/admin/m.html');
      if (fallback) return fallback;
    }
    throw new Error('offline');
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone()).catch(() => {});
      return res;
    })
    .catch(() => null);

  if (cached) {
    networkPromise.catch(() => {});
    return cached;
  }
  const fresh = await networkPromise;
  if (fresh) return fresh;
  const shellHit = await caches.open(SHELL_CACHE).then((c) => c.match(request));
  if (shellHit) return shellHit;
  throw new Error('offline-asset');
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (isCrossOriginOrApi(url)) return;

  const isNav =
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');

  if (isNav) {
    if (isAdminNav(url)) {
      event.respondWith(networkFirst(request));
    }
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
