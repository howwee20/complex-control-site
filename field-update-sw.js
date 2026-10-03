const CACHE = "complex-control-field-update-v7";
const SHELL = [
  "/field-update.html?updater=7",
  "/field-update.js?updater=7",
  "/field-update.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // Release data must never fall back to an older cached manifest. The updater
  // keeps the last verified capsule in IndexedDB for the offline Pi transfer.
  if (new URL(event.request.url).pathname.startsWith("/field/")) {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request, { ignoreSearch: true });
        if (cached) return cached;
        if (event.request.mode === "navigate") {
          return caches.match("/field-update.html?updater=7", { ignoreSearch: true });
        }
        return Response.error();
      }),
  );
});
