// Zeehn Lingo service worker: ilova qobig'ini keshlaydi, API har doim tarmoqdan
const C = "zl-v1";
const SHELL = ["/lingo/", "/lingo/manifest.webmanifest", "/lingo/icons/icon-192.png", "/img/logo-mark-blue.png", "/img/logo-mark-white.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(C).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== C).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/")) return;
  // Avval tarmoq (yangi versiya darhol ko'rinsin), internet bo'lmasa — kesh
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(C).then((c) => c.put(e.request, cp)); } return r; })
    .catch(() => caches.match(e.request).then((r) => r || caches.match("/lingo/"))));
});
