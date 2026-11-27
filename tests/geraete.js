/**
 * Calc – Bedienbarkeit auf Geräten prüfen (Handy, Tablet, Rechner, hoch und quer). Braucht Node.js und Playwright mit Chromium.
 * Startet selbst einen kleinen Webserver für den Ordner, kein PHP nötig.
 *
 *   node tests/geraete.js
 *   DEVS="iPhone SE,Pixel 7" THEMES="klar,schule" SHOTS=1 OUT=/tmp/geraete node tests/geraete.js
 *
 * Meldet pro Gerät, Modus und Design:
 *   overflow  – etwas ragt über den Bildschirm hinaus oder die Seite scrollt
 *   small     – Tasten kleiner als 40 px (am Rechner 32 px): schwer zu treffen
 *   clipped   – Beschriftung passt nicht auf die Taste
 *   input     – ein Eingabefeld ist sichtbar oder hat den Fokus (am Handy klappt sonst die Tastatur auf)
 *   errors    – JavaScript-Fehler
 * Zum Schluss: Offline-Test (Seite laden, Netz aus, neu laden, rechnen).
 */
'use strict';
const { chromium, devices } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = (process.env.OUT || require('os').tmpdir() + '/calc-geraete') + '/';
const SHOTS = !!process.env.SHOTS;
const DEVS = (process.env.DEVS || 'iPhone SE,iPhone 15 Pro Max,Pixel 7,Galaxy S9+,iPad Mini,iPad Pro 11,Desktop,Laptop').split(',');
const THEMES = (process.env.THEMES || 'klar,nacht,aurora,schule,retro,papier,kontrast').split(',');
const MODES = (process.env.MODES || 'basic,sci,office').split(',');
fs.mkdirSync(OUT, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
function serve() {
    return new Promise(res => {
        const srv = http.createServer((req, rsp) => {
            let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
            if (p.endsWith('/')) p += 'index.html';
            const f = path.join(ROOT, p);
            if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
            rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
            fs.createReadStream(f).pipe(rsp);
        });
        srv.listen(0, '127.0.0.1', () => res(srv));
    });
}

function devOpts(dn, land) {
    let o;
    if (dn === 'Desktop') o = { viewport: { width: 1440, height: 900 } };
    else if (dn === 'Laptop') o = { viewport: { width: 1280, height: 680 } };
    else o = Object.assign({}, devices[dn]);
    delete o.defaultBrowserType;
    if (land && o.viewport) o.viewport = { width: o.viewport.height, height: o.viewport.width };
    return o;
}

async function check(page, mode) {
    return page.evaluate(mode => {
        const out = { overflow: [], small: [], clipped: [], input: [] };
        const W = innerWidth, H = innerHeight;
        const de = document.documentElement;
        if (de.scrollWidth > W + 1 || de.scrollHeight > H + 1) out.overflow.push('Seite ' + de.scrollWidth + '×' + de.scrollHeight);
        const view = document.getElementById('v-' + mode);
        const desk = !matchMedia('(pointer: coarse)').matches;
        for (const el of view.querySelectorAll('.k, .disp, .tape, .chip, .bar button')) {
            const r = el.getBoundingClientRect();
            if (r.width === 0) continue;
            if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) out.overflow.push((el.dataset.k || el.className) + ' ' + Math.round(r.right) + '/' + Math.round(r.bottom));
            if (el.classList.contains('k')) {
                const min = desk ? 32 : 40;
                const st = getComputedStyle(el, '::before');
                const fh = r.height - (parseFloat(st.top) || 0) - (parseFloat(st.bottom) || 0);
                if (r.width < min || fh < (desk ? 26 : 30)) out.small.push(el.dataset.k + ' ' + Math.round(r.width) + '×' + Math.round(fh));
                const lb = el.querySelector('.lb');
                if (lb && lb.scrollWidth > lb.clientWidth + 2) out.clipped.push(el.dataset.k);
            }
        }
        for (const i of document.querySelectorAll('input, textarea, select')) {
            const r = i.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) out.input.push(i.outerHTML.slice(0, 60));
        }
        if (document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) out.input.push('Fokus');
        return out;
    }, mode);
}

(async () => {
    const srv = await serve();
    const B = 'http://127.0.0.1:' + srv.address().port + '/';
    const br = await chromium.launch();
    const report = [];
    let problems = 0;
    for (const dn of DEVS) {
        for (const land of dn === 'Desktop' || dn === 'Laptop' ? [false] : [false, true]) {
            const ctx = await br.newContext(Object.assign(devOpts(dn, land), { serviceWorkers: 'block' }));
            const page = await ctx.newPage();
            const errors = [];
            page.on('pageerror', e => errors.push(e.message));
            page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
            await page.goto(B);
            await page.waitForSelector('.view.on .k');
            for (const theme of THEMES) {
                await page.evaluate(th => { Calc.app.set({ theme: th }); }, theme);
                for (const mode of MODES) {
                    await page.evaluate(m => Calc.app.setMode(m, true), mode);
                    // etwas eintippen, damit die Anzeige gefüllt ist
                    await page.evaluate(m => {
                        const v = Calc.app.views[m];
                        if (m === 'office') { if (!v.o.lines.length) for (const k of '1250+899+S4*3=+T'.replace(/\*/g, '*').split('')) v.press(k === 'S' ? 'S' : k === 'T' ? 'T' : k); }
                        else if (!v.calc.history.length) { for (const k of (m === 'sci' ? ['fn:sin', '3', '0', 'rp', '+', 'fn:sqrt', '2', 'rp', '='] : ['1', '2', '3', '4', '+', '5', '6', '7', '*', '8', '='])) v.press(k); }
                        v.render();
                    }, mode);
                    await page.waitForTimeout(60);
                    const r = await check(page, mode);
                    const name = dn + (land ? ' quer' : '') + ' · ' + mode + ' · ' + theme;
                    const bad = Object.entries(r).filter(([, v]) => v.length);
                    if (bad.length) { problems++; report.push(name + ': ' + bad.map(([k, v]) => k + ' ' + v.slice(0, 6).join(', ')).join(' | ')); }
                    if (SHOTS) await page.screenshot({ path: OUT + (dn + (land ? '-quer' : '') + '-' + mode + '-' + theme).replace(/\s+/g, '_') + '.png' });
                }
            }
            if (errors.length) { problems++; report.push(dn + (land ? ' quer' : '') + ': errors ' + [...new Set(errors)].slice(0, 5).join(' | ')); }
            await ctx.close();
        }
    }

    // Offline: einmal laden, Netz aus, neu laden, rechnen
    {
        const ctx = await br.newContext({ viewport: { width: 400, height: 800 } });
        const page = await ctx.newPage();
        await page.goto(B);
        await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {});
        const ready = await page.evaluate(async () => { const k = await caches.keys(); return k.length ? (await (await caches.open(k[0])).keys()).length : 0; });
        await ctx.setOffline(true);
        let ok = false;
        try {
            await page.reload();
            await page.waitForSelector('.view.on .k', { timeout: 5000 });
            ok = await page.evaluate(() => { const v = Calc.app.views.basic; Calc.app.setMode('basic', true); v.press('ac'); for (const k of ['7', '*', '6', '=']) v.press(k); return v.calc.res === '42'; });
            const fonts = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter(f => f.status === 'error').map(f => f.family); });
            if (fonts.length) { problems++; report.push('Offline: Schriften fehlen ' + fonts.join(', ')); }
        } catch (e) { ok = false; }
        if (!ok) { problems++; report.push('Offline: Calc startet ohne Netz nicht (' + ready + ' Dateien im Vorrat)'); }
        else console.log('Offline: ok (' + ready + ' Dateien im Vorrat, Neustart ohne Netz, 7 × 6 = 42)');
        await ctx.close();
    }

    await br.close();
    srv.close();
    console.log(report.length ? report.join('\n') : 'Alles in Ordnung.');
    if (SHOTS) console.log('Bilder: ' + OUT);
    process.exit(problems ? 1 : 0);
})();
