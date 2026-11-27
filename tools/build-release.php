<?php
/**
 * Calc – Release bauen (nur für die Kommandozeile, Nutzer brauchen das nie)
 *
 *   php tools/build-release.php            prüfen, testen, Installer und ZIP nach dist/ bauen
 *   php tools/build-release.php --update   nur die Dateiliste und Prüfsumme im Service Worker (sw.js) auffrischen
 *   php tools/build-release.php --check    nur prüfen, ob sw.js zum Stand der Dateien passt (für GitHub Actions)
 *   --skip-tests                           Tests auslassen (nur zum Ausprobieren, nie für ein Release)
 *
 * Legt im Ordner dist/ an:
 *   calc-install.php      eine einzige Datei zum Hochladen, entpackt sich im Browser selbst
 *   calc-<Version>.zip    alle Dateien zum Entpacken von Hand (läuft auf jedem Webspace, auch ohne PHP)
 *   SHA256SUMS            Prüfsummen
 *
 * Die Version steht an genau einer Stelle: <meta name="calc-version"> in index.html.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$root = dirname(__DIR__);
$dist = $root . '/dist';
$args = array_slice($argv, 1);
$mode = in_array('--update', $args, true) ? 'update' : (in_array('--check', $args, true) ? 'check' : 'build');
$skipTests = in_array('--skip-tests', $args, true);

function fail($msg)
{
    fwrite(STDERR, "FEHLER: $msg\n");
    exit(1);
}

$index = (string)file_get_contents($root . '/index.html');
if (!preg_match('~<meta name="calc-version" content="([0-9][0-9A-Za-z.\-]*)">~', $index, $m)) fail('calc-version nicht in index.html gefunden.');
$version = $m[1];

/* ---------- 1) Dateiliste für den Offline-Vorrat ---------- */
// Alles, was die App im Browser braucht. Lizenztexte und die Bilder fürs Installationsfenster (app/shots) nicht.
$appFiles = [];
$it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root . '/app', FilesystemIterator::SKIP_DOTS));
foreach ($it as $f) {
    if (!$f->isFile()) continue;
    $rel = str_replace('\\', '/', substr($f->getPathname(), strlen($root) + 1));
    $appFiles[] = $rel;
}
sort($appFiles, SORT_STRING);
$cacheFiles = array_values(array_filter($appFiles, function ($p) {
    return !preg_match('~\.(txt|md)$~', $p) && strpos($p, 'app/shots/') !== 0;
}));
$cacheList = array_merge(['./', 'index.html', 'manifest.webmanifest'], $cacheFiles);

// Prüfsumme über alles, was im Vorrat landet. Ändert sich eine Datei, ändert sich BUILD und damit sw.js.
$h = hash_init('sha256');
foreach (array_merge(['index.html', 'manifest.webmanifest'], $cacheFiles) as $p) {
    hash_update($h, $p . "\0" . file_get_contents($root . '/' . $p) . "\0");
}
$build = substr(hash_final($h), 0, 12);

$swPath = $root . '/sw.js';
$sw = (string)file_get_contents($swPath);
$newSw = preg_replace("~^const VERSION = '[^']*';~m", "const VERSION = '" . $version . "';", $sw, 1);
$newSw = preg_replace("~^const BUILD = '[^']*';~m", "const BUILD = '" . $build . "';", $newSw, 1);
$listJs = "const FILES = [\n" . implode(",\n", array_map(function ($p) { return "    '" . $p . "'"; }, $cacheList)) . ",\n];";
$newSw = preg_replace('~^const FILES = \[[^\]]*\];~ms', str_replace('\\', '\\\\', $listJs), $newSw, 1);
if ($newSw === null || substr_count($newSw, "const BUILD = '" . $build . "'") !== 1) fail('sw.js hat nicht das erwartete Format.');

if ($mode === 'update') {
    if ($newSw !== $sw) { file_put_contents($swPath, $newSw); echo "sw.js aufgefrischt (Version $version, Build $build, " . count($cacheList) . " Dateien)\n"; }
    else echo "sw.js ist schon aktuell (Version $version, Build $build)\n";
    exit(0);
}
if ($newSw !== $sw) fail("sw.js passt nicht zu den Dateien. Bitte ausführen: php tools/build-release.php --update");
echo "sw.js aktuell: Version $version, Build $build, " . count($cacheList) . " Dateien im Offline-Vorrat\n";
if ($mode === 'check') exit(0);

/* ---------- 2) Tests ---------- */
foreach (['tools/installer-template.php', 'tools/build-release.php'] as $p) {
    exec('php -l ' . escapeshellarg($root . '/' . $p) . ' 2>&1', $out, $rc);
    if ($rc !== 0) fail("Syntaxfehler in $p:\n" . implode("\n", $out));
}
if ($skipTests) {
    echo "Tests ausgelassen (--skip-tests)\n";
} else {
    $node = trim((string)shell_exec('command -v node 2>/dev/null'));
    if ($node === '') fail('Für die Tests wird Node.js gebraucht (node tests/run.js). Ohne: --skip-tests');
    passthru(escapeshellarg($node) . ' ' . escapeshellarg($root . '/tests/run.js'), $rc);
    if ($rc !== 0) fail('Tests fehlgeschlagen.');
}

/* ---------- 3) Installer: Vorlage + eingepackte Dateien (Pfad, SHA-256, Base64 pro Zeile) ---------- */
$files = array_merge(['index.html', 'sw.js', 'manifest.webmanifest', 'LICENSE'], $appFiles);
sort($files, SORT_STRING);
if (!is_dir($dist) && !mkdir($dist, 0755, true)) fail('dist/ konnte nicht angelegt werden.');
$tpl = (string)file_get_contents(__DIR__ . '/installer-template.php');
if (substr_count($tpl, '__halt_compiler();') !== 1) fail('Die Installer-Vorlage muss genau einmal mit __halt_compiler(); enden.');
$out = str_replace('@@VERSION@@', $version, rtrim($tpl)) . "\n";
foreach ($files as $path) {
    $bin = (string)file_get_contents($root . '/' . $path);
    $out .= $path . "\t" . hash('sha256', $bin) . "\t" . base64_encode($bin) . "\n";
}
$installer = $dist . '/calc-install.php';
file_put_contents($installer, $out);
printf("dist/calc-install.php  (%d Dateien, %d KB)\n", count($files), (int)round(strlen($out) / 1024));

// gegenprüfen: Installer zurücklesen und jede Datei vergleichen
$raw = substr($out, strpos($out, '__halt_compiler();') + strlen('__halt_compiler();'));
$n = 0;
foreach (explode("\n", $raw) as $line) {
    if (trim($line) === '') continue;
    $p = explode("\t", trim($line));
    if (count($p) !== 3 || hash('sha256', base64_decode($p[2], true)) !== $p[1] || $p[1] !== hash_file('sha256', $root . '/' . $p[0])) fail('Installer fehlerhaft bei ' . $p[0]);
    $n++;
}
if ($n !== count($files)) fail('Installer unvollständig.');
exec('php -l ' . escapeshellarg($installer) . ' 2>&1', $o2, $rc);
if ($rc !== 0) fail('Der fertige Installer hat einen Syntaxfehler.');

/* ---------- 4) ZIP zum Entpacken von Hand, alles in einem Ordner calc/ ---------- */
$zipName = 'calc-' . $version . '.zip';
if (class_exists('ZipArchive')) {
    $zipPath = $dist . '/' . $zipName;
    if (is_file($zipPath)) unlink($zipPath);
    $zip = new ZipArchive();
    if ($zip->open($zipPath, ZipArchive::CREATE) !== true) fail('ZIP konnte nicht angelegt werden.');
    foreach (array_merge($files, ['README.md', 'README.en.md']) as $path) {
        if (is_file($root . '/' . $path)) {
            $zip->addFile($root . '/' . $path, 'calc/' . $path);
            $zip->setMtimeName('calc/' . $path, 1700000000);
        }
    }
    $zip->close();
    printf("dist/%s  (%d KB)\n", $zipName, (int)round(filesize($zipPath) / 1024));
} else {
    echo "Hinweis: PHP-Erweiterung zip fehlt, das ZIP wurde ausgelassen.\n";
}

/* ---------- 5) Prüfsummen ---------- */
$sums = '';
foreach (['calc-install.php', $zipName] as $f) if (is_file($dist . '/' . $f)) $sums .= hash_file('sha256', $dist . '/' . $f) . '  ' . $f . "\n";
file_put_contents($dist . '/SHA256SUMS', $sums);
echo "dist/SHA256SUMS\nFertig: Calc $version\n";
