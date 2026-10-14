#!/usr/bin/env bash
# Startet alles für den „an der Stelle“-Zähler mit einem Befehl:
#   - Webseiten + SQLite-Datenbank (server/server.py, http://localhost:8000, Daten in daten/anderstelle.db)
#   - Vosk-Server (vosk/start.sh, ws://127.0.0.1:2700) im Hintergrund – optional, aber empfohlen
#
#   ./start.sh                     alles starten (kleines Vosk-Modell)
#   ./start.sh --model gross       mit großem Vosk-Modell
#   ./start.sh --no-vosk           nur Webseiten + Datenbank
#   ./start.sh --port 8001         anderer Port für die Webseiten
#   ./start.sh --no-browser        Chrome nicht automatisch öffnen
# Beenden mit Strg+C – das stoppt beide Server.
set -euo pipefail
cd "$(dirname "$0")"

PORT=8000; VOSK=1; BROWSER=1; VOSK_ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="$2"; shift 2 ;;
    --no-vosk) VOSK=0; shift ;;
    --no-browser) BROWSER=0; shift ;;
    --model) VOSK_ARGS+=(--model "$2"); shift 2 ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    *) echo "Unbekannte Option: $1 (siehe ./start.sh --help)" >&2; exit 1 ;;
  esac
done

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 fehlt. Auf dem Mac: im Terminal 'xcode-select --install' ausführen und erneut starten." >&2
  exit 1
fi

VOSK_PID=""
cleanup() {
  [ -n "$VOSK_PID" ] && kill "$VOSK_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

if [ "$VOSK" = 1 ]; then
  mkdir -p daten
  echo "🧩 Starte Vosk im Hintergrund – Ausgaben in daten/vosk.log (bei Problemen dort nachsehen) …"
  ./vosk/start.sh ${VOSK_ARGS[@]+"${VOSK_ARGS[@]}"} >daten/vosk.log 2>&1 &
  VOSK_PID=$!
fi

if [ "$BROWSER" = 1 ] && command -v open >/dev/null 2>&1; then
  ( sleep 1.5; open -a "Google Chrome" "http://localhost:$PORT" 2>/dev/null || open "http://localhost:$PORT" ) &
fi

echo "🐳 Webseiten + Datenbank auf http://localhost:$PORT"
python3 server/server.py --port "$PORT"
