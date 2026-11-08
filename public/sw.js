// Service worker: recebe as notificações push e abre o app ao tocar
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { titulo: event.data && event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(d.titulo || "Academia", {
      body: d.texto || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: d.url || "/" },
      tag: d.tag || undefined,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((abas) => {
      for (const aba of abas) {
        if ("focus" in aba) { aba.navigate(url); return aba.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});

// Necessário para o app ser "instalável" no celular
self.addEventListener("fetch", () => {});
