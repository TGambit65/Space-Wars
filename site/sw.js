// Service Worker for Space Wars 3000 PWA
const CACHE_NAME = 'space-wars-3000-v1';
const OFFLINE_URL = '/offline.html';
const OFFLINE_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/register.html',
  '/navigation.html',
  '/combat.html',
  '/ship-designer.html',
  '/store.html',
  '/css/styles.css',
  '/css/mobile-enhancements.css',
  '/css/navigation.css',
  '/css/combat.css',
  '/css/ship-designer.css',
  '/js/main.js',
  '/js/auth-common.js',
  '/js/mobile-utils.js',
  '/images/logo.svg',
  '/images/icons/icon-192x192.png',
  '/images/icons/icon-512x512.png',
  '/offline.html',
  '/manifest.json',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js'
];

// Install event - cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching offline assets');
        return cache.addAll(OFFLINE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', event => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin) && 
      !event.request.url.startsWith('https://cdn.jsdelivr.net')) {
    return;
  }

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // For API requests, use network first, then cache
  if (event.request.url.includes('/api/')) {
    return event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache a copy of the response
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // If network fails, try to serve from cache
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // If not in cache, return offline JSON for API
              return new Response(
                JSON.stringify({ 
                  error: 'You are offline',
                  offline: true 
                }),
                { 
                  headers: { 'Content-Type': 'application/json' } 
                }
              );
            });
        })
    );
  }

  // For page navigations, use cache first, then network
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request)
            .then(cachedResponse => {
              // If in cache, return the cached version
              if (cachedResponse) {
                return cachedResponse;
              }
              // If not in cache, return the offline page
              return caches.match(OFFLINE_URL);
            });
        })
    );
    return;
  }

  // For assets, use cache first, then network
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // If in cache, return the cached version
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Otherwise fetch from network
        return fetch(event.request)
          .then(response => {
            // Cache a copy of the response
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
            return response;
          })
          .catch(error => {
            // For image requests, return a fallback logo
            if (event.request.url.match(/\.(jpg|jpeg|png|gif|svg)$/)) {
              return caches.match('/images/logo.svg');
            }
            
            // For CSS/JS, return an empty response
            if (event.request.url.match(/\.(css|js)$/)) {
              return new Response('/* Offline fallback */', { 
                headers: { 'Content-Type': 'text/css' } 
              });
            }
            
            // For other requests, just propagate the error
            throw error;
          });
      })
  );
});

// Background sync for offline data
self.addEventListener('sync', event => {
  if (event.tag === 'sync-feedback') {
    event.waitUntil(syncFeedback());
  }
});

// Function to sync feedback data
async function syncFeedback() {
  try {
    // Open IndexedDB
    const dbPromise = indexedDB.open('SpaceWars3000Offline', 1);
    
    dbPromise.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('feedback')) {
        db.createObjectStore('feedback', { keyPath: 'id', autoIncrement: true });
      }
    };
    
    const db = await new Promise((resolve, reject) => {
      dbPromise.onsuccess = event => resolve(event.target.result);
      dbPromise.onerror = event => reject(event.target.error);
    });
    
    // Get all feedback items
    const transaction = db.transaction(['feedback'], 'readwrite');
    const store = transaction.objectStore('feedback');
    const feedbackItems = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = event => resolve(event.target.result);
      request.onerror = event => reject(event.target.error);
    });
    
    // Send each feedback item to the server
    for (const feedback of feedbackItems) {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': self.registration.scope + 'token' // Get token from somewhere
        },
        body: JSON.stringify(feedback)
      });
      
      // Remove from IndexedDB after successful sync
      await new Promise((resolve, reject) => {
        const request = store.delete(feedback.id);
        request.onsuccess = event => resolve();
        request.onerror = event => reject(event.target.error);
      });
    }
    
    console.log('Feedback synced successfully');
    
  } catch (error) {
    console.error('Error syncing feedback:', error);
    throw error; // Retry sync later
  }
}

// Push notifications
self.addEventListener('push', event => {
  const data = event.data.json();
  
  const options = {
    body: data.body,
    icon: '/images/icons/icon-192x192.png',
    badge: '/images/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    actions: [
      {
        action: 'view',
        title: 'View'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  } else {
    event.waitUntil(
      clients.matchAll({ type: 'window' })
        .then(clientList => {
          // If a window is already open, focus it
          for (const client of clientList) {
            if (client.url === event.notification.data.url && 'focus' in client) {
              return client.focus();
            }
          }
          // Otherwise open a new window
          return clients.openWindow(event.notification.data.url);
        })
    );
  }
});
