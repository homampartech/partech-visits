/* Offline shell for the PARTECH visits app. Data requests to Supabase always go to the network. */
const CACHE = "ptv-v9";

// push notifications (quote follow-up reminders)
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) {}
  e.waitUntil(self.registration.showNotification(d.title || "تذكير", {
    body: d.body || "", tag: d.tag || undefined, icon: "./icons/icon-192.png", badge: "./icons/icon-192.png", dir: "rtl", lang: "ar",
    data: { url: d.url || "./#today" }
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./#today";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) { if ("focus" in c) return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => { const old = keys.filter(k => k !== CACHE); return Promise.all(old.map(k => caches.delete(k))).then(() => old.length); })
      .then(n => self.clients.claim().then(() => n))
      // an older version was replaced: reload open pages once so nobody stays on an old copy (skipped on a first install)
      .then(n => n ? self.clients.matchAll({ type: "window" }).then(list => list.forEach(c => { try { c.navigate(c.url); } catch (_) {} })) : null)
  );
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.endsWith("supabase.co") || url.hostname.endsWith("supabase.in")) return;
  if (url.searchParams.has("u")) return; // update checks always go to the network and are never cached

  // the page itself: newest version when online, cached copy when offline
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req, { cache: "no-cache" })
        .then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put("./index.html", copy)); } return res; })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // fonts, the Supabase library and icons: cache first
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});

