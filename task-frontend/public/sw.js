// This is a simple service worker for demonstration.
// It listens for push events and shows a notification.

self.addEventListener('push', event => {
  const data = event.data.json();
  console.log('New notification', data);
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/vite.svg' // You can change this to your app's logo
    })
  );
});