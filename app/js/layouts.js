/* Calc – Tastenbelegung der drei Modi.
   Eine Taste: { k: was sie tut, l: Beschriftung, c: Art (num, op, fn, eq, del, mod), a: zweite Belegung { k, l },
   s: kleine Unterzeile, n: Name für Bildschirmleser (deutsch, übersetzt per t()), span: Zeilen, cspan: Spalten } */
(function (C) {
    'use strict';
    const k = (key, l, c, extra) => Object.assign({ k: key, l: l == null ? key : l, c: c || 'num' }, extra || {});

    const digits = d => k(d, d, 'num');

    C.layouts = {
        basic: {
            cols: 4,
            keys: [
                k('ac', 'AC', 'del', { n: 'Alles löschen' }), k('del', '⌫', 'fn', { n: 'Löschen', repeat: true }), k('pct', '%', 'fn', { n: 'Prozent' }), k('/', '÷', 'op', { n: 'geteilt durch' }),
                digits('7'), digits('8'), digits('9'), k('*', '×', 'op', { n: 'mal' }),
                digits('4'), digits('5'), digits('6'), k('-', '−', 'op', { n: 'minus' }),
                digits('1'), digits('2'), digits('3'), k('+', '+', 'op', { n: 'plus' }),
                k('pm', '±', 'num', { n: 'Vorzeichen' }), digits('0'), k('dot', ',', 'num', { n: 'Komma', dot: true }), k('=', '=', 'eq', { n: 'ist gleich' }),
            ],
        },

        sci: {
            // oberer Block: Funktionen (klein), unterer Block: Zahlen
            fn: {
                cols: 6,
                keys: [
                    k('shift', '2nd', 'mod', { n: 'Zweite Belegung', toggle: 'second' }),
                    k('hyp', 'hyp', 'fn', { n: 'Hyperbelfunktionen', toggle: 'hyp' }),
                    k('drg', 'DRG', 'fn', { n: 'Winkelmaß wechseln' }),
                    k('fmt', 'FMT', 'fn', { n: 'Zahlenformat', a: k('sd', 'S⇔D', 'fn', { n: 'Bruch oder Dezimalzahl' }) }),
                    k('left', '◀', 'fn', { n: 'Cursor nach links', repeat: true }),
                    k('right', '▶', 'fn', { n: 'Cursor nach rechts', repeat: true }),

                    k('post:inv', 'x⁻¹', 'fn', { n: 'Kehrwert', a: k('post:!', 'x!', 'fn', { n: 'Fakultät' }) }),
                    k('post:sq', 'x²', 'fn', { n: 'Quadrat', a: k('post:cube', 'x³', 'fn', { n: 'hoch drei' }) }),
                    k('^', 'xʸ', 'fn', { n: 'hoch', a: k('root', 'ʸ√x', 'fn', { n: 'y-te Wurzel' }) }),
                    k('fn:sqrt', '√', 'fn', { n: 'Wurzel', a: k('fn:cbrt', '∛', 'fn', { n: 'dritte Wurzel' }) }),
                    k('fn:log', 'log', 'fn', { n: 'Logarithmus', a: k('fn:pow10', '10ˣ', 'fn', { n: 'zehn hoch' }) }),
                    k('fn:ln', 'ln', 'fn', { n: 'natürlicher Logarithmus', a: k('fn:exp', 'eˣ', 'fn', { n: 'e hoch' }) }),

                    k('fn:sin', 'sin', 'fn', { n: 'Sinus', a: k('fn:asin', 'sin⁻¹', 'fn', { n: 'Arkussinus' }) }),
                    k('fn:cos', 'cos', 'fn', { n: 'Kosinus', a: k('fn:acos', 'cos⁻¹', 'fn', { n: 'Arkuskosinus' }) }),
                    k('fn:tan', 'tan', 'fn', { n: 'Tangens', a: k('fn:atan', 'tan⁻¹', 'fn', { n: 'Arkustangens' }) }),
                    k('const:pi', 'π', 'fn', { n: 'Pi', a: k('const:e', 'e', 'fn', { n: 'Eulersche Zahl' }) }),
                    k('lp', '(', 'fn', { n: 'Klammer auf' }),
                    k('rp', ')', 'fn', { n: 'Klammer zu' }),

                    k('neg', '(−)', 'fn', { n: 'Vorzeichen minus', a: k('fn:abs', 'Abs', 'fn', { n: 'Betrag' }) }),
                    k('pct', '%', 'fn', { n: 'Prozent', a: k('mod', 'mod', 'fn', { n: 'Rest' }) }),
                    k('nCr', 'nCr', 'fn', { n: 'Kombinationen', a: k('nPr', 'nPr', 'fn', { n: 'Variationen' }) }),
                    k('dms', '°′″', 'fn', { n: 'Grad Minuten Sekunden', a: k('rand', 'Ran#', 'fn', { n: 'Zufallszahl' }) }),
                    k('sto', 'STO', 'fn', { n: 'Speichern', a: k('rcl', 'RCL', 'fn', { n: 'Abrufen' }) }),
                    k('mplus', 'M+', 'fn', { n: 'Speicher plus', a: k('mminus', 'M−', 'fn', { n: 'Speicher minus' }) }),
                ],
            },
            main: {
                cols: 5,
                keys: [
                    digits('7'), digits('8'), digits('9'),
                    k('del', 'DEL', 'del', { n: 'Löschen', repeat: true }),
                    k('ac', 'AC', 'del', { n: 'Alles löschen', a: k('mc', 'MC', 'del', { n: 'Speicher löschen' }) }),
                    digits('4'), digits('5'), digits('6'), k('*', '×', 'op', { n: 'mal' }), k('/', '÷', 'op', { n: 'geteilt durch' }),
                    digits('1'), digits('2'), digits('3'), k('+', '+', 'op', { n: 'plus' }), k('-', '−', 'op', { n: 'minus' }),
                    digits('0'), k('dot', ',', 'num', { n: 'Komma', dot: true }),
                    k('EE', '×10ˣ', 'num', { n: 'mal zehn hoch' }),
                    k('ans', 'Ans', 'num', { n: 'Letztes Ergebnis', a: k('var:M', 'MR', 'num', { n: 'Speicher abrufen' }) }),
                    k('=', '=', 'eq', { n: 'ist gleich' }),
                ],
            },
        },

        office: {
            strip: {
                cols: 5,
                keys: [
                    k('mc', 'MC', 'fn', { n: 'Speicher löschen' }), k('mr', 'MR', 'fn', { n: 'Speicher abrufen' }),
                    k('mminus', 'M−', 'fn', { n: 'Speicher minus' }), k('mplus', 'M+', 'fn', { n: 'Speicher plus' }),
                    k('GT', 'GT', 'fn', { n: 'Gesamtsumme', s: 'Gesamt' }),
                    k('pm', '±', 'fn', { n: 'Vorzeichen' }),
                    k('mu', 'MU', 'fn', { n: 'Aufschlag auf Marge', s: 'Marge' }),
                    k('delta', 'Δ%', 'fn', { n: 'Änderung in Prozent', s: 'Änderung' }),
                    k('taxm', '−MwSt', 'fn', { n: 'Steuer herausrechnen', s: 'netto' }),
                    k('taxp', '+MwSt', 'fn', { n: 'Steuer dazurechnen', s: 'brutto' }),
                ],
            },
            main: {
                cols: 5,
                keys: [
                    k('ac', 'C', 'del', { n: 'Alles löschen', s: 'alles' }), k('ce', 'CE', 'del', { n: 'Eingabe löschen', s: 'Eingabe' }),
                    k('del', '⌫', 'fn', { n: 'Ziffer löschen', repeat: true }), k('/', '÷', 'op', { n: 'geteilt durch' }),
                    k('S', '◇', 'op', { n: 'Zwischensumme', s: 'Zw.-Summe' }),
                    digits('7'), digits('8'), digits('9'), k('*', '×', 'op', { n: 'mal' }), k('T', '✱', 'op', { n: 'Summe', s: 'Summe' }),
                    digits('4'), digits('5'), digits('6'), k('-', '−', 'op', { n: 'minus' }), k('pct', '%', 'op', { n: 'Prozent' }),
                    digits('1'), digits('2'), digits('3'), k('+', '+', 'op', { n: 'plus', span: 2 }), k('=', '=', 'eq', { n: 'ist gleich', span: 2 }),
                    digits('0'), k('00', '00', 'num', { n: 'zwei Nullen' }), k('dot', ',', 'num', { n: 'Komma', dot: true }),
                ],
            },
        },
    };
})(self.Calc = self.Calc || {});
