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

// Rappels (Web Push) : le serveur envoie { title, body, tag, url }
self.addEventListener("push", (event) => {
  let msg = {};
  try {
    msg = event.data ? event.data.json() : {};
  } catch (e) {
    msg = { body: event.data && event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(msg.title || "HebdoFamille", {
      body: msg.body || "",
      tag: msg.tag || "hebdofamille",
      icon: BASE + "icon-192.png",
      badge: BASE + "badge-96.png",
      data: { url: msg.url || BASE },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || BASE;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => new URL(c.url).pathname.startsWith(BASE));
      return open ? open.focus() : self.clients.openWindow(url);
    })
  );
});
