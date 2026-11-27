/* Calc – Büro-Rechner (Tischrechner) mit Papierstreifen.
   Zwei Rechenlogiken, umschaltbar:
     add   = Tischrechner-Logik wie an der Addiermaschine: 12 +, 5 +, 3 − … ◇ zeigt die Zwischensumme, ✱ die Summe.
     arith = normale Logik ohne Punkt vor Strich, wie an jedem Tischrechner: 12 + 5 × 2 = 34.
   Der Streifen ist keine Textliste, sondern das Protokoll der Tastendrücke (events). Daraus entstehen die Zeilen.
   So lässt sich jede eingetippte Zahl später korrigieren oder löschen, und alles danach rechnet sich neu.
   Gerechnet wird mit exakten Dezimalzahlen (decimal.js), gerundet nach der Einstellung (Dezimalstellen und Rundung). */
(function (C) {
    'use strict';
    const { Dec, CalcError } = C;
    const Z = Dec.ZERO;
    const SYM = { '+': '+', '-': '−', '*': '×', '/': '÷' };
    const EVENT_KEYS = new Set(['+', '-', '*', '/', '=', 'pct', 'S', 'T', 'GT', 'taxp', 'taxm', 'mu', 'delta', 'mplus', 'mminus', 'mr', 'mc', 'ac']);

    const DEFAULT_CFG = { logic: 'add', dec: '2', round: 'half', tax: '19' };

    function cleanCfg(c) {
        const o = Object.assign({}, DEFAULT_CFG);
        if (c && (c.logic === 'add' || c.logic === 'arith')) o.logic = c.logic;
        if (c && ['F', '0', '1', '2', '3', '4', 'A'].includes(String(c.dec))) o.dec = String(c.dec);
        if (c && ['half', 'up', 'down'].includes(c.round)) o.round = c.round;
        if (c && /^\d{1,3}([.,]\d{1,3})?$/.test(String(c.tax))) o.tax = String(c.tax).replace(',', '.');
        return o;
    }

    function newTape(cfg) {
        return { id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: '', created: Date.now(),
            cfg0: cleanCfg(cfg), events: [], notes: {}, seq: 0 };
    }

    class Office {
        constructor(saved, cfg) {
            this.tape = saved && saved.tape && Array.isArray(saved.tape.events) ? saved.tape : newTape(cfg);
            this.tape.cfg0 = cleanCfg(this.tape.cfg0);
            this.tape.notes = this.tape.notes || {};
            this.tape.seq = this.tape.seq || this.tape.events.reduce((m, e) => Math.max(m, e.id || 0), 0);
            this.entry = saved && typeof saved.entry === 'string' ? saved.entry : null;
            this.replay();
        }
        save() { return { tape: this.tape, entry: this.entry }; }

        /* ---------- Zustand ---------- */
        reset() {
            this.cfg = Object.assign({}, this.tape.cfg0);
            this.acc = Z;          // Tischrechner-Logik: laufende Summe
            this.cur = null;       // normale Logik: Zwischenergebnis
            this.pend = null;      // offene Rechenart { op, a }
            this.items = 0;        // Postenzähler
            this.gt = Z;           // Gesamtsumme
            this.gtAdded = false;
            this.mem = Z;
            this.disp = Z;
            this.recall = null;    // aus dem Speicher geholt (MR), wird wie eine Eingabe benutzt
            this.lastOp = false;   // gerade ein Rechenzeichen gedrückt (normale Logik: tauschen statt rechnen)
            this.lastGT = false;
            this.err = null;
            this.lines = [];
        }

        replay() {
            this.reset();
            for (const ev of this.tape.events) this.apply(ev);
        }

        /** Einstellung ändern. Kommt als Ereignis auf den Streifen, damit spätere Korrekturen richtig rechnen. */
        setCfg(c) {
            const n = cleanCfg(Object.assign({}, this.cfg, c));
            const diff = {};
            for (const k in n) if (n[k] !== this.cfg[k]) diff[k] = n[k];
            if (!Object.keys(diff).length) return false;
            if (!this.tape.events.length) { this.tape.cfg0 = n; this.replay(); return true; }
            this.push({ k: 'cfg', c: diff });
            return true;
        }

        push(ev) {
            ev.id = ++this.tape.seq;
            this.tape.events.push(ev);
            this.apply(ev);
            return ev;
        }

        /* ---------- Tasten ---------- */
        press(k) {
            if (this.err && k !== 'ac') this.err = null;
            if (/^\d$/.test(k) || k === '00' || k === '000' || k === 'dot') return this.typeDigit(k);
            switch (k) {
                case 'del':
                    if (this.entry == null) return false;
                    this.entry = this.entry.slice(0, -1);
                    if (this.entry === '' || this.entry === '-') this.entry = null;
                    return true;
                case 'ce':
                    if (this.entry == null) return false;
                    this.entry = null;
                    return true;
                case 'pm':
                    if (this.entry != null) this.entry = this.entry[0] === '-' ? this.entry.slice(1) : '-' + this.entry;
                    else this.entry = this.disp.neg().toPlain();
                    return true;
            }
            if (!EVENT_KEYS.has(k)) return false;
            if (k === 'ac' && this.entry != null && !this.tape.events.length && !this.pend) { this.entry = null; return true; }
            const v = this.entry;
            this.entry = null;
            this.push(v == null ? { k } : { k, v });
            return true;
        }

        typeDigit(k) {
            let s = this.entry == null ? '' : this.entry;
            const neg = s[0] === '-';
            const body = neg ? s.slice(1) : s;
            if (body.replace(/\D/g, '').length >= 15 && k !== 'dot') return false;
            if (k === 'dot') {
                if (body.includes('.')) return false;
                s = (neg ? '-' : '') + (body === '' ? '0' : body) + '.';
            } else if (body === '0' || body === '') {
                s = (neg ? '-' : '') + (k === '00' || k === '000' ? '0' : k);
            } else s += k;
            this.entry = s;
            this.lastGT = false;
            return true;
        }

        /** Zeile bearbeiten (nur eingetippte Zahlen) */
        editValue(evId, str) {
            const ev = this.tape.events.find(e => e.id === evId);
            if (!ev || ev.v == null) return false;
            Dec.from(str);   // wirft bei Unsinn
            ev.v = str;
            this.replay();
            return true;
        }
        deleteEvent(evId) {
            const i = this.tape.events.findIndex(e => e.id === evId);
            if (i < 0) return false;
            this.tape.events.splice(i, 1);
            for (const key of Object.keys(this.tape.notes)) if (key.split(':')[0] === String(evId)) delete this.tape.notes[key];
            this.replay();
            return true;
        }
        undo() {
            if (this.entry != null) { this.entry = null; return true; }
            if (!this.tape.events.length) return false;
            const ev = this.tape.events.pop();
            for (const key of Object.keys(this.tape.notes)) if (key.split(':')[0] === String(ev.id)) delete this.tape.notes[key];
            if (ev.v != null && ev.k !== 'cfg') this.entry = ev.v;   // die Zahl steht wieder zum Weitertippen da
            this.replay();
            return true;
        }
        addNoteLine(text) {
            text = String(text || '').trim().slice(0, 200);
            if (!text) return false;
            this.push({ k: 'note', text });
            return true;
        }
        setNote(key, text) {
            text = String(text || '').trim().slice(0, 200);
            if (text) this.tape.notes[key] = text; else delete this.tape.notes[key];
        }
        setTitle(t) { this.tape.title = String(t || '').trim().slice(0, 80); }

        /** Neuer Streifen. Gibt den alten zurück (fürs Archiv), wenn darauf etwas stand. */
        clearTape() {
            const old = this.tape;
            this.tape = newTape(this.cfg);
            this.entry = null;
            this.replay();
            return old.events.length ? old : null;
        }
        loadTape(t) {
            this.tape = t;
            this.tape.cfg0 = cleanCfg(t.cfg0);
            this.tape.notes = t.notes || {};
            this.entry = null;
            this.replay();
        }

        /* ---------- Was angezeigt wird ---------- */
        dp() {
            const d = this.cfg.dec;
            return d === 'F' ? null : d === 'A' ? 2 : +d;
        }
        display() {
            if (this.err) return { err: this.err };
            if (this.entry != null) return { entry: this.entry };
            return { value: this.disp.toPlain(), dp: this.dp() };
        }
        taxRate() { return Dec.from(this.cfg.tax || '19'); }

        /* ---------- Ein Ereignis ausführen ---------- */
        rnd(d) {
            const dp = this.dp();
            if (dp == null) return d.roundSig(15, this.cfg.round);
            return d.round(dp, this.cfg.round);
        }
        val(ev, isAdd) {
            if (ev.v != null) {
                let d = Dec.from(ev.v);
                if (isAdd && this.cfg.dec === 'A' && !String(ev.v).includes('.')) d = d.div(100);
                return d;
            }
            if (this.recall) return this.recall;
            return this.disp;
        }
        line(ev, v, mark, kind, extra) {
            const l = Object.assign({ ev: ev.id, i: this._i++, v: v == null ? null : v.toPlain(), mark, kind, dp: this.dp() }, extra || {});
            this.lines.push(l);
            return l;
        }
        calc(a, op, b) {
            switch (op) {
                case '+': return this.rnd(a.add(b));
                case '-': return this.rnd(a.sub(b));
                case '*': return this.rnd(a.mul(b));
                case '/': return this.rnd(a.div(b));
                case 'D': if (a.isZero()) throw new CalcError('math'); return this.rnd(b.sub(a).div(a).mul(100));
                case 'MU': {
                    const f = Dec.ONE.sub(b.div(100));
                    if (f.sign() <= 0) throw new CalcError('math');
                    return this.rnd(a.div(f));
                }
            }
            throw new CalcError('syntax');
        }
        /** Offene Rechnung (×, ÷, Δ%, Aufschlag) mit v abschließen, druckt „v =“ und das Ergebnis */
        finish(ev, v, mark) {
            const p = this.pend;
            const r = this.calc(p.a, p.op, v);
            this.line(ev, v, mark || '=', 'in', { ed: ev.v != null });
            if (p.op === 'D') this.line(ev, r, '%', 'res', { label: 'Änderung' });
            else if (p.op === 'MU') {
                this.line(ev, r, '', 'res', { label: 'Verkaufspreis' });
                this.line(ev, r.sub(p.a), '', 'info', { label: 'Gewinn' });
            } else this.line(ev, r, '', 'res');
            this.pend = null;
            return r;
        }

        apply(ev) {
            this._i = 0;
            if (ev.k === 'cfg') { this.cfg = cleanCfg(Object.assign({}, this.cfg, ev.c)); return; }
            if (ev.k === 'note') { this.line(ev, null, '', 'note', { text: ev.text }); return; }
            const wasGT = this.lastGT;
            this.lastGT = false;
            try {
                if (this.cfg.logic === 'arith' && this.applyArith(ev)) return;
                if (this.cfg.logic === 'add' && this.applyAdd(ev)) return;
                this.applyCommon(ev, wasGT);
            } catch (e) {
                if (!(e instanceof CalcError)) throw e;
                this.line(ev, null, 'E', 'err', { label: e.code });
                this.pend = null;
                this.recall = null;
                this.lastOp = false;
                this.disp = Z;
                this.err = e.code;
            }
        }

        /** Tischrechner-Logik */
        applyAdd(ev) {
            const k = ev.k;
            const ed = { ed: ev.v != null };
            switch (k) {
                case '+': case '-': {
                    let v = this.val(ev, true);
                    if (this.pend) { v = this.finish(ev, v); this.line(ev, v, SYM[k], 'in'); }
                    else this.line(ev, v, SYM[k], 'in', ed);
                    this.acc = this.rnd(k === '+' ? this.acc.add(v) : this.acc.sub(v));
                    this.items++;
                    this.disp = this.acc;
                    this.recall = null;
                    return true;
                }
                case '*': case '/': {
                    const v = this.val(ev, false);
                    this.line(ev, v, SYM[k], 'in', ed);
                    const a = this.pend ? this.calc(this.pend.a, this.pend.op, v) : v;
                    this.pend = { op: k, a };
                    this.disp = a;
                    this.recall = null;
                    return true;
                }
                case '=': {
                    const v = this.val(ev, false);
                    if (this.pend) this.disp = this.finish(ev, v);
                    else if (ev.v != null || this.recall) this.disp = v;
                    this.recall = null;
                    return true;
                }
                case 'pct': {
                    const v = this.val(ev, false);
                    if (this.pend) {
                        const p = this.pend;
                        if (p.op === 'D' || p.op === 'MU') { this.disp = this.finish(ev, v, '%'); return true; }
                        const r = p.op === '*' ? this.rnd(p.a.mul(v).div(100)) : this.rnd(p.a.div(v).mul(100));
                        this.line(ev, v, '%', 'in', ed);
                        this.line(ev, r, p.op === '/' ? '%' : '', 'res');
                        this.pend = null;
                        this.disp = r;
                    } else {
                        const r = this.rnd(v.div(100));
                        this.line(ev, v, '%', 'in', ed);
                        this.line(ev, r, '', 'res');
                        this.disp = r;
                    }
                    this.recall = null;
                    return true;
                }
                case 'S': case 'T': {
                    if (ev.v != null || this.recall) {
                        let v = this.val(ev, true);
                        if (this.pend) v = this.finish(ev, v);
                        else this.line(ev, v, '+', 'in', ed);
                        this.acc = this.rnd(this.acc.add(v));
                        this.items++;
                        this.recall = null;
                    } else if (this.pend) {
                        this.pend = null;
                    }
                    if (k === 'S') {
                        this.line(ev, this.acc, '◇', 'sub', { items: this.items });
                        this.disp = this.acc;
                    } else {
                        this.line(ev, this.acc, '✱', 'tot', { items: this.items });
                        this.gt = this.rnd(this.gt.add(this.acc));
                        this.disp = this.acc;
                        this.acc = Z;
                        this.items = 0;
                    }
                    return true;
                }
            }
            return false;
        }

        /** Normale Logik: sofort ausrechnen, ohne Punkt vor Strich */
        applyArith(ev) {
            const k = ev.k;
            const ed = { ed: ev.v != null };
            const typed = ev.v != null || !!this.recall;
            const objPend = !!this.pend && typeof this.pend === 'object';   // Δ% oder Aufschlag offen
            if (k !== '+' && k !== '-' && k !== '*' && k !== '/') {
                if (!['=', 'pct', 'S', 'T'].includes(k)) { this.lastOp = false; return false; }
            }
            if (objPend) {
                if (k === '=' || k === 'pct') return false;
                const r = typed ? this.finish(ev, this.val(ev, false)) : this.pend.a;
                this.pend = null;
                this.cur = r;
                this.disp = r;
                this.recall = null;
                if (k === 'S' || k === 'T') return this.applyArith({ id: ev.id, k });
                this.line(ev, r, SYM[k], 'in');
                this.pend = k;
                this.lastOp = true;
                if (k === '+' || k === '-') this.items++;
                return true;
            }
            switch (k) {
                case '+': case '-': case '*': case '/': {
                    if (!typed && this.lastOp && this.pend) {
                        // nur das Rechenzeichen getauscht
                        const l = this.lines[this.lines.length - 1];
                        if (l && l.kind === 'in') l.mark = SYM[k];
                        if ((k === '+' || k === '-') && !(this.pend === '+' || this.pend === '-')) this.items++;
                        this.pend = k;
                        return true;
                    }
                    const v = this.val(ev, k === '+' || k === '-');
                    this.line(ev, v, SYM[k], 'in', ed);
                    this.cur = this.pend && this.cur != null ? this.calc(this.cur, this.pend, v) : v;
                    this.pend = k;
                    this.disp = this.cur;
                    this.recall = null;
                    this.lastOp = true;
                    this.gtAdded = false;
                    if (k === '+' || k === '-') this.items++;
                    return true;
                }
                case '=': case 'pct': {
                    this.lastOp = false;
                    const v = this.val(ev, false);
                    let r;
                    if (this.pend && this.cur != null) {
                        if (k === '=') {
                            r = this.calc(this.cur, this.pend, v);
                            this.line(ev, v, '=', 'in', ed);
                            this.line(ev, r, '', 'res');
                        } else {
                            const p = this.pend, c = this.cur;
                            const part = c.mul(v).div(100);
                            r = this.rnd(p === '+' ? c.add(part) : p === '-' ? c.sub(part) : p === '*' ? part : c.div(v).mul(100));
                            this.line(ev, v, '%', 'in', ed);
                            if (p === '+' || p === '-') this.line(ev, this.rnd(part), p === '+' ? '+' : '−', 'info', { label: p === '+' ? 'Aufschlag' : 'Rabatt' });
                            this.line(ev, r, p === '/' ? '%' : '', 'res');
                        }
                        this.gt = this.rnd(this.gt.add(r));
                        this.gtAdded = true;
                        this.cur = r;
                        this.pend = null;
                        this.disp = r;
                    } else if (k === 'pct') {
                        r = this.rnd(v.div(100));
                        this.line(ev, v, '%', 'in', ed);
                        this.line(ev, r, '', 'res');
                        this.disp = r;
                        this.cur = r;
                    } else if (typed) {
                        this.disp = v;
                        this.cur = v;
                    }
                    this.recall = null;
                    return true;
                }
                case 'S': case 'T': {
                    this.lastOp = false;
                    const v = this.val(ev, false);
                    if (this.pend && this.cur != null && this.pend !== 'D' && this.pend !== 'MU') {
                        if (typed) {
                            this.cur = this.calc(this.cur, this.pend, v);
                            this.line(ev, v, '=', 'in', ed);
                            this.gtAdded = false;
                        }
                        this.pend = null;
                    } else if (typed) { this.cur = v; this.gtAdded = false; }
                    const t = this.cur == null ? this.disp : this.cur;
                    if (k === 'S') {
                        this.line(ev, t, '◇', 'sub', { items: this.items });
                        this.disp = t;
                    } else {
                        this.line(ev, t, '✱', 'tot', { items: this.items });
                        if (!this.gtAdded) this.gt = this.rnd(this.gt.add(t));
                        this.gtAdded = false;
                        this.disp = t;
                        this.cur = null;
                        this.items = 0;
                    }
                    this.recall = null;
                    return true;
                }
            }
            return false;
        }

        /** Tasten, die in beiden Logiken gleich arbeiten */
        applyCommon(ev, wasGT) {
            const ed = { ed: ev.v != null };
            const rate = this.taxRate();
            const rateTxt = rate.toPlain();
            switch (ev.k) {
                case '=': case 'pct': {
                    // Δ% und Aufschlag in der normalen Logik
                    const v = this.val(ev, false);
                    if (this.pend && typeof this.pend === 'object') {
                        this.disp = this.finish(ev, v, ev.k === 'pct' ? '%' : '=');
                        this.cur = this.disp;
                    }
                    this.recall = null;
                    return;
                }
                case 'GT': {
                    if (wasGT) {
                        this.line(ev, this.gt, 'G✱', 'gt');
                        this.gt = Z;
                        this.disp = Z;
                    } else {
                        this.line(ev, this.gt, 'G◇', 'gt');
                        this.disp = this.gt;
                        this.lastGT = true;
                    }
                    return;
                }
                case 'taxp': {
                    const v = this.val(ev, false);
                    const tax = this.rnd(v.mul(rate).div(100));
                    const g = this.rnd(v.add(tax));
                    this.line(ev, v, '', 'in', Object.assign({ label: 'Netto' }, ed));
                    this.line(ev, tax, '+', 'info', { label: 'MwSt', rate: rateTxt });
                    this.line(ev, g, '', 'res', { label: 'Brutto' });
                    this.disp = g;
                    this.pend = null; this.recall = null;
                    if (this.cfg.logic === 'arith') this.cur = g;
                    return;
                }
                case 'taxm': {
                    const v = this.val(ev, false);
                    const n = this.rnd(v.div(Dec.ONE.add(rate.div(100))));
                    const t = this.rnd(v.sub(n));
                    this.line(ev, v, '', 'in', Object.assign({ label: 'Brutto' }, ed));
                    this.line(ev, t, '−', 'info', { label: 'MwSt', rate: rateTxt });
                    this.line(ev, n, '', 'res', { label: 'Netto' });
                    this.disp = n;
                    this.pend = null; this.recall = null;
                    if (this.cfg.logic === 'arith') this.cur = n;
                    return;
                }
                case 'mu': case 'delta': {
                    const v = this.val(ev, false);
                    this.line(ev, v, ev.k === 'mu' ? 'MU' : 'Δ%', 'in', ed);
                    this.pend = { op: ev.k === 'mu' ? 'MU' : 'D', a: v };
                    this.disp = v;
                    this.recall = null;
                    return;
                }
                case 'mplus': case 'mminus': {
                    let v = this.val(ev, false);
                    if (this.pend && this.pend.op && (ev.v != null)) v = this.finish(ev, v);
                    else if (this.cfg.logic === 'arith' && this.pend && this.cur != null && ev.v != null) {
                        const r = this.calc(this.cur, this.pend, v);
                        this.line(ev, v, '=', 'in', ed);
                        this.line(ev, r, '', 'res');
                        v = r; this.cur = r; this.pend = null;
                    }
                    this.mem = this.rnd(ev.k === 'mplus' ? this.mem.add(v) : this.mem.sub(v));
                    this.line(ev, v, ev.k === 'mplus' ? 'M+' : 'M−', 'mem');
                    this.disp = v;
                    this.recall = null;
                    return;
                }
                case 'mr':
                    this.line(ev, this.mem, 'M◇', 'mem');
                    this.recall = this.mem;
                    this.disp = this.mem;
                    return;
                case 'mc':
                    this.line(ev, this.mem, 'M✱', 'mem');
                    this.mem = Z;
                    return;
                case 'ac':
                    this.line(ev, null, 'C', 'clear');
                    this.acc = Z; this.cur = null; this.pend = null; this.items = 0; this.recall = null; this.disp = Z; this.lastOp = false;
                    return;
            }
        }

        /* ---------- Streifen als Text und Tabelle ---------- */
        /** Anzeigetext einer Zeile: Wert mit den Dezimalstellen, die beim Drucken galten */
        static lineValue(l, o) {
            if (l.v == null) return '';
            const d = Dec.from(l.v);
            if (l.dp == null) return C.fmt.num(d, Object.assign({}, o, { sig: 15 })).text;
            const have = d.e < 0 ? -d.e : 0;
            return C.fmt.num(d, Object.assign({}, o, { mode: 'fix', places: l.kind === 'in' ? Math.max(l.dp, have) : l.dp })).text;
        }
    }

    Office.DEFAULT_CFG = DEFAULT_CFG;
    Office.cleanCfg = cleanCfg;
    Office.newTape = newTape;
    Office.SYM = SYM;
    C.Office = Office;
})(self.Calc = self.Calc || {});
