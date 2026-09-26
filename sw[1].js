/* Service worker офлайн-режима для «10 000 слов».
   Стратегия: cache-first для статики, при потере сети отдаём закэшированный index.html. */
'use strict';
var V = 'vocab10k-v2.0.0';
var CORE = ['./', './index.html', './manifest.webmanifest', './icon-180.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(V).then(function (c) { return c.addAll(CORE); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k !== V; })
                           .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  // навигация: сначала сеть (чтобы получить новую версию), при офлайне — кэш
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(function (res) {
        var cp = res.clone();
        caches.open(V).then(function (c) { c.put('./index.html', cp); });
        return res;
      }).catch(function () {
        return caches.match('./index.html');
      })
    );
    return;
  }

  // остальное: сначала кэш, потом сеть с докэшированием
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (res) {
        if (res && res.ok) {
          var cp = res.clone();
          caches.open(V).then(function (c) { c.put(e.request, cp); });
        }
        return res;
      }).catch(function () { return caches.match('./index.html'); });
    })
  );
});
