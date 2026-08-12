/* My Dentist service worker.
 *
 * Deliberately conservative. A service worker that caches too eagerly is worse
 * than none: it serves a stale app shell after a deploy, or shows yesterday's
 * dentist list as though it were live. The rules here are:
 *
 *   - API calls (/api/*): NEVER cached, always straight to the network. Doctor
 *     availability, booked slots and appointments must never come from a cache.
 *   - Hashed build assets (/_expo/static/**): cache-first and immutable. The
 *     filename contains a content hash, so a changed file is a changed URL —
 *     it can never go stale.
 *   - Navigations: network-first with a cached shell fallback, so the app opens
 *     offline instead of showing the browser's dinosaur, but a deploy is picked
 *     up on the very next load rather than after a cache expiry.
 *   - Everything else (icons, fonts, images): stale-while-revalidate.
 *
 * CACHE_VERSION is stamped at build time from the bundle hash, so every deploy
 * gets a fresh cache and the old one is deleted on activate.
 */

const CACHE_VERSION = '__CACHE_VERSION__';
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const ASSET_CACHE = `assets-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

// Only the shell and the offline page are precached. The JS bundle is big and
// is fetched on first navigation anyway; precaching it would make the install
// step slow and failure-prone on a bad connection.
const PRECACHE = ['/', OFFLINE_URL, '/manifest.webmanifest'];

// cache.add() stores whatever comes back, including a 404 or an error page. A
// bad response cached under '/' becomes the offline shell forever, so fetch and
// check the status before storing.
const cacheIfOk = (cache, url) =>
  fetch(url, { cache: 'reload' })
    .then((res) => (res && res.ok ? cache.put(url, res) : null))
    .catch(() => null);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      // Individually, so one failed request cannot abort the whole install.
      .then((cache) => Promise.all(PRECACHE.map((u) => cacheIfOk(cache, u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

const isApi = (url) => url.pathname.startsWith('/api/') || url.hostname.startsWith('api.');
const isHashedAsset = (url) => url.pathname.startsWith('/_expo/static/');

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never cache the API. Appointment slots and availability are live data, and
  // a cached booking response could show a slot that was taken minutes ago.
  if (isApi(url)) return;

  // Cross-origin (pixel, fonts): leave to the browser.
  if (url.origin !== self.location.origin) return;

  // Content-hashed build output: safe to cache forever.
  if (isHashedAsset(url)) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => {
        // A 404 here means this client is asking for a bundle from a previous
        // deploy — its cached shell is stale. Drop the caches and unregister so
        // the next load fetches everything fresh, instead of leaving the user
        // on a blank page that a reload cannot fix.
        if (res.status === 404) {
          caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
            .then(() => self.registration.unregister());
        }
        if (res.ok) {
          const copy = res.clone();
          caches.open(ASSET_CACHE).then((c) => c.put(request, copy));
        }
        return res;
      }))
    );
    return;
  }

  // Navigations: network first so a deploy lands immediately; fall back to the
  // cached shell, then the offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // Only a clean 200 replaces the cached shell. Caching a redirect or an
          // error page here would poison every future offline load.
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put('/', copy));
          }
          return res;
        })
        .catch(() => caches.match('/').then((hit) => hit || caches.match(OFFLINE_URL)))
    );
    return;
  }

  // Icons, images, fonts: serve cached immediately, refresh in the background.
  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(ASSET_CACHE).then((c) => c.put(request, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || network;
    })
  );
});
