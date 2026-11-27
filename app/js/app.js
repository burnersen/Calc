/* Calc – Start und Zusammenspiel: Modus wechseln, Einstellungen, Tastatur am Rechner, Offline-Vorrat und Updates. */
(function (C) {
    'use strict';
    const t = (s, v) => C.t(s, v);
    const { h } = C.ui;
    const MODES = ['basic', 'sci', 'office'];
    const root = document.documentElement;

    C.VERSION = (document.querySelector('meta[name="calc-version"]') || {}).content || '';
    C.settings = C.store.settings();

    const app = C.app = {
        views: {},
        mode: 'basic',
        installEvent: null,

        /** Einstellungen ändern, speichern und überall anwenden */
        set(patch, quiet) {
            Object.assign(C.settings, patch);
            const save = Object.assign({}, C.settings);
            delete save.sciAngle;
            C.store.set('settings', save);
            if (quiet) return;
            if ('lang' in patch) { C.setLang(C.settings.lang); C.applyI18n(document); rebuild(); }
            C.theme.apply(C.settings);
            app.refresh();
        },

        refresh() {
            for (const m of MODES) if (app.views[m]) app.views[m].render();
        },

        setMode(m, noAnim) {
            if (!MODES.includes(m)) m = 'basic';
            const from = app.mode;
            app.mode = m;          // sofort, damit Tastendrücke während der Animation schon im neuen Modus landen
            const go = () => {
                root.dataset.mode = m;
                for (const k of MODES) app.views[k].el.classList.toggle('on', k === m);
                document.querySelectorAll('.seg button').forEach((b, i) => { b.setAttribute('aria-selected', String(MODES[i] === m)); b.tabIndex = MODES[i] === m ? 0 : -1; });
                document.querySelector('.seg').style.setProperty('--i', String(MODES.indexOf(m)));
                const hb = document.getElementById('btnHist');
                hb.replaceChildren(C.ui.icon(m === 'office' ? 'archive' : 'history'));
                hb.setAttribute('aria-label', m === 'office' ? t('Archiv') : t('Verlauf'));
                hb.title = hb.getAttribute('aria-label');
                C.store.set('mode', m);
                app.views[m].render();
                requestAnimationFrame(() => app.views[m].render());
            };
            const motion = C.settings.motion !== 'off' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (!noAnim && motion && document.startViewTransition && from !== m) document.startViewTransition(go);
            else go();
        },

        async install() {
            const ev = app.installEvent;
            if (!ev) return C.settingsUI.installHelp();
            ev.prompt();
            try { await ev.userChoice; } catch (e) { /* egal */ }
            app.installEvent = null;
            document.querySelectorAll('dialog.sheet').forEach(d => d.close());
        },

        /** Wie steht es um den Offline-Vorrat? */
        async offlineState() {
            if (!('serviceWorker' in navigator)) return t('Dieser Browser kann Calc nicht offline vorhalten.');
            if (location.protocol === 'file:') return t('Offline geht erst, wenn Calc über eine Webseite (https) geöffnet wird.');
            try {
                const reg = await navigator.serviceWorker.getRegistration();
                if (!reg || !reg.active) return t('Wird gerade eingerichtet …');
                const keys = await caches.keys();
                const mine = keys.find(k => k.startsWith('calc-'));
                if (!mine) return t('Wird gerade eingerichtet …');
                const n = (await (await caches.open(mine)).keys()).length;
                return t('Bereit: Version {v}, {n} Dateien auf dem Gerät. Calc läuft auch ohne Internet.', { v: C.VERSION, n });
            } catch (e) { return t('Unbekannt'); }
        },

        async checkUpdate(manual) {
            if (!('serviceWorker' in navigator)) return;
            const reg = await navigator.serviceWorker.getRegistration();
            if (!reg) return;
            try { await reg.update(); } catch (e) { if (manual) C.ui.toast(t('Keine Verbindung. Calc läuft trotzdem weiter.')); return; }
            if (manual && !reg.installing && !reg.waiting) C.ui.toast(t('Calc ist auf dem neuesten Stand ({v}).', { v: C.VERSION }));
        },

        wakeLock: null,
        async wake() {
            try {
                if (C.settings.wake && 'wakeLock' in navigator && document.visibilityState === 'visible') {
                    if (!app.wakeLock) { app.wakeLock = await navigator.wakeLock.request('screen'); app.wakeLock.addEventListener('release', () => { app.wakeLock = null; }); }
                } else if (!C.settings.wake && app.wakeLock) { await app.wakeLock.release(); app.wakeLock = null; }
            } catch (e) { app.wakeLock = null; }
        },
    };

    /* ---------- Aufbau ---------- */
    function build() {
        const stage = document.getElementById('stage');
        app.views.basic = new C.ExprView('basic');
        app.views.sci = new C.ExprView('sci');
        if (C.settings.sciAngle) app.views.sci.calc.angle = C.settings.sciAngle;
        app.views.office = new C.OfficeView();
        stage.replaceChildren(app.views.basic.el, app.views.sci.el, app.views.office.el);
    }
    function rebuild() {
        build();
        app.setMode(app.mode, true);
    }

    function bar() {
        const seg = document.querySelector('.seg');
        seg.querySelectorAll('button').forEach((b, i) => {
            b.addEventListener('click', () => app.setMode(MODES[i]));
            b.addEventListener('keydown', e => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const j = (i + (e.key === 'ArrowRight' ? 1 : 2)) % 3;
                    app.setMode(MODES[j]);
                    seg.querySelectorAll('button')[j].focus();
                }
            });
        });
        // Wischen über den Umschalter wechselt den Modus
        let sx = null;
        seg.addEventListener('pointerdown', e => { sx = e.clientX; });
        seg.addEventListener('pointerup', e => {
            if (sx == null) return;
            const dx = e.clientX - sx; sx = null;
            if (Math.abs(dx) > 50) app.setMode(MODES[Math.max(0, Math.min(2, MODES.indexOf(app.mode) + (dx > 0 ? 1 : -1)))]);
        });
        document.getElementById('btnHist').addEventListener('click', () => app.mode === 'office' ? app.views.office.archive() : app.views[app.mode].history());
        document.getElementById('btnTheme').addEventListener('click', () => C.theme.picker());
        document.getElementById('btnMenu').addEventListener('click', e => C.ui.menu(e.currentTarget, [
            { label: t('Einstellungen'), icon: 'settings', on: () => C.settingsUI.open() },
            { label: t('Design'), icon: 'palette', on: () => C.theme.picker() },
            { label: t('Farben anpassen'), icon: 'drop', on: () => C.theme.mixer() },
            { sep: true },
            app.mode === 'office' ? { label: t('Archiv'), icon: 'archive', on: () => app.views.office.archive() } : { label: t('Verlauf'), icon: 'history', on: () => app.views[app.mode].history() },
            { label: t('Hilfe und Tastenkürzel'), icon: 'help', on: () => C.settingsUI.help() },
            matchMedia('(display-mode: standalone)').matches || navigator.standalone ? null : { label: t('Als App installieren'), icon: 'install', on: () => app.install() },
        ]));
    }

    /* ---------- Tastatur am Rechner ---------- */
    function keyboard() {
        document.addEventListener('keydown', e => {
            if (e.defaultPrevented || e.isComposing) return;
            const tag = (e.target && e.target.tagName) || '';
            if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (e.target && e.target.isContentEditable)) return;
            if (C.ui.anyOpen()) return;
            if (e.altKey && /^[123]$/.test(e.key)) { e.preventDefault(); app.setMode(MODES[+e.key - 1]); return; }
            if (e.altKey && /^Digit[123]$/.test(e.code)) { e.preventDefault(); app.setMode(MODES[+e.code.slice(5) - 1]); return; }
            if (e.key === '?' || e.key === 'F1') { e.preventDefault(); C.settingsUI.help(); return; }
            const v = app.views[app.mode];
            if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
                if (String(getSelection()).length) return;
                e.preventDefault();
                app.mode === 'office' ? v.copyValue() : v.copy();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && app.mode === 'office') { e.preventDefault(); v.undo(); return; }
            if (e.ctrlKey || e.metaKey || (e.altKey && !/^[0-9]$/.test(e.key))) return;
            if (e.key === ' ' && document.activeElement && document.activeElement.classList.contains('k')) return;
            if (e.key === 'Enter' && document.activeElement && /^(BUTTON|A)$/.test(document.activeElement.tagName) && !document.activeElement.classList.contains('k')) return;
            if (v.key(e)) e.preventDefault();
        });
        document.addEventListener('paste', e => {
            const tag = (e.target && e.target.tagName) || '';
            if (/^(INPUT|TEXTAREA)$/.test(tag) || C.ui.anyOpen()) return;
            const s = e.clipboardData && e.clipboardData.getData('text');
            if (s) { e.preventDefault(); app.views[app.mode].paste(s); }
        });
    }

    /* ---------- Offline: Service Worker ---------- */
    function serviceWorker() {
        if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
        let reloading = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (reloading || !app.updateAccepted) return;
            reloading = true;
            location.reload();
        });
        navigator.serviceWorker.register('sw.js').then(reg => {
            const offer = w => {
                if (!navigator.serviceWorker.controller) return;     // erster Besuch: nichts anzubieten
                C.ui.toast(t('Neue Version von Calc ist da.'), t('Jetzt laden'), () => { app.updateAccepted = true; w.postMessage({ type: 'skip' }); }, 12000);
            };
            if (reg.waiting) offer(reg.waiting);
            reg.addEventListener('updatefound', () => {
                const w = reg.installing;
                if (!w) return;
                w.addEventListener('statechange', () => { if (w.state === 'installed') offer(w); });
            });
            // ab und zu nachsehen, ob es etwas Neues gibt (nur mit Netz, sonst still)
            setInterval(() => { if (navigator.onLine) reg.update().catch(() => {}); }, 60 * 60 * 1000);
        }).catch(() => {});
        if (matchMedia('(display-mode: standalone)').matches && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    }

    /* ---------- Los ---------- */
    function start() {
        C.setLang(C.settings.lang);
        C.applyI18n(document);
        C.theme.apply(C.settings);
        build();
        bar();
        keyboard();
        const q = new URLSearchParams(location.search).get('mode');
        app.setMode(MODES.includes(q) ? q : C.store.get('mode', 'basic'), true);
        let rt = 0;
        const onResize = () => { cancelAnimationFrame(rt); rt = requestAnimationFrame(() => { C.theme.apply(C.settings); app.views[app.mode].render(); }); };
        addEventListener('resize', onResize);
        if (window.ResizeObserver) new ResizeObserver(onResize).observe(document.getElementById('stage'));
        document.fonts && document.fonts.ready.then(() => app.views[app.mode].render());
        addEventListener('beforeinstallprompt', e => { e.preventDefault(); app.installEvent = e; });
        addEventListener('appinstalled', () => { app.installEvent = null; C.ui.toast(t('Calc ist installiert.')); if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); });
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') app.wake(); });
        app.wake();
        serviceWorker();
        root.classList.add('ready');
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})(self.Calc = self.Calc || {});
