<?php
/**
 * Calc – PNG-Bilder verkleinern (256 Farben, beste Kompression). Nur für die Kommandozeile.
 *
 *   php tools/shrink-png.php docs app/shots app/icons
 */
if (PHP_SAPI !== 'cli') exit;
foreach (array_slice($argv, 1) as $dir) {
    $it = is_dir($dir) ? new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS)) : [new SplFileInfo($dir)];
    foreach ($it as $f) {
        if (strtolower($f->getExtension()) !== 'png') continue;
        $p = $f->getPathname();
        $before = filesize($p);
        $i = imagecreatefrompng($p);
        $w = imagesx($i); $h = imagesy($i);
        $q = imagecreatetruecolor($w, $h);
        imagealphablending($q, false);
        imagesavealpha($q, true);
        imagecopy($q, $i, 0, 0, 0, 0, $w, $h);
        imagetruecolortopalette($q, true, 255);
        imagesavealpha($q, true);
        $tmp = $p . '.tmp';
        imagepng($q, $tmp, 9);
        clearstatcache();
        if (filesize($tmp) < $before) rename($tmp, $p); else unlink($tmp);
        clearstatcache();
        printf("%s  %d KB → %d KB\n", $p, $before / 1024, filesize($p) / 1024);
    }
}
