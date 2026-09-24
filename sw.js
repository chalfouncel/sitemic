self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open('mic-app').then((cache) => cache.addAll([
            '/app.html',
            '/app.js',
            '/logo.png',
            '/marca-dagua.png'
        ]))
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => response || fetch(e.request))
    );
});
