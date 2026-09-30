// Production Service Worker for Web Push & Background Notifications

self.addEventListener('push', function(event) {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.title || 'Task Manager Notification';
    const options = {
      body: payload.body || '',
      icon: payload.icon || '/vite.svg',
      badge: '/vite.svg',
      data: payload.data || {}
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (err) {
    console.error('[ServiceWorker] Error processing push event payload:', err);
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const targetData = event.notification.data || {};
  let targetUrl = targetData.url || '/';

  // Sanitize targetUrl to ensure it stays within application origin
  try {
    const parsedUrl = new URL(targetUrl, self.location.origin);
    if (parsedUrl.origin !== self.location.origin) {
      targetUrl = '/';
    } else {
      targetUrl = parsedUrl.pathname + parsedUrl.search;
    }
  } catch (err) {
    targetUrl = '/';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
