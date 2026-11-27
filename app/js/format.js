/* Calc – Zahlen für die Anzeige aufbereiten: Tausender, Dezimalzeichen, Exponent, Bruch, Grad/Minuten/Sekunden.
   Gerechnet wird hier nichts, nur dargestellt. Das Minus ist immer das echte Minuszeichen (U+2212). */
(function (C) {
    'use strict';
    const Dec = C.Dec;
    const MINUS = '−';

    /** Zahlenformate: Dezimalzeichen und Tausendertrenner */
    const LOCALES = {
        de: { dec: ',', grp: '.' },
        en: { dec: '.', grp: ',' },
        fr: { dec: ',', grp: ' ' },
        ch: { dec: '.', grp: '’' },
    };

    function groupInt(s, grp) {
        if (!grp || s.length < 4) return s;
        let out = '';
        for (let i = 0; i < s.length; i++) {
            if (i && (s.length - i) % 3 === 0) out += grp;
            out += s[i];
        }
        return out;
    }

    /** Ausgeschriebene Zahl (ohne Vorzeichen) mit Trennzeichen */
    function plain(absPlain, o) {
        const i = absPlain.indexOf('.');
        const int = i < 0 ? absPlain : absPlain.slice(0, i);
        const frac = i < 0 ? '' : absPlain.slice(i + 1);
        return groupInt(int, o.group === false ? '' : o.grp) + (frac ? o.dec + frac : '');
    }

    function mantissa(r, places, o) {
        let s = (r.m < 0n ? -r.m : r.m).toString();
        if (places != null) s = (s + '0'.repeat(places)).slice(0, Math.max(1, places));
        return s[0] + (s.length > 1 ? o.dec + s.slice(1) : '');
    }

    /**
     * Zahl für die Anzeige.
     * o: { dec, grp, group, sig (Stellen, Standard 15), mode: norm|fix|sci|eng, places, maxLen }
     * Ergebnis: { neg, mant, exp } – exp ist null bei ausgeschriebenen Zahlen. text = alles in einer Zeile.
     */
    function num(d, o) {
        o = Object.assign({ dec: ',', grp: '.', group: true, sig: 15, mode: 'norm', places: null, maxLen: 22 }, o || {});
        d = Dec.from(d);
        const neg = d.isNeg();
        let mant, exp = null;
        const mode = o.mode;
        if (mode === 'fix') {
            const p = o.places == null ? 2 : o.places;
            const r = d.round(p, o.rounding || 'half');
            if (!r.isZero() && r.adj() >= 15) return num(d, Object.assign({}, o, { mode: 'sci', places: 10 }));
            let s = r.abs().toPlain();
            if (p > 0) {
                const i = s.indexOf('.');
                const have = i < 0 ? 0 : s.length - i - 1;
                s = (i < 0 ? s + '.' : s) + '0'.repeat(Math.max(0, p - have));
            }
            mant = plain(s, o);
            const isNeg = neg && !r.isZero();
            return finish(isNeg, mant, null);
        }
        if (d.isZero()) {
            if (mode === 'sci') return finish(false, mantissa(Dec.ZERO, o.places || 1, o), 0);
            return finish(false, '0', null);
        }
        if (mode === 'sci') {
            const p = o.places || 10;
            const r = d.roundSig(p);
            return finish(neg, mantissa(r, p, o), r.adj());
        }
        const r = d.roundSig(o.sig);
        const a = r.adj();
        if (mode === 'eng') {
            const e3 = Math.floor(a / 3) * 3;
            const shifted = new Dec(r.m < 0n ? -r.m : r.m, r.e - e3);
            return finish(neg, plain(shifted.toPlain(), Object.assign({}, o, { group: false })), e3);
        }
        // norm: ausgeschrieben, solange es lesbar bleibt
        if (a >= o.sig || a < -7) return finish(neg, mantissa(r, null, o), a);
        const p = plain(r.abs().toPlain(), o);
        if (p.length > o.maxLen) return finish(neg, mantissa(r, null, o), a);
        return finish(neg, p, null);
    }

    function finish(neg, mant, exp) {
        const m = (neg ? MINUS : '') + mant;
        return { neg, mant: m, exp, text: exp == null ? m : m + 'E' + (exp < 0 ? MINUS + -exp : exp) };
    }

    /** Was gerade eingetippt wird (Text mit Punkt und evtl. E), so wie es dasteht: „1.234,“ bleibt mit Komma stehen */
    function entry(s, o) {
        o = Object.assign({ dec: ',', grp: '.', group: true }, o || {});
        let neg = false;
        if (s[0] === '-') { neg = true; s = s.slice(1); }
        const ei = s.search(/e/i);
        const base = ei < 0 ? s : s.slice(0, ei);
        const ex = ei < 0 ? null : s.slice(ei + 1);
        const i = base.indexOf('.');
        const int = i < 0 ? base : base.slice(0, i);
        const out = groupInt(int || (i >= 0 ? '0' : ''), o.group === false ? '' : o.grp) + (i >= 0 ? o.dec + base.slice(i + 1) : '');
        return { neg, mant: (neg ? MINUS : '') + out, exp: ex == null ? null : ex.replace('-', MINUS), text: (neg ? MINUS : '') + out + (ex == null ? '' : 'E' + ex.replace('-', MINUS)) };
    }

    /**
     * Als Bruch, wenn die Zahl einer ist (Kettenbruch, Nenner bis 10^9): 0,75 → 3/4.
     * Ergebnis { neg, n, d, whole } mit BigInt oder null.
     */
    function fraction(x) {
        x = Dec.from(x);
        if (x.isInt()) return null;
        const neg = x.isNeg();
        let p = (neg ? -x.m : x.m), q = 10n ** BigInt(-x.e);
        const P = p, Q = q;
        let h0 = 0n, h1 = 1n, k0 = 1n, k1 = 0n;
        for (let i = 0; i < 64 && q !== 0n; i++) {
            const a = p / q;
            [p, q] = [q, p - a * q];
            [h0, h1] = [h1, a * h1 + h0];
            [k0, k1] = [k1, a * k1 + k0];
            if (k1 > 1000000000n) return null;
            // nah genug dran? |P/Q − h/k| ≤ 10^−30 · max(1, P/Q)
            let diff = P * k1 - h1 * Q;
            if (diff < 0n) diff = -diff;
            const scale = P > Q ? P : Q;
            if (diff * 10n ** 30n <= scale * k1) {
                if (k1 === 1n) return null;
                return { neg, n: h1, d: k1, whole: h1 / k1, rest: h1 % k1 };
            }
        }
        return null;
    }

    /** Grad, Minuten, Sekunden: 12,5 → 12°30′0″ */
    function dms(x, o) {
        o = Object.assign({ dec: ',' }, o || {});
        x = Dec.from(x);
        const neg = x.isNeg();
        x = x.abs();
        let d = x.trunc();
        let restMin = x.sub(d).mul(60);
        let m = restMin.trunc();
        let s = restMin.sub(m).mul(60).round(2);
        if (s.cmp(60) >= 0) { s = Dec.ZERO; m = m.add(1); }
        if (m.cmp(60) >= 0) { m = Dec.ZERO; d = d.add(1); }
        return (neg ? MINUS : '') + d.toPlain() + '°' + m.toPlain() + '′' + s.toPlain().replace('.', o.dec) + '″';
    }

    C.fmt = { num, entry, fraction, dms, plain, groupInt, LOCALES, MINUS };
})(self.Calc = self.Calc || {});
