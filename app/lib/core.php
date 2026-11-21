<?php
/* Drehsel – Grundlagen: Datenordner, Einstellungen, Kopfzeilen, Sprache des Servers, Dateilisten, Manifest */
defined('DR_VERSION') || exit;

function drNotFound(): void {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    header('Cache-Control: no-store');
    exit("404\n");
}

/**
 * Einstellungen aus data/config.php. Fehlt die Datei, wird sie angelegt, samt data/ und einer .htaccess, die den Ordner sperrt.
 * Drehsel speichert nichts über Besucher, der Ordner hält nur den Stand der Updates.
 * Was sich von Hand eintragen lässt, steht im Kopf der Datei.
 */
function drConfig(): array {
    static $cfg = null;
    if ($cfg !== null) return $cfg;
    $defaults = ['auto_update' => true];
    $file = DR_DATA_DIR . '/config.php';
    if (is_file($file)) {
        $c = @include $file;
        if (is_array($c)) return $cfg = $c + $defaults + ['writable' => true];
    }
    if (!is_dir(DR_DATA_DIR) && !@mkdir(DR_DATA_DIR, 0700, true) && !is_dir(DR_DATA_DIR)) {
        return $cfg = $defaults + ['writable' => false];   // ohne Schreibrechte läuft Drehsel trotzdem, nur ohne Updates von selbst
    }
    if (!is_file(DR_DATA_DIR . '/.htaccess')) {
        @file_put_contents(DR_DATA_DIR . '/.htaccess', "# Drehsel: Einstellungen des Servers, nichts davon darf von außen abrufbar sein.\n"
            . "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\nOptions -Indexes\n");
    }
    if (!is_file(DR_DATA_DIR . '/index.html')) @file_put_contents(DR_DATA_DIR . '/index.html', '');
    $php = "<?php\n"
        . "// Drehsel: automatisch angelegt. Einträge, die man hier von Hand ergänzen kann (Standardwerte in Klammern):\n"
        . "//   'auto_update' => false, keine automatischen Updates aus dem GitHub-Release (true = an).\n"
        . "//   'update_url' => '',     andere Adresse für Updates, '' schaltet sie ganz ab.\n"
        . "return array (\n);\n";
    $ok = @file_put_contents($file . '.tmp', $php, LOCK_EX) !== false && @rename($file . '.tmp', $file);
    if (!$ok) { @unlink($file . '.tmp'); return $cfg = $defaults + ['writable' => false]; }
    @chmod($file, 0600);
    return $cfg = $defaults + ['writable' => true];
}

function drIsHttps(): bool {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (int)($_SERVER['SERVER_PORT'] ?? 0) === 443;
}

function drHeaders(bool $html = false): void {
    if (headers_sent()) return;
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
    header('Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=(), usb=()');
    header('Cross-Origin-Opener-Policy: same-origin');
    header('Cross-Origin-Resource-Policy: same-origin');
    if (drIsHttps()) header('Strict-Transport-Security: max-age=31536000');
    if ($html) {
        header("Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; "
            . "connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    } else {
        header('X-Robots-Tag: noindex, nofollow');
        header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
    }
}

function h(string $s): string {
    return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
}

/** Sprache für die wenigen Texte, die der Server selbst schreibt: Deutsch für deutsche Geräte, sonst Englisch. Die App übersetzt sich selbst. */
function drLang(): string {
    $al = strtolower(trim((string)($_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? '')));
    return $al === '' || strncmp($al, 'de', 2) === 0 ? 'de' : 'en';
}
function drT(string $de, string $en): string {
    return drLang() === 'de' ? $de : $en;
}

/** Dateitypen, die über ?action=asset ausgeliefert werden */
function drAssetTypes(): array {
    return ['css' => 'text/css; charset=utf-8', 'js' => 'text/javascript; charset=utf-8', 'svg' => 'image/svg+xml', 'png' => 'image/png', 'woff2' => 'font/woff2'];
}

/** Sprachen, für die es eingebaute Listen gibt (app/lists/xx.txt) */
function drListLangs(): array {
    static $l = null;
    if ($l !== null) return $l;
    $l = [];
    foreach ((array)@glob(DR_APP . '/lists/*.txt') as $f) {
        $b = basename($f, '.txt');
        if (preg_match('~^[a-z]{2}$~', $b)) $l[] = $b;
    }
    sort($l);
    return $l;
}

/** Übersetzungen der Oberfläche (app/assets/i18n-xx.js). Deutsch steckt im Code selbst. */
function drUiLangs(): array {
    $l = ['de'];
    foreach ((array)@glob(DR_APP . '/assets/i18n-*.js') as $f) {
        if (preg_match('~^i18n-([a-z]{2})\.js$~', basename($f), $m)) $l[] = $m[1];
    }
    return array_values(array_unique($l));
}

/** Kennung für den Stand einer Datei: Version plus Änderungszeit, damit der Browser nach jedem Update frisch lädt */
function drFileVersion(string $rel): string {
    return DR_VERSION . '-' . (int)@filemtime(DR_APP . '/' . $rel);
}
function drAssetUrl(string $f): string {
    return '?action=asset&f=' . $f . '&v=' . drFileVersion('assets/' . $f);
}
function drListUrl(string $l): string {
    return '?action=lists&l=' . $l . '&v=' . drFileVersion('lists/' . $l . '.txt');
}

/** CSS ausliefern: Verweise auf Schriften bekommen die Versionskennung, damit sie genau so im Vorrat des Service Workers liegen */
function drCss(string $f): string {
    $css = (string)@file_get_contents(DR_APP . '/assets/' . $f);
    return (string)preg_replace_callback('~\?action=asset&f=([a-z0-9][a-z0-9\-]*\.woff2)~', function ($m) {
        return is_file(DR_APP . '/assets/' . $m[1]) ? drAssetUrl($m[1]) : $m[0];
    }, $css);
}

/** Was der Service Worker beim Installieren vorhält: die Seite, alle Dateien und die Listen aller Sprachen */
function drPrecacheList(): array {
    $out = ['./', '?action=manifest'];
    $types = drAssetTypes();
    foreach ((array)@glob(DR_APP . '/assets/*') as $f) {
        $b = basename($f);
        if ($b === 'sw.js' || !isset($types[strtolower((string)pathinfo($b, PATHINFO_EXTENSION))])) continue;
        $out[] = drAssetUrl($b);
    }
    foreach (drListLangs() as $l) $out[] = drListUrl($l);
    return $out;
}

/** Web-App-Manifest */
function drManifest(): array {
    return [
        'name' => 'Drehsel', 'short_name' => 'Drehsel', 'id' => './',
        'description' => drT('Glücksrad, Losbox und Würfel für Spiele mit Senioren und Kindern. Eigene Listen, groß und gut lesbar, auch offline.',
            'Spinning wheel, lucky draw and dice for games with seniors and children. Your own lists, big and easy to read, works offline.'),
        'start_url' => './', 'scope' => './', 'display' => 'standalone', 'orientation' => 'any', 'lang' => drLang(),
        'background_color' => '#f4f1fb', 'theme_color' => '#6741d9', 'categories' => ['games', 'education', 'entertainment', 'kids'],
        'icons' => [
            ['src' => drAssetUrl('icon-192.png'), 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'any'],
            ['src' => drAssetUrl('icon-512.png'), 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any'],
            ['src' => drAssetUrl('icon-maskable.png'), 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'maskable'],
            ['src' => drAssetUrl('icon.svg'), 'sizes' => 'any', 'type' => 'image/svg+xml', 'purpose' => 'any'],
        ],
    ];
}

/** Datei aus dem Netz holen (folgt Weiterleitungen, höchstens $max Bytes). Wirft bei jedem Fehler. */
function drHttpGet(string $url, int $max): string {
    if (!preg_match('~^https?://~i', $url)) throw new RuntimeException('bad url');
    $ua = 'Drehsel/' . DR_VERSION . ' (self-hosted)';
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        $buf = '';
        curl_setopt_array($ch, [CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 5, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 60,
            CURLOPT_USERAGENT => $ua, CURLOPT_HTTPHEADER => ['Accept: application/vnd.github+json, application/octet-stream;q=0.9, */*;q=0.5'],
            CURLOPT_WRITEFUNCTION => function ($ch, $chunk) use (&$buf, $max) { $buf .= $chunk; return strlen($buf) > $max ? 0 : strlen($chunk); }]);
        $ok = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        if (strlen($buf) > $max) throw new RuntimeException('too large');
        if ($ok === false || $code !== 200) throw new RuntimeException('HTTP ' . ($code ?: $err));
        return $buf;
    }
    if (!filter_var(ini_get('allow_url_fopen'), FILTER_VALIDATE_BOOLEAN)) throw new RuntimeException('no curl, no allow_url_fopen');
    $ctx = stream_context_create(['http' => ['method' => 'GET', 'header' => "User-Agent: $ua\r\nAccept: application/vnd.github+json, */*;q=0.5", 'timeout' => 60,
        'follow_location' => 1, 'max_redirects' => 5, 'ignore_errors' => true]]);
    $buf = @file_get_contents($url, false, $ctx, 0, $max + 1);
    $code = isset($http_response_header) && preg_match_all('~^HTTP/\S+\s+(\d+)~m', implode("\n", $http_response_header), $m) ? (int)end($m[1]) : 0;
    if ($buf === false || $code !== 200) throw new RuntimeException('HTTP ' . $code);
    if (strlen($buf) > $max) throw new RuntimeException('too large');
    return $buf;
}
