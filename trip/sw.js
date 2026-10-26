/* Aotearoa Loop — offline shell.
   Bump CACHE when you change index.html so the phone picks up the new version. */
const CACHE = 'loop-v51';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './plan.json', '../icon-192.png', './contour.svg'];
const FONTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com'];
const TILES = 'tile.openstreetmap.org', TILE_CACHE = 'tiles-v1';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('loop-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Fonts: cache-first so the app keeps its look offline.
  if (FONTS.includes(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    })));
    return;
  }
  // Map tiles you've looked at stay available offline.
  if (url.hostname === TILES) {
    e.respondWith(caches.open(TILE_CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }))));
    return;
  }
  if (url.origin !== location.origin) return;           // maps, weather links etc. go straight out

  // Network-first so updates land quickly, cache as fallback with no signal.
  e.respondWith(
    fetch(req)
      .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
