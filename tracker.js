/*
 * Zentrales Treffer-Log für den „an der Stelle"-Zähler.
 * Wird von allen Versionen (index.html, wal-party.html) eingebunden und
 * schreibt in EINE gemeinsame localStorage-Quelle. Die Auswertungsseite
 * (auswertung.html) liest daraus.
 *
 * Datenmodell (localStorage-Key "anderstelle.log.v1"):
 *   {
 *     version: 1,
 *     sessions: [ { id, source, start, end } ],   // wann lief/lauschte das Programm
 *     events:   [ { t, type, source, sessionId } ] // wann kam "an der Stelle"
 *   }
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

  function uid() {
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  var Tracker = {
    KEY: KEY,

    // Startet eine Session (Nutzer hat auf Start gedrückt). Gibt die ID zurück.
    startSession: function (source) {
      var data = load();
      var now = Date.now();
      var s = { id: uid(), source: source || "", start: now, end: now };
      data.sessions.push(s);
      save(data);
      return s.id;
    },

    // Hält die Session „am Leben": setzt das Ende auf jetzt (Heartbeat + Stopp).
    touchSession: function (id) {
      if (!id) return;
      var data = load();
      for (var i = data.sessions.length - 1; i >= 0; i--) {
        if (data.sessions[i].id === id) { data.sessions[i].end = Date.now(); break; }
      }
      save(data);
    },

    endSession: function (id) { this.touchSession(id); },

    // Protokolliert n Treffer (gleicher Zeitpunkt). kind: "auto" | "manual".
    logHits: function (n, kind, source, sessionId) {
      if (!n || n <= 0) return;
      var data = load();
      var now = Date.now();
      for (var k = 0; k < n; k++) {
        data.events.push({ t: now, type: kind || "auto", source: source || "", sessionId: sessionId || null });
      }
      save(data);
    },

    // Protokolliert eine manuelle Rücknahme (-1).
    logUndo: function (n, source, sessionId) {
      if (!n || n <= 0) return;
      var data = load();
      var now = Date.now();
      for (var k = 0; k < n; k++) {
        data.events.push({ t: now, type: "undo", source: source || "", sessionId: sessionId || null });
      }
      save(data);
    },

    getData: function () { return load(); },

    clear: function () { save({ version: 1, sessions: [], events: [] }); }
  };

  global.AnderStelleTracker = Tracker;
})(window);
