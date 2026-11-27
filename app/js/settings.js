/* Calc – Einstellungen, Hilfe (Tastenkürzel), App installieren, Sicherung, Über. */
(function (C) {
    'use strict';
    const t = (s, v) => C.t(s, v);
    const { h } = C.ui;

    function sw(key, label, sub, after) {
        const b = h('button', { type: 'button', class: 'switch', role: 'switch', 'aria-checked': String(!!C.settings[key]), 'aria-label': t(label) });
        b.addEventListener('click', () => { C.app.set({ [key]: !C.settings[key] }); b.setAttribute('aria-checked', String(!!C.settings[key])); if (after) after(); });
        return h('div', { class: 'row' }, h('span', null, t(label), sub ? h('small', null, t(sub)) : null), b);
    }
    function chips(key, label, opts, sub, get, set) {
        const box = h('div', { class: 'chips' });
        const cur = () => get ? get() : C.settings[key];
        const fill = () => box.replaceChildren(...opts.map(([v, n]) => h('button', {
            type: 'button', 'aria-pressed': String(cur() === v),
            on: { click: () => { if (set) set(v); else C.app.set({ [key]: v }); fill(); } },
        }, t(n))));
        fill();
        return h('div', { class: 'row', style: { 'flex-wrap': 'wrap' } }, h('span', null, t(label), sub ? h('small', null, t(sub)) : null), box);
    }

    function settings() {
        const off = () => C.app.views.office;
        const ocfg = k => () => off().o.cfg[k];
        const oset = k => v => off().setCfg({ [k]: v });
        const s = C.settings;
        const installRow = installBox();
        C.ui.sheet({
            title: t('Einstellungen'), wide: true,
            body: h('div', null,
                h('h3', null, t('Aussehen')),
                h('div', { class: 'row' }, h('span', null, t('Design'), h('small', null, themeName())),
                    h('div', { class: 'chips' },
                        h('button', { type: 'button', on: { click: () => C.theme.picker() } }, t('Aussuchen')),
                        h('button', { type: 'button', on: { click: () => C.theme.mixer() } }, t('Farben anpassen')))),
                chips('motion', 'Bewegung', [['auto', 'Wie das Gerät'], ['off', 'Aus']], 'Animationen beim Tippen und Wechseln'),

                h('h3', null, t('Bedienung')),
                sw('haptic', 'Vibration beim Tippen', 'nur auf Geräten, die das können (Android)'),
                sw('sound', 'Tastenton', 'ein leises Klicken', () => { if (C.settings.sound) C.ui.click(); }),
                chips('lang', 'Sprache', [['auto', 'Wie das Gerät'], ['de', 'Deutsch'], ['en', 'English']]),
                chips('numfmt', 'Zahlenformat', [['auto', 'Wie die Sprache'], ['de', '1.234,5'], ['en', '1,234.5'], ['fr', '1 234,5'], ['ch', '1’234.5']]),
                sw('grouping', 'Tausenderpunkte anzeigen', 'gilt für Einfach und Büro'),
                sw('wake', 'Bildschirm anlassen', 'solange Calc offen ist', () => C.app.wake()),

                h('h3', null, t('Wissenschaftlich')),
                sw('implicit', 'Mal ohne Zeichen zuerst', 'wie am Schulrechner: 1 ÷ 2π = 1 ÷ (2π)'),
                chips('sciAngle', 'Winkelmaß', [['deg', 'DEG'], ['rad', 'RAD'], ['grad', 'GRAD']], 'Grad, Bogenmaß oder Neugrad', () => C.app.views.sci.calc.angle, v => { C.app.views.sci.calc.angle = v; C.app.views.sci.save(); C.app.views.sci.render(); }),

                h('h3', null, t('Büro')),
                chips('', 'Rechenlogik', [['add', 'Tischrechner-Logik'], ['arith', 'Normale Logik']], 'Tischrechner: 12 + 5 + … ✱ Summe. Normal: 12 + 5 =', ocfg('logic'), oset('logic')),
                chips('', 'Dezimalstellen', [['F', 'F'], ['0', '0'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['A', 'ADD']], 'F = alle Stellen, ADD = Cent automatisch', ocfg('dec'), oset('dec')),
                chips('', 'Rundung', [['half', '5/4'], ['up', '↑'], ['down', '↓']], 'kaufmännisch, aufrunden, abschneiden', ocfg('round'), oset('round')),
                chips('', 'Steuersatz', [['19', '19 %'], ['7', '7 %'], ['20', '20 %'], ['8.1', '8,1 %']], 'für +MwSt und −MwSt (eigener Satz: Schalter an der Anzeige)', ocfg('tax'), oset('tax')),
                chips('k00', 'Taste mit Nullen', [['00', '00'], ['000', '000']]),
                chips('hand', 'Streifen', [['right', 'links vom Tastenfeld'], ['left', 'rechts vom Tastenfeld']], 'bei breitem Bildschirm'),
                chips('tapeSize', 'Schrift auf dem Streifen', [[0.85, 'Klein'], [1, 'Normal'], [1.2, 'Groß'], [1.4, 'Sehr groß']]),
                sw('confirmClear', 'Vor neuem Streifen fragen'),

                h('h3', null, t('App')),
                installRow,
                h('div', { class: 'row' }, h('span', null, t('Offline'), h('small', { id: 'offState' }, t('wird geprüft …'))),
                    h('button', { type: 'button', class: 'btn', on: { click: () => C.app.checkUpdate(true) } }, t('Nach Update suchen'))),
                h('div', { class: 'row' }, h('span', null, t('Tastenkürzel und Bedienung')), h('button', { type: 'button', class: 'btn', on: { click: help } }, t('Hilfe'))),
                h('div', { class: 'row' }, h('span', null, t('Sicherung'), h('small', null, t('Einstellungen, Designs, Verlauf, Streifen und Archiv als eine Datei'))),
                    h('div', { class: 'chips' },
                        h('button', { type: 'button', on: { click: backup } }, t('Speichern')),
                        h('button', { type: 'button', on: { click: restore } }, t('Einspielen')))),
                h('div', { class: 'row' }, h('span', null, t('Alles zurücksetzen'), h('small', null, t('löscht alles, was Calc auf diesem Gerät gespeichert hat'))),
                    h('button', { type: 'button', class: 'btn dan', on: { click: resetAll } }, t('Zurücksetzen'))),

                h('h3', null, t('Über Calc')),
                about()),
        });
        C.app.offlineState().then(txt => { const el = document.getElementById('offState'); if (el) el.textContent = txt; });
    }

    function themeName() {
        const id = C.settings.theme;
        if (id === 'auto') return t('Wie das Gerät');
        const th = C.theme.THEMES.find(x => x.id === id);
        if (th) return t(th.name);
        const c = C.theme.customs().find(x => x.id === id);
        return c ? c.name : '';
    }

    function about() {
        return h('div', null,
            h('p', null, h('b', { style: { color: 'var(--text)' } }, 'Calc ' + C.VERSION), ' · ', t('Taschenrechner mit drei Modi, läuft komplett offline.')),
            h('p', null, t('Alles bleibt auf diesem Gerät. Calc lädt nichts nach und schickt nichts weg.')),
            h('p', null, t('Freie Software unter der GNU AGPLv3.'), ' ',
                h('a', { href: 'https://github.com/burnersen/Calc', target: '_blank', rel: 'noopener' }, t('Quellcode auf GitHub')), ' · ',
                h('a', { href: 'https://ko-fi.com/burnersen', target: '_blank', rel: 'noopener' }, t('Spendier mir einen Kaffee'))),
            h('p', null, t('Schriften: Inter, Manrope, Space Grotesk, JetBrains Mono und DSEG (SIL Open Font License).')));
    }

    /* ---------- Installieren ---------- */
    function installBox() {
        const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
        if (standalone) return h('div', { class: 'row' }, h('span', null, t('Als App installiert'), h('small', null, t('Calc läuft in einem eigenen Fenster.'))), h('span', { class: 'cr ok' }, '✓'));
        if (C.app.installEvent) {
            return h('div', { class: 'row' }, h('span', null, t('Als App installieren'), h('small', null, t('eigenes Symbol, eigenes Fenster, auch ohne Internet'))),
                h('button', { type: 'button', class: 'btn pri', on: { click: () => C.app.install() } }, t('Installieren')));
        }
        return h('div', { class: 'row' }, h('span', null, t('Als App installieren'), h('small', null, t('So kommt Calc auf den Startbildschirm'))),
            h('button', { type: 'button', class: 'btn', on: { click: installHelp } }, t('Anleitung')));
    }
    function installHelp() {
        const ua = navigator.userAgent;
        const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const mac = /Macintosh/.test(ua) && !ios && /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua);
        const android = /Android/.test(ua);
        const firefox = /Firefox/.test(ua);
        let steps;
        if (ios) steps = [t('Unten (oder oben) auf „Teilen“ tippen, das Quadrat mit dem Pfeil.'), t('„Zum Home-Bildschirm“ wählen.'), t('Oben rechts auf „Hinzufügen“ tippen.')];
        else if (mac) steps = [t('In der Menüleiste „Ablage“ öffnen.'), t('„Zum Dock hinzufügen …“ wählen.')];
        else if (android && firefox) steps = [t('Oben rechts das Menü (drei Punkte) öffnen.'), t('„Installieren“ oder „Zum Startbildschirm hinzufügen“ wählen.')];
        else if (android) steps = [t('Oben rechts das Menü (drei Punkte) öffnen.'), t('„App installieren“ oder „Zum Startbildschirm hinzufügen“ wählen.')];
        else if (firefox) steps = [t('Firefox am Computer kann Web-Apps nicht installieren. Chrome, Edge oder Safari können es.'), t('Calc funktioniert trotzdem offline, solange du diese Seite einmal geöffnet hast.')];
        else steps = [t('In der Adresszeile rechts auf das Symbol mit dem Bildschirm und Pfeil klicken.'), t('Oder im Menü „Installieren“ bzw. „App installieren“ wählen.')];
        C.ui.sheet({
            title: t('Calc installieren'),
            body: h('div', null,
                h('ol', { style: { 'padding-left': '1.2em', 'font-size': '15.5px', 'line-height': '1.6' } }, ...steps.map(s => h('li', null, s))),
                h('div', { class: 'note-box' }, t('Danach startet Calc wie eine App, mit eigenem Symbol und ganz ohne Internet.'))),
        });
    }

    /* ---------- Sicherung ---------- */
    function backup() {
        const d = new Date();
        const p = n => String(n).padStart(2, '0');
        const data = { calcBackup: 1, version: C.VERSION, created: d.toISOString(), data: C.store.dump() };
        delete data.data.paint;
        C.ui.download('calc-sicherung-' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '.json', JSON.stringify(data), 'application/json');
    }
    async function restore() {
        const txt = await C.ui.pickFile('.json,application/json');
        if (!txt) return;
        let o;
        try { o = JSON.parse(txt); } catch (e) { o = null; }
        if (!o || o.calcBackup !== 1 || !o.data) return C.ui.toast(t('Diese Datei ist keine Calc-Sicherung.'));
        if (!(await C.ui.confirm(t('Sicherung einspielen? Was jetzt auf diesem Gerät gespeichert ist, wird ersetzt.'), t('Einspielen'), true))) return;
        C.store.restore(o.data);
        location.reload();
    }
    async function resetAll() {
        if (!(await C.ui.confirm(t('Wirklich alles zurücksetzen? Verlauf, Streifen, Archiv, eigene Designs und Einstellungen sind dann weg.'), t('Alles löschen'), true))) return;
        C.store.clear();
        location.reload();
    }

    /* ---------- Hilfe ---------- */
    function help() {
        const row = (keys, what) => [h('span', null, ...keys.map(k => [h('kbd', null, k), ' '])), h('span', null, t(what))];
        C.ui.sheet({
            title: t('Hilfe'), wide: true,
            body: h('div', null,
                h('h3', null, t('Überall')),
                h('div', { class: 'keys' },
                    ...row(['Alt', '1'], 'Einfach'), ...row(['Alt', '2'], 'Wissenschaftlich'), ...row(['Alt', '3'], 'Büro'),
                    ...row(['0–9', ',', '.'], 'Ziffern und Komma'), ...row(['+', '−', '*', '/'], 'Rechenzeichen (auch x und :)'),
                    ...row(['Enter', '='], 'Ausrechnen'), ...row(['⌫'], 'Letzte Ziffer löschen'), ...row(['Esc'], 'Alles löschen'),
                    ...row(['%'], 'Prozent'), ...row(['Strg', 'C'], 'Ergebnis kopieren'), ...row(['Strg', 'V'], 'Zahl einfügen'), ...row(['?'], 'Diese Hilfe')),
                h('p', null, t('Am Handy: über die Anzeige wischen löscht die letzte Ziffer. Lange auf die Anzeige drücken zum Kopieren und Einfügen.')),
                h('h3', null, t('Wissenschaftlich')),
                h('div', { class: 'keys' },
                    ...row(['s', 'c', 't'], 'sin, cos, tan (mit Umschalt: Umkehrfunktion)'), ...row(['l', 'n'], 'log, ln (mit Umschalt: 10ˣ, eˣ)'),
                    ...row(['r', 'R'], 'Wurzel, dritte Wurzel'), ...row(['^', 'q'], 'hoch, Quadrat'), ...row(['i', '!'], 'Kehrwert, Fakultät'),
                    ...row(['p', 'e'], 'π und e'), ...row(['E'], 'mal zehn hoch (×10ˣ)'), ...row(['(', ')'], 'Klammern'), ...row(['a'], 'Ans, letztes Ergebnis'),
                    ...row(['~'], 'Vorzeichen minus (−)'), ...row(['h'], 'hyp: sinh, cosh, tanh'), ...row(['d'], 'DEG, RAD, GRAD wechseln'),
                    ...row(['f', 'g'], 'Bruch oder Grad/Minuten/Sekunden'), ...row(['m', 'M'], 'M+ und M−'), ...row(['←', '→'], 'Cursor in der Rechnung')),
                h('p', null, t('2nd schaltet die goldene Zweitbelegung für einen Tastendruck ein. Nochmal „=“ rechnet dieselbe Rechnung mit dem neuen Ans, wie am Schulrechner.')),
                h('h3', null, t('Büro')),
                h('div', { class: 'keys' },
                    ...row(['Enter'], 'Tischrechner: + (oder = nach × ÷), Normal: ='), ...row(['s'], '◇ Zwischensumme'), ...row(['t'], '✱ Summe'), ...row(['g'], 'GT Gesamtsumme'),
                    ...row(['Entf'], 'CE, nur die Eingabe löschen'), ...row(['m', 'M', 'r'], 'M+, M−, MR'), ...row(['Strg', 'Z'], 'Letzten Schritt zurücknehmen')),
                h('div', { class: 'note-box' },
                    h('b', null, t('Tischrechner-Logik')), h('br'),
                    t('Wie an der Addiermaschine: Zahl tippen, dann + oder −. Jede Zahl landet sofort auf dem Streifen. ◇ zeigt die Zwischensumme, ✱ schließt mit der Summe ab und zählt sie zur Gesamtsumme GT. Mal und Geteilt gehen mit =.')),
                h('div', { class: 'note-box' },
                    h('b', null, t('Weitere Tasten')), h('br'),
                    t('+MwSt rechnet die Steuer dazu (netto → brutto), −MwSt heraus (brutto → netto). MU ist der Aufschlag auf Marge: Einkaufspreis MU Marge % = Verkaufspreis. Δ% zeigt die Änderung in Prozent: alt Δ% neu =. ADD bei den Dezimalstellen setzt das Komma für Cent selbst: 1250 + wird 12,50.')),
                h('p', null, t('Eine Zeile auf dem Streifen antippen: Notiz dazuschreiben, Wert korrigieren (alles danach rechnet sich neu), in die Anzeige holen oder löschen.'))),
        });
    }

    C.settingsUI = { open: settings, help, installHelp };
})(self.Calc = self.Calc || {});
