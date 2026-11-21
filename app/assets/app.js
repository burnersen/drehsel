/* Drehsel – die App im Browser: Spiele wählen, drehen, Ergebnis zeigen und vorlesen, Sanduhr, Vorführmodus,
   Einstellungen (Farbwelten, Farbmischer, Schriften und Größen), eigene Räder und Listen, Teilnehmer, Sicherung, Teilen per Link,
   Hinweis zum Installieren. Alles, was jemand anlegt oder einstellt, bleibt im Speicher des Geräts. Der Server sieht davon nichts. */
(function () {
    'use strict';
    const DR = window.DR, L = DR.look;
    const { el, icon } = DR;
    const $ = s => document.querySelector(s);
    const root = document.documentElement;
    const OFFLINE = root.dataset.offline === '1' || location.protocol === 'file:';
    const LIST_URLS = JSON.parse(root.dataset.lists || '{}');
    const UI_LANGS = JSON.parse(root.dataset.langs || '["de"]');
    const LINKS = {
        play: 'https://drehsel.burnersen.de/', github: 'https://github.com/burnersen/mixer', web: 'https://tech.burnersen.de/',
        kofi: 'https://ko-fi.com/burnersen', suchsel: 'https://suchsel.burnersen.de/',
        kaufen: { de: 'https://tech.burnersen.de/tools/kaufen/', en: 'https://tech.burnersen.de/en/tools/kaufen-en/' },
    };

    /* ---------- Speicher ---------- */
    const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem('dr_' + k)); return v == null ? d : v; } catch (e) { return d; } };
    const save = (k, v) => { try { localStorage.setItem('dr_' + k, JSON.stringify(v)); } catch (e) { toast(t('Speichern ging nicht, der Speicher des Browsers ist voll.')); } };
    const drop = k => { try { localStorage.removeItem('dr_' + k); } catch (e) {} };

    const navLang = () => {
        for (const l of navigator.languages || [navigator.language || 'de']) { const s = String(l).slice(0, 2).toLowerCase(); if (UI_LANGS.indexOf(s) >= 0) return s; }
        return UI_LANGS.indexOf('en') >= 0 ? 'en' : 'de';
    };
    const DEF = {
        lang: navLang(), look: { mode: 'auto', l: 'klassisch', d: 'nacht', cl: null, cd: null }, font: 'atkinson',
        fs: { ui: 1, res: 1, wheel: 1, small: 1 }, fw: 800, caps: false,
        speed: 'normal', sound: true, vib: true, say: false, sayRate: 1, black: true, wake: true, cur: 'slf', filter: 'all', seen: false, tvTip: false,
    };
    const set = Object.assign({}, DEF, load('set', {}));
    set.look = Object.assign({}, DEF.look, set.look || {});
    set.fs = Object.assign({}, DEF.fs, set.fs || {});
    if (UI_LANGS.indexOf(set.lang) < 0) set.lang = 'de';
    const saveSet = () => save('set', set);
    let own = (load('games', []) || []).map(DR.cleanGame).filter(Boolean);    // eigene Räder
    let ov = load('ov', {}) || {};                                            // Anpassungen an eingebauten Spielen
    let lo = load('lo', {}) || {};                                            // ausgeblendete und ergänzte Einträge eingebauter Listen
    let names = DR.parseItems((load('names', []) || []).map(DR.itemLine).join('\n'));    // Teilnehmer
    const saveOwn = () => save('games', own), saveOv = () => save('ov', ov), saveLo = () => save('lo', lo), saveNames = () => save('names', names);

    /* ---------- Übersetzung: Schlüssel ist der deutsche Text ---------- */
    function t(s, vars) {
        const d = window.DR_I18N && DR_I18N[set.lang];
        let out = (d && d[s]) || s;
        if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
        return out;
    }
    const langName = l => l === 'de' ? 'Deutsch' : (window.DR_I18N && DR_I18N[l] && DR_I18N[l]._name) || l;

    /* ---------- Hinweise unten ---------- */
    let toastT = 0;
    function toast(msg, action, ms) {
        const e = $('#toast');
        e.replaceChildren(el('span', { text: msg }));
        if (action) e.append(el('button.btn.small', { type: 'button', text: action.label, onclick: ev => { ev.stopPropagation(); e.hidden = true; action.fn(); } }));
        e.hidden = false;
        clearTimeout(toastT);
        toastT = setTimeout(() => { e.hidden = true; }, ms || (action ? 7000 : Math.min(5000, 2000 + msg.length * 30)));
    }
    const N = s => s;    // markiert Texte, die erst später übersetzt werden (für tools/check-i18n.js)
    const announce = s => { const l = $('#live'); l.textContent = ''; setTimeout(() => { l.textContent = s; }, 30); };

    /* ---------- Aussehen: Farbwelt, eigene Farben, Schrift und Größen ---------- */
    const darkMq = matchMedia('(prefers-color-scheme: dark)');
    const curMode = () => set.look.mode === 'auto' ? (darkMq.matches ? 'dark' : 'light') : set.look.mode;
    /** Die Grundfarben, die gerade gelten (für eine Seite: light oder dark) */
    function colorsFor(mode) {
        const id = set.look[mode === 'dark' ? 'd' : 'l'];
        if (id === 'eigen') { const c = L.cleanColors(set.look[mode === 'dark' ? 'cd' : 'cl'], mode); if (c) return c; }
        return L.palColors(id) || L.palColors(mode === 'dark' ? 'nacht' : 'klassisch');
    }
    let showMode = false;
    let cols = null;
    function applyLook() {
        const mode = curMode();
        cols = colorsFor(mode);
        const vars = L.derive(cols);
        if (showMode && set.black) { vars['--bg'] = '#000000'; }
        for (const k in vars) root.style.setProperty(k, vars[k]);
        root.dataset.theme = mode;
        root.dataset.font = set.font;
        root.style.setProperty('--ui', String(set.fs.ui));
        root.style.setProperty('--fs-small', String(set.fs.small));
        root.style.setProperty('--fs-wheel', String(set.fs.wheel));
        root.style.setProperty('--fw-res', String(set.fw));
        root.classList.toggle('caps', !!set.caps);
        const meta = $('meta[name=theme-color]');
        if (meta) meta.content = vars['--bg'];
        // Für boot.js: beim nächsten Start sofort in den richtigen Farben
        const side = m => L.derive(colorsFor(m));
        save('paint', { mode: set.look.mode, light: side('light'), dark: side('dark') });
        if (stage && stage.model) stage.layout();
    }
    darkMq.addEventListener('change', () => { if (set.look.mode === 'auto') { applyLook(); render(); } });
    const segColors = () => ({ seg: cols.seg, segInk: L.segInk(cols.seg), rim: cols.rim, card: L.derive(cols)['--card'], acc: cols.acc });

    /* ---------- Eingebaute Listen ---------- */
    const content = {};
    async function loadContent(l) {
        if (content[l]) return content[l];
        let text = '';
        const inline = document.getElementById('dr-lists-' + l);
        if (inline) text = inline.textContent;
        else if (LIST_URLS[l]) {
            try { const r = await fetch(LIST_URLS[l]); if (r.ok) text = await r.text(); } catch (e) {}
        }
        content[l] = DR.parseContent(text);
        return content[l];
    }
    const contentLang = () => LIST_URLS[set.lang] != null ? set.lang : (LIST_URLS.en != null ? 'en' : 'de');
    function baseList(id) {
        for (const l of [contentLang(), 'en', 'de']) if (content[l] && content[l][id]) return content[l][id];
        return null;
    }
    const loKey = id => contentLang() + ':' + id;
    /** Eine eingebaute Liste mit den eigenen Änderungen: ausgeblendete fallen weg, ergänzte kommen dazu */
    function listFor(id) {
        const b = baseList(id);
        const o = lo[loKey(id)];
        if (!b) return o && o.add && o.add.length ? { id, name: id, items: o.add } : null;
        if (!o) return b;
        const off = new Set(o.off || []);
        return { id, name: b.name, items: b.items.filter(x => !off.has(x.t)).concat(o.add || []) };
    }
    // Buchstaben nur aus der Sprache, die gerade gilt: Englisch hat keine Umlaute
    const ownList = id => content[contentLang()] && content[contentLang()][id];
    const alphabet = () => { const l = ownList('alphabet') || baseList('alphabet'); return l && l.items.length ? l.items.map(x => x.t).join(' ').match(/\S+/g) : 'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z'.split(' '); };
    const extraLetters = () => { const l = ownList('alphabet-extra'); return l ? l.items.map(x => x.t).join(' ').match(/\S+/g) || [] : []; };
    const ctx = { list: listFor, names: () => names, alphabet, extra: extraLetters };

    /* ---------- Spiele: eingebaute mit Anpassungen, eigene ---------- */
    const clone = o => JSON.parse(JSON.stringify(o));
    function merged(b) {
        const o = ov[b.id] || {};
        const g = clone(b);
        for (const k of ['view', 'timer', 'say', 'cats', 'groups']) if (o[k] !== undefined) g[k] = o[k];
        g.slots = g.slots.map((s, i) => {
            const x = (o.slots || [])[i] || {};
            const out = Object.assign({}, s, x);
            out.src = Object.assign({}, s.src, x.src || {});
            return out;
        });
        g.name = t(b.name); g.desc = t(b.desc);
        if (b.note && o.note === undefined) g.note = t(b.note);
        g.slots.forEach(s => { s.label = t(s.label); });
        return g;
    }
    const builtin = id => DR.GAMES.find(g => g.id === id);
    function getGame(id) {
        const b = builtin(id);
        if (b) return merged(b);
        const o = own.find(g => g.id === id);
        return o ? Object.assign(clone(o), { own: true }) : null;
    }
    /** Eine Einstellung am Spiel ändern: bei eingebauten als Anpassung, bei eigenen direkt */
    function patchGame(id, fn) {
        const b = builtin(id);
        if (b) {
            const o = ov[id] || (ov[id] = {});
            fn(o, true);
            saveOv();
        } else {
            const g = own.find(x => x.id === id);
            if (!g) return;
            fn(g, false);
            saveOwn();
        }
        render();
    }
    const slotPatch = (o, isB, k) => {
        if (!isB) return o.slots[k];
        o.slots = o.slots || [];
        return o.slots[k] = o.slots[k] || {};
    };
    const srcPatch = (o, isB, k) => { const s = slotPatch(o, isB, k); return s.src = s.src || {}; };

    /* ---------- Spielstand je Spiel ---------- */
    const states = {};
    const stateOf = id => states[id] || (states[id] = DR.normState(load('st_' + id, null)));
    const saveState = id => save('st_' + id, stateOf(id));

    /* ---------- Fenster (von unten, am Rechner mittig). Zurück-Taste und Esc schließen das oberste. ---------- */
    const sheets = [];
    function sheet(title, body, opts) {
        opts = opts || {};
        const close = el('button.iconbtn', { type: 'button', 'aria-label': t('Schließen'), title: t('Schließen') }, icon('close'));
        const panel = el('div.sheet' + (opts.cls ? '.' + opts.cls : ''), { role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
            el('header', null, opts.head || null, el('h2', { text: title }), close),
            el('div.body', null, body),
            opts.foot ? el('div.foot', null, opts.foot) : null);
        const wrap = el('div.sheet-wrap', null, panel);
        const s = { wrap, panel, body: panel.querySelector('.body'), onClose: opts.onClose, closed: false };
        s.close = () => closeSheet(s);
        close.addEventListener('click', s.close);
        wrap.addEventListener('pointerdown', e => { if (e.target === wrap) s.downOnBg = true; });
        wrap.addEventListener('click', e => { if (e.target === wrap && s.downOnBg && !opts.sticky) s.close(); s.downOnBg = false; });
        $('#layer').append(wrap);
        sheets.push(s);
        history.pushState({ dr: sheets.length }, '');
        return s;
    }
    function removeSheet(s) {
        if (s.closed) return;
        s.closed = true;
        const i = sheets.indexOf(s);
        if (i >= 0) sheets.splice(i, 1);
        s.wrap.classList.add('out');
        setTimeout(() => s.wrap.remove(), 180);
        if (s.onClose) s.onClose();
    }
    /** Fenster schließen: sofort weg, den Eintrag im Verlauf des Browsers räumt history.back() danach auf (ohne ein zweites Fenster zu schließen) */
    function closeSheet(s) {
        if (s.closed) return;
        const top = sheets[sheets.length - 1] === s;
        removeSheet(s);
        if (top && history.state && history.state.dr) { skipPop++; history.back(); }
    }
    let skipPop = 0;
    addEventListener('popstate', () => {
        if (skipPop) { skipPop--; return; }
        const s = sheets[sheets.length - 1];
        if (s) removeSheet(s); else if (showMode) toggleShow(false);
    });
    function closeAll() {
        const n = sheets.length;
        if (!n) return;
        sheets.slice().reverse().forEach(removeSheet);
        const depth = Math.min(n, history.state && history.state.dr || 0);
        if (depth) { skipPop++; history.go(-depth); }
    }

    /* Kleine Bausteine für die Fenster */
    const section = (title, ...kids) => el('section.sec', null, title ? el('h3', { text: title }) : null, ...kids);
    const note = text => el('p.note', { text });
    function seg(options, value, onchange, cls) {
        const box = el('div.seg' + (cls ? '.' + cls : ''), { role: 'radiogroup' });
        const paint = v => box.querySelectorAll('button').forEach(b => { const on = b.dataset.v === String(v); b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
        for (const [v, label, sub] of options) {
            box.append(el('button', { type: 'button', 'data-v': v, role: 'radio', onclick: () => { paint(v); onchange(v); } },
                el('b', { text: label }), sub ? el('small', { text: sub }) : null));
        }
        paint(value);
        return box;
    }
    function toggle(label, value, onchange, sub) {
        const inp = el('input', { type: 'checkbox', checked: value, onchange: () => onchange(inp.checked) });
        return el('label.toggle', null, el('span', null, el('b', { text: label }), sub ? el('small', { text: sub }) : null), inp, el('i'));
    }
    function stepper(value, min, max, onchange, step) {
        step = step || 1;
        const inp = el('input', { type: 'number', inputmode: 'numeric', min, max, step, value });
        const setv = v => { v = Math.max(min, Math.min(max, Math.round((+v) / step) * step || min)); inp.value = v; onchange(v); };
        inp.addEventListener('change', () => setv(inp.value));
        return el('div.stepper', null,
            el('button.iconbtn', { type: 'button', 'aria-label': '−', onclick: () => setv(+inp.value - step) }, icon('minus')),
            inp,
            el('button.iconbtn', { type: 'button', 'aria-label': '+', onclick: () => setv(+inp.value + step) }, icon('plus')));
    }
    const field = (label, ...kids) => el('label.field', null, el('span', { text: label }), ...kids);
    const btn = (label, fn, ic, cls) => el('button.btn' + (cls ? '.' + cls : ''), { type: 'button', onclick: fn }, ic ? icon(ic) : null, el('span', { text: label }));
    function menuItem(ic, label, fn, sub) {
        return el('button.mitem', { type: 'button', onclick: fn }, icon(ic), el('span', null, el('b', { text: label }), sub ? el('small', { text: sub }) : null));
    }
    function confirmDlg(title, text, okLabel, fn) {
        let s;
        s = sheet(title, el('div', null, el('p', { text }), el('div.btns', null, btn(t('Abbrechen'), () => s.close()), btn(okLabel, () => { s.close(); fn(); }, null, 'danger'))), { cls: 'narrow' });
    }

    /* ---------- Dateien ---------- */
    const isTouch = () => matchMedia('(pointer: coarse)').matches;
    function download(blob, name) {
        const a = el('a', { href: URL.createObjectURL(blob), download: name });
        document.body.append(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
    }
    async function shareOrDownload(blob, name) {
        if (isTouch() && navigator.canShare) {
            const file = new File([blob], name, { type: blob.type });
            if (navigator.canShare({ files: [file] })) {
                try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
            }
        }
        download(blob, name);
    }
    function pickFile(accept, fn) {
        const inp = el('input', { type: 'file', accept });
        inp.addEventListener('change', async () => { const f = inp.files && inp.files[0]; if (f) fn(await f.text(), f.name); });
        inp.click();
    }
    const slug = s => String(s || 'drehsel').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'drehsel';
    const today = () => { const d = new Date(); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); };

    /* ---------- Vorlesen und Vibration ---------- */
    let voices = [];
    const loadVoices = () => { try { voices = speechSynthesis.getVoices() || []; } catch (e) {} };
    if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', loadVoices); }
    function speak(text, force) {
        if (!text || !('speechSynthesis' in window)) return;
        if (!force && !sayOn()) return;
        try {
            speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(String(text).replace(/[|•]/g, ' '));
            const lang = set.lang === 'de' ? 'de-DE' : set.lang === 'en' ? 'en-GB' : set.lang;
            u.lang = lang;
            const v = voices.filter(x => x.lang && x.lang.toLowerCase().replace('_', '-').startsWith(set.lang));
            const best = v.find(x => x.localService && x.default) || v.find(x => x.localService) || v[0];
            if (best) u.voice = best;
            u.rate = set.sayRate || 1;
            speechSynthesis.speak(u);
        } catch (e) {}
    }
    const vibrate = p => { if (set.vib && navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} };

    /* ---------- Sanduhr ---------- */
    const timer = {
        s: 0, left_: 0, run: false, t0: 0, iv: 0, onPaint: null,
        setup(sec) { this.stop(); this.s = sec; this.left_ = sec; this.paint(); },
        total() { return this.s; }, left() { return Math.max(0, Math.ceil(this.left_)); }, running() { return this.run; },
        paint() { if (this.onPaint) this.onPaint(); },
        start() {
            if (!this.s) return;
            if (this.left_ <= 0) this.left_ = this.s;
            this.run = true; this.t0 = performance.now(); const from = this.left_;
            clearInterval(this.iv);
            this.iv = setInterval(() => {
                this.left_ = from - (performance.now() - this.t0) / 1000;
                if (this.left_ <= 0) { this.left_ = 0; this.stop(); this.end(); }
                this.paint();
            }, 200);
            this.paint();
        },
        stop() { this.run = false; clearInterval(this.iv); this.paint(); },
        toggle() { DR.Sound.unlock(); if (this.run) this.stop(); else this.start(); },
        reset() { this.stop(); this.left_ = this.s; this.paint(); toast(t('Sanduhr zurückgesetzt')); },
        restart() { this.stop(); this.left_ = this.s; this.start(); },
        end() {
            if (set.sound) DR.Sound.gong();
            vibrate([200, 100, 200, 100, 400]);
            const ov = el('div.timeup', { onclick: () => ov.remove() }, el('div', null, icon('timer'), el('b', { text: t('Die Zeit ist um!') })));
            $('#stage').append(ov);
            setTimeout(() => ov.remove(), 3500);
            speak(t('Die Zeit ist um!'));
        },
    };

    /* ---------- Die Bühne ---------- */
    let stage = null;
    let game = null;          // das Spiel, das gerade offen ist (zusammengesetzt)
    let lastSpin = null;      // die letzte Drehung in dieser Sitzung (für das Rad: welche Felder, welches gewonnen hat)
    let rev = false, open = {};
    let busy = false;

    const sayOn = () => game && game.say != null ? !!game.say : !!set.say;
    const speedMs = v => {
        const base = { slow: 6500, normal: 4200, fast: 2200, off: 0 }[set.speed];
        const f = { wheel: 1, reels: .7, card: .55, dice: .4, bingo: .55, abc: .5, teams: .4, duties: .4 }[v] || 1;
        return base == null ? 4200 * f : base * f;
    };
    const SPIN_LABEL = { wheel: N('Drehen'), reels: N('Drehen'), card: N('Ziehen'), dice: N('Würfeln'), bingo: N('Ziehen'), abc: N('Neues Thema'), teams: N('Einteilen'), duties: N('Verteilen') };
    const resText = (r, g) => r ? r.map((sel, k) => g.slots[k] && g.slots[k].hide ? '' : sel.map(s => (s.p ? s.p + ' ' : '') + s.t).join(', ')).filter(Boolean).join(' · ') : '';

    function model() {
        const g = game;
        const st = stateOf(g.id);
        const all = g.slots.map(s => DR.endless(s) ? [] : DR.itemsOf(s, ctx));
        const last = st.hist[st.hist.length - 1];
        const m = {
            view: g.view, lang: set.lang, show: showMode, all, rev, open,
            slots: g.slots.map((s, k) => ({ label: s.label, hide: s.hide, seg: [] })),
            res: last ? last.r : null, canUndo: !!(last && last.b), hint: t('Antippen zum Drehen'),
        };
        // Was das Rad zeigt: direkt nach dem Drehen die Felder von vorher mit dem Gewinner, sonst was noch im Topf ist
        if (g.view === 'wheel') {
            m.slots.forEach((s, k) => {
                if (lastSpin && lastSpin.r[k] && lastSpin.r[k].seg) { s.seg = lastSpin.r[k].seg.map(i => all[k][i]).filter(Boolean); }
                else s.seg = DR.wheelItems(g, st, k, ctx).map(i => all[k][i]);
            });
            m.hitSeg = lastSpin ? lastSpin.r.map(x => x.hit) : null;
        }
        // Leere Listen und fehlende Namen
        const k0 = g.slots.findIndex((s, k) => !DR.endless(s) && !all[k].length);
        if (k0 >= 0) {
            const s = g.slots[k0];
            m.empty = s.src.type === 'names'
                ? { text: t('Hier fehlen noch die Namen der Mitspieler.'), action: { label: t('Namen eintragen'), icon: 'people', fn: showNames } }
                : { text: t('Diese Liste ist leer.'), action: { label: t('Einträge bearbeiten'), icon: 'edit', fn: () => editSlot(k0) } };
        }
        // Wie viele noch im Topf sind, und die letzten Ergebnisse
        const info = [];
        g.slots.forEach((s, k) => {
            const lf = DR.left(g, st, k, ctx);
            if (!lf || (s.rule || 'free') === 'free' || g.view === 'bingo' || (g.slots.length > 1 && s.rule !== 'once')) return;
            info.push((g.slots.length > 1 ? s.label + ': ' : '') + t('noch {n} von {m}', { n: lf.left, m: lf.all }));
        });
        if (g.view === 'bingo') {
            const drawn = st.hist.map(h => h.r[0][0].t);
            info.push(t('{n} von {m} gezogen', { n: drawn.length, m: all[0].length }));
            const rows = all[0].some(x => x.p) ? 'BINGO'.split('').map(p => ({ p, items: all[0].filter(x => x.p === p) })).filter(r => r.items.length) : null;
            m.board = { items: all[0], rows, drawn, last: last ? last.r[0][0].t : null };
        }
        if (g.view !== 'teams' && g.view !== 'duties' && g.view !== 'abc') {
            m.hist = st.hist.slice(-7, -1).reverse().map(h => resText(h.r, g)).filter(Boolean).map(s => s.length > 18 ? s.slice(0, 16) + '…' : s);
        }
        if (g.view === 'dice') m.dice = g.slots[0].src.n || 1;
        if (g.view === 'abc') {
            const ex = (g.abcEx != null ? g.abcEx : 'QXY').toUpperCase();
            m.abc = { letters: alphabet().filter(x => ex.indexOf(x) < 0), i: Math.max(0, st.extra.abc | 0) };
            if (!last) m.hint = t('Thema drehen');
        }
        if (g.view === 'teams') { m.teams = st.extra.teams || null; m.hint = t('Antippen zum Einteilen'); m.canUndo = false; m.res = null; }
        if (g.view === 'duties') { m.duties = st.extra.duties || null; m.hint = t('Antippen zum Verteilen'); m.canUndo = false; m.res = null; }
        if (g.cats) { const l = listFor(g.cats); m.cats = l ? l.items.map(x => x.t) : null; }
        if (info.length) m.info = info.join(' · ');
        if (st.extra.over) m.info = (m.info ? m.info + ' · ' : '') + t('Alle gezogen');
        if (g.timer && g.timer.s > 0) { if (timer.s !== g.timer.s) timer.setup(g.timer.s); m.timer = timer; } else { timer.setup(0); }
        if (showMode) m.extra = el('button.exitshow', { type: 'button', 'aria-label': t('Vorführmodus beenden'), title: t('Vorführmodus beenden'), onclick: e => { e.stopPropagation(); toggleShow(false); } }, icon('compress'));
        if (g.note) m.note = g.note;
        return m;
    }
    function render() {
        if (!game || !stage) return;
        game = getGame(game.id) || game;
        renderTop();
        stage.show(model());
    }
    function renderTop() {
        const g = game;
        $('#titleBtn .emo').replaceChildren(icon(g.ic));
        $('#titleBtn .name').textContent = g.name;
        $('#titleBtn').title = t('Anderes Spiel wählen');
        $('#titleBtn').setAttribute('aria-label', t('Anderes Spiel wählen') + ': ' + g.name);
        $('#spinBtn').replaceChildren(icon('play'), el('span', { text: t(SPIN_LABEL[g.view] || 'Drehen') }));
        document.title = g.name + ' · Drehsel';
    }
    async function openGame(id, quiet) {
        const g = getGame(id) || getGame('slf');
        if (game && game.id !== g.id) { stage.resetRot(); timer.setup(0); }
        game = g;
        lastSpin = null; rev = false; open = {};
        set.cur = g.id; saveSet();
        render();
        if (!quiet) announce(g.name);
    }

    /** Inhalt einer Walze bearbeiten, je nachdem, woher er kommt */
    function editSlot(k) {
        const s = game.slots[k];
        if (!s) return;
        if (s.src.type === 'list') editBuiltinList(s.src.list);
        else if (s.src.type === 'names') showNames();
        else if (game.own) editOwn(game.id);
        else showGameSettings();
    }

    /* ---------- Drehen ---------- */
    async function spin(dir, power) {
        if (!game) return;
        if (busy) { stage.finishAll(); return; }
        if (sheets.length) return;
        const g = game, st = stateOf(g.id);
        DR.Sound.on = set.sound;
        DR.Sound.unlock();
        if (stage.model && stage.model.empty) { stage.model.empty.action && stage.model.empty.action.fn(); return; }
        const dur = speedMs(g.view);
        if (g.view === 'teams' || g.view === 'duties') {
            const all = g.slots.map(s => DR.itemsOf(s, ctx));
            if (g.view === 'teams') st.extra.teams = DR.teams(all[0], g.groups || 2).map(x => x.map(i => ({ t: i.t })));
            else st.extra.duties = DR.duties(all[0], all[1], st).map(x => ({ d: { t: x.d.t }, n: x.n ? { t: x.n.t } : null }));
            saveState(g.id);
            busy = true;
            await stage.spin({ r: [] }, { dur });
            busy = false;
            if (set.sound) DR.Sound.land();
            render();
            const txt = g.view === 'teams' ? st.extra.teams.map((x, i) => t('Gruppe {n}', { n: i + 1 }) + ': ' + x.map(y => y.t).join(', ')).join('. ') : st.extra.duties.map(x => x.d.t + ': ' + (x.n ? x.n.t : '')).join('. ');
            announce(txt); speak(txt);
            return;
        }
        const d = DR.draw(g, st, ctx);
        if (d.empty != null) { render(); return; }
        if (d.over != null) {
            st.extra.over = true; saveState(g.id); render();
            toast(t('Alle gezogen. Eine neue Runde mischt alles wieder zusammen.'), { label: t('Neue Runde'), fn: () => newRound() });
            return;
        }
        st.extra.over = false;
        if (g.view === 'abc') st.extra.abc = 0;
        saveState(g.id);
        lastSpin = d; rev = false; open = {};
        busy = true;
        $('#spinBtn').classList.add('busy');
        try { await stage.spin(d, { dur, dir: dir || 1, power }); } finally { busy = false; $('#spinBtn').classList.remove('busy'); }
        if (set.sound && dur) DR.Sound.land();
        vibrate(40);
        render();
        const txt = resText(d.r.map(x => x.sel), g);
        announce(txt);
        speak(txt);
        if (g.timer && g.timer.s > 0 && g.timer.auto) timer.restart();
    }
    function reveal(k) {
        const st = stateOf(game.id), last = st.hist[st.hist.length - 1];
        if (!last || rev) return;
        rev = true;
        if (set.sound) DR.Sound.reveal();
        render();
        const a = last.r[k] && last.r[k][0] && last.r[k][0].a;
        if (a) { announce(a); speak(a); }
    }
    function openHidden(k) {
        open[k] = !open[k];
        render();
    }
    function nav(dir) {
        if (game.view !== 'abc') return;
        const st = stateOf(game.id);
        if (!st.hist.length) { spin(); return; }
        const m = stage.model;
        const n = m.abc.letters.length;
        const i = Math.max(0, Math.min(n, (st.extra.abc | 0) + dir));
        if (i >= n) { toast(t('Geschafft, das ganze Alphabet!'), { label: t('Neues Thema'), fn: () => spin() }); return; }
        st.extra.abc = i;
        saveState(game.id);
        render();
        if (set.sound) DR.Sound.tick();
        speak(m.abc.letters[i]);
    }
    function tap(dir, power) {
        if (game.view === 'abc' && stateOf(game.id).hist.length && !dir) { nav(1); return; }
        const st = stateOf(game.id), last = st.hist[st.hist.length - 1];
        // Zuerst die Auflösung zeigen, beim nächsten Antippen weiter
        if (!dir && last && !rev && last.r.length === 1 && last.r[0].length === 1 && last.r[0][0].a && !game.slots[0].hide) { reveal(0); return; }
        spin(dir, power);
    }
    function undo() {
        const st = stateOf(game.id);
        if (!DR.undo(st)) return;
        st.extra.over = false;
        saveState(game.id);
        lastSpin = null; rev = false; open = {};
        render();
        toast(t('Letzte Drehung zurückgenommen'));
    }
    function newRound() {
        const st = stateOf(game.id);
        DR.reset(st);
        saveState(game.id);
        lastSpin = null; rev = false; open = {};
        stage.resetRot();
        render();
        toast(t('Neue Runde: alles ist wieder im Topf.'));
    }

    /* ---------- Vorführmodus: nur Rad und Ergebnis, randvoll, für Fernseher und Beamer ---------- */
    let wakeLock = null;
    async function wake(on) {
        try {
            if (on && set.wake && 'wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
            else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
        } catch (e) {}
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden && (showMode || set.wake)) wake(true); });
    function toggleShow(on) {
        on = on == null ? !showMode : on;
        if (on === showMode) return;
        showMode = on;
        document.body.classList.toggle('show', on);
        const fs = document.documentElement;
        try {
            if (on && fs.requestFullscreen && !document.fullscreenElement) fs.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
            else if (on && fs.webkitRequestFullscreen && !document.webkitFullscreenElement) fs.webkitRequestFullscreen();
            else if (!on && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
            else if (!on && document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
        } catch (e) {}
        wake(on || set.wake);
        applyLook();
        render();
        if (on && !set.tvTip) {
            set.tvTip = true; saveSet();
            toast(t('Vorführmodus: Antippen dreht, oben links geht es zurück. Für den Fernseher das iPad quer halten und die Drehsperre einschalten.'), null, 9000);
        }
    }
    const fsChange = () => { if (showMode && !document.fullscreenElement && !document.webkitFullscreenElement && fsWas) toggleShow(false); fsWas = !!(document.fullscreenElement || document.webkitFullscreenElement); };
    let fsWas = false;
    document.addEventListener('fullscreenchange', fsChange);
    document.addEventListener('webkitfullscreenchange', fsChange);

    /* ---------- Spiele auswählen ---------- */
    const FILTERS = [['all', N('Alle Spiele')], ['senioren', N('Senioren')], ['kinder', N('Kinder')], ['gruppe', N('Für Gruppen')], ['werkzeug', N('Werkzeuge')], ['own', N('Meine Räder')]];
    function showHome() {
        const grid = el('div.tiles');
        const chips = el('div.chips.filters', { role: 'tablist' });
        const paint = () => {
            chips.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.f === set.filter));
            grid.replaceChildren();
            const list = set.filter === 'own' ? [] : DR.GAMES.filter(g => set.filter === 'all' || g.tags.indexOf(set.filter) >= 0);
            for (const b of list) grid.append(tile(b.id, b.ic, t(b.name), t(b.desc)));
            if (set.filter === 'all' || set.filter === 'own') {
                for (const g of own) grid.append(tile(g.id, g.ic, g.name, ownDesc(g), true));
                grid.append(el('button.tile.new', { type: 'button', onclick: () => { s.close(); setTimeout(() => editOwn(null), 80); } },
                    el('span.ic', null, icon('plus')), el('span.txt', null, el('b', { text: t('Neues Rad') }), el('small', { text: t('Eigene Liste, Namen, Buchstaben, Zahlen oder mehrere Walzen') }))));
            }
        };
        const tile = (id, ic, name, desc, mine) => el('button.tile' + (game && game.id === id ? '.cur' : '') + (mine ? '.mine' : ''), { type: 'button', onclick: () => { s.close(); openGame(id); } },
            el('span.ic', null, icon(ic)), el('span.txt', null, el('b', { text: name }), el('small', { text: desc })));
        for (const [f, label] of FILTERS) chips.append(el('button.chip', { type: 'button', 'data-f': f, role: 'tab', onclick: () => { set.filter = f; saveSet(); paint(); } }, t(label)));
        const body = el('div.home', null, installBanner(), chips, grid);
        const s = sheet(t('Spiel wählen'), body, { cls: 'wide.full' });
        paint();
        if (!set.seen) { set.seen = true; saveSet(); }
    }
    const ownDesc = g => g.slots.map(s => s.label || t(SRC_NAMES[s.src.type] || '')).filter(Boolean).join(' · ') || t('Eigenes Rad');

    /* ---------- Menü ---------- */
    function showMenu() {
        let s;
        const go = fn => () => { s.close(); setTimeout(fn, 80); };
        s = sheet(t('Menü'), el('div.menu', null,
            menuItem('home', t('Spiel wählen'), go(showHome), t('Alle Spiele, Werkzeuge und eigene Räder')),
            menuItem('plus', t('Neues Rad'), go(() => editOwn(null)), t('Eigene Liste anlegen oder einfügen')),
            menuItem('people', t('Teilnehmer'), go(showNames), t('Namen für Wer ist dran, Gruppen und Ämter')),
            menuItem('sliders', t('Dieses Spiel anpassen'), go(showGameSettings), game ? game.name : ''),
            menuItem('expand', t('Vorführmodus'), go(() => toggleShow(true)), t('Vollbild für Fernseher, Beamer und Tablet')),
            menuItem('print', t('Drucken'), go(() => showPrint()), t('Bingo-Karten, Spielblätter, Listen und Rechenblätter als PDF')),
            menuItem('palette', t('Farben und Schrift'), go(showSettings), t('Farbwelten, eigene Farben, Schriftgrößen')),
            menuItem('save', t('Sicherung und Listen'), go(showData), t('Alles sichern, Listen importieren und exportieren')),
            menuItem('help', t('Hilfe'), go(showHelp)),
            !isApp() && !OFFLINE ? menuItem('install', t('Als App installieren'), go(showInstall), t('Kostenlos, ohne Werbung, auch offline')) : null,
            menuItem('heart', t('Über Drehsel und mehr'), go(showAbout), t('Weitere kostenlose Programme'))), { cls: 'narrow' });
    }

    /* ---------- Dieses Spiel anpassen ---------- */
    const SRC_NAMES = { items: N('Eigene Liste'), list: N('Eingebaute Liste'), names: N('Teilnehmer'), letters: N('Buchstaben'), numbers: N('Zahlen'), dice: N('Würfel'), math: N('Rechnen') };
    const RULE_OPTS = () => [['free', t('Mit Wiederholung'), t('alles bleibt im Topf')], ['cycle', t('Jeder einmal'), t('dann von vorn')], ['once', t('Nur einmal'), t('bis zur neuen Runde')]];
    function showGameSettings() {
        const g = game;
        const b = builtin(g.id);
        const body = el('div.gameset');
        const s = sheet(t('Anpassen: {n}', { n: g.name }), body, { onClose: () => render() });
        const paint = () => {
            const g = getGame(game.id);
            body.replaceChildren();
            if (g.desc) body.append(el('p.lead', { text: g.desc }));
            // Darstellung
            if (['wheel', 'reels', 'card'].indexOf(g.view) >= 0) {
                body.append(section(t('Darstellung'), seg([['wheel', t('Rad')], ['reels', t('Walzen')], ['card', t('Karte')]], g.view,
                    v => { patchGame(g.id, o => { o.view = v; }); lastSpin = null; paint(); }, 'c3'),
                note(t('Rad zum Zuschauen, Walzen für mehrere Dinge auf einmal, Karte für lange Texte wie Fragen.'))));
            }
            // Je Walze: Inhalt und Regeln
            g.slots.forEach((sl, k) => body.append(slotSection(g, sl, k, paint)));
            // Gruppen
            if (g.view === 'teams') body.append(section(t('Gruppen'), el('div.row', null, el('span', { text: t('Anzahl der Gruppen') }), stepper(g.groups || 2, 2, 12, v => patchGame(g.id, o => { o.groups = v; })))));
            // ABC-Runde
            if (g.view === 'abc') {
                const ex = g.abcEx != null ? g.abcEx : 'QXY';
                body.append(section(t('Buchstaben der ABC-Runde'), letterChips(alphabet(), ex, v => patchGame(g.id, o => { o.abcEx = v; })), note(t('Ausgegraute Buchstaben werden übersprungen.'))));
            }
            // Kategorien bei Stadt-Land-Fluss
            if (g.cats !== undefined || (b && b.cats)) {
                const opts = [['', t('Keine anzeigen')], ['slf-klassisch', t('Klassisch: Stadt, Land, Fluss …')], ['slf-senioren', t('Für Senioren')], ['slf-kinder', t('Für Kinder')]];
                const sel = el('select', { onchange: () => patchGame(g.id, o => { o.cats = sel.value || null; }) }, opts.map(([v, l]) => el('option', { value: v, selected: (g.cats || '') === v }, l)));
                body.append(section(t('Kategorien unter dem Ergebnis'), sel, el('div.btns', null, g.cats ? btn(t('Kategorien bearbeiten'), () => editBuiltinList(g.cats), 'edit') : null)));
            }
            // Sanduhr
            const tm = g.timer || { s: 0, auto: true };
            body.append(section(t('Sanduhr'), seg([[0, t('Aus')], [15, '15 s'], [30, '30 s'], [60, '1 min'], [90, '1½ min'], [120, '2 min'], [180, '3 min'], [300, '5 min']], tm.s,
                v => { patchGame(g.id, o => { o.timer = { s: +v, auto: tm.auto !== false }; }); paint(); }, 'c4'),
            tm.s ? toggle(t('Startet nach dem Drehen von selbst'), tm.auto !== false, v => patchGame(g.id, o => { o.timer = { s: tm.s, auto: v }; })) : null,
            tm.s ? note(t('Antippen startet und hält an, lange drücken setzt zurück.')) : null));
            // Vorlesen
            body.append(section(t('Ergebnis vorlesen'), seg([['', t('Wie eingestellt')], ['1', t('Immer')], ['0', t('Nie')]], g.say == null ? '' : g.say ? '1' : '0',
                v => patchGame(g.id, o => { o.say = v === '' ? null : v === '1'; }), 'c3')));
            // Runde, Kopie, Teilen
            const acts = el('div.btns');
            acts.append(btn(t('Drucken …'), () => { s.close(); setTimeout(() => showPrint(), 80); }, 'print'));
            acts.append(btn(t('Neue Runde'), () => { newRound(); }, 'undo'));
            if (b) acts.append(btn(t('Als eigenes Rad kopieren'), () => { s.close(); setTimeout(() => copyToOwn(g.id), 80); }, 'copy'));
            else acts.append(btn(t('Bearbeiten'), () => { s.close(); setTimeout(() => editOwn(g.id), 80); }, 'edit'));
            if (!OFFLINE) acts.append(btn(t('Per Link teilen'), () => shareGame(g.id), 'link'));
            acts.append(btn(t('Als Textdatei'), () => exportGames([g.id]), 'download'));
            if (b && ov[g.id]) acts.append(btn(t('Auf Standard zurücksetzen'), () => confirmDlg(t('Zurücksetzen?'), t('Alle Anpassungen an diesem Spiel gehen verloren. Ausgeblendete und ergänzte Einträge in den Listen bleiben.'), t('Zurücksetzen'), () => { delete ov[g.id]; saveOv(); lastSpin = null; render(); paint(); }), 'undo'));
            if (!b) acts.append(btn(t('Löschen'), () => confirmDlg(t('Rad löschen?'), t('„{n}“ wird von diesem Gerät gelöscht.', { n: g.name }), t('Löschen'), () => { own = own.filter(x => x.id !== g.id); saveOwn(); drop('st_' + g.id); s.close(); openGame('slf'); }), 'trash', 'danger'));
            body.append(section(t('Mehr'), acts));
        };
        paint();
    }
    function letterChips(letters, ex, onchange) {
        const box = el('div.letters');
        let cur = ex.toUpperCase();
        for (const l of letters) {
            const b = el('button', { type: 'button', class: cur.indexOf(l) >= 0 ? 'off' : '', text: l, 'aria-pressed': String(cur.indexOf(l) < 0) });
            b.addEventListener('click', () => {
                cur = cur.indexOf(l) >= 0 ? cur.replace(l, '') : cur + l;
                b.classList.toggle('off', cur.indexOf(l) >= 0);
                b.setAttribute('aria-pressed', String(cur.indexOf(l) < 0));
                onchange(cur);
            });
            box.append(b);
        }
        return box;
    }
    function slotSection(g, sl, k, repaint) {
        const sec = el('section.sec.slot');
        const head = g.slots.length > 1 ? (sl.label || t('Walze {n}', { n: k + 1 })) : t('Inhalt');
        sec.append(el('h3', { text: head }));
        const src = sl.src;
        const items = DR.endless(sl) ? [] : DR.itemsOf(sl, ctx);
        if (src.type === 'list') {
            const l = baseList(src.list);
            sec.append(el('div.row', null, el('span', { text: t('{n} Einträge', { n: items.length }) + (l ? ' · ' + l.name : '') }), btn(t('Bearbeiten'), () => editBuiltinList(src.list), 'edit')));
        } else if (src.type === 'items') {
            sec.append(el('div.row', null, el('span', { text: t('{n} Einträge', { n: items.length }) }), btn(t('Bearbeiten'), () => editOwn(g.id), 'edit')));
        } else if (src.type === 'names') {
            sec.append(el('div.row', null, el('span', { text: t('{n} Namen', { n: names.length }) }), btn(t('Namen bearbeiten'), showNames, 'people')));
        } else if (src.type === 'letters') {
            const ex = src.ex || '';
            const all = alphabet().concat(src.um ? extraLetters() : []);
            sec.append(letterChips(all, ex, v => patchGame(g.id, (o, isB) => { srcPatch(o, isB, k).ex = v; })));
            const quick = el('div.btns.small', null,
                btn(t('Alle'), () => { patchGame(g.id, (o, isB) => { srcPatch(o, isB, k).ex = ''; }); repaint(); }),
                btn(t('Ohne Q, X, Y'), () => { patchGame(g.id, (o, isB) => { srcPatch(o, isB, k).ex = 'QXY'; }); repaint(); }),
                btn(t('Nur leichte'), () => { patchGame(g.id, (o, isB) => { srcPatch(o, isB, k).ex = 'CJQVXY'; }); repaint(); }));
            sec.append(quick, note(t('Ausgegraute Buchstaben bleiben draußen. Antippen schaltet um.')));
            if (extraLetters().length) sec.append(toggle(t('Mit Umlauten (Ä, Ö, Ü)'), !!src.um, v => { patchGame(g.id, (o, isB) => { srcPatch(o, isB, k).um = v; }); repaint(); }));
        } else if (src.type === 'numbers') {
            const setN = (key, v) => patchGame(g.id, (o, isB) => { srcPatch(o, isB, k)[key] = v; });
            sec.append(el('div.nums', null,
                field(t('Von'), stepper(src.from, -9999, 99999, v => setN('from', v))),
                field(t('Bis'), stepper(src.to, -9999, 99999, v => setN('to', v))),
                field(t('Schrittweite'), stepper(src.step || 1, 1, 1000, v => setN('step', v)))));
            sec.append(el('div.btns.small', null,
                btn('1–6', () => { patchGame(g.id, (o, isB) => Object.assign(srcPatch(o, isB, k), { from: 1, to: 6, step: 1, bingo: false })); repaint(); }),
                btn('1–10', () => { patchGame(g.id, (o, isB) => Object.assign(srcPatch(o, isB, k), { from: 1, to: 10, step: 1, bingo: false })); repaint(); }),
                btn('1–49', () => { patchGame(g.id, (o, isB) => Object.assign(srcPatch(o, isB, k), { from: 1, to: 49, step: 1, bingo: false })); repaint(); }),
                btn(t('Bingo 1–75'), () => { patchGame(g.id, (o, isB) => Object.assign(srcPatch(o, isB, k), { from: 1, to: 75, step: 1, bingo: true })); repaint(); }),
                btn('1–90', () => { patchGame(g.id, (o, isB) => Object.assign(srcPatch(o, isB, k), { from: 1, to: 90, step: 1, bingo: false })); repaint(); })));
            sec.append(note(t('{n} Zahlen', { n: items.length })));
        } else if (src.type === 'dice') {
            sec.append(el('div.row', null, el('span', { text: t('Anzahl der Würfel') }), stepper(src.n || 1, 1, 9, v => patchGame(g.id, (o, isB) => { srcPatch(o, isB, k).n = v; }))));
        } else if (src.type === 'math') {
            const ops = src.ops || ['+'];
            const chips = el('div.chips');
            for (const [op, label] of [['+', t('Plus')], ['-', t('Minus')], ['×', t('Mal')], [':', t('Geteilt')]]) {
                chips.append(el('button.chip' + (ops.indexOf(op) >= 0 ? '.on' : ''), { type: 'button', onclick: () => {
                    const next = ops.indexOf(op) >= 0 ? ops.filter(x => x !== op) : ops.concat(op);
                    if (!next.length) return;
                    patchGame(g.id, (o, isB) => { srcPatch(o, isB, k).ops = next; }); repaint();
                } }, label));
            }
            sec.append(field(t('Rechenarten'), chips), field(t('Zahlenraum'), seg([[10, t('bis 10')], [20, t('bis 20')], [100, t('bis 100')], [1000, t('bis 1000')]], src.max || 20,
                v => patchGame(g.id, (o, isB) => { srcPatch(o, isB, k).max = +v; }), 'c4')));
        }
        // Regeln
        if (!DR.endless(sl) && g.view !== 'teams' && g.view !== 'duties') {
            sec.append(field(t('Ziehen'), seg(RULE_OPTS(), sl.rule || 'free', v => { patchGame(g.id, (o, isB) => { slotPatch(o, isB, k).rule = v; }); }, 'c3')));
            if (['wheel', 'reels', 'card'].indexOf(g.view) >= 0 && items.length > 2) {
                sec.append(el('div.row', null, el('span', { text: t('Wie viele auf einmal') }), stepper(sl.pick || 1, 1, Math.min(20, items.length), v => patchGame(g.id, (o, isB) => { slotPatch(o, isB, k).pick = v; }))));
            }
            if (src.type !== 'names') sec.append(toggle(t('Verdeckt'), !!sl.hide, v => patchGame(g.id, (o, isB) => { slotPatch(o, isB, k).hide = v; }), t('Erst Antippen zeigt das Ergebnis, etwa für Begriffe raten')));
        }
        return sec;
    }

    /* ---------- Eingebaute Liste bearbeiten: Einträge ausblenden und eigene ergänzen ---------- */
    function editBuiltinList(id) {
        const base = baseList(id);
        if (!base) return;
        const key = loKey(id);
        const o = lo[key] ? clone(lo[key]) : { off: [], add: [] };
        const off = new Set(o.off || []);
        const listBox = el('div.checklist');
        for (const it of base.items) {
            const cb = el('input', { type: 'checkbox', checked: !off.has(it.t), onchange: () => { if (cb.checked) off.delete(it.t); else off.add(it.t); } });
            listBox.append(el('label', null, cb, el('span', null, it.t, it.a ? el('small', { text: ' | ' + it.a }) : null)));
        }
        const add = el('textarea', { rows: 5, placeholder: t('Eigene Einträge, einer pro Zeile. „Frage | Antwort“ zeigt die Antwort erst beim Antippen.'), value: DR.itemsToText(o.add || []) });
        const commit = () => {
            const next = { off: Array.from(off), add: DR.parseItems(add.value) };
            if (!next.off.length && !next.add.length) delete lo[key]; else lo[key] = next;
            saveLo();
        };
        const body = el('div', null,
            note(t('Häkchen weg blendet einen Eintrag aus. Die eingebaute Liste selbst bleibt, Zurücksetzen holt alles wieder.')),
            el('div.btns.small', null,
                btn(t('Alle an'), () => { off.clear(); listBox.querySelectorAll('input').forEach(c => { c.checked = true; }); }),
                btn(t('Alle aus'), () => { base.items.forEach(x => off.add(x.t)); listBox.querySelectorAll('input').forEach(c => { c.checked = false; }); })),
            listBox,
            section(t('Eigene Einträge ergänzen'), add),
            el('div.btns', null,
                btn(t('Zurücksetzen'), () => { delete lo[key]; saveLo(); s.close(); }, 'undo'),
                btn(t('Fertig'), () => s.close(), 'check', 'primary')));
        const s = sheet(base.name, body, { onClose: () => { if (lo[key] !== undefined || off.size || add.value.trim()) commit(); lastSpin = null; render(); } });
    }

    /* ---------- Teilnehmer ---------- */
    function showNames() {
        const ta = el('textarea.names', { rows: 10, placeholder: t('Ein Name pro Zeile'), value: DR.itemsToText(names) });
        const count = el('p.note');
        const upd = () => { names = DR.parseItems(ta.value); count.textContent = t('{n} Namen', { n: names.length }); };
        ta.addEventListener('input', () => { upd(); saveNames(); });
        upd();
        const body = el('div', null,
            note(t('Die Namen gelten für „Wer ist dran?“, „Gruppen einteilen“ und „Ämter verteilen“ und bleiben nur auf diesem Gerät.')),
            ta, count,
            el('div.btns', null,
                btn(t('Sortieren'), () => { ta.value = DR.itemsToText(DR.parseItems(ta.value).sort((a, b) => a.t.localeCompare(b.t, set.lang))); upd(); saveNames(); }),
                btn(t('Aus Datei'), () => pickFile('.txt,.csv,text/plain', txt => { ta.value = (ta.value.trim() ? ta.value.trim() + '\n' : '') + DR.itemsToText(DR.parseItems(txt)); upd(); saveNames(); }), 'upload'),
                btn(t('Leeren'), () => confirmDlg(t('Alle Namen löschen?'), t('Die Liste der Teilnehmer wird geleert.'), t('Leeren'), () => { ta.value = ''; upd(); saveNames(); })),
                btn(t('Fertig'), () => s.close(), 'check', 'primary')));
        const s = sheet(t('Teilnehmer'), body, { cls: 'narrow', onClose: () => { saveNames(); lastSpin = null; render(); } });
        if (!isTouch()) ta.focus();
    }

    /* ---------- Eigenes Rad anlegen oder bearbeiten ---------- */
    const OWN_ICONS = ['wheel', 'list', 'star', 'heart', 'chat', 'quote', 'music', 'book', 'album', 'pen', 'person', 'people', 'run', 'chair', 'smile', 'grid', 'dice', 'calc', 'abc', 'globe'];
    function editOwn(id) {
        const orig = id ? own.find(g => g.id === id) : null;
        const g = orig ? clone(orig) : { id: null, name: '', ic: 'wheel', view: 'wheel', slots: [{ label: '', src: { type: 'items', items: [] }, rule: 'cycle' }] };
        const body = el('div.editor');
        const nameIn = el('input', { type: 'text', value: g.name, placeholder: t('Name des Rads'), maxlength: 60 });
        const icons = el('div.iconpick');
        const paintIcons = () => { icons.replaceChildren(); for (const ic of OWN_ICONS) icons.append(el('button', { type: 'button', class: ic === g.ic ? 'on' : '', 'aria-label': ic, onclick: () => { g.ic = ic; paintIcons(); } }, icon(ic))); };
        paintIcons();
        const slotsBox = el('div.slots');
        const tas = [];
        const paintSlots = () => {
            slotsBox.replaceChildren();
            tas.length = 0;
            g.slots.forEach((sl, k) => {
                const card = el('div.slotcard');
                const label = el('input', { type: 'text', value: sl.label || '', placeholder: g.slots.length > 1 ? t('Überschrift, z. B. Wer?') : t('Überschrift über dem Ergebnis (freiwillig)'), maxlength: 60, oninput: () => { sl.label = label.value; } });
                const type = el('select', { onchange: () => { sl.src = DR.cleanSrc({ type: type.value, from: 1, to: 10, n: 2, ops: ['+', '-'], max: 20 }); paintSlots(); } },
                    ['items', 'names', 'letters', 'numbers', 'dice', 'math'].map(v => el('option', { value: v, selected: sl.src.type === v }, t(SRC_NAMES[v]))));
                card.append(el('div.slothead', null, el('b', { text: g.slots.length > 1 ? t('Walze {n}', { n: k + 1 }) : t('Inhalt') }), type,
                    g.slots.length > 1 ? el('button.iconbtn', { type: 'button', 'aria-label': t('Walze entfernen'), title: t('Walze entfernen'), onclick: () => { g.slots.splice(k, 1); paintSlots(); } }, icon('trash')) : null), label);
                if (sl.src.type === 'items') {
                    const ta = el('textarea', { rows: 8, placeholder: t('Ein Eintrag pro Zeile.\nFrage | Antwort zeigt die Antwort erst beim Antippen.\nRot #e03131 gibt dem Feld eine eigene Farbe.'), value: DR.itemsToText(sl.src.items) });
                    const cnt = el('small.note');
                    const upd = () => { sl.src.items = DR.parseItems(ta.value); cnt.textContent = t('{n} Einträge', { n: sl.src.items.length }); };
                    ta.addEventListener('input', upd);
                    upd();
                    tas.push(ta);
                    const from = el('select', { onchange: () => {
                        const l = listFor(from.value);
                        if (l) { ta.value = (ta.value.trim() ? ta.value.trim() + '\n' : '') + DR.itemsToText(l.items); upd(); }
                        from.value = '';
                    } }, el('option', { value: '' }, t('Aus einer eingebauten Liste übernehmen …')), builtinListOptions());
                    card.append(ta, cnt, el('div.btns.small', null, btn(t('Textdatei öffnen'), () => pickFile('.txt,.csv,text/plain', txt => {
                        const got = DR.parseImport(txt, '');
                        const its = got.length ? got[0].slots.flatMap(s => s.items) : [];
                        ta.value = (ta.value.trim() ? ta.value.trim() + '\n' : '') + DR.itemsToText(its); upd();
                    }), 'upload')), from);
                } else if (sl.src.type === 'names') card.append(note(t('Nimmt die Teilnehmer, die unter Menü → Teilnehmer stehen.')));
                else card.append(note(t('Feineinstellungen wie Bereich, Buchstaben oder Rechenarten gibt es nach dem Speichern unter „Anpassen“.')));
                slotsBox.append(card);
            });
            if (g.slots.length < 6) slotsBox.append(btn(t('Weitere Walze dazu'), () => { g.slots.push({ label: '', src: { type: 'items', items: [] }, rule: 'cycle' }); if (g.view === 'wheel') g.view = 'reels'; paintSlots(); }, 'plus'));
        };
        paintSlots();
        body.append(field(t('Name'), nameIn), field(t('Symbol'), icons), slotsBox,
            note(t('Mehrere Walzen drehen gleichzeitig, zum Beispiel Wer? Wo? Was passiert? oder Buchstabe und Kategorie.')));
        const doSave = () => {
            g.name = nameIn.value.trim() || (g.slots[0] && g.slots[0].label) || t('Mein Rad');
            const clean = DR.cleanGame(Object.assign({}, g, { id: g.id || undefined }));
            if (!clean) { toast(t('Bitte mindestens eine Walze mit Inhalt anlegen.')); return; }
            if (clean.slots.some(s => s.src.type === 'items' && !s.src.items.length)) { toast(t('Eine Walze hat noch keine Einträge.')); return; }
            const i = own.findIndex(x => x.id === clean.id);
            if (i >= 0) own[i] = clean; else own.push(clean);
            saveOwn();
            s.close();
            openGame(clean.id);
            toast(t('Gespeichert. Feineinstellungen gibt es oben unter „Anpassen“.'));
        };
        const s = sheet(orig ? t('Rad bearbeiten') : t('Neues Rad'), body, { cls: 'wide', sticky: true, foot: el('div.btns', null,
            btn(t('Abbrechen'), () => s.close()), btn(t('Speichern'), doSave, 'check', 'primary')) });
        if (!orig && !isTouch()) nameIn.focus();
    }
    function builtinListOptions() {
        const c = content[contentLang()] || {};
        return Object.keys(c).filter(id => !/^alphabet/.test(id)).map(id => el('option', { value: id }, c[id].name));
    }
    /** Eingebautes Spiel als eigenes Rad: alle Einträge (mit Änderungen) wandern mit, danach frei veränderbar */
    function materialize(g) {
        const out = clone(g);
        out.slots = g.slots.map(s => {
            const x = clone(s);
            if (s.src.type === 'list') x.src = { type: 'items', items: DR.itemsOf(s, ctx).map(it => Object.assign({}, it)) };
            return x;
        });
        delete out.builtin; delete out.own; delete out.desc; delete out.tags;
        if (out.cats) { out.note = (listFor(out.cats) || { items: [] }).items.map(x => x.t).join(' · '); delete out.cats; }
        return out;
    }
    function copyToOwn(id) {
        const g = materialize(getGame(id));
        g.id = undefined;
        g.name = t('{n} (eigene Fassung)', { n: g.name });
        const clean = DR.cleanGame(g);
        own.push(clean);
        saveOwn();
        openGame(clean.id);
        editOwn(clean.id);
    }

    /* ---------- Teilen per Link ---------- */
    async function shareGame(id) {
        const g = getGame(id);
        const data = DR.cleanGame(Object.assign(materialize(g), { id: undefined }));
        const code = await DR.encodeShare(data);
        const url = location.origin + location.pathname + '#d=' + code;
        const inp = el('input.link', { type: 'text', value: url, readonly: true, onclick: () => inp.select() });
        const body = el('div', null,
            el('p', { text: t('Wer diesen Link öffnet, kann „{n}“ mit allen Einträgen übernehmen. Der Inhalt steckt im Link selbst und wird nirgends gespeichert.', { n: g.name }) }),
            inp,
            url.length > 6000 ? el('p.warn', { text: t('Der Link ist sehr lang. Manche Messenger kürzen so lange Links, dann lieber als Textdatei weitergeben.') }) : null,
            el('div.btns', null,
                navigator.share ? btn(t('Teilen'), () => navigator.share({ title: 'Drehsel: ' + g.name, url }).catch(() => {}), 'share', 'primary') : null,
                btn(t('Link kopieren'), async () => { try { await navigator.clipboard.writeText(url); toast(t('Link kopiert')); } catch (e) { inp.select(); document.execCommand && document.execCommand('copy'); toast(t('Link kopiert')); } }, 'copy')));
        sheet(t('Per Link teilen'), body, { cls: 'narrow' });
    }
    async function takeShared(code) {
        const g = await DR.decodeShare(code);
        if (!g) { toast(t('Dieser Link enthält kein Rad, das Drehsel lesen kann.')); return false; }
        const cnt = g.slots.map(s => (s.label ? s.label + ': ' : '') + (s.src.type === 'items' ? t('{n} Einträge', { n: s.src.items.length }) : t(SRC_NAMES[s.src.type]))).join(' · ');
        let s;
        s = sheet(t('Rad übernehmen?'), el('div', null,
            el('div.tile.cur.static', null, el('span.ic', null, icon(g.ic)), el('span.txt', null, el('b', { text: g.name }), el('small', { text: cnt }))),
            el('p', { text: t('Jemand hat dir dieses Rad geschickt. Es wird nur auf diesem Gerät gespeichert, unter „Meine Räder“.') }),
            el('div.btns', null, btn(t('Nein, danke'), () => s.close()), btn(t('Übernehmen und öffnen'), () => {
                g.id = undefined;
                const clean = DR.cleanGame(g);
                own.push(clean); saveOwn(); s.close(); openGame(clean.id); toast(t('„{n}“ steht jetzt unter Meine Räder.', { n: clean.name }));
            }, 'check', 'primary'))), { cls: 'narrow' });
        return true;
    }

    /* ---------- Verlauf ---------- */
    function showHistory() {
        const g = game, st = stateOf(g.id);
        const fmt = ts => new Date(ts).toLocaleTimeString(set.lang, { hour: '2-digit', minute: '2-digit' });
        const list = el('ol.histlist', { reversed: true });
        st.hist.slice().reverse().slice(0, 200).forEach(h => list.append(el('li', null, el('span', { text: resText(h.r, g) || '•••' }), el('small', { text: fmt(h.at) }))));
        let s;
        s = sheet(t('Verlauf'), el('div', null,
            st.hist.length ? list : note(t('Noch nichts gedreht.')),
            el('div.btns', null,
                st.hist.length && st.hist[st.hist.length - 1].b ? btn(t('Letzte zurücknehmen'), () => { s.close(); undo(); }, 'undo') : null,
                btn(t('Neue Runde'), () => { s.close(); newRound(); }, 'history', 'primary')),
            note(t('Neue Runde legt alles zurück in den Topf und leert den Verlauf.'))), { cls: 'narrow' });
    }

    /* ---------- Einstellungen: Sprache, Farben, Schrift, Drehen, Vorlesen, Vorführmodus ---------- */
    function swatch(c) {
        const s = el('span.swatch', { vars: { '--b': c.bg, '--c': c.card, '--a': c.acc, '--r': c.rim } });
        const w = el('span.mini');
        const segs = c.seg.concat(c.seg).slice(0, 8);
        w.style.setProperty('background', 'conic-gradient(' + segs.map((x, i) => x + ' ' + (i * 45) + 'deg ' + ((i + 1) * 45) + 'deg').join(', ') + ')');
        s.append(w, el('i'));
        return s;
    }
    function palPicker(mode) {
        const box = el('div.pals');
        const key = mode === 'dark' ? 'd' : 'l';
        const paint = () => box.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.id === set.look[key]));
        for (const [id, name, c] of L.PALS[mode]) {
            box.append(el('button.pal', { type: 'button', 'data-id': id, onclick: () => { set.look[key] = id; if (set.look.mode !== 'auto') set.look.mode = mode; saveSet(); applyLook(); render(); paint(); } }, swatch(c), el('b', { text: t(name) })));
        }
        const mine = set.look[mode === 'dark' ? 'cd' : 'cl'];
        box.append(el('button.pal', { type: 'button', 'data-id': 'eigen', onclick: () => editColors(mode, paint) }, swatch(L.cleanColors(mine, mode) || colorsFor(mode)), el('b', { text: t('Eigene …') })));
        paint();
        return box;
    }
    function showSettings() {
        const body = el('div.settings');
        const s = sheet(t('Farben und Schrift'), body, { onClose: () => render() });
        const paint = () => {
            body.replaceChildren(
                UI_LANGS.length > 1 ? section(t('Sprache'), seg(UI_LANGS.map(l => [l, langName(l)]), set.lang, async v => {
                    set.lang = v; saveSet(); await loadContent(contentLang()); applyTexts(); openGame(game.id, true); s.close();
                }, 'c3'), note(t('Sprache der Bedienung und der eingebauten Listen.'))) : null,
                section(t('Hell oder dunkel'), seg([['auto', t('Wie das Gerät')], ['light', t('Hell')], ['dark', t('Dunkel')]], set.look.mode, v => { set.look.mode = v; saveSet(); applyLook(); render(); }, 'c3')),
                section(t('Farbwelt für hell'), palPicker('light')),
                section(t('Farbwelt für dunkel'), palPicker('dark')),
                note(t('„Eigene …“ öffnet den Farbmischer. Die Schrift wird überall automatisch so eingestellt, dass sie gut lesbar bleibt.')),
                section(t('Schrift'), fontPicker(), el('div.btns', null, btn(t('Schriftgrößen und Stärke …'), showSizes, 'font'))),
                section(t('Drehen'),
                    field(t('Tempo'), seg([['slow', t('Gemütlich')], ['normal', t('Normal')], ['fast', t('Flott')], ['off', t('Sofort')]], set.speed, v => { set.speed = v; saveSet(); }, 'c4')),
                    toggle(t('Klicken und Klang'), set.sound, v => { set.sound = v; DR.Sound.on = v; saveSet(); }),
                    'vibrate' in navigator ? toggle(t('Vibration'), set.vib, v => { set.vib = v; saveSet(); }) : null),
                'speechSynthesis' in window ? section(t('Vorlesen'),
                    toggle(t('Ergebnis vorlesen'), set.say, v => { set.say = v; saveSet(); }, t('Über die Sprachausgabe des Geräts. Einzelne Spiele wie Bingo lesen immer vor, das lässt sich dort umstellen.')),
                    field(t('Sprechtempo'), seg([[.75, t('Langsam')], [.9, t('Ruhig')], [1, t('Normal')]], set.sayRate, v => { set.sayRate = +v; saveSet(); }, 'c3')),
                    el('div.btns', null, btn(t('Probe hören'), () => speak(t('So klingt die Ansage. Der Buchstabe ist M.'), true), 'sound'))) : null,
                section(t('Vorführmodus'),
                    toggle(t('Schwarzer Hintergrund'), set.black, v => { set.black = v; saveSet(); }, t('Am Fernseher verschmelzen dann die schwarzen Ränder mit dem Bild.')),
                    'wakeLock' in navigator ? toggle(t('Bildschirm bleibt an'), set.wake, v => { set.wake = v; saveSet(); wake(v); }) : null));
        };
        paint();
    }
    const FONTS = [['atkinson', 'Atkinson', N('Besonders deutlich, für schlechte Augen')], ['fibel', N('Fibel'), N('Wie in der Schule, für Leseanfänger')],
        ['lexend', 'Lexend', N('Breit und flüssig zu lesen')], ['nunito', 'Nunito', N('Rund und freundlich')], ['system', N('System'), N('Die Schrift des Geräts')]];
    function fontPicker() {
        const box = el('div.fonts');
        const paint = () => box.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.f === set.font));
        for (const [id, name, sub] of FONTS) box.append(el('button.fontbtn', { type: 'button', 'data-f': id, onclick: () => { set.font = id; saveSet(); applyLook(); render(); paint(); } },
            el('span.sample', { 'data-font': id, text: 'Aa Il1 Ä' }), el('b', { text: t(name) }), el('small', { text: t(sub) })));
        paint();
        return box;
    }
    const SIZES = [['ui', N('Bedienung'), .85, 1.6, N('Knöpfe, Menüs und Fenster')], ['res', N('Ergebnis'), .4, 1, N('Höchstens so viel von der freien Fläche')],
        ['wheel', N('Beschriftung im Rad'), .6, 1.5, ''], ['small', N('Nebentexte'), .8, 1.8, N('Überschriften, Verlauf und Hinweise')]];
    function showSizes() {
        const body = el('div.sizes');
        const prev = el('div.sizeprev', null, el('div.lab', { text: t('Buchstabe') }), el('div.big', { text: 'M' }), el('small', { text: t('Zuletzt') + ': K · B · R' }));
        body.append(prev);
        for (const [k, label, lo, hi, sub] of SIZES) {
            const out = el('b');
            const r = el('input', { type: 'range', min: String(lo * 100), max: String(hi * 100), step: '5', value: String(Math.round(set.fs[k] * 100)), 'aria-label': t(label) });
            const upd = () => { set.fs[k] = +r.value / 100; out.textContent = r.value + ' %'; saveSet(); applyLook(); };
            r.addEventListener('input', upd);
            out.textContent = r.value + ' %';
            body.append(el('label.sl', null, el('span.fsl', null, el('span', null, t(label), sub ? el('small', { text: t(sub) }) : null), out), r));
        }
        body.append(field(t('Stärke der Ergebnisse'), seg([[800, t('Fett')], [600, t('Halbfett')], [400, t('Normal')]], set.fw, v => { set.fw = +v; saveSet(); applyLook(); }, 'c3')),
            toggle(t('Ergebnisse in GROSSBUCHSTABEN'), set.caps, v => { set.caps = v; saveSet(); applyLook(); }),
            el('div.btns', null, btn(t('Zurücksetzen'), () => { set.fs = Object.assign({}, DEF.fs); set.fw = DEF.fw; set.caps = false; saveSet(); applyLook(); s.close(); showSizes(); }, 'undo'),
                btn(t('Fertig'), () => s.close(), 'check', 'primary')));
        const s = sheet(t('Schriftgrößen'), body, { cls: 'narrow', onClose: () => render() });
    }

    /* ---------- Farbmischer: alle Farben selbst einstellen, mit Vorschau und Kontrast-Automatik ---------- */
    function editColors(mode, after) {
        const key = mode === 'dark' ? 'cd' : 'cl';
        const start = L.cleanColors(set.look[key], mode) || clone(colorsFor(mode));
        const col = clone(start);
        const prevSet = { id: set.look[mode === 'dark' ? 'd' : 'l'], c: set.look[key] };
        let part = 'acc';
        const PARTS = () => L.PARTS.map(([k, n]) => [k, t(n)]).concat(col.seg.map((c, i) => ['s' + i, t('Feld {n}', { n: i + 1 })]));
        const get = p => p[0] === 's' && p.length <= 2 ? col.seg[+p.slice(1)] : col[p];
        const put = (p, v) => { if (p[0] === 's' && p.length <= 2) col.seg[+p.slice(1)] = v; else col[p] = v; };
        // Vorschau: kleines Rad, Ergebnis, Knopf
        const prev = el('div.colprev');
        const wbox = el('div.pwheel');
        const wheel = new DR.Wheel(wbox, {});
        const pres = el('div.pres', null, el('div.lab', { text: t('Buchstabe') }), el('div.big', { text: 'M' }), el('span.btn.primary.small', null, icon('play'), el('span', { text: t('Drehen') })));
        prev.append(wbox, pres);
        const tabs = el('div.parts');
        const hue = el('input', { type: 'range', min: 0, max: 360, step: 1, 'aria-label': t('Farbton') });
        const sat = el('input', { type: 'range', min: 0, max: 100, step: 1, 'aria-label': t('Sättigung') });
        const lig = el('input', { type: 'range', min: 0, max: 100, step: 1, 'aria-label': t('Helligkeit') });
        const sliders = el('div.sliders', null, el('label.sl.hue', null, t('Farbton'), hue), el('label.sl.sat', null, t('Sättigung'), sat), el('label.sl.lig', null, t('Helligkeit'), lig));
        const picker = el('input', { type: 'color', 'aria-label': t('Farbwähler') });
        const code = el('input.hex', { type: 'text', maxlength: 7, spellcheck: 'false', autocomplete: 'off', autocapitalize: 'none', 'aria-label': t('Farbcode') });
        const warn = el('p.warn', { hidden: true });
        const autoT = toggle(t('Schrift automatisch'), !!col.autoText, v => { col.autoText = v; show(); }, t('Fast Weiß oder fast Schwarz, je nachdem, was auf dem Hintergrund besser zu lesen ist'));
        const fromHsl = () => { put(part, L.hsl2hex([+hue.value, +sat.value, +lig.value])); show(true); };
        [hue, sat, lig].forEach(r => r.addEventListener('input', fromHsl));
        picker.addEventListener('input', () => { put(part, picker.value.toLowerCase()); show(); });
        code.addEventListener('change', () => {
            let v = code.value.trim().toLowerCase().replace(/^#/, '');
            if (/^[0-9a-f]{3}$/.test(v)) v = v.replace(/./g, '$&$&');
            if (/^[0-9a-f]{6}$/.test(v)) put(part, '#' + v);
            show();
        });
        function show(fromSlider) {
            const d = L.derive(col);
            for (const k in d) prev.style.setProperty(k, d[k]);
            wheel.set('ABCDEFGH'.split('').map(t => ({ t })), 2, { seg: col.seg, ink: L.segInk(col.seg), rim: col.rim, card: d['--card'], acc: col.acc, font: getComputedStyle(root).getPropertyValue('--ff'), weight: set.fw, scale: 1 });
            tabs.replaceChildren();
            for (const [k, name] of PARTS()) {
                const b = el('button.part' + (k === part ? '.on' : ''), { type: 'button', onclick: () => { part = k; show(); } }, el('i', { vars: { '--c': get(k) } }), el('span', { text: name }));
                tabs.append(b);
            }
            tabs.append(el('button.part.add', { type: 'button', title: t('Feldfarbe dazu'), onclick: () => { if (col.seg.length < 8) { col.seg.push(col.seg[col.seg.length % 2 ? 0 : 1] || '#cccccc'); part = 's' + (col.seg.length - 1); show(); } } }, icon('plus')));
            if (col.seg.length > 2) tabs.append(el('button.part.add', { type: 'button', title: t('Letzte Feldfarbe weg'), onclick: () => { col.seg.pop(); if (/^s\d$/.test(part) && +part.slice(1) >= col.seg.length) part = 'acc'; show(); } }, icon('minus')));
            const c = get(part);
            if (!fromSlider) { const [h, s, l] = L.hex2hsl(c); hue.value = h; sat.value = s; lig.value = l; }
            sliders.style.setProperty('--h', hue.value); sliders.style.setProperty('--s', sat.value + '%'); sliders.style.setProperty('--l', lig.value + '%');
            picker.value = c; code.value = c;
            autoT.style.display = part === 'text' ? '' : 'none';
            const bad = [];
            if (!col.autoText && L.contrast(col.text, col.card) < 4.5) bad.push(t('Schrift auf Flächen'));
            if (!col.autoText && L.contrast(col.text, col.bg) < 4.5) bad.push(t('Schrift auf Hintergrund'));
            warn.textContent = bad.length ? t('Schwer zu lesen: {x}. Die Kontrast-Automatik gleicht das in der App aus, schöner ist es mit mehr Unterschied.', { x: bad.join(', ') }) : '';
            warn.hidden = !bad.length;
            // Die App dahinter färbt sich gleich mit
            set.look[key] = clone(col);
            set.look[mode === 'dark' ? 'd' : 'l'] = 'eigen';
            applyLook();
        }
        const base = el('select', { onchange: () => { const c = L.palColors(base.value); if (c) { Object.assign(col, c); delete col.autoText; show(); } base.value = ''; } },
            el('option', { value: '' }, t('Von einer Farbwelt ausgehen …')),
            [['light', t('Hell')], ['dark', t('Dunkel')]].map(([m, g]) => el('optgroup', { label: g }, L.PALS[m].map(([id, name]) => el('option', { value: id }, t(name))))));
        const derive = btn(t('Radfarben aus dem Akzent'), () => {
            const [h, s] = L.hex2hsl(col.acc);
            const light = L.lum(col.card) > .3;
            col.seg = [col.acc, L.hsl2hex([h, Math.min(s, 35), light ? 92 : 82]), L.hsl2hex([(h + 150) % 360, Math.min(60, s), light ? 38 : 45]), L.hsl2hex([h, Math.min(s, 35), light ? 92 : 82])];
            show();
        }, 'wheel');
        const body = el('div.mixer', null, prev, tabs, sliders, el('div.pick', null, el('label.btn', null, picker, t('Farbwähler')), code), autoT, warn,
            el('div.btns', null, derive), field(t('Vorlage'), base),
            el('div.btns', null,
                btn(t('Verwerfen'), () => { set.look[mode === 'dark' ? 'd' : 'l'] = prevSet.id; set.look[key] = prevSet.c; saveSet(); applyLook(); s.close(); }, 'undo'),
                btn(t('Fertig'), () => s.close(), 'check', 'primary')));
        const s = sheet(mode === 'dark' ? t('Eigene Farben für dunkel') : t('Eigene Farben für hell'), body, { onClose: () => { saveSet(); applyLook(); render(); if (after) after(); } });
        if (set.look.mode !== 'auto' && set.look.mode !== mode) { set.look.mode = mode; }
        show();
    }

    /* ---------- Sicherung, Import und Export ---------- */
    function backupData() {
        const st = {};
        for (const g of DR.GAMES.concat(own)) { const x = load('st_' + g.id, null); if (x) st[g.id] = x; }
        return { app: 'drehsel', v: 1, at: new Date().toISOString(), set, own, ov, lo, names, st };
    }
    function restore(d) {
        if (!d || d.app !== 'drehsel') throw new Error('bad');
        const games = (Array.isArray(d.own) ? d.own : []).map(DR.cleanGame).filter(Boolean);
        for (const g of games) { const i = own.findIndex(x => x.id === g.id); if (i >= 0) own[i] = g; else own.push(g); }
        saveOwn();
        if (d.ov && typeof d.ov === 'object') { ov = Object.assign(ov, d.ov); saveOv(); }
        if (d.lo && typeof d.lo === 'object') { lo = Object.assign(lo, d.lo); saveLo(); }
        if (Array.isArray(d.names) && d.names.length) { names = DR.parseItems(d.names.map(x => DR.itemLine(x)).join('\n')); saveNames(); }
        if (d.set && typeof d.set === 'object') {
            for (const k in DEF) if (d.set[k] !== undefined && typeof d.set[k] === typeof DEF[k]) set[k] = d.set[k];
            set.look = Object.assign({}, DEF.look, set.look); set.fs = Object.assign({}, DEF.fs, set.fs);
            saveSet();
        }
        if (d.st && typeof d.st === 'object') for (const id in d.st) if (/^[\w-]{1,40}$/.test(id)) { save('st_' + id, d.st[id]); delete states[id]; }
        return games.length;
    }
    function exportGames(ids) {
        const games = ids.map(getGame).filter(Boolean);
        const text = '# Drehsel ' + root.dataset.v + ' · ' + new Date().toLocaleDateString(set.lang) + '\n' + DR.exportText(games, (g, i) => DR.endless(g.slots[i]) || g.slots[i].src.type === 'numbers' || g.slots[i].src.type === 'letters' ? null : DR.itemsOf(g.slots[i], ctx));
        shareOrDownload(new Blob([text], { type: 'text/plain;charset=utf-8' }), (games.length === 1 ? slug(games[0].name) : 'drehsel-listen') + '.txt');
    }
    function importText(text, fname) {
        let games = [];
        const tr = text.trim();
        if (tr[0] === '{') {
            try {
                const d = JSON.parse(tr);
                if (d.app === 'drehsel') { const n = restore(d); applyLook(); render(); toast(t('Sicherung geladen: {n} eigene Räder.', { n })); return; }
                const g = DR.cleanGame(d); if (g) games = [g];
            } catch (e) {}
        } else {
            games = DR.parseImport(text, (fname || '').replace(/\.[a-z0-9]+$/i, '') || t('Importiert')).map(x => DR.cleanGame({
                name: x.name, ic: 'list', view: x.slots.length > 1 ? 'reels' : (x.slots[0].items.some(i => i.t.length > 24) ? 'card' : 'wheel'),
                slots: x.slots.map(s => ({ label: x.slots.length > 1 ? s.label : '', src: { type: 'items', items: s.items }, rule: 'cycle' })),
            })).filter(Boolean);
        }
        if (!games.length) { toast(t('Darin wurde nichts gefunden, das nach einer Liste aussieht.')); return; }
        let s;
        const list = el('ul.found', null, games.map(g => el('li', null, el('b', { text: g.name }), el('small', { text: ' · ' + g.slots.map(sl => t('{n} Einträge', { n: sl.src.items ? sl.src.items.length : 0 })).join(', ') }))));
        s = sheet(t('Importieren'), el('div', null, el('p', { text: t('Gefunden:') }), list,
            el('div.btns', null, btn(t('Abbrechen'), () => s.close()), btn(t('Als eigene Räder übernehmen'), () => {
                for (const g of games) { g.id = DR.cleanGame(Object.assign({}, g, { id: undefined })).id; own.push(g); }
                saveOwn(); s.close(); openGame(games[0].id); toast(t('{n} Räder übernommen. Sie stehen unter „Meine Räder“.', { n: games.length }));
            }, 'check', 'primary'))), { cls: 'narrow' });
    }
    function showData() {
        const paste = el('textarea', { rows: 6, placeholder: t('Liste hier einfügen: ein Eintrag pro Zeile, oder [Name] als Überschrift für mehrere Listen.') });
        let s;
        s = sheet(t('Sicherung und Listen'), el('div', null,
            section(t('Alles sichern'),
                note(t('Eigene Räder, Anpassungen, Teilnehmer, Einstellungen und Spielstände liegen nur auf diesem Gerät. Eine Sicherung als Datei nimmt alles mit, etwa auf ein anderes Gerät oder vom Browser in die installierte App.')),
                el('div.btns', null,
                    btn(t('Sicherung speichern'), () => shareOrDownload(new Blob([JSON.stringify(backupData(), null, 1)], { type: 'application/json' }), 'drehsel-sicherung-' + today() + '.json'), 'download', 'primary'),
                    btn(t('Sicherung laden'), () => pickFile('.json,application/json', txt => { try { const n = restore(JSON.parse(txt)); s.close(); applyLook(); applyTexts(); render(); toast(t('Sicherung geladen: {n} eigene Räder.', { n })); } catch (e) { toast(t('Das ist keine Sicherung von Drehsel.')); } }), 'upload'))),
            section(t('Listen importieren'),
                note(t('Textdatei (.txt oder .csv) mit einem Eintrag pro Zeile. Zwei Spalten aus Excel werden zu Frage und Antwort. Mit [Name] als Überschrift werden es mehrere Listen, mit == Name == ein Rad mit mehreren Walzen.')),
                el('div.btns', null, btn(t('Datei öffnen'), () => pickFile('.txt,.csv,.json,text/plain,application/json', (txt, n) => { s.close(); importText(txt, n); }), 'upload')),
                paste, el('div.btns', null, btn(t('Eingefügtes übernehmen'), () => { if (paste.value.trim()) { s.close(); importText(paste.value, t('Eingefügt')); } }, 'check'))),
            section(t('Listen exportieren'),
                note(t('Alle eigenen Räder als Textdatei, zum Bearbeiten in jedem Programm und zum Weitergeben.')),
                el('div.btns', null, btn(t('Meine Räder als Text'), () => { if (!own.length) { toast(t('Noch keine eigenen Räder.')); return; } exportGames(own.map(g => g.id)); }, 'download'))),
            section(t('Neu anfangen'), el('div.btns', null, btn(t('Alles auf diesem Gerät löschen'), () => confirmDlg(t('Wirklich alles löschen?'), t('Eigene Räder, Teilnehmer, Anpassungen, Einstellungen und Spielstände werden von diesem Gerät gelöscht. Vorher am besten eine Sicherung speichern.'), t('Alles löschen'), () => {
                Object.keys(localStorage).filter(k => k.startsWith('dr_')).forEach(k => localStorage.removeItem(k));
                location.reload();
            }), 'trash', 'danger')))), { cls: 'narrow' });
    }

    /* ---------- Drucken: Bingo-Karten (jede anders), Stadt-Land-Fluss-Blatt, Listen, Karten zum Ausschneiden, Rechenblätter ---------- */
    const PRINT_KINDS = [['bingo', N('Bingo-Karten')], ['slf', N('Stadt-Land-Fluss')], ['list', N('Liste')], ['cards', N('Karten')], ['math', N('Rechenblätter')]];
    let pr = Object.assign({ count: 12, perPage: 2, size: 4, free: true, name: true, caller: true, classic: true, rows: 8, copies: 1, cats: 'slf-klassisch', catN: 7,
        catMix: false, points: true, answers: 'end', textSize: 14, cols: 1, num: false, check: false, per: 8, cardAns: true, sheets: 5, tasks: 20, solutions: true,
        ops: ['+', '-'], max: 20 }, load('print', {}));
    function printKind(g) {
        if (g.view === 'bingo') return 'bingo';
        if (/^slf/.test(g.id) || g.cats) return 'slf';
        if (g.slots.some(s => s.src.type === 'math')) return 'math';
        if (g.view === 'card' || g.slots.some(s => s.hide)) return 'cards';
        return 'list';
    }
    /** Woher die Einträge kommen können: die Walzen dieses Spiels, eigene Räder, eingebaute Listen */
    function printSources() {
        const out = [];
        const add = (g, mine) => g.slots.forEach((s, k) => {
            if (DR.endless(s)) return;
            out.push(['g:' + g.id + ':' + k, (mine ? '' : '') + g.name + (g.slots.length > 1 ? ' · ' + (s.label || k + 1) : ''), () => DR.itemsOf(s, ctx)]);
        });
        add(game, true);
        for (const o of own) if (o.id !== game.id) add(getGame(o.id), true);
        const c = content[contentLang()] || {};
        for (const id of Object.keys(c)) if (!/^alphabet/.test(id)) out.push(['l:' + id, c[id].name, () => (listFor(id) || { items: [] }).items]);
        return out;
    }
    function showPrint(kind) {
        const g = game;
        const o = clone(pr);
        o.kind = kind || printKind(g);
        const mathSlot = g.slots.find(s => s.src.type === 'math');
        if (mathSlot) { o.ops = mathSlot.src.ops || o.ops; o.max = mathSlot.src.max || o.max; }
        const sources = printSources();
        o.src = sources[0] ? sources[0][0] : '';
        if (g.cats) o.cats = g.cats;
        const cv = el('canvas.preview', { title: t('Antippen macht die Vorschau größer') });
        const pager = el('div.pager');
        const warn = el('p.warn', { hidden: true });
        const info = el('p.note');
        const opts = el('div.popts');
        let page = 0, doc = null, timer2 = 0;
        const titleIn = el('input', { type: 'text', maxlength: 80 });
        const defaultTitle = () => o.kind === 'bingo' ? (o.classic && g.view === 'bingo' ? 'Bingo' : t('Bingo') + ': ' + srcName())
            : o.kind === 'slf' ? t('Stadt-Land-Fluss') : o.kind === 'math' ? t('Rechnen') : srcName();
        const srcName = () => { const s = sources.find(x => x[0] === o.src); return s ? s[1] : g.name; };
        const srcItems = () => { const s = sources.find(x => x[0] === o.src); return s ? s[2]() : []; };
        titleIn.addEventListener('input', () => { o.title = titleIn.value; later(); });
        const later = () => { clearTimeout(timer2); timer2 = setTimeout(build, 180); };
        function build() {
            const title = (o.title || '').trim() || defaultTitle();
            titleIn.placeholder = defaultTitle();
            warn.hidden = true; info.textContent = '';
            try {
                if (o.kind === 'bingo') {
                    const classic = o.classic && g.view === 'bingo' || (o.classic && o.src === 'classic');
                    const items = srcItems();
                    const r = classic ? DR.bingoCards({ classic: true, count: o.count }) : DR.bingoCards({ items, size: o.size, free: o.free, count: o.count });
                    if (r.short) { warn.textContent = t('Für {n} × {n} Felder braucht die Liste mindestens {k} Einträge, es sind {m}. Kleinere Karten wählen oder Einträge ergänzen.', { n: r.size, k: r.size * r.size - (r.free ? 1 : 0), m: items.length }); warn.hidden = false; doc = null; return paint(); }
                    if (r.cards.length < o.count) { warn.textContent = t('Aus diesen Einträgen gibt es nur {m} verschiedene Karten. Mehr Einträge oder kleinere Karten ergeben mehr.', { m: r.cards.length }); warn.hidden = false; }
                    info.textContent = t('Keine zwei Karten sind gleich, und jede unterscheidet sich möglichst stark von den anderen.');
                    const serie = Math.random().toString(36).slice(2, 6).toUpperCase();
                    doc = DR.print.bingo({ cards: r, classic, title, perPage: o.perPage, name: o.name, serie: t('Serie {s}', { s: serie }),
                        caller: o.caller ? (classic ? DR.range(75).map(i => ({ t: String(i + 1) })) : items) : null }, t);
                } else if (o.kind === 'slf') {
                    const l = listFor(o.cats);
                    let cats = l ? l.items.map(x => x.t) : [];
                    const n = Math.max(3, Math.min(10, o.catN | 0 || 7));
                    if (o.catMix || cats.length > 10) {
                        // Jedes Blatt eigene Kategorien: auch das wird nie zweimal gleich
                        const D = DR.pdf.doc({ title });
                        const copies = Math.max(1, o.copies | 0);
                        const docs = [];
                        for (let c = 0; c < copies; c++) docs.push(DR.print.slf({ cats: DR.shuffle(cats.slice()).slice(0, n), rows: o.rows, title, name: o.name, copies: 1, points: o.points }, t));
                        for (const d of docs) for (const P of d.list) D.list.push(P);
                        doc = D;
                        info.textContent = t('Jedes Blatt bekommt {n} zufällige Kategorien.', { n });
                    } else doc = DR.print.slf({ cats: cats.slice(0, 10), rows: o.rows, title, name: o.name, copies: o.copies, points: o.points }, t);
                } else if (o.kind === 'list') {
                    const items = srcItems();
                    doc = DR.print.plainList({ title, sub: t('{n} Einträge', { n: items.length }), items, answers: o.answers, size: o.textSize, cols: o.cols, num: o.num, check: o.check }, t);
                } else if (o.kind === 'cards') {
                    doc = DR.print.cards({ title, items: srcItems(), per: o.per, answers: o.cardAns }, t);
                } else {
                    const sheets = DR.mathSheets({ ops: o.ops, max: o.max, n: o.tasks, count: o.sheets });
                    info.textContent = t('Jedes Blatt hat andere Aufgaben.');
                    doc = DR.print.math({ sheets, title, name: o.name, solutions: o.solutions }, t);
                }
            } catch (e) { doc = null; warn.textContent = String(e && e.message || e); warn.hidden = false; }
            pr = Object.assign(pr, o); delete pr.title; delete pr.kind; delete pr.src;
            save('print', pr);
            paint();
        }
        function paint() {
            const box = cv.parentElement ? cv.parentElement.getBoundingClientRect() : { width: 320 };
            if (!doc || !doc.pages) { cv.hidden = true; pager.replaceChildren(); return; }
            cv.hidden = false;
            if (page >= doc.pages) page = 0;
            const big = cv.classList.contains('big');
            const PW = doc.W(page), PH = doc.H(page);
            const cssW = Math.min(big ? innerWidth - 40 : (PW > PH ? 460 : 340), box.width || 320);
            const cssH = cssW * PH / PW;
            const dpr = Math.min(3, devicePixelRatio || 1) * (big ? 1.5 : 1);
            cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
            cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
            const c2 = cv.getContext('2d');
            c2.setTransform(cv.width / PW, 0, 0, cv.height / PH, 0, 0);
            doc.draw(c2, page);
            pager.replaceChildren(
                el('button.iconbtn.small', { type: 'button', 'aria-label': t('Zurück'), disabled: page <= 0 || null, onclick: () => { page--; paint(); } }, icon('left')),
                el('span', { text: t('Seite {n} von {m}', { n: page + 1, m: doc.pages }) }),
                el('button.iconbtn.small', { type: 'button', 'aria-label': t('Weiter'), disabled: page >= doc.pages - 1 || null, onclick: () => { page++; paint(); } }, icon('right')));
        }
        cv.addEventListener('click', () => { cv.classList.toggle('big'); paint(); });
        const set2 = (k, v) => { o[k] = v; page = 0; later(); };
        const srcSel = () => {
            const sel = el('select', { onchange: () => { o.src = sel.value; o.title = ''; titleIn.value = ''; set2('src', sel.value); } },
                sources.map(([v, l]) => el('option', { value: v, selected: v === o.src }, l)));
            return field(t('Einträge aus'), sel);
        };
        function paintOpts() {
            opts.replaceChildren();
            const k = o.kind;
            if (k === 'bingo') {
                if (g.view === 'bingo') opts.append(seg([['1', t('Zahlen 1 bis 75')], ['0', t('Aus einer Liste')]], o.classic ? '1' : '0', v => { o.classic = v === '1'; paintOpts(); set2('classic', o.classic); }, 'c3'));
                if (!(o.classic && g.view === 'bingo')) {
                    opts.append(srcSel(), field(t('Felder'), seg([[3, '3 × 3'], [4, '4 × 4'], [5, '5 × 5']], o.size, v => { set2('size', +v); paintOpts(); }, 'c3')));
                    if (o.size % 2) opts.append(toggle(t('Freifeld in der Mitte'), o.free, v => set2('free', v)));
                }
                opts.append(el('div.row', null, el('span', { text: t('Wie viele Karten') }), stepper(o.count, 1, 200, v => set2('count', v))),
                    field(t('Karten pro Seite'), seg([[1, t('1 (groß)')], [2, '2'], [4, '4']], o.perPage, v => set2('perPage', +v), 'c3')),
                    toggle(t('Zeile für den Namen'), o.name, v => set2('name', v)),
                    toggle(t('Ziehliste für die Spielleitung'), o.caller, v => set2('caller', v), t('Alle Einträge zum Abhaken, als letzte Seite')));
            } else if (k === 'slf') {
                const sel = el('select', { onchange: () => set2('cats', sel.value) },
                    [['slf-klassisch', t('Klassisch: Stadt, Land, Fluss …')], ['slf-senioren', t('Für Senioren')], ['slf-kinder', t('Für Kinder')]].map(([v, l]) => el('option', { value: v, selected: o.cats === v }, l)));
                opts.append(field(t('Kategorien'), sel, el('div.btns.small', null, btn(t('Kategorien bearbeiten'), () => editBuiltinList(o.cats), 'edit'))),
                    toggle(t('Jedes Blatt andere Kategorien'), o.catMix, v => set2('catMix', v), t('Zufällig aus der Liste, so ist jede Runde neu')),
                    el('div.row', null, el('span', { text: t('Kategorien pro Blatt') }), stepper(o.catN, 3, 10, v => set2('catN', v))),
                    el('div.row', null, el('span', { text: t('Runden (Zeilen)') }), stepper(o.rows, 3, 20, v => set2('rows', v))),
                    el('div.row', null, el('span', { text: t('Wie viele Blätter') }), stepper(o.copies, 1, 60, v => set2('copies', v))),
                    toggle(t('Spalte für Punkte'), o.points, v => set2('points', v)), toggle(t('Zeile für Name und Datum'), o.name, v => set2('name', v)));
            } else if (k === 'list') {
                opts.append(srcSel(),
                    field(t('Schriftgröße'), seg([[12, t('Normal')], [16, t('Groß')], [22, t('Sehr groß')]], o.textSize, v => set2('textSize', +v), 'c3')),
                    field(t('Spalten'), seg([[1, '1'], [2, '2'], [3, '3']], o.cols, v => set2('cols', +v), 'c3')),
                    field(t('Auflösungen'), seg([['end', t('Am Ende')], ['inline', t('Darunter')], ['none', t('Ohne')]], o.answers, v => set2('answers', v), 'c3')),
                    toggle(t('Nummern'), o.num, v => set2('num', v)), toggle(t('Kästchen zum Abhaken'), o.check, v => set2('check', v)));
            } else if (k === 'cards') {
                opts.append(srcSel(), field(t('Karten pro Seite'), seg([[4, '4'], [6, '6'], [8, '8'], [12, '12']], o.per, v => set2('per', +v), 'c4')),
                    toggle(t('Auflösung auf der Karte'), o.cardAns, v => set2('cardAns', v), t('Klein unten, zum Umknicken')));
            } else {
                const chips = el('div.chips');
                for (const [op, label] of [['+', t('Plus')], ['-', t('Minus')], ['×', t('Mal')], [':', t('Geteilt')]]) {
                    chips.append(el('button.chip' + (o.ops.indexOf(op) >= 0 ? '.on' : ''), { type: 'button', onclick: () => {
                        const next = o.ops.indexOf(op) >= 0 ? o.ops.filter(x => x !== op) : o.ops.concat(op);
                        if (next.length) { o.ops = next; paintOpts(); later(); }
                    } }, label));
                }
                opts.append(field(t('Rechenarten'), chips),
                    field(t('Zahlenraum'), seg([[10, t('bis 10')], [20, t('bis 20')], [100, t('bis 100')], [1000, t('bis 1000')]], o.max, v => set2('max', +v), 'c4')),
                    el('div.row', null, el('span', { text: t('Wie viele Blätter') }), stepper(o.sheets, 1, 60, v => set2('sheets', v))),
                    el('div.row', null, el('span', { text: t('Aufgaben pro Blatt') }), stepper(o.tasks, 6, 40, v => set2('tasks', v), 2)),
                    toggle(t('Lösungen hinten'), o.solutions, v => set2('solutions', v)), toggle(t('Zeile für Name und Datum'), o.name, v => set2('name', v)));
            }
        }
        const kinds = seg(PRINT_KINDS.map(([v, l]) => [v, t(l)]), o.kind, v => { o.kind = v; o.title = ''; titleIn.value = ''; page = 0; paintOpts(); later(); }, 'c5');
        paintOpts();
        const fname = () => slug((o.title || '').trim() || defaultTitle()) + '.pdf';
        const blob = () => new Blob([doc.bytes()], { type: 'application/pdf' });
        const body = el('div.print', null, el('div.prevbox', null, cv, pager), warn, info,
            section(t('Was drucken?'), kinds), field(t('Überschrift'), titleIn), opts);
        const foot = el('div.btns', null,
            btn(t('Als PDF'), () => { if (doc) shareOrDownload(blob(), fname()); }, 'download', 'primary'),
            btn(t('Drucken'), () => { if (!doc) return; const u = URL.createObjectURL(blob()); const w = window.open(u, '_blank'); if (!w) download(blob(), fname()); setTimeout(() => URL.revokeObjectURL(u), 60000); }, 'print'));
        sheet(t('Drucken'), body, { cls: 'wide', foot });
        requestAnimationFrame(build);
    }

    /* ---------- Hilfe ---------- */
    function showHelp() {
        const p = text => el('p', { text });
        const dl = rows => el('dl', null, rows.map(([a, b]) => [el('dt', { text: a }), el('dd', { text: b })]));
        sheet(t('Hilfe'), el('div.help',
            null,
            el('h3', { text: t('So geht\'s') }),
            dl([[t('Drehen'), t('Auf „Drehen“ oben tippen, aufs Rad oder irgendwo auf die Fläche. Mit Schwung über das Rad wischen dreht in diese Richtung.')],
                [t('Schneller fertig'), t('Während es dreht, noch einmal antippen: dann steht das Ergebnis sofort da.')],
                [t('Auflösung'), t('Steht unter dem Ergebnis „Antippen für die Auflösung“, zeigt das erste Antippen die Antwort, das nächste dreht weiter.')],
                [t('Verdeckt'), t('Bei „Begriffe raten“ ist der Begriff verdeckt. Antippen deckt ihn auf und wieder zu, so sieht ihn nur, wer erklärt.')],
                [t('Sanduhr'), t('Antippen startet und hält an, lange drücken setzt zurück.')],
                [t('Rückgängig'), t('Unten rechts: die letzte Drehung zurücknehmen oder den Verlauf ansehen und eine neue Runde beginnen.')]]),
            el('h3', { text: t('Anpassen') }),
            p(t('Der Regler-Knopf oben öffnet die Einstellungen des Spiels: Darstellung (Rad, Walzen, Karte), welche Einträge drin sind, ob etwas wiederkommen darf, Sanduhr und Vorlesen. Eingebaute Listen lassen sich ergänzen und einzelne Einträge ausblenden.')),
            el('h3', { text: t('Eigene Listen') }),
            p(t('Menü → Neues Rad: Namen geben, Einträge eintippen oder einfügen, fertig. Unter Menü → Sicherung und Listen lassen sich Textdateien importieren und exportieren. Alles bleibt nur auf diesem Gerät.')),
            el('h3', { text: t('Fernseher, Beamer, Apple TV') }),
            p(t('Der Vorführmodus (Knopf mit den vier Ecken) zeigt nur noch Rad und Ergebnis, randvoll. Antippen dreht, oben links geht es zurück. Beim Spiegeln vom iPad auf den Fernseher das iPad quer halten und im Kontrollzentrum die Drehsperre einschalten. Das iPad hat ein anderes Format als der Fernseher, deshalb bleiben links und rechts Ränder. Mit schwarzem Hintergrund fallen sie kaum auf. Als App installiert verschwinden auch die Leisten des Browsers.')),
            p(t('Am Rechner mit Beamer drehen Leertaste, Enter und Pfeiltasten, also auch ein Präsentations-Klicker. F schaltet den Vorführmodus um, Esc beendet ihn.')),
            el('h3', { text: t('Gut lesbar') }),
            p(t('Unter Menü → Farben und Schrift gibt es fertige Farbwelten, einen Farbmischer für eigene Farben, fünf Schriften und Regler für die Größen. Die Schrift wird überall automatisch so eingestellt, dass sie auf ihrem Untergrund gut lesbar bleibt.'))), { cls: 'narrow' });
    }

    /* ---------- Über Drehsel und weitere Programme ---------- */
    function showAbout() {
        const a = (ic, label, sub, href) => el('a.mitem', { href, target: '_blank', rel: 'noopener' }, icon(ic), el('span', null, el('b', { text: label }), sub ? el('small', { text: sub }) : null));
        sheet(t('Über Drehsel'), el('div', null,
            el('div.about', null, el('img', { src: $('link[rel=icon]').href, alt: '', width: 72, height: 72 }),
                el('div', null, el('h3', { text: 'Drehsel' }), el('p.note', { text: t('Version {v}', { v: root.dataset.v }) }))),
            el('p', { text: t('Glücksrad, Losbox und Würfel für Spiele mit Senioren und Kindern. Kostenlos, ohne Werbung, ohne Anmeldung. Freie Software, die du auch selbst hosten kannst.') }),
            el('h3', { text: t('Mehr kostenlose Programme') }),
            el('div.menu', null,
                a('grid', 'Suchsel', t('Wortsuchrätsel mit eigenen Wörtern, zum Ausdrucken'), LINKS.suchsel),
                a('list', 'Kaufen', t('Gemeinsame Einkaufslisten zum Selbsthosten'), LINKS.kaufen[set.lang] || LINKS.kaufen.en),
                a('globe', 'tech.burnersen.de', t('Alle Programme und Anleitungen'), LINKS.web)),
            el('h3', { text: t('Drehsel') }),
            el('div.menu', null,
                OFFLINE || location.hostname !== 'drehsel.burnersen.de' ? a('play', t('Drehsel online'), 'drehsel.burnersen.de', LINKS.play) : null,
                a('github', t('Drehsel auf GitHub'), t('Quelltext, Anleitung zum Selbsthosten, Wünsche und Fehler melden'), LINKS.github),
                a('heart', t('Spendier mir einen Kaffee'), t('Drehsel ist kostenlos und entsteht in meiner Freizeit'), LINKS.kofi)),
            el('p.note', { text: t('Lizenz: GNU AGPL v3. Schriften: Atkinson Hyperlegible Next, Andika (als „Fibel“), Lexend und Nunito unter der SIL Open Font License.') })), { cls: 'narrow' });
    }

    /* ---------- Installieren ---------- */
    let installEvt = null;
    function isApp() {
        return ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'].some(m => matchMedia('(display-mode: ' + m + ')').matches) || navigator.standalone === true;
    }
    function platform() {
        const ua = navigator.userAgent;
        if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
        if (/Android/.test(ua)) return /Firefox/.test(ua) ? 'android-firefox' : 'android';
        if (/Firefox/.test(ua)) return 'firefox';
        if (/Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua)) return 'mac-safari';
        return 'desktop';
    }
    function steps(pf) {
        const S = {
            ios: [t('Tippe auf das Teilen-Symbol (Quadrat mit Pfeil nach oben), am iPhone unten, am iPad oben.'), t('Wähle „Zum Home-Bildschirm“. Eventuell erst etwas nach unten wischen.'), t('Tippe auf „Hinzufügen“. Fertig, Drehsel liegt jetzt bei deinen Apps.')],
            android: [t('Tippe oben rechts auf das Menü ⋮ des Browsers.'), t('Wähle „App installieren“ oder „Zum Startbildschirm hinzufügen“.'), t('Bestätige mit „Installieren“.')],
            'android-firefox': [t('Tippe auf das Menü ⋮ von Firefox.'), t('Wähle „Installieren“ oder „Zum Startbildschirm hinzufügen“.'), t('Bestätige, fertig.')],
            'mac-safari': [t('Klicke oben in der Menüleiste auf „Ablage“ (oder auf das Teilen-Symbol).'), t('Wähle „Zum Dock hinzufügen“.'), t('Klicke auf „Hinzufügen“. Drehsel startet jetzt wie jedes andere Programm.')],
            firefox: [t('Firefox kann Web-Apps am Rechner leider nicht überall installieren.'), t('Öffne diese Seite in Chrome, Edge oder Safari.'), t('Klicke dort in der Adresszeile auf das Installieren-Symbol.')],
            desktop: [t('Klicke rechts in der Adresszeile auf das Installieren-Symbol (Bildschirm mit Pfeil).'), t('Oder öffne das Menü ⋮ und wähle „Drehsel installieren“ bzw. „App installieren“.'), t('Bestätige mit „Installieren“. Drehsel bekommt ein eigenes Fenster und ein Symbol.')],
        };
        return S[pf] || S.desktop;
    }
    const BENEFITS = () => [t('Startet mit einem Fingertipp, ohne Browser-Leisten'), t('Läuft auch ohne Internet'), t('Kostenlos und ohne Werbung'), t('Deine Listen bleiben auf deinem Gerät')];
    function installBanner() {
        if (isApp() || OFFLINE) return null;
        return el('div.banner', null, el('img', { src: $('link[rel=icon]').href, alt: '', width: 44, height: 44 }),
            el('div.txt', null, el('b', { text: t('Drehsel als App') }), el('span', { text: t('Kostenlos, ohne Werbung, auch offline und randvoll auf dem Bildschirm.') })),
            btn(t('Installieren'), installNow, 'install', 'light'));
    }
    async function installNow() {
        if (installEvt) {
            installEvt.prompt();
            try { const r = await installEvt.userChoice; if (r && r.outcome === 'accepted') installEvt = null; } catch (e) {}
            return;
        }
        showInstall();
    }
    function showInstall() {
        const pf = platform();
        const names = { ios: 'iPhone / iPad', android: 'Android', 'android-firefox': 'Android (Firefox)', 'mac-safari': 'Mac (Safari)', firefox: 'Firefox', desktop: 'Chrome / Edge' };
        const ol = p => el('ol.steps', null, steps(p).map(x => el('li', { text: x })));
        sheet(t('Drehsel als App'), el('div.install', null,
            el('p.lead', { text: t('Mit einem Fingertipp auf deinem Home-Bildschirm oder Desktop. Kein App-Store, keine Anmeldung.') }),
            el('ul.benefits', null, BENEFITS().map(x => el('li', null, icon('check'), el('span', { text: x })))),
            installEvt ? btn(t('Jetzt installieren'), installNow, 'install', 'primary.big') : null,
            el('h3', { text: t('So geht\'s auf diesem Gerät') }), ol(pf),
            el('details', null, el('summary', { text: t('Anleitung für andere Geräte') }),
                ...Object.keys(names).filter(k => k !== pf).map(k => el('div', null, el('h4', { text: names[k] }), ol(k))))), { cls: 'narrow' });
    }
    addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
    addEventListener('appinstalled', () => { installEvt = null; toast(t('Installiert! Starte Drehsel ab jetzt über das Symbol auf deinem Home-Bildschirm oder Desktop.')); });

    /* ---------- Texte der festen Knöpfe ---------- */
    function applyTexts() {
        root.lang = set.lang;
        const lab = { menuBtn: t('Menü'), setBtn: t('Dieses Spiel anpassen'), showBtn: t('Vorführmodus') };
        for (const id in lab) { $('#' + id).setAttribute('aria-label', lab[id]); $('#' + id).title = lab[id]; }
        $('#menuBtn').replaceChildren(icon('menu'));
        $('#setBtn').replaceChildren(icon('sliders'));
        $('#showBtn').replaceChildren(icon('expand'));
        $('#stage').setAttribute('aria-label', t('Spielfläche'));
    }

    /* ---------- Service Worker: einmal laden, danach läuft alles ohne Netz ---------- */
    function registerSw() {
        if (OFFLINE || !('serviceWorker' in navigator)) return;
        const had = !!navigator.serviceWorker.controller;
        navigator.serviceWorker.register('./?action=sw', { scope: './' }).catch(() => {});
        let shown = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!had || shown) return;
            shown = true;
            if (!sheets.length && !busy) { location.reload(); return; }
            toast(t('Eine neue Version von Drehsel ist da.'), { label: t('Neu laden'), fn: () => location.reload() });
        });
        if (isApp() && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    }

    /* ---------- Tastatur: Leertaste, Enter, Pfeile und Präsentations-Klicker ---------- */
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { if (sheets.length) closeSheet(sheets[sheets.length - 1]); else if (showMode) toggleShow(false); return; }
        if (sheets.length || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '') || e.ctrlKey || e.metaKey || e.altKey) return;
        const k = e.key;
        if (game && game.view === 'abc' && stateOf(game.id).hist.length) {
            if (k === 'ArrowRight' || k === 'PageDown' || k === ' ' || k === 'ArrowDown') { e.preventDefault(); nav(1); return; }
            if (k === 'ArrowLeft' || k === 'PageUp' || k === 'ArrowUp') { e.preventDefault(); nav(-1); return; }
            if (k === 'Enter') { e.preventDefault(); spin(); return; }
        }
        if (k === ' ' || k === 'Enter' || k === 'PageDown' || k === 'ArrowRight' || k === 'ArrowDown') {
            if (document.activeElement && document.activeElement.closest && document.activeElement.closest('#top') && k !== 'PageDown') return;
            e.preventDefault(); tap();
        } else if (k === 'f' || k === 'F') toggleShow();
        else if (k === 'Backspace') { if (stateOf(game.id).hist.length) undo(); }
    });

    /* ---------- Start ---------- */
    async function init() {
        applyLook();
        applyTexts();
        stage = new DR.Stage($('#stage'), {
            t, colors: segColors, tap: (dir, p) => tap(dir, p), reveal, open: openHidden, nav, undo, history: showHistory,
            tick: () => { if (set.sound && set.speed !== 'off') DR.Sound.tick(); },
            resScale: () => set.fs.res,
            sample: k => { const s = game.slots[k]; return s.src.type === 'math' ? DR.mathTask(s.src).t : s.src.type === 'dice' ? DR.rollDice(s.src.n).t : '?'; },
        });
        DR.Sound.on = set.sound;
        $('#menuBtn').addEventListener('click', showMenu);
        $('#titleBtn').addEventListener('click', showHome);
        $('#setBtn').addEventListener('click', showGameSettings);
        $('#showBtn').addEventListener('click', () => toggleShow());
        $('#spinBtn').addEventListener('click', () => { if (busy) { stage.finishAll(); return; } spin(); });
        $('#toast').addEventListener('click', e => { if (!e.target.closest('button')) { $('#toast').hidden = true; clearTimeout(toastT); } });
        await loadContent(contentLang());
        if (document.fonts) { document.fonts.ready.then(() => stage.layout()); document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', () => stage.layout()); }
        registerSw();
        if (set.wake && isApp()) wake(true);
        // Geteiltes Rad aus dem Link
        const m = /^#d=([A-Za-z0-9_-]+)$/.exec(location.hash);
        if (m) history.replaceState(null, '', location.pathname + location.search);
        await openGame(set.cur, true);
        if (m) await takeShared(m[1]);
        else if (!set.seen) showHome();
        // Ohne Netz geladen? Dann die anderen Sprachen später nachholen
        for (const l of Object.keys(LIST_URLS)) if (l !== contentLang()) setTimeout(() => loadContent(l), 3000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
