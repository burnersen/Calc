/**
 * Calc – App-Symbole als PNG aus den SVG-Vorlagen in tools/icon-src/ bauen. Braucht Node.js und Playwright mit Chromium.
 *
 *   node tools/make-icons.js
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'app/icons');
const svg = f => fs.readFileSync(path.join(__dirname, 'icon-src', f), 'utf8');
const JOBS = [
    ['icon.svg', 'icon-192.png', 192],
    ['icon.svg', 'icon-512.png', 512],
    ['maskable.svg', 'icon-maskable-512.png', 512],
    ['maskable.svg', 'apple-touch-icon.png', 180],
];
(async () => {
    const br = await chromium.launch();
    const page = await br.newPage({ deviceScaleFactor: 1 });
    for (const [src, out, size] of JOBS) {
        await page.setViewportSize({ width: size, height: size });
        await page.setContent('<html><body style="margin:0;background:transparent">' + svg(src).replace('<svg ', '<svg width="' + size + '" height="' + size + '" ') + '</body></html>');
        await page.screenshot({ path: path.join(OUT, out), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
        console.log('app/icons/' + out);
    }
    fs.copyFileSync(path.join(__dirname, 'icon-src', 'icon.svg'), path.join(OUT, 'icon.svg'));
    await br.close();
})();
