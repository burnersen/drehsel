<?php
/**
 * Drehsel – Release bauen (nur für die Kommandozeile, Nutzer brauchen das nie)
 *
 *   php tools/build-release.php
 *
 * Legt im Ordner dist/ drei Dateien an:
 *   drehsel-install.php     eine einzige Datei zum Hochladen, entpackt sich im Browser selbst
 *   drehsel-<Version>.zip   alle Dateien zum Entpacken von Hand
 *   drehsel-offline.html    die ganze App in einer HTML-Datei, läuft ohne Server per Doppelklick (am Rechner, vom USB-Stick)
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$root = dirname(__DIR__);
$dist = $root . '/dist';

$index = (string)file_get_contents($root . '/index.php');
if (!preg_match("~define\\('DR_VERSION',\\s*'([0-9][0-9A-Za-z.\\-]*)'\\)~", $index, $m)) {
    fwrite(STDERR, "DR_VERSION nicht in index.php gefunden.\n");
    exit(1);
}
$version = $m[1];

// Was zum Programm gehört: index.php, LICENSE und alles unter app/
$files = ['index.php', 'LICENSE'];
$it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root . '/app', FilesystemIterator::SKIP_DOTS));
foreach ($it as $f) {
    if ($f->isFile()) $files[] = str_replace('\\', '/', substr($f->getPathname(), strlen($root) + 1));
}
sort($files, SORT_STRING);

if (!is_dir($dist) && !mkdir($dist, 0755, true)) {
    fwrite(STDERR, "dist/ konnte nicht angelegt werden.\n");
    exit(1);
}

// 1) Installer: Vorlage + eingepackte Dateien (Pfad, SHA-256, Base64 pro Zeile)
$tpl = (string)file_get_contents(__DIR__ . '/installer-template.php');
if (substr_count($tpl, '__halt_compiler();') !== 1) {
    fwrite(STDERR, "Die Installer-Vorlage muss genau einmal mit __halt_compiler(); enden.\n");
    exit(1);
}
$out = str_replace('@@VERSION@@', $version, rtrim($tpl)) . "\n";
foreach ($files as $path) {
    $bin = (string)file_get_contents($root . '/' . $path);
    $out .= $path . "\t" . hash('sha256', $bin) . "\t" . base64_encode($bin) . "\n";
}
file_put_contents($dist . '/drehsel-install.php', $out);
printf("%s  (%d Dateien, %d KB)\n", 'dist/drehsel-install.php', count($files), (int)round(strlen($out) / 1024));

// 2) ZIP zum Entpacken von Hand, alles in einem Ordner drehsel/
if (class_exists('ZipArchive')) {
    $zipPath = $dist . '/drehsel-' . $version . '.zip';
    if (is_file($zipPath)) unlink($zipPath);
    $zip = new ZipArchive();
    if ($zip->open($zipPath, ZipArchive::CREATE) !== true) {
        fwrite(STDERR, "ZIP konnte nicht angelegt werden.\n");
        exit(1);
    }
    foreach (array_merge($files, ['README.md', 'README.en.md']) as $path) {
        if (is_file($root . '/' . $path)) $zip->addFile($root . '/' . $path, 'drehsel/' . $path);
    }
    $zip->close();
    printf("%s  (%d KB)\n", 'dist/drehsel-' . $version . '.zip', (int)round(filesize($zipPath) / 1024));
} else {
    echo "Hinweis: PHP-Erweiterung zip fehlt, das ZIP wurde ausgelassen.\n";
}

// 3) Eine HTML-Datei, die ohne Server läuft: dieselbe Seite, nur mit allem darin (CSS, Schriften, Skripte, Symbole, Listen)
define('DR_VERSION', $version);
define('DR_ROOT', $root);
define('DR_APP', $root . '/app');
define('DR_DATA_DIR', $root . '/data');
define('DR_INLINE', true);
require DR_APP . '/lib/core.php';
ob_start();
require DR_APP . '/views/app.php';
$html = (string)ob_get_clean();
$html = str_replace('<html lang="de"', "<!-- Drehsel $version · offline · https://github.com/burnersen/mixer · GNU AGPL v3 -->\n<html lang=\"de\"", $html);
file_put_contents($dist . '/drehsel-offline.html', $html);
printf("%s  (%d KB)\n", 'dist/drehsel-offline.html', (int)round(strlen($html) / 1024));
