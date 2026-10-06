// Offline app shell.
//  • install precaches the page and the build assets it references, so the very first
//    offline start works (not only after a second online visit)
//  • navigations → network-first (fresh deploys win), cached shell when the network fails
//  • hashed /assets/ and the favicon → cache-first (immutable by construction)
// Only good responses are cached: ok, HTML for the shell, nothing marked no-store.
// Bump CACHE when this file's strategy changes; old caches are dropped on activate.
const CACHE = 'lifeos-shell-v2'

const cacheable = (res, shell) =>
  res.ok &&
  !/no-store/i.test(res.headers.get('cache-control') || '') &&
  (!shell || /text\/html/i.test(res.headers.get('content-type') || ''))

// A failed cache write (quota, closed cache) must never fail the response it belongs to.
const put = (req, res) =>
  caches.open(CACHE).then((c) => c.put(req, res)).catch(() => {})

async function precache() {
  const c = await caches.open(CACHE)
  const page = await fetch('/', { cache: 'reload' })
  if (!cacheable(page, true)) return
  const html = await page.clone().text()
  await c.put('/', page)
  const grab = async (path) => {
    try {
      const res = await fetch(path)
      if (!res.ok) return null
      await c.put(path, res.clone())
      return res
    } catch {
      return null
    }
  }
  const assets = new Set(html.match(/\/assets\/[^"'\s)<>]+/g) || [])
  await Promise.all([...assets].map(async (a) => {
    const res = await grab(a)
    if (!res || !a.endsWith('.css')) return
    // fonts and images a stylesheet pulls in are needed to render offline too
    const css = await res.text()
    const urls = [...css.matchAll(/url\(\s*['"]?([^'")]+)/g)].map((m) => new URL(m[1], self.location.origin + a).pathname)
    await Promise.all(urls.filter((p) => p.startsWith('/assets/')).map(grab))
  }).map((p) => p.catch(() => {})))
}

self.addEventListener('install', (e) => {
  e.waitUntil(precache().catch(() => {}).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    e.respondWith(
      (async () => {
        try {
          const res = await fetch(req)
          // the cache write is separate from the response: a storage failure or a bad page
          // (404/500, non-HTML, no-store) must not cost a good navigation or replace the shell
          if (cacheable(res, true)) e.waitUntil(put('/', res.clone()))
          return res
        } catch {
          return (await caches.match('/')) ?? new Response('Offline', { status: 503, statusText: 'Offline' })
        }
      })(),
    )
    return
  }

  if (url.pathname.startsWith('/assets/') || url.pathname === '/favicon.svg') {
    e.respondWith(
      (async () => {
        const hit = await caches.match(req)
        if (hit) return hit
        const res = await fetch(req)
        if (cacheable(res)) e.waitUntil(put(req, res.clone()))
        return res
      })(),
    )
  }
})
