const CACHE_NAME = 'personalflix-v1';
const CACHE_VERSION = '1.0.0';

// Lista de arquivos para cache
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/movies.json',
  '/favicon.ico'
];

// Assets estáticos para cache
const STATIC_ASSETS = [
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png'
];

// Event: Install
self.addEventListener('install', (event) => {
  console.log('[SW] Install Event');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching core assets');
        return cache.addAll(CORE_ASSETS);
      })
      .then(() => {
        console.log('[SW] Core assets cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Install failed:', error);
      })
  );
});

// Event: Activate
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate Event');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service Worker activated');
        return self.clients.claim();
      })
  );
});

// Event: Fetch
self.addEventListener('fetch', (event) => {
  const requestURL = new URL(event.request.url);

  // Estratégia Cache First para assets essenciais
  if (CORE_ASSETS.includes(requestURL.pathname) ||
    STATIC_ASSETS.includes(requestURL.pathname)) {

    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          return fetch(event.request)
            .then((networkResponse) => {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseClone);
                });
              return networkResponse;
            });
        })
        .catch(() => {
          // Fallback para quando não há conexão
          if (event.request.destination === 'document') {
            return caches.match('/index.html');
          }
        })
    );
    return;
  }

  // Estratégia Network First para imagens do TMDB
  if (requestURL.hostname === 'image.tmdb.org') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseClone);
            });
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // Estratégia Network First para outros recursos
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache apenas respostas válidas
        if (networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseClone);
            });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }

            // Fallback genérico
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// Event: Background Sync
self.addEventListener('sync', (event) => {
  console.log('[SW] Background Sync:', event.tag);

  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Implementar lógica de sincronização se necessário
      Promise.resolve()
    );
  }
});

// Event: Push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push Event:', event);

  if (event.data) {
    const data = event.data.json();

    const options = {
      body: data.body || 'Nova notificação do PersonalFlix',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: data.tag || 'personalflix-notification',
      data: data.data || {},
      actions: [
        {
          action: 'open',
          title: 'Abrir App',
          icon: '/icons/icon-72x72.png'
        },
        {
          action: 'close',
          title: 'Dispensar'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'PersonalFlix', options)
    );
  }
});

// Event: Notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click:', event);

  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window' })
        .then((clientList) => {
          // Se já existe uma janela aberta, foca nela
          for (const client of clientList) {
            if (client.url.includes(self.location.origin) && 'focus' in client) {
              return client.focus();
            }
          }
          // Senão, abre uma nova janela
          if (clients.openWindow) {
            return clients.openWindow('/');
          }
        })
    );
  }
});

// Função utilitária para limpar cache antigo
const cleanOldCaches = async () => {
  const cacheNames = await caches.keys();
  const oldCaches = cacheNames.filter(name => name !== CACHE_NAME);

  return Promise.all(
    oldCaches.map(name => caches.delete(name))
  );
};

// Função para pré-carregar recursos importantes
const preloadCriticalResources = async () => {
  const cache = await caches.open(CACHE_NAME);

  try {
    await cache.addAll(STATIC_ASSETS);
    console.log('[SW] Static assets preloaded');
  } catch (error) {
    console.warn('[SW] Some static assets failed to preload:', error);
  }
};

// Executar limpeza e pré-carregamento durante a ativação
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      cleanOldCaches(),
      preloadCriticalResources(),
      self.clients.claim()
    ])
  );
});