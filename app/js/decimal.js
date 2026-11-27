/* Calc – exakte Dezimalzahlen.
   Eine Zahl ist Mantisse (BigInt) mal Zehnerpotenz. So ergibt 0,1 + 0,2 wirklich 0,3, und bei Geldbeträgen geht kein Cent verloren.
   Plus, Minus und Mal sind exakt, Geteilt und Wurzel rechnen auf 40 gültige Stellen. Kein Framework, keine Abhängigkeit. */
(function (C) {
    'use strict';

    const MAX_EXP = 9999;      // größer als 9,99…×10^9999 gibt „Überlauf“
    const MAX_SIG = 50;        // mehr gültige Stellen hebt keine Rechnung auf
    const DIV_SIG = 40;        // Stellen beim Teilen und Wurzelziehen

    class CalcError extends Error {
        constructor(code) { super(code); this.code = code; }   // syntax, math, overflow
    }

    const P10 = [1n];
    function p10(n) {
        if (n < 400) { while (P10.length <= n) P10.push(P10[P10.length - 1] * 10n); return P10[n]; }
        return 10n ** BigInt(n);
    }
    const absB = x => (x < 0n ? -x : x);
    const lenB = x => (x === 0n ? 1 : absB(x).toString().length);

    class Dec {
        constructor(m, e) {
            if (m === 0n) { this.m = 0n; this.e = 0; return; }
            const s = m.toString();
            const t = s.replace(/0+$/, '');
            if (t.length !== s.length) { m = BigInt(t); e += s.length - t.length; }
            this.m = m; this.e = e;
        }

        /* ---------- Erzeugen ---------- */
        static from(v) {
            if (v instanceof Dec) return v;
            if (typeof v === 'bigint') return new Dec(v, 0);
            if (typeof v === 'number') return Dec.fromNumber(v, 17);
            const s = String(v).trim().replace(',', '.').replace(/−/g, '-');
            const r = /^([+-])?(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(s);
            if (!r || (r[2] === '' && (r[3] === undefined || r[3] === ''))) throw new CalcError('syntax');
            const frac = r[3] || '';
            let m = BigInt((r[2] || '0') + frac);
            if (r[1] === '-') m = -m;
            const ex = r[4] ? parseInt(r[4], 10) : 0;
            if (!isFinite(ex) || Math.abs(ex) > 99999) throw new CalcError('overflow');
            return new Dec(m, ex - frac.length).chk();
        }
        /** Aus einer Kommazahl des Rechners, gerundet auf sig Stellen (Funktionen wie sin, log liefern 15–16 sichere Stellen) */
        static fromNumber(x, sig) {
            if (!isFinite(x)) throw new CalcError(isNaN(x) ? 'math' : 'overflow');
            if (x === 0) return ZERO;
            return Dec.from(x.toPrecision(Math.min(sig || 15, 17)));
        }
        static int(n) { return new Dec(BigInt(n), 0); }

        /** Prüft den Wertebereich: zu groß wird Fehler, zu klein wird 0 */
        chk() {
            if (this.m === 0n) return this;
            const a = this.adj();
            if (a > MAX_EXP) throw new CalcError('overflow');
            if (a < -MAX_EXP) return ZERO;
            return this.digits() > MAX_SIG ? this.roundSig(MAX_SIG) : this;
        }

        /* ---------- Eigenschaften ---------- */
        digits() { return lenB(this.m); }
        adj() { return this.e + this.digits() - 1; }          // Exponent der ersten Ziffer: 123 → 2, 0,05 → −2
        sign() { return this.m > 0n ? 1 : this.m < 0n ? -1 : 0; }
        isZero() { return this.m === 0n; }
        isNeg() { return this.m < 0n; }
        isInt() { return this.e >= 0; }
        cmp(b) {
            b = Dec.from(b);
            const d = this.sub(b);
            return d.sign();
        }
        eq(b) { return this.cmp(b) === 0; }

        /* ---------- Rechnen ---------- */
        neg() { return new Dec(-this.m, this.e); }
        abs() { return this.m < 0n ? this.neg() : this; }
        add(b) {
            b = Dec.from(b);
            if (this.m === 0n) return b;
            if (b.m === 0n) return this;
            const e = Math.min(this.e, b.e);
            // sehr unterschiedliche Größen: der kleine Teil fällt jenseits der Genauigkeit ohnehin weg
            if (Math.abs(this.adj() - b.adj()) > MAX_SIG + 5) return this.abs().cmp(b.abs()) > 0 ? this : b;
            return new Dec(this.m * p10(this.e - e) + b.m * p10(b.e - e), e).chk();
        }
        sub(b) { return this.add(Dec.from(b).neg()); }
        mul(b) {
            b = Dec.from(b);
            if (this.m === 0n || b.m === 0n) return ZERO;
            if (this.adj() + b.adj() > MAX_EXP + 1) throw new CalcError('overflow');
            return new Dec(this.m * b.m, this.e + b.e).chk();
        }
        div(b, sig) {
            b = Dec.from(b);
            if (b.m === 0n) throw new CalcError('math');
            if (this.m === 0n) return ZERO;
            sig = sig || DIV_SIG;
            const k = Math.max(0, sig - this.digits() + b.digits() + 1);
            const num = this.m * p10(k);
            let q = num / b.m;
            const r = num % b.m;
            if (r !== 0n && absB(r) * 2n >= absB(b.m)) q += (num < 0n) !== (b.m < 0n) ? -1n : 1n;
            return new Dec(q, this.e - b.e - k).roundSig(sig).chk();
        }
        /** Rest mit dem Vorzeichen des Teilers (wie in der Mathematik): 7 mod 3 = 1, −7 mod 3 = 2 */
        mod(b) {
            b = Dec.from(b);
            if (b.isZero()) throw new CalcError('math');
            const q = this.div(b).floor();
            return this.sub(b.mul(q));
        }
        /** Ganzzahlige Potenz, exakt (negative mit Teilen) */
        powInt(n) {
            if (n === 0) {
                if (this.isZero()) throw new CalcError('math');
                return ONE;
            }
            if (this.isZero()) {
                if (n < 0) throw new CalcError('math');
                return ZERO;
            }
            const neg = n < 0;
            n = Math.abs(n);
            const a = this.adj();
            if (Math.abs((a + (a >= 0 ? 1 : 0)) * n) > MAX_EXP + 2) {
                if (!neg && a >= 0) throw new CalcError('overflow');
                if (neg && a < 0) throw new CalcError('overflow');
            }
            let base = this, r = ONE;
            while (n > 0) {
                if (n & 1) r = r.mul(base);
                n >>= 1;
                if (n) base = base.mul(base);
            }
            return neg ? ONE.div(r) : r;
        }
        /** Quadratwurzel auf sig Stellen, für Quadratzahlen exakt (√2,25 = 1,5) */
        sqrt(sig) {
            if (this.isNeg()) throw new CalcError('math');
            if (this.isZero()) return ZERO;
            sig = sig || DIV_SIG;
            let m = this.m, e = this.e;
            if (e % 2 !== 0) { m *= 10n; e -= 1; }
            const k = Math.max(0, sig - Math.floor(lenB(m) / 2) + 2);
            const n = m * p10(2 * k);
            const r = isqrt(n);
            // Quadratzahl: exakt. Sonst eine Stelle mehr ausrechnen und darauf runden.
            const res = r * r === n ? new Dec(r, e / 2 - k) : new Dec(isqrt(n * 100n), e / 2 - k - 1).roundSig(sig);
            return res.chk();
        }
        floor() {
            if (this.e >= 0) return this;
            const d = p10(-this.e);
            let q = this.m / d;
            if (this.m < 0n && this.m % d !== 0n) q -= 1n;
            return new Dec(q, 0);
        }
        trunc() {
            if (this.e >= 0) return this;
            return new Dec(this.m / p10(-this.e), 0);
        }

        /* ---------- Runden ----------
           mode: 'half' = kaufmännisch (ab 5 weg von der Null), 'up' = immer weg von der Null (aufrunden), 'down' = abschneiden */
        round(dp, mode) {
            if (this.e >= -dp) return this;
            return roundShift(this, -this.e - dp, mode);
        }
        roundSig(sig, mode) {
            const over = this.digits() - sig;
            if (over <= 0) return this;
            return roundShift(this, over, mode);
        }

        /* ---------- Umwandeln ---------- */
        toBigInt() { return this.e >= 0 ? this.m * p10(this.e) : this.m / p10(-this.e); }
        toNumber() { return Number(this.toExp()); }
        /** 1.2345e+12 als Text, für parseFloat */
        toExp() {
            const s = absB(this.m).toString();
            return (this.m < 0n ? '-' : '') + s[0] + (s.length > 1 ? '.' + s.slice(1) : '') + 'e' + this.adj();
        }
        /** Ausgeschrieben, mit Punkt, ohne Tausender: -1234.5 */
        toPlain() {
            const neg = this.m < 0n;
            let s = absB(this.m).toString();
            if (this.e >= 0) s += '0'.repeat(this.e);
            else {
                const k = -this.e;
                if (s.length <= k) s = '0'.repeat(k - s.length + 1) + s;
                s = s.slice(0, s.length - k) + '.' + s.slice(s.length - k);
            }
            return (neg ? '-' : '') + s;
        }
        toString() { return this.toPlain(); }
        toJSON() { return this.toPlain(); }
    }

    function roundShift(x, shift, mode) {
        const d = p10(shift);
        let q = x.m / d;                  // BigInt teilt Richtung Null
        const r = absB(x.m % d);
        if (r !== 0n) {
            const away = mode === 'up' ? true : mode === 'down' ? false : r * 2n >= d;
            if (away) q += x.m < 0n ? -1n : 1n;
        }
        return new Dec(q, x.e + shift);
    }

    /** Ganzzahlige Quadratwurzel (abgerundet), Newton-Verfahren */
    function isqrt(n) {
        if (n < 2n) return n;
        let x = BigInt('1' + '0'.repeat(Math.ceil(n.toString().length / 2)));
        for (;;) {
            const y = (x + n / x) >> 1n;
            if (y >= x) return x;
            x = y;
        }
    }

    const ZERO = new Dec(0n, 0);
    const ONE = new Dec(1n, 0);
    const PI = Dec.from('3.14159265358979323846264338327950288419716939937510');
    const E = Dec.from('2.71828182845904523536028747135266249775724709369995');

    Dec.ZERO = ZERO; Dec.ONE = ONE; Dec.PI = PI; Dec.E = E;
    Dec.HUNDRED = Dec.int(100);
    Dec.MAX_EXP = MAX_EXP;
    Dec.isqrt = isqrt;

    C.Dec = Dec;
    C.CalcError = CalcError;
})(self.Calc = self.Calc || {});
