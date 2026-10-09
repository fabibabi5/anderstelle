# „an der Stelle"-Zähler

Eine kleine, lokale Web-App, die live mitzählt, wie oft dein Dozent **„an der Stelle"**
sagt. Läuft komplett über eine einzige `index.html` – keine Frameworks, keine
Dependencies, kein Build-Schritt.

## Starten

Im Projektordner einen simplen lokalen Server starten:

```bash
python3 -m http.server 8000
```

Dann in **Google Chrome** öffnen:

```
http://localhost:8000
```

Auf **Start** klicken und beim ersten Mal den Mikrofonzugriff erlauben.

> Die Spracherkennung nutzt die Web Speech API (`webkitSpeechRecognition`) und
> funktioniert zuverlässig **nur in Chrome** auf dem Desktop. In anderen Browsern
> erscheint ein Hinweis.

## Datenschutz-Hinweis

Chrome verarbeitet die Spracherkennung **nicht rein lokal**: Das aufgenommene
Audio wird zur Erkennung an **Google-Server** gesendet. Nutze die App also nur,
wenn das für deinen Kontext in Ordnung ist.

Der **Zählerstand** wird lokal im Browser (`localStorage`) gespeichert und bleibt
nach einem Reload erhalten. Die **Transkripte** (erkannte Sätze) werden bewusst
**nicht** dauerhaft gespeichert – sie leben nur im Arbeitsspeicher und sind nach
einem Reload weg.

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
`http://localhost:8000/wal-party.html`. Die schlichte `index.html` bleibt
unverändert erhalten.

Bei jedem erkannten „an der Stelle" gibt es volle Party: Konfetti, Emoji-Explosion,
ein großes Banner, Screen-Flash und einen Airhorn-Sound (per Web Audio, ohne Datei).
Im Hintergrund schwimmen Wale durch einen animierten Ozean. Zähler, Rekord,
manuelles ±1 und die Spracherkennung funktionieren wie in der Standard-Version
(der Zählerstand wird mit `index.html` geteilt).

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

In `index.html` und `wal-party.html` öffnet der Button **„🔍 Diagnose"** (unten links)
ein Panel, das zeigt, was die Spracherkennung tatsächlich versteht:

- jeder erkannte Satz inkl. Alternativen und Konfidenz – Treffer ✅ grün,
  **Beinahe-Treffer** 🤔 (z. B. „an dieser Stelle", „Schelle") gelb
- Start/Ende der Erkennung, Fehler (`network`, `no-speech` …) und **Hörlücken**
  (Zeit, in der nichts erkannt werden konnte)
- ein Mikrofon-Pegel (nur solange das Panel offen ist)
- **⬇ Export** als `.txt`, um das Log z. B. weiterzugeben

Das Log lebt nur im Arbeitsspeicher und wird nicht gespeichert.

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
„Verlauf löschen" in der Auswertung geleert. Dadurch binden `index.html` und
`wal-party.html` zusätzlich `tracker.js` ein (weiterhin rein lokal, ohne
externe Abhängigkeiten).


