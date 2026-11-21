/* Drehsel – läuft vor dem ersten Bild: Design, Schrift und Größe so, wie zuletzt eingestellt, damit nichts aufblitzt. */
(() => {
    try {
        const s = JSON.parse(localStorage.getItem('dr_set')) || {};
        const r = document.documentElement;
        const dark = s.theme === 'dark' || (s.theme !== 'light' && s.theme !== 'contrast' && matchMedia('(prefers-color-scheme: dark)').matches);
        r.dataset.theme = s.theme === 'contrast' ? 'contrast' : dark ? 'dark' : 'light';
        r.dataset.font = s.font || 'atkinson';
        if (s.scale) r.style.setProperty('--ui', String(s.scale));
        if (s.lang) r.lang = s.lang;
    } catch (e) {}
})();
