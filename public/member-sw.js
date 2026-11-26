/*
 * The members' service worker (registered from /account with scope /account, see
 * member/components/pwa/service-worker-registrar.tsx; next.config.ts lets it control /account).
 * A copy of the members app's own (club-joia-300-backend public/sw.js) for this site's addresses.
 *
 * Caching policy (deliberately conservative — this is a private members app):
 *   - Static, non-personal assets (/_next/static, /assets/member, the icons): cache-first.
 *   - The public programme JSON (/account/programme/<slug>): network-first, cached for offline.
 *   - Page navigations: network only; on failure show the cached /offline page.
 *   - Everything else — especially /api/account/qr (QR tokens), /account/files, /account/export — is
 *     NEVER cached. QR credentials only ever live in page memory.
 */
const VERSION = "joia-site-v4";
const STATIC_CACHE = `${VERSION}-static`;
const DATA_CACHE = `${VERSION}-data`;
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/assets/member/CJ300_Logo_clr.png", "/assets/img/icon-v2-192.png", "/member.webmanifest"];

// The offline page with its own scripts and styles, so it still runs (and lists the saved programme) offline.
async function precache() {
  const c = await caches.open(STATIC_CACHE);
  await c.addAll(PRECACHE);
  const page = await c.match(OFFLINE_URL);
  const html = page ? await page.text() : "";
  const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s\\)]+/g) || [])];
  await Promise.all(assets.map((a) => c.add(a).catch(() => {})));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isStatic = (url) =>
  url.origin === self.location.origin &&
  (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/assets/member/") || url.pathname.startsWith("/assets/img/icon-v2-"));

const isPublicProgramme = (url) => url.origin === self.location.origin && /^\/account\/programme\/[^/]+$/.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (isStatic(url)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            // the copy is taken now, before the page reads the response (a later clone() fails)
            if (res.ok) { const copy = res.clone(); caches.open(STATIC_CACHE).then((c) => c.put(req, copy)); }
            return res;
          }),
      ),
    );
    return;
  }

  if (isPublicProgramme(url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(DATA_CACHE).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || Response.json({ error: "offline" }, { status: 503 }))),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
  }
  // All other requests go straight to the network (no caching).
});
