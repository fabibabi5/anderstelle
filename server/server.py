#!/usr/bin/env python3
"""
Lokaler Server für den „an der Stelle“-Zähler: liefert die Webseiten aus und speichert
alle Daten in einer SQLite-Datenbank (daten/anderstelle.db). Nur Python-Standardbibliothek.

Start (empfohlen über ./start.sh im Projektordner):
    python3 server/server.py [--port 8000] [--db daten/anderstelle.db]

Läuft nur auf 127.0.0.1 – von außen nicht erreichbar. Beim Start wird einmal pro Tag
eine Sicherungskopie in daten/backup/ angelegt (die letzten 14 bleiben).

Tabellen
  kv           Einstellungen & Zustände der Seiten (Zählerstand, Minigames, Countdown …)
  vorlesungen  Fach, Dozent, Notiz
  sitzungen    wann eine Zähl-Seite lief (Start/Ende, Quelle, Vorlesung)
  treffer      jedes „an der Stelle“: Zeit, Typ (auto/manual/undo), Detektor (chrome/vosk/manuell),
               Sicherheit, Sitzung, Vorlesung
  diagnose     Diagnose-Sitzungen (komplettes JSON inkl. Transkript und Pegel)

API (JSON)
  GET  /api/state                 alles, was die Seiten beim Laden brauchen
  POST /api/kv                    {schlüssel: wert | null}
  POST /api/import                {kv, log, diag}  – Daten aus dem Browser übernehmen (zusammenführen)
  POST /api/tracker               {sessions, events}  – Sitzungen/Treffer anlegen oder aktualisieren
  POST /api/tracker/clear         Verlauf (Sitzungen + Treffer) löschen
  GET  /api/diagnose[?limit=N]    Diagnose-Sitzungen (neueste zuerst)
  POST /api/diagnose              eine Diagnose-Sitzung speichern
  DELETE /api/diagnose[?id=X]     eine (oder alle) Diagnose-Sitzungen löschen
  GET/POST /api/vorlesungen       Liste / neue Vorlesung {fach, dozent, notiz}
  GET  /api/statistik             Auswertung pro Vorlesung und pro Dozent
  GET  /api/backup                komplette Datenbank als JSON herunterladen
"""
import argparse
import datetime
import json
import os
import shutil
import sqlite3
import sys
import time
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(ROOT, "daten", "anderstelle.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY, value TEXT, upd INTEGER
);
CREATE TABLE IF NOT EXISTS vorlesungen (
  id TEXT PRIMARY KEY, fach TEXT, dozent TEXT, notiz TEXT, erstellt INTEGER
);
CREATE TABLE IF NOT EXISTS sitzungen (
  id TEXT PRIMARY KEY, quelle TEXT, start INTEGER, ende INTEGER, vorlesung TEXT
);
CREATE TABLE IF NOT EXISTS treffer (
  id TEXT PRIMARY KEY, t INTEGER, typ TEXT, quelle TEXT, sitzung TEXT,
  detektor TEXT, sicherheit REAL, vorlesung TEXT
);
CREATE INDEX IF NOT EXISTS treffer_t ON treffer(t);
CREATE INDEX IF NOT EXISTS treffer_vorlesung ON treffer(vorlesung);
CREATE TABLE IF NOT EXISTS diagnose (
  id TEXT PRIMARY KEY, seite TEXT, start INTEGER, ende INTEGER, upd INTEGER, daten TEXT
);
"""


def connect():
    con = sqlite3.connect(DB_PATH, timeout=15)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA foreign_keys=ON")
    return con


def now_ms():
    return int(time.time() * 1000)


def event_id(e, occurrence=0):
    """Stabile ID für einen Treffer. Neue Treffer bringen ihre ID mit; alte (ohne ID) bekommen
    eine aus Zeit/Typ/Quelle/Sitzung + laufender Nummer – der Browser rechnet genauso."""
    if e.get("id"):
        return str(e["id"])
    return "%s-%s-%s-%s-%d" % (e.get("t"), e.get("type"), e.get("source") or "", e.get("sessionId") or "", occurrence)


# ---------------------------------------------------------------- Datenzugriff
def db_label():
    rel = os.path.relpath(DB_PATH, ROOT)
    return DB_PATH if rel.startswith("..") else rel


def read_state(con):
    kv = {r["key"]: r["value"] for r in con.execute("SELECT key, value FROM kv")}
    sessions = [{"id": r["id"], "source": r["quelle"], "start": r["start"], "end": r["ende"], "vorlesung": r["vorlesung"]}
                for r in con.execute("SELECT * FROM sitzungen ORDER BY start")]
    events = []
    for r in con.execute("SELECT * FROM treffer ORDER BY t, id"):
        e = {"id": r["id"], "t": r["t"], "type": r["typ"], "source": r["quelle"], "sessionId": r["sitzung"]}
        if r["detektor"]:
            e["det"] = r["detektor"]
        if r["sicherheit"] is not None:
            e["conf"] = r["sicherheit"]
        if r["vorlesung"]:
            e["vorlesung"] = r["vorlesung"]
        events.append(e)
    leer = not kv and not sessions and not events and not con.execute("SELECT 1 FROM diagnose LIMIT 1").fetchone()
    return {"ok": True, "kv": kv, "log": {"version": 1, "sessions": sessions, "events": events},
            "vorlesungen": list_vorlesungen(con), "leer": leer, "db": db_label()}


def write_kv(con, data, only_new=False):
    t = now_ms()
    for k, v in (data or {}).items():
        if not isinstance(k, str) or not k.startswith("anderstelle."):
            continue
        if v is None:
            con.execute("DELETE FROM kv WHERE key=?", (k,))
        elif only_new:
            con.execute("INSERT OR IGNORE INTO kv(key, value, upd) VALUES(?,?,?)", (k, str(v), t))
        else:
            con.execute("INSERT INTO kv(key, value, upd) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, upd=excluded.upd",
                        (k, str(v), t))


def write_tracker(con, sessions, events):
    for s in sessions or []:
        if not s.get("id"):
            continue
        con.execute("""INSERT INTO sitzungen(id, quelle, start, ende, vorlesung) VALUES(?,?,?,?,?)
                       ON CONFLICT(id) DO UPDATE SET ende=MAX(COALESCE(sitzungen.ende,0), COALESCE(excluded.ende,0)),
                                                    vorlesung=COALESCE(sitzungen.vorlesung, excluded.vorlesung)""",
                    (s["id"], s.get("source"), s.get("start"), s.get("end"), s.get("vorlesung")))
    seen = {}
    for e in events or []:
        base = (e.get("t"), e.get("type"), e.get("source"), e.get("sessionId"))
        occ = seen.get(base, 0)
        seen[base] = occ + 1
        con.execute("""INSERT OR IGNORE INTO treffer(id, t, typ, quelle, sitzung, detektor, sicherheit, vorlesung)
                       VALUES(?,?,?,?,?,?,?,?)""",
                    (event_id(e, occ), e.get("t"), e.get("type"), e.get("source"), e.get("sessionId"),
                     e.get("det"), e.get("conf"), e.get("vorlesung")))


def write_diag(con, s):
    if not isinstance(s, dict) or not s.get("id"):
        return
    row = con.execute("SELECT upd FROM diagnose WHERE id=?", (s["id"],)).fetchone()
    if row and (row["upd"] or 0) > (s.get("upd") or 0):
        return  # neuere Fassung schon gespeichert
    con.execute("""INSERT INTO diagnose(id, seite, start, ende, upd, daten) VALUES(?,?,?,?,?,?)
                   ON CONFLICT(id) DO UPDATE SET seite=excluded.seite, start=excluded.start, ende=excluded.ende,
                                                upd=excluded.upd, daten=excluded.daten""",
                (s["id"], s.get("page"), s.get("start"), s.get("end"), s.get("upd") or now_ms(), json.dumps(s, ensure_ascii=False)))


def list_vorlesungen(con):
    return [dict(r) for r in con.execute("SELECT * FROM vorlesungen ORDER BY erstellt DESC")]


def statistik(con):
    rows = []
    for v in list_vorlesungen(con):
        sess = con.execute("SELECT COUNT(*) n, SUM(MAX(0, COALESCE(ende,start) - start)) dauer FROM sitzungen WHERE vorlesung=?", (v["id"],)).fetchone()
        tr = con.execute("""SELECT SUM(typ='auto') auto, SUM(typ='manual') manuell, SUM(typ='undo') undo,
                                   SUM(typ='auto' AND detektor='vosk') vosk, SUM(typ='auto' AND COALESCE(detektor,'chrome')='chrome') chrome,
                                   MIN(t) erster, MAX(t) letzter
                            FROM treffer WHERE vorlesung=?""", (v["id"],)).fetchone()
        netto = (tr["auto"] or 0) + (tr["manuell"] or 0) - (tr["undo"] or 0)
        dauer = sess["dauer"] or 0
        rows.append(dict(v, sitzungen=sess["n"] or 0, dauer=dauer, treffer=netto, auto=tr["auto"] or 0,
                         manuell=tr["manuell"] or 0, undo=tr["undo"] or 0, vosk=tr["vosk"] or 0, chrome=tr["chrome"] or 0,
                         pro_min=round(netto / (dauer / 60000), 2) if dauer >= 60000 else None))
    dozenten = {}
    for r in rows:
        d = dozenten.setdefault(r["dozent"] or "(unbekannt)", {"dozent": r["dozent"] or "(unbekannt)", "vorlesungen": 0, "treffer": 0, "dauer": 0, "rekord": 0})
        d["vorlesungen"] += 1
        d["treffer"] += r["treffer"]
        d["dauer"] += r["dauer"]
        d["rekord"] = max(d["rekord"], r["treffer"])
    for d in dozenten.values():
        d["schnitt"] = round(d["treffer"] / d["vorlesungen"], 1) if d["vorlesungen"] else 0
        d["pro_min"] = round(d["treffer"] / (d["dauer"] / 60000), 2) if d["dauer"] >= 60000 else None
    ohne = con.execute("SELECT SUM(typ='auto') + SUM(typ='manual') - SUM(typ='undo') FROM treffer WHERE vorlesung IS NULL").fetchone()[0] or 0
    return {"ok": True, "vorlesungen": rows, "dozenten": sorted(dozenten.values(), key=lambda d: -d["schnitt"]), "ohne_vorlesung": ohne}


def backup_json(con):
    st = read_state(con)
    st["diagnose"] = [json.loads(r["daten"]) for r in con.execute("SELECT daten FROM diagnose ORDER BY start")]
    st["exportiert"] = datetime.datetime.now().isoformat(timespec="seconds")
    return st


def daily_backup():
    """Einmal pro Tag eine Kopie der Datenbank (SQLite-Backup-API, auch bei laufendem Betrieb sicher)."""
    if not os.path.exists(DB_PATH):
        return
    folder = os.path.join(os.path.dirname(DB_PATH), "backup")
    os.makedirs(folder, exist_ok=True)
    target = os.path.join(folder, "anderstelle-%s.db" % datetime.date.today().isoformat())
    if os.path.exists(target):
        return
    src = connect()
    dst = sqlite3.connect(target)
    with dst:
        src.backup(dst)
    dst.close()
    src.close()
    old = sorted(f for f in os.listdir(folder) if f.startswith("anderstelle-") and f.endswith(".db"))
    for f in old[:-14]:
        os.remove(os.path.join(folder, f))


# ---------------------------------------------------------------- HTTP
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, fmt, *args):  # nur Fehler ausgeben, sonst wird das Terminal voll
        # (404 auf Seiten ist normal: die Wal-Party fragt optionale eigene Bilder wie wal1.gif ab)
        code = str(args[1]) if len(args) > 1 else ""
        if code.startswith("5") or (code.startswith("4") and self.path.startswith("/api/")):
            sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")   # Änderungen an den Seiten sofort sichtbar
        super().end_headers()

    # ---- Hilfen
    def send_json(self, obj, status=200, download=None):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        if download:
            self.send_header("Content-Disposition", 'attachment; filename="%s"' % download)
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n) if n else b""
        return json.loads(raw.decode("utf-8")) if raw else None

    def blocked(self, path):
        p = path.lower().rstrip("/") + "/"
        return p.startswith(("/daten/", "/server/", "/.git/")) or "/.venv/" in p or "/__pycache__/" in p

    # ---- Methoden
    def do_GET(self):
        url = urlparse(self.path)
        if url.path.startswith("/api/"):
            return self.api("GET", url)
        if self.blocked(url.path):
            return self.send_error(404)
        return super().do_GET()

    def do_HEAD(self):
        if self.blocked(urlparse(self.path).path):
            return self.send_error(404)
        return super().do_HEAD()

    def do_POST(self):
        url = urlparse(self.path)
        if url.path.startswith("/api/"):
            return self.api("POST", url)
        self.send_error(405)

    def do_DELETE(self):
        url = urlparse(self.path)
        if url.path.startswith("/api/"):
            return self.api("DELETE", url)
        self.send_error(405)

    def api(self, method, url):
        q = parse_qs(url.query)
        try:
            body = self.read_json() if method == "POST" else None
        except ValueError:
            return self.send_json({"ok": False, "fehler": "ungültiges JSON"}, 400)
        con = connect()
        try:
            with con:
                res = self.route(con, method, url.path, q, body)
            if res is None:
                return self.send_json({"ok": False, "fehler": "unbekannt: %s %s" % (method, url.path)}, 404)
            if isinstance(res, tuple):
                return self.send_json(res[0], download=res[1])
            return self.send_json(res)
        except Exception as e:  # pragma: no cover
            sys.stderr.write("API-Fehler %s %s: %r\n" % (method, url.path, e))
            return self.send_json({"ok": False, "fehler": str(e)}, 500)
        finally:
            con.close()

    def route(self, con, method, path, q, body):
        if path == "/api/state" and method == "GET":
            return read_state(con)
        if path == "/api/kv" and method == "POST":
            write_kv(con, body)
            return {"ok": True}
        if path == "/api/import" and method == "POST":
            body = body or {}
            write_kv(con, body.get("kv"), only_new=True)       # vorhandene Server-Werte nicht überschreiben
            log = body.get("log") or {}
            write_tracker(con, log.get("sessions"), log.get("events"))
            for s in body.get("diag") or []:
                write_diag(con, s)
            return read_state(con)
        if path == "/api/tracker" and method == "POST":
            write_tracker(con, (body or {}).get("sessions"), (body or {}).get("events"))
            return {"ok": True}
        if path == "/api/tracker/clear" and method == "POST":
            con.execute("DELETE FROM treffer")
            con.execute("DELETE FROM sitzungen")
            return {"ok": True}
        if path == "/api/diagnose":
            if method == "GET":
                limit = int((q.get("limit") or ["40"])[0])
                rows = con.execute("SELECT daten FROM diagnose ORDER BY start DESC LIMIT ?", (limit,))
                return {"ok": True, "sessions": [json.loads(r["daten"]) for r in rows],
                        "gesamt": con.execute("SELECT COUNT(*) FROM diagnose").fetchone()[0]}
            if method == "POST":
                write_diag(con, body)
                return {"ok": True}
            if method == "DELETE":
                if q.get("id"):
                    con.execute("DELETE FROM diagnose WHERE id=?", (q["id"][0],))
                else:
                    con.execute("DELETE FROM diagnose")
                return {"ok": True}
        if path == "/api/vorlesungen":
            if method == "GET":
                return {"ok": True, "vorlesungen": list_vorlesungen(con)}
            if method == "POST":
                b = body or {}
                vid = uuid.uuid4().hex[:12]
                con.execute("INSERT INTO vorlesungen(id, fach, dozent, notiz, erstellt) VALUES(?,?,?,?,?)",
                            (vid, (b.get("fach") or "").strip()[:120], (b.get("dozent") or "").strip()[:120], (b.get("notiz") or "").strip()[:500], now_ms()))
                return {"ok": True, "id": vid, "vorlesungen": list_vorlesungen(con)}
        if path == "/api/statistik" and method == "GET":
            return statistik(con)
        if path == "/api/backup" and method == "GET":
            return backup_json(con), "anderstelle-backup-%s.json" % datetime.date.today().isoformat()
        return None


def main():
    global DB_PATH
    ap = argparse.ArgumentParser(description="Webseiten + SQLite-Datenbank für den „an der Stelle“-Zähler")
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--db", default=DB_PATH, help="Pfad zur Datenbankdatei (Standard: daten/anderstelle.db)")
    args = ap.parse_args()
    DB_PATH = os.path.abspath(args.db)
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    con = connect()
    con.executescript(SCHEMA)
    con.close()
    try:
        daily_backup()
    except Exception as e:  # Sicherung darf den Start nie verhindern
        sys.stderr.write("Sicherung übersprungen: %r\n" % e)
    try:
        httpd = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    except OSError as e:
        sys.exit("Port %d ist schon belegt (%s). Läuft der Server schon? Sonst mit --port 8001 starten." % (args.port, e.strerror))
    print("Datenbank: %s" % db_label(), flush=True)
    print("Webseiten: http://localhost:%d  (Beenden: Strg+C)" % args.port, flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
