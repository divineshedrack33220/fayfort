/* Fayfort PWA service worker: offline shell + web push. */
const VERSION = "fayfort-v1";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/offline";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-192.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
  "/badge-96.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

const isStaticAsset = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  PRECACHE_URLS.includes(url.pathname) ||
  url.pathname === "/manifest.webmanifest";

/*
 * Authenticated HTML is never cached: a stale shell could show one user's data
 * to another on a shared device. Navigations are network-first with an offline
 * fallback; hashed build assets are cache-first because they are immutable.
 */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);
        return (
          (await cache.match(request)) ??
          (await cache.match(OFFLINE_URL)) ??
          Response.error()
        );
      }),
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cached);
        return cached ?? network;
      }),
    );
  }
});

const parsePush = (event) => {
  if (!event.data) return null;
  try {
    return event.data.json();
  } catch {
    return { title: "Fayfort", body: event.data.text() };
  }
};

async function showPush(payload) {
  const url = new URL(payload.url || "/", self.location.origin);
  const sameOriginClients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  const existing = sameOriginClients.find(
    (client) => new URL(client.url).origin === url.origin,
  );
  const tag = payload.tag || `fayfort-${payload.id || Date.now()}`;

  return self.registration.showNotification(payload.title || "Fayfort", {
    body: payload.body || "",
    icon: payload.icon || "/icon-192.png",
    badge: payload.badge || "/badge-96.png",
    image: payload.image,
    tag,
    renotify: false,
    requireInteraction: Boolean(payload.requireInteraction),
    vibrate: payload.vibrate || [100, 40, 100],
    timestamp: payload.at ? Date.parse(payload.at) || Date.now() : Date.now(),
    data: { url: url.pathname + url.search, tag, id: payload.id, open: !existing },
  });
}

self.addEventListener("push", (event) => {
  const payload = parsePush(event) || {};
  event.waitUntil(showPush(payload));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clientList) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        const focused = await client.focus();
        if (focused && "navigate" in focused) {
          await focused.navigate(target).catch(() => undefined);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
