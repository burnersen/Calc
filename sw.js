/* Calc – Service Worker: legt beim ersten Besuch JEDE Datei der App auf dem Gerät ab.
   Danach kommt alles aus diesem Vorrat, auch ganz ohne Internet, dauerhaft.
   Das Netz wird nur gefragt, ob es eine neue Version gibt. Die Liste und die Prüfsumme schreibt tools/build-release.php,
   ändert sich eine Datei, ändert sich BUILD, und der Browser holt die neue Version im Hintergrund.
   Einstellungen, Verlauf und Streifen liegen nicht hier, sondern im Speicher des Browsers (localStorage). */
'use strict';
const VERSION = '1.0.1';
const BUILD = 'b7b52291e9c2';
const FILES = [
    './',
    'index.html',
    'manifest.webmanifest',
    'app/css/app.css',
    'app/css/themes.css',
    'app/fonts/dseg14-classic.woff2',
    'app/fonts/dseg14-modern.woff2',
    'app/fonts/dseg7-classic.woff2',
    'app/fonts/dseg7-modern.woff2',
    'app/fonts/inter.woff2',
    'app/fonts/jetbrains-mono.woff2',
    'app/fonts/manrope.woff2',
    'app/fonts/space-grotesk.woff2',
    'app/icons/apple-touch-icon.png',
    'app/icons/icon-192.png',
    'app/icons/icon-512.png',
    'app/icons/icon-maskable-512.png',
    'app/icons/icon.svg',
    'app/js/app.js',
    'app/js/boot.js',
    'app/js/decimal.js',
    'app/js/engine.js',
    'app/js/format.js',
    'app/js/i18n.js',
    'app/js/layouts.js',
    'app/js/office.js',
    'app/js/settings.js',
    'app/js/store.js',
    'app/js/theme.js',
    'app/js/ui.js',
    'app/js/views.js',
];
const CACHE = 'calc-' + VERSION + '-' + BUILD;

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))));
    // beim allerersten Mal sofort übernehmen, bei Updates wartet die neue Version auf „Jetzt laden“
    e.waitUntil(self.clients.matchAll().then(list => { if (!list.length) return self.skipWaiting(); }));
});

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys()
        .then(keys => Promise.all(keys.filter(k => k.startsWith('calc-') && k !== CACHE).map(k => caches.delete(k))))
        .then(() => self.clients.claim()));
});

self.addEventListener('message', e => {
    if (e.data && e.data.type === 'skip') self.skipWaiting();
});

self.addEventListener('fetch', e => {
    const req = e.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== location.origin) return;
    if (req.mode === 'navigate') {
        // jede Seite der App ist index.html (auch ./?mode=office)
        e.respondWith(caches.open(CACHE).then(c => c.match('./', { ignoreSearch: true }))
            .then(r => r || caches.match('index.html', { ignoreSearch: true }))
            .then(r => r || fetch(req)));
        return;
    }
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req)));
});
