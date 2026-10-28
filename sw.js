/* Van Budget NZ — offline shell.
   Bump CACHE when you change index.html so phones pick up the new version. */
const CACHE = 'kea-v38';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './trip/icon-192.png', './kea-icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('kea-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                     // never cache Supabase writes
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;           // Supabase + rate API go straight to network

  // Network-first for the app shell so a redeploy lands quickly, cache as fallback offline.
  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});

// Evening reminder (pushed by Supabase's evening-nudge at 8 pm)
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (err) {}
  e.waitUntil(self.registration.showNotification(d.title || 'Spent anything today?', {
    body: d.body || 'Log it in Kea before you forget.', tag: d.tag || 'evening', icon: d.icon || 'icon-192.png', badge: 'icon-192.png', data: { url: d.url || './?add=1' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  if (!url.startsWith(self.registration.scope)) return e.waitUntil(self.clients.openWindow(url)); // e.g. the Rob Roy ford post
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    const toLoop = url.includes('/trip/'), w = ws.find(c => c.url.startsWith(self.registration.scope) && c.url.includes('/trip/') === toLoop);
    return w ? w.navigate(url).then(c => c && c.focus()) : self.clients.openWindow(url);
  }));
});
