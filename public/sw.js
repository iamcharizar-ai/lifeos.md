// Minimal service worker: makes the app installable as a PWA and keeps the
// shell usable offline. Network-first for navigations (fresh deploys win),
// cache-first for hashed /assets/ (immutable by construction).
const CACHE = 'lifeos-shell-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin) return

  if (e.request.mode === 'navigate') {
    e.respondWith(
      (async () => {
        try {
          const res = await fetch(e.request)
          const c = await caches.open(CACHE)
          c.put('/index.html', res.clone())
          return res
        } catch {
          return (await caches.match('/index.html')) ?? Response.error()
        }
      })(),
    )
    return
  }

  if (url.pathname.startsWith('/assets/') || url.pathname === '/favicon.svg') {
    e.respondWith(
      (async () => {
        const c = await caches.open(CACHE)
        const hit = await c.match(e.request)
        if (hit) return hit
        const res = await fetch(e.request)
        if (res.ok) c.put(e.request, res.clone())
        return res
      })(),
    )
  }
})
