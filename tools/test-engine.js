/* Drehsel – schnelle Prüfung der Logik ohne Browser: node tools/test-engine.js */
'use strict';
const DR = require('../app/assets/engine.js');
const assert = require('assert');
const ctx = {
    list: id => ({ a: { items: DR.parseItems('Eins\nZwei\nDrei\nVier') } })[id] || null,
    names: () => DR.parseItems('Anna, Ben, Carla'),
    alphabet: () => 'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z'.split(' '),
    extra: () => ['Ä', 'Ö', 'Ü'],
};
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok', name); };

t('parseLine', () => {
    assert.deepStrictEqual(DR.parseLine('- Morgenstund hat | Gold im Mund'), { t: 'Morgenstund hat', a: 'Gold im Mund' });
    assert.deepStrictEqual(DR.parseLine('Rot #E03131'), { t: 'Rot', c: '#e03131' });
    assert.deepStrictEqual(DR.parseLine('3. Frage\tAntwort'), { t: 'Frage', a: 'Antwort' });
    assert.strictEqual(DR.parseLine('   '), null);
});
t('parseItems Komma', () => assert.strictEqual(DR.parseItems('Anna, Ben; Carla').length, 3));
t('parseImport', () => {
    const g = DR.parseImport('[Namen]\nAnna\nBen\n[Obst]\nApfel\n== Geschichte ==\n[Wer?]\nDrache\nRitter\n[Wo?]\nWald', 'X');
    assert.strictEqual(g.length, 3);
    assert.strictEqual(g[0].name, 'Namen');
    assert.strictEqual(g[2].slots.length, 2);
    assert.strictEqual(DR.parseImport('Anna\nBen', 'Liste')[0].name, 'Liste');
});
t('parseContent', () => {
    const c = DR.parseContent('# Kommentar\n[abc] ABC-Themen\nObst\nTiere\n[x] Y\nA | B');
    assert.strictEqual(c.abc.items.length, 2);
    assert.strictEqual(c.x.items[0].a, 'B');
});
t('Buchstaben ohne QXY', () => {
    const it = DR.itemsOf({ src: { type: 'letters', ex: 'QXY', um: true } }, ctx);
    assert.strictEqual(it.length, 26);
    assert(!it.some(x => 'QXY'.includes(x.t)));
});
t('Bingo-Buchstaben', () => {
    const it = DR.itemsOf({ src: { type: 'numbers', from: 1, to: 75, bingo: true } }, ctx);
    assert.strictEqual(it[0].p, 'B'); assert.strictEqual(it[74].p, 'O'); assert.strictEqual(it[30].p, 'N');
});
t('cycle: jeder einmal, dann von vorn, nicht gleich wiederholt', () => {
    const g = { slots: [{ src: { type: 'list', list: 'a' }, rule: 'cycle' }] };
    const st = DR.newState();
    for (let round = 0; round < 50; round++) {
        const seen = new Set();
        for (let i = 0; i < 4; i++) { const r = DR.draw(g, st, ctx); seen.add(r.r[0].sel[0].t); }
        assert.strictEqual(seen.size, 4);
    }
    const h = st.hist.map(x => x.r[0][0].t);
    for (let i = 1; i < h.length; i++) assert.notStrictEqual(h[i], h[i - 1]);
});
t('once: Ende, dann über', () => {
    const g = { slots: [{ src: { type: 'numbers', from: 1, to: 5 }, rule: 'once' }] };
    const st = DR.newState();
    const got = [];
    for (let i = 0; i < 5; i++) got.push(DR.draw(g, st, ctx).r[0].sel[0].t);
    assert.deepStrictEqual(got.sort(), ['1', '2', '3', '4', '5']);
    assert.strictEqual(DR.draw(g, st, ctx).over, 0);
    assert.strictEqual(st.hist.length, 5);
});
t('Rückgängig', () => {
    const g = { slots: [{ src: { type: 'numbers', from: 1, to: 5 }, rule: 'once' }] };
    const st = DR.newState();
    DR.draw(g, st, ctx); DR.draw(g, st, ctx);
    assert.strictEqual(DR.left(g, st, 0, ctx).left, 3);
    assert(DR.undo(st));
    assert.strictEqual(DR.left(g, st, 0, ctx).left, 4);
    assert.strictEqual(st.hist.length, 1);
});
t('seg und hit passen', () => {
    const g = { slots: [{ src: { type: 'list', list: 'a' }, rule: 'cycle' }] };
    const st = DR.newState();
    for (let i = 0; i < 20; i++) {
        const before = DR.wheelItems(g, st, 0, ctx);
        const r = DR.draw(g, st, ctx).r[0];
        assert.deepStrictEqual(r.seg, before);
        assert.strictEqual(r.seg[r.hit], r.sel[0].i);
    }
});
t('pick 6 aus 49 ohne Doppelte', () => {
    const g = { slots: [{ src: { type: 'numbers', from: 1, to: 49 }, rule: 'free', pick: 6 }] };
    const st = DR.newState();
    for (let i = 0; i < 200; i++) { const s = DR.draw(g, st, ctx).r[0].sel.map(x => x.t); assert.strictEqual(new Set(s).size, 6); }
});
t('Gleichverteilung grob', () => {
    const c = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 60000; i++) c[DR.rnd(6)]++;
    for (const x of c) assert(Math.abs(x - 10000) < 500, 'Würfel ungleich: ' + c);
});
t('Rechnen', () => {
    for (let i = 0; i < 2000; i++) {
        const m = DR.mathTask({ ops: ['+', '-', '×', ':'], max: 20 });
        const [a, op, b] = m.t.split(' ');
        const r = { '+': +a + +b, '−': a - b, '×': a * b, ':': a / b }[op];
        assert.strictEqual(String(r), m.a, m.t);
        assert(r >= 0 && Number.isInteger(r), m.t);
        if (op === '+' || op === '−') assert(+a <= 20 && +b <= 20 && (op !== '+' || r <= 20), m.t);
    }
});
t('Gruppen gerecht', () => {
    const items = DR.range(11).map(i => ({ t: 'N' + i }));
    const g = DR.teams(items, 3);
    assert.strictEqual(g.length, 3);
    assert.deepStrictEqual(g.map(x => x.length).sort(), [3, 4, 4]);
});
t('Ämter reihum', () => {
    const st = DR.newState();
    const names = DR.parseItems('A,B,C,D,E,F');
    const count = {};
    for (let i = 0; i < 30; i++) for (const x of DR.duties(DR.parseItems('x,y'), names, st)) count[x.n.t] = (count[x.n.t] || 0) + 1;
    for (const k in count) assert.strictEqual(count[k], 10);
});
t('cleanGame', () => {
    const g = DR.cleanGame({ name: 'Test', slots: [{ label: 'A', src: { type: 'items', items: ['x', { t: 'y', a: 'z' }] }, rule: 'cycle' }], view: 'reels', timer: { s: 60 } });
    assert.strictEqual(g.slots[0].src.items.length, 2);
    assert.strictEqual(g.slots[0].src.items[1].a, 'z');
    assert.strictEqual(DR.cleanGame({ slots: [] }), null);
});
t('Bingo klassisch: 100 verschiedene Karten, Spalten passen', () => {
    const r = DR.bingoCards({ classic: true, count: 100 });
    assert.strictEqual(r.cards.length, 100);
    const keys = new Set();
    for (const c of r.cards) {
        assert.strictEqual(c.length, 25);
        assert.strictEqual(c[12], null);
        c.forEach((x, i) => { if (x) { const v = +x.t; assert(v >= (i % 5) * 15 + 1 && v <= (i % 5) * 15 + 15, 'Spalte ' + i + ': ' + v); assert.strictEqual(x.p, 'BINGO'[i % 5]); } });
        const k = c.filter(Boolean).map(x => +x.t).sort((a, b) => a - b).join(',');
        assert(!keys.has(k), 'doppelte Karte');
        keys.add(k);
    }
});
t('Wort-Bingo: nie zwei gleiche, Grenze wird eingehalten', () => {
    const items = DR.range(12).map(i => ({ t: 'W' + i }));
    const r = DR.bingoCards({ items, size: 3, free: false, count: 300 });
    assert.strictEqual(r.max, 220);
    assert.strictEqual(r.cards.length, 220);
    const keys = new Set(r.cards.map(c => c.map(x => x.t).sort().join(',')));
    assert.strictEqual(keys.size, 220);
    assert.strictEqual(DR.bingoCards({ items: items.slice(0, 5), size: 3, count: 2 }).short, 4);
});
t('Rechenblätter: alle verschieden, keine Aufgabe doppelt', () => {
    const sh = DR.mathSheets({ ops: ['+', '-'], max: 20, n: 20, count: 30 });
    assert.strictEqual(sh.length, 30);
    assert.strictEqual(new Set(sh.map(x => x.map(y => y.t).sort().join('|'))).size, 30);
    for (const x of sh) assert.strictEqual(new Set(x.map(y => y.t)).size, 20);
});
(async () => {
    const g = DR.cleanGame({ name: 'Teilen', slots: [{ src: { type: 'items', items: ['Äpfel', 'Birnen'] } }] });
    const s = await DR.encodeShare(g);
    const back = await DR.decodeShare(s);
    assert.strictEqual(back.slots[0].src.items[0].t, 'Äpfel');
    console.log('ok Teilen per Link (' + s.length + ' Zeichen)');
    console.log('\nAlle ' + (n + 1) + ' Prüfungen bestanden.');
})().catch(e => { console.error(e); process.exit(1); });
