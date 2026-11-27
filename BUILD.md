# Selbst bauen

*English summary at the end.*

Calc braucht keinen Build-Schritt: die Dateien im Repository sind die App. Ein kleiner Webserver im Ordner genügt zum Ausprobieren (`php -S localhost:8000` oder `python3 -m http.server`).

Für ein Release entstehen aus dem Quellcode zwei Dateien zum Herunterladen:

```sh
php tools/build-release.php
```

Danach liegen in `dist/`:

| Datei | Was |
|---|---|
| `calc-install.php` | eine Datei zum Hochladen, entpackt sich im Browser selbst (braucht PHP 7.0+) |
| `calc-<Version>.zip` | alles zum Entpacken von Hand, läuft auf jedem Webspace auch ohne PHP |
| `SHA256SUMS` | Prüfsummen |

## Was man braucht

- **PHP 8.0 oder neuer** auf der Kommandozeile, mit der Erweiterung `zip` fürs ZIP
- **Node.js 18 oder neuer** für die Tests (`node tests/run.js`), ohne Pakete
- Für die Geräte-Tests, Symbole und Screenshots zusätzlich Playwright mit Chromium

## Was beim Bauen passiert

1. Version aus `index.html` lesen (`<meta name="calc-version" content="…">`). Nur dort steht sie.
2. Prüfen, ob die Dateiliste und die Prüfsumme in `sw.js` zum Stand der Dateien passen. Wenn nicht: `php tools/build-release.php --update` ausführen und `sw.js` mit einchecken. Ändert sich irgendeine Datei, ändert sich die Prüfsumme, und die Browser holen sich die neue Version.
3. Tests: `node tests/run.js` (Dezimalzahlen, Ausdrücke, Tischrechner, Übersetzungen, Kontrast aller Designs, Offline-Dateiliste).
4. Installer zusammensetzen (Vorlage `tools/installer-template.php`, dahinter pro Datei eine Zeile mit Pfad, SHA-256 und Inhalt als Base64), zurücklesen und jede Prüfsumme kontrollieren.
5. ZIP und `SHA256SUMS` schreiben.

`--skip-tests` lässt die Tests aus (nur zum Ausprobieren, nie für ein Release). `--check` prüft nur `sw.js` (so läuft es in GitHub Actions).

## Weitere Werkzeuge

```sh
node tests/geraete.js                      # Handy, Tablet, Computer, hoch und quer, alle Designs, plus Offline-Test
SHOTS=1 OUT=/tmp/bilder node tests/geraete.js   # dazu Bildschirmfotos
node tools/make-icons.js && php tools/shrink-png.php app/icons    # App-Symbole aus tools/icon-src/
node tools/screenshots.js && php tools/shrink-png.php docs app/shots   # Bilder für die README
```

## Release auf GitHub

`.github/workflows/release.yml` baut mit demselben Befehl und hängt Installer, ZIP und Prüfsummen an das Release. Auslösen: einen Tag wie `1.0.0` pushen oder unter *Actions → Release → Run workflow*. Text fürs Release: `docs/release-notes/<Version>.md`.

---

**English summary:** Calc has no build step, the repository is the app. `php tools/build-release.php` checks that the offline file list in `sw.js` is current (`--update` refreshes it), runs `node tests/run.js` and writes `dist/calc-install.php`, `dist/calc-<version>.zip` and `dist/SHA256SUMS`. The version lives only in `index.html`. Releases are built by `.github/workflows/release.yml` when a tag like `1.0.0` is pushed or the workflow is run by hand.
