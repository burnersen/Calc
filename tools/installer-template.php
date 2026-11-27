<?php
/**
 * Calc – Installer (Version @@VERSION@@)
 *
 * Diese eine Datei enthält die ganze App. Hochladen, im Browser aufrufen, fertig:
 * Sie legt index.html, sw.js, manifest.webmanifest und den Ordner app/ neben sich an und löscht sich danach selbst,
 * ebenso ein Calc-ZIP aus dem Release, falls eines daneben liegt.
 * Calc selbst braucht kein PHP und keine Datenbank. PHP wird nur für diesen Installer gebraucht.
 * Alles, was Nutzer speichern, liegt in ihrem Browser, nicht auf dem Server.
 *
 * Erzeugt von tools/build-release.php, nicht von Hand bearbeiten.
 * Lizenz: GNU Affero General Public License v3.0, siehe Datei LICENSE.
 */

error_reporting(E_ALL);
ini_set('display_errors', '0');

define('CAI_VERSION', '@@VERSION@@');
define('CAI_MIN_PHP', '7.0.0');

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, private');
header('X-Robots-Tag: noindex, nofollow');
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");

$caiAl = strtolower(trim(isset($_SERVER['HTTP_ACCEPT_LANGUAGE']) ? (string)$_SERVER['HTTP_ACCEPT_LANGUAGE'] : ''));
$caiEn = $caiAl !== '' && strncmp($caiAl, 'de', 2) !== 0;

/** Deutsch oder Englisch, je nach Browser */
function caiT($de, $en) {
    global $caiEn;
    return $caiEn ? $en : $de;
}

function caiH($s) {
    return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
}

/** Die eingepackten Dateien: hinter dem Programmende steht pro Zeile „Pfad, Prüfsumme, Inhalt (Base64)“ */
function caiPayload() {
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
    return isset($files['index.html'], $files['sw.js']) ? $files : null;
}

/** Version eines schon vorhandenen Calc, '' = index.html gehört zu etwas anderem, null = keine da */
function caiInstalledVersion($index) {
    if (!is_file($index)) return null;
    $head = (string)@file_get_contents($index, false, null, 0, 8192);
    if (preg_match('~<meta name="calc-version" content="([0-9][0-9A-Za-z.\-]*)">~', $head, $m)) return $m[1];
    return '';
}

/** Schreibt alles erst unter einem Zwischennamen und tauscht dann um. Liefert Fehlertext oder ''. */
function caiInstall($dir, array $files) {
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
    // Programmteile, die es in dieser Version nicht mehr gibt, wegräumen (nur in den Ordnern von Calc unter app/)
    foreach (array('js', 'css', 'fonts', 'icons', 'shots') as $sub) {
        foreach ((array)@glob($dir . '/app/' . $sub . '/*') as $old) {
            if (is_file($old) && !isset($files['app/' . $sub . '/' . basename($old)])) @unlink($old);
        }
    }
    return '';
}

/** Calc-ZIPs aus dem Release, die neben dem Installer liegen (werden nach der Installation nicht mehr gebraucht) */
function caiZips($dir) {
    $out = array();
    foreach ((array)@glob($dir . '/calc-*.zip') as $z) {
        if (is_file($z) && preg_match('~^calc-[0-9][0-9A-Za-z.\-]*\.zip$~', basename($z))) $out[] = $z;
    }
    return $out;
}

$caiDir = __DIR__;
$caiSelf = __FILE__;
$caiIndex = $caiDir . '/index.html';
$caiSelfIsIndex = false;
$caiFiles = caiPayload();
$caiOld = caiInstalledVersion($caiIndex);
$caiHasData = false;
$caiPhpIndex = is_file($caiDir . '/index.php');

$caiProblems = array();
if (version_compare(PHP_VERSION, CAI_MIN_PHP, '<')) {
    $caiProblems[] = caiT('Dieser Installer braucht PHP 7.0 oder neuer, hier läuft PHP ', 'This installer needs PHP 7.0 or newer, this server runs PHP ') . PHP_VERSION . caiT('. Alternativ das ZIP aus dem Release entpacken und hochladen.', '. Alternatively unpack the ZIP from the release and upload it.');
}
if (!is_writable($caiDir)) {
    $caiProblems[] = caiT('PHP darf in diesen Ordner nicht schreiben. Bitte die Schreibrechte anpassen.', 'PHP is not allowed to write to this folder. Please fix the permissions.');
}
if ($caiFiles === null) {
    $caiProblems[] = caiT('Diese Installer-Datei ist beschädigt (unvollständig hochgeladen?). Bitte noch einmal herunterladen und im Binärmodus hochladen.', 'This installer file is damaged (incomplete upload?). Please download it again and upload it in binary mode.');
}

$caiError = '';
$caiDone = false;
$caiSelfGone = true;
if (!$caiProblems && (isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : '') === 'POST' && isset($_POST['cai_go'])) {
    if ($caiOld === '' && empty($_POST['cai_overwrite'])) {
        $caiError = caiT('Bitte erst bestätigen, dass die vorhandene index.html ersetzt werden darf.', 'Please confirm first that the existing index.html may be replaced.');
    } else {
        $fail = caiInstall($caiDir, $caiFiles);
        if ($fail !== '') {
            $caiError = caiT('Diese Datei ließ sich nicht schreiben: ', 'This file could not be written: ') . $fail
                      . caiT('. Es wurde nichts verändert.', '. Nothing has been changed.');
        } else {
            $caiDone = true;
            foreach (caiZips($caiDir) as $z) @unlink($z);
            if (!$caiSelfIsIndex) {
                @unlink($caiSelf);
                clearstatcache();
                $caiSelfGone = !is_file($caiSelf);
            }
            if ($caiSelfGone) {
                header('Location: ./');
                exit;
            }
        }
    }
}

$caiTitle = $caiOld ? caiT('Calc aktualisieren', 'Update Calc') : caiT('Calc installieren', 'Install Calc');
?><!DOCTYPE html>
<html lang="<?php echo $caiEn ? 'en' : 'de'; ?>">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title><?php echo caiH($caiTitle); ?></title>
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
                   color: #fff; background: #2563eb; cursor: pointer; text-align: center; text-decoration: none; }
    button:hover, .btn:hover { background: #1d4ed8; }
</style>
</head>
<body>
<div class="card">
    <h1><?php echo caiH($caiTitle); ?></h1>
    <p class="sub">Version <?php echo caiH(CAI_VERSION); ?></p>
<?php if ($caiDone): ?>
    <div class="box good"><?php echo caiH(caiT('Calc ist eingerichtet.', 'Calc is installed.')); ?></div>
    <div class="box bad"><?php echo caiH(caiT('Diese Installer-Datei ließ sich nicht löschen. Bitte lösche sie jetzt von Hand: ', 'This installer file could not be deleted. Please delete it by hand now: ')); ?><code><?php echo caiH(basename($caiSelf)); ?></code></div>
    <a class="btn" href="./"><?php echo caiH(caiT('Weiter zu Calc', 'Continue to Calc')); ?></a>
<?php elseif ($caiProblems): ?>
<?php foreach ($caiProblems as $p): ?>
    <div class="box bad"><?php echo caiH($p); ?></div>
<?php endforeach; ?>
    <p class="sub"><?php echo caiH(caiT('Es wurde nichts verändert. Behebe das Problem und lade diese Seite neu.', 'Nothing has been changed. Fix the problem and reload this page.')); ?></p>
<?php else: ?>
<?php if ($caiError !== ''): ?>
    <div class="box bad"><?php echo caiH($caiError); ?></div>
<?php endif; ?>
    <ul>
<?php if ($caiOld): ?>
        <li><?php echo caiH(caiT('Gefunden: Calc ', 'Found: Calc ') . $caiOld . caiT('. Es wird auf ', '. It will be updated to ') . CAI_VERSION . caiT(' aktualisiert.', '.')); ?></li>
        <li><?php echo caiH(caiT('Wer Calc schon benutzt, bekommt die neue Version beim nächsten Öffnen. Einstellungen, Verlauf und Streifen bleiben auf den Geräten erhalten.', 'Anyone already using Calc gets the new version the next time they open it. Settings, history and tapes stay on their devices.')); ?></li>
<?php else: ?>
        <li><?php echo caiT('Legt <code>index.html</code>, <code>sw.js</code>, <code>manifest.webmanifest</code> und den Ordner <code>app/</code> in diesem Verzeichnis an.', 'Creates <code>index.html</code>, <code>sw.js</code>, <code>manifest.webmanifest</code> and the folder <code>app/</code> in this directory.'); ?></li>
        <li><?php echo caiH(caiT('Calc braucht danach kein PHP und keine Datenbank. Alles, was jemand speichert, bleibt in seinem Browser.', 'Afterwards Calc needs neither PHP nor a database. Everything anyone saves stays in their own browser.')); ?></li>
<?php endif; ?>
<?php if ($caiPhpIndex): ?>
        <li><?php echo caiT('Achtung: hier liegt auch eine <code>index.php</code>. Viele Server zeigen dann diese statt Calc. Calc ist trotzdem unter <code>index.html</code> erreichbar.', 'Note: there is also an <code>index.php</code> here. Many servers show that one instead of Calc. Calc is still reachable at <code>index.html</code>.'); ?></li>
<?php endif; ?>
        <li><?php echo caiH(caiT('Danach löscht sich diese Installer-Datei selbst.', 'Afterwards this installer file deletes itself.')); ?></li>
<?php foreach (caiZips($caiDir) as $z): ?>
        <li><?php echo caiT('Auch <code>', 'Also <code>') . caiH(basename($z)) . caiT('</code> wird gelöscht, die Datei wird dann nicht mehr gebraucht.', '</code> is deleted, the file is no longer needed then.'); ?></li>
<?php endforeach; ?>
        <li><?php echo caiH(caiT('Wichtig für die Installation als App und für den Offline-Betrieb: die Seite muss über https erreichbar sein.', 'Important for installing as an app and for offline use: the page must be served over https.')); ?></li>
    </ul>
    <form method="post">
        <input type="hidden" name="cai_go" value="1">
<?php if ($caiOld === ''): ?>
        <div class="box warn"><?php echo caiT('In diesem Verzeichnis liegt schon eine <code>index.html</code>, die nicht zu Calc gehört. Sie würde überschrieben.', 'This directory already contains an <code>index.html</code> that does not belong to Calc. It would be overwritten.'); ?></div>
        <label><input type="checkbox" name="cai_overwrite" value="1"> <span><?php echo caiH(caiT('Ja, die vorhandene index.html darf ersetzt werden.', 'Yes, the existing index.html may be replaced.')); ?></span></label>
<?php endif; ?>
        <button type="submit"><?php echo caiH($caiOld ? caiT('Jetzt aktualisieren', 'Update now') : caiT('Jetzt installieren', 'Install now')); ?></button>
    </form>
<?php endif; ?>
</div>
</body>
</html>
<?php
__halt_compiler();
