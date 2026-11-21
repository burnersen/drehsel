<?php
/* Drehsel – Hauptseite. Nur das Gerüst, alles Weitere baut app.js. Texte übersetzt die App selbst (i18n-xx.js).
   Mit DR_INLINE (tools/build-release.php) entsteht daraus eine einzige HTML-Datei, die ohne Server läuft:
   CSS, Schriften, Skripte, Symbole und Listen stecken dann direkt in der Seite. */
defined('DR_VERSION') || exit;
$drInline = defined('DR_INLINE') && DR_INLINE;
$drFile = function (string $f): string { return (string)file_get_contents(DR_APP . '/assets/' . $f); };
$drData = function (string $f, string $type) use ($drFile): string { return 'data:' . $type . ';base64,' . base64_encode($drFile($f)); };
$drSrc = function (string $f, string $type) use ($drInline, $drData): string { return h($drInline ? $drData($f, $type) : drAssetUrl($f)); };
$drScript = function (string $f, bool $defer = true) use ($drInline, $drFile): string {
    if ($drInline) return '<script>' . str_replace('</script', '<\/script', $drFile($f)) . "</script>\n";
    return '<script' . ($defer ? ' defer' : '') . ' src="' . h(drAssetUrl($f)) . "\"></script>\n";
};
$drLists = [];
foreach (drListLangs() as $l) $drLists[$l] = $drInline ? '' : drListUrl($l);
$drScripts = [];
foreach (drUiLangs() as $l) if ($l !== 'de') $drScripts[] = 'i18n-' . $l . '.js';
array_push($drScripts, 'engine.js', 'look.js', 'stage.js', 'app.js');
?><!DOCTYPE html>
<html lang="<?= drLang() ?>" data-v="<?= h(DR_VERSION) ?>" data-lists="<?= h(json_encode($drLists, JSON_UNESCAPED_SLASHES)) ?>" data-langs="<?= h(json_encode(drUiLangs())) ?>"<?= $drInline ? ' data-offline="1"' : '' ?>>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="<?= h(drT('Drehsel: Glücksrad, Losbox und Würfel für Spiele mit Senioren und Kindern. Stadt-Land-Fluss, Bingo, Erinnerungsfragen, Sprichwörter, Bewegung und eigene Listen. Groß, gut lesbar, kostenlos, ohne Werbung und auch offline als App.', 'Drehsel: spinning wheel, lucky draw and dice for games with seniors and children. Categories, bingo, memory questions, proverbs, exercise and your own lists. Big, easy to read, free, ad-free and works offline as an app.')) ?>">
<meta name="theme-color" content="#f5f0e6">
<meta name="color-scheme" content="light dark">
<meta name="application-name" content="Drehsel">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Drehsel">
<meta name="format-detection" content="telephone=no">
<title>Drehsel</title>
<?php if (!$drInline): ?>
<link rel="manifest" href="?action=manifest">
<?php endif; ?>
<link rel="icon" href="<?= $drSrc('icon.svg', 'image/svg+xml') ?>" type="image/svg+xml">
<link rel="apple-touch-icon" href="<?= $drSrc('icon-180.png', 'image/png') ?>">
<?php if ($drInline): ?>
<style><?= preg_replace_callback('~\?action=asset&f=([a-z0-9\-]+\.woff2)~', function ($m) use ($drData) { return $drData($m[1], 'font/woff2'); }, $drFile('app.css')) ?></style>
<?php else: ?>
<link rel="stylesheet" href="<?= h(drAssetUrl('app.css')) ?>">
<?php endif; ?>
<?= $drScript('boot.js', false) ?>
<?php foreach ($drScripts as $s) echo $drScript($s); ?>
<?php if ($drInline): foreach (drListLangs() as $l): ?>
<script type="text/plain" id="dr-lists-<?= $l ?>"><?= str_replace('</script', '<\/script', (string)file_get_contents(DR_APP . '/lists/' . $l . '.txt')) ?></script>
<?php endforeach; endif; ?>
</head>
<body>
<header id="top">
    <button id="menuBtn" class="iconbtn" type="button"></button>
    <button id="titleBtn" class="titlebtn" type="button"><span class="emo"></span><span class="name"></span></button>
    <div class="grow"></div>
    <button id="setBtn" class="iconbtn" type="button"></button>
    <button id="showBtn" class="iconbtn" type="button"></button>
    <button id="spinBtn" class="btn primary spin" type="button"></button>
</header>
<main id="stage"></main>
<div id="layer"></div>
<div id="toast" class="toast" hidden></div>
<div id="live" class="sr" aria-live="polite"></div>
<noscript><p class="noscript">Drehsel braucht JavaScript. / Drehsel needs JavaScript.</p></noscript>
</body>
</html>
