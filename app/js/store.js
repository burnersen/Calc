/* Calc – Speichern auf dem Gerät (localStorage). Alles bleibt hier, nichts geht ins Netz.
   Schlüssel beginnen mit calc_, wie kf_ bei Kaufen. */
(function (C) {
    'use strict';
    const P = 'calc_';

    const store = {
        get(k, d) {
            try { const v = localStorage.getItem(P + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
        },
        set(k, v) {
            try { localStorage.setItem(P + k, JSON.stringify(v)); return true; } catch (e) { return false; }
        },
        del(k) { try { localStorage.removeItem(P + k); } catch (e) { /* egal */ } },
        /** alles von Calc als ein Objekt (für die Sicherung als Datei) */
        dump() {
            const o = {};
            try { for (const k of Object.keys(localStorage)) if (k.startsWith(P)) o[k.slice(P.length)] = JSON.parse(localStorage.getItem(k)); } catch (e) { /* egal */ }
            return o;
        },
        restore(o) {
            if (!o || typeof o !== 'object') return false;
            store.clear();
            for (const k of Object.keys(o)) if (/^[a-z0-9_]{1,40}$/i.test(k)) store.set(k, o[k]);
            return true;
        },
        clear() {
            try { for (const k of Object.keys(localStorage)) if (k.startsWith(P)) localStorage.removeItem(k); } catch (e) { /* egal */ }
        },
    };

    /** Voreinstellungen. Was der Nutzer ändert, liegt unter calc_settings. */
    store.DEFAULTS = {
        lang: 'auto',          // auto | de | en
        numfmt: 'auto',        // auto | de | en | fr | ch
        theme: 'auto',         // auto | klar | nacht | … | c-xxxx (eigenes Design)
        light: 'klar',         // bei „Wie das Gerät“ tagsüber
        dark: 'nacht',         // … und nachts
        sound: false,
        haptic: true,
        motion: 'auto',        // auto | off
        implicit: true,        // 2π und 1÷2π wie am Schulrechner: Mal ohne Zeichen zuerst
        sciFmt: { mode: 'norm', places: 4 },
        hand: 'right',         // Büro: Streifen links (right) oder rechts (left) vom Tastenfeld
        k00: '00',             // Büro: 00 oder 000
        tapeSize: 1,           // Büro: Schriftgröße des Streifens
        tapeH: 0.36,           // Büro hochkant: Anteil des Streifens an der Höhe
        wake: false,           // Bildschirm anlassen
        grouping: true,        // Tausendertrenner in der Anzeige
        confirmClear: true,
    };
    store.settings = function () {
        const s = Object.assign({}, store.DEFAULTS, store.get('settings', {}));
        s.sciFmt = Object.assign({}, store.DEFAULTS.sciFmt, s.sciFmt);
        return s;
    };

    C.store = store;
})(self.Calc = self.Calc || {});
