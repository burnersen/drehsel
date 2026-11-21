/* Drehsel – Druckvorlagen als A4-PDF: Bingo-Karten (jede anders), Stadt-Land-Fluss-Blatt, Listen, Karten zum Ausschneiden
   und Rechenblätter (jedes anders, mit Lösungen). Alles schlicht in Schwarz und Grau, damit es auf jedem Drucker gut aussieht,
   und groß genug für schlechte Augen. Gezogen wird in engine.js (bingoCards, mathSheets), hier wird nur gesetzt.
   Jede Funktion bekommt die Optionen und t (Übersetzung) und liefert ein Dokument aus pdf.js. */
(function (G) {
    'use strict';
    const DR = G.DR;
    const K = [0, 0, 0], GRAY = [.45, .45, .45], LIGHT = [.78, .78, .78], SHADE = [.92, .92, .92], DARK = [.18, .18, .2];
    const M = 36;

    /** Kopf einer Seite: Überschrift, Unterzeile, auf Wunsch Name und Datum. Liefert die y-Position darunter. */
    function head(P, title, sub, o, t) {
        let y = M + 22;
        P.text(M, y, title, 22, { bold: true });
        if (o && o.right) P.text(P.W - M, y, o.right, 11, { color: GRAY, align: 'r' });
        y += 8;
        if (sub) { y += 12; P.text(M, y, sub, 10.5, { color: GRAY }); }
        if (o && o.name) {
            y += 26;
            const nl = t('Name') + ':', dl = t('Datum') + ':';
            P.text(M, y, nl, 12);
            const nx = M + DR.pdf.width(DR.pdf.enc(nl), 12) + 6, dx = P.W - M - 150;
            P.line(nx, y + 2, dx - 18, y + 2, .6, GRAY);
            P.text(dx, y, dl, 12);
            P.line(dx + DR.pdf.width(DR.pdf.enc(dl), 12) + 6, y + 2, P.W - M, y + 2, .6, GRAY);
        }
        y += 10;
        P.line(M, y, P.W - M, y, 1.2, K);
        return y + 16;
    }
    function foot(D, brand) {
        const n = D.pages;
        D.list.forEach((P, i) => {
            P.text(M, P.H - M + 14, brand || 'Drehsel · drehsel.burnersen.de', 8, { color: GRAY });
            if (n > 1) P.text(P.W - M, P.H - M + 14, (i + 1) + ' / ' + n, 8, { color: GRAY, align: 'r' });
        });
        return D;
    }
    const cutLine = (P, x1, y1, x2, y2) => P.line(x1, y1, x2, y2, .5, LIGHT, [4, 3]);

    /* ---------- Bingo-Karten ----------
       o = { cards: Ergebnis von DR.bingoCards, classic, title, perPage: 1|2|4, name, caller: [Einträge] | null, serie } */
    function bingo(o, t) {
        const D = DR.pdf.doc({ title: o.title });
        const r = o.cards, n = r.size;
        const per = [1, 2, 4].indexOf(+o.perPage) >= 0 ? +o.perPage : 2;
        const total = r.cards.length;
        for (let i = 0; i < total; i += per) {
            const P = D.page(false);
            const slots = per === 1 ? [[M, M, P.W - 2 * M, P.H - 2 * M - 10]]
                : per === 2 ? [[M, M, P.W - 2 * M, (P.H - 2 * M - 10) / 2 - 12], [M, P.H / 2 + 4, P.W - 2 * M, (P.H - 2 * M - 10) / 2 - 12]]
                    : [0, 1, 2, 3].map(q => { const w = (P.W - 2 * M - 24) / 2, h = (P.H - 2 * M - 10) / 2 - 12; return [M + (q % 2) * (w + 24), q < 2 ? M : P.H / 2 + 4, w, h]; });
            if (per === 2) cutLine(P, M - 20, P.H / 2 - 4, P.W - M + 20, P.H / 2 - 4);
            if (per === 4) { cutLine(P, M - 20, P.H / 2 - 4, P.W - M + 20, P.H / 2 - 4); cutLine(P, P.W / 2, M - 20, P.W / 2, P.H - M + 4); }
            slots.forEach((s, j) => { if (r.cards[i + j]) card(P, s, r.cards[i + j], i + j + 1); });
        }
        function card(P, [x, y, w, h], c, no) {
            const big = Math.min(w, h * .9) / 500;
            const titleS = Math.max(12, Math.min(26, 30 * big + 6));
            P.text(x, y + titleS, o.title, titleS, { bold: true });
            P.text(x + w, y + titleS, t('Karte {n}', { n: no }) + (o.serie ? ' · ' + o.serie : ''), Math.max(8, titleS * .5), { color: GRAY, align: 'r' });
            let top = y + titleS + 10;
            const nameH = o.name ? Math.max(18, titleS * 1.2) : 0;
            const letterH = o.classic ? 1 : 0;
            const avail = Math.min(w, h - (top - y) - nameH - 6);
            const cell = avail / (n + (letterH ? .75 : 0));
            const gw = cell * n, gx = x + (w - gw) / 2;
            if (o.classic) {
                'BINGO'.split('').forEach((ch, i) => {
                    P.rect(gx + i * cell + 1.5, top, cell - 3, cell * .7, { fill: DARK, r: 4 });
                    P.text(gx + (i + .5) * cell, top + cell * .53, ch, cell * .5, { bold: true, align: 'c', color: [1, 1, 1] });
                });
                top += cell * .75;
            }
            P.rect(gx, top, gw, gw, { stroke: K, w: 1.6, r: 6 });
            for (let i = 1; i < n; i++) {
                P.line(gx + i * cell, top, gx + i * cell, top + gw, .8, GRAY);
                P.line(gx, top + i * cell, gx + gw, top + i * cell, .8, GRAY);
            }
            c.forEach((it, i) => {
                const cx = gx + (i % n) * cell, cy = top + Math.floor(i / n) * cell;
                if (it == null) {
                    P.rect(cx + 3, cy + 3, cell - 6, cell - 6, { fill: SHADE, r: 4 });
                    P.box(cx + 6, cy + 6, cell - 12, cell - 12, t('Frei'), cell * .26, { bold: true, color: GRAY });
                    return;
                }
                const pad = cell * .1;
                P.box(cx + pad, cy + pad, cell - 2 * pad, cell - 2 * pad, it.t, o.classic ? cell * .46 : Math.min(cell * .3, 40), { bold: true });
            });
            if (o.name) {
                const ny = top + gw + nameH - 2;
                P.text(gx, ny, t('Name') + ':', Math.max(10, titleS * .55));
                P.line(gx + titleS * 2.6, ny + 2, gx + gw, ny + 2, .6, GRAY);
            }
        }
        // Ziehliste für die Spielleitung: alles zum Abhaken
        if (o.caller && o.caller.length) {
            const P = D.page(false);
            let y = head(P, t('Ziehliste für die Spielleitung'), o.title + ' · ' + t('{n} Karten', { n: total }), null, t);
            if (o.classic) {
                const cell = (P.W - 2 * M - 30) / 15;
                'BINGO'.split('').forEach((ch, r) => {
                    const yy = y + r * (cell + 10);
                    P.text(M, yy + cell * .68, ch, cell * .55, { bold: true });
                    for (let c = 0; c < 15; c++) {
                        const x = M + 30 + c * cell;
                        P.rect(x + 2, yy, cell - 4, cell, { stroke: GRAY, w: .7, r: 4 });
                        P.text(x + cell / 2, yy + cell * .64, String(r * 15 + c + 1), cell * .38, { bold: true, align: 'c' });
                    }
                });
            } else {
                list(P, o.caller.map(x => ({ t: x.t })), y, { size: 13, check: true, cols: 3 }, D, t);
            }
        }
        return foot(D);
    }

    /** Liste setzen, in Spalten und über Seiten. Liefert die letzte Seite. */
    function list(P, items, y, o, D, t, title) {
        const size = o.size || 13, lh = size * 1.45, cols = o.cols || 1;
        const colW = (P.W - 2 * M - (cols - 1) * 18) / cols;
        let col = 0, yy = y;
        const box = o.check ? size * .85 : 0;
        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            const textW = colW - (box ? box + 8 : 0) - (o.num ? size * 1.8 : 0);
            const lines = DR.pdf.wrap(it.t, size, false, textW);
            const alines = o.answers && it.a ? DR.pdf.wrap('– ' + it.a, size * .9, false, textW) : [];
            const h = (lines.length + alines.length) * lh + (o.gap || 4);
            if (yy + h > P.H - M - 14) {
                col++;
                yy = y;
                if (col >= cols) { P = D.page(false); col = 0; y = yy = head(P, title || '', '', null, t); }
            }
            const x = M + col * (colW + 18);
            let tx = x;
            if (o.num) { P.text(x + size * 1.4, yy + size, (i + 1) + '.', size, { color: GRAY, align: 'r' }); tx += size * 1.8; }
            if (box) { P.rect(tx, yy + size * .1, box, box, { stroke: K, w: .8, r: 2 }); tx += box + 8; }
            lines.forEach((l, j) => P.text(tx, yy + size + j * lh, l, size));
            alines.forEach((l, j) => P.text(tx, yy + size + (lines.length + j) * lh, l, size * .9, { color: GRAY }));
            if (o.line) P.line(x, yy + h - 2, x + colW, yy + h - 2, .4, LIGHT);
            yy += h;
        }
        return P;
    }

    /* ---------- Stadt-Land-Fluss-Blatt: Spalten mit den Kategorien, Zeilen für die Runden ----------
       o = { cats: [Text], rows, title, name, copies, letters: true (Spalte Buchstabe), points: true } */
    function slf(o, t) {
        const D = DR.pdf.doc({ title: o.title });
        const copies = Math.max(1, Math.min(60, o.copies | 0 || 1));
        for (let c = 0; c < copies; c++) {
            const P = D.page(true);
            const y = head(P, o.title, '', { name: o.name }, t);
            const cols = [t('Buchstabe')].concat(o.cats.slice(0, 10)).concat(o.points ? [t('Punkte')] : []);
            const narrow = 62;
            const wide = (P.W - 2 * M - narrow * (o.points ? 2 : 1)) / Math.max(1, cols.length - (o.points ? 2 : 1));
            const widths = cols.map((x, i) => (i === 0 || (o.points && i === cols.length - 1)) ? narrow : wide);
            const rows = Math.max(3, Math.min(20, o.rows | 0 || 8));
            const headH = 34;
            const rowH = Math.min(48, (P.H - M - 20 - y - headH) / (rows + (o.points ? 1 : 0)));
            let x = M;
            cols.forEach((name, i) => {
                P.rect(x, y, widths[i], headH, { fill: SHADE });
                P.box(x + 4, y + 3, widths[i] - 8, headH - 6, name, 13, { bold: true });
                x += widths[i];
            });
            const totalH = headH + rowH * (rows + (o.points ? 1 : 0));
            P.rect(M, y, P.W - 2 * M, totalH, { stroke: K, w: 1.4 });
            x = M;
            for (let i = 0; i < cols.length - 1; i++) { x += widths[i]; P.line(x, y, x, y + totalH, i === 0 ? 1.2 : .7, i === 0 ? K : GRAY); }
            for (let r = 0; r <= rows; r++) P.line(M, y + headH + r * rowH, P.W - M, y + headH + r * rowH, r === 0 ? 1.2 : .6, r === 0 ? K : LIGHT);
            if (o.points) {
                const yy = y + headH + rows * rowH;
                P.line(M, yy, P.W - M, yy, 1.2, K);
                P.box(P.W - M - narrow - wide - 4, yy + 2, wide, rowH - 4, t('Summe'), 13, { bold: true, align: 'c' });
            }
        }
        return foot(D);
    }

    /* ---------- Liste ----------
       o = { title, sub, items, answers: inline|end|none, size, cols, num, check } */
    function plainList(o, t) {
        const D = DR.pdf.doc({ title: o.title });
        let P = D.page(false);
        const y = head(P, o.title, o.sub, null, t);
        P = list(P, o.items, y, { size: o.size, cols: o.cols, num: o.num, check: o.check, answers: o.answers === 'inline', line: true, gap: o.size * .5 }, D, t, o.title);
        if (o.answers === 'end' && o.items.some(x => x.a)) {
            P = D.page(false);
            const y2 = head(P, t('Auflösungen'), o.title, null, t);
            list(P, o.items.map(x => ({ t: x.t + (x.a ? ' – ' + x.a : ''), a: '' })), y2, { size: Math.max(10, o.size * .85), cols: o.cols, num: o.num, line: true, gap: 4 }, D, t, t('Auflösungen'));
        }
        return foot(D);
    }

    /* ---------- Karten zum Ausschneiden ----------
       o = { title, items, per: 6|8|12, answers: true|false } */
    function cards(o, t) {
        const D = DR.pdf.doc({ title: o.title });
        const per = [4, 6, 8, 12].indexOf(+o.per) >= 0 ? +o.per : 8;
        const cols = per === 4 ? 2 : per === 12 ? 3 : 2, rows = per / cols;
        for (let i = 0; i < o.items.length; i += per) {
            const P = D.page(false);
            const w = (P.W - 2 * M) / cols, h = (P.H - 2 * M - 10) / rows;
            for (let c = 1; c < cols; c++) cutLine(P, M + c * w, M - 16, M + c * w, P.H - M + 2);
            for (let r = 1; r < rows; r++) cutLine(P, M - 16, M + r * h, P.W - M + 16, M + r * h);
            P.rect(M, M, P.W - 2 * M, P.H - 2 * M - 10, { stroke: LIGHT, w: .5, dash: [4, 3] });
            for (let j = 0; j < per && i + j < o.items.length; j++) {
                const it = o.items[i + j];
                const x = M + (j % cols) * w, y = M + Math.floor(j / cols) * h;
                const pad = Math.min(w, h) * .09;
                P.text(x + pad, y + pad + 8, o.title, 8, { color: GRAY });
                const ansH = o.answers && it.a ? h * .26 : 0;
                P.box(x + pad, y + pad + 14, w - 2 * pad, h - 2 * pad - 14 - ansH, it.t, 34, { bold: true });
                if (ansH) {
                    P.line(x + pad, y + h - pad - ansH + 4, x + w - pad, y + h - pad - ansH + 4, .5, LIGHT);
                    P.box(x + pad, y + h - pad - ansH + 8, w - 2 * pad, ansH - 10, it.a, 16, { color: GRAY });
                }
            }
        }
        return foot(D);
    }

    /* ---------- Rechenblätter: jedes anders, auf Wunsch mit Lösungen hinten ----------
       o = { sheets: Ergebnis von DR.mathSheets, title, name, solutions, size } */
    function math(o, t) {
        const D = DR.pdf.doc({ title: o.title });
        const size = Math.max(12, Math.min(26, o.size || 18));
        o.sheets.forEach((tasks, si) => {
            const P = D.page(false);
            const y = head(P, o.title, '', { name: o.name, right: t('Blatt {n}', { n: si + 1 }) }, t);
            const cols = 2, colW = (P.W - 2 * M - 30) / cols;
            const rows = Math.ceil(tasks.length / cols);
            const rowH = Math.min(size * 2.6, (P.H - M - 24 - y) / rows);
            tasks.forEach((m, i) => {
                const c = Math.floor(i / rows), r = i % rows;
                const x = M + c * (colW + 30), yy = y + r * rowH + size;
                P.text(x, yy, (i + 1) + '.', size * .7, { color: GRAY });
                const tx = x + size * 1.6;
                const task = m.t + ' =';
                P.text(tx, yy, task, size, { bold: true });
                const lx = tx + DR.pdf.width(DR.pdf.enc(task), size, true) + 8;
                P.line(lx, yy + 3, Math.min(x + colW, lx + size * 4), yy + 3, .7, GRAY);
            });
        });
        if (o.solutions) {
            let P = D.page(false);
            let y = head(P, t('Lösungen'), o.title, null, t);
            const colW = (P.W - 2 * M - 20) / 3;
            let col = 0, yy = y;
            o.sheets.forEach((tasks, si) => {
                const h = 16 + tasks.length * 12.5 + 12;
                if (yy + h > P.H - M - 14) { col++; yy = y; if (col >= 3) { P = D.page(false); y = yy = head(P, t('Lösungen'), o.title, null, t); col = 0; } }
                const x = M + col * (colW + 10);
                P.text(x, yy + 11, t('Blatt {n}', { n: si + 1 }), 11, { bold: true });
                tasks.forEach((m, i) => P.text(x, yy + 26 + i * 12.5, (i + 1) + '.  ' + m.t + ' = ' + m.a, 9.5));
                yy += h;
            });
        }
        return foot(D);
    }

    DR.print = { bingo, slf, plainList, cards, math };
})(typeof window !== 'undefined' ? window : globalThis);
