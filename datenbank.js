/*
 * Verbindung zur lokalen SQLite-Datenbank (server/server.py, gestartet über ./start.sh).
 * Wird auf JEDER Seite als erstes Skript im <head> geladen.
 *
 * Idee: Die Seiten arbeiten weiter mit localStorage wie bisher – dieses Skript sorgt dafür,
 * dass alles zusätzlich dauerhaft in der Datenbank landet:
 *   1. Beim Laden (synchron, bevor andere Skripte laufen): Browser-Daten an den Server schicken
 *      (/api/import, zusammenführen) und den Gesamtstand zurück in den localStorage schreiben.
 *   2. Danach wird jedes localStorage.setItem/removeItem auf „anderstelle.*“-Schlüsseln
 *      automatisch an /api/kv weitergereicht (gebündelt).
 *   3. Treffer-Log (tracker.js) und Diagnose-Sitzungen (diagnose.js) haben eigene Tabellen
 *      und nutzen die Funktionen unten.
 *
 * Läuft die Seite ohne Server (file:// oder ein anderer Webserver), ist AnderStelleDB.active
 * false und alles funktioniert wie früher nur mit localStorage.
 */
(function (global) {
  "use strict";

  var LOG_KEY = "anderstelle.log.v1", DIAG_KEY = "anderstelle.diag.v1";
  var VORL_KEY = "anderstelle.vorlesung";
  var PENDING_KEY = "anderstelle_db_pending";            // ohne Punkt -> wird selbst nicht synchronisiert
  var NOT_SYNCED = {};                                    // eigene Tabellen bzw. gerätespezifisch
  NOT_SYNCED[LOG_KEY] = NOT_SYNCED[DIAG_KEY] = NOT_SYNCED["anderstelle.boost.device"] = true;
  var VORL_MAX_MS = 6 * 3600 * 1000;                      // eine Vorlesung gilt höchstens 6 h als „läuft“

  var proto = global.Storage && global.Storage.prototype;
  var origSet = proto && proto.setItem, origRemove = proto && proto.removeItem;
  var ls = null;
  try { ls = global.localStorage; } catch (e) {}

  var DB = { active: false, state: null, error: null, vorlesungen: [] };

  function synced(key) { return typeof key === "string" && key.indexOf("anderstelle.") === 0 && !NOT_SYNCED[key]; }

  function xhr(method, url, body, sync) {
    var r = new XMLHttpRequest();
    r.open(method, url, !sync);
    if (body !== undefined) r.setRequestHeader("Content-Type", "application/json");
    r.send(body === undefined ? null : JSON.stringify(body));
    return r;
  }
  function syncJson(method, url, body) {
    try {
      var r = xhr(method, url, body, true);
      if (r.status !== 200) return null;
      var o = JSON.parse(r.responseText);
      return o && o.ok ? o : null;
    } catch (e) { return null; }
  }
  function post(url, body, cb) {
    try {
      var r = xhr("POST", url, body, false);
      r.onload = function () { if (cb) cb(r.status === 200 ? JSON.parse(r.responseText) : null); };
      r.onerror = function () { DB.error = "Server nicht erreichbar"; if (cb) cb(null); };
    } catch (e) { if (cb) cb(null); }
  }
  function beacon(url, body) {
    var s = JSON.stringify(body);
    try { if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([s], { type: "application/json" }))) return true; } catch (e) {}
    try { fetch(url, { method: "POST", body: s, headers: { "Content-Type": "application/json" }, keepalive: true }); return true; } catch (e) {}
    return false;
  }

  function lsGet(k) { try { return ls.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { origSet.call(ls, k, v); } catch (e) {} }
  function lsDel(k) { try { origRemove.call(ls, k); } catch (e) {} }
  function jsonGet(k) { try { return JSON.parse(lsGet(k)); } catch (e) { return null; } }

  // ---------------------------------------------------------------- 1. Start: zusammenführen
  function boot() {
    if (!ls || !proto || !/^https?:$/.test(location.protocol)) return;

    // Änderungen, die beim letzten Mal nicht mehr rausgingen, zuerst (überschreibend) nachreichen
    var pend = jsonGet(PENDING_KEY);
    if (pend && typeof pend === "object") {
      var kv0 = {};
      Object.keys(pend).forEach(function (k) { kv0[k] = lsGet(k); });
      syncJson("POST", "/api/kv", kv0);
    }

    var kv = {};
    for (var i = 0; i < ls.length; i++) {
      var k = ls.key(i);
      if (synced(k)) kv[k] = lsGet(k);
    }
    var diag = jsonGet(DIAG_KEY);
    var st = syncJson("POST", "/api/import", { kv: kv, log: jsonGet(LOG_KEY) || {}, diag: diag && Array.isArray(diag.sessions) ? diag.sessions : [] });
    if (!st) return;                                       // kein Datenbank-Server -> nur localStorage

    DB.active = true;
    DB.state = st;
    DB.vorlesungen = st.vorlesungen || [];
    lsDel(PENDING_KEY);
    lsDel(DIAG_KEY);                                       // Diagnose-Sitzungen liegen jetzt in der Datenbank
    Object.keys(st.kv || {}).forEach(function (k) { if (lsGet(k) !== st.kv[k]) lsSet(k, st.kv[k]); });
    lsSet(LOG_KEY, JSON.stringify(st.log));

    // ---- 2. ab jetzt jede Änderung mitschreiben
    proto.setItem = function (k, v) {
      origSet.call(this, k, v);
      if (this === ls && synced(k)) queueKv(k, String(v));
    };
    proto.removeItem = function (k) {
      origRemove.call(this, k);
      if (this === ls && synced(k)) queueKv(k, null);
    };
  }

  // ---------------------------------------------------------------- 2. Schlüssel/Werte
  var kvQueue = {}, kvTimer = null;
  function queueKv(k, v) {
    kvQueue[k] = v;
    var p = jsonGet(PENDING_KEY) || {}; p[k] = 1; lsSet(PENDING_KEY, JSON.stringify(p));
    if (!kvTimer) kvTimer = setTimeout(flushKv, 400);
  }
  function flushKv(useBeacon) {
    clearTimeout(kvTimer); kvTimer = null;
    var keys = Object.keys(kvQueue);
    if (!keys.length) return;
    var body = kvQueue; kvQueue = {};
    var done = function (ok) {
      if (!ok) return;
      var p = jsonGet(PENDING_KEY) || {};
      keys.forEach(function (k) { if (!(k in kvQueue)) delete p[k]; });
      if (Object.keys(p).length) lsSet(PENDING_KEY, JSON.stringify(p)); else lsDel(PENDING_KEY);
    };
    if (useBeacon === true) done(beacon("/api/kv", body));
    else post("/api/kv", body, function (r) { done(r && r.ok); });
  }

  // ---------------------------------------------------------------- 3a. Treffer-Log
  var trSessions = {}, trEvents = [], trTimer = null;
  DB.tracker = function (sessions, events) {
    if (!DB.active) return;
    (sessions || []).forEach(function (s) { trSessions[s.id] = s; });
    trEvents = trEvents.concat(events || []);
    if (!trTimer) trTimer = setTimeout(flushTracker, 600);
  };
  function flushTracker(useBeacon) {
    clearTimeout(trTimer); trTimer = null;
    var ids = Object.keys(trSessions);
    if (!ids.length && !trEvents.length) return;
    var body = { sessions: ids.map(function (id) { return trSessions[id]; }), events: trEvents };
    trSessions = {}; trEvents = [];
    // Geht etwas verloren, ist es nicht schlimm: beim nächsten Laden wird der localStorage-Stand ohnehin importiert
    if (useBeacon === true) beacon("/api/tracker", body); else post("/api/tracker", body);
  }
  DB.trackerClear = function (cb) { if (DB.active) post("/api/tracker/clear", {}, cb); };

  // ---------------------------------------------------------------- 3b. Diagnose-Sitzungen
  var diagCache = null;
  DB.diagList = function () {
    if (!DB.active) return [];
    if (!diagCache) {
      var r = syncJson("GET", "/api/diagnose?limit=60");
      diagCache = r ? r.sessions : [];
      DB.diagTotal = r ? r.gesamt : 0;
    }
    return diagCache.slice();
  };
  DB.diagSave = function (s, useBeacon) {
    if (!DB.active || !s) return;
    if (diagCache) { diagCache = diagCache.filter(function (x) { return x.id !== s.id; }); diagCache.push(s); }
    if (useBeacon === true) return beacon("/api/diagnose", s);
    post("/api/diagnose", s);
  };
  DB.diagRemove = function (id) {
    if (!DB.active) return;
    if (diagCache) diagCache = diagCache.filter(function (x) { return x.id !== id; });
    try { xhr("DELETE", "/api/diagnose?id=" + encodeURIComponent(id), undefined, true); } catch (e) {}
  };
  DB.diagRemoveAll = function () {
    if (!DB.active) return;
    diagCache = [];
    try { xhr("DELETE", "/api/diagnose", undefined, true); } catch (e) {}
  };

  // ---------------------------------------------------------------- 3c. Vorlesungen
  // Aktuelle Vorlesung: { id, fach, dozent, seit } – Treffer und Sitzungen werden ihr zugeordnet.
  DB.vorlesung = function () {
    var v = jsonGet(VORL_KEY);
    if (!v || !v.id) return null;
    if (Date.now() - (v.seit || 0) > VORL_MAX_MS) return null;
    return v;
  };
  DB.setVorlesung = function (v) {
    if (v) localStorage.setItem(VORL_KEY, JSON.stringify({ id: v.id, fach: v.fach, dozent: v.dozent, seit: Date.now() }));
    else localStorage.removeItem(VORL_KEY);
  };
  DB.listVorlesungen = function (cb) {
    if (!DB.active) return cb([]);
    var r = new XMLHttpRequest();
    r.open("GET", "/api/vorlesungen");
    r.onload = function () { try { DB.vorlesungen = JSON.parse(r.responseText).vorlesungen || []; } catch (e) {} cb(DB.vorlesungen); };
    r.onerror = function () { cb(DB.vorlesungen); };
    r.send();
  };
  DB.createVorlesung = function (fach, dozent, cb) {
    post("/api/vorlesungen", { fach: fach, dozent: dozent }, function (r) {
      if (!r || !r.ok) return cb(null);
      DB.vorlesungen = r.vorlesungen || [];
      var v = DB.vorlesungen.filter(function (x) { return x.id === r.id; })[0];
      cb(v || null);
    });
  };
  DB.statistik = function (cb) {
    if (!DB.active) return cb(null);
    var r = new XMLHttpRequest();
    r.open("GET", "/api/statistik");
    r.onload = function () { try { cb(JSON.parse(r.responseText)); } catch (e) { cb(null); } };
    r.onerror = function () { cb(null); };
    r.send();
  };

  boot();

  global.addEventListener("pagehide", function () { flushKv(true); flushTracker(true); });
  global.AnderStelleDB = DB;
})(window);
