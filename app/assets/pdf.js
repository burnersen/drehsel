/* Drehsel – PDF ohne fremde Bibliothek und ohne Netz, nach dem Vorbild von Suchsel und Kaufen.
   Ein Dokument besteht aus Seiten mit einfachen Zeichenbefehlen (Text, Linie, Rechteck, Kreis), in Punkt (1/72 Zoll), y von oben.
   Dieselbe Befehlsliste wird als PDF geschrieben oder auf ein Canvas gezeichnet: die Vorschau zeigt genau, was aus dem Drucker kommt.
   Schrift ist Helvetica, die jedes PDF-Programm mitbringt, kodiert als WinAnsi: Umlaute, ß und Akzente gehen, Emojis fallen weg.
   DR.pdf.doc({ title, author }) → { page(land) → Seite, pages, W(i), H(i), draw(ctx, i), bytes(), width, wrap, fit } */
(function (G) {
    'use strict';
    const DR = G.DR = G.DR || {};
    // Breiten der Zeichen 32 bis 255 in Tausendsteln der Schriftgröße (Adobe-Metriken, WinAnsi)
    const W = {
        r: [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,350,556,350,222,556,333,1000,556,556,333,1000,667,333,1000,350,611,350,350,222,222,333,333,350,556,1000,333,1000,500,333,944,350,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500],
        b: [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,350,556,350,278,556,500,1000,556,556,333,1000,667,333,1000,350,611,350,350,278,278,500,500,350,556,1000,333,1000,556,333,944,350,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556],
    };
    const CSS_FONT = 'Helvetica, Arial, "Liberation Sans", "Nimbus Sans", sans-serif';
    // Zeichen, die WinAnsi zwischen 128 und 159 anders belegt als Unicode
    const WIN = { '€': 128, '‚': 130, 'ƒ': 131, '„': 132, '…': 133, '†': 134, '‡': 135, 'ˆ': 136, '‰': 137, 'Š': 138, '‹': 139, 'Œ': 140, 'Ž': 142,
        '‘': 145, '’': 146, '“': 147, '”': 148, '•': 149, '–': 150, '—': 151, '˜': 152, '™': 153, 'š': 154, '›': 155, 'œ': 156, 'ž': 158, 'Ÿ': 159 };
    const UNWIN = {};
    for (const ch in WIN) UNWIN[WIN[ch]] = ch;
    const SUBST = { '→': '->', '−': '-', '×': '\xd7', '÷': '\xf7', '✓': 'v', '★': '*', '·': '\xb7' };
    /** Text in WinAnsi-Bytes (als String mit Zeichencodes unter 256). Unbekanntes ohne Akzent, sonst weg (etwa Emojis). */
    function enc(s) {
        let out = '';
        for (const ch of String(s == null ? '' : s).replace(/\s+/g, ' ')) {
            const c = ch.codePointAt(0);
            if ((c >= 32 && c < 127) || (c >= 160 && c < 256)) out += ch;
            else if (WIN[ch]) out += String.fromCharCode(WIN[ch]);
            else if (SUBST[ch]) out += SUBST[ch];
            else {
                const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
                if (base && base !== ch && base.codePointAt(0) < 256) out += enc(base);
            }
        }
        return out.replace(/ {2,}/g, ' ').trim();
    }
    const dec = s => s.replace(/[\x80-\x9f]/g, ch => UNWIN[ch.charCodeAt(0)] || '');
    const esc = s => s.replace(/[\\()]/g, '\\$&');
    const f = n => (Math.round(n * 100) / 100).toString();
    const A4 = [595.28, 841.89];

    /** Breite eines (schon kodierten) Texts in Punkt */
    function width(s, size, bold) {
        const t = W[bold ? 'b' : 'r'];
        let w = 0;
        for (let i = 0; i < s.length; i++) w += t[s.charCodeAt(i) - 32] || 556;
        return w * size / 1000;
    }
    /** Zeilenumbruch an Leerzeichen; ein Wort, das allein nicht passt, steht trotzdem allein in seiner Zeile */
    function wrap(s, size, bold, max) {
        const words = enc(s).split(' ').filter(Boolean);
        const lines = [];
        let cur = '';
        for (const w of words) {
            const tryS = cur ? cur + ' ' + w : w;
            if (!cur || width(tryS, size, bold) <= max) cur = tryS;
            else { lines.push(cur); cur = w; }
        }
        if (cur) lines.push(cur);
        return lines;
    }
    /** Größte Schrift (höchstens max), mit der s umbrochen in den Kasten w × h passt, ohne ein Wort zu trennen */
    function fit(s, w, h, max, bold, lh) {
        lh = lh || 1.15;
        for (let size = max; size >= 4; size -= size > 20 ? 1 : .5) {
            const lines = wrap(s, size, bold, w);
            if (lines.length * size * lh <= h && lines.every(l => width(l, size, bold) <= w)) return { size, lines };
        }
        return { size: 4, lines: wrap(s, 4, bold, w) };
    }

    function doc(meta) {
        meta = meta || {};
        const pages = [];
        function page(land) {
            const PW = land ? A4[1] : A4[0], PH = land ? A4[0] : A4[1];
            const ops = [];
            const P = {
                W: PW, H: PH, ops,
                /** Text: o = { bold, align: l|c|r, color: [r,g,b] (0 bis 1) } */
                text(x, y, s, size, o) { o = o || {}; const e = enc(s); if (e) ops.push({ k: 't', x, y, s: e, size, bold: !!o.bold, align: o.align || 'l', color: o.color || [0, 0, 0] }); return P; },
                line(x1, y1, x2, y2, w, color, dash) { ops.push({ k: 'l', x1, y1, x2, y2, w: w || .8, color: color || [0, 0, 0], dash }); return P; },
                /** Rechteck: o = { fill, stroke, w, r (runde Ecken), dash } */
                rect(x, y, w, h, o) { ops.push(Object.assign({ k: 'r', x, y, wd: w, ht: h }, o || {})); return P; },
                circle(cx, cy, r, o) { ops.push(Object.assign({ k: 'c', cx, cy, rr: r }, o || {})); return P; },
                /** Text so groß wie möglich in einen Kasten, mittig */
                box(x, y, w, h, s, max, o) {
                    o = o || {};
                    const r = fit(s, w, h, max, o.bold, o.lh);
                    const lh = r.size * (o.lh || 1.15);
                    const top = y + (h - r.lines.length * lh) / 2 + r.size * .78 + (lh - r.size) / 2;
                    r.lines.forEach((l, i) => ops.push({ k: 't', x: o.align === 'l' ? x : x + w / 2, y: top + i * lh, s: l, size: r.size, bold: !!o.bold, align: o.align || 'c', color: o.color || [0, 0, 0] }));
                    return r;
                },
            };
            pages.push(P);
            return P;
        }
        /* Rechteck mit runden Ecken als PDF-Pfad (Ursprung unten links) */
        const roundPath = (L, T, w, h, r) => {
            const R = L + w, B = T - h, k = r * .5523;
            if (!r) return f(L) + ' ' + f(B) + ' ' + f(w) + ' ' + f(h) + ' re';
            return [f(L + r) + ' ' + f(T) + ' m', f(R - r) + ' ' + f(T) + ' l', f(R - r + k) + ' ' + f(T) + ' ' + f(R) + ' ' + f(T - r + k) + ' ' + f(R) + ' ' + f(T - r) + ' c',
                f(R) + ' ' + f(B + r) + ' l', f(R) + ' ' + f(B + r - k) + ' ' + f(R - r + k) + ' ' + f(B) + ' ' + f(R - r) + ' ' + f(B) + ' c', f(L + r) + ' ' + f(B) + ' l',
                f(L + r - k) + ' ' + f(B) + ' ' + f(L) + ' ' + f(B + r - k) + ' ' + f(L) + ' ' + f(B + r) + ' c', f(L) + ' ' + f(T - r) + ' l',
                f(L) + ' ' + f(T - r + k) + ' ' + f(L + r - k) + ' ' + f(T) + ' ' + f(L + r) + ' ' + f(T) + ' c', 'h'].join(' ');
        };
        const col = (c, stroke) => c.map(f).join(' ') + (stroke ? ' RG' : ' rg');
        function stream(P) {
            const PH = P.H;
            return P.ops.map(op => {
                if (op.k === 't') {
                    const w = width(op.s, op.size, op.bold);
                    const x = op.align === 'r' ? op.x - w : op.align === 'c' ? op.x - w / 2 : op.x;
                    return 'BT ' + col(op.color) + ' /' + (op.bold ? 'F2 ' : 'F1 ') + f(op.size) + ' Tf ' + f(x) + ' ' + f(PH - op.y) + ' Td (' + esc(op.s) + ') Tj ET';
                }
                if (op.k === 'l') return 'q ' + f(op.w) + ' w ' + col(op.color, true) + (op.dash ? ' [' + op.dash.map(f).join(' ') + '] 0 d' : '') + ' ' + f(op.x1) + ' ' + f(PH - op.y1) + ' m ' + f(op.x2) + ' ' + f(PH - op.y2) + ' l S Q';
                const paint = op.fill && op.stroke ? 'B' : op.fill ? 'f' : 'S';
                const set = 'q ' + (op.fill ? col(op.fill) + ' ' : '') + (op.stroke ? col(op.stroke, true) + ' ' + f(op.w || .8) + ' w ' : '') + (op.dash ? '[' + op.dash.map(f).join(' ') + '] 0 d ' : '');
                if (op.k === 'r') return set + roundPath(op.x, PH - op.y, op.wd, op.ht, op.r || 0) + ' ' + paint + ' Q';
                const k = op.rr * .5523, cx = op.cx, cy = PH - op.cy, r = op.rr;
                return set + [f(cx + r) + ' ' + f(cy) + ' m', f(cx + r) + ' ' + f(cy + k) + ' ' + f(cx + k) + ' ' + f(cy + r) + ' ' + f(cx) + ' ' + f(cy + r) + ' c',
                    f(cx - k) + ' ' + f(cy + r) + ' ' + f(cx - r) + ' ' + f(cy + k) + ' ' + f(cx - r) + ' ' + f(cy) + ' c',
                    f(cx - r) + ' ' + f(cy - k) + ' ' + f(cx - k) + ' ' + f(cy - r) + ' ' + f(cx) + ' ' + f(cy - r) + ' c',
                    f(cx + k) + ' ' + f(cy - r) + ' ' + f(cx + r) + ' ' + f(cy - k) + ' ' + f(cx + r) + ' ' + f(cy) + ' c', 'h'].join(' ') + ' ' + paint + ' Q';
            }).join('\n');
        }
        function bytes() {
            const objs = [];
            const add = s => { objs.push(s); return objs.length; };
            const cat = add(''), pagesId = add('');
            const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
            const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
            const kids = pages.map(P => {
                const s = stream(P);
                const c = add('<< /Length ' + s.length + ' >>\nstream\n' + s + '\nendstream');
                return add('<< /Type /Page /Parent ' + pagesId + ' 0 R /MediaBox [0 0 ' + f(P.W) + ' ' + f(P.H) + '] /Resources << /Font << /F1 ' + f1 + ' 0 R /F2 ' + f2 + ' 0 R >> >> /Contents ' + c + ' 0 R >>');
            });
            objs[cat - 1] = '<< /Type /Catalog /Pages ' + pagesId + ' 0 R >>';
            objs[pagesId - 1] = '<< /Type /Pages /Kids [' + kids.map(k => k + ' 0 R').join(' ') + '] /Count ' + kids.length + ' >>';
            const info = add('<< /Title (' + esc(enc(meta.title || 'Drehsel')) + ') /Producer (Drehsel) >>');
            let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
            const offs = objs.map((s, i) => { const at = out.length; out += (i + 1) + ' 0 obj\n' + s + '\nendobj\n'; return at; });
            const xref = out.length;
            out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offs.map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('');
            out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root ' + cat + ' 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
            const res = new Uint8Array(out.length);
            for (let i = 0; i < out.length; i++) res[i] = out.charCodeAt(i) & 255;
            return res;
        }
        /** Seite i auf ein Canvas zeichnen; der Kontext muss so skaliert sein, dass 1 Einheit 1 Punkt ist */
        function draw(ctx, i) {
            const P = pages[i];
            if (!P) return;
            const css = c => 'rgb(' + c.map(v => Math.round(v * 255)).join(',') + ')';
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, P.W, P.H);
            ctx.textBaseline = 'alphabetic';
            for (const op of P.ops) {
                ctx.setLineDash(op.dash || []);
                if (op.k === 't') {
                    ctx.font = (op.bold ? 'bold ' : '') + op.size + 'px ' + CSS_FONT;
                    ctx.fillStyle = css(op.color);
                    const w = width(op.s, op.size, op.bold);
                    const x = op.align === 'r' ? op.x - w : op.align === 'c' ? op.x - w / 2 : op.x;
                    ctx.textAlign = 'left';
                    ctx.fillText(dec(op.s), x, op.y, w * 1.02);
                } else if (op.k === 'l') {
                    ctx.strokeStyle = css(op.color); ctx.lineWidth = op.w;
                    ctx.beginPath(); ctx.moveTo(op.x1, op.y1); ctx.lineTo(op.x2, op.y2); ctx.stroke();
                } else {
                    ctx.beginPath();
                    if (op.k === 'r') { if (op.r && ctx.roundRect) ctx.roundRect(op.x, op.y, op.wd, op.ht, op.r); else ctx.rect(op.x, op.y, op.wd, op.ht); }
                    else ctx.arc(op.cx, op.cy, op.rr, 0, Math.PI * 2);
                    if (op.fill) { ctx.fillStyle = css(op.fill); ctx.fill(); }
                    if (op.stroke) { ctx.strokeStyle = css(op.stroke); ctx.lineWidth = op.w || .8; ctx.stroke(); }
                }
            }
            ctx.setLineDash([]);
        }
        return { page, get pages() { return pages.length; }, W: i => pages[i] ? pages[i].W : A4[0], H: i => pages[i] ? pages[i].H : A4[1], draw, bytes, list: pages };
    }

    DR.pdf = { doc, enc, width, wrap, fit, A4 };
})(typeof window !== 'undefined' ? window : globalThis);
