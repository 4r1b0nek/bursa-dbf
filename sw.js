/* Service worker Bursa DBF â€” cache app shell, never cache API/DBF. */
const CACHE = "bursa-dbf-shell-v4";
const SCOPE = self.registration.scope;
const INDEX = new URL("index.html", SCOPE).href;
const ASSETS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "assets/css/style.css",
  "assets/js/app.js",
  "assets/js/api.js",
  "assets/js/auth.js",
  "assets/js/store.js",
  "assets/js/charts.js",
  "assets/js/dbf.js",
  "assets/js/zip.js",
  "assets/js/format.js",
  "assets/js/pwa.js",
  "assets/js/excel.js",
  "assets/vendor/xlsx.full.min.js",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/icon-maskable-512.png",
  "assets/icons/apple-touch-icon.png",
  "assets/icons/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // API D1 ditangani browser
  if (url.pathname.includes("/data/")) return;    // jangan cache DBF

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(INDEX, copy));
          }
          return response;
        })
        .catch(() => caches.match(INDEX))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});


