// Service worker : la page vient d'abord du réseau (pour recevoir les mises à jour),
// le cache sert seulement hors ligne. Les fichiers versionnés (assets/) restent en cache.
const BASE = new URL("./", self.location).pathname; // ex. /coupdemain/famille-xxxx/
const CACHE = "coupdemain-v2:" + BASE;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([BASE, BASE + "manifest.webmanifest", BASE + "icon.svg"]).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && (k === "coupdemain-v1" || k.endsWith(":" + BASE))).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  if (url.pathname.startsWith(BASE + "assets/")) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req.mode === "navigate" ? BASE : req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req.mode === "navigate" ? BASE : req).then((r) => r || caches.match(BASE)))
  );
});
