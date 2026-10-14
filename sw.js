/* Service worker: lưu sẵn giao diện để mở được khi mạng chập chờn (chế độ 'http'). Dữ liệu luôn lấy từ máy chủ. */
var CACHE = 'bt-shell-v2';
var SHELL = ['./', 'index.html', 'styles.css', 'config.js', 'client-core.js', 'ui.js', 'api.js', 'xlsx-lite.js', 'app.js', 'admin.js', 'logo.svg', 'manifest.webmanifest'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); })); self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(function (r) {
    var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); return r;
  }).catch(function () { return caches.match(e.request); }));
});
