const CACHE_NAME = 'linkvault-v2';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    '/icon.svg',
    '/offline.html'
];

// ── Install: cache all static assets + offline page ──────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

// ── Activate: remove old caches ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// ── Fetch: Stale-While-Revalidate for static, network-first for API ───────────
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET and cross-origin Supabase API calls
    if (request.method !== 'GET') return;
    if (url.hostname.includes('supabase.co')) return;

    // Navigation requests: network first, fallback to offline.html
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .catch(() => caches.match('/offline.html'))
        );
        return;
    }

    // Static assets: Stale-While-Revalidate
    event.respondWith(
        caches.open(CACHE_NAME).then((cache) =>
            cache.match(request).then((cached) => {
                const networkFetch = fetch(request).then((response) => {
                    if (response && response.status === 200) {
                        cache.put(request, response.clone());
                    }
                    return response;
                }).catch(() => cached); // fallback to cache if network fails

                // Return cached immediately, update in background
                return cached || networkFetch;
            })
        )
    );
});
