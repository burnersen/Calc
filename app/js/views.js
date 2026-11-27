/* Calc – die drei Ansichten.
   ExprView: „Einfach“ und „Wissenschaftlich“ (gleicher Rechenkern, andere Tasten und Anzeige).
   OfficeView: „Büro“ mit Tischrechner und Papierstreifen. */
(function (C) {
    'use strict';
    const t = (s, v) => C.t(s, v);
    const { h } = C.ui;
    const { Dec } = C;
    const MINUS = '−';
    const ERRORS = { syntax: 'Syntaxfehler', math: 'Mathe-Fehler', overflow: 'Überlauf' };
    const MODEL = { basic: 'S-10', sci: 'SR-260', office: 'D-120' };

    const isLcd = () => 'lcd' in document.documentElement.dataset;

    function deco(kind) {
        return h('div', { class: 'deco', 'aria-hidden': 'true' },
            h('div', { class: 'brand' }, h('b', null, 'CALC'), h('span', null, MODEL[kind] + ' · Solar')),
            h('div', { class: 'solar' }, h('i'), h('i'), h('i'), h('i')));
    }

    /** Zahl als Anzeige-Element: Mantisse, evtl. ×10 hoch Exponent, bei LCD mit „Geister-Segmenten“ dahinter */
    function numNode(r, lcd) {
        let mant = r.mant;
        if (lcd) mant = mant.replace(/−/g, '-');
        const n = h('span', { class: 'n' }, mant);
        if (lcd) n.dataset.ghost = mant.replace(/[0-9-]/g, '8');
        const frag = [n];
        if (r.exp != null) frag.push(h('span', { class: 'x10' }, '×10'), h('sup', null, String(r.exp).replace('-', lcd ? '-' : MINUS)));
        return frag;
    }

    function valueNodes(str, view, o) {
        const lcd = isLcd();
        if (view === 'frac') {
            const f = C.fmt.fraction(str);
            if (f) {
                const sign = f.neg ? (lcd ? '-' : MINUS) : '';
                if (f.whole !== 0n && f.rest !== 0n) return [h('span', { class: 'frac' }, sign + f.whole + ' ', h('sup', null, String(f.rest)), '⁄', h('sub', null, String(f.d)))];
                return [h('span', { class: 'frac' }, sign, h('sup', null, String(f.n)), '⁄', h('sub', null, String(f.d)))];
            }
        }
        if (view === 'dms') return [h('span', { class: 'frac' }, C.fmt.dms(str, o))];
        return numNode(C.fmt.num(Dec.from(str), o), lcd);
    }

    /* =====================================================================
       Einfach und Wissenschaftlich
       ===================================================================== */
    class ExprView {
        constructor(kind) {
            this.kind = kind;
            this.calc = new C.ExprCalc(kind, C.store.get(kind));
            this.second = false;
            this.hyp = false;
            this.el = this.build();
        }

        build() {
            const L = C.layouts[this.kind];
            this.ind = h('div', { class: 'ind', 'aria-hidden': this.kind === 'basic' ? 'true' : null });
            this.dExpr = h('div', { class: 'd-expr' });
            this.dRes = h('div', { class: 'd-res', 'aria-live': 'polite', 'aria-atomic': 'true' });
            this.disp = h('div', { class: 'disp', role: 'group', 'aria-label': t('Anzeige') }, this.ind, this.dExpr, this.dRes);
            if (this.kind === 'basic') this.ind.hidden = true;
            const onKey = k => this.press(k);
            const sec = () => this.second;
            this.pads = this.kind === 'basic'
                ? [C.ui.pad(L, 'main', onKey)]
                : [C.ui.pad(L.fn, 'fnpad', onKey, sec), C.ui.pad(L.main, 'main', onKey, sec)];
            this.calcEl = h('div', { class: 'calc ' + this.kind }, deco(this.kind), this.disp, ...this.pads);
            this.gestures();
            return h('section', { class: 'view', id: 'v-' + this.kind, 'data-view': this.kind, 'aria-label': t(this.kind === 'basic' ? 'Einfach' : 'Wissenschaftlich') }, this.calcEl);
        }

        /** Anzeige: lang drücken = Menü, wischen = letzte Ziffer löschen, doppelt tippen = kopieren */
        gestures() {
            const d = this.disp;
            let sx = 0, sy = 0, st = 0;
            d.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; st = performance.now(); });
            d.addEventListener('pointerup', e => {
                const dx = e.clientX - sx, dy = e.clientY - sy;
                if (Math.abs(dx) > 45 && Math.abs(dy) < 35 && performance.now() - st < 600) { C.ui.feedback(); this.press('del'); }
            });
            d.addEventListener('dblclick', () => this.copy());
            C.ui.longPress(d, e => this.dispMenu(e));
        }
        dispMenu(e) {
            const c = this.calc;
            const items = [
                { label: t('Ergebnis kopieren'), icon: 'copy', on: () => this.copy() },
                { label: t('Einfügen'), icon: 'paste', on: () => this.pasteFromClipboard() },
                { label: t('Verlauf'), icon: 'history', on: () => this.history() },
            ];
            if (this.kind === 'sci' && c.shown) {
                items.push({ sep: true },
                    { label: t('Als Bruch'), checked: c.view === 'frac', on: () => { c.press('sd'); this.render(); } },
                    { label: t('Als Grad, Minuten, Sekunden'), checked: c.view === 'dms', on: () => { c.press('dms'); this.render(); } });
            }
            C.ui.menu({ x: e.clientX || innerWidth / 2, y: e.clientY || 120, getBoundingClientRect: () => ({ left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY }) }, items, { alignLeft: true });
        }

        save() { C.store.set(this.kind, this.calc.save()); }

        press(k) {
            const c = this.calc;
            if (k === 'shift') { this.second = !this.second; this.render(); return; }
            if (k === 'hyp') { this.hyp = !this.hyp; this.render(); return; }
            this.second = false;
            if (k === 'fmt') { this.render(); return this.fmtSheet(); }
            if (k === 'sto' || k === 'rcl') { this.render(); return this.varMenu(k === 'sto'); }
            if (this.hyp && /^fn:a?(sin|cos|tan)$/.test(k)) k += 'h';
            this.hyp = false;
            c.implicitStrong = C.settings.implicit;
            if (k === 'drg') {
                c.press(k);
                C.settings.sciAngle = c.angle;
            } else c.press(k);
            this.render();
            this.save();
        }

        fmtOpts() {
            const nf = C.numfmt();
            const lcd = isLcd();
            const o = lcd ? { dec: '.', grp: '', group: false } : { dec: nf.dec, grp: nf.grp, group: nf.group };
            if (this.kind === 'sci') Object.assign(o, { mode: C.settings.sciFmt.mode, places: C.settings.sciFmt.places, sig: lcd ? 10 : 12, maxLen: lcd ? 12 : 16 });
            else Object.assign(o, { sig: lcd ? 10 : 15, maxLen: lcd ? 12 : 20 });
            return o;
        }

        render() {
            const c = this.calc, k = this.kind;
            const o = this.fmtOpts();
            const nf = C.numfmt();
            const eo = { dec: nf.dec, grp: nf.grp, group: k === 'basic' && nf.group, spaced: k === 'basic' };
            this.calcEl.classList.toggle('shown', c.shown || !!c.err);

            // Statuszeile
            if (k === 'sci') {
                const sf = C.settings.sciFmt;
                const mem = c.vars.M && !Dec.from(c.vars.M).isZero();
                this.ind.replaceChildren(
                    h('span', { class: this.second ? 'on' : '' }, this.second ? '2nd' : ''),
                    h('span', { class: this.hyp ? 'on' : '' }, this.hyp ? 'hyp' : ''),
                    h('span', { class: 'on' }, mem ? 'M' : ''),
                    h('span', { class: 'sp' }),
                    h('span', { class: 'on' }, sf.mode !== 'norm' ? sf.mode.toUpperCase() + (sf.mode !== 'eng' ? ' ' + sf.places : '') : ''),
                    h('span', { class: c.view !== 'dec' ? 'on' : '' }, c.view === 'frac' ? 'a⁄b' : c.view === 'dms' ? '°′″' : ''),
                    h('span', { class: 'on' }, { deg: 'DEG', rad: 'RAD', grad: 'GRAD' }[c.angle]));
                this.pads.forEach(p => { p.classList.toggle('is2', this.second); p.classList.toggle('ishyp', this.hyp); });
                const sk = this.pads[0].querySelector('[data-k="shift"]'), hk = this.pads[0].querySelector('[data-k="hyp"]');
                if (sk) sk.setAttribute('aria-pressed', String(this.second));
                if (hk) hk.setAttribute('aria-pressed', String(this.hyp));
            }

            // Rechnung
            const exprNodes = [];
            const showCursor = k === 'sci' && !c.shown;
            c.tokens.forEach((tk, i) => {
                if (showCursor && i === c.cursor) exprNodes.push(h('span', { class: 'cur' }));
                exprNodes.push(C.engine.tokenText(tk, eo));
            });
            if (showCursor && c.cursor >= c.tokens.length) exprNodes.push(h('span', { class: 'cur' }));
            if (k === 'sci' && !c.shown) { const open = c.openParens(); if (open) exprNodes.push(h('span', { class: 'open' }, ')'.repeat(open))); }
            if (k === 'basic') {
                if (!c.tokens.length) exprNodes.push(c.shown ? '' : '0');
                if (c.shown) exprNodes.push(' =');
            }
            this.dExpr.replaceChildren(...exprNodes);

            // Ergebnis
            this.dRes.classList.remove('pre', 'err-on');
            if (c.err) {
                this.dRes.replaceChildren(h('span', { class: 'err' }, t(ERRORS[c.err] || 'Fehler')));
                this.dRes.classList.add('err-on');
            } else if (c.shown && c.res != null) {
                this.dRes.replaceChildren(...valueNodes(c.res, c.view, o));
            } else {
                const p = c.preview();
                if (p != null) { this.dRes.replaceChildren(...valueNodes(p, 'dec', o)); this.dRes.classList.add('pre'); }
                else this.dRes.replaceChildren(k === 'sci' ? h('span', { class: 'n', 'data-ghost': isLcd() ? '8' : null }, '0') : '');
                if (k === 'sci' && p == null) this.dRes.classList.add('pre');
            }
            this.fit();
        }

        fit() {
            const H = this.disp.clientHeight;
            if (!H) return;
            const basic = this.kind === 'basic';
            const lcd = isLcd();
            // verfügbare Höhe: ohne Innenabstand und Statuszeile; zwei Zeilen müssen hineinpassen
            const cs = getComputedStyle(this.disp);
            const avail = H - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - (this.ind.hidden ? 0 : this.ind.offsetHeight) - 4;
            const big = Math.round(Math.max(20, Math.min(basic ? 92 : 64, avail * 0.6 / 1.12, Math.max(28, H * (basic ? 0.42 : 0.36))) * (lcd ? 0.86 : 1)));
            const small = Math.round(Math.max(13, Math.min(30, avail * 0.36 / 1.25, Math.max(15, H * (basic ? 0.17 : 0.2)))));
            const c = this.calc;
            const bigEl = basic && !(c.shown || c.err) ? this.dExpr : this.dRes;
            const smallEl = bigEl === this.dExpr ? this.dRes : this.dExpr;
            C.ui.fit(bigEl, big, big * 0.38);
            if (this.kind === 'sci') {
                smallEl.style.fontSize = small + 'px';
                // Cursor sichtbar halten
                const cur = smallEl.querySelector('.cur');
                if (smallEl.scrollWidth > smallEl.clientWidth) {
                    C.ui.fit(smallEl, small, small * 0.75);
                    if (cur) smallEl.scrollLeft = Math.max(0, cur.offsetLeft - smallEl.clientWidth * 0.75);
                }
            } else C.ui.fit(smallEl, small, small * 0.6);
            if (basic && bigEl === this.dExpr && this.dExpr.scrollWidth > this.dExpr.clientWidth) this.dExpr.scrollLeft = this.dExpr.scrollWidth;
        }

        /* ---------- Zwischenablage ---------- */
        currentText() {
            const c = this.calc;
            const v = c.shown ? c.res : c.preview();
            if (v == null) return null;
            const nf = C.numfmt();
            return C.fmt.num(Dec.from(v), { dec: nf.dec, group: false, sig: 15, maxLen: 40 }).text.replace(MINUS, '-');
        }
        async copy() {
            const s = this.currentText();
            if (s == null) return C.ui.toast(t('Nichts zum Kopieren'));
            if (await C.ui.copy(s)) C.ui.toast(t('Kopiert: {v}', { v: s }));
        }
        async pasteFromClipboard() {
            const s = await C.ui.paste();
            if (s == null) return C.ui.toast(t('Einfügen geht hier nur mit Strg+V'));
            this.paste(s);
        }
        paste(s) {
            const v = C.ui.parseNumber(s, C.numfmt().dec);
            if (v == null) return C.ui.toast(t('Keine Zahl in der Zwischenablage'));
            this.useValue(v);
        }
        useValue(v) {
            const c = this.calc;
            if (c.shown || c.err) c.startFresh();
            const p = c.prev();
            if (p && (p.t === 'num' || p.t === 'val' || p.t === 'const' || p.t === 'rp' || p.t === 'post')) c.insert({ t: 'op', v: '*' });
            c.insert({ t: 'val', v });
            this.render(); this.save();
        }

        /* ---------- Verlauf ---------- */
        history() {
            const c = this.calc;
            const nf = C.numfmt();
            const o = Object.assign(this.fmtOpts(), { dec: nf.dec, grp: nf.grp, group: nf.group });
            const eo = { dec: nf.dec, grp: nf.grp, group: nf.group, spaced: true };
            const list = h('ul', { class: 'hist' });
            const fill = () => {
                list.replaceChildren();
                if (!c.history.length) { list.append(h('li', { class: 'empty' }, t('Noch keine Rechnungen.'))); return; }
                for (const it of c.history.slice(0, 200)) {
                    const r = C.fmt.num(Dec.from(it.r), o);
                    const b = h('button', { type: 'button', class: 'h', on: { click: () => { sh.close(); this.useValue(it.r); } } },
                        h('span', { class: 'he' }, C.engine.exprText(it.e, eo) + ' ='),
                        h('span', { class: 'hr' }, r.text.replace('E', '×10^')),
                        h('span', { class: 'ht' }, new Date(it.ts).toLocaleString(C.lang === 'en' ? 'en-GB' : 'de-DE', { dateStyle: 'short', timeStyle: 'short' })));
                    C.ui.longPress(b, e => C.ui.menu(b, [
                        { label: t('Ergebnis übernehmen'), on: () => { sh.close(); this.useValue(it.r); } },
                        { label: t('Rechnung bearbeiten'), on: () => { sh.close(); c.tokens = JSON.parse(JSON.stringify(it.e)); c.cursor = c.tokens.length; c.shown = false; c.err = null; this.render(); this.save(); } },
                        { label: t('Ergebnis kopieren'), on: () => C.ui.copy(C.fmt.num(Dec.from(it.r), { dec: nf.dec, group: false, sig: 15, maxLen: 40 }).text.replace(MINUS, '-')) },
                        { sep: true },
                        { label: t('Aus dem Verlauf löschen'), danger: true, on: () => { c.history.splice(c.history.indexOf(it), 1); this.save(); fill(); } },
                    ]));
                    list.append(h('li', null, b));
                }
            };
            fill();
            const sh = C.ui.sheet({
                title: t('Verlauf'),
                body: h('div', null, h('p', null, t('Antippen übernimmt das Ergebnis. Lange drücken für mehr.')), list),
                foot: [h('button', { type: 'button', class: 'btn dan', on: { click: async () => { if (await C.ui.confirm(t('Den ganzen Verlauf löschen?'), t('Löschen'), true)) { c.history = []; this.save(); fill(); } } } }, C.ui.icon('trash'), t('Verlauf löschen'))],
            });
        }

        /* ---------- Speicher A–F und M ---------- */
        varMenu(store) {
            const c = this.calc;
            const nf = C.numfmt();
            const anchor = this.pads[0].querySelector('[data-k="sto"]') || this.disp;
            const val = n => C.fmt.num(Dec.from(c.vars[n] || '0'), { dec: nf.dec, grp: nf.grp, sig: 10 }).text;
            const items = [{ head: store ? t('Speichern in …') : t('Abrufen aus …') }];
            for (const n of ['A', 'B', 'C', 'D', 'E', 'F', 'M']) {
                items.push({ label: n + '  =  ' + val(n), on: () => { c.press(store ? 'sto:' + n : 'var:' + n); this.render(); this.save(); if (store) C.ui.toast(t('In {n} gespeichert', { n })); } });
            }
            items.push({ sep: true }, { label: t('Alle Speicher löschen'), danger: true, on: () => { c.vars = {}; this.render(); this.save(); C.ui.toast(t('Speicher gelöscht')); } });
            C.ui.menu(anchor, items, { alignLeft: true });
        }

        /* ---------- Zahlenformat ---------- */
        fmtSheet() {
            const sf = Object.assign({}, C.settings.sciFmt);
            const box = h('div');
            const fill = () => {
                const modes = [['norm', 'Normal'], ['fix', 'Feste Nachkommastellen'], ['sci', 'Wissenschaftlich (×10ⁿ)'], ['eng', 'Technisch (×10³ⁿ)']];
                const range = sf.mode === 'fix' ? [0, 9] : sf.mode === 'sci' ? [1, 10] : null;
                box.replaceChildren(
                    h('div', { class: 'chips', style: { 'justify-content': 'flex-start' } }, ...modes.map(([m, n]) => h('button', { type: 'button', 'aria-pressed': String(sf.mode === m), on: { click: () => { sf.mode = m; if (m === 'sci' && sf.places < 1) sf.places = 4; set(); } } }, t(n)))),
                    range ? h('h3', null, sf.mode === 'fix' ? t('Nachkommastellen') : t('Stellen')) : null,
                    range ? h('div', { class: 'chips', style: { 'justify-content': 'flex-start' } }, ...Array.from({ length: range[1] - range[0] + 1 }, (_, i) => i + range[0]).map(n => h('button', { type: 'button', 'aria-pressed': String(sf.places === n), on: { click: () => { sf.places = n; set(); } } }, String(n)))) : null,
                    h('h3', null, t('Ergebnis anders zeigen')),
                    h('div', { class: 'chips', style: { 'justify-content': 'flex-start' } },
                        h('button', { type: 'button', 'aria-pressed': String(this.calc.view === 'frac'), on: { click: () => { this.calc.press('sd'); this.render(); fill(); } } }, t('Als Bruch (S⇔D)')),
                        h('button', { type: 'button', 'aria-pressed': String(this.calc.view === 'dms'), on: { click: () => { this.calc.press('dms'); this.render(); fill(); } } }, t('Grad, Minuten, Sekunden'))),
                    h('p', null, t('Bruch und Grad gehen, sobald ein Ergebnis dasteht.')));
            };
            const set = () => { C.app.set({ sciFmt: Object.assign({}, sf) }); fill(); };
            fill();
            C.ui.sheet({ title: t('Zahlenformat'), body: box, peek: true });
        }

        /* ---------- Tastatur am Rechner ---------- */
        key(e) {
            const k = e.key;
            const sci = this.kind === 'sci';
            const map = {
                '+': '+', '-': '-', '*': '*', 'x': '*', 'X': '*', '×': '*', '/': '/', ':': '/', '÷': '/',
                '.': 'dot', ',': 'dot', 'Enter': '=', '=': '=', 'Backspace': 'del', 'Escape': 'ac', 'Delete': 'ac', '%': 'pct',
            };
            const sciMap = {
                '^': '^', '(': 'lp', ')': 'rp', '!': 'post:!', 's': 'fn:sin', 'c': 'fn:cos', 't': 'fn:tan', 'S': 'fn:asin', 'C': 'fn:acos', 'T': 'fn:atan',
                'l': 'fn:log', 'L': 'fn:pow10', 'n': 'fn:ln', 'N': 'fn:exp', 'r': 'fn:sqrt', 'R': 'fn:cbrt', 'p': 'const:pi', 'e': 'const:e', 'E': 'EE',
                'a': 'ans', 'q': 'post:sq', 'i': 'post:inv', 'm': 'mplus', 'M': 'mminus', 'h': 'hyp', 'd': 'drg', 'f': 'sd', 'g': 'dms',
                'ArrowLeft': 'left', 'ArrowRight': 'right', '~': 'neg', '_': 'neg', 'Home': 'home', 'End': 'end',
            };
            let m = /^[0-9]$/.test(k) ? k : map[k];
            if (!m && sci) m = sciMap[k];
            if (!m && !sci && (k === 'F9' || k === 'n' || k === '_')) m = 'pm';
            if (!m && !sci && k === '(' ) m = null;
            if (!m) return false;
            if (m === 'home' || m === 'end') { this.calc.shown = false; this.calc.cursor = m === 'home' ? 0 : this.calc.tokens.length; this.render(); return true; }
            this.pads.forEach(p => C.ui.flash(p, m));
            this.press(m);
            return true;
        }
    }

    /* =====================================================================
       Büro: Tischrechner mit Papierstreifen
       ===================================================================== */
    const LOGIC = { add: 'Tischrechner-Logik', arith: 'Normale Logik' };
    const ROUND = { half: '5/4', up: '↑', down: '↓' };
    const ROUND_N = { half: 'Kaufmännisch runden (5/4)', up: 'Immer aufrunden (↑)', down: 'Abschneiden (↓)' };

    class OfficeView {
        constructor() {
            const saved = C.store.get('office');
            if (!saved) {
                // erster Start: die Voreinstellungen aus den Einstellungen
                const s = C.store.get('officeCfg', null);
                this.o = new C.Office(null);
                if (s) { this.o.tape.cfg0 = C.Office.cleanCfg(s); this.o.replay(); }
            } else this.o = new C.Office(saved);
            this.renderedFor = null;
            this.el = this.build();
        }

        build() {
            const L = C.layouts.office;
            this.tTitle = h('button', { type: 'button', class: 'ttl', on: { click: () => this.editTitle() } });
            this.tList = h('div', { class: 'tape-list', role: 'log', 'aria-label': t('Papierstreifen'), tabindex: '0' });
            this.tList.addEventListener('click', e => { const l = e.target.closest('.tl'); if (l && l._line) this.lineMenu(l); });
            const head = h('div', { class: 'tape-head' }, this.tTitle,
                C.ui.ib('undo', t('Rückgängig'), () => this.undo()),
                C.ui.ib('note', t('Notizzeile einfügen'), () => this.addNote()),
                C.ui.ib('copy', t('Streifen kopieren'), () => this.copyTape()),
                C.ui.ib('more', t('Mehr'), e => this.tapeMenu(e.currentTarget)));
            this.tape = h('div', { class: 'tape' }, head, this.tList);
            this.handle = h('div', { class: 'handle', role: 'separator', 'aria-orientation': 'horizontal', 'aria-label': t('Streifen größer oder kleiner ziehen') });
            this.dragHandle();
            this.ind = h('div', { class: 'ind' });
            this.dRes = h('div', { class: 'd-res', 'aria-live': 'polite', 'aria-atomic': 'true' });
            this.disp = h('div', { class: 'disp', role: 'group', 'aria-label': t('Anzeige') }, this.ind, this.dRes);
            C.ui.longPress(this.disp, e => C.ui.menu({ getBoundingClientRect: () => ({ left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY }) }, [
                { label: t('Anzeige kopieren'), icon: 'copy', on: () => this.copyValue() },
                { label: t('Einfügen'), icon: 'paste', on: async () => { const s = await C.ui.paste(); if (s == null) C.ui.toast(t('Einfügen geht hier nur mit Strg+V')); else this.paste(s); } },
            ], { alignLeft: true }));
            let sx = 0;
            this.disp.addEventListener('pointerdown', e => { sx = e.clientX; });
            this.disp.addEventListener('pointerup', e => { if (Math.abs(e.clientX - sx) > 45) { C.ui.feedback(); this.press('del'); } });
            const onKey = k => this.press(k);
            this.strip = C.ui.pad(L.strip, 'strip', onKey);
            this.main = C.ui.pad(L.main, 'main', onKey);
            this.calcEl = h('div', { class: 'calc office' }, this.tape, this.handle, this.disp, this.strip, this.main);
            return h('section', { class: 'view', id: 'v-office', 'data-view': 'office', 'aria-label': t('Büro') }, this.calcEl);
        }

        save() { C.store.set('office', this.o.save()); }

        press(k) {
            if (k === '00' && C.settings.k00 === '000') k = '000';
            const before = this.o.lines.length;
            this.o.press(k);
            this.render(before);
            this.save();
        }

        /** Rechenlogik, Stellen, Rundung, Steuersatz */
        setCfg(c) {
            if (this.o.setCfg(c)) { this.render(); this.save(); }
            C.store.set('officeCfg', this.o.cfg);
        }

        render(before) {
            const o = this.o;
            const nf = C.numfmt();
            const lcd = isLcd();
            const fo = lcd ? { dec: '.', grp: '', group: false } : { dec: nf.dec, grp: nf.grp, group: nf.group };
            this.main.querySelector('[data-k="00"] .lb').textContent = C.settings.k00 === '000' ? '000' : '00';
            this.calcEl.classList.toggle('left-hand', C.settings.hand === 'left');
            this.calcEl.style.setProperty('--tape-h', String(C.settings.tapeH));
            this.tape.style.setProperty('--tape-size', String(C.settings.tapeSize));

            // Anzeige
            const d = o.display();
            if (d.err) this.dRes.replaceChildren(h('span', { class: 'err' }, t(ERRORS[d.err] || 'Fehler')));
            else if (d.entry != null) {
                const e = C.fmt.entry(d.entry, fo);
                const txt = lcd ? e.text.replace(/−/g, '-') : e.text;
                this.dRes.replaceChildren(h('span', { class: 'n', 'data-ghost': lcd ? txt.replace(/[0-9-]/g, '8') : null }, txt));
            } else {
                const v = Dec.from(d.value);
                const r = d.dp == null ? C.fmt.num(v, Object.assign({ sig: 15, maxLen: 20 }, fo)) : C.fmt.num(v, Object.assign({ mode: 'fix', places: d.dp, rounding: o.cfg.round }, fo));
                this.dRes.replaceChildren(...numNode(r, lcd));
            }
            // Statuszeile: Merker und Schalter
            const pend = o.pend ? (typeof o.pend === 'object' ? { '*': '×', '/': '÷', D: 'Δ%', MU: 'MU' }[o.pend.op] : C.Office.SYM[o.pend]) : '';
            const chip = (label, title, fn) => h('button', { type: 'button', class: 'chip', title, 'aria-label': title, on: { click: e => fn(e.currentTarget) } }, label);
            const decLabel = o.cfg.dec === 'F' ? 'F' : o.cfg.dec === 'A' ? 'ADD' : o.cfg.dec;
            this.ind.replaceChildren(
                h('span', { class: 'flag' + (o.mem.isZero() ? '' : ' on'), title: t('Speicher') }, 'M'),
                h('span', { class: 'flag' + (o.gt.isZero() ? '' : ' on'), title: t('Gesamtsumme') }, 'GT'),
                h('span', { class: 'on', style: { 'min-width': '1.4em' } }, pend),
                h('span', { class: 'on' }, o.items ? t('{n} Posten', { n: o.items }) : ''),
                h('span', { class: 'sp' }),
                h('span', { class: 'sw3' },
                    chip(o.cfg.logic === 'add' ? t('Tisch') : t('Normal'), t('Rechenlogik'), b => this.logicMenu(b)),
                    chip(decLabel, t('Dezimalstellen'), b => this.decMenu(b)),
                    chip(ROUND[o.cfg.round], t('Rundung'), b => this.roundMenu(b)),
                    chip(C.fmt.num(Dec.from(o.cfg.tax), { dec: nf.dec, group: false }).text + '%', t('Steuersatz'), b => this.taxMenu(b))));
            this.renderTape(before);
            this.fit();
        }

        fit() {
            const H = this.disp.clientHeight;
            if (!H) return;
            const cs = getComputedStyle(this.disp);
            const avail = H - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - this.ind.offsetHeight - 4;
            const size = Math.round(Math.max(20, Math.min(64, avail / 1.15)) * (isLcd() ? 0.88 : 1));
            C.ui.fit(this.dRes, size, size * 0.4);
        }

        /* ---------- Streifen ---------- */
        renderTape(before) {
            const o = this.o, tape = o.tape;
            const nf = C.numfmt();
            const fo = { dec: nf.dec, grp: nf.grp, group: nf.group };
            const n = o.lines.length;
            const date = new Date(tape.created).toLocaleString(C.lang === 'en' ? 'en-GB' : 'de-DE', { dateStyle: 'medium', timeStyle: 'short' });
            this.tTitle.replaceChildren(tape.title || t('Rechenstreifen'), h('small', null, date + ' · ' + t('{n} Zeilen', { n })));
            const frag = document.createDocumentFragment();
            if (!n && o.entry == null) {
                frag.append(h('div', { class: 'tape-empty' }, h('div', null, h('b', null, t('Der Streifen ist leer.')),
                    o.cfg.logic === 'add' ? t('Tippe eine Zahl und dann + oder −. Mit ◇ siehst du die Zwischensumme, mit ✱ die Summe.') : t('Rechne wie gewohnt: 12 + 5 =. Jeder Schritt landet hier auf dem Streifen.'),
                    h('br'), t('Zeilen antippen zum Korrigieren oder für Notizen.'))));
            }
            o.lines.forEach((l, i) => {
                const el = this.lineEl(l, fo);
                if (before != null && i >= before && n - before < 8) el.classList.add('fresh');
                frag.append(el);
            });
            if (o.entry != null) {
                const e = C.fmt.entry(o.entry, fo);
                frag.append(h('div', { class: 'tl live', 'aria-hidden': 'true' }, h('span', { class: 'nt' }), h('span', { class: 'v' }, e.text), h('span', { class: 'm' })));
            }
            this.tList.replaceChildren(frag);
            this.tList.scrollTop = this.tList.scrollHeight;
        }

        lineEl(l, fo) {
            const key = l.ev + ':' + l.i;
            const note = this.o.tape.notes[key];
            const neg = (l.v != null && l.v[0] === '-') || /−/.test(l.mark);
            let label = '';
            if (l.kind === 'note') label = l.text;
            else if (l.label) label = l.kind === 'err' ? t(ERRORS[l.label] || 'Fehler') : t(l.label) + (l.rate ? ' ' + C.fmt.num(Dec.from(l.rate), fo).text + ' %' : '');
            const nt = h('span', { class: 'nt' + (note ? '' : ' lbl') }, note ? (label ? label + ' · ' : '') + note : label);
            const v = l.kind === 'err' ? '' : l.kind === 'clear' ? 'C' : C.Office.lineValue(l, fo);
            const el = h('div', { class: 'tl ' + l.kind + (neg ? ' neg' : '') }, nt);
            if (l.kind !== 'note') el.append(h('span', { class: 'v' }, l.kind === 'clear' ? '' : v), h('span', { class: 'm' }, l.kind === 'clear' ? 'C' : l.mark));
            if (l.kind === 'tot' && l.items) el.dataset.items = t('{n} Posten', { n: l.items });
            el._line = l;
            return el;
        }

        lineMenu(el) {
            const l = el._line, o = this.o;
            const key = l.ev + ':' + l.i;
            const nf = C.numfmt();
            el.classList.add('sel');
            const items = [
                { label: o.tape.notes[key] ? t('Notiz ändern …') : t('Notiz dazuschreiben …'), icon: 'note', on: async () => {
                    const s = await C.ui.prompt({ title: t('Notiz'), label: t('Notiz zu dieser Zeile'), value: o.tape.notes[key] || '', placeholder: t('z. B. Taxi, Hotel, Material'), max: 200 });
                    if (s != null) { o.setNote(key, s); this.save(); this.render(); }
                } },
            ];
            if (l.ed) items.push({ label: t('Wert korrigieren …'), icon: 'edit', on: async () => {
                const ev = o.tape.events.find(e => e.id === l.ev);
                const cur = String(ev.v).replace('.', nf.dec);
                const s = await C.ui.prompt({ title: t('Wert korrigieren'), label: t('Neuer Wert'), text: t('Alles danach rechnet sich neu.'), value: cur, inputmode: 'decimal', max: 30 });
                if (s == null) return;
                const v = C.ui.parseNumber(s, nf.dec);
                if (v == null) return C.ui.toast(t('Das ist keine Zahl.'));
                o.editValue(l.ev, v);
                this.save(); this.render();
                C.ui.toast(t('Korrigiert und neu gerechnet'));
            } });
            if (l.v != null) items.push(
                { label: t('In die Anzeige holen'), icon: 'arrow', on: () => { o.entry = Dec.from(l.v).toPlain(); this.render(); this.save(); } },
                { label: t('Wert kopieren'), icon: 'copy', on: () => { C.ui.copy(C.fmt.num(Dec.from(l.v), { dec: nf.dec, group: false, sig: 15, maxLen: 40 }).text.replace(MINUS, '-')); C.ui.toast(t('Kopiert')); } });
            items.push({ sep: true }, { label: t('Zeile löschen'), icon: 'trash', danger: true, on: () => {
                const idx = o.tape.events.findIndex(e => e.id === l.ev);
                if (idx < 0) return;
                const ev = o.tape.events[idx];
                const notes = Object.assign({}, o.tape.notes);
                o.deleteEvent(l.ev);
                this.save(); this.render();
                C.ui.toast(t('Zeile gelöscht, neu gerechnet'), t('Rückgängig'), () => { o.tape.events.splice(idx, 0, ev); o.tape.notes = notes; o.replay(); this.save(); this.render(); });
            } });
            C.ui.menu(el, items);
            const obs = new MutationObserver(() => { if (!document.querySelector('.menu')) { el.classList.remove('sel'); obs.disconnect(); } });
            obs.observe(document.body, { childList: true });
        }

        undo() {
            if (!this.o.undo()) return C.ui.toast(t('Nichts mehr rückgängig zu machen'));
            this.save(); this.render();
        }
        async addNote() {
            const s = await C.ui.prompt({ title: t('Notizzeile'), label: t('Text auf dem Streifen'), placeholder: t('z. B. Einkauf Baumarkt'), max: 200 });
            if (s && this.o.addNoteLine(s)) { this.save(); this.render(); }
        }
        async editTitle() {
            const s = await C.ui.prompt({ title: t('Name des Streifens'), label: t('Name'), value: this.o.tape.title, placeholder: t('z. B. Kassenabschluss März'), max: 80 });
            if (s != null) { this.o.setTitle(s); this.save(); this.render(); }
        }

        /** Streifen als Text: Notiz links, Betrag rechts, Zeichen dahinter */
        tapeText(tape) {
            const o = tape ? new C.Office({ tape: JSON.parse(JSON.stringify(tape)) }) : this.o;
            tape = o.tape;
            const nf = C.numfmt();
            const fo = { dec: nf.dec, grp: nf.grp, group: nf.group };
            const W = 30;
            const out = [(tape.title || t('Rechenstreifen')), new Date(tape.created).toLocaleString(C.lang === 'en' ? 'en-GB' : 'de-DE', { dateStyle: 'medium', timeStyle: 'short' }), '-'.repeat(W + 4)];
            for (const l of o.lines) {
                const key = l.ev + ':' + l.i;
                if (l.kind === 'note') { out.push(''); out.push(l.text); continue; }
                if (l.kind === 'res' || l.kind === 'sub') out.push(' '.repeat(W - 14) + '-'.repeat(14));
                if (l.kind === 'tot') out.push(' '.repeat(W - 14) + '='.repeat(14));
                const label = (l.label ? t(l.label) + (l.rate ? ' ' + l.rate.replace('.', nf.dec) + ' %' : '') : '') + (tape.notes[key] ? (l.label ? ' ' : '') + tape.notes[key] : '');
                const v = l.kind === 'clear' ? '' : l.kind === 'err' ? t('Fehler') : C.Office.lineValue(l, fo).replace(MINUS, '-');
                const mark = (l.kind === 'clear' ? 'C' : l.mark).replace(MINUS, '-');
                const left = label.length > W - v.length - 1 ? label.slice(0, Math.max(0, W - v.length - 2)) + '…' : label;
                out.push(left + ' '.repeat(Math.max(1, W - left.length - v.length)) + v + ' ' + mark);
                if (l.kind === 'tot') out.push('');
            }
            return out.join('\n');
        }
        tapeCsv() {
            const o = this.o, tape = o.tape;
            const nf = C.numfmt();
            const sep = nf.dec === ',' ? ';' : ',';
            const q = s => /[";,\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
            const rows = [[t('Wert'), t('Zeichen'), t('Art'), t('Bezeichnung'), t('Notiz')].join(sep)];
            const KIND = { in: 'Eingabe', res: 'Ergebnis', sub: 'Zwischensumme', tot: 'Summe', gt: 'Gesamtsumme', mem: 'Speicher', info: 'Info', clear: 'Löschen', note: 'Notiz', err: 'Fehler' };
            for (const l of o.lines) {
                const v = l.v == null ? '' : Dec.from(l.v).toPlain().replace('.', nf.dec);
                rows.push([v, l.mark || '', t(KIND[l.kind] || ''), l.kind === 'note' ? l.text : l.label ? t(l.label) : '', tape.notes[l.ev + ':' + l.i] || ''].map(x => q(String(x))).join(sep));
            }
            return '﻿' + rows.join('\r\n');
        }
        fileName(ext) {
            const d = new Date(this.o.tape.created);
            const p = n => String(n).padStart(2, '0');
            return 'calc-' + (this.o.tape.title ? this.o.tape.title.replace(/[^\w\-äöüÄÖÜß ]+/g, '').trim().replace(/\s+/g, '-') + '-' : '') + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '.' + ext;
        }
        async copyTape() {
            if (!this.o.lines.length) return C.ui.toast(t('Der Streifen ist leer.'));
            if (await C.ui.copy(this.tapeText())) C.ui.toast(t('Streifen kopiert'));
        }
        async copyValue() {
            const d = this.o.display();
            const v = d.entry != null ? d.entry : d.value;
            if (v == null) return;
            const nf = C.numfmt();
            if (await C.ui.copy(C.fmt.num(Dec.from(v), { dec: nf.dec, group: false, sig: 15, maxLen: 40 }).text.replace(MINUS, '-'))) C.ui.toast(t('Kopiert'));
        }
        paste(s) {
            const v = C.ui.parseNumber(s, C.numfmt().dec);
            if (v == null) return C.ui.toast(t('Keine Zahl in der Zwischenablage'));
            this.o.entry = v;
            this.render(); this.save();
        }

        tapeMenu(anchor) {
            const items = [];
            if (navigator.share) items.push({ label: t('Teilen …'), icon: 'share', on: () => navigator.share({ title: this.o.tape.title || t('Rechenstreifen'), text: this.tapeText() }).catch(() => {}) });
            items.push(
                { label: t('Als Text speichern'), icon: 'download', on: () => this.o.lines.length ? C.ui.download(this.fileName('txt'), this.tapeText()) : C.ui.toast(t('Der Streifen ist leer.')) },
                { label: t('Als Tabelle speichern (CSV)'), icon: 'table', on: () => this.o.lines.length ? C.ui.download(this.fileName('csv'), this.tapeCsv(), 'text/csv;charset=utf-8') : C.ui.toast(t('Der Streifen ist leer.')) },
                { label: t('Drucken'), icon: 'print', on: () => { if (C.app.mode !== 'office') C.app.setMode('office'); setTimeout(() => print(), 50); } },
                { sep: true },
                { label: t('Neuer Streifen'), icon: 'plus', on: () => this.newTape() },
                { label: t('Archiv …'), icon: 'archive', on: () => this.archive() },
                { sep: true },
                { label: t('Schrift größer'), icon: 'zoomin', on: () => C.app.set({ tapeSize: Math.min(1.6, +(C.settings.tapeSize + 0.1).toFixed(2)) }) },
                { label: t('Schrift kleiner'), icon: 'zoomout', on: () => C.app.set({ tapeSize: Math.max(0.7, +(C.settings.tapeSize - 0.1).toFixed(2)) }) });
            C.ui.menu(anchor, items);
        }

        async newTape() {
            const o = this.o;
            if (!o.tape.events.length) return C.ui.toast(t('Der Streifen ist schon leer.'));
            if (C.settings.confirmClear && !(await C.ui.confirm(t('Neuen Streifen anfangen? Der jetzige kommt ins Archiv.'), t('Neuer Streifen')))) return;
            const old = o.clearTape();
            const arch = C.store.get('archive', []);
            if (old) { arch.unshift(old); C.store.set('archive', arch.slice(0, 100)); }
            this.save(); this.render();
            C.ui.toast(t('Neuer Streifen. Der alte liegt im Archiv.'), t('Rückgängig'), () => {
                const a = C.store.get('archive', []);
                const i = a.findIndex(x => x.id === old.id);
                if (i >= 0) a.splice(i, 1);
                C.store.set('archive', a);
                o.loadTape(old);
                this.save(); this.render();
            });
        }

        archive() {
            const nf = C.numfmt();
            const list = h('ul', { class: 'hist' });
            const fill = () => {
                const arch = C.store.get('archive', []);
                list.replaceChildren();
                if (!arch.length) { list.append(h('li', { class: 'empty' }, t('Im Archiv liegt noch nichts. Mit „Neuer Streifen“ kommt der alte hierher.'))); return; }
                for (const tp of arch) {
                    const tmp = new C.Office({ tape: JSON.parse(JSON.stringify(tp)) });
                    const tots = tmp.lines.filter(l => l.kind === 'tot');
                    const last = tots.length ? tots[tots.length - 1] : tmp.lines.filter(l => l.v != null).pop();
                    const b = h('button', { type: 'button', class: 'h', on: { click: () => C.ui.menu(b, [
                        { label: t('Öffnen'), icon: 'arrow', on: () => {
                            const a = C.store.get('archive', []).filter(x => x.id !== tp.id);
                            if (this.o.tape.events.length) a.unshift(this.o.tape);
                            C.store.set('archive', a.slice(0, 100));
                            this.o.loadTape(tp);
                            this.save(); this.render(); sh.close();
                            C.ui.toast(t('Streifen geöffnet'));
                        } },
                        { label: t('Als Text kopieren'), icon: 'copy', on: async () => { if (await C.ui.copy(this.tapeText(tp))) C.ui.toast(t('Streifen kopiert')); } },
                        { sep: true },
                        { label: t('Löschen'), icon: 'trash', danger: true, on: () => { C.store.set('archive', C.store.get('archive', []).filter(x => x.id !== tp.id)); fill(); } },
                    ]) } },
                        h('span', { class: 'he' }, (tp.title || t('Rechenstreifen')) + ' · ' + new Date(tp.created).toLocaleString(C.lang === 'en' ? 'en-GB' : 'de-DE', { dateStyle: 'medium', timeStyle: 'short' })),
                        h('span', { class: 'hr' }, last ? C.Office.lineValue(last, { dec: nf.dec, grp: nf.grp, group: nf.group }) + ' ' + (last.mark || '') : '–'),
                        h('span', { class: 'ht' }, t('{n} Zeilen', { n: tmp.lines.length })));
                    list.append(h('li', null, b));
                }
            };
            fill();
            const sh = C.ui.sheet({
                title: t('Archiv'),
                body: h('div', null, h('p', null, t('Alte Streifen, die neuesten zuerst. Antippen zum Öffnen, Kopieren oder Löschen.')), list),
                foot: [h('button', { type: 'button', class: 'btn dan', on: { click: async () => { if (await C.ui.confirm(t('Das ganze Archiv löschen?'), t('Löschen'), true)) { C.store.set('archive', []); fill(); } } } }, C.ui.icon('trash'), t('Archiv leeren'))],
            });
        }

        /* ---------- Schalter ---------- */
        logicMenu(b) {
            C.ui.menu(b, Object.keys(LOGIC).map(k => ({ label: t(LOGIC[k]) + (k === 'add' ? ' (12 + 5 + ✱)' : ' (12 + 5 =)'), checked: this.o.cfg.logic === k, on: () => this.setCfg({ logic: k }) })));
        }
        decMenu(b) {
            const opts = [['F', 'Alle Stellen (F)'], ['0', '0 Stellen'], ['1', '1 Stelle'], ['2', '2 Stellen'], ['3', '3 Stellen'], ['4', '4 Stellen'], ['A', 'Addiermodus: Cent automatisch (ADD)']];
            C.ui.menu(b, opts.map(([k, n]) => ({ label: t(n), checked: this.o.cfg.dec === k, on: () => this.setCfg({ dec: k }) })));
        }
        roundMenu(b) {
            C.ui.menu(b, Object.keys(ROUND_N).map(k => ({ label: t(ROUND_N[k]), checked: this.o.cfg.round === k, on: () => this.setCfg({ round: k }) })));
        }
        taxMenu(b) {
            const nf = C.numfmt();
            const rates = ['19', '7', '0', '20', '10', '8.1', '2.6'];
            C.ui.menu(b, [{ head: t('Steuersatz für +MwSt und −MwSt') }, ...rates.map(r => ({ label: r.replace('.', nf.dec) + ' %', checked: this.o.cfg.tax === r, on: () => this.setCfg({ tax: r }) })),
                { label: t('Eigener Satz …'), on: async () => {
                    const s = await C.ui.prompt({ title: t('Steuersatz'), label: t('Prozent'), value: this.o.cfg.tax.replace('.', nf.dec), inputmode: 'decimal', max: 7 });
                    const v = s == null ? null : C.ui.parseNumber(s, nf.dec);
                    if (v == null || Dec.from(v).isNeg() || Dec.from(v).cmp(100) > 0) { if (s != null) C.ui.toast(t('Bitte eine Zahl zwischen 0 und 100.')); return; }
                    this.setCfg({ tax: Dec.from(v).round(3).toPlain() });
                } }]);
        }

        dragHandle() {
            const hd = this.handle;
            hd.addEventListener('pointerdown', e => {
                e.preventDefault();
                hd.setPointerCapture(e.pointerId);
                const r = this.calcEl.getBoundingClientRect();
                const move = ev => {
                    const v = Math.max(0.12, Math.min(0.62, (ev.clientY - r.top - 8) / r.height));
                    C.settings.tapeH = +v.toFixed(3);
                    this.calcEl.style.setProperty('--tape-h', String(C.settings.tapeH));
                    this.fit();
                };
                const up = () => { hd.removeEventListener('pointermove', move); hd.removeEventListener('pointerup', up); C.app.set({ tapeH: C.settings.tapeH }, true); };
                hd.addEventListener('pointermove', move);
                hd.addEventListener('pointerup', up);
            });
        }

        /* ---------- Tastatur am Rechner ---------- */
        key(e) {
            const k = e.key;
            const o = this.o;
            if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'Z')) { this.undo(); return true; }
            const map = {
                '+': '+', '-': '-', '*': '*', 'x': '*', 'X': '*', '/': '/', ':': '/', '.': 'dot', ',': 'dot', '=': '=', 'Backspace': 'del', 'Escape': 'ac', 'Delete': 'ce',
                '%': 'pct', 's': 'S', 'S': 'S', 't': 'T', 'T': 'T', 'g': 'GT', 'G': 'GT', 'm': 'mplus', 'M': 'mminus', 'r': 'mr', 'R': 'mc', 'F9': 'pm', 'n': 'pm',
            };
            let m = /^[0-9]$/.test(k) ? k : map[k];
            if (k === 'Enter') m = o.cfg.logic === 'add' && !o.pend ? '+' : '=';
            if (!m) return false;
            C.ui.flash(this.main, m); C.ui.flash(this.strip, m);
            this.press(m);
            return true;
        }
    }

    C.ExprView = ExprView;
    C.OfficeView = OfficeView;
})(self.Calc = self.Calc || {});
