// Service worker: laat de app opstarten zonder bereik.
// Bij elke nieuwe versie van de app: verhoog VERSIE, anders blijft iOS de oude tonen.
const VERSIE = 'boodschappen-v5';
const FIREBASE = '12.19.0';
const EIGEN = ['./', './index.html', './manifest.webmanifest', './icon-1024.png?v=2',
  './fonts/schibsted-400.woff2', './fonts/schibsted-600.woff2', './fonts/schibsted-700.woff2', './fonts/schibsted-800.woff2'];
const EXTERN = [
  `https://www.gstatic.com/firebasejs/${FIREBASE}/firebase-app.js`,
  `https://www.gstatic.com/firebasejs/${FIREBASE}/firebase-firestore.js`
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSIE);
    await cache.addAll(EIGEN);
    // Externe bestanden: los proberen, een mislukte download mag de installatie niet blokkeren.
    await Promise.all(EXTERN.map((u) => cache.add(new Request(u, { mode: 'cors' })).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSIE) await caches.delete(k);
    await self.clients.claim();
  })());
});

const statisch = (url) =>
  url.origin === self.location.origin ||
  (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) ||
  url.hostname === 'fonts.googleapis.com' ||
  url.hostname === 'fonts.gstatic.com';

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!statisch(url)) return; // Firestore-verkeer nooit via de cache

  // De app zelf: eerst netwerk (zodat updates meteen binnenkomen), anders uit de cache.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(VERSIE);
        cache.put('./index.html', res.clone());
        return res;
      } catch {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Al de rest: uit de cache, en op de achtergrond verversen.
  e.respondWith((async () => {
    const cache = await caches.open(VERSIE);
    const hit = await cache.match(req);
    const vers = fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    return hit || (await vers) || Response.error();
  })());
});
