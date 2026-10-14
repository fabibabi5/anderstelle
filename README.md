# „an der Stelle"-Zähler

Eine kleine, lokale Web-App, die live mitzählt, wie oft dein Dozent **„an der Stelle"**
sagt – mit Wal-Party, Countdown, Minigames, Auswertung und Diagnose. Reines HTML/JS:
keine Frameworks, keine Dependencies, kein Build-Schritt (Vosk optional als kleines
Python-Programm).

## Seiten

Alles startet auf der **Startseite `index.html`** – sie verlinkt auf alle Seiten, und
jede Seite verlinkt zurück auf die Startseite.

| Seite | Wofür |
|---|---|
| `index.html` | **Startseite**: Zählerstand, heute, Rekord, Vosk-Status, Links, Kurzanleitung, Minigames |
| `wal-party.html` | Zählen mit voller Wal-Party (empfohlen für die Vorlesung) |
| `zaehler.html` | schlichter Zähler ohne Party (gleicher Zählerstand) |
| `countdown.html` | Countdown bis Vorlesungsende mit Gags, Meme-Balken, Brainrot, Walen |
| `auswertung.html` | Statistik über alle Vorlesungen |
| `diagnose.html` | Diagnose-Labor: Erkennung prüfen, Vosk-Test und -Prüfstand |

## Starten

Im Projektordner einen simplen lokalen Server starten:

```bash
python3 -m http.server 8000
```

Dann in **Google Chrome** öffnen:

```
http://localhost:8000
```

Auf der Startseite **Wal-Party** (oder den schlichten **Zähler**) öffnen, auf **Start**
klicken und beim ersten Mal den Mikrofonzugriff erlauben.

> Die Spracherkennung nutzt die Web Speech API (`webkitSpeechRecognition`) und
> funktioniert zuverlässig **nur in Chrome** auf dem Desktop. In anderen Browsern
> erscheint ein Hinweis.

## Datenschutz-Hinweis

Chrome verarbeitet die Spracherkennung **nicht rein lokal**: Das aufgenommene
Audio wird zur Erkennung an **Google-Server** gesendet. Nutze die App also nur,
wenn das für deinen Kontext in Ordnung ist.

Der **Zählerstand** wird lokal im Browser (`localStorage`) gespeichert und bleibt
nach einem Reload erhalten. Die **Transkripte** werden nur für die Diagnose lokal im
Browser gespeichert (`localStorage`, max. 8 Sitzungen), damit `diagnose.html` sie
auswerten kann. Das lässt sich im Diagnose-Panel bzw. auf der Diagnose-Seite mit
„💾 aufzeichnen“ abschalten; dort kann man gespeicherte Sitzungen auch löschen.
Nichts davon verlässt den Rechner.

## Tipp: Online-Vorlesungen (Systemaudio mitschneiden)

Standardmäßig hört die App nur dein Mikrofon. Für Online-Vorlesungen (Zoom,
Teams, …) willst du stattdessen das **Systemaudio** erkennen. Dafür eignet sich
[BlackHole](https://existential.audio/blackhole/), ein virtuelles Audiogerät für
den Mac:

1. BlackHole installieren.
2. In den macOS-Audioeinstellungen bzw. im Audio-MIDI-Setup ein
   **Multi-Output-Gerät** anlegen (BlackHole + deine Kopfhörer/Lautsprecher),
   damit du den Ton weiterhin hörst.
3. Die Vorlesungs-Audioausgabe auf dieses Multi-Output-Gerät legen.
4. **BlackHole** als **Eingabegerät** (Mikrofon) in den macOS-Soundeinstellungen
   bzw. in Chrome auswählen.

So bekommt die Spracherkennung das Vorlesungsaudio als „Mikrofon"-Eingang.

## Features

- Riesiger Live-Zähler mit kurzem Aufleuchten bei jedem Treffer
- Start/Stopp- und Reset-Button, Status-Indikator (hört zu / pausiert / Fehler)
- Live-Log der letzten ~5 erkannten Sätze mit hervorgehobenem Treffer
- Zeitstempel je Treffer plus „Treffer pro Minute" seit Start
- Tolerantes Matching (`an`/`in der stelle`, case-insensitive, mehrere pro Satz)
- Automatischer Neustart der Erkennung, bis du bewusst auf Stopp drückst
- Dark Mode, gut lesbar auch aus der Ferne

## 🐳 Party-Version: `wal-party.html`

Zweite, eigenständige Version mit Wal-Partythema – öffne sie unter
`http://localhost:8000/wal-party.html`. Der schlichte Zähler liegt in `zaehler.html`.

Bei jedem erkannten „an der Stelle" gibt es volle Party: Konfetti, Emoji-Explosion,
ein großes Banner, Screen-Flash und einen Airhorn-Sound (per Web Audio, ohne Datei).
Im Hintergrund schwimmen Wale durch einen animierten Ozean. Zähler, Rekord,
manuelles ±1 und die Spracherkennung funktionieren wie in der Standard-Version
(der Zählerstand wird mit `zaehler.html` geteilt).

**Eigene Wal-Fotos/Videos einbinden** (alles lokal, keine Downloads nötig):

- **Drag & Drop:** Bild-/Videodateien einfach auf die Seite ziehen – sie feiern
  sofort mit. (Gilt nur für die aktuelle Sitzung.)
- **Button** „🐳 Eigene Wal-Fotos/Videos hinzufügen" öffnet den Dateidialog.
- **Ordner:** Dateien `wal1.jpg` … `wal6.mp4` (Endungen jpg/jpeg/png/gif/webp/mp4/webm)
  im Projektordner werden beim Laden automatisch erkannt.

Ohne eigene Medien feiern große Wal-Emoji 🐳🐋 mit. Videos werden stummgeschaltet
abgespielt (für zuverlässiges Autoplay); den Partysound liefert das Airhorn, das
sich oben per „🔊 Sound" an-/ausschalten lässt.

## 🔍 Diagnose-Modus

In `zaehler.html` und `wal-party.html` öffnet der Button **„🔍 Diagnose"** (unten links)
ein Panel, das zeigt, was die Spracherkennung tatsächlich versteht:

- jeder erkannte Satz inkl. Alternativen und Konfidenz – Treffer ✅ grün,
  **Beinahe-Treffer** 🤔 (z. B. „an dieser Stelle", „Schelle") gelb
- Start/Ende der Erkennung, Fehler (`network`, `no-speech` …) und **Hörlücken**
  (Zeit, in der nichts erkannt werden konnte)
- ein Mikrofon-Pegel (nur solange das Panel offen ist)
- **⬇ Export** als `.txt`, um das Log z. B. weiterzugeben

Das Log lebt nur im Arbeitsspeicher und wird nicht gespeichert.

### 🔬 Diagnose-Labor: `diagnose.html`

Große Diagnose-Seite (Link auch im Diagnose-Panel):

- **Live-Test** mit eigener Erkennung und **fortlaufendem Transkript** (statt „Sätzen“ –
  die Abschnitte von Google sind willkürlich), unsicherer Live-Text in Grau
- **Markieren**, wenn die Erkennung danebenlag: **😶 Verpasst (V)**, **🚫 Falsch (F)**,
  **✌️ Doppelt (D)** – mit optionaler Notiz; gespeichert werden dazu das Transkript der
  letzten 30 s und der Pegel. Die gleichen Knöpfe/Tasten gibt es im Panel der Wal-Party
  und des Zählers, dort korrigieren sie auch den Zähler (+1/−1).
- **Mikrofon:** Live-Pegel mit 2-Minuten-Verlauf, Verstärker 2×/4×/8× mit Mikrofon-Auswahl
- **Sitzungen** aus allen Seiten (lokal gespeichert, max. 8), Import/Export als JSON/TXT
- **Auswertung:** geschätzte Trefferquote und Genauigkeit (aus den Markierungen), gerettete
  Treffer, Hörlücken, Fehler, Pegel bei Treffern vs. bei verpassten Stellen – plus
  **automatische Befunde** („verpasste Stellen waren 8 dB leiser → Verstärker/Mikro“)
- **Zeitleiste** der ganzen Sitzung: Pegel mit allen Ereignissen, Klick springt ins Protokoll
- **Protokoll** mit Filtern und Suche, **Muster-Tester**, Liste der **Beinahe-Wörter**

Hinweis: Nicht gleichzeitig mit der Wal-Party erkennen lassen – Chrome erlaubt nur eine
Erkennung auf einmal. Die Wal-Party-Sitzung lässt sich aber live in der Diagnose-Seite
mitverfolgen.

### 🧩 Kombi-Erkennung: Chrome + Vosk (Wal-Party und Zähler)

Auf den Zähl-Seiten (`zaehler.html`, `wal-party.html`) zählen **Chrome und – optional – Vosk
gemeinsam**. Grundlage ist die Auswertung im Diagnose-Labor (10 Min. Vorlesung, 15 echte
„an der Stelle“): Chrome allein 10/15 erkannt, Chrome **oder** Vosk ≥ 75 % 13/15 bei
gleich vielen Fehlalarmen.

- Chrome zählt wie bisher; **Vosk zählt zusätzlich ab 75 % Sicherheit**.
- Erkennen beide dieselbe Stelle innerhalb von **8 s**, zählt sie **nur einmal** (egal, wer zuerst war).
- **Vosk ist optional:** Läuft `./vosk/start.sh` nicht, zählt Chrome allein; sobald der Server
  läuft, verbindet sich die Seite automatisch.
- **Anzeige unten links** („🧩 Vosk …“): grau = aus/bereit, gelb = verbindet, grün = verbunden,
  rot = nicht erreichbar; „+N“ = Treffer, die nur Vosk hatte. **Klick** schaltet Vosk an/aus
  (wird gemerkt).
- Vosk nutzt die Grammatik, die zuletzt im Vosk-Test der Diagnose-Seite eingestellt war.
- Im Diagnose-Protokoll steht bei jedem Vosk-Beitrag „🧩 Vosk zählt …“.

### 🧪 Vosk-Test: zweiter Detektor (nur auf der Diagnose-Seite)

Vosk ist eine Offline-Spracherkennung, die man auf **feste Phrasen beschränken** kann
(„Grammatik“): Sie sucht dann nur nach „an der Stelle“, statt alles verstehen zu wollen.
Sie läuft als kleines Programm lokal auf dem Mac; die Diagnose-Seite schickt ihr das
Mikrofon-Audio über `ws://127.0.0.1:2700`. Nichts verlässt den Rechner.

```bash
./vosk/start.sh                 # beim ersten Mal: legt vosk/.venv an, installiert Vosk, lädt das Modell (~45 MB)
./vosk/start.sh --model gross   # großes deutsches Modell (~1,9 GB), genauer
```

Dann `diagnose.html` öffnen (am besten über `http://localhost:8000/diagnose.html`) und den
Live-Test starten – Vosk startet automatisch mit („mit Live-Test starten/stoppen“).
Im Bereich **„🧪 Vosk-Test“**:

- Live-Anzeige von Schlüsselwort- und freier Vosk-Erkennung
- Grammatik bearbeiten (Phrasen, die gezählt werden, plus „Ablenker“ wie „an dieser stelle“)
- **Sicherheits-Schwelle** (Vosk liefert pro Wort eine Sicherheit; darunter = „unsicher“)
- **Vergleich Stelle für Stelle:** Chrome / Vosk / Vosk frei / deine Markierung – inkl.
  „bei X als verpasst markierten Stellen hat Vosk Y erwischt“ und einem kombinierten Zähler
- Vosk-Treffer erscheinen auch im Transkript (🎯), im Protokoll (Filter „Vosk“) und in der Zeitleiste

Anderer Port: `diagnose.html?vosk=ws://127.0.0.1:2701` und `./vosk/start.sh --port 2701`.

**Was gilt wofür?** Der große Zähler auf der Diagnose-Seite zählt nur **Chrome**. Deshalb:

- **😶 Gesagt, nicht gezählt (V)** – hier wurde „an der Stelle“ gesagt (gilt für alle Detektoren)
- **🚫 Chrome falsch (F)** / **✌️ Chrome doppelt (D)** – beziehen sich auf den Chrome-Zähler
- **Vosk** bewertest du in der Vergleichstabelle: jede Zeile ist eine Stelle, an der ein Detektor
  angeschlagen hat → **✓ wurde gesagt** / **✗ nicht gesagt**. Daraus berechnet die Seite pro
  Detektor (Chrome, Vosk sicher, Vosk inkl. unsicher, Vosk frei, Chrome + Vosk): richtig,
  verpasst, Fehlalarm, Trefferquote und Genauigkeit.

### 🎯 Vosk-Prüfstand (Diagnose-Seite)

Gezielte Tests, bei denen feststeht, was richtig ist:

- **🗣️ Vorlese-Test:** 12 Testsätze vorlesen – mit „an der Stelle“, mit Fallen („an dieser
  Stelle“, „an der Tafel“, „Stellwand“, „an anderer Stelle“) und Varianten („leise ans
  Satzende hängen“, „schnell genuschelt“, „2 m entfernt“). Nach jedem Satz **Weiter**
  (Leertaste); ausgewertet wird pro Satz Soll gegen Ist für Vosk, Vosk frei und Chrome
  (falls der Live-Test läuft).
- **🎧 Aufnahme-Test:** Audiodatei hochladen (mp3/m4a/wav, am besten ≤ 20 Min.). Vosk wertet
  sie schneller als Echtzeit aus; jeden Treffer per ▶ anhören und mit ✓/✗ bewerten, fehlende
  Stellen beim Anhören mit „＋ hier wurde es gesagt“ ergänzen. Ideal, um Grammatik, Schwelle
  und Modell (`--model gross`) an derselben Aufnahme zu vergleichen. Die Datei bleibt lokal.

### Erkennung: was live gehört wurde, bleibt gezählt

Leise angehängte „… an der Stelle" erkennt Chrome oft im **Live-Zwischenstand**, streicht
sie im **Endergebnis** aber wieder. Früher wurde der Treffer dann abgezogen – jetzt bleibt
er (`erkennung.js`). Gezählt wird über den **zusammenhängenden** Live-Text (Chrome liefert
ihn in mehreren Teilen, zwischen denen Text wandert – pro Teil zu zählen führte zu
Doppelzählungen). Taucht ein gestrichener Treffer kurz danach wieder auf, wird er nicht
doppelt gezählt. Im Diagnose-Panel erscheinen solche Fälle als
**⚡ Live erkannt** bzw. **🛟 Gerettet**.

Zusätzlich, jeweils mit automatischer Prüfung, ob dein Chrome das kann:

- **Phrasen-Boost:** sagt Chrome, dass „an der Stelle" wichtig ist. Meldet Chrome
  „nicht unterstützt", wird er automatisch abgeschaltet.
- **🎚️ Verstärker (experimentell, im Diagnose-Panel):** 2×/4×/8× plus Kompressor – hebt
  leise Satzenden an, bevor Chrome das Audio bekommt. Funktioniert nur, wenn Chrome der
  Erkennung eine eigene Tonspur erlaubt; sonst läuft alles wie bisher mit dem normalen Mikro.
  Das Panel zeigt an, was aktiv ist.
- **Hänger-Wächter:** Chrome bleibt manchmal auf „hört zu“, liefert aber nichts mehr
  (beobachtet vor allem mit Verstärker). Wird laut Mikrofonpegel gesprochen und kommt 8 s
  lang kein Ergebnis – oder 30 s lang überhaupt keins –, startet die Erkennung neu
  (im Protokoll: „⚠ Erkennung hängt …“). Hängt es mit Verstärker zweimal innerhalb von
  3 Minuten, schaltet sich der Verstärker automatisch ab.

**Mac-Tipp:** Während Chrome das Mikrofon nutzt, im Kontrollzentrum unter
„Mikrofonmodus" **Standard** oder **Breites Spektrum** wählen – „Sprachisolierung"
filtert entfernte Sprecher (den Dozenten!) heraus.

## ⏳ Countdown: `countdown.html`

Countdown bis zum Vorlesungsende (Beginn/Ende einstellen oder „90 min ab jetzt").
Dabei passiert ständig irgendein Unsinn:

- **jede volle Minute** eine (mehr oder weniger) motivierende Durchsage
- **Schnapszahl-Sekunden** (:11, :22, :33, :44, :55), **Echo** (23:23),
  **Palindrome** (12:21), **Treppen** (12:34), **Raketenstarts** (43:21)
- **Minuten-Themen**, die eine ganze Minute dauern – z. B. 99 🎈, 69 😎, 67 🫴🫳,
  42 🐋🪴, 23 🔺, 13 🐈‍⬛, 11 ✨, 7 🕵️, 1 🚨
- **Restsekunden-Memes**: …67, …69, 3141 (π), 1337 (Matrix), 777 (Jackpot),
  666, 404, 300 (Sparta), 100 💯 …
- **Uhrzeit-Gags** (11:11, 12:34, 13:37, volle Stunde) und **Fortschritts-Meilensteine**
  (Halbzeit, 67 %, 69 %, 99 %-Windows-Ladebalken)
- **Zufalls-Gags** alle 15–40 s: Fake-Windows-Update, „Dozent.exe reagiert nicht",
  Comic Sans, Enten-Parade, Latein-/Binär-Modus, Wal-Fakten …
- die letzten 10 Sekunden riesig, danach Party und **Überziehungs-Zähler**
- liest den „an der Stelle"-Zähler mit und feiert jeden neuen Treffer
- **Meme-Fortschrittsbalken** (`memebar.js`), absichtlich nervig: wechselt alle 2,5 Min.
  (oder per Klick) das Kostüm – Windows-XP-Kopieren, YouTube mit nicht überspringbarer
  Werbung, Boss-Kampf gegen den Dozenten, Pokémon-Kampf, Akku „Geduld", Download mit
  Brieftauben-Geschwindigkeit, Mac-Regenbogenrad, Spiel-Ladebildschirm mit Tipps. Dazu
  Streiche alle 20–50 s: läuft rückwärts, springt auf 99 % („War nur Spaß 🙃"), friert ein
  („Keine Rückmeldung"), 9 Nachkommastellen, Prozent in Bananen, Turbo-Modus … und eine
  Restzeit-Anzeige, die meistens lügt. Die echte Prozentzahl steht oben bei „Geschafft".
- **Brainrot** (`brainrot.js`): Italian-Brainrot-Parade (Tralalero Tralala, Tung Tung Tung
  Sahur, Bombardiro Crocodilo, Ballerina Cappuccina …), TikTok-Untertitel Wort für Wort mit
  **Subway-Surfers-Fenster** als „Fokus-Hilfe" (per Button dauerhaft an), **Aura-Zähler**
  (+1000 Aura für Augenkontakt mit der Uhr, +6767 bei „an der Stelle"), **Brainrot-Pegel**
  (gesund → cooked → Ohio-Final-Boss → komplett verrottet), Fanum Tax auf den Timer,
  Skibidi, Mewing-Pause, Aura-Farming-Boot, Chill Guy, NPC-Modus und ein Schalter
  **„🧠 Brainrot-Sprache"**, der die Seite übersetzt („bro wann ist die Lecture endlich over 💀").
- **🎮 Minigames** (`minigames.js`, Button unten rechts, alles lautlos):
  - **🎯 Dozenten-Bingo** – 4×4-Karte pro Tag; die „an der Stelle"-Felder (1×, 3×, 5×) hakt
    die Spracherkennung automatisch ab
  - **🐳 Flappy Wal** – durch Folien-Stapel tauchen (Klick/Leertaste/↑)
  - **🔨 Whack-a-Wal** – 30 s Wale hauen, nicht den Dozenten 👨‍🏫 oder die Klausur 📝
  - **⚡ Six-Seven-Reaktion** – nur bei „67" klicken, Fallen wie 66/76/69 kosten Strafzeit
  - **🧠 Brainrot-Memory** – Italian-Brainrot-Paare finden
  - **🔮 Orakel** – tippen, wie oft noch „an der Stelle" kommt; Auswertung bei Countdown-Ende

  - **🐳 Wal-2048** – 🦐 → 🐟 → … → 🐋 → 🐳 zusammenschieben (Pfeile/WASD/Wischen)
  - **📝 Klausur-Minesweeper** – 9×9, 10 Klausuren; Rechtsklick oder 🚩-Modus für Fahnen
  - **🦐 Wal-Snake** – Krill fressen, länger werden (Pfeile/WASD/Wischen)
  - **⌨️ Mitschreib-Simulator** – fallende Vorlesungswörter abtippen, 3 Leben
  - **🗿 Aura-Clicker** – Idle-Game mit Upgrades, läuft auch bei geschlossener Seite weiter
  - **❌ Tic-Tac-Toe vs. Dozent** – fast unschlagbar, außer er ist abgelenkt

  Rekorde werden im Browser gespeichert, gute Ergebnisse geben Aura. Alle 6–10 Minuten
  kommt eine Minigame-Challenge rein.

  **So kommst du zu den Spielen:** Kachel **„🎮 Minigames"** auf der Startseite oder Button
  **„🎮 Minigames"** unten rechts in `countdown.html`, `wal-party.html` und `zaehler.html`.
  Direkt-Link: Adresse mit `#minigames` am Ende, z. B. `http://localhost:8000/#minigames`.

- **🐋 Noch mehr Wale** (`wale.js`): dauerhaftes Wal-Aquarium hinter dem Timer (mit Fontänen
  und Babys, in den letzten 10 Minuten hektischer), ein Wal folgt der Maus, Klick ins Leere
  lässt einen Wal springen, Zähler „Wale gesichtet". Dazu Banner-Wal mit Botschaften,
  Blauwal-Sonnenfinsternis, Wal-Sprung über den Timer, Wal-Schule in V-Formation,
  Wal-Gesang, Wal gegen Krake, „Wal-o-clock" und jede Minute eine Fontäne aus dem Timer.

Ton ist standardmäßig aus. Zum Ausprobieren im Zeitraffer:
`countdown.html?demo=4030&speed=10` (Ende in 4030 s, 10-fache Geschwindigkeit).

## 📊 Zentrales Treffer-Log & Auswertung

Alle Versionen schreiben in **ein** gemeinsames, dauerhaftes Log im Browser
(`localStorage`, Key `anderstelle.log.v1`) – über das kleine gemeinsame Skript
`tracker.js`. Gespeichert werden nur Zeitpunkte und Metadaten, **keine Transkripte**:

- **Sessions** – wann das Programm lief/lauschte (Start, laufendes Ende per Heartbeat,
  Quelle `index`/`party`).
- **Treffer** – wann „an der Stelle" kam (Zeitpunkt, Quelle, Typ `auto`/`manual`,
  Rücknahmen `undo` für manuelles −1).

Die Auswertungsseite **`auswertung.html`** (`http://localhost:8000/auswertung.html`)
setzt beides in Relation:

- Kennzahlen: Gesamt-Laufzeit, Treffer gesamt (auto/manuell), **Treffer pro aktiver
  Minute**, längste Session.
- **Zeitstrahl**: Laufzeiten als blaue Balken, Treffer als orange Marker (gefüllt =
  automatisch, umrandet = manuell) – so sieht man direkt, wann während der Laufzeit
  wie dicht „an der Stelle" fiel.
- **Session-Tabelle**: jede Laufphase mit Dauer, Treffern und Treffer/Minute.
- Quelle filtern (alle/Standard/Party), **JSON-Export** zum Sichern, **Verlauf löschen**.

Hinweis: Der große Zähler bzw. der Reset-Button betrifft nur die Live-Anzeige –
das zentrale Log bleibt davon unberührt. Es wird ausschließlich über
„Verlauf löschen" in der Auswertung geleert. Dadurch binden `zaehler.html` und
`wal-party.html` zusätzlich `tracker.js` ein (weiterhin rein lokal, ohne
externe Abhängigkeiten).


