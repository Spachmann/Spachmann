/**
 * Service Worker: macht die App offline nutzbar.
 * Strategie: eigene Dateien beim Installieren in den Cache legen, danach
 * "network first, cache fallback" – so ist immer die neueste Version aktiv,
 * ohne dass die App ohne Netz unbrauchbar wird.
 */

const CACHE = 'nebenkosten-v1';

const DATEIEN = [
  './',
  './index.html',
  './manifest.webmanifest',
  './styles/app.css',
  './styles/dokument.css',
  './icons/icon.svg',
  './src/app.js',
  './src/store.js',
  './src/ui/dom.js',
  './src/ui/views.js',
  './src/ui/dokument.js',
  './src/core/money.js',
  './src/core/datum.js',
  './src/core/katalog.js',
  './src/core/co2.js',
  './src/core/heizkosten.js',
  './src/core/abrechnung.js',
  './src/core/pruefung.js',
  './src/core/model.js',
];

self.addEventListener('install', (ereignis) => {
  ereignis.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(DATEIEN))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (ereignis) => {
  ereignis.waitUntil(
    caches
      .keys()
      .then((namen) => Promise.all(namen.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (ereignis) => {
  const anfrage = ereignis.request;
  if (anfrage.method !== 'GET' || new URL(anfrage.url).origin !== self.location.origin) return;

  ereignis.respondWith(
    fetch(anfrage)
      .then((antwort) => {
        if (antwort && antwort.status === 200 && antwort.type === 'basic') {
          const kopie = antwort.clone();
          caches.open(CACHE).then((cache) => cache.put(anfrage, kopie));
        }
        return antwort;
      })
      .catch(() =>
        caches.match(anfrage).then((treffer) => treffer || caches.match('./index.html'))
      )
  );
});
