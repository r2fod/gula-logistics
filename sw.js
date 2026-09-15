// Service worker mínimo — solo lo justo para que Chrome/Safari permitan
// "Instalar app" y para tener listos los avisos push del navegador más
// adelante. A propósito NO cachea nada del bundle: esta sesión ya sufrió
// varias veces problemas de caché de Vite quedándose con código viejo, así
// que aquí todo pasa directo a la red (network passthrough), nunca se sirve
// una versión guardada de la app.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

// Aviso push — el payload lo manda el servidor cuando esté listo (aún no
// implementado en el backend). Estructura esperada: { title, body, url }.
self.addEventListener('push', (event) => {
  let data = { title: 'Gula Logística', body: 'Hay una actualización nueva.' };
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      data: { url: data.url || './' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
