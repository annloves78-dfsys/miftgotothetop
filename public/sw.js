// Minimal service worker -- exists only so the browser considers this site
// installable as a PWA (홈 화면에 추가). This is a live Socket.IO game, so
// there's nothing useful to cache for offline play; every fetch just goes
// straight to the network.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
    e.respondWith(fetch(e.request));
});
