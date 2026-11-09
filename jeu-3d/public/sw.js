// Service worker de Kan : permet l'installation et un démarrage rapide, même avec une connexion faible.
// Les appels /api ne sont JAMAIS mis en cache (données de santé, sessions, audio).
const VERSION = 'kan-v3';
const SHELL = ['/', '/css/game.css', '/assistant/', '/assistant/assistant.css', '/assistant/assistant.js', '/maternite/', '/maternite/maternite.css', '/maternite/app.js', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/health') return; // réseau uniquement
  if (url.pathname.startsWith('/admin') || url.pathname === '/sw.js') return;
  // pages : réseau d'abord, copie en cache si hors ligne
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return r; })
      .catch(() => caches.match(req).then(r => r || caches.match('/assistant/') || caches.match('/'))));
    return;
  }
  // fichiers statiques : cache d'abord, mis à jour en arrière-plan
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
