/* Calc – Rechenkern für „Einfach“ und „Wissenschaftlich“.
   Eingegeben wird keine Zeichenkette, sondern eine Liste von Bausteinen (Zahl, Rechenzeichen, Funktion, Klammer …).
   Das hält die Eingabe immer gültig darstellbar und macht Löschen und Cursor einfach.
   evaluate() rechnet die Liste aus: Punkt vor Strich, Potenz vor Vorzeichen (−2² = −4), Klammern schließen sich am Ende selbst.
   ExprCalc ist der Rechner drumherum: Tastendrücke, Ergebnis, Ans, Speicher, Verlauf. */
(function (C) {
    'use strict';
    const { Dec, CalcError } = C;
    const ERR = code => new CalcError(code);

    /* ---------- Bausteine und wie sie aussehen ---------- */
    const OPS = { '+': '+', '-': '−', '*': '×', '/': '÷', '^': '^', root: 'ˣ√', nCr: 'C', nPr: 'P', mod: ' mod ' };
    const FNS = {
        sin: 'sin(', cos: 'cos(', tan: 'tan(', asin: 'sin⁻¹(', acos: 'cos⁻¹(', atan: 'tan⁻¹(',
        sinh: 'sinh(', cosh: 'cosh(', tanh: 'tanh(', asinh: 'sinh⁻¹(', acosh: 'cosh⁻¹(', atanh: 'tanh⁻¹(',
        log: 'log(', ln: 'ln(', sqrt: '√(', cbrt: '∛(', abs: 'Abs(', pow10: '10^(', exp: 'e^(',
    };
    const POSTS = { '!': '!', sq: '²', cube: '³', inv: '⁻¹', pct: '%' };
    const CONSTS = { pi: 'π', e: 'e', ans: 'Ans', rand: 'Ran#', M: 'M', A: 'A', B: 'B', C: 'C', D: 'D', E: 'E', F: 'F' };

    /** Text eines Bausteins. o: Zahlenformat (dec, grp, group) */
    function tokenText(t, o) {
        switch (t.t) {
            case 'num': return C.fmt.entry(t.s, o).text;
            case 'val': return C.fmt.num(t.v, Object.assign({}, o, { sig: 12 })).text;
            case 'op': return o && o.spaced && ['+', '-', '*', '/'].includes(t.v) ? ' ' + OPS[t.v] + ' ' : OPS[t.v];
            case 'neg': return '−';
            case 'fn': return FNS[t.v];
            case 'lp': return '(';
            case 'rp': return ')';
            case 'post': return POSTS[t.v];
            case 'const': return CONSTS[t.v] || t.v;
        }
        return '';
    }
    function exprText(tokens, o) { return tokens.map(t => tokenText(t, o)).join(''); }

    /* ---------- Ausrechnen ---------- */
    const BP = { '+': 10, '-': 10, '*': 20, '/': 20, mod: 20, nCr: 30, nPr: 30, '^': 60, root: 60 };
    const NEG = 50, POST = 70;

    function numOf(s) {
        if (/e$/i.test(s) || /e-$/i.test(s)) s = s.replace(/e-?$/i, '');
        if (s === '' || s === '.' || s === '-') throw ERR('syntax');
        return Dec.from(s);
    }

    /**
     * Rechnet die Bausteine aus. ctx: { angle: deg|rad|grad, ans, vars, implicitStrong }
     * Wirft CalcError (syntax, math, overflow).
     */
    function evaluate(tokens, ctx) {
        ctx = ctx || {};
        const IMPL = ctx.implicitStrong === false ? 20 : 40;
        let i = 0;
        const peek = () => tokens[i];
        const starts = t => t && (t.t === 'num' || t.t === 'val' || t.t === 'const' || t.t === 'fn' || t.t === 'lp');

        function closeParen() {
            const t = peek();
            if (t && t.t === 'rp') i++;
            else if (t) throw ERR('syntax');
        }
        function prefix() {
            const t = tokens[i++];
            if (!t) throw ERR('syntax');
            switch (t.t) {
                case 'num': return { v: numOf(t.s) };
                case 'val': return { v: Dec.from(t.v) };
                case 'const': return { v: constant(t, ctx) };
                case 'lp': { const r = expr(0); closeParen(); return { v: r.v }; }
                case 'fn': { const r = expr(0); closeParen(); return { v: func(t.v, r.v, ctx) }; }
                case 'neg': return { v: expr(NEG).v.neg() };
                case 'op':
                    if (t.v === '-') return { v: expr(NEG).v.neg() };
                    if (t.v === '+') return prefix();
            }
            throw ERR('syntax');
        }
        function expr(min) {
            let left = prefix();
            for (;;) {
                const t = peek();
                if (!t) break;
                if (t.t === 'post') {
                    if (POST <= min) break;
                    i++;
                    left = post(t.v, left.v);
                } else if (t.t === 'op') {
                    const bp = BP[t.v];
                    if (bp <= min) break;
                    i++;
                    const right = expr(t.v === '^' || t.v === 'root' ? bp - 1 : bp);
                    left = { v: binary(t.v, left.v, right) };
                } else if (t.t === 'neg') {
                    // „2 (−) 3“ wie 2 − 3
                    if (10 <= min) break;
                    i++;
                    left = { v: left.v.sub(expr(10).v) };
                } else if (starts(t)) {
                    if (IMPL <= min) break;          // 2π, 3(4+5), 2sin(30): Mal ohne Zeichen
                    left = { v: left.v.mul(expr(IMPL).v) };
                } else break;
            }
            return left;
        }
        if (!tokens.length) throw ERR('syntax');
        const r = expr(0);
        if (i < tokens.length) throw ERR('syntax');
        return r.v;
    }

    function constant(t, ctx) {
        switch (t.v) {
            case 'pi': return Dec.PI;
            case 'e': return Dec.E;
            case 'ans': return Dec.from(ctx.ans || '0');
            case 'rand': return Dec.from(t.r || '0');
        }
        const v = ctx.vars && ctx.vars[t.v];
        return Dec.from(v || '0');
    }

    function post(p, a) {
        switch (p) {
            case '!': return { v: factorial(a) };
            case 'sq': return { v: a.mul(a) };
            case 'cube': return { v: a.mul(a).mul(a) };
            case 'inv': return { v: Dec.ONE.div(a) };
            case 'pct': return { v: a.div(Dec.HUNDRED), pct: a };
        }
        throw ERR('syntax');
    }

    function binary(op, a, rr) {
        const b = rr.v;
        switch (op) {
            // 200 + 10 % = 220, 200 − 10 % = 180 (wie am Taschenrechner)
            case '+': return rr.pct ? a.add(a.mul(rr.pct).div(Dec.HUNDRED)) : a.add(b);
            case '-': return rr.pct ? a.sub(a.mul(rr.pct).div(Dec.HUNDRED)) : a.sub(b);
            case '*': return a.mul(b);
            case '/': return a.div(b);
            case 'mod': return a.mod(b);
            case '^': return power(a, b);
            case 'root': return root(a, b);
            case 'nCr': return comb(a, b, true);
            case 'nPr': return comb(a, b, false);
        }
        throw ERR('syntax');
    }

    /* ---------- Funktionen ---------- */
    const fl = x => Dec.fromNumber(Math.abs(x) < 1e-15 ? 0 : x, 15);

    function toRad(x, unit) {
        if (unit === 'deg') return x * Math.PI / 180;
        if (unit === 'grad') return x * Math.PI / 200;
        return x;
    }
    function fromRad(x, unit) {
        if (unit === 'deg') return x * 180 / Math.PI;
        if (unit === 'grad') return x * 200 / Math.PI;
        return x;
    }

    // genaue Werte im Gradmaß: sin 30° = 0,5 und nicht 0,49999…
    const EXACT_DEG = {
        sin: { 30: '0.5', 150: '0.5', 210: '-0.5', 330: '-0.5' },
        cos: { 60: '0.5', 120: '-0.5', 240: '-0.5', 300: '0.5' },
        tan: { 45: '1', 135: '-1', 225: '1', 315: '-1' },
    };

    function trig(f, x, unit) {
        let rad;
        if (unit === 'deg' || unit === 'grad') {
            const full = unit === 'deg' ? 360 : 400;
            const r = x.mod(full);
            const q = full / 4;
            if (r.mod(q).isZero()) {
                const k = r.div(q).toNumber();
                if (f === 'sin') return Dec.int([0, 1, 0, -1][k]);
                if (f === 'cos') return Dec.int([1, 0, -1, 0][k]);
                if (k % 2) throw ERR('math');
                return Dec.ZERO;
            }
            if (unit === 'deg' && r.isInt()) {
                const ex = EXACT_DEG[f][r.toNumber()];
                if (ex) return Dec.from(ex);
            }
            rad = toRad(r.toNumber(), unit);
        } else {
            rad = x.mod(Dec.PI.mul(2)).toNumber();
        }
        if (f === 'tan' && Math.abs(Math.cos(rad)) < 1e-15) throw ERR('math');
        return fl(Math[f](rad));
    }

    function log10(x) {
        if (x.sign() <= 0) throw ERR('math');
        if (x.m === 1n) return Dec.int(x.e);          // 10, 100, 0,001 … exakt
        // auch für Zahlen jenseits von 1e308
        const a = x.adj();
        const mant = Number(x.toExp().replace(/e.*$/, ''));
        return fl(Math.log10(mant) + a);
    }

    function func(f, x, ctx) {
        const n = () => x.toNumber();
        const unit = ctx.angle || 'deg';
        switch (f) {
            case 'sin': case 'cos': case 'tan': return trig(f, x, unit);
            case 'asin': case 'acos': {
                if (x.abs().cmp(1) > 0) throw ERR('math');
                return fl(fromRad(Math[f](n()), unit));
            }
            case 'atan': return fl(fromRad(Math.atan(n()), unit));
            case 'sinh': case 'cosh': case 'tanh': case 'asinh': return fl(Math[f](n()));
            case 'acosh': if (x.cmp(1) < 0) throw ERR('math'); return fl(Math.acosh(n()));
            case 'atanh': if (x.abs().cmp(1) >= 0) throw ERR('math'); return fl(Math.atanh(n()));
            case 'log': return log10(x);
            case 'ln': {
                if (x.sign() <= 0) throw ERR('math');
                if (x.eq(1)) return Dec.ZERO;
                const a = x.adj();
                if (Math.abs(a) < 300) return fl(Math.log(n()));
                return fl(Math.log(Number(x.toExp().replace(/e.*$/, ''))) + a * Math.LN10);
            }
            case 'sqrt': return x.sqrt();
            case 'cbrt': return root(Dec.int(3), x);
            case 'abs': return x.abs();
            case 'pow10': return power(Dec.int(10), x);
            case 'exp': return x.isZero() ? Dec.ONE : x.eq(1) ? Dec.E : power(Dec.E, x);
        }
        throw ERR('syntax');
    }

    /** Potenz: ganzzahlige Hochzahl exakt, sonst über Logarithmen (auch jenseits von 1e308) */
    function power(a, b) {
        if (b.isInt() && b.abs().cmp(100000) <= 0) return a.powInt(b.toNumber());
        if (a.isZero()) {
            if (b.sign() > 0) return Dec.ZERO;
            throw ERR('math');
        }
        if (a.isNeg()) {
            // (−8)^(1/3): nur wenn 1/b eine ungerade ganze Zahl ist
            const inv = Dec.ONE.div(b);
            const k = inv.round(0);
            if (inv.sub(k).abs().cmp('1e-12') < 0 && !k.isZero() && k.mod(2).eq(1)) return root(k, a);
            throw ERR('math');
        }
        const L = b.toNumber() * log10(a).toNumber();
        if (!isFinite(L)) throw ERR('overflow');
        if (L > Dec.MAX_EXP + 1) throw ERR('overflow');
        if (L < -Dec.MAX_EXP - 1) return Dec.ZERO;
        let r;
        if (Math.abs(L) < 300) r = fl(Math.pow(a.toNumber(), b.toNumber()));
        else {
            const ie = Math.floor(L);
            const m = Dec.fromNumber(Math.pow(10, L - ie), 15);
            r = new Dec(m.m, m.e + ie).chk();
        }
        return snapPow(r, a, b);
    }

    // 8^(1/3) soll 2 ergeben und nicht 1,9999999999999998
    function snapPow(r, a, b) {
        const c = r.roundSig(12);
        if (c.eq(r)) return r;
        try {
            const inv = Dec.ONE.div(b);
            const k = inv.round(0);
            if (inv.sub(k).abs().cmp('1e-20') < 0 && k.abs().cmp(1000) <= 0 && c.powInt(k.toNumber()).eq(a)) return c;
        } catch (e) { /* bleibt bei r */ }
        return r;
    }

    /** n-te Wurzel: y ˣ√ x */
    function root(y, x) {
        if (y.isZero()) throw ERR('math');
        if (y.eq(2)) return x.sqrt();
        const yi = y.isInt();
        if (x.isNeg()) {
            if (!yi || !y.mod(2).eq(1)) throw ERR('math');
            return root(y, x.neg()).neg();
        }
        if (x.isZero()) return Dec.ZERO;
        const r = power(x, Dec.ONE.div(y));
        if (yi && y.abs().cmp(1000) <= 0) {
            const c = r.roundSig(12);
            try { if (c.powInt(y.toNumber()).eq(x)) return c; } catch (e) { /* bleibt bei r */ }
        }
        return r;
    }

    function factorial(a) {
        if (!a.isInt() || a.isNeg()) throw ERR('math');
        if (a.cmp(3300) > 0) throw ERR('overflow');
        let n = a.toBigInt(), r = 1n;
        for (let k = 2n; k <= n; k++) r *= k;
        return Dec.from(r).chk();
    }

    function comb(nn, rr, isC) {
        if (!nn.isInt() || !rr.isInt() || nn.isNeg() || rr.isNeg() || rr.cmp(nn) > 0) throw ERR('math');
        let n = nn.toBigInt(), r = rr.toBigInt();
        if (isC && r > n - r) r = n - r;
        if (r > 20000n) throw ERR('overflow');
        let p = 1n;
        for (let k = 0n; k < r; k++) p *= n - k;
        if (isC) { let f = 1n; for (let k = 2n; k <= r; k++) f *= k; p /= f; }
        return Dec.from(p).chk();
    }

    /* =====================================================================
       ExprCalc: der Rechner für Einfach und Wissenschaftlich
       ===================================================================== */
    const DIGITS = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
    const VARS = ['A', 'B', 'C', 'D', 'E', 'F', 'M'];

    class ExprCalc {
        /** kind: basic | sci */
        constructor(kind, saved) {
            this.kind = kind;
            this.tokens = [];
            this.cursor = 0;
            this.res = null;        // letztes Ergebnis (Text, exakt)
            this.shown = false;     // Ergebnis steht da, die nächste Ziffer fängt neu an
            this.err = null;
            this.ans = '0';
            this.vars = {};
            this.last = null;       // für nochmal „=“: { op, v }
            this.view = 'dec';      // dec | frac | dms
            this.angle = 'deg';
            this.second = false;
            this.hyp = false;
            this.history = [];
            this.implicitStrong = true;
            if (saved) this.load(saved);
        }

        load(s) {
            const ok = Array.isArray(s.tokens) ? s.tokens.filter(t => t && typeof t.t === 'string') : [];
            this.tokens = ok;
            this.cursor = Math.min(Math.max(0, s.cursor | 0), ok.length);
            this.res = typeof s.res === 'string' ? s.res : null;
            this.shown = !!s.shown && this.res != null;
            this.ans = typeof s.ans === 'string' ? s.ans : '0';
            this.vars = s.vars && typeof s.vars === 'object' ? s.vars : {};
            this.last = s.last || null;
            this.angle = ['deg', 'rad', 'grad'].includes(s.angle) ? s.angle : 'deg';
            this.history = Array.isArray(s.history) ? s.history.slice(0, 200) : [];
        }
        save() {
            return { tokens: this.tokens, cursor: this.cursor, res: this.res, shown: this.shown, ans: this.ans, vars: this.vars,
                last: this.last, angle: this.angle, history: this.history };
        }

        ctx() { return { angle: this.angle, ans: this.ans, vars: this.vars, implicitStrong: this.implicitStrong }; }

        /** Live-Vorschau: was käme jetzt heraus? null, wenn (noch) nichts Sinnvolles */
        preview() {
            if (this.shown || !this.tokens.length) return null;
            let t = this.tokens.slice();
            while (t.length && t[t.length - 1].t === 'op') t.pop();
            if (t.length < 2 && !(t.length === 1 && t[0].t !== 'num' && t[0].t !== 'val')) return null;
            try { return evaluate(t, this.ctx()).toPlain(); } catch (e) { return null; }
        }

        startFresh() { this.tokens = []; this.cursor = 0; this.shown = false; this.err = null; this.view = 'dec'; }
        continueWithResult() {
            const r = this.res || '0';
            this.tokens = this.kind === 'sci' ? [{ t: 'const', v: 'ans' }] : [{ t: 'val', v: r }];
            this.cursor = 1;
            this.shown = false;
            this.err = null;
            this.view = 'dec';
        }

        insert(tok) {
            this.tokens.splice(this.cursor, 0, tok);
            this.cursor++;
        }
        prev() { return this.tokens[this.cursor - 1]; }

        /** Ein Tastendruck. Gibt true zurück, wenn sich etwas geändert hat. */
        press(k) {
            const startsNew = DIGITS.has(k) || k === '00' || k === 'dot' || k === 'EE' || k === 'neg' || k === 'lp' || k === 'ans' || k === 'rand'
                || k.startsWith('fn:') || k.startsWith('const:') || k.startsWith('var:');
            const continues = ['+', '-', '*', '/', '^', 'root', 'nCr', 'nPr', 'mod', 'rp'].includes(k) || k.startsWith('post:');

            if (this.err) {
                this.err = null;
                if (k === 'ac') return this.press('ac');
                if (this.kind === 'basic' && (startsNew || continues)) this.startFresh();
                if (k === 'del' || k === 'left' || k === 'right') return true;
            }
            if (this.shown) {
                if (startsNew) this.startFresh();
                else if (continues) this.continueWithResult();
                else if (k === 'del' || k === 'left' || k === 'right') {
                    this.shown = false;
                    if (this.kind === 'basic') {
                        const s = Dec.from(this.res || '0').roundSig(15).toPlain();
                        this.tokens = [{ t: 'num', s }];
                        this.cursor = 1;
                        if (k !== 'del') return true;
                    } else {
                        this.cursor = this.tokens.length;
                        return true;
                    }
                }
            }

            if (DIGITS.has(k) || k === '00') return this.digit(k);
            switch (k) {
                case 'dot': return this.digit('.');
                case 'EE': return this.exp();
                case '+': case '-': case '*': case '/': case '^': case 'root': case 'nCr': case 'nPr': case 'mod': return this.op(k);
                case 'neg': return this.negKey();
                case 'pm': return this.plusMinus();
                case 'lp': this.insert({ t: 'lp' }); return true;
                case 'rp': this.insert({ t: 'rp' }); return true;
                case 'ans': this.insert({ t: 'const', v: 'ans' }); return true;
                case 'rand': this.insert({ t: 'const', v: 'rand', r: String(Math.floor(Math.random() * 1000) / 1000) }); return true;
                case 'pct': this.insert({ t: 'post', v: 'pct' }); return true;
                case '=': return this.equals();
                case 'del': return this.del();
                case 'ac': this.startFresh(); this.res = null; return true;
                case 'left': if (this.cursor > 0) { this.cursor--; return true; } this.cursor = this.tokens.length; return true;
                case 'right': if (this.cursor < this.tokens.length) { this.cursor++; return true; } this.cursor = 0; return true;
                case 'drg': this.angle = { deg: 'rad', rad: 'grad', grad: 'deg' }[this.angle]; return true;
                case 'deg': case 'rad': case 'grad': this.angle = k; return true;
                case 'sd': return this.toggleView('frac');
                case 'dms': return this.toggleView('dms');
                case 'mplus': return this.memory(1);
                case 'mminus': return this.memory(-1);
                case 'mc': this.vars.M = '0'; return true;
            }
            if (k.startsWith('fn:')) { this.insert({ t: 'fn', v: k.slice(3) }); return true; }
            if (k.startsWith('post:')) { this.insert({ t: 'post', v: k.slice(5) }); return true; }
            if (k.startsWith('const:')) { this.insert({ t: 'const', v: k.slice(6) }); return true; }
            if (k.startsWith('var:')) { const v = k.slice(4); if (VARS.includes(v)) { this.insert({ t: 'const', v }); return true; } return false; }
            if (k.startsWith('sto:')) return this.store(k.slice(4));
            return false;
        }

        digit(d) {
            const p = this.prev();
            if (p && p.t === 'num') {
                const s = p.s;
                if (s.length >= 40) return false;
                const hasE = /e/i.test(s);
                if (d === '.') {
                    if (hasE || s.includes('.')) return false;
                    p.s = s + '.';
                } else if (!hasE && (s === '0' || s === '-0')) {
                    p.s = s.slice(0, -1) + (d === '00' ? '0' : d);
                } else if (hasE && /e-?$/i.test(s) && (d === '0' || d === '00')) {
                    return false;
                } else {
                    if (hasE && s.replace(/^.*e-?/i, '').length >= 4) return false;
                    p.s = s + d;
                }
                return true;
            }
            this.insert({ t: 'num', s: d === '.' ? '0.' : d === '00' ? '0' : d });
            return true;
        }

        exp() {
            const p = this.prev();
            if (p && p.t === 'num') {
                if (/e/i.test(p.s)) return false;
                p.s = p.s.replace(/\.$/, '') + 'E';
                return true;
            }
            this.insert({ t: 'num', s: '1E' });
            return true;
        }

        op(k) {
            const p = this.prev();
            if (p && p.t === 'num' && /e$/i.test(p.s) && k === '-') { p.s += '-'; return true; }
            if (p && p.t === 'op') {
                // 5 × − 3: Minus nach Mal oder Geteilt ist ein Vorzeichen, sonst wird das Rechenzeichen getauscht
                if (k === '-' && ['*', '/', '^', 'root', 'mod', 'nCr', 'nPr'].includes(p.v)) { this.insert({ t: 'neg' }); return true; }
                p.v = k;
                return true;
            }
            if (!p || p.t === 'lp' || p.t === 'fn' || p.t === 'neg') {
                if (k === '-') { if (p && p.t === 'neg') return false; this.insert({ t: 'neg' }); return true; }
                if (!p && this.kind === 'basic') { this.tokens = [{ t: 'val', v: this.res || '0' }]; this.cursor = 1; }
                else if (!p) return false;
                else if (k === '+') return false;
            }
            this.insert({ t: 'op', v: k });
            return true;
        }

        negKey() {
            const p = this.prev();
            if (p && p.t === 'num' && /e$/i.test(p.s)) { p.s += '-'; return true; }
            this.insert({ t: 'neg' });
            return true;
        }

        /** ± im einfachen Modus: Vorzeichen der Zahl links vom Cursor umdrehen */
        plusMinus() {
            if (this.shown) {
                const r = Dec.from(this.res || '0').neg().toPlain();
                this.res = r; this.ans = r;
                this.tokens = [{ t: 'val', v: r }]; this.cursor = 1;
                return true;
            }
            let j = this.cursor - 1;
            const t = this.tokens;
            if (j < 0 || t[j].t === 'op' || t[j].t === 'lp' || t[j].t === 'fn') { this.insert({ t: 'neg' }); return true; }
            if (t[j].t === 'neg') { t.splice(j, 1); this.cursor--; return true; }
            while (j > 0 && t[j].t === 'post') j--;
            if (t[j].t === 'rp') {
                let depth = 0;
                for (; j >= 0; j--) {
                    if (t[j].t === 'rp') depth++;
                    else if (t[j].t === 'lp' || t[j].t === 'fn') { depth--; if (depth === 0) break; }
                }
                if (j < 0) j = 0;
            }
            if (j > 0 && t[j - 1].t === 'neg') { t.splice(j - 1, 1); this.cursor--; }
            else { t.splice(j, 0, { t: 'neg' }); this.cursor++; }
            return true;
        }

        del() {
            if (this.cursor === 0) return false;
            const p = this.prev();
            if (p.t === 'num' && p.s.length > 1) {
                p.s = p.s.slice(0, -1);
                if (p.s === '-' || p.s === '') this.removePrev();
                return true;
            }
            if (p.t === 'val') {
                const s = Dec.from(p.v).roundSig(15).toPlain();
                if (s.length > 1) { p.t = 'num'; p.s = s.slice(0, -1); delete p.v; if (p.s === '-') this.removePrev(); return true; }
            }
            this.removePrev();
            return true;
        }
        removePrev() { this.tokens.splice(this.cursor - 1, 1); this.cursor--; }

        /** Rechnet aus. Bei Fehler bleibt die Rechnung zum Verbessern stehen. */
        equals() {
            let t = this.tokens.slice();
            if (this.shown && this.kind === 'basic' && this.last) {
                // nochmal „=“: letzte Rechenart wiederholen (5 + 3 = = = → 8, 11, 14)
                t = [{ t: 'val', v: this.res }, { t: 'op', v: this.last.op }, { t: 'val', v: this.last.v }];
            } else if (this.shown && this.kind === 'sci') {
                t = this.tokens.slice();      // wie am Schulrechner: dieselbe Rechnung mit neuem Ans
            }
            if (this.kind === 'basic') while (t.length && t[t.length - 1].t === 'op') t.pop();
            if (!t.length) return false;
            let v;
            try { v = evaluate(t, this.ctx()); } catch (e) {
                if (!(e instanceof CalcError)) throw e;
                this.err = e.code;
                this.shown = false;
                return true;
            }
            const res = v.toPlain();
            // für die Wiederholung: oberste letzte Rechenart mit Zahl dahinter merken
            if (this.kind === 'basic' && !(this.shown && this.last)) {
                const n = t.length;
                if (n >= 3 && t[n - 2].t === 'op' && ['+', '-', '*', '/'].includes(t[n - 2].v) && (t[n - 1].t === 'num' || t[n - 1].t === 'val') && !t.some(x => x.t === 'lp' || x.t === 'fn')) {
                    try { this.last = { op: t[n - 2].v, v: evaluate([t[n - 1]], this.ctx()).toPlain() }; } catch (e) { this.last = null; }
                } else this.last = null;
            }
            this.tokens = t;
            this.cursor = t.length;
            this.history.unshift({ e: t, r: res, a: this.kind === 'sci' ? this.angle : undefined, ts: Date.now() });
            if (this.history.length > 200) this.history.length = 200;
            this.res = res;
            this.ans = res;
            this.shown = true;
            this.err = null;
            this.view = 'dec';
            return true;
        }

        /** Wert für Speicher und Variablen: das Ergebnis, sonst die Rechnung ausrechnen */
        currentValue() {
            if (this.shown && this.res != null) return Dec.from(this.res);
            if (!this.tokens.length) return Dec.from(this.res || '0');
            if (!this.equals() || this.err) return null;
            return Dec.from(this.res);
        }
        memory(sign) {
            const v = this.currentValue();
            if (!v) return true;
            const m = Dec.from(this.vars.M || '0');
            this.vars.M = (sign > 0 ? m.add(v) : m.sub(v)).toPlain();
            return true;
        }
        store(name) {
            if (!VARS.includes(name)) return false;
            const v = this.currentValue();
            if (!v) return true;
            this.vars[name] = v.toPlain();
            return true;
        }
        toggleView(kind) {
            if (!this.shown || this.res == null) return false;
            if (this.view === kind) { this.view = 'dec'; return true; }
            if (kind === 'frac' && !C.fmt.fraction(this.res)) return false;
            this.view = kind;
            return true;
        }

        /** Klammern, die noch offen sind (zeigt die Anzeige blass an) */
        openParens() {
            let d = 0;
            for (const t of this.tokens) { if (t.t === 'lp' || t.t === 'fn') d++; else if (t.t === 'rp' && d > 0) d--; }
            return d;
        }
    }

    C.engine = { evaluate, tokenText, exprText, OPS, FNS, POSTS, CONSTS, power, root, factorial, func };
    C.ExprCalc = ExprCalc;
})(self.Calc = self.Calc || {});
