/* Drehsel – prüft die Übersetzungen: node tools/check-i18n.js [xx]
   Sammelt alle Texte aus t('…') und N('…') in app.js und stage.js, die Namen, Beschreibungen und Beschriftungen der Spiele
   aus engine.js und die Namen der Farbwelten aus look.js. Meldet, was in app/assets/i18n-xx.js fehlt oder übrig ist.
   Ohne Angabe werden alle vorhandenen Sprachen geprüft. Mit --keys werden nur die Schlüssel ausgegeben. */
'use strict';
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'app', 'assets');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
const keys = new Set();
const str = "'((?:[^'\\\\]|\\\\.)*)'";
const unq = s => s.replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\\\/g, '\\');
for (const f of ['app.js', 'stage.js', 'print.js']) {
    for (const m of read(f).matchAll(new RegExp('\\b[tN]\\(' + str, 'g'))) keys.add(unq(m[1]));
}
const eng = read('engine.js');
for (const m of eng.matchAll(new RegExp('\\b(?:name|desc|label|note): ' + str, 'g'))) keys.add(unq(m[1]));
for (const m of eng.matchAll(new RegExp("\\bL\\('[^']*', " + str, 'g'))) keys.add(unq(m[1]));
const look = read('look.js');
for (const m of look.matchAll(/\['[a-z-]+', '([^']+)', \{/g)) keys.add(m[1]);
for (const m of look.matchAll(/\['[a-z]+', '([^']+)'\]/g)) keys.add(m[1]);
for (const k of Array.from(keys)) if (!/[A-Za-zÄÖÜäöüß]/.test(k) || /^[a-z0-9-]+$/.test(k) && !/[äöü]/.test(k)) keys.delete(k);

if (process.argv.includes('--keys')) { console.log(Array.from(keys).sort().join('\n')); process.exit(0); }
global.window = global;
const langs = (process.argv[2] && !process.argv[2].startsWith('-') ? [process.argv[2]] : fs.readdirSync(dir).filter(f => /^i18n-[a-z]{2}\.js$/.test(f)).map(f => f.slice(5, 7)));
let bad = 0;
for (const l of langs) {
    require(path.join(dir, 'i18n-' + l + '.js'));
    const T = global.DR_I18N[l] || {};
    const missing = Array.from(keys).filter(k => !T[k]);
    const extra = Object.keys(T).filter(k => k !== '_name' && !keys.has(k));
    const vars = Array.from(keys).filter(k => T[k] && (k.match(/\{\w+\}/g) || []).sort().join() !== (T[k].match(/\{\w+\}/g) || []).sort().join());
    console.log(l + ': ' + keys.size + ' Texte, ' + missing.length + ' fehlen, ' + extra.length + ' übrig, ' + vars.length + ' mit anderen Platzhaltern');
    for (const k of missing) console.log('  fehlt:  ' + k);
    for (const k of extra) console.log('  übrig:  ' + k);
    for (const k of vars) console.log('  {…}:    ' + k);
    bad += missing.length + vars.length;
}
process.exit(bad ? 1 : 0);
