/* Calc – Bausteine der Oberfläche: Elemente bauen, Tastenfelder, Fenster, Menüs, Hinweise, Ton und Vibration.
   Nirgends wird ein Eingabefeld angezeigt, das man nicht selbst angetippt hat. So klappt am Handy nie ungefragt die Tastatur auf. */
(function (C) {
    'use strict';
    const t = (s, v) => C.t(s, v);
    const ui = {};

    /** Element bauen: h('div', { class: 'x', on: { click: f }, 'aria-label': '…' }, kind1, kind2 …) */
    ui.h = function (tag, a, ...kids) {
        const el = document.createElement(tag);
        if (a) for (const k of Object.keys(a)) {
            const v = a[k];
            if (v == null || v === false) continue;
            if (k === 'class') el.className = v;
            else if (k === 'text') el.textContent = v;
            else if (k === 'on') for (const e of Object.keys(v)) el.addEventListener(e, v[e]);
            else if (k === 'style') for (const s of Object.keys(v)) el.style.setProperty(s, v[s]);
            else if (k === 'dataset') Object.assign(el.dataset, v);
            else if (k in el && k !== 'list' && k !== 'type' && typeof v !== 'string') el[k] = v;
            else el.setAttribute(k, v === true ? '' : v);
        }
        for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
        return el;
    };
    const h = ui.h;

    ui.icon = function (name) {
        const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        s.setAttribute('class', 'i');
        s.setAttribute('aria-hidden', 'true');
        const u = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        u.setAttribute('href', '#i-' + name);
        s.append(u);
        return s;
    };
    ui.ib = (icon, label, on, extra) => h('button', Object.assign({ class: 'ib', type: 'button', 'aria-label': label, title: label, on: { click: on } }, extra || {}), ui.icon(icon));

    /* ---------- Hinweis oben ---------- */
    let toastTimer = 0;
    ui.toast = function (msg, actionLabel, action, ms) {
        const el = document.getElementById('toast');
        el.replaceChildren(h('span', null, msg));
        if (actionLabel) el.append(h('button', { type: 'button', on: { click: () => { el.classList.remove('on'); action(); } } }, actionLabel));
        el.classList.add('on');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove('on'), ms || (actionLabel ? 5000 : 2200));
    };

    /* ---------- Fenster ---------- */
    const open = [];
    ui.sheet = function (o) {
        const d = h('dialog', { class: 'sheet' + (o.wide ? ' wide' : '') + (o.peek ? ' peek' : ''), 'aria-label': o.title });
        const close = () => { if (d.open) d.close(); };
        const head = h('div', { class: 'sh-head' }, ui.ib('close', t('Schließen'), close), h('h2', null, o.title), o.headExtra || null);
        // Schließen-Knopf zuerst: beim Öffnen bekommt er den Fokus, kein Eingabefeld (sonst klappt die Tastatur auf)
        const body = h('div', { class: 'sh-body' }, o.body);
        d.append(head, body);
        if (o.foot && o.foot.length) d.append(h('div', { class: 'sh-foot' }, o.foot));
        d.addEventListener('close', () => {
            const i = open.indexOf(d);
            if (i >= 0) open.splice(i, 1);
            d.remove();
            if (o.onClose) o.onClose(d.returnValue);
        });
        d.addEventListener('click', e => { if (e.target === d) close(); });   // Klick daneben
        document.body.append(d);
        d.showModal();
        head.querySelector('.ib').focus({ preventScroll: true });
        open.push(d);
        return { el: d, body, close };
    };
    ui.anyOpen = () => open.length > 0 || !!document.querySelector('.menu');

    ui.confirm = function (msg, okLabel, danger) {
        return new Promise(res => {
            let done = false;
            const s = ui.sheet({
                title: t('Bitte bestätigen'),
                body: h('p', { style: { color: 'var(--text)', 'font-size': '16px' } }, msg),
                foot: [
                    h('button', { class: 'btn', type: 'button', on: { click: () => s.close() } }, t('Abbrechen')),
                    h('button', { class: 'btn pri' + (danger ? ' dan' : ''), type: 'button', style: danger ? { background: 'var(--danger)', color: '#fff' } : null, on: { click: () => { done = true; s.close(); } } }, okLabel || t('OK')),
                ],
                onClose: () => res(done),
            });
        });
    };

    /** Text abfragen. Das Feld bekommt erst den Fokus, wenn man es antippt, außer am Rechner. */
    ui.prompt = function (o) {
        return new Promise(res => {
            let val = null;
            const input = o.multiline
                ? h('textarea', { class: 'field', rows: 3, maxlength: o.max || 200, placeholder: o.placeholder || '' })
                : h('input', { class: 'field', type: 'text', maxlength: o.max || 200, placeholder: o.placeholder || '', inputmode: o.inputmode || 'text', autocomplete: 'off', enterkeyhint: 'done' });
            input.value = o.value || '';
            const ok = () => { val = input.value; s.close(); };
            input.addEventListener('keydown', e => { if (e.key === 'Enter' && !o.multiline) { e.preventDefault(); ok(); } });
            const s = ui.sheet({
                title: o.title,
                body: h('div', null, o.text ? h('p', null, o.text) : null, h('label', { class: 'lbl' }, o.label || ''), input),
                foot: [
                    o.extra || null,
                    h('button', { class: 'btn', type: 'button', on: { click: () => s.close() } }, t('Abbrechen')),
                    h('button', { class: 'btn pri', type: 'button', on: { click: ok } }, o.okLabel || t('Übernehmen')),
                ],
                onClose: () => res(val),
            });
            // Am Handy fokussieren heißt Tastatur. Hier ist sie gewollt: man hat „Notiz“ oder „Wert ändern“ gewählt.
            setTimeout(() => { input.focus(); if (input.select) input.select(); }, 60);
        });
    };

    /* ---------- Menü an einer Stelle ---------- */
    ui.menu = function (anchor, items, opts) {
        ui.closeMenu();
        const back = h('div', { class: 'menu-back', on: { pointerdown: e => { e.preventDefault(); ui.closeMenu(); } } });
        const m = h('div', { class: 'menu', role: 'menu' });
        for (const it of items) {
            if (!it) continue;
            if (it.sep) { m.append(h('hr')); continue; }
            if (it.head) { m.append(h('div', { class: 'mh' }, it.head)); continue; }
            m.append(h('button', {
                type: 'button', role: it.checked != null ? 'menuitemradio' : 'menuitem', 'aria-checked': it.checked != null ? String(!!it.checked) : null,
                class: it.danger ? 'dan' : null,
                on: { click: () => { ui.closeMenu(); it.on(); } },
            }, it.icon ? ui.icon(it.icon) : null, h('span', null, it.label)));
        }
        document.body.append(back, m);
        const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y };
        const mw = m.offsetWidth, mh = m.offsetHeight, W = innerWidth, H = innerHeight;
        let x = (opts && opts.alignLeft) ? r.left : r.right - mw;
        x = Math.max(8, Math.min(x, W - mw - 8));
        let y = r.bottom + 6;
        if (y + mh > H - 8) y = Math.max(8, r.top - mh - 6);
        m.style.left = x + 'px';
        m.style.top = y + 'px';
        const first = m.querySelector('button');
        if (first && (!opts || !opts.noFocus)) first.focus({ preventScroll: true });
        m.addEventListener('keydown', e => {
            const bs = [...m.querySelectorAll('button')];
            const i = bs.indexOf(document.activeElement);
            if (e.key === 'ArrowDown') { e.preventDefault(); bs[(i + 1) % bs.length].focus(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); }
            else if (e.key === 'Escape') { e.preventDefault(); ui.closeMenu(); }
        });
    };
    ui.closeMenu = function () { document.querySelectorAll('.menu, .menu-back').forEach(e => e.remove()); };

    /* ---------- Tastenfeld ---------- */
    /**
     * Baut ein Tastenfeld. layout: { cols, keys }. onKey(k, def, btn) wird beim Drücken aufgerufen (sofort beim Aufsetzen,
     * wie bei einem echten Rechner). second(): ob die Zweitbelegung aktiv ist.
     */
    ui.pad = function (layout, cls, onKey, second) {
        const rows = Math.ceil(layout.keys.reduce((n, k) => n + (k.span === 2 ? 2 : 1), 0) / layout.cols);
        const pad = h('div', { class: 'pad ' + cls, style: { '--pc': layout.cols, '--pr': layout.rows || rows } });
        for (const def of layout.keys) {
            const b = h('button', {
                type: 'button', class: 'k ' + def.c + (def.span === 2 ? ' span2' : '') + (def.a ? ' has-alt' : '') + (def.s ? ' has-sub' : ''),
                'data-k': def.k, 'aria-label': def.n ? t(def.n) : def.l, 'aria-pressed': def.toggle ? 'false' : null,
            });
            if (def.k.startsWith('fn:') && ['sin', 'cos', 'tan'].includes(def.k.slice(3))) b.dataset.hyp = '1';
            if (def.a) { b.append(h('span', { class: 'alt', 'aria-hidden': 'true' }, def.a.l)); b.dataset.alt = def.a.k; }
            b.append(h('span', { class: 'lb', 'aria-hidden': 'true' }, def.l));
            if (def.s) b.append(h('span', { class: 'sub', 'aria-hidden': 'true' }, t(def.s)));
            b._def = def;
            pad.append(b);
        }
        let repeatT = 0, repeatI = 0;
        const stop = b => {
            clearTimeout(repeatT); clearInterval(repeatI);
            if (!b) return;
            const since = performance.now() - (b._downAt || 0);
            setTimeout(() => b.classList.remove('down'), Math.max(0, 90 - since));
        };
        const fire = (b, ev) => {
            const def = b._def;
            const use = def.a && second && second() ? def.a : def;
            ui.feedback();
            onKey(use.k, use, b, ev);
        };
        pad.addEventListener('pointerdown', e => {
            const b = e.target.closest('.k');
            if (!b || e.button > 0) return;
            e.preventDefault();          // kein Fokus, keine Textauswahl, kein Doppeltipp-Zoom
            const r = b.getBoundingClientRect();
            b.style.setProperty('--px', ((e.clientX - r.left) / r.width * 100).toFixed(0) + '%');
            b.style.setProperty('--py', ((e.clientY - r.top) / r.height * 100).toFixed(0) + '%');
            b.classList.add('down');
            b._downAt = performance.now();
            try { b.setPointerCapture(e.pointerId); } catch (x) { /* egal */ }
            fire(b, e);
            if (b._def.repeat) {
                repeatT = setTimeout(() => { repeatI = setInterval(() => fire(b, e), 75); }, 420);
            }
            const up = () => { stop(b); b.removeEventListener('pointerup', up); b.removeEventListener('pointercancel', up); b.removeEventListener('lostpointercapture', up); };
            b.addEventListener('pointerup', up);
            b.addEventListener('pointercancel', up);
            b.addEventListener('lostpointercapture', up);
        });
        // Tastatur am Rechner (Tab, dann Leertaste/Enter auf einer Taste): click ohne Zeiger
        pad.addEventListener('click', e => {
            const b = e.target.closest('.k');
            if (!b || e.detail !== 0) return;
            b.classList.add('down');
            b._downAt = performance.now();
            fire(b, e);
            stop(b);
        });
        pad.addEventListener('contextmenu', e => e.preventDefault());
        return pad;
    };

    /** Taste kurz aufleuchten lassen (wenn sie auf der echten Tastatur gedrückt wurde) */
    ui.flash = function (root, k) {
        const b = root && root.querySelector('.k[data-k="' + CSS.escape(k) + '"], .k[data-alt="' + CSS.escape(k) + '"]');
        if (!b) return;
        b.classList.add('down');
        clearTimeout(b._fl);
        b._fl = setTimeout(() => b.classList.remove('down'), 110);
    };

    /* ---------- Ton und Vibration ---------- */
    let actx = null;
    ui.feedback = function () {
        const s = C.settings;
        if (s.haptic && navigator.vibrate) { try { navigator.vibrate(7); } catch (e) { /* egal */ } }
        if (s.sound) ui.click();
    };
    ui.click = function () {
        try {
            if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
            if (actx.state === 'suspended') actx.resume();
            const now = actx.currentTime;
            const o = actx.createOscillator(), g = actx.createGain(), f = actx.createBiquadFilter();
            o.type = 'square'; o.frequency.setValueAtTime(1650, now); o.frequency.exponentialRampToValueAtTime(700, now + 0.03);
            f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 1.2;
            g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.16, now + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
            o.connect(f); f.connect(g); g.connect(actx.destination);
            o.start(now); o.stop(now + 0.05);
        } catch (e) { /* kein Ton möglich */ }
    };

    /* ---------- Schrift passend machen ---------- */
    /** Setzt die Schriftgröße auf size und verkleinert, bis der Text in die Breite passt (höchstens bis min) */
    ui.fit = function (el, size, min) {
        el.style.fontSize = size + 'px';
        const w = el.clientWidth;
        if (!w) return;
        const sw = el.scrollWidth;
        if (sw > w + 1) el.style.fontSize = Math.max(min || size * 0.4, Math.floor(size * w / sw * 0.97)) + 'px';
    };

    /* ---------- Zwischenablage, Dateien ---------- */
    ui.copy = async function (text) {
        try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* weiter unten */ }
        const ta = h('textarea', { style: { position: 'fixed', top: '-1000px', opacity: '0' }, readonly: true });
        ta.value = text;
        document.body.append(ta);
        ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        ta.remove();
        return ok;
    };
    ui.paste = async function () {
        try { return await navigator.clipboard.readText(); } catch (e) { return null; }
    };
    ui.download = function (name, text, mime) {
        const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
        const a = h('a', { href: URL.createObjectURL(blob), download: name });
        document.body.append(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    };
    ui.pickFile = function (accept) {
        return new Promise(res => {
            const f = h('input', { type: 'file', accept: accept || '', style: { display: 'none' } });
            f.addEventListener('change', () => {
                const file = f.files && f.files[0];
                f.remove();
                if (!file) return res(null);
                const r = new FileReader();
                r.onload = () => res(String(r.result));
                r.onerror = () => res(null);
                r.readAsText(file);
            });
            document.body.append(f);
            f.click();
        });
    };

    /** Langes Drücken (am Rechner: Rechtsklick) */
    ui.longPress = function (el, fn, ms) {
        let tm = 0, sx = 0, sy = 0;
        el.addEventListener('pointerdown', e => {
            if (e.button > 0) return;
            sx = e.clientX; sy = e.clientY;
            tm = setTimeout(() => { tm = 0; fn(e); }, ms || 500);
        });
        const cancel = () => { clearTimeout(tm); tm = 0; };
        el.addEventListener('pointermove', e => { if (tm && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) cancel(); });
        el.addEventListener('pointerup', cancel);
        el.addEventListener('pointercancel', cancel);
        el.addEventListener('contextmenu', e => { e.preventDefault(); cancel(); fn(e); });
    };

    /** Zahl aus eingefügtem Text: „1.234,56 €“, „-12.5“, „1 234,5“ */
    ui.parseNumber = function (s, dec) {
        if (!s) return null;
        s = String(s).replace(/[−–]/g, '-').replace(/[\s  '’]/g, '');
        const m = /-?[\d.,]+(?:e[+-]?\d+)?/i.exec(s);
        if (!m) return null;
        let n = m[0];
        const lastDot = n.lastIndexOf('.'), lastCom = n.lastIndexOf(',');
        if (lastDot >= 0 && lastCom >= 0) {
            const d = lastDot > lastCom ? '.' : ',';
            n = n.split(d === '.' ? ',' : '.').join('').replace(d, '.');
        } else if (lastCom >= 0) {
            const parts = n.split(',');
            n = parts.length === 2 && (dec === ',' || parts[1].length !== 3) ? parts.join('.') : parts.join('');
        } else if (lastDot >= 0) {
            const parts = n.split('.');
            n = parts.length === 2 && (dec === '.' || parts[1].length !== 3) ? n : parts.join('');
        }
        try { return C.Dec.from(n).toPlain(); } catch (e) { return null; }
    };

    C.ui = ui;
})(self.Calc = self.Calc || {});
