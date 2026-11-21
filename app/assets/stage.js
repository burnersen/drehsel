/* Drehsel – die Bühne: alles, was man sieht und antippt, während gespielt wird.
   Rad (Canvas, mit Schwung drehbar), Walzen, große Karte, Würfel, Bingo-Tafel, ABC-Runde, Gruppen, Ämter, Sanduhr.
   Die Bühne bekommt von app.js ein fertiges Modell (show) und spielt die Drehung ab (spin). Gezogen wird vorher in engine.js,
   die Animation landet nur dort, wo das Ergebnis schon feststeht. Schriften passen sich der freien Fläche an (fit). */
(function (G) {
    'use strict';
    const DR = G.DR = G.DR || {};
    const doc = G.document;

    /* ---------- Bausteine ---------- */
    function el(tag, props, ...kids) {
        const [name, ...cls] = tag.split('.');
        const e = doc.createElement(name || 'div');
        if (cls.length) e.className = cls.join(' ');
        for (const k in props || {}) {
            const v = props[k];
            if (v == null || v === false) continue;
            if (k === 'class') e.className += (e.className ? ' ' : '') + v;
            else if (k === 'text') e.textContent = v;
            else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
            else if (k === 'vars') for (const n in v) e.style.setProperty(n, v[n]);
            else if (k === 'value') e.value = v;
            else if (k === 'checked') e.checked = !!v;
            else if (k === 'selected') e.selected = !!v;
            else e.setAttribute(k, v === true ? '' : v);
        }
        for (const c of kids.flat(3)) if (c != null && c !== false) e.append(c.nodeType ? c : doc.createTextNode(String(c)));
        return e;
    }
    const ICONS = {
        menu: 'M4 7h16M4 12h16M4 17h16',
        sliders: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4',
        expand: 'M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5',
        compress: 'M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5',
        play: 'M7 4.5v15l12.5-7.5z',
        close: 'M6 6l12 12M18 6L6 18',
        plus: 'M12 5v14M5 12h14',
        minus: 'M5 12h14',
        undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
        history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',
        check: 'M20 6L9 17l-5-5',
        edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z',
        trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6',
        share: 'M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13',
        download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
        upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
        copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
        gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
        help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
        info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
        install: 'M4 4h16v12H4zM8 20h8M12 16v4M12 7v6M9 10l3 3 3-3',
        heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z',
        github: 'M9 19c-5 1.5-5-2.5-7-3m14 6v-3.9a3.4 3.4 0 0 0-.9-2.6c3.1-.4 6.4-1.5 6.4-7A5.4 5.4 0 0 0 20 4.8 5 5 0 0 0 19.9 1S18.7.7 16 2.5a13.4 13.4 0 0 0-7 0C6.3.7 5.1 1 5.1 1A5 5 0 0 0 5 4.8a5.4 5.4 0 0 0-1.5 3.7c0 5.4 3.3 6.6 6.4 7A3.4 3.4 0 0 0 9 18.1V22',
        globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20',
        left: 'M15 18l-6-6 6-6',
        right: 'M9 18l6-6-6-6',
        down: 'M6 9l6 6 6-6',
        eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
        timer: 'M10 2h4M12 14l3-3M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
        sound: 'M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14',
        palette: 'M12 22a10 10 0 1 1 10-10c0 2.2-1.8 3-3.5 3H16a2 2 0 0 0-1.5 3.3A2 2 0 0 1 12 22zM7.5 11.5h.01M10.5 7.5h.01M15.5 8.5h.01',
        font: 'M4 20L10 4h1l6 16M6.5 14h8M17 20h4',
        link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
        file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
        save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8',
        home: 'M3 11l9-8 9 8M5 9.5V21h14V9.5',
        // Spiele
        wheel: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9L4.9 19.1',
        pen: 'M3 21h4L19.5 8.5a2.1 2.1 0 0 0-3-3L4 18v3zM14.5 7.5l2 2M14 21h7',
        chat: 'M21 12a8 8 0 0 1-11.8 7L4 20.5l1.4-4.6A8 8 0 1 1 21 12zM8.5 12h.01M12 12h.01M15.5 12h.01',
        grid: 'M4 4h16v16H4zM4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16',
        mask: 'M4 5h16v6a8 8 0 0 1-16 0zM8.5 10h1.5M14 10h1.5M9 14.5c1.7 1.3 4.3 1.3 6 0',
        abc: 'M3 17l3.5-10L10 17M4.2 13.5h4.6M13 7h3.2a2.3 2.3 0 0 1 0 4.6H13zM13 11.6h3.8a2.7 2.7 0 0 1 0 5.4H13z',
        album: 'M4 4h16v16H4zM4 15l4.5-4.5 4 4L15 12l5 5M15.5 8.5h.01',
        quote: 'M10 11H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6c0 3-2 5-5 6M20 11h-4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6c0 3-2 5-5 6',
        chair: 'M7 3v9h10V3M5 12h14v3H5zM7 15v6M17 15v6',
        music: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
        book: 'M2 4h7a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H2zM22 4h-7a3 3 0 0 0-3 3v14a2 2 0 0 1 2-2h8z',
        run: 'M14 4.5a1.5 1.5 0 1 0 0-.01M8 21l3-6 3 2 1 4M6 12l3-4 4 1 2 4 4 1M11 15l-1-4',
        hand: 'M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15',
        calc: 'M5 3h14v18H5zM8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01',
        smile: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01',
        rhyme: 'M4 6h9M4 10h6M4 14h9M4 18h6M17 6v10.5M17 16.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM17 6l4 1.5',
        person: 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1',
        people: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M16 3.1a4 4 0 0 1 0 7.8M22 21v-1a6 6 0 0 0-4-5.7',
        list: 'M9 6h12M9 12h12M9 18h12M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',
        letter: 'M5 20L11 4h2l6 16M7.5 14h9',
        hash: 'M5 9h15M4 15h15M10 3L8 21M16 3l-2 18',
        dice: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01',
        balls: 'M7 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM17 14a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM8 22a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
        scale: 'M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z',
        coin: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z',
        star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z',
    };
    function icon(name) {
        const s = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
        s.setAttribute('viewBox', '0 0 24 24');
        s.setAttribute('aria-hidden', 'true');
        const p = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
        p.setAttribute('d', ICONS[name] || ICONS.wheel);
        s.append(p);
        return s;
    }

    /** Schrift so groß wie möglich, ohne dass etwas übersteht oder ein Wort getrennt wird. Der Kasten bestimmt die Größe. */
    function fit(node, max, min) {
        if (!node || !node.isConnected) return 0;
        min = min || 10;
        const fits = () => node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1;
        let lo = min, hi = Math.max(min, Math.floor(max || node.clientHeight || 100));
        node.style.fontSize = hi + 'px';
        if (fits()) return hi;
        while (hi - lo > 1) {
            const mid = (lo + hi) >> 1;
            node.style.fontSize = mid + 'px';
            if (fits()) lo = mid; else hi = mid;
        }
        node.style.fontSize = lo + 'px';
        return lo;
    }
    const css = (name, from) => getComputedStyle(from || doc.documentElement).getPropertyValue(name).trim();
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const raf = () => new Promise(r => requestAnimationFrame(r));

    /* ---------- Töne: aus dem Gerät erzeugt, keine Dateien ---------- */
    const Sound = {
        ctx: null, on: true, vol: .6,
        get() {
            if (!this.ctx) { const A = G.AudioContext || G.webkitAudioContext; if (!A) return null; this.ctx = new A(); }
            if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
            return this.ctx;
        },
        unlock() { if (this.on) this.get(); },
        tone(freq, dur, type, gain, when) {
            const c = this.on && this.get();
            if (!c) return;
            const t = c.currentTime + (when || 0), o = c.createOscillator(), g = c.createGain();
            o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
            g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime((gain || .2) * this.vol, t + .005);
            g.gain.exponentialRampToValueAtTime(.0001, t + dur);
            o.connect(g).connect(c.destination);
            o.start(t); o.stop(t + dur + .02);
        },
        tick() { this.tone(1500, .035, 'square', .05); },
        land() { this.tone(660, .5, 'sine', .22); this.tone(990, .6, 'sine', .14, .06); },
        reveal() { this.tone(520, .25, 'triangle', .15); this.tone(780, .35, 'triangle', .12, .08); },
        gong() { [[196, 2.4, .35], [293.7, 2, .18], [392, 1.6, .12], [587, 1.2, .06]].forEach(([f, d, g]) => this.tone(f, d, 'sine', g)); },
    };

    /* ---------- Das Rad ---------- */
    class Wheel {
        constructor(box, hooks) {
            this.box = box;
            this.hooks = hooks;
            this.cv = el('canvas.wheel', { role: 'img' });
            box.append(this.cv);
            this.ctx = this.cv.getContext('2d');
            this.items = [];
            this.rot = 0;
            this.flap = 0;
            this.hi = -1;
            this.busy = false;
            this.bindPointer();
        }
        set(items, hi, colors) {
            this.items = items;
            this.hi = hi == null ? -1 : hi;
            this.colors = colors;
            this.cv.setAttribute('aria-label', items.map(x => x.t).slice(0, 40).join(', '));
            this.resize();
        }
        resize() {
            const r = this.box.getBoundingClientRect();
            const dpr = Math.min(3, G.devicePixelRatio || 1);
            const s = Math.max(40, Math.floor(Math.min(r.width, r.height)));
            this.size = s;
            this.cv.style.width = s + 'px';
            this.cv.style.height = s + 'px';
            this.cv.width = Math.round(s * dpr);
            this.cv.height = Math.round(s * dpr);
            this.dpr = dpr;
            this.labelCache = null;
            this.draw();
        }
        get seg() { return Math.PI * 2 / Math.max(1, this.items.length); }
        /** Welches Feld gerade unter dem Zeiger steht */
        under(rot) {
            const n = this.items.length;
            if (!n) return -1;
            const a = (((-rot) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            return Math.min(n - 1, Math.floor(a / this.seg));
        }
        /** Welche Farbe der Reihe das Feld hat (für die passende Schriftfarbe) */
        inkIndex(i) {
            const k = this.colors.seg.length, n = this.items.length;
            let ci = i % k;
            if (n > 1 && i === n - 1 && ci === 0 && k > 2) ci = 1;
            return ci;
        }
        segColor(i) {
            const it = this.items[i], pal = this.colors.seg, k = pal.length, n = this.items.length;
            if (it && it.c) return it.c;
            let ci = i % k;
            if (n > 1 && i === n - 1 && ci === 0 && k > 2) ci = 1;    // letztes Feld nicht in derselben Farbe wie das erste
            return pal[ci];
        }
        draw() {
            const c = this.ctx, d = this.dpr, S = this.size * d, n = this.items.length;
            const col = this.colors;
            if (!col) return;
            c.setTransform(1, 0, 0, 1, 0, 0);
            c.clearRect(0, 0, S, S);
            const ptrH = S * .085;
            const cx = S / 2, cy = S / 2 + ptrH * .32;
            const R = S / 2 - ptrH * .5 - S * .02;
            const rimW = Math.max(3 * d, R * .045);
            const Ri = R - rimW;
            this.geo = { cx: cx / d, cy: cy / d, R: R / d };
            // Rand mit sanftem Schatten
            c.save();
            c.shadowColor = 'rgba(0,0,0,.22)'; c.shadowBlur = S * .03; c.shadowOffsetY = S * .008;
            c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fillStyle = col.rim; c.fill();
            c.restore();
            const a = this.seg, rot = this.rot;
            if (!n) {
                c.beginPath(); c.arc(cx, cy, Ri, 0, Math.PI * 2); c.fillStyle = col.card; c.fill();
            }
            for (let i = 0; i < n; i++) {
                const a0 = -Math.PI / 2 + rot + i * a;
                c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, Ri, a0, a0 + a); c.closePath();
                c.fillStyle = this.segColor(i); c.fill();
            }
            // Trennlinien
            if (n > 1 && n <= 180) {
                c.strokeStyle = col.rim; c.lineWidth = Math.max(1, Ri * (n > 40 ? .004 : .008));
                c.beginPath();
                for (let i = 0; i < n; i++) { const a0 = -Math.PI / 2 + rot + i * a; c.moveTo(cx, cy); c.lineTo(cx + Ri * Math.cos(a0), cy + Ri * Math.sin(a0)); }
                c.stroke();
            }
            // Gewinnerfeld hervorheben: die anderen etwas zurücknehmen, die Schrift bleibt lesbar
            const hubR = Ri * .17;
            const hi = this.hi >= 0 && this.hi < n && n > 1 ? this.hi : -1;
            if (hi >= 0) {
                c.save();
                c.beginPath();
                for (let i = 0; i < n; i++) {
                    if (i === hi) continue;
                    const a0 = -Math.PI / 2 + rot + i * a;
                    c.moveTo(cx, cy); c.arc(cx, cy, Ri, a0, a0 + a); c.closePath();
                }
                c.fillStyle = 'rgba(0,0,0,.28)'; c.fill();
                c.restore();
            }
            // Beschriftung
            if (n && n <= 90) this.drawLabels(c, cx, cy, Ri, hubR, rot, hi);
            if (hi >= 0) {
                const a0 = -Math.PI / 2 + rot + hi * a;
                c.save();
                c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, Ri - Math.max(2 * d, Ri * .012), a0, a0 + a); c.closePath();
                c.lineJoin = 'round'; c.lineWidth = Math.max(3 * d, Ri * .022); c.strokeStyle = col.rim; c.stroke();
                c.restore();
            }
            // Nabe mit Zeichen zum Antippen
            c.beginPath(); c.arc(cx, cy, hubR, 0, Math.PI * 2); c.fillStyle = col.card; c.fill();
            c.lineWidth = Math.max(2 * d, hubR * .12); c.strokeStyle = col.rim; c.stroke();
            if (!this.busy) {
                const s = hubR * .42;
                c.beginPath(); c.moveTo(cx - s * .55, cy - s); c.lineTo(cx + s, cy); c.lineTo(cx - s * .55, cy + s); c.closePath();
                c.fillStyle = col.acc; c.fill();
            } else {
                c.beginPath(); c.arc(cx, cy, hubR * .28, 0, Math.PI * 2); c.fillStyle = col.acc; c.fill();
            }
            // Zeiger oben, wippt bei jedem Feld
            c.save();
            const py = cy - R - ptrH * .18;
            c.translate(cx, py);
            c.rotate(this.flap);
            c.beginPath();
            const w = ptrH * .42;
            c.moveTo(-w, -ptrH * .45); c.lineTo(w, -ptrH * .45); c.lineTo(0, ptrH * .62); c.closePath();
            c.shadowColor = 'rgba(0,0,0,.3)'; c.shadowBlur = ptrH * .15; c.shadowOffsetY = ptrH * .05;
            c.fillStyle = col.acc; c.fill();
            c.shadowColor = 'transparent';
            c.lineJoin = 'round'; c.lineWidth = Math.max(2 * d, ptrH * .07); c.strokeStyle = col.card; c.stroke();
            c.restore();
        }
        drawLabels(c, cx, cy, Ri, hubR, rot, hi) {
            const n = this.items.length, a = this.seg, d = this.dpr;
            const ff = this.colors.font, fw = this.colors.weight || 800, scale = this.colors.scale || 1;
            const minPx = 10 * d;
            const short = this.items.every(x => (x.p ? 0 : x.t.length) <= 3);
            if (!this.labelCache) {
                // Größe einmal ausrechnen: alle Felder gleich groß beschriftet, das ruhigere Bild
                const L = [];
                if (short) {
                    const r0 = Ri * (n <= 8 ? .72 : .8);
                    const arc = 2 * r0 * Math.sin(Math.min(a, Math.PI * .9) / 2);
                    let px = Math.min(Ri * .26, arc * .62, (Ri - hubR) * .42) * scale;
                    c.font = fw + ' ' + px + 'px ' + ff;
                    const wmax = Math.max(...this.items.map(x => c.measureText(x.t).width), 1);
                    if (wmax > arc * .86) px *= arc * .86 / wmax;
                    for (let i = 0; i < n; i++) L.push({ t: this.items[i].t, px: Math.max(minPx, px), r: r0 });
                } else {
                    const len = Ri * .9 - hubR * 1.25;
                    const hgt = 2 * Ri * .62 * Math.sin(Math.min(a, Math.PI * .5) / 2) * .78;
                    let base = Math.min(Ri * .13, hgt) * scale;
                    c.font = fw + ' ' + base + 'px ' + ff;
                    const pxs = this.items.map(x => { const w = c.measureText(x.t).width; return w > len ? base * len / w : base; });
                    // Eine gemeinsame Größe, außer ein einzelner langer Eintrag würde alle winzig machen
                    pxs.sort((x, y) => x - y);
                    const common = Math.max(pxs[Math.floor(pxs.length * .2)] || base, minPx);
                    // Zu klein zum Lesen? Dann lieber ein ruhiges Rad ohne Beschriftung, das Ergebnis steht ja groß daneben
                    if (common < 15 * d) { this.labelCache = { L: [], short: false, none: true }; return; }
                    for (let i = 0; i < n; i++) {
                        const t = this.items[i].t;
                        c.font = fw + ' ' + common + 'px ' + ff;
                        let s = t, px = common;
                        if (c.measureText(s).width > len) {
                            px = Math.max(minPx, common * len / c.measureText(s).width);
                            c.font = fw + ' ' + px + 'px ' + ff;
                            while (s.length > 2 && c.measureText(s + '…').width > len) s = s.slice(0, -1);
                            if (s !== t) s = s.trim() + '…';
                        }
                        L.push({ t: s, px, r: Ri * .9 });
                    }
                }
                this.labelCache = { L, short };
            }
            if (this.labelCache.none) return;
            c.save();
            c.textBaseline = 'middle';
            for (let i = 0; i < n; i++) {
                const L = this.labelCache.L[i];
                const m = -Math.PI / 2 + rot + (i + .5) * a;
                const own = this.items[i].c;
                c.fillStyle = own ? DR.look.inkOn(own) : this.colors.ink[this.inkIndex(i)] || '#000';
                c.globalAlpha = hi >= 0 && i !== hi ? .62 : 1;
                c.font = fw + ' ' + L.px + 'px ' + ff;
                c.save();
                if (this.labelCache.short) {
                    c.translate(cx + L.r * Math.cos(m), cy + L.r * Math.sin(m));
                    c.rotate(m + Math.PI / 2);
                    c.textAlign = 'center';
                    c.fillText(L.t, 0, 0);
                } else {
                    c.translate(cx, cy);
                    c.rotate(m);
                    c.textAlign = 'right';
                    c.fillText(L.t, L.r, 0);
                }
                c.restore();
            }
            c.restore();
        }
        /** Drehen bis Feld index unter dem Zeiger steht. dir: 1 im Uhrzeigersinn, -1 andersherum. dur in ms (0 = sofort). */
        spinTo(index, dur, dir, power) {
            const n = this.items.length;
            const a = this.seg;
            this.hi = -1;
            if (!n) return Promise.resolve();
            const f = .2 + DR.rndReal() * .6;     // nicht immer genau die Mitte, wie bei einem echten Rad
            const target = (index + f) * a;
            const TAU = Math.PI * 2;
            const turns = dur <= 0 ? 0 : Math.max(2, Math.round(dur / 1000 * (power || 1.1)));
            let end;
            if (dir >= 0) { const base = ((-target - this.rot) % TAU + TAU) % TAU; end = this.rot + base + turns * TAU; }
            else { const base = ((this.rot + target) % TAU + TAU) % TAU; end = this.rot - base - turns * TAU; }
            if (dur <= 0) { this.rot = end; this.hi = index; this.draw(); return Promise.resolve(); }
            const start = this.rot, t0 = performance.now();
            let lastSeg = this.under(this.rot);
            this.busy = true;
            return new Promise(res => {
                this.finishNow = () => { this.skip = true; };
                const ease = t => 1 - Math.pow(1 - t, 4);
                const step = now => {
                    let t = Math.min(1, (now - t0) / dur);
                    if (this.skip) t = 1;
                    this.rot = start + (end - start) * ease(t);
                    const s = this.under(this.rot);
                    if (s !== lastSeg) {
                        lastSeg = s;
                        if (n <= 120) { this.flap = -.38 * Math.sign(end - start); if (this.hooks.tick) this.hooks.tick(); }
                    }
                    this.flap *= .82;
                    if (t >= 1) {
                        this.rot = end; this.flap = 0; this.busy = false; this.skip = false; this.finishNow = null;
                        this.hi = index;
                        this.draw();
                        res();
                        return;
                    }
                    this.draw();
                    requestAnimationFrame(step);
                };
                requestAnimationFrame(step);
            });
        }
        finish() { if (this.finishNow) this.finishNow(); }
        /** Anfassen: Antippen dreht, mit Schwung wischen dreht in die Richtung des Schwungs, langsam ziehen dreht nur von Hand */
        bindPointer() {
            const cv = this.cv;
            let st = null;
            const ang = e => { const r = cv.getBoundingClientRect(); return Math.atan2(e.clientY - r.top - this.geo.cy, e.clientX - r.left - this.geo.cx); };
            cv.addEventListener('pointerdown', e => {
                if (e.button > 0) return;
                if (this.busy) { this.finish(); return; }
                const r = cv.getBoundingClientRect(), dx = e.clientX - r.left - this.geo.cx, dy = e.clientY - r.top - this.geo.cy;
                if (Math.hypot(dx, dy) > this.geo.R * 1.08) return;
                Sound.unlock();
                st = { a: ang(e), x: e.clientX, y: e.clientY, moved: 0, samples: [[performance.now(), this.rot]] };
                try { cv.setPointerCapture(e.pointerId); } catch (x) {}
                e.preventDefault();
            });
            cv.addEventListener('pointermove', e => {
                if (!st || this.busy) return;
                const a = ang(e);
                let d = a - st.a;
                if (d > Math.PI) d -= Math.PI * 2; else if (d < -Math.PI) d += Math.PI * 2;
                st.a = a;
                st.moved = Math.max(st.moved, Math.hypot(e.clientX - st.x, e.clientY - st.y));
                if (st.moved > 8) {
                    this.rot += d; this.hi = -1;
                    st.samples.push([performance.now(), this.rot]);
                    if (st.samples.length > 8) st.samples.shift();
                    this.draw();
                }
            });
            const up = e => {
                if (!st) return;
                const s = st; st = null;
                if (s.moved <= 8) { if (this.hooks.tap) this.hooks.tap(); return; }
                const now = performance.now();
                const old = s.samples.find(x => now - x[0] < 120) || s.samples[0];
                const v = (this.rot - old[1]) / Math.max(16, now - old[0]);    // Bogen pro ms
                if (Math.abs(v) > .0035 && this.hooks.swipe) this.hooks.swipe(Math.sign(v), Math.min(2.2, Math.abs(v) / .006));
            };
            cv.addEventListener('pointerup', up);
            cv.addEventListener('pointercancel', () => { st = null; });
        }
    }

    /* ---------- Würfel mit Augen ---------- */
    const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
    function die(v) {
        const d = el('div.die');
        for (let i = 0; i < 9; i++) d.append(el('i', { class: PIPS[v].indexOf(i) >= 0 ? 'on' : '' }));
        d.setAttribute('aria-label', String(v));
        return d;
    }
    function setDie(d, v) { const p = PIPS[v]; Array.from(d.children).forEach((x, i) => x.classList.toggle('on', p.indexOf(i) >= 0)); d.setAttribute('aria-label', String(v)); }

    /* ---------- Die Bühne ---------- */
    class Stage {
        constructor(root, hooks) {
            this.root = root;
            this.h = hooks;
            this.model = null;
            this.wheels = [];
            this.busy = false;
            this.ro = new ResizeObserver(() => { clearTimeout(this.rt); this.rt = setTimeout(() => this.layout(), 60); });
            this.ro.observe(root);
            root.addEventListener('click', e => this.click(e));
        }
        get t() { return this.h.t; }
        colors() {
            const c = this.h.colors();
            return { seg: c.seg, ink: c.segInk, rim: c.rim, card: c.card, acc: c.acc, font: css('--ff'), weight: +css('--fw-res') || 800, scale: +css('--fs-wheel') || 1 };
        }
        /** Klick irgendwo auf die Bühne: Auflösung zeigen, verdeckte Karte aufdecken, sonst drehen */
        click(e) {
            if (e.target.closest('button, a, input, select, textarea, .timer, .noclick')) return;
            if (e.target.closest('canvas.wheel')) return;      // das Rad regelt das selbst
            if (this.busy) { this.finishAll(); return; }
            const op = e.target.closest('[data-open]');
            if (op) { this.h.open(+op.dataset.open); return; }
            const cover = e.target.closest('[data-cover]');
            if (cover) { this.h.reveal(+cover.dataset.cover); return; }
            const nav = e.target.closest('[data-nav]');
            if (nav) { this.h.nav(+nav.dataset.nav); return; }
            this.h.tap();
        }
        finishAll() { for (const w of this.wheels) w.finish(); this.skip = true; }
        resetRot() { this.rots = null; }

        /** Alles neu aufbauen */
        show(m) {
            this.model = m;
            this.skip = false;
            const r = this.root;
            r.className = 'v-' + m.view + (m.show ? ' show' : '');
            r.replaceChildren();
            this.wheels = [];
            this.fitList = [];
            const view = { wheel: this.vWheel, reels: this.vReels, card: this.vReels, dice: this.vDice, bingo: this.vBingo, abc: this.vAbc, teams: this.vTeams, duties: this.vDuties }[m.view] || this.vWheel;
            if (m.empty) r.append(this.vEmpty(m));
            else view.call(this, m);
            if (m.timer) r.append(this.timerEl(m.timer));
            if (m.extra) r.append(m.extra);
            this.layout();
        }
        orient() {
            const w = this.root.clientWidth, h = this.root.clientHeight;
            return w > h * 1.08 ? 'land' : 'port';
        }
        layout() {
            const m = this.model;
            if (!m) return;
            const o = this.orient();
            this.root.classList.toggle('land', o === 'land');
            this.root.classList.toggle('port', o === 'port');
            const W = this.root.clientWidth, H = this.root.clientHeight;
            if (m.view === 'wheel' && !m.empty) {
                const n = Math.max(1, m.slots.length);
                const sz = o === 'land' ? Math.min(H, W * .58 / n) : Math.min(W / n, H * .6);
                this.root.style.setProperty('--wsz', Math.floor(sz) + 'px');
            }
            if (m.view === 'dice' && this.diceBox) {
                const n = this.diceBox.children.length, bw = this.diceBox.clientWidth, bh = this.diceBox.clientHeight;
                let best = 0;
                for (let cols = 1; cols <= n; cols++) { const rows = Math.ceil(n / cols); best = Math.max(best, Math.min(bw / cols, bh / rows)); }
                this.diceBox.style.setProperty('--die', Math.floor(best * .78) + 'px');
            }
            if (this.board) this.layoutBoard();
            for (const w of this.wheels) w.resize();
            this.refit();
        }
        refit() {
            const f = this.h.resScale ? this.h.resScale() : 1;
            for (const [node, max, res] of this.fitList) {
                const s = fit(node, typeof max === 'function' ? max() : max);
                if (res && f < 1 && s) node.style.fontSize = Math.max(10, Math.round(s * f)) + 'px';
            }
        }
        addFit(node, max, res) { this.fitList.push([node, max, res]); return node; }

        /* --- Bausteine --- */
        /** Ein Ergebnis als Kasten: Beschriftung, Wert (so groß wie möglich), Auflösung */
        resBox(m, k, cls) {
            const slot = m.slots[k] || {};
            const sel = m.res ? m.res[k] || [] : null;
            const box = el('div.res' + (cls ? '.' + cls : ''));
            if (slot.label) box.append(el('div.lab', { text: slot.label }));
            const val = el('div.val');
            box.append(val);
            this.fillVal(val, sel, slot, m, k);
            const ans = sel && sel.length === 1 && sel[0].a ? sel[0].a : null;
            if (ans) {
                const open = m.rev;
                const a = el('div.ans' + (open ? '.open' : ''), { 'data-cover': open ? null : String(k) });
                if (open) { a.append(el('span', { text: (sel[0].q ? '= ' : '') + ans })); this.addFit(a, () => Math.min(box.clientHeight * .3, 160)); }
                else a.append(icon('eye'), el('span', { text: this.t('Antippen für die Auflösung') }));
                box.append(a);
            }
            return box;
        }
        fillVal(val, sel, slot, m, k) {
            val.replaceChildren();
            val.classList.remove('balls', 'covered', 'wait');
            if (!sel) { val.classList.add('wait'); val.append(el('span', { text: k ? '?' : m.hint || '?' })); this.addFit(val, k ? 120 : 52); return; }
            if (slot.hide) val.dataset.open = String(k); else delete val.dataset.open;
            if (slot.hide && !(m.open && m.open[k])) {
                val.classList.add('covered');
                val.append(el('span', null, icon('eye'), el('b', { text: this.t('Verdeckt') }), el('small', { text: this.t('Antippen zum Aufdecken') })));
                this.addFit(val, 90);
                return;
            }
            if (sel.length > 1) {
                val.classList.add('balls');
                for (const s of sel) val.append(el('span.ball', { text: s.t }));
                this.addFit(val, 300, true);
                return;
            }
            const s = sel[0] || { t: '' };
            if (s.p) val.append(el('small.pre', { text: s.p }));
            val.append(el('span', { text: s.t, lang: m.lang }));
            if (s.c) { val.style.setProperty('--sw', s.c); val.style.setProperty('--sw-ink', DR.look.inkOn(s.c)); }
            else { val.style.removeProperty('--sw'); val.style.removeProperty('--sw-ink'); }
            val.classList.toggle('colored', !!s.c);
            this.addFit(val, 900, true);
        }
        foot(m) {
            const f = el('div.foot.noclick');
            const left = el('div.info');
            if (m.info) left.append(el('span', { text: m.info }));
            if (m.hist && m.hist.length) left.append(el('span.hist', null, m.hist.map(x => el('b', { text: x }))));
            f.append(left);
            if (!m.show) {
                const acts = el('div.acts');
                if (m.canUndo) acts.append(el('button.iconbtn.small', { type: 'button', title: this.t('Rückgängig'), 'aria-label': this.t('Rückgängig'), onclick: () => this.h.undo() }, icon('undo')));
                acts.append(el('button.iconbtn.small', { type: 'button', title: this.t('Verlauf und neue Runde'), 'aria-label': this.t('Verlauf und neue Runde'), onclick: () => this.h.history() }, icon('history')));
                f.append(acts);
            }
            return f;
        }
        cats(m) {
            if (!m.cats || !m.cats.length) return null;
            return el('div.cats.noclick', null, m.cats.map(c => el('span', { text: c })));
        }
        vEmpty(m) {
            const e = el('div.empty');
            e.append(el('p', { text: m.empty.text }));
            if (m.empty.action) e.append(el('button.btn.primary.big', { type: 'button', onclick: m.empty.action.fn }, m.empty.action.icon ? icon(m.empty.action.icon) : null, el('span', { text: m.empty.action.label })));
            return e;
        }

        /* --- Rad --- */
        vWheel(m) {
            const wrap = el('div.wheels');
            const panel = el('div.panel');
            m.slots.forEach((s, k) => {
                const box = el('div.wbox');
                wrap.append(box);
                const w = new Wheel(box, { tap: () => { if (!this.busy) this.h.tap(); }, swipe: (dir, p) => { if (!this.busy) this.h.tap(dir, p); }, tick: () => this.h.tick() });
                this.wheels.push(w);
                w.set(s.seg, m.hitSeg ? m.hitSeg[k] : -1, this.colors());
                if (this.rots && this.rots[k] != null) w.rot = this.rots[k];
            });
            const results = el('div.results');
            m.slots.forEach((s, k) => results.append(this.resBox(m, k)));
            panel.append(results);
            const cats = this.cats(m);
            if (cats) panel.append(cats);
            if (m.note) panel.append(el('p.note', { text: m.note }));
            panel.append(this.foot(m));
            this.root.append(wrap, panel);
        }
        /* --- Walzen und Karte --- */
        vReels(m) {
            const box = el('div.reels' + (m.view === 'card' ? '.card' : ''));
            m.slots.forEach((s, k) => box.append(this.resBox(m, k, 'reel')));
            this.reelBox = box;
            this.root.append(box);
            const cats = this.cats(m);
            if (cats) this.root.append(cats);
            if (m.note) this.root.append(el('p.note', { text: m.note }));
            this.root.append(this.foot(m));
        }
        /* --- Würfel --- */
        vDice(m) {
            const n = m.dice || 1;
            const sel = m.res && m.res[0] && m.res[0][0];
            const vals = sel && sel.d ? sel.d : Array.from({ length: n }, (_, i) => [1, 6, 3, 5, 2, 4][i % 6]);
            this.diceBox = el('div.dicebox' + (sel ? '' : '.idle'), null, vals.map(die));
            const total = vals.reduce((a, b) => a + b, 0);
            const sum = el('div.sum', { text: sel && vals.length > 1 ? this.t('Zusammen: {n}', { n: total }) : sel ? '' : (m.hint || '') });
            this.root.append(this.diceBox, sum, this.foot(m));
        }
        /* --- Bingo: große Kugel und Tafel --- */
        vBingo(m) {
            const sel = m.res && m.res[0] && m.res[0][0];
            const ball = el('div.ballbox', null, el('div.bigball' + (sel ? '' : '.idle'), null,
                sel && sel.p ? el('small', { text: sel.p }) : null, el('span', { text: sel ? sel.t : '?' })));
            this.ball = ball.firstChild;
            const b = m.board;
            const board = el('div.board.noclick');
            const drawn = new Set(b.drawn);
            if (b.rows) {
                for (const row of b.rows) {
                    board.append(el('b.rowlab', { text: row.p }));
                    for (const it of row.items) board.append(el('span', { class: (drawn.has(it.t) ? 'on' : '') + (it.t === b.last ? ' last' : ''), text: it.t }));
                }
            } else for (const it of b.items) board.append(el('span', { class: (drawn.has(it.t) ? 'on' : '') + (it.t === b.last ? ' last' : ''), text: it.t }));
            this.board = board;
            this.root.append(ball, board, this.foot(m));
        }
        layoutBoard() {
            const b = this.model.board, board = this.board;
            if (!b || !board.isConnected) return;
            const W = board.clientWidth, H = board.clientHeight;
            let cols, rows;
            if (b.rows) { cols = Math.max(...b.rows.map(r => r.items.length)) + 1; rows = b.rows.length; }
            else {
                const n = b.items.length;
                let best = null;
                for (let c = 1; c <= n; c++) { const r = Math.ceil(n / c), s = Math.min(W / c, H / r); if (!best || s > best.s) best = { c, r, s }; }
                cols = best.c; rows = best.r;
            }
            board.style.setProperty('--cols', cols);
            board.style.setProperty('--rows', rows);
            const cell = Math.min(W / cols, H / rows);
            board.style.setProperty('--cell', Math.floor(cell) + 'px');
            const bb = this.ball.parentNode, bs = Math.floor(Math.min(bb.clientWidth, bb.clientHeight));
            this.ball.style.width = bs + 'px'; this.ball.style.height = bs + 'px';
            this.addFit(this.ball.lastChild, () => this.ball.clientHeight * .62);
        }
        /* --- ABC-Runde --- */
        vAbc(m) {
            const a = m.abc;
            const theme = this.resBox(m, 0, 'theme');
            const letter = el('div.letter');
            const cur = a.letters[a.i] || '';
            letter.append(el('button.nav.prev', { type: 'button', 'data-nav': '-1', 'aria-label': this.t('Zurück'), disabled: a.i <= 0 || null }, icon('left')),
                el('div.big', { text: m.res ? cur : '' }),
                el('button.nav.next', { type: 'button', 'data-nav': '1', 'aria-label': this.t('Weiter') }, icon('right')));
            if (m.res) this.addFit(letter.children[1], 1200);
            const strip = el('div.strip.noclick', null, a.letters.map((l, i) => el('span', { class: i < a.i ? 'done' : i === a.i && m.res ? 'cur' : '', text: l })));
            this.root.append(theme, letter, strip, this.foot(m));
        }
        /* --- Gruppen --- */
        vTeams(m) {
            const box = el('div.teams');
            const c = this.colors();
            (m.teams || []).forEach((t, i) => {
                const col = el('div.team', { vars: { '--tc': c.seg[i % c.seg.length], '--ti': c.ink[i % c.seg.length] } });
                col.append(el('h3', { text: this.t('Gruppe {n}', { n: i + 1 }) }));
                const ul = el('ul');
                t.forEach(x => ul.append(el('li', { text: x.t })));
                col.append(ul);
                box.append(col);
            });
            if (!m.teams || !m.teams.length) box.append(el('div.res.reel', null, el('div.val.wait', null, el('span', { text: m.hint || '' }))));
            this.teamBox = box;
            this.root.append(box, this.foot(m));
            this.addFit(box, () => Math.min(120, box.clientHeight / 4));
        }
        /* --- Ämter --- */
        vDuties(m) {
            const box = el('div.duties');
            const n = (m.duties || []).length, W = this.root.clientWidth, H = this.root.clientHeight || 1;
            box.style.setProperty('--dcols', String(Math.max(1, Math.min(4, Math.round(Math.sqrt(n * (W / H) / 5))))));
            for (const x of m.duties || []) box.append(el('div.duty', null, el('span.d', { text: x.d.t }), el('span.arrow', { text: '→' }), el('b.n', { text: x.n ? x.n.t : '–' })));
            if (!m.duties || !m.duties.length) box.append(el('div.res.reel', null, el('div.val.wait', null, el('span', { text: m.hint || '' }))));
            this.root.append(box, this.foot(m));
            this.addFit(box, () => Math.min(140, box.clientHeight / 3));
        }

        /* ---------- Drehen ----------
           spin(draw, opts): draw = Ergebnis aus engine.draw, opts = { dur, dir, power }. Danach ruft app.js show() mit dem neuen Modell. */
        async spin(d, o) {
            const m = this.model;
            this.busy = true;
            this.skip = false;
            this.root.classList.add('spinning');
            try {
                if (m.view === 'wheel') {
                    const jobs = d.r.map((x, k) => {
                        const w = this.wheels[k];
                        if (!w || !x.seg) return Promise.resolve();
                        w.set(x.seg.map(i => m.all[k][i]), -1, this.colors());
                        return w.spinTo(x.hit, o.dur ? o.dur + k * 600 : 0, o.dir || 1, o.power);
                    });
                    // Ergebnisse im Feld daneben verdecken, solange es dreht
                    this.root.querySelectorAll('.results .val').forEach(v => { v.classList.add('rolling'); });
                    await Promise.all(jobs);
                    this.rots = this.wheels.map(w => w.rot);
                } else if (m.view === 'dice') {
                    await this.rollDice(d.r[0].sel[0].d, o.dur);
                } else if (m.view === 'bingo') {
                    await this.flicker([this.ball.lastChild], [() => m.all[0][DR.rnd(m.all[0].length)].t], o.dur);
                } else if (m.view === 'teams' || m.view === 'duties') {
                    await sleep(Math.min(600, o.dur / 3));
                } else if (m.view === 'abc') {
                    const v = this.root.querySelector('.theme .val');
                    await this.flicker([v], [() => m.all[0][DR.rnd(m.all[0].length)].t], o.dur);
                } else {
                    const vals = Array.from(this.root.querySelectorAll('.reels .val'));
                    const samplers = d.r.map((x, k) => {
                        if (m.slots[k].hide) return () => '• • •';
                        const n = x.sel.length;
                        const one = () => (x.seg && m.all[k].length ? m.all[k][DR.rnd(m.all[k].length)].t : this.h.sample(k));
                        return n > 1 ? () => Array.from({ length: n }, one).join('  ') : one;
                    });
                    await this.flicker(vals, samplers, o.dur);
                }
            } finally {
                this.busy = false;
                this.root.classList.remove('spinning');
            }
        }
        /** Walze: Einträge laufen durch, immer langsamer, bis das Ergebnis steht. Bei jedem Wechsel ein leises Klicken. */
        async flicker(nodes, samplers, dur) {
            if (!dur) return;
            const t0 = performance.now();
            const ends = nodes.map((_, k) => dur * (.55 + .45 * (k + 1) / nodes.length));
            const next = nodes.map(() => 0);
            const done = nodes.map(() => false);
            const show = (node, text) => {
                node.replaceChildren(el('span', { text }));
                node.classList.remove('covered', 'wait', 'balls');
                node.classList.remove('roll'); void node.offsetWidth; node.classList.add('roll');
                fit(node, Math.min(node.clientHeight * .7, 600));
            };
            while (done.some(x => !x)) {
                await raf();
                const now = performance.now() - t0;
                nodes.forEach((node, k) => {
                    if (done[k] || !node) return;
                    if (now >= ends[k] || this.skip) {
                        done[k] = true;
                        node.classList.remove('roll'); node.classList.add('land');
                        return;
                    }
                    if (now < next[k]) return;
                    const p = now / ends[k];
                    next[k] = now + 45 + 300 * p * p;
                    show(node, samplers[k]());
                    this.h.tick();
                });
            }
        }
        async rollDice(vals, dur) {
            const dice = Array.from(this.diceBox.children);
            this.diceBox.classList.remove('idle');
            if (!dur) { dice.forEach((d, i) => setDie(d, vals[i])); return; }
            const t0 = performance.now();
            dice.forEach(d => d.classList.add('rolling'));
            let next = 0;
            while (performance.now() - t0 < Math.min(dur, 1800) && !this.skip) {
                await raf();
                const now = performance.now() - t0;
                if (now < next) continue;
                next = now + 60 + 140 * (now / dur);
                dice.forEach(d => setDie(d, 1 + DR.rnd(6)));
                this.h.tick();
            }
            dice.forEach((d, i) => { d.classList.remove('rolling'); setDie(d, vals[i]); });
        }

        /* ---------- Sanduhr ---------- */
        timerEl(tm) {
            const R = 26, C = 2 * Math.PI * R;
            const b = el('button.timer', { type: 'button', 'aria-label': this.t('Sanduhr') });
            b.innerHTML = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle class="bg" cx="32" cy="32" r="' + R + '"/><circle class="fg" cx="32" cy="32" r="' + R + '" stroke-dasharray="' + C + '" stroke-dashoffset="0"/></svg><span></span>';
            const fg = b.querySelector('.fg'), txt = b.querySelector('span');
            const paint = () => {
                const s = tm.left();
                txt.textContent = s >= 60 ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') : String(s);
                fg.style.strokeDashoffset = String(C * (1 - s / Math.max(1, tm.total())));
                b.classList.toggle('run', tm.running());
                b.classList.toggle('end', s <= 0);
                b.classList.toggle('low', s > 0 && s <= 5 && tm.running());
            };
            paint();
            tm.onPaint = paint;
            let hold = 0;
            b.addEventListener('pointerdown', () => { hold = setTimeout(() => { hold = -1; tm.reset(); }, 650); });
            b.addEventListener('pointerup', () => clearTimeout(hold));
            b.addEventListener('pointerleave', () => clearTimeout(hold));
            b.addEventListener('click', e => { e.stopPropagation(); if (hold === -1) { hold = 0; return; } tm.toggle(); });
            return b;
        }
    }

    Object.assign(DR, { el, icon, ICONS, fit, Sound, Wheel, Stage, die, sleep });
})(window);
