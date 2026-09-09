const PREFIX = 'training-plan-phase4-' + encodeURIComponent(new URL(self.registration.scope).pathname) + '-';
const CACHE = PREFIX + '20260909-v1';
const ASSETS = ['./', './index.html', './styles.css', './core.js', './app.js', './plan-data.js', './vendor/lucide.min.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './第3阶段旧版.html'];
const urls = new Set(ASSETS.map(path => new URL(path, self.registration.scope).href));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET' || !urls.has(event.request.url))return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request);
      if(response.ok) { await cache.put(event.request,response.clone());return response; }
      return await cache.match(event.request) || response;
    } catch {
      return await cache.match(event.request) || (event.request.mode === 'navigate' ? await cache.match(new URL('./index.html', self.registration.scope).href) : null) || Response.error();
    }
  })());
});
