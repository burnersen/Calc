/* Calc – läuft vor dem ersten Bild: setzt das zuletzt benutzte Design, damit nichts in falschen Farben aufblitzt.
   Den Merkzettel dazu schreibt theme.js (apply). */
(function () {
    'use strict';
    try {
        const p = JSON.parse(localStorage.getItem('calc_paint'));
        const root = document.documentElement;
        if (p && typeof p.theme === 'string' && /^[a-z]{2,12}$/.test(p.theme)) {
            root.dataset.theme = p.theme;
            for (const k in p.vars || {}) if (/^--[a-z0-9-]{1,30}$/.test(k)) root.style.setProperty(k, String(p.vars[k]));
            const meta = document.querySelector('meta[name="theme-color"]');
            if (meta && p.tc) meta.content = String(p.tc);
            root.dataset.motion = p.motion === 'off' ? 'off' : 'auto';
        } else if (matchMedia('(prefers-color-scheme: dark)').matches) {
            root.dataset.theme = 'nacht';
        }
    } catch (e) { /* dann eben die Standardfarben */ }
})();
