/* Drehsel – Farben: fertige Farbwelten für hell und dunkel, eigene Farben aus dem Farbmischer und die Kontrast-Automatik.
   Aus vier Grundfarben (Hintergrund, Flächen, Schrift, Akzent) plus Rand und Radfarben entstehen alle Farben der Oberfläche.
   Jede Schrift wird dabei so nachgeregelt, dass sie auf ihrem Untergrund gut lesbar bleibt: große Ergebnisse mindestens 7 : 1,
   alles andere mindestens 4,5 : 1 (die Werte der Richtlinien für barrierefreie Webseiten). */
(function (G) {
    'use strict';
    const DR = G.DR = G.DR || {};

    /* ---------- Farben rechnen ---------- */
    const isHex = v => /^#[0-9a-f]{6}$/.test(v);
    const hex2rgb = x => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16));
    const rgb2hex = a => '#' + a.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
    const mix = (a, b, t) => { const x = hex2rgb(a), y = hex2rgb(b); return rgb2hex(x.map((v, i) => v + (y[i] - v) * t)); };
    const lum = x => { const [r, g, b] = hex2rgb(x).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
    const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    function hsl2hex([hh, s, l]) {
        s /= 100; l /= 100;
        const a = s * Math.min(l, 1 - l);
        const f = n => { const k = (n + hh / 30) % 12; return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
        return rgb2hex([f(0), f(8), f(4)]);
    }
    function hex2hsl(x) {
        const [r, g, b] = hex2rgb(x).map(v => v / 255);
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
        let hh = 0;
        if (d) hh = ((mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 360) % 360;
        return [Math.round(hh), Math.round((d ? d / (1 - Math.abs(2 * l - 1)) : 0) * 100), Math.round(l * 100)];
    }
    /** Kontrast-Automatik: fg so lange heller bzw. dunkler machen (Farbton bleibt), bis es auf bg mindestens min : 1 erreicht.
        Geht es in die eine Richtung nicht, dann in die andere, zur Not Schwarz oder Weiß. */
    function ensure(fg, bg, min) {
        if (contrast(fg, bg) >= min) return fg;
        const [h, s, l] = hex2hsl(fg);
        const down = lum(bg) > .18;
        for (const dir of down ? [-1, 1] : [1, -1]) {
            for (let x = l; x >= 0 && x <= 100; x += dir * 2) {
                const c = hsl2hex([h, s, x]);
                if (contrast(c, bg) >= min) return c;
            }
        }
        return contrast('#000000', bg) >= contrast('#ffffff', bg) ? '#000000' : '#ffffff';
    }
    /** Am besten lesbare Schrift auf einer Farbe: fast Weiß oder fast Schwarz, mit einem Hauch vom Farbton */
    function inkOn(bg) {
        const [h, s] = hex2hsl(bg);
        const light = contrast(bg, '#ffffff') >= contrast(bg, '#111111');
        const tint = hsl2hex([h, s < 12 ? 0 : 30, light ? 98 : 8]);
        const plain = light ? '#ffffff' : '#0d0d0d';
        return contrast(tint, bg) >= contrast(plain, bg) * .92 ? tint : plain;
    }

    /* ---------- Fertige Farbwelten ----------
       bg Hintergrund, card Flächen (Karten, Fenster), text Schrift, acc Akzent (Knöpfe, Zeiger, große Ergebnisse),
       rim Rand und Trennlinien im Rad, seg Farben der Felder im Rad (reihum). */
    const PALS = {
        light: [
            ['klassisch', 'Klassisch', { bg: '#f5f0e6', card: '#fffdf8', text: '#1c2638', acc: '#1f3a5f', rim: '#c2a04d', seg: ['#1f3a5f', '#f1e7d3', '#9c3d2e', '#f1e7d3'] }],
            ['ruhig', 'Ruhig', { bg: '#edf0ed', card: '#fbfcfb', text: '#243330', acc: '#46685b', rim: '#ffffff', seg: ['#8fa998', '#d9c7a7', '#7f9bb3', '#c99f98', '#a3a38a', '#b8c4cc'] }],
            ['weinrot', 'Weinrot', { bg: '#f6f1ee', card: '#fffcfa', text: '#2a1c1e', acc: '#7a2836', rim: '#b08d57', seg: ['#7a2836', '#efe3d6', '#2f4a4a', '#efe3d6'] }],
            ['schlicht', 'Schlicht', { bg: '#f1f1ef', card: '#ffffff', text: '#141414', acc: '#1d1d1f', rim: '#1d1d1f', seg: ['#ffffff', '#d9d9d6'] }],
            ['bunt', 'Bunt', { bg: '#f4f1fb', card: '#ffffff', text: '#1b1f2a', acc: '#6741d9', rim: '#ffffff', seg: ['#ffd43b', '#ff6b6b', '#4dabf7', '#69db7c', '#ffa94d', '#9775fa'] }],
        ],
        dark: [
            ['nacht', 'Nacht', { bg: '#111823', card: '#1a2433', text: '#efe9dc', acc: '#d4ad57', rim: '#c2a04d', seg: ['#2b4a75', '#e9dfca', '#a8473a', '#e9dfca'] }],
            ['wald', 'Wald', { bg: '#131917', card: '#1c2421', text: '#e4ebe7', acc: '#93b8a8', rim: '#2c3833', seg: ['#46604f', '#b8a888', '#45607a', '#a88380', '#5d5d48', '#8d9aa3'] }],
            ['kontrast', 'Gelb auf Schwarz', { bg: '#000000', card: '#000000', text: '#ffe94d', acc: '#ffe94d', rim: '#ffe94d', seg: ['#000000', '#ffe94d'] }],
            ['kontrast-weiss', 'Weiß auf Schwarz', { bg: '#000000', card: '#0b0b0b', text: '#ffffff', acc: '#ffffff', rim: '#ffffff', seg: ['#000000', '#ffffff'] }],
            ['bunt-dunkel', 'Bunt dunkel', { bg: '#15131f', card: '#201d2e', text: '#f1eefc', acc: '#b197fc', rim: '#2b2740', seg: ['#fcc419', '#ff8787', '#74c0fc', '#8ce99a', '#ffc078', '#b197fc'] }],
        ],
    };
    const PARTS = [['bg', 'Hintergrund'], ['card', 'Flächen'], ['text', 'Schrift'], ['acc', 'Akzent'], ['rim', 'Rand im Rad']];
    const palById = id => { for (const m in PALS) for (const p of PALS[m]) if (p[0] === id) return p; return null; };
    const palColors = id => { const p = palById(id); return p ? JSON.parse(JSON.stringify(p[2])) : null; };
    /** Eigene Farben prüfen: fehlt etwas, kommt es aus Klassisch */
    function cleanColors(c, mode) {
        const base = palColors(mode === 'dark' ? 'nacht' : 'klassisch');
        if (!c || typeof c !== 'object') return null;
        const out = {};
        for (const [k] of PARTS) out[k] = isHex(c[k]) ? c[k] : base[k];
        out.seg = (Array.isArray(c.seg) ? c.seg.filter(isHex) : []).slice(0, 8);
        if (out.seg.length < 2) out.seg = base.seg;
        if (c.autoText) out.autoText = true;
        return out;
    }

    /** Aus den Grundfarben alle Farben der Oberfläche, mit Kontrast-Automatik */
    function derive(c) {
        const dark = lum(c.bg) < .2;
        const text = c.autoText ? inkOn(c.bg) : c.text;
        const card = c.card;
        const onAcc = inkOn(c.acc);
        const ink = ensure(c.acc, card, 7);                              // große Ergebnisse
        const mut = ensure(mix(text, card, .38), card, 4.6);              // Nebentext
        const soft = mix(c.acc, card, dark ? .78 : .87);                 // Chips, Felder
        return {
            '--bg': c.bg, '--card': card, '--text': ensure(text, card, 4.6), '--text-bg': ensure(text, c.bg, 4.6), '--acc': c.acc, '--on-acc': onAcc,
            '--ink': ink, '--mut': mut, '--line': mix(text, card, dark ? .78 : .84), '--soft': soft, '--on-soft': ensure(c.acc, soft, 4.6),
            '--rim': c.rim, '--field': mix(c.bg, card, .5), '--warn': ensure(dark ? '#ffa94d' : '#b54708', card, 4.6),
            '--ok': ensure(dark ? '#8ce99a' : '#2b8a3e', card, 4.6), '--shadow': dark ? '0 1px 2px rgba(0,0,0,.4), 0 6px 20px rgba(0,0,0,.25)' : '0 1px 2px rgba(30,30,40,.06), 0 6px 20px rgba(30,30,40,.07)',
            'color-scheme': dark ? 'dark' : 'light',
        };
    }
    /** Schriftfarbe je Feld im Rad: auf jedem Feld die am besten lesbare */
    const segInk = seg => seg.map(inkOn);

    Object.assign(DR, { look: { isHex, hex2rgb, rgb2hex, mix, lum, contrast, hsl2hex, hex2hsl, ensure, inkOn, PALS, PARTS, palById, palColors, cleanColors, derive, segInk } });
})(typeof window !== 'undefined' ? window : globalThis);
