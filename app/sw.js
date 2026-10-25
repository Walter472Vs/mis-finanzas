// Service worker: guarda la app en caché para que funcione sin conexión.
// Sube VERSION si agregas o renombras archivos de la lista.
const VERSION = 'v3';
const CACHE = `finanzas-${VERSION}`;
const ARCHIVOS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/calc.js',
  './js/db.js',
  './js/charts.js',
  './js/icons.js',
  './js/plantillas.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('finanzas-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Solo se cachean los archivos propios; las consultas del tipo de cambio van siempre a la red.
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Red primero (así recibes las actualizaciones al instante); si no hay conexión, la copia en caché.
  e.respondWith(
    // 'no-cache' revalida con el servidor (respuesta 304 si no cambió) en vez de usar una copia vieja del navegador.
    fetch(e.request, { cache: 'no-cache' })
      .then((resp) => {
        if (resp.ok) {
          const copia = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copia));
        }
        return resp;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html'))),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((cs) => (cs.length ? cs[0].focus() : self.clients.openWindow('./#recordatorios'))),
  );
});
