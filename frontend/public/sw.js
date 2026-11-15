const CACHE_NAME = "kshetra-shell-v3";
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/leaf.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon-180.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS).catch(() => undefined))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/api/") || url.pathname === "/healthz" || url.pathname === "/readyz") {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({
            status: "offline",
            error: {
              code: "OFFLINE",
              message: "Network offline — displaying last cached state."
            }
          }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        )
      )
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then(resp => {
        if (resp && resp.status === 200 && resp.type === "basic") {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return resp;
      })
      .catch(() => caches.match(request).then(cached => cached || caches.match("/index.html")))
  );
});
