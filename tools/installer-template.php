<?php
/**
 * Drehsel – Installer (Version @@VERSION@@)
 *
 * Diese eine Datei enthält das ganze Programm. Hochladen, im Browser aufrufen, fertig:
 * Sie legt index.php und den Ordner app/ neben sich an und löscht sich danach selbst,
 * ebenso ein Drehsel-ZIP aus dem Release, falls eines daneben liegt.
 * Bei einem Update werden nur die Programmdateien ersetzt, der Ordner data/ wird nie angefasst.
 *
 * Erzeugt von tools/build-release.php, nicht von Hand bearbeiten.
 * Lizenz: GNU Affero General Public License v3.0, siehe Datei LICENSE.
 */

error_reporting(E_ALL);
ini_set('display_errors', '0');

define('DRI_VERSION', '@@VERSION@@');
define('DRI_MIN_PHP', '7.4.0');

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, private');
header('X-Robots-Tag: noindex, nofollow');
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");

$driAl = strtolower(trim(isset($_SERVER['HTTP_ACCEPT_LANGUAGE']) ? (string)$_SERVER['HTTP_ACCEPT_LANGUAGE'] : ''));
$driEn = $driAl !== '' && strncmp($driAl, 'de', 2) !== 0;

/** Deutsch oder Englisch, je nach Browser */
function driT($de, $en) {
    global $driEn;
    return $driEn ? $en : $de;
}

function driH($s) {
    return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
}

/** Die eingepackten Dateien: hinter dem Programmende steht pro Zeile „Pfad, Prüfsumme, Inhalt (Base64)“ */
function driPayload() {
    $fp = @fopen(__FILE__, 'rb');
    if (!$fp) return null;
    fseek($fp, __COMPILER_HALT_OFFSET__);
    $raw = stream_get_contents($fp);
    fclose($fp);
    $files = array();
    foreach (explode("\n", (string)$raw) as $line) {
        $line = trim($line);
        if ($line === '') continue;
        $p = explode("\t", $line);
        if (count($p) !== 3) return null;
        $path = $p[0];
        if (!preg_match('~^[A-Za-z0-9._\-]+(/[A-Za-z0-9._\-]+)*$~', $path) || strpos($path, '..') !== false) return null;
        $bin = base64_decode($p[2], true);
        if ($bin === false || !hash_equals($p[1], hash('sha256', $bin))) return null;
        $files[$path] = $bin;
    }
    return isset($files['index.php']) ? $files : null;
}

/** Version eines schon vorhandenen Drehsel, '' = index.php gehört zu etwas anderem, null = keine da */
function driInstalledVersion($index) {
    if (!is_file($index)) return null;
    $head = (string)@file_get_contents($index, false, null, 0, 8192);
    if (strpos($head, 'Drehsel') !== false && preg_match("~define\\('DR_VERSION',\\s*'([0-9][0-9A-Za-z.\\-]*)'\\)~", $head, $m)) return $m[1];
    return '';
}

/** Schreibt alles erst unter einem Zwischennamen und tauscht dann um. Liefert Fehlertext oder ''. */
function driInstall($dir, array $files) {
    $tmp = array();
    $fail = '';
    foreach ($files as $path => $bin) {
        $target = $dir . '/' . $path;
        $parent = dirname($target);
        if (!is_dir($parent) && !@mkdir($parent, 0755, true) && !is_dir($parent)) { $fail = $path; break; }
        $t = $target . '.tmp';
        if (@file_put_contents($t, $bin) !== strlen($bin) || hash('sha256', (string)@file_get_contents($t)) !== hash('sha256', $bin)) {
            @unlink($t);
            $fail = $path;
            break;
        }
        $tmp[$t] = $target;
    }
    if ($fail === '') {
        foreach ($tmp as $t => $target) {
            if (!@rename($t, $target)) { $fail = substr($target, strlen($dir) + 1); break; }
            @chmod($target, 0644);
            if (function_exists('opcache_invalidate')) @opcache_invalidate($target, true);
        }
    }
    if ($fail !== '') {
        foreach ($tmp as $t => $target) if (is_file($t)) @unlink($t);
        return $fail;
    }
    // Programmteile, die es in dieser Version nicht mehr gibt, wegräumen (nur .php in app/, sonst nichts)
    foreach (array('lib', 'views', 'assets', 'lists', 'licenses') as $sub) {
        foreach ((array)@glob($dir . '/app/' . $sub . '/*') as $old) {
            if (!isset($files['app/' . $sub . '/' . basename($old)])) @unlink($old);
        }
    }
    return '';
}

/** Drehsel-ZIPs aus dem Release, die neben dem Installer liegen (werden nach der Installation nicht mehr gebraucht) */
function driZips($dir) {
    $out = array();
    foreach ((array)@glob($dir . '/drehsel-*.zip') as $z) {
        if (is_file($z) && preg_match('~^drehsel-[0-9][0-9A-Za-z.\-]*\.zip$~', basename($z))) $out[] = $z;
    }
    return $out;
}

$driDir = __DIR__;
$driSelf = __FILE__;
$driIndex = $driDir . '/index.php';
$driSelfIsIndex = realpath($driSelf) === realpath($driIndex);
$driFiles = driPayload();
$driOld = $driSelfIsIndex ? null : driInstalledVersion($driIndex);
$driHasData = is_dir($driDir . '/data');

$driProblems = array();
if (version_compare(PHP_VERSION, DRI_MIN_PHP, '<')) {
    $driProblems[] = driT('Drehsel braucht PHP 7.4 oder neuer, hier läuft PHP ', 'Drehsel needs PHP 7.4 or newer, this server runs PHP ') . PHP_VERSION . '.';
}
if (!is_writable($driDir)) {
    $driProblems[] = driT('PHP darf in diesen Ordner nicht schreiben. Bitte die Schreibrechte anpassen.', 'PHP is not allowed to write to this folder. Please fix the permissions.');
}
if ($driFiles === null) {
    $driProblems[] = driT('Diese Installer-Datei ist beschädigt (unvollständig hochgeladen?). Bitte noch einmal herunterladen und im Binärmodus hochladen.', 'This installer file is damaged (incomplete upload?). Please download it again and upload it in binary mode.');
}

$driError = '';
$driDone = false;
$driSelfGone = true;
if (!$driProblems && (isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : '') === 'POST' && isset($_POST['dri_go'])) {
    if ($driOld === '' && empty($_POST['dri_overwrite'])) {
        $driError = driT('Bitte erst bestätigen, dass die vorhandene index.php ersetzt werden darf.', 'Please confirm first that the existing index.php may be replaced.');
    } else {
        $fail = driInstall($driDir, $driFiles);
        if ($fail !== '') {
            $driError = driT('Diese Datei ließ sich nicht schreiben: ', 'This file could not be written: ') . $fail
                      . driT('. Es wurde nichts verändert.', '. Nothing has been changed.');
        } else {
            $driDone = true;
            foreach (driZips($driDir) as $z) @unlink($z);
            if (!$driSelfIsIndex) {
                @unlink($driSelf);
                clearstatcache();
                $driSelfGone = !is_file($driSelf);
            }
            if ($driSelfGone) {
                header('Location: index.php');
                exit;
            }
        }
    }
}

$driTitle = $driOld ? driT('Drehsel aktualisieren', 'Update Drehsel') : driT('Drehsel installieren', 'Install Drehsel');
?><!DOCTYPE html>
<html lang="<?php echo $driEn ? 'en' : 'de'; ?>">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title><?php echo driH($driTitle); ?></title>
<style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1.25rem;
           background: #0b1120; color: #e2e8f0; font: 16px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    .card { width: 100%; max-width: 34rem; background: #111a2e; border: 1px solid #26324d; border-radius: 1rem; padding: 1.75rem; }
    h1 { margin: 0 0 0.25rem; font-size: 1.4rem; }
    .sub { margin: 0 0 1.25rem; color: #94a3b8; font-size: 0.9rem; }
    ul { margin: 0 0 1.25rem; padding-left: 1.2rem; }
    li { margin-bottom: 0.35rem; }
    code { background: #0b1120; border: 1px solid #26324d; border-radius: 0.35rem; padding: 0.05rem 0.35rem; font-size: 0.85em; }
    .box { border-radius: 0.6rem; padding: 0.7rem 0.85rem; margin-bottom: 1rem; font-size: 0.92rem; }
    .bad { background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; }
    .warn { background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.4); color: #fcd34d; }
    .good { background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.4); color: #6ee7b7; }
    label { display: flex; gap: 0.6rem; align-items: flex-start; margin-bottom: 1rem; font-size: 0.92rem; }
    button, .btn { display: inline-block; width: 100%; border: 0; border-radius: 0.6rem; padding: 0.8rem 1rem; font: inherit; font-weight: 600;
                   color: #fff; background: #1f3a5f; cursor: pointer; text-align: center; text-decoration: none; }
    button:hover, .btn:hover { background: #2b4c78; }
</style>
</head>
<body>
<div class="card">
    <h1><?php echo driH($driTitle); ?></h1>
    <p class="sub">Version <?php echo driH(DRI_VERSION); ?></p>
<?php if ($driDone): ?>
    <div class="box good"><?php echo driH(driT('Drehsel ist eingerichtet.', 'Drehsel is installed.')); ?></div>
    <div class="box bad"><?php echo driH(driT('Diese Installer-Datei ließ sich nicht löschen. Bitte lösche sie jetzt von Hand: ', 'This installer file could not be deleted. Please delete it by hand now: ')); ?><code><?php echo driH(basename($driSelf)); ?></code></div>
    <a class="btn" href="index.php"><?php echo driH(driT('Weiter zu Drehsel', 'Continue to Drehsel')); ?></a>
<?php elseif ($driProblems): ?>
<?php foreach ($driProblems as $p): ?>
    <div class="box bad"><?php echo driH($p); ?></div>
<?php endforeach; ?>
    <p class="sub"><?php echo driH(driT('Es wurde nichts verändert. Behebe das Problem und lade diese Seite neu.', 'Nothing has been changed. Fix the problem and reload this page.')); ?></p>
<?php else: ?>
<?php if ($driError !== ''): ?>
    <div class="box bad"><?php echo driH($driError); ?></div>
<?php endif; ?>
    <ul>
<?php if ($driOld): ?>
        <li><?php echo driH(driT('Gefunden: Drehsel ', 'Found: Drehsel ') . $driOld . driT('. Es wird auf ', '. It will be updated to ') . DRI_VERSION . driT(' aktualisiert.', '.')); ?></li>
<?php else: ?>
        <li><?php echo driT('Legt <code>index.php</code> und den Ordner <code>app/</code> in diesem Verzeichnis an.', 'Creates <code>index.php</code> and the folder <code>app/</code> in this directory.'); ?></li>
<?php endif; ?>
<?php if ($driHasData): ?>
        <li><?php echo driT('Der Ordner <code>data/</code> mit den Einstellungen bleibt unangetastet.', 'The folder <code>data/</code> with the settings is left untouched.'); ?></li>
<?php endif; ?>
        <li><?php echo driH(driT('Danach löscht sich diese Installer-Datei selbst.', 'Afterwards this installer file deletes itself.')); ?></li>
<?php foreach (driZips($driDir) as $z): ?>
        <li><?php echo driT('Auch <code>', 'Also <code>') . driH(basename($z)) . driT('</code> wird gelöscht, die Datei wird dann nicht mehr gebraucht.', '</code> is deleted, the file is no longer needed then.'); ?></li>
<?php endforeach; ?>
    </ul>
    <form method="post">
        <input type="hidden" name="dri_go" value="1">
<?php if ($driOld === ''): ?>
        <div class="box warn"><?php echo driT('In diesem Verzeichnis liegt schon eine <code>index.php</code>, die nicht zu Drehsel gehört. Sie würde überschrieben.', 'This directory already contains an <code>index.php</code> that does not belong to Drehsel. It would be overwritten.'); ?></div>
        <label><input type="checkbox" name="dri_overwrite" value="1"> <span><?php echo driH(driT('Ja, die vorhandene index.php darf ersetzt werden.', 'Yes, the existing index.php may be replaced.')); ?></span></label>
<?php endif; ?>
        <button type="submit"><?php echo driH($driOld ? driT('Jetzt aktualisieren', 'Update now') : driT('Jetzt installieren', 'Install now')); ?></button>
    </form>
<?php endif; ?>
</div>
</body>
</html>
<?php
__halt_compiler();
