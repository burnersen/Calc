/**
 * Calc – Bilder für die README (docs/de, docs/en) und fürs Installationsfenster (app/shots) erzeugen.
 * Braucht Node.js und Playwright mit Chromium. Danach verkleinert PHP (GD) die PNG-Dateien.
 *
 *   node tools/screenshots.js && php tools/shrink-png.php docs app/shots
 */
'use strict';
const { chromium, devices } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

const phone = Object.assign({}, devices['iPhone 13'], { deviceScaleFactor: 2 }); delete phone.defaultBrowserType;
const phoneLand = Object.assign({}, phone, { viewport: { width: 844, height: 390 } });
const desk = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };

// Beispielrechnungen (erfunden)
const FILL = {
    basic: ['1', '2', '4', '8', 'dot', '5', '*', '1', '9', 'pct', '='],
    sci: ['fn:sin', '3', '0', 'rp', '+', 'fn:sqrt', '2', 'rp', '*', 'const:pi', '='],
    office: { title: { de: 'Materialeinkauf', en: 'Supplies' }, keys: ['1', '2', '4', '9', 'dot', '9', '0', '+', '3', '8', '9', 'dot', '5', '0', '+', '7', '5', '+', 'S', '2', '4', 'dot', '9', '9', '*', '3', '=', '+', 'T'] },
};

const SHOTS = [
    // name, Gerät, Modus, Design, Extra
    ['einfach', phone, 'basic', 'klar'],
    ['wissenschaftlich', phone, 'sci', 'schule'],
    ['buero', phone, 'office', 'papier'],
    ['nacht', phone, 'sci', 'nacht'],
    ['aurora', phone, 'basic', 'aurora'],
    ['retro', phone, 'basic', 'retro'],
    ['kontrast', phone, 'office', 'kontrast'],
    ['designs', phone, 'basic', 'klar', 'picker'],
    ['farbmischer', phone, 'basic', 'klar', 'mixer'],
    ['streifen', phone, 'office', 'klar', 'linemenu'],
    ['quer', phoneLand, 'sci', 'schule'],
    ['computer', desk, 'office', 'klar'],
    ['computer-wissenschaftlich', desk, 'sci', 'aurora'],
];

function serve() {
    return new Promise(res => {
        const srv = http.createServer((req, rsp) => {
            let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
            if (p.endsWith('/')) p += 'index.html';
            const f = path.join(ROOT, p);
            if (!f.startsWith(ROOT) || !fs.existsSync(f)) { rsp.writeHead(404); return rsp.end(); }
            rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
            fs.createReadStream(f).pipe(rsp);
        });
        srv.listen(0, '127.0.0.1', () => res(srv));
    });
}

(async () => {
    const srv = await serve();
    const B = 'http://127.0.0.1:' + srv.address().port + '/';
    const br = await chromium.launch();
    for (const lang of ['de', 'en']) {
        const dir = path.join(ROOT, 'docs', lang);
        fs.mkdirSync(dir, { recursive: true });
        for (const [name, dev, mode, theme, extra] of SHOTS) {
            const ctx = await br.newContext(Object.assign({}, dev, { locale: lang === 'de' ? 'de-DE' : 'en-GB', serviceWorkers: 'block', colorScheme: 'light' }));
            const page = await ctx.newPage();
            await page.goto(B);
            await page.waitForSelector('.view.on .k');
            await page.evaluate(([mode, theme, FILL, lang]) => {
                Calc.app.set({ theme, lang });
                Calc.app.setMode(mode, true);
                for (const m of ['basic', 'sci']) { const v = Calc.app.views[m]; for (const k of FILL[m]) v.press(k); }
                const o = Calc.app.views.office;
                o.o.setTitle(FILL.office.title[lang]);
                for (const k of FILL.office.keys) o.press(k);
                for (const k of ['1', '9', 'dot', '9', '9']) o.press(k);
                const v = Calc.app.views.office.o;
                const l = v.lines.find(x => x.v === '75');
                if (l) v.setNote(l.ev + ':' + l.i, lang === 'de' ? 'Schrauben' : 'Screws');
                const l2 = v.lines.find(x => x.v === '1249.9');
                if (l2) v.setNote(l2.ev + ':' + l2.i, lang === 'de' ? 'Holz' : 'Wood');
                Calc.app.refresh();
            }, [mode, theme, FILL, lang]);
            await page.evaluate(() => document.fonts.ready);
            if (extra === 'picker') await page.evaluate(() => Calc.theme.picker());
            if (extra === 'mixer') {
                await page.evaluate(() => Calc.theme.mixer());
                await page.waitForTimeout(300);
                await page.evaluate(() => { const i = document.querySelector('.mrow input[type=color]'); i.value = '#0d9488'; i.dispatchEvent(new Event('input')); });
                await page.click('.chips button >> nth=7').catch(() => {});
            }
            if (extra === 'linemenu') { await page.evaluate(() => { const el = [...document.querySelectorAll('#v-office .tl')].find(e => e._line && e._line.v === '75'); el.click(); }); }
            await page.waitForTimeout(500);
            await page.screenshot({ path: path.join(dir, name + '.png') });
            if (lang === 'de' && name === 'einfach') { fs.mkdirSync(path.join(ROOT, 'app/shots'), { recursive: true }); await page.screenshot({ path: path.join(ROOT, 'app/shots/narrow.png') }); }
            if (lang === 'de' && name === 'computer') await page.screenshot({ path: path.join(ROOT, 'app/shots/wide.png'), scale: 'css' });
            console.log('docs/' + lang + '/' + name + '.png');
            await ctx.close();
        }
    }
    await br.close();
    srv.close();
})();
