/*
 * Zentrales Treffer-Log für den „an der Stelle"-Zähler.
 * Wird von allen Versionen (zaehler.html, wal-party.html) eingebunden und
 * schreibt in EINE gemeinsame localStorage-Quelle. Die Auswertungsseite
 * (auswertung.html) liest daraus.
 *
 * Datenmodell (localStorage-Key "anderstelle.log.v1"):
 *   {
 *     version: 1,
 *     sessions: [ { id, source, start, end, vorlesung } ],   // wann lief/lauschte das Programm
 *     events:   [ { id, t, type, source, sessionId, det, conf, vorlesung } ] // wann kam "an der Stelle"
 *   }
 *   det:  "chrome" | "vosk" | "manuell" (wer hat erkannt), conf: Sicherheit (nur Vosk)
 *   vorlesung: ID der gerade laufenden Vorlesung (Startseite), falls gesetzt
 *
 * Läuft der Datenbank-Server (./start.sh), wird jede Änderung zusätzlich in SQLite
 * gespeichert (datenbank.js); localStorage ist dann nur die Arbeitskopie.
 *   type: "auto"   -> automatisch erkannt
 *         "manual" -> manuell per +1 ergänzt
 *         "undo"   -> manuelle Korrektur per -1 (zur Netto-Verrechnung)
 *   Zeiten sind Millisekunden seit Epoch (Date.now()).
 *
 * Keine Transkripte werden gespeichert – nur Zeitpunkte und Metadaten.
 */
(function (global) {
  "use strict";

  var KEY = "anderstelle.log.v1";

  function load() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY));
      if (o && Array.isArray(o.sessions) && Array.isArray(o.events)) return o;
    } catch (e) { /* korrupt -> frisch */ }
    return { version: 1, sessions: [], events: [] };
  }

  function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* Speicher voll o.ä. */ }
  }

  var DB = function () { return global.AnderStelleDB && global.AnderStelleDB.active ? global.AnderStelleDB : null; };
  function vorlesungId() { var v = global.AnderStelleDB && global.AnderStelleDB.vorlesung(); return v ? v.id : null; }

  function uid() {
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function add(n, type, source, sessionId, extra) {
    if (!n || n <= 0) return;
    var data = load(), now = Date.now(), v = vorlesungId(), neu = [];
    for (var k = 0; k < n; k++) {
      var e = { id: uid(), t: now, type: type, source: source || "", sessionId: sessionId || null,
                det: (extra && extra.det) || (type === "auto" ? "chrome" : "manuell") };
      if (extra && extra.conf != null) e.conf = Math.round(extra.conf * 1000) / 1000;
      if (v) e.vorlesung = v;
      data.events.push(e);
      neu.push(e);
    }
    save(data);
    if (DB()) DB().tracker([], neu);
  }

  var Tracker = {
    KEY: KEY,

    // Startet eine Session (Nutzer hat auf Start gedrückt). Gibt die ID zurück.
    startSession: function (source) {
      var data = load();
      var now = Date.now();
      var s = { id: uid(), source: source || "", start: now, end: now };
      var v = vorlesungId(); if (v) s.vorlesung = v;
      data.sessions.push(s);
      save(data);
      if (DB()) DB().tracker([s], []);
      return s.id;
    },

    // Hält die Session „am Leben": setzt das Ende auf jetzt (Heartbeat + Stopp).
    touchSession: function (id) {
      if (!id) return;
      var data = load();
      for (var i = data.sessions.length - 1; i >= 0; i--) {
        if (data.sessions[i].id === id) {
          data.sessions[i].end = Date.now();
          if (DB()) DB().tracker([data.sessions[i]], []);
          break;
        }
      }
      save(data);
    },

    endSession: function (id) { this.touchSession(id); },

    // Protokolliert n Treffer (gleicher Zeitpunkt). kind: "auto" | "manual".
    // extra (optional): { det: "chrome"|"vosk", conf: 0.93 }
    logHits: function (n, kind, source, sessionId, extra) {
      add(n, kind || "auto", source, sessionId, extra);
    },

    // Protokolliert eine manuelle Rücknahme (-1).
    logUndo: function (n, source, sessionId) {
      add(n, "undo", source, sessionId, null);
    },

    getData: function () { return load(); },

    clear: function () {
      save({ version: 1, sessions: [], events: [] });
      if (DB()) DB().trackerClear();
    }
  };

  global.AnderStelleTracker = Tracker;
})(window);
