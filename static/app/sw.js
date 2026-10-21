// CropWise offline support: the app shell and built assets are cached so the app opens with no
// signal; API answers are network-first with the last good copy kept for read-only GETs.
const SHELL = 'cw-shell-v3'
const DATA = 'cw-data-v3'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(['/', '/static/app/manifest.webmanifest'])))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => ![SHELL, DATA].includes(k)).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== location.origin) return

  // Hashed build assets never change: cache first.
  if (url.pathname.startsWith('/static/app/assets/')) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request).then((res) => {
      const copy = res.clone()
      caches.open(SHELL).then((c) => c.put(request, copy))
      return res
    })))
    return
  }

  // Read-only API answers (plan, history, eval…): network first, last good copy when offline.
  // Streaming assistant and photo uploads are POSTs and never touch the cache.
  if (url.pathname.startsWith('/api/v1/')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(DATA).then((c) => c.put(request, copy))
          }
          return res
        })
        .catch(() => caches.match(request).then((hit) => hit || Response.error())),
    )
    return
  }

  // Page navigations: network first, cached shell when offline (the router renders the page).
  if (request.mode === 'navigate') {
    // Each online visit refreshes the offline copy, so offline never shows an old version.
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok && url.pathname === '/') {
            const copy = res.clone()
            caches.open(SHELL).then((c) => c.put('/', copy))
          }
          return res
        })
        .catch(() => caches.match('/')),
    )
  }
})
