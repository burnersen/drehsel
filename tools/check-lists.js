/* Drehsel – prüft die eingebauten Listen: node tools/check-lists.js
   Doppelte Einträge in einer Liste, Listen, die es nur in einer Sprache gibt, leere Listen,
   und Listen, auf die ein eingebautes Spiel verweist, die aber fehlen. */
'use strict';
const fs = require('fs');
const path = require('path');
const DR = require('../app/assets/engine.js');
const dir = path.join(__dirname, '..', 'app', 'lists');
const langs = fs.readdirSync(dir).filter(f => /^[a-z]{2}\.txt$/.test(f)).map(f => f.slice(0, 2));
const lists = {};
for (const l of langs) lists[l] = DR.parseContent(fs.readFileSync(path.join(dir, l + '.txt'), 'utf8'));
const used = new Set();
for (const g of DR.GAMES) { for (const s of g.slots) if (s.src.type === 'list') used.add(s.src.list); if (g.cats) used.add(g.cats); }
['slf-klassisch', 'slf-senioren', 'slf-kinder', 'alphabet'].forEach(x => used.add(x));
let bad = 0;
const warn = msg => { console.log('  ' + msg); bad++; };
for (const l of langs) {
    console.log(l + ': ' + Object.keys(lists[l]).length + ' Listen, ' + Object.values(lists[l]).reduce((a, x) => a + x.items.length, 0) + ' Einträge');
    for (const id of used) if (!lists[l][id] && !(l !== 'de' && id === 'alphabet-extra')) warn('fehlt: [' + id + ']');
    for (const id in lists[l]) {
        const it = lists[l][id].items;
        if (!it.length) warn('leer: [' + id + ']');
        if (id === 'entscheidung' || id.startsWith('alphabet')) continue;
        const seen = new Set();
        for (const x of it) { const k = x.t.toLowerCase(); if (seen.has(k)) warn('doppelt in [' + id + ']: ' + x.t); seen.add(k); }
        for (const o of langs) if (o !== l && !lists[o][id] && id !== 'alphabet-extra') warn('[' + id + '] gibt es nicht auf ' + o);
    }
}
process.exit(bad ? 1 : 0);
