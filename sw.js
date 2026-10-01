/* Village App — Service Worker  v6 · 2026-10-01 */
const SHELL_CACHE = 'vapp-shell-v6-2';
const TILE_CACHE = 'vapp-tiles-v1';
const MAX_TILES = 400;
const SHELL = [
  './', './index.html', './manifest.json', './icon-192.png', './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c =>
    Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== SHELL_CACHE && k !== TILE_CACHE).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // ข้อมูลสด (GAS, สภาพอากาศ) ไม่ cache — ตัวแอปมี cache ของตัวเองอยู่แล้ว
  if (/script\.google|googleusercontent|open-meteo|drive\.google/.test(url.hostname)) return;

  // หน้าแอป: เอาของใหม่ก่อน ถ้าไม่มีเน็ตใช้ของเก่า
  if (req.mode === 'navigate' || (url.origin === location.origin && url.pathname.endsWith('.html'))) {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone();
      caches.open(SHELL_CACHE).then(c => c.put('./index.html', copy));
      return res;
    }).catch(() => caches.match('./index.html')));
    return;
  }

  // แผนที่: ใช้ของในเครื่องก่อน (ประหยัดเน็ต)
  if (url.hostname === 'server.arcgisonline.com') {
    e.respondWith(caches.open(TILE_CACHE).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') {
        c.put(req, res.clone());
        c.keys().then(keys => { if (keys.length > MAX_TILES) keys.slice(0, keys.length - MAX_TILES).forEach(k => c.delete(k)); });
      }
      return res;
    }));
    return;
  }

  // ไฟล์อื่น (Leaflet, ฟอนต์, ไอคอน): ใช้ของเก่าทันที แล้วอัปเดตเบื้องหลัง
  e.respondWith(caches.open(SHELL_CACHE).then(async c => {
    const hit = await c.match(req);
    const net = fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});
