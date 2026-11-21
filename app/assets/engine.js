/* Drehsel – die Logik ohne Bildschirm: Zufall, Listen lesen und schreiben, Quellen (Liste, Buchstaben, Zahlen, Würfel, Rechnen),
   Ziehen mit und ohne Zurücklegen, Verlauf und Rückgängig, Gruppen und Ämter, Teilen per Link, eingebaute Spiele.
   Läuft im Browser (window.DR) und zum Testen auch in Node (module.exports). */
(function (G) {
    'use strict';
    const DR = G.DR = G.DR || {};

    /* ---------- Zufall: echter Zufall des Geräts, ohne Häufungen durch Modulo ---------- */
    const cr = G.crypto && G.crypto.getRandomValues ? G.crypto : null;
    const buf = new Uint32Array(1);
    function rnd(n) {
        if (!(n > 0)) return 0;
        if (!cr) return Math.floor(Math.random() * n);
        const lim = Math.floor(0x100000000 / n) * n;
        let x;
        do { cr.getRandomValues(buf); x = buf[0]; } while (x >= lim);
        return x % n;
    }
    const rndReal = () => rnd(1 << 30) / (1 << 30);
    function shuffle(a) {
        for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; }
        return a;
    }
    const range = n => Array.from({ length: n }, (_, i) => i);

    /* ---------- Einträge lesen ---------- */
    const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
    const BULLET = /^\s*(?:[-*•·▪◦–—]|\d{1,3}[.)]|\[[ xX✓]?\]|[☐☑✓✔])\s+/;
    /** Eine Zeile: „Text | Auflösung #rrggbb“. Spiegelstriche, Nummern und Kästchen vorn fallen weg, ein Tab trennt wie „|“. */
    function parseLine(line) {
        let s = String(line).replace(/\r/g, '').replace(BULLET, '');
        let c;
        const cm = /\s#([0-9a-fA-F]{6})\s*$/.exec(s);
        if (cm) { c = '#' + cm[1].toLowerCase(); s = s.slice(0, cm.index); }
        let a;
        const p = s.indexOf('|') >= 0 ? s.indexOf('|') : s.indexOf('\t');
        if (p >= 0) { a = clip(s.slice(p + 1).replace(/\t/g, ' '), 300); s = s.slice(0, p); }
        const t = clip(s, 200);
        if (!t) return null;
        const it = { t };
        if (a) it.a = a;
        if (c) it.c = c;
        return it;
    }
    /** Viele Einträge aus Text: eine Zeile pro Eintrag. Steht alles in einer Zeile, trennen Komma und Semikolon. */
    function parseItems(text) {
        let lines = String(text || '').split(/\n/).filter(l => l.trim() && !/^\s*#(?![0-9a-fA-F]{6}\s*$)\s/.test(l));
        if (lines.length === 1 && /[,;]/.test(lines[0]) && !/[|\t]/.test(lines[0])) lines = lines[0].split(/[,;]/);
        const out = [];
        for (const l of lines) { const it = parseLine(l); if (it) out.push(it); if (out.length >= 5000) break; }
        return out;
    }
    const itemLine = it => it.t + (it.a ? ' | ' + it.a : '') + (it.c ? ' ' + it.c : '');
    const itemsToText = items => (items || []).map(itemLine).join('\n');

    /** Die eingebauten Listen einer Sprache (app/lists/xx.txt): „[id] Name“ beginnt eine Liste, darunter ein Eintrag pro Zeile.
        Zeilen mit # am Anfang sind Bemerkungen. */
    function parseContent(text) {
        const lists = {};
        let cur = null;
        for (const raw of String(text || '').split('\n')) {
            const line = raw.replace(/\r/g, '');
            if (!line.trim() || /^\s*#\s/.test(line) || /^\s*#$/.test(line) || /^==.*==\s*$/.test(line.trim())) continue;
            const m = /^\[([a-z0-9][a-z0-9-]*)\]\s*(.*)$/.exec(line.trim());
            if (m) { cur = lists[m[1]] = { id: m[1], name: m[2].trim() || m[1], items: [] }; continue; }
            if (!cur) continue;
            const it = parseLine(line);
            if (it) cur.items.push(it);
        }
        return lists;
    }

    /** Eigene Listen aus einer Textdatei oder eingefügtem Text.
        „== Name ==“ beginnt ein Rad mit mehreren Walzen, „[Name]“ eine Liste (eine Walze), darunter die Einträge.
        Ohne Überschriften wird alles eine einzige Liste. Ergebnis: [{ name, slots: [{ label, items }] }] */
    function parseImport(text, fallbackName) {
        const games = [];
        let game = null, slot = null, multi = false;
        const newGame = (name, m) => { game = { name: clip(name, 60) || fallbackName || 'Liste', slots: [] }; multi = m; games.push(game); slot = null; };
        for (const raw of String(text || '').replace(/^﻿/, '').split('\n')) {
            const line = raw.replace(/\r/g, '').trim();
            if (!line || /^#(\s|$)/.test(line)) continue;
            let m = /^==+\s*(.*?)\s*==+$/.exec(line);
            if (m) { newGame(m[1], true); continue; }
            m = /^\[([^\]]{1,80})\]\s*(.*)$/.exec(line);
            if (m) {
                const label = clip(/^[a-z0-9][a-z0-9-]*$/.test(m[1]) && m[2] ? m[2] : m[1] + (m[2] ? ' ' + m[2] : ''), 60);
                if (!game || !multi) newGame(label, false);
                slot = { label, items: [] };
                game.slots.push(slot);
                continue;
            }
            if (!game) newGame(fallbackName, false);
            if (!slot) { slot = { label: game.name, items: [] }; game.slots.push(slot); }
            slot.items.push(line);
        }
        for (const g of games) for (const s of g.slots) s.items = parseItems(s.items.join('\n'));
        return games.map(g => ({ name: g.name, slots: g.slots.filter(s => s.items.length) })).filter(g => g.slots.length);
    }
    /** Räder als Text (nur die Listen darin), so wie parseImport es wieder einliest */
    function exportText(games, resolve) {
        const out = [];
        for (const g of games) {
            const slots = g.slots.map((s, i) => ({ label: s.label || g.name, items: resolve(g, i) })).filter(s => s.items && s.items.length);
            if (!slots.length) continue;
            if (slots.length > 1) {
                out.push('== ' + g.name + ' ==');
                for (const s of slots) out.push('[' + s.label + ']', itemsToText(s.items), '');
            } else out.push('[' + g.name + ']', itemsToText(slots[0].items), '');
        }
        return out.join('\n').trim() + '\n';
    }

    /* ---------- Quellen: was auf einer Walze steht ---------- */
    const LETTER_RX = /\S+/g;
    /** Alle Einträge einer Walze. ctx: { list(id) → {items} | null, names() → items, alphabet() → [Buchstaben], extra() → [Umlaute] } */
    function itemsOf(slot, ctx) {
        const s = slot.src || {};
        switch (s.type) {
            case 'items': {
                const items = Array.isArray(s.items) ? s.items : [];
                // abgewählte Einträge bleiben in der Liste stehen, werden aber nicht gezogen
                if (!Array.isArray(s.off) || !s.off.length) return items;
                const off = new Set(s.off);
                return items.filter(x => !off.has(x.t));
            }
            case 'list': { const l = ctx.list(s.list); return l ? l.items : []; }
            case 'names': return ctx.names();
            case 'letters': {
                const ex = String(s.ex || '').toUpperCase();
                const all = ctx.alphabet().concat(s.um ? ctx.extra() : []).filter(x => ex.indexOf(x.toUpperCase()) < 0);
                // Eigene Buchstaben oder Silben dazu, etwa SCH, ST oder EI
                for (const x of String(s.plus || '').split(/[\s,;]+/)) if (x && all.indexOf(x) < 0) all.push(x);
                return all.map(t => ({ t }));
            }
            case 'numbers': {
                const from = Math.round(+s.from || 0), to = Math.round(+s.to || 0), step = Math.max(1, Math.round(Math.abs(+s.step || 1)));
                const out = [];
                for (let v = Math.min(from, to); v <= Math.max(from, to) && out.length < 10000; v += step) {
                    const it = { t: String(v) };
                    if (s.bingo && v >= 1 && v <= 75) it.p = 'BINGO'[Math.floor((v - 1) / 15)];
                    out.push(it);
                }
                return out;
            }
            default: return [];
        }
    }
    const endless = slot => slot.src && (slot.src.type === 'dice' || slot.src.type === 'math');
    /** Kurze Prüfsumme der Einträge: ändert sich die Liste, fängt die Ziehung von vorn an */
    function sig(items) {
        let h = items.length;
        for (const it of items) for (let i = 0; i < it.t.length; i++) h = (h * 31 + it.t.charCodeAt(i)) | 0;
        return h;
    }

    /** Würfel: n Würfel mit 6 Augen */
    function rollDice(n) {
        const d = range(Math.max(1, Math.min(9, n | 0 || 1))).map(() => rnd(6) + 1);
        return { t: d.join(' '), d, sum: d.reduce((a, b) => a + b, 0) };
    }
    /** Rechenaufgabe: ops aus + − × :, max = Zahlenraum (10, 20, 100, 1000) */
    function mathTask(s) {
        const ops = (Array.isArray(s.ops) && s.ops.length ? s.ops : ['+']).filter(o => '+-×:'.indexOf(o) >= 0);
        const op = ops.length ? ops[rnd(ops.length)] : '+';
        const max = Math.max(5, Math.min(1000, +s.max || 20));
        const lo = max >= 10 ? 1 : 0;
        let a, b, r;
        if (op === '+') { a = lo + rnd(max - 2 * lo); b = lo + rnd(Math.max(1, max - a - lo + 1)); r = a + b; }
        else if (op === '-') { a = 1 + rnd(max); b = rnd(a + 1); r = a - b; }
        else if (op === '×') { const m = max <= 20 ? 5 : 10; a = 1 + rnd(m); b = 1 + rnd(max >= 100 ? 10 : m); r = a * b; }
        else { const m = max <= 20 ? 5 : 10; b = 1 + rnd(m); r = 1 + rnd(m); a = b * r; }
        return { t: a + ' ' + (op === '-' ? '−' : op) + ' ' + b, a: String(r), q: true };
    }

    /* ---------- Ziehen ----------
       state = { sig: [], pools: [[Index …] | null], last: [[Index …]], hist: [{ at, r, b }], done: false }
       Regeln je Walze: free = mit Zurücklegen, cycle = jeder einmal, dann von vorn, once = jeder nur einmal (bis zur neuen Runde). */
    const newState = () => ({ sig: [], pools: [], last: [], hist: [], extra: {} });
    function normState(st) {
        st = st && typeof st === 'object' ? st : {};
        return { sig: Array.isArray(st.sig) ? st.sig : [], pools: Array.isArray(st.pools) ? st.pools : [], last: Array.isArray(st.last) ? st.last : [],
            hist: Array.isArray(st.hist) ? st.hist.slice(-300) : [], extra: st.extra && typeof st.extra === 'object' ? st.extra : {} };
    }
    const snap = st => JSON.parse(JSON.stringify({ pools: st.pools, last: st.last, extra: st.extra || {} }));

    /** Wie viele Einträge einer Walze noch im Topf sind (null = unbegrenzt) */
    function left(game, st, k, ctx) {
        const slot = game.slots[k];
        if (!slot || endless(slot)) return null;
        const items = itemsOf(slot, ctx);
        const rule = slot.rule || 'free';
        if (rule === 'free') return { left: items.length, all: items.length };
        const pool = st.sig[k] === sig(items) && Array.isArray(st.pools[k]) ? st.pools[k].filter(i => i < items.length) : null;
        return { left: pool ? pool.length : items.length, all: items.length };
    }
    /** Was das Rad einer Walze gerade zeigt: bei jeder einmal / nur einmal die, die noch im Topf sind */
    function wheelItems(game, st, k, ctx) {
        const slot = game.slots[k];
        const items = itemsOf(slot, ctx);
        if ((slot.rule || 'free') === 'free' || st.sig[k] !== sig(items) || !Array.isArray(st.pools[k])) return range(items.length);
        const p = st.pools[k].filter(i => i < items.length).sort((a, b) => a - b);
        return p.length || slot.rule === 'once' ? p : range(items.length);
    }

    /** Eine Drehung. Liefert { r: [{ k, sel: [Eintrag + i], seg: [Indizes auf dem Rad], hit }], done } oder { empty: k } (Walze leer)
        bzw. { over: k } (bei „nur einmal“ ist alles gezogen).
        only: nur diese Walze neu ziehen, die anderen behalten ihr letztes Ergebnis (keep: true), ihr Topf bleibt unberührt. */
    function draw(game, st, ctx, only) {
        const before = snap(st);
        const out = [];
        const prev = st.hist[st.hist.length - 1];
        const keepOk = only != null && only >= 0 && only < game.slots.length && prev && Array.isArray(prev.r) && prev.r.length === game.slots.length;
        for (let k = 0; k < game.slots.length; k++) {
            const slot = game.slots[k];
            if (keepOk && k !== only && prev.r[k] && prev.r[k].length) {
                out.push({ k, sel: prev.r[k].map(x => Object.assign({}, x)), seg: null, hit: -1, keep: true });
                continue;
            }
            const pick = Math.max(1, Math.min(20, slot.pick | 0 || 1));
            if (endless(slot)) {
                const sel = [];
                for (let j = 0; j < pick; j++) {
                    let it;
                    for (let tries = 0; tries < 8; tries++) {
                        it = slot.src.type === 'dice' ? rollDice(slot.src.n) : mathTask(slot.src);
                        if (slot.src.type === 'dice' || !sel.concat(st.extra['m' + k] || []).some(x => x.t === it.t)) break;
                    }
                    sel.push(it);
                }
                if (slot.src.type === 'math') st.extra['m' + k] = sel.slice(-3);
                out.push({ k, sel, seg: null, hit: 0 });
                continue;
            }
            const items = itemsOf(slot, ctx);
            if (!items.length) return { empty: k };
            const sg = sig(items);
            if (st.sig[k] !== sg) { st.sig[k] = sg; st.pools[k] = null; st.last[k] = []; }
            const rule = slot.rule || 'free';
            const n = Math.min(pick, items.length);
            const last = Array.isArray(st.last[k]) ? st.last[k] : [];
            let seg, picks;
            if (rule === 'free') {
                seg = range(items.length);
                let cand = seg;
                if (slot.norep !== false && items.length > n && last.length) cand = seg.filter(i => last.indexOf(i) < 0);
                if (cand.length < n) cand = seg;
                picks = shuffle(cand.slice()).slice(0, n);
            } else {
                let pool = Array.isArray(st.pools[k]) ? st.pools[k].filter(i => i < items.length) : range(items.length);
                let cand = pool;
                if (!pool.length) {
                    if (rule === 'once') { Object.assign(st, before); return { over: k }; }
                    pool = cand = range(items.length);
                    // Neue Runde: nicht gleich wieder mit dem anfangen, was zuletzt kam
                    if (items.length > n && last.length) { const p2 = pool.filter(i => last.indexOf(i) < 0); if (p2.length >= n) cand = p2; }
                }
                seg = pool.slice().sort((a, b) => a - b);
                picks = shuffle(cand.slice()).slice(0, n);
                if (picks.length < n && rule === 'cycle') {   // Topf reicht nicht: Rest aus einer neuen Runde, ohne Doppelte
                    const more = shuffle(range(items.length).filter(i => picks.indexOf(i) < 0)).slice(0, n - picks.length);
                    const rest = range(items.length).filter(i => picks.indexOf(i) < 0 && more.indexOf(i) < 0);
                    picks = picks.concat(more);
                    pool = rest.concat(more);
                }
                st.pools[k] = pool.filter(i => picks.indexOf(i) < 0);
            }
            st.last[k] = picks.slice();
            out.push({ k, sel: picks.map(i => Object.assign({ i }, items[i])), seg, hit: Math.max(0, seg.indexOf(picks[0])) });
        }
        const rec = { at: Date.now(), r: out.map(x => x.sel.map(s => { const o = { t: s.t }; if (s.a) o.a = s.a; if (s.p) o.p = s.p; if (s.d) o.d = s.d; if (s.c) o.c = s.c; if (s.q) o.q = 1; return o; })), b: before };
        st.hist.push(rec);
        if (st.hist.length > 300) st.hist.splice(0, st.hist.length - 300);
        for (let i = 0; i < st.hist.length - 40; i++) delete st.hist[i].b;   // Rückgängig reicht für die letzten 40
        return { r: out };
    }
    /** Letzte Drehung zurücknehmen. true = hat geklappt */
    function undo(st) {
        const h = st.hist[st.hist.length - 1];
        if (!h || !h.b) return false;
        st.hist.pop();
        st.pools = h.b.pools; st.last = h.b.last; st.extra = h.b.extra || {};
        return true;
    }
    /** Neue Runde: alles zurück in den Topf, Verlauf leer */
    function reset(st) { st.pools = []; st.last = []; st.hist = []; st.extra = {}; }

    /** Gruppen einteilen: gerecht gemischt, reihum verteilt, Größen unterscheiden sich höchstens um eins */
    function teams(items, g) {
        g = Math.max(2, Math.min(12, g | 0 || 2));
        const out = range(Math.min(g, Math.max(1, items.length))).map(() => []);
        shuffle(items.slice()).forEach((it, i) => out[i % out.length].push(it));
        return out;
    }
    /** Ämter verteilen: jedes Amt bekommt jemanden, möglichst niemand doppelt.
        Wer beim letzten Mal ein Amt hatte, kommt erst dran, wenn die anderen durch sind (pool im state.extra). */
    function duties(dutyItems, names, st) {
        const ex = st.extra || (st.extra = {});
        let pool = Array.isArray(ex.dpool) ? ex.dpool.filter(i => i < names.length) : [];
        const out = [];
        for (const d of dutyItems) {
            if (!names.length) { out.push({ d, n: null }); continue; }
            if (!pool.length) pool = shuffle(range(names.length).filter(i => !out.some(o => o.i === i)));
            if (!pool.length) pool = shuffle(range(names.length));
            const i = pool.splice(rnd(pool.length), 1)[0];
            out.push({ d, n: names[i], i });
        }
        ex.dpool = pool;
        return out.map(o => ({ d: o.d, n: o.n }));
    }

    /* ---------- Zum Drucken: Bingo-Karten und Rechenblätter, die nie gleich sind ---------- */
    /** Anzahl der Möglichkeiten, k aus n zu wählen (als Kommazahl, bei sehr großen Werten Infinity) */
    function choose(n, k) {
        if (k < 0 || k > n) return 0;
        k = Math.min(k, n - k);
        let r = 1;
        for (let i = 1; i <= k; i++) { r = r * (n - k + i) / i; if (r > 1e15) return Infinity; }
        return Math.round(r);
    }
    /** Bingo-Karten. o = { classic: true } für 1 bis 75 mit Spalten B I N G O und Freifeld,
        sonst { items: [Eintrag …], size: 3|4|5, free: true|false }. count = wie viele Karten.
        Keine zwei Karten haben dieselben Einträge (auch nicht in anderer Anordnung), und von vielen Vorschlägen
        nimmt jede Karte den, der sich am wenigsten mit den schon gezogenen deckt: so gewinnen selten mehrere auf einmal.
        Ergebnis: { cards: [[Eintrag oder null für frei, …] Zeile für Zeile], size, max, short } */
    function bingoCards(o) {
        const size = o.classic ? 5 : Math.max(2, Math.min(6, o.size | 0 || 4));
        const free = o.classic || (o.free && size % 2 === 1);
        const k = size * size - (free ? 1 : 0);
        let max, make;
        if (o.classic) {
            max = Infinity;
            make = () => {
                const cols = range(5).map(c => shuffle(range(15).map(i => c * 15 + i + 1)).slice(0, c === 2 ? 4 : 5).sort((a, b) => a - b));
                cols[2].splice(2, 0, null);
                return range(25).map(i => cols[i % 5][Math.floor(i / 5)]);
            };
        } else {
            const items = o.items || [];
            if (items.length < k) return { cards: [], size, max: 0, short: k - items.length };
            max = choose(items.length, k);
            make = () => {
                const pick = shuffle(range(items.length)).slice(0, k);
                if (free) pick.splice(Math.floor(k / 2), 0, null);
                return pick;
            };
        }
        const count = Math.max(1, Math.min(500, o.count | 0 || 1, max));
        const keyOf = c => c.filter(x => x != null).slice().sort((a, b) => a - b).join(',');
        const seen = new Set(), cards = [], sets = [];
        let guard = 0;
        while (cards.length < count && guard++ < count * 400) {
            let best = null;
            const tries = max > count * 20 ? 24 : 4;
            for (let t = 0; t < tries; t++) {
                const c = make(), key = keyOf(c);
                if (seen.has(key)) continue;
                const set = new Set(c.filter(x => x != null));
                let worst = 0;
                for (const s of sets) { let n = 0; for (const v of set) if (s.has(v)) n++; if (n > worst) worst = n; }
                if (!best || worst < best.worst) best = { c, key, set, worst };
            }
            if (!best) continue;
            seen.add(best.key); sets.push(best.set); cards.push(best.c);
        }
        const out = o.classic ? cards.map(c => c.map(v => v == null ? null : { t: String(v), p: 'BINGO'[(v - 1) / 15 | 0] }))
            : cards.map(c => c.map(i => i == null ? null : o.items[i]));
        return { cards: out, size, free, max, short: 0, wanted: o.count | 0 };
    }
    /** Rechenblätter: count Blätter mit je n Aufgaben, auf einem Blatt keine Aufgabe doppelt und kein Blatt wie ein anderes */
    function mathSheets(o) {
        const n = Math.max(4, Math.min(40, o.n | 0 || 20));
        const sheets = [], seen = new Set();
        let guard = 0;
        while (sheets.length < Math.max(1, Math.min(100, o.count | 0 || 1)) && guard++ < 2000) {
            const tasks = [], keys = new Set();
            let g2 = 0;
            while (tasks.length < n && g2++ < n * 60) {
                const m = mathTask(o);
                if (keys.has(m.t)) continue;
                keys.add(m.t); tasks.push(m);
            }
            const key = Array.from(keys).sort().join('|');
            if (seen.has(key)) continue;
            seen.add(key); sheets.push(tasks);
        }
        return sheets;
    }

    /* ---------- Räder prüfen (aus Sicherung, Datei oder Link) ---------- */
    const RULES = ['free', 'cycle', 'once'];
    const VIEWS = ['wheel', 'reels', 'card', 'dice', 'bingo', 'abc', 'teams', 'duties'];
    function cleanSrc(s) {
        s = s && typeof s === 'object' ? s : {};
        switch (s.type) {
            case 'letters': {
                const out = { type: 'letters', ex: clip(s.ex, 40).toUpperCase().replace(/[^A-ZÄÖÜẞ]/g, ''), um: !!s.um };
                const plus = clip(s.plus, 120).split(/[\s,;]+/).filter(x => x && x.length <= 8).join(' ');
                if (plus) out.plus = plus;
                return out;
            }
            case 'numbers': {
                const f = Math.max(-99999, Math.min(99999, Math.round(+s.from || 1))), t = Math.max(-99999, Math.min(99999, Math.round(+s.to || 10)));
                return { type: 'numbers', from: f, to: t, step: Math.max(1, Math.min(10000, Math.round(+s.step || 1))), bingo: !!s.bingo };
            }
            case 'dice': return { type: 'dice', n: Math.max(1, Math.min(9, Math.round(+s.n || 1))) };
            case 'math': return { type: 'math', ops: (Array.isArray(s.ops) ? s.ops : ['+']).filter(o => '+-×:'.indexOf(o) >= 0).slice(0, 4), max: [10, 20, 100, 1000].indexOf(+s.max) >= 0 ? +s.max : 20 };
            case 'names': return { type: 'names' };
            case 'list': return { type: 'list', list: clip(s.list, 40) };
            default: {
                const out = { type: 'items', items: (Array.isArray(s.items) ? s.items : []).slice(0, 5000).map(x => typeof x === 'string' ? parseLine(x) : x && parseLine(itemLine({ t: clip(x.t, 200), a: x.a && clip(x.a, 300), c: /^#[0-9a-f]{6}$/i.test(x.c || '') ? x.c : '' }))).filter(Boolean) };
                const off = (Array.isArray(s.off) ? s.off : []).filter(x => typeof x === 'string' && out.items.some(i => i.t === x)).slice(0, 5000);
                if (off.length) out.off = off;
                return out;
            }
        }
    }
    function cleanGame(g) {
        if (!g || typeof g !== 'object') return null;
        const slots = (Array.isArray(g.slots) ? g.slots : []).slice(0, 6).map(s => ({
            label: clip(s && s.label, 60), src: cleanSrc(s && s.src), rule: RULES.indexOf(s && s.rule) >= 0 ? s.rule : 'free',
            pick: Math.max(1, Math.min(20, Math.round(+(s && s.pick) || 1))), hide: !!(s && s.hide),
        }));
        // Walze nicht ziehen: als Leiste unter dem Ergebnis zeigen (strip) oder ganz weglassen (off)
        (Array.isArray(g.slots) ? g.slots : []).slice(0, 6).forEach((s, i) => { if (s && (s.use === 'strip' || s.use === 'off')) slots[i].use = s.use; });
        if (!slots.length) return null;
        const out = {
            id: /^[a-z0-9_-]{1,40}$/i.test(g.id || '') ? g.id : 'u' + Date.now().toString(36) + rnd(1296).toString(36),
            name: clip(g.name, 60) || 'Mein Rad', ic: /^[a-z0-9-]{1,20}$/.test(g.ic || '') ? g.ic : 'wheel', slots,
            view: VIEWS.indexOf(g.view) >= 0 ? g.view : 'wheel', note: clip(g.note, 300),
        };
        if (g.timer && +g.timer.s > 0) out.timer = { s: Math.max(5, Math.min(3600, Math.round(+g.timer.s))), auto: !!g.timer.auto };
        if (g.groups) out.groups = Math.max(2, Math.min(12, Math.round(+g.groups)));
        if (g.mode === 'apart') out.mode = 'apart';
        return out;
    }

    /* ---------- Teilen per Link: das Rad steckt hinter dem #, der Teil geht nie an den Server ---------- */
    const b64u = bytes => { let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
    const unb64u = s => { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/')); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
    async function pipe(bytes, Stream) {
        const out = new Blob([bytes]).stream().pipeThrough(new Stream('deflate-raw'));
        return new Uint8Array(await new Response(out).arrayBuffer());
    }
    async function encodeShare(game) {
        const raw = new TextEncoder().encode(JSON.stringify(game));
        if (G.CompressionStream) { try { return 'z' + b64u(await pipe(raw, G.CompressionStream)); } catch (e) {} }
        return 'j' + b64u(raw);
    }
    async function decodeShare(s) {
        try {
            let bytes = unb64u(s.slice(1));
            if (s[0] === 'z') bytes = await pipe(bytes, G.DecompressionStream);
            else if (s[0] !== 'j') return null;
            return cleanGame(JSON.parse(new TextDecoder().decode(bytes)));
        } catch (e) { return null; }
    }

    /* ---------- Eingebaute Spiele ----------
       Namen und Beschreibungen sind deutsche Texte, die app.js übersetzt. Listen kommen aus app/lists/xx.txt (src.list).
       tags: alle, senioren, kinder, gruppe, werkzeug. */
    const L = (list, label, rule, more) => Object.assign({ label, src: { type: 'list', list }, rule: rule || 'cycle' }, more || {});
    const GAMES = [
        { id: 'slf', ic: 'pen', tags: ['alle', 'senioren', 'kinder'], name: 'Stadt-Land-Fluss', desc: 'Buchstabe und Kategorie drehen, alle schreiben los. Schwierige Buchstaben bleiben draußen.',
            slots: [{ label: 'Buchstabe', src: { type: 'letters', ex: 'QXY' }, rule: 'cycle' }, L('slf-klassisch', 'Kategorie')], view: 'wheel', timer: { s: 0, auto: true } },
        { id: 'slf-mund', ic: 'chat', tags: ['alle', 'senioren', 'gruppe'], name: 'Nennt etwas mit …', desc: 'Buchstabe und Kategorie, wer zuerst etwas Passendes sagt. Stadt-Land-Fluss ohne Stift.',
            slots: [{ label: 'Buchstabe', src: { type: 'letters', ex: 'QXYCJV' }, rule: 'cycle' }, L('slf-senioren', 'Kategorie')], view: 'reels' },
        { id: 'slf-kinder', ic: 'pen', tags: ['kinder'], name: 'Stadt-Land-Fluss für Kinder', desc: 'Leichte Buchstaben und Kategorien wie Tier, Farbe und Essen.',
            slots: [{ label: 'Buchstabe', src: { type: 'letters', ex: 'CJQVXY' }, rule: 'cycle' }, L('slf-kinder', 'Kategorie')], view: 'reels' },
        { id: 'bingo', ic: 'grid', tags: ['alle', 'senioren', 'gruppe'], name: 'Bingo', desc: 'Zahlen von 1 bis 75 ohne Zurücklegen, mit Tafel und Ansage.',
            slots: [{ label: 'Zahl', src: { type: 'numbers', from: 1, to: 75, step: 1, bingo: true }, rule: 'once' }], view: 'bingo' },
        { id: 'begriffe', ic: 'mask', tags: ['alle', 'gruppe'], name: 'Begriffe raten', desc: 'Erklären, vormachen oder malen. Der Begriff bleibt verdeckt, bis man ihn antippt.',
            slots: [L('begriffe', 'Begriff', 'cycle', { hide: true }), L('darstellung', 'So geht\'s', 'free')], view: 'reels', timer: { s: 60, auto: true } },
        { id: 'abc', ic: 'abc', tags: ['alle', 'senioren', 'gruppe'], name: 'ABC-Runde', desc: 'Ein Thema, dann reihum von A bis Z. Klassiker im Gedächtnistraining.',
            slots: [L('abc-themen', 'Thema')], view: 'abc' },
        { id: 'erinnerung', ic: 'album', tags: ['senioren', 'gruppe'], name: 'Erinnerungsrad', desc: 'Fragen zum Erzählen von früher. Jeder kann etwas beitragen, es gibt kein Falsch.',
            slots: [L('erinnerung', 'Erzähl mal')], view: 'card' },
        { id: 'sprichwoerter', ic: 'quote', tags: ['senioren', 'alle'], name: 'Sprichwörter ergänzen', desc: 'Der Anfang steht da, die Runde ergänzt. Antippen zeigt die Auflösung.',
            slots: [L('sprichwoerter', 'Wie geht es weiter?')], view: 'card' },
        { id: 'gymnastik', ic: 'chair', tags: ['senioren'], name: 'Sitzgymnastik', desc: 'Kleine Übungen im Sitzen, mit Sanduhr. Bewegung zwischendurch.',
            slots: [L('gymnastik', 'Übung')], view: 'card', timer: { s: 30, auto: true }, note: 'Nur so weit bewegen, wie es angenehm ist.' },
        { id: 'lieder', ic: 'music', tags: ['senioren', 'gruppe'], name: 'Liederrad', desc: 'Bekannte Volkslieder zum gemeinsamen Singen.',
            slots: [L('volkslieder', 'Wir singen')], view: 'wheel' },
        { id: 'geschichten', ic: 'book', tags: ['kinder', 'gruppe'], name: 'Geschichten-Walzen', desc: 'Wer? Wo? Was passiert? Daraus wird eine Geschichte erzählt.',
            slots: [L('wer', 'Wer?'), L('wo', 'Wo?'), L('was', 'Was passiert?')], view: 'reels' },
        { id: 'bewegung', ic: 'run', tags: ['kinder'], name: 'Bewegungsrad', desc: 'Hüpfen, strecken, balancieren. Toben für zwischendurch.',
            slots: [L('bewegung', 'Los geht\'s')], view: 'wheel' },
        { id: 'koerperfarben', ic: 'hand', tags: ['kinder', 'gruppe'], name: 'Hand, Fuß und Farbe', desc: 'Körperteil und Farbe drehen, dann auf die passende Farbe stellen oder legen.',
            slots: [L('koerperteile', 'Körperteil', 'free'), L('farben', 'Farbe', 'free')], view: 'reels' },
        { id: 'rechnen', ic: 'calc', tags: ['kinder', 'senioren'], name: 'Rechen-Rad', desc: 'Kopfrechnen im Zahlenraum bis 20. Antippen zeigt das Ergebnis.',
            slots: [{ label: 'Rechne', src: { type: 'math', ops: ['+', '-'], max: 20 }, rule: 'free' }], view: 'card' },
        { id: 'gefuehle', ic: 'smile', tags: ['kinder'], name: 'Gefühle-Rad', desc: 'Zeig mal, wie du guckst, wenn du dich so fühlst.',
            slots: [L('gefuehle', 'Zeig mal')], view: 'wheel' },
        { id: 'reime', ic: 'rhyme', tags: ['kinder', 'senioren'], name: 'Reim-Rad', desc: 'Ein Wort drehen und Reime finden. Antippen zeigt Beispiele.',
            slots: [L('reime', 'Was reimt sich auf')], view: 'card' },
        { id: 'kinderlieder', ic: 'music', tags: ['kinder'], name: 'Kinderlieder', desc: 'Bekannte Kinderlieder zum Mitsingen.',
            slots: [L('kinderlieder', 'Wir singen')], view: 'wheel' },
        { id: 'fragen-kinder', ic: 'chat', tags: ['kinder', 'gruppe'], name: 'Was wäre, wenn …?', desc: 'Fragen zum Erzählen und Fantasieren für Kinder.',
            slots: [L('fragen-kinder', 'Erzähl mal')], view: 'card' },
        { id: 'begriffe-kinder', ic: 'mask', tags: ['kinder'], name: 'Begriffe raten für Kinder', desc: 'Leichte Begriffe zum Erklären, Vormachen oder Malen.',
            slots: [L('begriffe-kinder', 'Begriff', 'cycle', { hide: true }), L('darstellung', 'So geht\'s', 'free')], view: 'reels', timer: { s: 60, auto: true } },
        { id: 'wer', ic: 'person', tags: ['gruppe', 'werkzeug'], name: 'Wer ist dran?', desc: 'Namen eintragen, das Rad sucht aus. Jeder kommt einmal dran, dann geht es von vorn los.',
            slots: [{ label: 'Dran ist', src: { type: 'names' }, rule: 'cycle' }], view: 'wheel' },
        { id: 'gruppen', ic: 'people', tags: ['gruppe', 'werkzeug'], name: 'Gruppen einteilen', desc: 'Alle Namen gerecht auf Gruppen verteilen.',
            slots: [{ label: 'Namen', src: { type: 'names' }, rule: 'free' }], view: 'teams', groups: 2 },
        { id: 'aemter', ic: 'list', tags: ['gruppe', 'werkzeug'], name: 'Ämter verteilen', desc: 'Tischdienst, Blumen gießen … Jedes Amt bekommt jemanden, reihum gerecht.',
            slots: [L('aemter', 'Amt', 'free'), { label: 'Namen', src: { type: 'names' }, rule: 'free' }], view: 'duties' },
        { id: 'buchstaben', ic: 'letter', tags: ['werkzeug'], name: 'Buchstaben', desc: 'Ein Buchstabe nach dem anderen, ohne Wiederholung, bis alle durch sind.',
            slots: [{ label: 'Buchstabe', src: { type: 'letters', ex: '' }, rule: 'cycle' }], view: 'wheel' },
        { id: 'zahlen', ic: 'hash', tags: ['werkzeug'], name: 'Zahlen', desc: 'Zahlen von 1 bis 10. Bereich, Schrittweite und Ziehung frei einstellbar.',
            slots: [{ label: 'Zahl', src: { type: 'numbers', from: 1, to: 10, step: 1 }, rule: 'free' }], view: 'wheel' },
        { id: 'wuerfel', ic: 'dice', tags: ['werkzeug', 'alle'], name: 'Würfel', desc: 'Ein bis neun Würfel, mit Summe. Für jedes Brettspiel.',
            slots: [{ label: 'Würfel', src: { type: 'dice', n: 2 }, rule: 'free' }], view: 'dice' },
        { id: 'lotto', ic: 'balls', tags: ['werkzeug'], name: 'Lotto 6 aus 49', desc: 'Sechs Zahlen auf einmal, ohne Doppelte.',
            slots: [{ label: 'Gezogen', src: { type: 'numbers', from: 1, to: 49, step: 1 }, rule: 'free', pick: 6 }], view: 'card' },
        { id: 'entscheidung', ic: 'scale', tags: ['werkzeug'], name: 'Ja oder Nein', desc: 'Wenn man sich nicht entscheiden kann.',
            slots: [L('entscheidung', 'Die Antwort', 'free')], view: 'wheel' },
        { id: 'muenze', ic: 'coin', tags: ['werkzeug'], name: 'Münze werfen', desc: 'Kopf oder Zahl.',
            slots: [L('muenze', 'Die Münze zeigt', 'free', { norep: false })], view: 'card' },
    ];
    for (const g of GAMES) g.builtin = true;
    const GROUPS = [['alle', 'Für alle'], ['senioren', 'Senioren'], ['kinder', 'Kinder'], ['gruppe', 'Für Gruppen'], ['werkzeug', 'Werkzeuge']];

    Object.assign(DR, { rnd, rndReal, shuffle, range, clip, parseLine, parseItems, itemLine, itemsToText, parseContent, parseImport, exportText,
        itemsOf, endless, sig, rollDice, mathTask, newState, normState, left, wheelItems, draw, undo, reset, teams, duties,
        cleanGame, cleanSrc, encodeShare, decodeShare, choose, bingoCards, mathSheets, GAMES, GROUPS, RULES, VIEWS });
    if (typeof module !== 'undefined' && module.exports) module.exports = DR;
})(typeof window !== 'undefined' ? window : globalThis);
