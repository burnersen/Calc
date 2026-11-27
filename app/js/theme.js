/* Calc – Designs anwenden, eigene Designs mit dem Farbmischer bauen und speichern.
   Ein eigenes Design ist ein fertiges Design als Grundlage plus geänderte Variablen: { id, name, base, vars }.
   Der Kontrast wird beim Mischen live geprüft, die Schrift auf Tasten passt sich auf Wunsch selbst an. */
(function (C) {
    'use strict';
    const t = (s, v) => C.t(s, v);
    const { h } = C.ui;

    const THEMES = [
        { id: 'klar', name: 'Klar', d: 'Hell, luftig, ruhig', dark: false },
        { id: 'nacht', name: 'Nacht', d: 'Tiefes Dunkel mit Bernstein', dark: true },
        { id: 'aurora', name: 'Aurora', d: 'Nordlicht hinter Glas', dark: true },
        { id: 'schule', name: 'Schulrechner', d: 'Der Klassiker aus dem Unterricht', dark: false },
        { id: 'retro', name: 'Retro', d: 'Leuchtziffern im Holzgehäuse', dark: true },
        { id: 'papier', name: 'Papier', d: 'Warmes Büro, Tinte und Farbband', dark: false },
        { id: 'kontrast', name: 'Kontrast', d: 'Schwarz, Weiß, Signalgelb', dark: true },
    ];
    const byId = id => THEMES.find(x => x.id === id);

    /* ---------- Farben rechnen ---------- */
    const hexRgb = s => {
        const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(s || '').trim());
        if (!m) return null;
        let x = m[1];
        if (x.length === 3) x = x.split('').map(c => c + c).join('');
        return [0, 2, 4].map(i => parseInt(x.slice(i, i + 2), 16));
    };
    const rgbHex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
    const lum = c => {
        const f = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
    };
    const ratio = (a, b) => {
        a = hexRgb(a); b = hexRgb(b);
        if (!a || !b) return 21;
        const x = lum(a), y = lum(b);
        return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    const mix = (a, b, p) => { const x = hexRgb(a), y = hexRgb(b); return rgbHex(x.map((v, i) => v + (y[i] - v) * p)); };
    /** Schriftfarbe für einen Hintergrund: die bisherige, wenn sie gut lesbar bleibt, sonst Weiß oder fast Schwarz (getönt) */
    function bestText(bg, keep, min) {
        min = min || 4.5;
        if (keep && ratio(keep, bg) >= min) return keep;
        const dark = mix('#0b0d12', bg, 0.12), light = mix('#ffffff', bg, 0.06);
        const rd = ratio(dark, bg), rl = ratio(light, bg);
        if (Math.max(rd, rl) >= min) return rd >= rl ? dark : light;
        return ratio('#000000', bg) >= ratio('#ffffff', bg) ? '#000000' : '#ffffff';
    }
    const isDark = hex => { const c = hexRgb(hex); return c ? lum(c) < 0.2 : false; };

    /** Variable des aktuellen Designs als Hex (aus dem berechneten Stil) */
    function readVar(name, el) {
        const v = getComputedStyle(el || document.documentElement).getPropertyValue(name).trim();
        return hexRgb(v) ? rgbHex(hexRgb(v)) : v;
    }

    /* ---------- eigene Designs ---------- */
    const customs = () => (C.store.get('themes', []) || []).filter(x => x && x.id && x.base && byId(x.base));
    const saveCustoms = list => C.store.set('themes', list);

    /** Ergänzt abgeleitete Variablen (Malfarben, gedimmte Schrift), damit die Änderung überall greift */
    function expand(vars) {
        const o = Object.assign({}, vars);
        const paint = { '--num-bg': '--num-paint', '--op-bg': '--op-paint', '--fn-bg': '--fn-paint', '--eq-bg': '--eq-paint', '--del-bg': '--del-paint', '--disp-bg': '--disp-paint' };
        for (const k in paint) if (o[k]) o[paint[k]] = o[k];
        if (o['--body']) { o['--body-solid'] = o['--body']; o['--body-paint'] = o['--body']; o['--mod-paint'] = o['--mod-paint'] || o['--fn-bg'] || null; }
        if (o['--bg']) o['--bg-paint'] = o['--bg'];
        if (o['--disp-bg'] || o['--disp-fg']) {
            const bg = o['--disp-bg'] || readVar('--disp-bg'), fg = o['--disp-fg'] || readVar('--disp-fg');
            if (hexRgb(bg) && hexRgb(fg)) o['--disp-dim'] = mix(fg, bg, 0.4);
        }
        if (o['--tape-bg'] || o['--tape-ink']) {
            const bg = o['--tape-bg'] || readVar('--tape-bg'), fg = o['--tape-ink'] || readVar('--tape-ink');
            if (hexRgb(bg) && hexRgb(fg)) o['--tape-dim'] = mix(fg, bg, 0.38);
        }
        if (o['--acc'] && !o['--acc-fg']) o['--acc-fg'] = bestText(o['--acc']);
        for (const k in o) if (o[k] == null) delete o[k];
        return o;
    }

    /* ---------- anwenden ---------- */
    let applied = [];
    function resolve(s) {
        let id = s.theme;
        if (id === 'auto') id = matchMedia('(prefers-color-scheme: dark)').matches ? s.dark : s.light;
        if (String(id).startsWith('c-')) {
            const c = customs().find(x => x.id === id);
            if (c) return { base: c.base, vars: c.vars || {}, id };
            id = 'klar';
        }
        if (!byId(id)) id = 'klar';
        return { base: id, vars: {}, id };
    }

    function apply(s, draft) {
        const r = draft || resolve(s);
        const root = document.documentElement;
        for (const k of applied) root.style.removeProperty(k);
        root.dataset.theme = r.base;
        const vars = expand(r.vars || {});
        applied = Object.keys(vars);
        for (const k of applied) root.style.setProperty(k, vars[k]);
        const cs = getComputedStyle(root);
        if (cs.getPropertyValue('--lcd').trim() === '1') root.dataset.lcd = ''; else delete root.dataset.lcd;
        const big = innerWidth >= 600 && innerHeight >= 640;
        const tc = (big ? cs.getPropertyValue('--bg') : cs.getPropertyValue('--body-solid')).trim() || '#ffffff';
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = tc;
        // für boot.js: beim nächsten Start sofort richtig, ohne Aufblitzen
        if (!draft) C.store.set('paint', { theme: r.base, vars, tc, motion: s.motion });
        root.dataset.motion = s.motion === 'off' ? 'off' : 'auto';
    }

    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (C.settings.theme === 'auto') { apply(C.settings); C.app && C.app.refresh(); } });

    /* ---------- kleine Vorschau ---------- */
    function mini(themeId, vars) {
        const m = h('span', { class: 'mini', 'data-theme': themeId });
        if (vars) { const v = expand(vars); for (const k in v) m.style.setProperty(k, v[k]); }
        m.append(
            h('span', { class: 'md' }, '1.234'),
            h('span', { class: 'mk' }, ...['d', 'f', 'f', 'o', '', '', '', 'o', '', '', '', 'o', '', '', '', 'e'].map(c => h('i', { class: c })))
        );
        return m;
    }

    /* ---------- Design aussuchen ---------- */
    function picker() {
        const grid = h('div', { class: 'tgrid' });
        const card = (id, name, desc, themeId, vars, del) => {
            const b = h('button', {
                type: 'button', class: 'tcard', 'aria-pressed': String(C.settings.theme === id),
                on: { click: () => { C.app.set({ theme: id }); fill(); } },
            }, mini(themeId, vars), h('span', { class: 'nm' }, name), h('span', { class: 'ds' }, desc));
            if (del) b.append(h('span', {
                class: 'del', role: 'button', 'aria-label': t('Löschen'), title: t('Löschen'),
                on: { click: async e => { e.stopPropagation(); if (await C.ui.confirm(t('Design „{n}“ löschen?', { n: name }), t('Löschen'), true)) { saveCustoms(customs().filter(x => x.id !== id)); if (C.settings.theme === id) C.app.set({ theme: 'auto' }); fill(); } } },
            }, C.ui.icon('trash')));
            return b;
        };
        const fill = () => {
            grid.replaceChildren();
            const auto = resolve(Object.assign({}, C.settings, { theme: 'auto' }));
            grid.append(card('auto', t('Wie das Gerät'), t('Hell am Tag, dunkel in der Nacht'), auto.base, auto.vars));
            for (const th of THEMES) grid.append(card(th.id, t(th.name), t(th.d), th.id));
            for (const c of customs()) grid.append(card(c.id, c.name, t('Eigenes Design auf {b}', { b: t(byId(c.base).name) }), c.base, c.vars, true));
        };
        const nameOf = id => id === 'auto' ? t('Wie das Gerät') : byId(id) ? t(byId(id).name) : (customs().find(x => x.id === id) || {}).name;
        fill();

        const favs = () => {
            const opt = (key, label) => h('div', { class: 'row' }, h('span', null, label),
                h('button', { type: 'button', class: 'btn', on: { click: e => C.ui.menu(e.currentTarget, [...THEMES.map(th => ({ label: t(th.name), checked: C.settings[key] === th.id, on: () => { C.app.set({ [key]: th.id }); fill(); favBox.replaceChildren(...favs()); } })),
                    ...customs().map(c => ({ label: c.name, checked: C.settings[key] === c.id, on: () => { C.app.set({ [key]: c.id }); fill(); favBox.replaceChildren(...favs()); } }))]) } },
                    nameOf(C.settings[key]) || '', C.ui.icon('down')));
            return [opt('light', t('Tagsüber (hell)')), opt('dark', t('Nachts (dunkel)'))];
        };
        const favBox = h('div', null, ...favs());
        C.ui.sheet({
            title: t('Design'), wide: true,
            body: h('div', null,
                grid,
                h('h3', null, t('Wie das Gerät')),
                h('p', null, t('Folgt der Einstellung „Hell“ oder „Dunkel“ deines Geräts.')),
                favBox),
            foot: [
                h('button', { type: 'button', class: 'btn pri', on: { click: () => mixer() } }, C.ui.icon('palette'), t('Farben anpassen')),
                h('button', { type: 'button', class: 'btn', on: { click: importTheme } }, C.ui.icon('upload'), t('Design laden')),
            ],
        });
    }

    async function importTheme() {
        const txt = await C.ui.pickFile('.json,application/json');
        if (!txt) return;
        try {
            const o = JSON.parse(txt);
            if (!o || o.calcTheme !== 1 || !byId(o.base)) throw new Error('x');
            const vars = {};
            for (const k of Object.keys(o.vars || {})) if (/^--[a-z0-9-]{1,30}$/.test(k) && /^[#a-zA-Z0-9 ,.'()%-]{1,120}$/.test(String(o.vars[k]))) vars[k] = String(o.vars[k]);
            const c = { id: 'c-' + Date.now().toString(36), name: String(o.name || t('Eigenes Design')).slice(0, 40), base: o.base, vars };
            saveCustoms(customs().concat(c));
            C.app.set({ theme: c.id });
            C.ui.closeMenu();
            document.querySelectorAll('dialog.sheet').forEach(d => d.close());
            C.ui.toast(t('Design „{n}“ geladen', { n: c.name }));
        } catch (e) { C.ui.toast(t('Diese Datei ist kein Calc-Design.')); }
    }

    /* ---------- Farbmischer ---------- */
    const FIELDS = [
        ['--acc', 'Akzent', 'Schalter, Auswahl, Markierungen', null],
        ['--bg', 'Hintergrund', 'hinter dem Rechner (Tablet, Computer)', null],
        ['--body', 'Gehäuse', 'Fläche um Anzeige und Tasten', null],
        ['--disp-bg', 'Anzeige', null, '--disp-fg'],
        ['--num-bg', 'Zifferntasten', null, '--num-fg'],
        ['--op-bg', 'Rechentasten', '+ − × ÷', '--op-fg'],
        ['--fn-bg', 'Funktionstasten', null, '--fn-fg'],
        ['--eq-bg', 'Gleich-Taste', null, '--eq-fg'],
        ['--del-bg', 'Löschtasten', 'AC, C, DEL', '--del-fg'],
        ['--alt', 'Zweitbelegung', 'kleine Beschriftung über den Tasten', null],
        ['--tape-bg', 'Papierstreifen', null, '--tape-ink'],
    ];
    const FONTS = [
        ['', 'Wie das Design'], ["'Inter', system-ui, sans-serif", 'Inter'], ["'Manrope', system-ui, sans-serif", 'Manrope'],
        ["'Space Grotesk', system-ui, sans-serif", 'Space Grotesk'], ["'JetBrains Mono', monospace", 'JetBrains Mono'],
        ["'DSEG7', monospace", '7-Segment'], ["'DSEG7M', monospace", '7-Segment modern'],
    ];

    function mixer() {
        document.querySelectorAll('dialog.sheet').forEach(d => d.close());
        const s = C.settings;
        const cur = resolve(s);
        const editing = String(cur.id).startsWith('c-') ? customs().find(x => x.id === cur.id) : null;
        const draft = { base: cur.base, vars: Object.assign({}, cur.vars) };
        const live = () => { apply(s, draft); refreshRows(); C.app && C.app.refresh(); };
        const value = k => draft.vars[k] || readVar(k);

        const rows = h('div', { class: 'mix' });
        const refreshRows = () => {
            rows.replaceChildren();
            for (const [k, name, sub, fg] of FIELDS) {
                const bg = value(k);
                if (!hexRgb(bg)) continue;
                const inp = h('input', { type: 'color', 'aria-label': t(name), value: bg });
                inp.addEventListener('input', () => {
                    draft.vars[k] = inp.value;
                    if (fg && autoText) draft.vars[fg] = bestText(inp.value, value(fg));
                    if (k === '--acc') draft.vars['--acc-fg'] = bestText(inp.value);
                    apply(s, draft); C.app && C.app.refresh();
                    badge.replaceWith(badge = contrast());
                });
                inp.addEventListener('change', () => refreshRows());
                const contrast = () => {
                    if (!fg) return h('span');
                    const r = ratio(value(fg), value(k));
                    return h('span', { class: 'cr ' + (r >= 4.5 ? 'ok' : 'bad'), title: t('Kontrast der Schrift') }, r.toFixed(1).replace('.', C.numfmt().dec) + ' : 1');
                };
                let badge = contrast();
                let fgInp = null;
                if (fg) {
                    fgInp = h('input', { type: 'color', 'aria-label': t('Schrift: {n}', { n: t(name) }), value: hexRgb(value(fg)) ? value(fg) : '#000000', style: { width: '34px', height: '34px' } });
                    fgInp.addEventListener('input', () => { draft.vars[fg] = fgInp.value; apply(s, draft); C.app && C.app.refresh(); badge.replaceWith(badge = contrast()); });
                }
                rows.append(h('div', { class: 'mrow' }, inp,
                    h('span', { class: 'nm' }, t(name), sub ? h('small', null, t(sub)) : null),
                    h('span', { style: { display: 'flex', gap: '8px', 'align-items': 'center' } }, badge, fgInp)));
            }
        };
        let autoText = true;
        refreshRows();

        const baseChips = h('div', { class: 'chips', style: { 'justify-content': 'flex-start' } });
        const fillBase = () => baseChips.replaceChildren(...THEMES.map(th => h('button', {
            type: 'button', 'aria-pressed': String(draft.base === th.id),
            on: { click: () => { draft.base = th.id; draft.vars = {}; fillBase(); live(); } },
        }, t(th.name))));
        fillBase();

        const radius = h('input', { type: 'range', class: 'range', min: 0, max: 32, step: 1, 'aria-label': t('Rundung der Tasten') });
        const r0 = parseInt(draft.vars['--radius-key'] || readVar('--radius-key'), 10);
        radius.value = String(isNaN(r0) ? 12 : Math.min(32, r0));
        radius.addEventListener('input', () => { draft.vars['--radius-key'] = (+radius.value >= 32 ? 999 : radius.value) + 'px'; apply(s, draft); C.app && C.app.refresh(); });

        const fontBtn = h('button', { type: 'button', class: 'btn', on: { click: e => C.ui.menu(e.currentTarget, FONTS.map(([v, n]) => ({
            label: t(n), checked: (draft.vars['--disp-font'] || '') === v,
            on: () => { if (v) { draft.vars['--disp-font'] = v; draft.vars['--disp-weight'] = /DSEG/.test(v) ? '400' : (draft.vars['--disp-weight'] || ''); } else { delete draft.vars['--disp-font']; } if (!draft.vars['--disp-weight']) delete draft.vars['--disp-weight']; fontBtn.firstChild.textContent = t(n); live(); },
        }))) } }, (FONTS.find(f => f[0] === (draft.vars['--disp-font'] || '')) || FONTS[0])[1], C.ui.icon('down'));
        fontBtn.firstChild.textContent = t(fontBtn.firstChild.textContent);

        const autoSw = h('button', { type: 'button', class: 'switch', role: 'switch', 'aria-checked': 'true', 'aria-label': t('Schrift automatisch anpassen'), on: { click: () => { autoText = !autoText; autoSw.setAttribute('aria-checked', String(autoText)); } } });

        const harmon = () => {
            const acc = value('--acc');
            const dark = isDark(value('--body'));
            const v = {};
            v['--acc'] = acc;
            if (dark) {
                v['--body'] = mix('#0c0d11', acc, 0.07); v['--bg'] = mix('#06070a', acc, 0.05);
                v['--disp-bg'] = v['--body'];
                v['--num-bg'] = mix('#1d1f26', acc, 0.07); v['--fn-bg'] = mix('#2b2e37', acc, 0.12);
                v['--op-bg'] = mix('#1d1f26', acc, 0.28); v['--op-fg'] = bestText(v['--op-bg'], mix(acc, '#ffffff', 0.35));
            } else {
                v['--body'] = mix('#f7f8fa', acc, 0.04); v['--bg'] = mix('#e8ebf0', acc, 0.08);
                v['--disp-bg'] = v['--body'];
                v['--num-bg'] = '#ffffff'; v['--fn-bg'] = mix('#eceff3', acc, 0.08);
                v['--op-bg'] = mix('#ffffff', acc, 0.16); v['--op-fg'] = bestText(v['--op-bg'], mix(acc, '#000000', 0.25));
            }
            v['--eq-bg'] = acc; v['--alt'] = bestText(v['--body'], acc, 3);
            for (const [k, , , fg] of FIELDS) if (fg && v[k] && !v[fg]) v[fg] = bestText(v[k], value(fg));
            v['--acc-fg'] = bestText(acc);
            Object.assign(draft.vars, v);
            live();
        };

        const fixAll = () => {
            for (const [k, , , fg] of FIELDS) if (fg && hexRgb(value(k))) draft.vars[fg] = bestText(value(k), value(fg));
            live();
            C.ui.toast(t('Schrift überall gut lesbar gemacht'));
        };

        let saved = false;
        const sh = C.ui.sheet({
            title: editing ? t('Design „{n}“ bearbeiten', { n: editing.name }) : t('Farben anpassen'), peek: true,
            body: h('div', null,
                h('p', null, t('Die Änderungen siehst du sofort am Rechner. Gespeichert wird erst mit „Speichern“.')),
                h('h3', null, t('Grundlage')), baseChips,
                h('h3', null, t('Farben')),
                h('div', { class: 'row' }, h('span', null, t('Schrift automatisch anpassen'), h('small', null, t('wählt zu jeder Tastenfarbe eine gut lesbare Schrift'))), autoSw),
                rows,
                h('div', { class: 'chips', style: { 'justify-content': 'flex-start', 'margin-top': '12px' } },
                    h('button', { type: 'button', on: { click: harmon } }, t('Passend zur Akzentfarbe')),
                    h('button', { type: 'button', on: { click: fixAll } }, t('Kontrast reparieren')),
                    h('button', { type: 'button', on: { click: () => { draft.vars = {}; live(); } } }, t('Zurücksetzen'))),
                h('h3', null, t('Form und Schrift')),
                h('div', { class: 'row' }, h('span', null, t('Rundung der Tasten')), h('span', { style: { flex: '0 0 50%' } }, radius)),
                h('div', { class: 'row' }, h('span', null, t('Schrift der Anzeige')), fontBtn)),
            foot: [
                h('button', { type: 'button', class: 'btn', on: { click: () => sh.close() } }, t('Verwerfen')),
                h('button', { type: 'button', class: 'btn', on: { click: () => {
                    C.ui.download((editing ? editing.name : 'calc-design') + '.json', JSON.stringify({ calcTheme: 1, name: editing ? editing.name : t('Mein Design'), base: draft.base, vars: draft.vars }, null, 2), 'application/json');
                } } }, C.ui.icon('download'), t('Als Datei')),
                h('button', { type: 'button', class: 'btn pri', on: { click: async () => {
                    let name = editing ? editing.name : null;
                    if (!editing) {
                        name = await C.ui.prompt({ title: t('Design speichern'), label: t('Name'), value: t('Mein Design {n}', { n: customs().length + 1 }), max: 40 });
                        if (name == null) return;
                        name = name.trim() || t('Mein Design');
                    }
                    const list = customs();
                    let id = editing ? editing.id : 'c-' + Date.now().toString(36);
                    const entry = { id, name, base: draft.base, vars: draft.vars };
                    const i = list.findIndex(x => x.id === id);
                    if (i >= 0) list[i] = entry; else list.push(entry);
                    saveCustoms(list);
                    saved = true;
                    C.app.set({ theme: id });
                    sh.close();
                    C.ui.toast(t('Design „{n}“ gespeichert', { n: name }));
                } } }, t('Speichern')),
            ],
            onClose: () => { if (!saved) { apply(C.settings); C.app && C.app.refresh(); } },
        });
    }

    C.theme = { THEMES, apply, picker, mixer, resolve, ratio, bestText, mix, hexRgb, customs, mini, expand };
})(self.Calc = self.Calc || {});
