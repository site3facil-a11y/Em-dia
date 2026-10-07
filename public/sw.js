const CACHE_NAME = 'em-dia-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/icon.svg',
  '/sql-wasm.wasm',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Aviso ao armazenar assets no cache:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Ignora requisições de outras origens ou esquemas especiais
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // sql-wasm.wasm e assets locais: cache com fallback para network
  if (event.request.url.endsWith('.wasm')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((networkRes) => {
          if (networkRes.ok) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          }
          return networkRes;
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // Atualiza cache em segundo plano (stale-while-revalidate)
        fetch(event.request)
          .then((networkRes) => {
            if (networkRes && networkRes.status === 200) {
              const clone = networkRes.clone();
              caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
            }
          })
          .catch(() => {});
        return cached;
      }

      return fetch(event.request).then((networkRes) => {
        if (networkRes && networkRes.status === 200 && event.request.method === 'GET') {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        }
        return networkRes;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// Manipulador de clique em notificações
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

// Periodic Background Sync (quando suportado pelo navegador)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'verificar-vencimentos-em-dia') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'EXECUTAR_VERIFICACAO_LEMBRETES' });
        });
      })
    );
  }
});
