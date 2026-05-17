// Algarve service worker - offline support for the trip site.
// Bump VERSION any time the precache list or runtime strategy changes.
const VERSION = 'v16';
const STATIC_CACHE = `algarve-static-${VERSION}`;
const RUNTIME_CACHE = `algarve-runtime-${VERSION}`;

const PRECACHE_URLS = [
  './',
  'index.html',
  'itinerary.html',
  'flights.html',
  'calm.html',
  'lively.html',
  'walks.html',
  'eat.html',
  'phrases.html',
  'stay.html',
  'weather.html',
  'bingo.html',
  'map.html',
  'day.html',
  'pack.html',
  'style.css',
  'style.css?v=v16',
  'script.js',
  'script.js?v=v16',
  'config.js',
  'venues/akvavit.html',
  'venues/atlantic-bar.html',
  'venues/a-tasca.html',
  'venues/boat-party.html',
  'venues/calcadao.html',
  'venues/casa-do-pescador.html',
  'venues/cats-bar.html',
  'venues/cerro-da-vila.html',
  'venues/falesia.html',
  'venues/forte-novo.html',
  'venues/kadoc.html',
  'venues/loule-market.html',
  'venues/motao.html',
  'venues/oneills.html',
  'venues/oporto-tavern.html',
  'venues/ramires.html',
  'venues/rolha-a-rolha.html',
  'venues/sailors-corner.html',
  'venues/salmora.html',
  'venues/tico-tico.html',
  'img/hero/pretrip.jpg',
  'img/hero/thu.jpg',
  'img/hero/fri.jpg',
  'img/hero/sat.jpg',
  'img/hero/sun.jpg',
  'img/hero/post.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // Use individual adds so one missing file doesn't fail the whole install.
      Promise.all(PRECACHE_URLS.map((url) =>
        cache.add(url).catch((err) => console.warn('[sw] precache miss', url, err))
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) => {
        // Belt-and-braces with controllerchange: notify open pages that a new SW activated.
        clients.forEach((c) => {
          try { c.postMessage({ type: 'sw-activated', version: VERSION }); } catch (e) {}
        });
      })
  );
});

// Domains whose responses we should always try network first (data freshness matters),
// falling back to cache when offline.
const API_HOSTS = [
  'translate.googleapis.com',
  'dataservice.accuweather.com',
  'api.jsonbin.io'
];

function cacheableStaticResponse(request, response) {
  const ct = response.headers.get('content-type') || '';
  const dest = request.destination;
  const mismatch =
    (dest === 'style'  && !ct.includes('text/css')) ||
    (dest === 'script' && !ct.includes('javascript')) ||
    (dest === 'font'   && !ct.includes('font') && !ct.includes('octet-stream')) ||
    (dest === 'image'  && !ct.includes('image'));

  return response.ok && !mismatch && (response.type === 'basic' || response.type === 'cors');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Google Maps JS, tiles and StreetView: network-only, no caching (Google's TOS forbids it,
  // and the API rotates session keys so cached responses break).
  if (url.hostname.endsWith('googleapis.com') && url.hostname.includes('maps') ||
      url.hostname.endsWith('gstatic.com') && url.pathname.includes('/maps') ||
      url.hostname === 'maps.google.com' ||
      url.hostname === 'maps.googleapis.com') {
    return; // Let the browser handle it directly
  }

  // API requests: network-first, cache fallback so weather/translation still load offline.
  if (API_HOSTS.some((h) => url.hostname.includes(h))) {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
        }
        return response;
      }).catch(() => caches.match(request))
    );
    return;
  }

  // CSS/JS: network-first so a fresh HTML page never pairs with stale cached assets.
  if (url.origin === self.location.origin && (request.destination === 'style' || request.destination === 'script')) {
    event.respondWith(
      fetch(request).then((response) => {
        if (cacheableStaticResponse(request, response)) {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
        }
        return response;
      }).catch(() => caches.match(request).then((cached) => cached || caches.match(url.origin + url.pathname)))
    );
    return;
  }

  // Navigation requests (HTML): network-first so edits show up, cache fallback for offline.
  if (request.mode === 'navigate' || (request.destination === '' && request.headers.get('accept')?.includes('text/html'))) {
    event.respondWith(
      fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
        return response;
      }).catch(() => caches.match(request).then((cached) => cached || caches.match('index.html')))
    );
    return;
  }

  // Everything else (CSS, JS, images, fonts): cache-first, fall back to network and stash a copy.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Don't cache bad responses or content-type mismatches, which catches
        // extension-injected HTML "blocked" pages being saved as CSS/JS.
        if (cacheableStaticResponse(request, response)) {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
