// Berry Runner 2: the service worker that makes the game an installable web app that also starts with no network.
//  - INSTALL: the page and every script it names (read from index.html itself, so there is no list to keep up to date), the icons and the music are put in the cache.
//  - PAGES AND SCRIPTS: network first (a new version pushed to the site is played at the next start), the cache when there is no network.
//  - MUSIC AND PICTURES: cache first (they do not change), fetched and kept the first time otherwise.
// Bump VERSION to drop every older cache.
const VERSION = 'berry-runner-2-v3', MEDIA = /\.(mp3|ogg|png|jpg|jpeg|webp|svg|woff2)$/i;
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION), page = await fetch('./index.html', { cache: 'no-cache' }), html = await page.clone().text();
    await cache.put('./', page.clone()); await cache.put('./index.html', page);
    const urls = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).concat(['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'assets/fonts/fredoka.woff2', 'src3d/kart_assets.js', 'assets/music.mp3', 'assets/music_coast.mp3', 'assets/music_race.mp3', 'assets/music_kart.mp3']);
    await Promise.all(urls.map(u => fetch(u, { cache: 'no-cache' }).then(r => r.ok && r.status === 200 ? cache.put(u, r) : null).catch(() => null)));      // (one missing file must not stop the install)
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => { e.waitUntil((async () => { for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k); await self.clients.claim(); })()); });
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION), key = url.pathname.endsWith('/') ? url.origin + url.pathname : url.origin + url.pathname;      // (the query string, ?zone=..., does not make another page)
    const keep = r => { if (r && r.ok && r.status === 200) cache.put(key, r.clone()); return r; };
    if (req.headers.has('range')) {                                // the <audio> element asks for byte ranges: the network answers them; with no network, the whole cached file
      try { return await fetch(req); } catch (err) { const hit = await cache.match(key); if (hit) return hit; throw err; }
    }
    if (MEDIA.test(url.pathname)) { const hit = await cache.match(key); if (hit) return hit; return keep(await fetch(req)); }
    try { return keep(await fetch(req, { cache: 'no-cache' })); } catch (err) { const hit = await cache.match(key); if (hit) return hit; throw err; }
  })());
});
