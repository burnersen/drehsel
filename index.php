<?php
/**
 * Drehsel – Glücksrad, Losbox und Würfel für Spiele mit Senioren und Kindern, als App zum Selbsthosten
 *
 * Diese Datei ist nur der Einstieg: Einstellungen und Reihenfolge. Der eigentliche Code liegt in app/:
 *   app/lib/       Funktionen (Einstellungen, Kopfzeilen, Updates)
 *   app/views/     die Hauptseite
 *   app/assets/    CSS, JavaScript, Schriften, Symbole (werden über diese Datei ausgeliefert)
 *   app/lists/     die eingebauten Listen, eine Textdatei pro Sprache
 *
 * Das Spiel läuft komplett im Browser. Der Server liefert nur die App aus, speichert nichts über die Besucher
 * und setzt keine Cookies. Eigene Listen, Namen und Einstellungen bleiben auf dem Gerät.
 * Nichts wird von fremden Servern nachgeladen.
 *
 * Lizenz: GNU Affero General Public License v3.0, siehe Datei LICENSE.
 */

error_reporting(E_ALL);
ini_set('display_errors', '0');
date_default_timezone_set('Europe/Berlin');

define('DR_VERSION', '1.1.0');
define('DR_ROOT', __DIR__);
define('DR_APP', DR_ROOT . '/app');
define('DR_DATA_DIR', DR_ROOT . '/data');

require DR_APP . '/lib/core.php';
require DR_APP . '/lib/update.php';

$action = isset($_GET['action']) && is_string($_GET['action']) ? $_GET['action'] : '';

/* ---------- Dateien: CSS, JavaScript, Schriften, Symbole ---------- */
if ($action === 'asset') {
    $f = isset($_GET['f']) && is_string($_GET['f']) ? $_GET['f'] : '';
    $types = drAssetTypes();
    $ext = strtolower((string)pathinfo($f, PATHINFO_EXTENSION));
    if (!preg_match('~^[a-z0-9][a-z0-9\-]*\.[a-z0-9]+$~', $f) || !isset($types[$ext]) || !is_file(DR_APP . '/assets/' . $f)) drNotFound();
    drHeaders();
    header('Content-Type: ' . $types[$ext]);
    header('Cache-Control: ' . (isset($_GET['v']) ? 'public, max-age=31536000, immutable' : 'no-cache'));
    if ($ext === 'css') {
        echo drCss($f);   // Schriften im CSS bekommen ihre Versionskennung
        exit;
    }
    readfile(DR_APP . '/assets/' . $f);
    exit;
}

/* ---------- Eingebaute Listen einer Sprache (Textdatei, siehe app/lists/) ---------- */
if ($action === 'lists') {
    $l = isset($_GET['l']) && is_string($_GET['l']) ? $_GET['l'] : '';
    if (!in_array($l, drListLangs(), true)) drNotFound();
    drHeaders();
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: ' . (isset($_GET['v']) ? 'public, max-age=31536000, immutable' : 'no-cache'));
    readfile(DR_APP . '/lists/' . $l . '.txt');
    exit;
}

/* ---------- Service Worker: hält die ganze App vor, danach läuft sie ohne Netz ---------- */
if ($action === 'sw') {
    drHeaders();
    header("Content-Security-Policy: default-src 'none'; connect-src 'self'; frame-ancestors 'none'");
    header('Content-Type: text/javascript; charset=utf-8');
    header('Cache-Control: no-cache');
    echo 'const DR_V = ' . json_encode(DR_VERSION) . ";\n";
    echo 'const DR_FILES = ' . json_encode(drPrecacheList(), JSON_UNESCAPED_SLASHES) . ";\n";
    readfile(DR_APP . '/assets/sw.js');
    exit;
}

/* ---------- Web-App-Manifest: Name, Symbole, Farben für „Zum Home-Bildschirm“ ---------- */
if ($action === 'manifest') {
    drHeaders();
    header('Content-Type: application/manifest+json; charset=utf-8');
    header('Cache-Control: no-cache');
    echo json_encode(drManifest(), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action !== '') drNotFound();

/* ---------- Die App ---------- */
drHeaders(true);
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache');
ob_start();
require DR_APP . '/views/app.php';
$html = (string)ob_get_clean();
if (!filter_var(ini_get('zlib.output_compression'), FILTER_VALIDATE_BOOLEAN)) header('Content-Length: ' . strlen($html));
echo $html;
drAutoUpdate();   // höchstens alle 15 Minuten, erst nachdem die Seite ausgeliefert ist
