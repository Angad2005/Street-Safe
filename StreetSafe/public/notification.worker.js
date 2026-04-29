const VERSION = 3;
const PAYLOAD_FORMAT_VERSION = 1;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Claim all the tabs so that they are replaced
  // with this version.
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  if (data.version !== PAYLOAD_FORMAT_VERSION) {
    return;
  }

  const { body, title } = data.payload;

  if (!body || !title) {
    console.warn("[worker] Malformed notification payload");
    return;
  }

  event.waitUntil(self.registration.showNotification(title, {
    body
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});