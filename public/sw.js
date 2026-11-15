// Service worker: recebe as notificações push e abre o app ao tocar
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { titulo: event.data && event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(d.titulo || "Academia", {
      body: d.texto || "",
      icon: d.icone || "/icon-192.png",
      image: d.imagem || undefined,
      badge: "/icon-192.png",
      data: { url: d.url || "/", acoes: d.acoes || [] },
      actions: (d.acoes || []).map((a) => ({ action: a.id, title: a.titulo })),
      tag: d.tag || undefined,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const dados = event.notification.data || {};
  // botão da notificação: tenta fazer direto (sem abrir o app); se não der, abre a tela da ação
  const acao = event.action && (dados.acoes || []).find((a) => a.id === event.action);
  if (acao) {
    const q = acao.url.split("?")[1] || "";
    event.waitUntil(
      fetch("/api/acao?" + q, { method: "POST", credentials: "include" })
        .then((r) => r.json().then((j) => ({ ok: r.ok && j.ok, j })))
        .then(({ ok, j }) => ok
          ? self.registration.showNotification("Feito ✓", { body: j.texto, icon: "/icon-192.png", tag: "acao-ok" })
          : self.clients.openWindow(acao.url + (acao.url.includes("?") ? "&" : "?") + "auto=1"))
        .catch(() => self.clients.openWindow(acao.url + (acao.url.includes("?") ? "&" : "?") + "auto=1"))
    );
    return;
  }
  const url = dados.url || "/";
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
