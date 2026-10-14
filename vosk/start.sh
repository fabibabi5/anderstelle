#!/usr/bin/env bash
# Startet den lokalen Vosk-Server für die Diagnose-Seite.
#   ./vosk/start.sh                 kleines deutsches Modell (~45 MB)
#   ./vosk/start.sh --model gross   großes Modell (~1,9 GB, genauer)
# Beim ersten Start wird eine eigene Python-Umgebung in vosk/.venv angelegt.
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 fehlt. Auf dem Mac: im Terminal 'xcode-select --install' ausführen und erneut starten." >&2
  exit 1
fi

if [ ! -x .venv/bin/python ]; then
  echo "Erster Start: lege Python-Umgebung an und installiere Vosk …"
  python3 -m venv .venv
  .venv/bin/pip install --quiet --upgrade pip setuptools wheel
  .venv/bin/pip install --quiet vosk websockets
fi

exec .venv/bin/python vosk-server.py "$@"
