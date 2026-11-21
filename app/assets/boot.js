/* Drehsel – läuft vor dem ersten Bild: Farben, Schrift und Größe so, wie zuletzt eingestellt, damit nichts aufblitzt.
   Die fertig ausgerechneten Farben legt app.js unter dr_paint ab. */
(() => {
    try {
        const r = document.documentElement;
        const s = JSON.parse(localStorage.getItem('dr_set')) || {};
        const p = JSON.parse(localStorage.getItem('dr_paint')) || null;
        const mode = p && p.mode === 'light' ? 'light' : p && p.mode === 'dark' ? 'dark' : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        r.dataset.theme = mode;
        const vars = p && p[mode];
        if (vars) for (const k in vars) r.style.setProperty(k, vars[k]);
        r.dataset.font = s.font || 'atkinson';
        if (s.fs && s.fs.ui) r.style.setProperty('--ui', String(s.fs.ui));
        if (s.lang) r.lang = s.lang;
    } catch (e) {}
})();
