/**
 * Calc – Tests für den Rechenkern (Dezimalzahlen, Ausdrücke, Tischrechner), Übersetzungen, Designs und Dateiliste.
 * Braucht nur Node.js (ab 18), keine Pakete.
 *
 *   node tests/run.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ctx = { console, self: {} };
ctx.self = ctx;
vm.createContext(ctx);
for (const f of ['decimal.js', 'format.js', 'engine.js', 'office.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'app/js', f), 'utf8'), ctx, { filename: f });
}
const C = ctx.Calc;
const { Dec, ExprCalc, Office } = C;

let pass = 0, fail = 0;
function eq(got, want, what) {
    if (String(got) === String(want)) { pass++; return; }
    fail++;
    console.log('FEHLER  ' + what + '\n        erwartet: ' + want + '\n        bekommen: ' + got);
}

/* ---------- Dezimalzahlen ---------- */
const D = s => Dec.from(s);
eq(D('0.1').add('0.2'), '0.3', '0,1 + 0,2');
eq(D('1').div('3').mul('3').roundSig(15), '1', '1/3 × 3');
eq(D('10').div('4'), '2.5', '10 / 4');
eq(D('-7').mod('3'), '2', '−7 mod 3');
eq(D('2').powInt(100), '1267650600228229401496703205376', '2^100');
eq(D('2').powInt(-2), '0.25', '2^−2');
eq(D('2.25').sqrt(), '1.5', '√2,25');
eq(D('2').sqrt().roundSig(20), '1.4142135623730950488', '√2');
eq(D('2.345').round(2), '2.35', 'kaufmännisch runden');
eq(D('-2.345').round(2), '-2.35', 'kaufmännisch runden negativ');
eq(D('2.341').round(2, 'up'), '2.35', 'aufrunden');
eq(D('2.349').round(2, 'down'), '2.34', 'abschneiden');
eq(D('1e5').toPlain(), '100000', '1e5');
eq(D('0.00012').adj(), '-4', 'adj');
eq(D('123.4500').toPlain(), '123.45', 'Nullen hinten');

/* ---------- Anzeige ---------- */
const de = { dec: ',', grp: '.' };
eq(C.fmt.num(D('1234567.891'), de).text, '1.234.567,891', 'Tausender');
eq(C.fmt.num(D('-0.5'), de).text, '−0,5', 'Minus');
eq(C.fmt.num(D('1e20'), de).text, '1E20', 'groß');
eq(C.fmt.num(D('1.5e-9'), de).text, '1,5E−9', 'klein');
eq(C.fmt.num(D('2'), Object.assign({ mode: 'fix', places: 2 }, de)).text, '2,00', 'FIX 2');
eq(C.fmt.num(D('12345'), Object.assign({ mode: 'sci', places: 3 }, de)).text, '1,23E4', 'SCI 3');
eq(C.fmt.num(D('12345'), Object.assign({ mode: 'eng' }, de)).text, '12,345E3', 'ENG');
eq(C.fmt.entry('1234.', de).text, '1.234,', 'Eingabe mit Komma');
const fr = C.fmt.fraction(D('0.75'));
eq(fr && fr.n + '/' + fr.d, '3/4', 'Bruch 0,75');
const fr3 = C.fmt.fraction(D('1').div(3));
eq(fr3 && fr3.n + '/' + fr3.d, '1/3', 'Bruch 1/3');
eq(C.fmt.fraction(Dec.PI), 'null', 'π ist kein Bruch');
eq(C.fmt.dms(D('12.5')), '12°30′0″', 'Grad Minuten');

/* ---------- Ausdrücke ---------- */
function calc(keys, kind, opts) {
    const c = new ExprCalc(kind || 'sci');
    Object.assign(c, opts || {});
    for (const k of keys) c.press(k);
    if (!c.shown && !c.err) c.press('=');
    return c.err ? 'E:' + c.err : C.fmt.num(D(c.res), { dec: '.', grp: '', group: false, sig: 12 }).text;
}
const K = s => s.split(' ');
eq(calc(K('2 + 3 * 4')), '14', 'Punkt vor Strich');
eq(calc(K('lp 2 + 3 rp * 4')), '20', 'Klammern');
eq(calc(K('lp 2 + 3 * 4')), '14', 'Klammer schließt sich selbst');
eq(calc(K('neg 2 ^ 2')), '−4', '−2² = −4');
eq(calc(K('lp neg 2 rp ^ 2')), '4', '(−2)² = 4');
eq(calc(K('2 ^ 3 ^ 2')), '512', 'Potenz von rechts');
eq(calc(K('fn:sin 3 0')), '0.5', 'sin 30°');
eq(calc(K('fn:sin 1 8 0')), '0', 'sin 180°');
eq(calc(K('fn:cos 9 0')), '0', 'cos 90°');
eq(calc(K('fn:tan 9 0')), 'E:math', 'tan 90° Fehler');
eq(calc(K('fn:tan 4 5')), '1', 'tan 45°');
eq(calc(K('fn:sin const:pi'), 'sci', { angle: 'rad' }), '0', 'sin π (RAD)');
eq(calc(K('fn:sin 1 0 0'), 'sci', { angle: 'grad' }), '1', 'sin 100 gon');
eq(calc(K('fn:asin 0 dot 5')), '30', 'sin⁻¹ 0,5');
eq(calc(K('fn:log 1 0 0 0')), '3', 'log 1000');
eq(calc(K('fn:ln const:e')), '1', 'ln e');
eq(calc(K('fn:sqrt 1 4 4')), '12', '√144');
eq(calc(K('fn:cbrt 2 7')), '3', '∛27');
eq(calc(K('fn:cbrt neg 8')), '−2', '∛−8');
eq(calc(K('3 root 8')), '2', '³√8 über ˣ√');
eq(calc(K('8 ^ lp 1 / 3')), '2', '8^(1/3)');
eq(calc(K('5 post:!')), '120', '5!');
eq(calc(K('1 0 nCr 3')), '120', '10 C 3');
eq(calc(K('1 0 nPr 3')), '720', '10 P 3');
eq(calc(K('2 const:pi')), '6.28318530718', '2π');
eq(calc(K('1 / 2 const:pi')), '0.159154943092', '1 ÷ 2π (Mal ohne Zeichen zuerst)');
eq(calc(K('1 / 2 const:pi'), 'sci', { implicitStrong: false }), '1.57079632679', '1 ÷ 2π (wie ×)');
eq(calc(K('2 lp 3 + 4')), '14', '2(3+4)');
eq(calc(K('1 0 post:inv')), '0.1', '10⁻¹');
eq(calc(K('3 post:sq + 4 post:sq')), '25', 'x²');
eq(calc(K('2 0 0 + 1 0 pct'), 'basic'), '220', '200 + 10 %');
eq(calc(K('2 0 0 - 1 0 pct'), 'basic'), '180', '200 − 10 %');
eq(calc(K('2 0 0 * 1 0 pct'), 'basic'), '20', '200 × 10 %');
eq(calc(K('5 / 0')), 'E:math', 'durch null');
eq(calc(K('1 0 ^ 1 0 0 0 0')), 'E:overflow', 'Überlauf');
eq(calc(K('1 EE 3 + 1')), '1001', '1E3 + 1');
eq(calc(K('1 EE - 3')), '0.001', '1E−3');
eq(calc(K('7 mod 3')), '1', 'mod');
eq(calc(K('fn:abs neg 5')), '5', 'Abs');
eq(calc(K('fn:pow10 2')), '100', '10^2');
eq(calc(K('2 +')), 'E:syntax', 'unvollständig (wissenschaftlich)');
eq(calc(K('2 +'), 'basic'), '2', 'unvollständig (einfach)');
eq(calc(K('0 dot 1 + 0 dot 2'), 'basic'), '0.3', '0,1 + 0,2 einfach');

// nochmal „=“ wiederholt die letzte Rechenart
{
    const c = new ExprCalc('basic');
    for (const k of K('5 + 3 = = =')) c.press(k);
    eq(c.res, '14', '5 + 3 = = =');
}
// Ergebnis weiterverwenden
{
    const c = new ExprCalc('basic');
    for (const k of K('5 + 3 = * 2 =')) c.press(k);
    eq(c.res, '16', 'Ergebnis × 2');
    for (const k of K('7')) c.press(k);
    eq(c.tokens.length + ':' + c.tokens[0].s, '1:7', 'neue Ziffer fängt neu an');
}
// Ans im wissenschaftlichen Modus, = wiederholt die Rechnung
{
    const c = new ExprCalc('sci');
    for (const k of K('2 = + 1 = =')) c.press(k);
    eq(c.res, '4', 'Ans + 1 = =');
}
// ± im einfachen Modus
{
    const c = new ExprCalc('basic');
    for (const k of K('5 + 3 pm =')) c.press(k);
    eq(c.res, '2', '5 + (−3)');
}
// Speicher
{
    const c = new ExprCalc('sci');
    for (const k of K('5 mplus 3 mplus ac var:M * 2 =')) c.press(k);
    eq(c.res, '16', 'M+ und M');
}
// Rechenzeichen tauschen, Minus nach Mal ist Vorzeichen
{
    const c = new ExprCalc('basic');
    for (const k of K('6 + * 2 =')) c.press(k);
    eq(c.res, '12', 'Rechenzeichen tauschen');
    const d = new ExprCalc('basic');
    for (const k of K('6 * - 2 =')) d.press(k);
    eq(d.res, '-12', '6 × −2');
}
// Löschen
{
    const c = new ExprCalc('basic');
    for (const k of K('1 2 3 del del 4 =')) c.press(k);
    eq(c.res, '14', 'Ziffern löschen');
}

/* ---------- Tischrechner ---------- */
function office(keys, cfg) {
    const o = new Office(null);
    if (cfg) o.setCfg(cfg);
    for (const k of keys) o.press(k);
    return o;
}
const fx = (o, v) => C.Office.lineValue({ v: v.toPlain ? v.toPlain() : v, dp: o.dp(), kind: 'res' }, { dec: '.', grp: '' });
{
    const o = office(K('1 2 + 5 + 3 - S 1 0 + T'), { logic: 'add', dec: '2' });
    const marks = o.lines.map(l => (l.v == null ? '' : Office.lineValue(l, { dec: '.', grp: '' })) + l.mark).join(' ');
    eq(marks, '12.00+ 5.00+ 3.00− 14.00◇ 10.00+ 24.00✱', 'Tischrechner: + − ◇ ✱');
    eq(o.gt, '24', 'GT nach Summe');
    eq(o.items, 0, 'Postenzähler nach Summe');
}
{
    const o = office(K('1 2 * 3 = +'), { logic: 'add' });
    eq(o.acc, '36', 'Tischrechner: Produkt addieren');
}
{
    const o = office(K('1 2 * 3 + 4 + T'), { logic: 'add' });
    eq(o.lines.filter(l => l.kind === 'tot')[0].v, '40', 'Tischrechner: 12×3 + 4');
}
{
    const o = office(K('1 0 0 0 0 + 2 5 0 +'), { logic: 'add', dec: 'A' });
    eq(o.acc, '102.5', 'Addiermodus: Cent automatisch');
}
{
    const o = office(K('1 2 + 5 * 2 ='), { logic: 'arith' });
    eq(o.disp, '34', 'normale Logik ohne Punkt vor Strich');
}
{
    const o = office(K('2 0 0 + 1 5 pct'), { logic: 'arith' });
    eq(o.disp, '230', 'Aufschlag 15 %');
    const p = office(K('2 0 0 - 1 5 pct'), { logic: 'arith' });
    eq(p.disp, '170', 'Rabatt 15 %');
}
{
    const o = office(K('1 0 0 taxp'), { tax: '19' });
    eq(o.disp, '119', 'Steuer +');
    const p = office(K('1 1 9 taxm'), { tax: '19' });
    eq(p.disp, '100', 'Steuer −');
}
{
    const o = office(K('8 0 mu 2 0 ='), { logic: 'add' });
    eq(o.disp, '100', 'Aufschlag auf Marge (EK 80, 20 % Marge)');
    const p = office(K('8 0 delta 1 0 0 ='), { logic: 'arith' });
    eq(p.disp, '25', 'Δ% 80 → 100');
}
{
    const o = office(K('1 0 + 2 0 + 3 0 + T'), { logic: 'add' });
    const ev = o.tape.events.find(e => e.v === '20');
    o.editValue(ev.id, '25');
    eq(o.lines.filter(l => l.kind === 'tot')[0].v, '65', 'Zeile korrigieren rechnet neu');
    o.deleteEvent(ev.id);
    eq(o.lines.filter(l => l.kind === 'tot')[0].v, '40', 'Zeile löschen rechnet neu');
    o.undo();
    eq(o.entry, null, 'Rückgängig (Summe)');
    eq(o.acc, '40', 'Rückgängig stellt Stand wieder her');
}
{
    const o = office(K('1 0 0 mplus 5 0 mplus mr + T'), { logic: 'add' });
    eq(o.lines.filter(l => l.kind === 'tot')[0].v, '150', 'Speicher MR');
}
{
    const o = office(K('1 / 0 ='), { logic: 'arith' });
    eq(o.err, 'math', 'Tischrechner: durch null');
}
{
    const o = office(K('1 0 + 2 0 + T 5 + T GT GT'), { logic: 'add' });
    eq(o.lines.filter(l => l.kind === 'gt').map(l => l.v).join(','), '35,35', 'GT zweimal');
    eq(o.gt, '0', 'GT gelöscht');
}
{
    const o = office(K('1 0 + 2 0 *'), { logic: 'arith' });
    o.press('+');
    eq(o.lines[o.lines.length - 1].mark, '+', 'normale Logik: Zeichen tauschen');
}

/* ---------- Übersetzungen: jeder Text im Code hat eine englische Fassung ---------- */
(function () {
    const i18n = path.join(ROOT, 'app/js/i18n.js');
    if (!fs.existsSync(i18n)) return;
    const ictx = { self: {} };
    ictx.self = ictx;
    vm.createContext(ictx);
    vm.runInContext(fs.readFileSync(i18n, 'utf8'), ictx);
    const EN = ictx.Calc.EN;
    const missing = new Set();
    for (const f of fs.readdirSync(path.join(ROOT, 'app/js'))) {
        const src = fs.readFileSync(path.join(ROOT, 'app/js', f), 'utf8');
        for (const m of src.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)) {
            const s = m[1].replace(/\\'/g, "'");
            if (!(s in EN)) missing.add(s);
        }
        for (const m of src.matchAll(/\b(?:label|n|s|name|d): '((?:[^'\\]|\\.)*)'/g)) if (/[A-Za-zÄÖÜäöüß]{2}/.test(m[1]) && !(m[1] in EN)) missing.add(m[1]);
        for (const m of src.matchAll(/\b(?:sw|chips)\('\w*', '([^']+)'(?:, (?:\[[^\]]*(?:\][^\]]*)*?\]\]|'[^']*'))?(?:, '([^']+)')?/g)) for (const x of [m[1], m[2]]) if (x && !(x in EN)) missing.add(x);
        for (const m of src.matchAll(/\brow\(\[[^\]]*\], '([^']+)'\)/g)) if (!(m[1] in EN)) missing.add(m[1]);
        for (const m of src.matchAll(/(?:ERRORS|LOGIC|ROUND_N|KIND) = \{([^}]*)\}/g)) for (const v of m[1].matchAll(/: '([^']+)'/g)) if (!(v[1] in EN)) missing.add(v[1]);
        // Texte in Listen wie [['auto', 'Wie das Gerät'], …] und ['--acc', 'Akzent', '…']
        for (const m of src.matchAll(/\[\s*(?:'[^']*'|[\d.]+)\s*,\s*'([^']*[a-zäöüß][^']*)'(?:\s*,\s*'([^']*)')?/g)) for (const x of [m[1], m[2]]) if (x && /[a-zäöüß]{3}/.test(x) && !/^--|^'|^\w+\(|^[a-z]+$/.test(x) && !(x in EN)) missing.add(x);
    }
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    for (const m of html.matchAll(/data-i18n(?:-label|-title)?="([^"]*)"/g)) if (!(m[1] in EN)) missing.add(m[1]);
    eq([...missing].join(' | '), '', 'englische Texte vollständig');
})();

/* ---------- Designs: Kontrast reicht überall ---------- */
(function () {
    const css = path.join(ROOT, 'app/css/themes.css');
    if (!fs.existsSync(css)) return;
    const src = fs.readFileSync(css, 'utf8');
    const themes = {};
    for (const m of src.matchAll(/\[data-theme="([a-z-]+)"\]\s*\{([^}]*)\}/g)) {
        const vars = themes[m[1]] = themes[m[1]] || {};
        for (const v of m[2].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) vars[v[1]] = v[2].trim();
    }
    const hex = s => {
        const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s || '');
        if (!m) return null;
        let h = m[1];
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
    };
    const lum = c => {
        const f = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const PAIRS = [
        ['--disp-fg', '--disp-bg', 7], ['--disp-dim', '--disp-bg', 3],
        ['--num-fg', '--num-bg', 4.5], ['--op-fg', '--op-bg', 4.5], ['--fn-fg', '--fn-bg', 4.5],
        ['--eq-fg', '--eq-bg', 4.5], ['--del-fg', '--del-bg', 4.5],
        ['--text', '--card', 7], ['--muted', '--card', 4.5], ['--acc-fg', '--acc', 4.5],
        ['--tape-ink', '--tape-bg', 7], ['--tape-neg', '--tape-bg', 4.5], ['--tape-dim', '--tape-bg', 4.5],
        ['--alt', '--body-solid', 3],
    ];
    let checked = 0;
    for (const [name, vars] of Object.entries(themes)) {
        for (const [fg, bg, min] of PAIRS) {
            const a = hex(vars[fg]), b = hex(vars[bg]);
            if (!a || !b) continue;
            checked++;
            const r = ratio(a, b);
            if (r < min) eq(r.toFixed(2), '≥ ' + min, 'Kontrast ' + name + ' ' + fg + ' auf ' + bg);
            else pass++;
        }
    }
    eq(checked > 40, true, 'Kontrast geprüft (' + checked + ' Paare)');
})();

/* ---------- Offline-Vorrat: jede Datei der App steht in sw.js ---------- */
(function () {
    const sw = path.join(ROOT, 'sw.js');
    if (!fs.existsSync(sw)) return;
    const src = fs.readFileSync(sw, 'utf8');
    const m = /const FILES = (\[[\s\S]*?\]);/.exec(src);
    eq(!!m, true, 'Dateiliste in sw.js');
    if (!m) return;
    const listed = new Set(vm.runInNewContext('(' + m[1] + ')'));
    const want = ['./', 'index.html', 'manifest.webmanifest'];
    (function walk(dir) {
        for (const f of fs.readdirSync(path.join(ROOT, dir))) {
            const p = dir + '/' + f;
            if (fs.statSync(path.join(ROOT, p)).isDirectory()) walk(p);
            else if (!/\.(txt|md)$/.test(f) && !p.startsWith('app/shots/')) want.push(p);
        }
    })('app');
    eq(want.filter(f => !listed.has(f)).join(', '), '', 'fehlt im Offline-Vorrat (php tools/build-release.php --update)');
    eq([...listed].filter(f => !want.includes(f)).join(', '), '', 'steht im Offline-Vorrat, gibt es aber nicht');
    // jede Datei, die index.html lädt, gibt es
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    for (const r of html.matchAll(/(?:src|href)="(app\/[^"]+)"/g)) eq(fs.existsSync(path.join(ROOT, r[1])), true, 'index.html lädt ' + r[1]);
})();

console.log((fail ? '\n' : '') + pass + ' Tests bestanden' + (fail ? ', ' + fail + ' fehlgeschlagen' : '') + '.');
process.exit(fail ? 1 : 0);
