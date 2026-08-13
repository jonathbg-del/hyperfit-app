/* HyperFit service worker
   Estratégia:
   - HTML/JS do app  → REDE PRIMEIRO (cai no cache só se estiver offline).
     Isso garante que uma versão nova publicada chegue no aparelho na próxima abertura.
   - Ícones/manifest → CACHE PRIMEIRO (não mudam e economizam dados).
*/
const CACHE = "hyperfit-app-v1";
const ASSETS = ["./", "./index.html", "./manifest.json", "./icon.svg", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);

  if (req.method !== "GET") return;
  // nunca interceptar chamadas à IA / Firebase
  if (url.hostname.includes("googleapis.com") || url.hostname.includes("firebaseapp.com") || url.hostname.includes("gstatic.com")) return;

  const isAppShell = req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("index.html");

  if (isAppShell) {
    // rede primeiro: sempre pega a versão mais nova quando há internet
    e.respondWith(
      fetch(req)
        .then(resp => {
          if (resp.ok && url.origin === location.origin) {
            const clone = resp.clone();
            caches.open(CACHE).then(c => c.put("./index.html", clone));
          }
          return resp;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // demais recursos: cache primeiro
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(resp => {
      if (resp.ok && url.origin === location.origin) {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(req, clone));
      }
      return resp;
    }).catch(() => caches.match("./index.html")))
  );
});
