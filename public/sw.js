/* LandAudit service worker: makes the app installable and lets the app shell open offline.
 * It only touches same-origin files. Supabase, map tiles and fonts always go straight to the network. */
const V = 'landaudit-v1';
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(['/', '/manifest.webmanifest', '/icon-192.png'])).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url); if (u.origin !== location.origin) return;
  if (r.mode === 'navigate') { // always try the network first so users get the newest version; fall back to the saved shell offline
    e.respondWith(fetch(r).then(res => { const copy = res.clone(); caches.open(V).then(c => c.put('/', copy)); return res; }).catch(() => caches.match('/')));
    return;
  }
  if (u.pathname.startsWith('/assets/')) { // hashed build files never change, so cache first
    e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => { const copy = res.clone(); caches.open(V).then(c => c.put(r, copy)); return res; })));
  }
});
