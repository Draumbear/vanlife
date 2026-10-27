/* Aotearoa Loop — offline shell.
   Bump CACHE when you change index.html so the phone picks up the new version. */
const CACHE = 'loop-v85';
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
    e.respondWith(caches.open(TILE_CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok) c.put(req.url, res.clone()); return res; }))));
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

// Booking reminders in the background (installed app on Android with periodic sync): the page leaves the list in a cache.
self.addEventListener('periodicsync', e => {
  if (e.tag !== 'reminders') return;
  e.waitUntil((async () => {
    const c = await caches.open('loop-reminders'), r = await c.match('reminders.json'); if (!r) return;
    const { list = [] } = await r.json(), sentR = await c.match('sent.json'), sent = sentR ? await sentR.json() : {};
    const t = new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' }), soon = new Date(Date.now() + 2 * 864e5).toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' });
    for (const x of list) if (x.by <= soon && sent[x.id] !== t) { await self.registration.showNotification(x.title, { body: x.body, tag: x.id, icon: 'icon-192.png' }); sent[x.id] = t; }
    await c.put('sent.json', new Response(JSON.stringify(sent), { headers: { 'Content-Type': 'application/json' } }));
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(ws => ws.length ? ws[0].focus() : self.clients.openWindow('./')));
});
