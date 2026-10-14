/*
 * Diagnose für die Spracherkennung – Datenkern + kleines Panel.
 *
 * Benutzt von index.html und wal-party.html (mit Panel unten links) sowie von
 * diagnose.html (große Diagnose-Seite, ohne Panel).
 *
 * Aufgezeichnet wird pro Sitzung:
 *   - alles, was Google erkannt hat (Abschnitte inkl. Alternativen, Live-Treffer,
 *     gerettete Treffer, Beinahe-Treffer)
 *   - Starts/Enden/Neustarts der Erkennung, Fehler, Hörlücken
 *   - Mikrofon-Pegel jede Sekunde (für den Pegel-Verlauf)
 *   - manuelle Markierungen: „verpasst“, „falsch erkannt“, „doppelt gezählt“ – jeweils
 *     mit dem Transkript der letzten 30 s und dem Pegel in dem Moment
 *
 * Speicherung: Ist „aufzeichnen“ an (Standard), landen die Sitzungen lokal im Browser
 * (localStorage "anderstelle.diag.v1", max. 8 Sitzungen), damit diagnose.html sie
 * auswerten kann. Nichts verlässt den Rechner; abschaltbar im Panel bzw. auf der Seite.
 */
(function (global) {
  "use strict";

  var STORE = "anderstelle.diag.v1";
  var RECORD_KEY = "anderstelle.diag.record";
  var MAX_SESSIONS = 8, MAX_ENTRIES = 3000, MAX_LEVELS = 4 * 3600;
  // Wörter, die auf eine verpasste Phrase hindeuten können
  var NEAR_RE = /st[eä]l|schell|stähl|an dieser|andere[nr]? st|an de[rnm] |stehle/i;
  var FLAG_INFO = {
    missed: { icon: "😶", label: "Verpasst", desc: "„an der Stelle“ wurde gesagt, aber nicht gezählt", delta: +1 },
    false:  { icon: "🚫", label: "Falsch erkannt", desc: "gezählt, obwohl es nicht gesagt wurde", delta: -1 },
    double: { icon: "✌️", label: "Doppelt gezählt", desc: "einmal gesagt, zweimal gezählt", delta: -1 }
  };

  var opts = {}, matchRe = null, session = null, subs = [], dirty = false;
  var recordOn = true;
  try { recordOn = localStorage.getItem(RECORD_KEY) !== "0"; } catch (e) {}
  var lastEndAt = null, lastStartAt = null, running = false;
  var transcript = [], interimNow = "";   // für den Kontext von Markierungen

  // ---------------- Helfer ----------------
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function clock(t) { var d = new Date(t); return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()); }
  function secs(ms) { return (ms / 1000).toFixed(1).replace(".", ",") + " s"; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function countMatches(text) { if (!matchRe || !text) return 0; matchRe.lastIndex = 0; var m = text.match(matchRe); return m ? m.length : 0; }
  function highlight(text) {
    var safe = esc(text);
    if (!matchRe) return safe;
    matchRe.lastIndex = 0;
    return safe.replace(matchRe, function (m) { return "<mark>" + m + "</mark>"; });
  }

  // ---------------- Sitzungen & Speicher ----------------
  function loadStore() {
    try { var o = JSON.parse(localStorage.getItem(STORE)); if (o && Array.isArray(o.sessions)) return o; } catch (e) {}
    return { sessions: [] };
  }
  function newSession() {
    session = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                page: opts.page || location.pathname.split("/").pop() || "?",
                start: Date.now(), end: null, upd: Date.now(), ua: navigator.userAgent, cnt: 0, e: [], lv: [] };
    lastEndAt = null; transcript = [];
    if (running) lastStartAt = Date.now();
    notify(null);
  }
  function persist(force) {
    if (!recordOn || !session || (!dirty && !force)) return;
    if (!session.e.length && !session.lv.length) return;
    dirty = false;
    session.upd = Date.now();
    var st = loadStore();
    st.sessions = st.sessions.filter(function (s) { return s.id !== session.id; });
    st.sessions.push(session);
    st.sessions.sort(function (a, b) { return a.start - b.start; });
    while (st.sessions.length > MAX_SESSIONS) st.sessions.shift();
    for (var tries = 0; tries < 6; tries++) {
      try { localStorage.setItem(STORE, JSON.stringify(st)); return; }
      catch (e) {   // Speicher voll: älteste Sitzung opfern, notfalls die eigene kürzen
        if (st.sessions.length > 1) st.sessions.shift();
        else { session.lv = session.lv.slice(-1800); session.e = session.e.slice(-1500); }
      }
    }
  }
  setInterval(function () { persist(false); }, 3000);
  global.addEventListener("pagehide", function () { if (session) { session.end = session.end || Date.now(); dirty = true; persist(true); } });

  function push(entry) {
    if (!session) newSession();
    entry.t = entry.t || Date.now();
    session.e.push(entry);
    if (session.e.length > MAX_ENTRIES) session.e.shift();
    dirty = true;
    notify(entry);
  }
  var reportedErrors = {};
  function jsError(err, where) {
    var msg = (err && (err.message || err)) + "";
    var at = err && err.stack ? (err.stack.split("\n")[1] || "").trim().replace(/^at\s+/, "").replace(/\(?(?:file|https?):\/\/[^)]*\/([^/)]+)\)?/, "$1") : "";
    var key = where + msg + at;
    if (reportedErrors[key]) return;   // gleichen Fehler nur einmal melden
    reportedErrors[key] = 1;
    if (global.console) console.error("[Diagnose] " + where + ":", err);
    push({ k: "error", x: "JS-Fehler (" + where + "): " + msg + (at ? " @ " + at : "") });
  }
  function notify(entry) { subs.forEach(function (fn) { try { fn(entry, session); } catch (e) { jsError(e, "Anzeige"); } }); }
  // Alle unbehandelten Fehler der Seite ins Protokoll – hilft bei „friert ein“-Problemen
  global.addEventListener("error", function (ev) { jsError(ev.error || ev.message, "Seite"); });
  global.addEventListener("unhandledrejection", function (ev) { jsError(ev.reason, "Promise"); });

  // ---------------- Statistik ----------------
  function computeStats(s) {
    var st = { finals: 0, finalHits: 0, live: 0, kept: 0, near: 0, missed: 0, "false": 0, double: 0,
               starts: 0, gapMs: 0, maxGapMs: 0, errors: {}, errCount: 0, silence: 0, runs: [], counted: s.cnt || 0 };
    s.e.forEach(function (e) {
      if (e.k === "final") { st.finals++; st.finalHits += e.n || 0; if (!e.n && e.near) st.near++; }
      else if (e.k === "live") st.live += e.n || 0;
      else if (e.k === "kept") st.kept += e.n || 0;
      else if (e.k === "flag") st[e.f] = (st[e.f] || 0) + 1;
      else if (e.k === "start") { st.starts++; if (e.g) { st.gapMs += e.g; st.maxGapMs = Math.max(st.maxGapMs, e.g); } }
      else if (e.k === "end" && e.dur) st.runs.push(e.dur);
      else if (e.k === "error") {
        st.errors[e.x] = (st.errors[e.x] || 0) + 1;
        if (e.x === "no-speech") st.silence++;
        else if (e.x !== "aborted" && e.x !== "phrases-not-supported") st.errCount++;
      }
    });
    var endT = s.end || (s === session ? Date.now() : s.upd);
    st.runMs = Math.max(1, endT - s.start);
    if (s === session && lastEndAt) st.gapMs += Date.now() - lastEndAt;
    st.gapPct = st.gapMs / st.runMs * 100;
    st.avgRun = st.runs.length ? st.runs.reduce(function (a, b) { return a + b; }, 0) / st.runs.length : 0;
    // geschätzte Qualität: echte Treffer = gezählt − falsch − doppelt
    var auto = st.counted, wrong = st["false"] + st.double, right = Math.max(0, auto - wrong);
    st.recall = right + st.missed ? right / (right + st.missed) : null;   // Anteil der gesagten, die erwischt wurden
    st.precision = auto ? right / auto : null;                            // Anteil der Zählungen, die stimmten
    // Pegel gesamt und rund um Treffer / verpasste Stellen
    function avgAround(times) {
      var vals = [];
      times.forEach(function (t) { s.lv.forEach(function (l) { if (Math.abs(l[0] - t) <= 3000) vals.push(l[1]); }); });
      return vals.length ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length : null;
    }
    st.avgDb = s.lv.length ? s.lv.reduce(function (a, l) { return a + l[1]; }, 0) / s.lv.length : null;
    st.dbAtHits = avgAround(s.e.filter(function (e) { return e.k === "live" || (e.k === "final" && e.n); }).map(function (e) { return e.t; }));
    st.dbAtMissed = avgAround(s.e.filter(function (e) { return e.k === "flag" && e.f === "missed"; }).map(function (e) { return e.t; }));
    return st;
  }

  // ---------------- Darstellung eines Eintrags (Panel + Seite) ----------------
  function renderEntry(e) {
    var h, cls = "sys", p;
    switch (e.k) {
      case "start":
        h = e.g ? "▶ Erkennung läuft wieder (Lücke " + secs(e.g) + ")" : "▶ Erkennung gestartet";
        cls = e.g > 2000 ? "warn" : "sys"; p = h; break;
      case "end":
        h = "■ Erkennung beendet nach " + secs(e.dur || 0) + (e.u ? " (gestoppt)" : " – Chrome hat beendet, Neustart …");
        cls = e.u ? "sys" : "warn"; p = h; break;
      case "error":
        var hint = { "no-speech": "gerade keine Sprache gehört (zu leise/zu weit weg?)", "network": "Audio kommt nicht bei Google an",
                     "audio-capture": "kein Mikrofon", "not-allowed": "Mikrofon verweigert", "aborted": "abgebrochen",
                     "phrases-not-supported": "Phrasen-Boost nicht verfügbar" }[e.x] || "";
        h = "⚠ Fehler: " + esc(e.x) + (hint ? " – " + hint : "");
        cls = /^(no-speech|aborted|phrases-not-supported)$/.test(e.x) ? "sys" : "err"; p = "⚠ Fehler: " + e.x + (hint ? " – " + hint : ""); break;
      case "note": h = esc(e.x); p = e.x; break;
      case "live":
        h = "⚡ Live gezählt (+" + e.n + "): " + highlight(e.x); cls = "live"; p = "[LIVE +" + e.n + "] " + e.x; break;
      case "kept":
        h = "🛟 Gerettet (+" + e.n + "): live gezählt, danach von Google gestrichen – bleibt gezählt" +
            "<br><span class=\"alt\">live: </span>" + highlight(e.x) + "<br><span class=\"alt\">später: </span>" + esc(e.y || "(leer)");
        cls = "kept"; p = "[GERETTET +" + e.n + "] live: " + e.x + "\n    später: " + (e.y || "(leer)"); break;
      case "final":
        var alts = e.a || [];
        h = alts.map(function (a, i) {
          return (i ? "<span class=\"alt\">alt " + i + ": </span>" : "") + highlight(a[0] || "(leer)") + (a[1] ? " <small>(" + Math.round(a[1] * 100) + "%)</small>" : "");
        }).join("<br>");
        p = alts.map(function (a, i) { return (i ? "    alt " + i + ": " : "") + a[0] + (a[1] ? " (" + Math.round(a[1] * 100) + "%)" : ""); }).join("\n");
        cls = "final";
        if (e.n) { cls = "hit"; h = "✅ " + h; p = "[TREFFER x" + e.n + "] " + p; }
        else if (e.near) { cls = "near"; h = "🤔 Beinahe? " + h; p = "[BEINAHE?] " + p; }
        break;
      case "flag":
        var f = FLAG_INFO[e.f] || { icon: "🚩", label: e.f };
        h = "<b>" + f.icon + " MARKIERT: " + f.label + "</b>" + (e.d != null ? " <small>(Pegel " + Math.round(e.d) + " dB)</small>" : "") +
            (e.x ? "<br><span class=\"alt\">Notiz: </span>" + esc(e.x) : "") +
            (e.c ? "<br><span class=\"alt\">gehört davor: </span>" + highlight(e.c) : "");
        cls = "flag flag-" + e.f;
        p = "[MARKIERT: " + f.label.toUpperCase() + "]" + (e.d != null ? " Pegel " + Math.round(e.d) + " dB" : "") +
            (e.x ? " | Notiz: " + e.x : "") + (e.c ? "\n    gehört davor: " + e.c : "");
        break;
      default: h = esc(e.x || e.k); p = e.x || e.k;
    }
    return { cls: cls, html: h, plain: p };
  }

  // ---------------- Pegel (eigener Mikrofon-Abgriff) ----------------
  var meter = null, levelNow = null, levelBuf = [];
  function startSampler() {
    if (meter || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    meter = { stopped: false };
    var m = meter;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      if (m.stopped) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
      var Ctx = global.AudioContext || global.webkitAudioContext;
      m.stream = stream; m.ctx = new Ctx();
      m.label = stream.getAudioTracks()[0] ? stream.getAudioTracks()[0].label : "";
      var an = m.ctx.createAnalyser(); an.fftSize = 1024;
      m.ctx.createMediaStreamSource(stream).connect(an);
      var buf = new Float32Array(an.fftSize), acc = [], lastPush = Date.now();
      m.timer = setInterval(function () {
        an.getFloatTimeDomainData(buf);
        var sum = 0;
        for (var i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        var db = Math.max(-100, 20 * Math.log10(Math.sqrt(sum / buf.length) || 1e-8));
        levelNow = db; acc.push(db);
        levelBuf.push([Date.now(), db]);
        while (levelBuf.length && Date.now() - levelBuf[0][0] > 5000) levelBuf.shift();
        if (Date.now() - lastPush >= 1000 && acc.length) {
          var avg = acc.reduce(function (a, b) { return a + b; }, 0) / acc.length, peak = Math.max.apply(null, acc);
          if (session) {
            session.lv.push([Date.now(), Math.round(avg * 10) / 10, Math.round(peak * 10) / 10]);
            if (session.lv.length > MAX_LEVELS) session.lv.shift();
            dirty = true;
          }
          acc = []; lastPush = Date.now();
        }
      }, 100);
    }).catch(function (e) { m.error = e.name; meter = null; });
  }
  function stopSampler() {
    if (!meter) return;
    meter.stopped = true;
    clearInterval(meter.timer);
    if (meter.stream) meter.stream.getTracks().forEach(function (t) { t.stop(); });
    if (meter.ctx) try { meter.ctx.close(); } catch (e) {}
    meter = null; levelNow = null;
  }
  function recentDb() {
    if (!levelBuf.length) return null;
    var cut = Date.now() - 3000, v = levelBuf.filter(function (l) { return l[0] >= cut; });
    return v.length ? v.reduce(function (a, l) { return a + l[1]; }, 0) / v.length : null;
  }

  // ---------------- Öffentliche Hooks ----------------
  var Diag = {
    FLAGS: FLAG_INFO, NEAR_RE: NEAR_RE,

    // opts: { matchRe, page?, panel? (Standard true), plus?(), minus?() }
    init: function (o) {
      opts = o || {};
      matchRe = new RegExp(opts.matchRe.source, opts.matchRe.flags);
      newSession();
      if (opts.panel !== false) buildPanel();
    },
    subscribe: function (fn) { subs.push(fn); },

    recStart: function () {
      var now = Date.now(), e = { k: "start" };
      if (lastEndAt) { e.g = now - lastEndAt; lastEndAt = null; }
      lastStartAt = now; running = true;
      push(e);
      startSampler();   // Pegel mitschreiben, solange die Erkennung läuft
    },
    recEnd: function (userStopped) {
      var now = Date.now();
      push({ k: "end", dur: lastStartAt ? now - lastStartAt : 0, u: !!userStopped });
      running = false;
      lastEndAt = userStopped ? null : now;
      if (userStopped && !panelOpen && !opts.keepLevels) stopSampler();
    },
    error: function (type) {
      // Chrome meldet manches doppelt in derselben Sekunde – nur einmal protokollieren
      var last = session && session.e[session.e.length - 1];
      if (last && last.k === "error" && last.x === type && Date.now() - last.t < 1500) return;
      push({ k: "error", x: type });
    },
    note: function (text) { push({ k: "note", x: text }); },
    jsError: function (err, where) { jsError(err, where || "?"); },
    added: function (n) { if (!session) newSession(); session.cnt += n; dirty = true; notify(null); },
    interim: function (text) { interimNow = text || ""; },
    live: function (text, n) { push({ k: "live", x: text, n: n }); },
    kept: function (text, finalText, n) { push({ k: "kept", x: text, y: finalText, n: n }); },
    final: function (result, countedN) {
      var a = [];
      for (var i = 0; i < result.length; i++) a.push([result[i].transcript.trim(), result[i].confidence ? Math.round(result[i].confidence * 100) / 100 : 0]);
      var e = { k: "final", a: a, n: countedN || 0 };
      if (!countedN && a.some(function (x) { return NEAR_RE.test(x[0]); })) e.near = 1;
      push(e);
      if (a[0] && a[0][0]) { transcript.push([Date.now(), a[0][0]]); while (transcript.length > 40) transcript.shift(); }
    },
    // Manuelle Markierung: kind = "missed" | "false" | "double"
    flag: function (kind, noteText) {
      var cut = Date.now() - 30000;
      var ctx = transcript.filter(function (x) { return x[0] >= cut; }).map(function (x) { return x[1]; }).join(" … ");
      if (interimNow) ctx = (ctx ? ctx + " … " : "") + interimNow;
      var e = { k: "flag", f: kind, c: ctx.slice(-600) };
      var db = recentDb();
      if (db != null) e.d = Math.round(db * 10) / 10;
      if (noteText) e.x = noteText;
      push(e);
      var info = FLAG_INFO[kind];
      if (info && info.delta > 0 && opts.plus) opts.plus();
      if (info && info.delta < 0 && opts.minus) opts.minus();
      persist(true);
    },

    // ----- für diagnose.html -----
    session: function () { return session; },
    newSession: function () { if (session) { session.end = Date.now(); dirty = true; persist(true); } newSession(); },
    sessions: function () {
      var st = loadStore().sessions.filter(function (s) { return !session || s.id !== session.id; });
      if (session && (session.e.length || session.lv.length)) st.push(session);
      return st.sort(function (a, b) { return b.start - a.start; });
    },
    deleteSession: function (id) {
      var st = loadStore(); st.sessions = st.sessions.filter(function (s) { return s.id !== id; });
      try { localStorage.setItem(STORE, JSON.stringify(st)); } catch (e) {}
    },
    deleteAll: function () { try { localStorage.removeItem(STORE); } catch (e) {} },
    importSession: function (obj) {
      if (!obj || !Array.isArray(obj.e)) throw new Error("Keine Diagnose-Sitzung (JSON-Export) erkannt");
      obj.id = obj.id || Date.now().toString(36); obj.lv = obj.lv || []; obj.imported = true;
      var st = loadStore(); st.sessions = st.sessions.filter(function (s) { return s.id !== obj.id; }); st.sessions.push(obj);
      while (st.sessions.length > MAX_SESSIONS) st.sessions.shift();
      localStorage.setItem(STORE, JSON.stringify(st));
      return obj;
    },
    computeStats: computeStats, renderEntry: renderEntry, highlight: highlight, countMatches: countMatches, clock: clock, esc: esc,
    levelNow: function () { return levelNow; }, recentDb: recentDb, micLabel: function () { return meter && meter.label; },
    startSampler: startSampler, stopSampler: stopSampler,
    isRecording: function () { return recordOn; },
    setRecording: function (on) {
      recordOn = !!on;
      try { localStorage.setItem(RECORD_KEY, on ? "1" : "0"); } catch (e) {}
      if (on) { dirty = true; persist(true); }
    },
    exportTxt: function (s) { s = s || session; download(sessionTxt(s), "diagnose-" + stamp(s) + ".txt", "text/plain"); },
    exportJson: function (s) { s = s || session; download(JSON.stringify(s), "diagnose-" + stamp(s) + ".json", "application/json"); }
  };

  function stamp(s) { var d = new Date(s.start); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "-" + pad(d.getHours()) + "-" + pad(d.getMinutes()); }
  function statsLine(st) {
    return "gezählt (automatisch) = " + st.counted + " | davon live = " + st.live + " | gerettet = " + st.kept +
           " | Abschnitte = " + st.finals + " | Beinahe = " + st.near +
           " | markiert verpasst = " + st.missed + " | falsch = " + st["false"] + " | doppelt = " + st.double +
           " | Neustarts = " + Math.max(0, st.starts - 1) + " | Hörlücken = " + secs(st.gapMs) + " (" + st.gapPct.toFixed(1) + " %)" +
           " | Fehler = " + st.errCount + " | Stille-Meldungen = " + st.silence +
           (st.avgDb != null ? " | Ø Pegel = " + Math.round(st.avgDb) + " dB" : "");
  }
  function sessionTxt(s) {
    var st = computeStats(s), B = global.AnderStelleBoost;
    var head = [
      "Diagnose „an der Stelle“ – Sitzung vom " + new Date(s.start).toLocaleString("de-DE") + (s.end ? " bis " + new Date(s.end).toLocaleTimeString("de-DE") : ""),
      "Seite: " + s.page, "Browser: " + (s.ua || ""),
      "Statistik: " + statsLine(st),
      "Fehler: " + JSON.stringify(st.errors),
      B ? "Verstärker: " + B.status().amp + " | Phrasen-Boost: " + B.status().phrases : "",
      ""
    ];
    return head.concat(s.e.map(function (e) { return clock(e.t) + "  " + renderEntry(e).plain; })).join("\n");
  }
  function download(text, name, type) {
    var blob = new Blob([text], { type: type + ";charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  Diag.statsLine = statsLine;
  Diag.sessionTxt = sessionTxt;

  // ================= Panel (index.html / wal-party.html) =================
  var panel, listEl, statsEl, levelBar, levelPeak, levelText, panelOpen = false, meterRaf = null;

  function buildPanel() {
    var css = document.createElement("style");
    css.textContent = [
      "#diag-btn{position:fixed;left:12px;bottom:12px;z-index:90;font:600 13px/1 -apple-system,system-ui,sans-serif;",
      "padding:9px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(2,27,46,.85);color:#eafcff;cursor:pointer;box-shadow:none}",
      "#diag-btn:hover{filter:brightness(1.2)}",
      "#diag{position:fixed;left:12px;bottom:56px;z-index:90;width:min(580px,calc(100vw - 24px));height:min(84vh,780px);display:none;flex-direction:column;",
      "background:rgba(2,20,34,.97);color:#eafcff;border:1px solid rgba(255,255,255,.18);border-radius:14px;",
      "font:13px/1.45 -apple-system,system-ui,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.5);overflow:hidden}",
      "#diag.on{display:flex}",
      "#diag header{display:flex;align-items:center;gap:6px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.1);flex-wrap:wrap}",
      "#diag header b{flex:1;font-size:14px;min-width:150px}",
      "#diag button{font:600 12px/1 inherit;padding:7px 10px;border-radius:8px;border:none;cursor:pointer;background:rgba(255,255,255,.12);color:#eafcff;box-shadow:none}",
      "#diag a{color:#5ff0d8;font-weight:700;font-size:12px}",
      "#diag .level{padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.1)}",
      "#diag .meter{position:relative;height:10px;border-radius:5px;background:rgba(255,255,255,.1);overflow:hidden;margin-top:4px}",
      "#diag .meter i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#51cf66,#ffd166 70%,#ff6b6b);width:0}",
      "#diag .meter s{position:absolute;top:0;bottom:0;width:2px;background:#fff;left:0}",
      "#diag .flags{display:flex;gap:6px;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.1);flex-wrap:wrap;align-items:center}",
      "#diag .flags button{font-size:12.5px;padding:8px 10px}",
      "#diag .flags button[data-f=missed]{background:#1f6f8b}#diag .flags button[data-f=false]{background:#8f1d2c}#diag .flags button[data-f=double]{background:#6a3d9a}",
      "#diag .flags small{flex-basis:100%;color:#9fd3e0;font-size:11px}",
      "#diag .stats{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.1)}",
      "#diag .stats div{background:rgba(255,255,255,.06);border-radius:8px;padding:5px 7px}",
      "#diag .stats b{display:block;font-size:15px;color:#5ff0d8}",
      "#diag .stats span{font-size:10px;color:#9fd3e0;text-transform:uppercase;letter-spacing:.4px}",
      "#diag .boost{padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.1);font-size:12px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}",
      "#diag .boost button.on{background:#5ff0d8;color:#022}",
      "#diag .boost small{flex-basis:100%;color:#9fd3e0}",
      "#diag .boost label{margin-left:auto;display:flex;gap:5px;align-items:center;color:#9fd3e0}",
      "#diag ol{list-style:none;margin:0;padding:6px 8px;overflow-y:auto;flex:1}",
      "#diag li{padding:5px 7px;border-radius:7px;margin-bottom:3px;word-break:break-word}",
      "#diag li time{color:#9fd3e0;font-variant-numeric:tabular-nums;margin-right:6px}",
      "#diag li.sys{color:#9fd3e0}#diag li.warn{background:rgba(255,209,102,.1);color:#ffd166}",
      "#diag li.err{background:rgba(255,107,107,.15);color:#ff9b9b}#diag li.hit{background:rgba(81,207,102,.15)}",
      "#diag li.near{background:rgba(255,209,102,.16)}#diag li.live{background:rgba(95,240,216,.10)}#diag li.kept{background:rgba(199,125,255,.18)}",
      "#diag li.flag{background:rgba(255,255,255,.14);border-left:4px solid #ffd166}",
      "#diag li .alt{color:#9fd3e0;font-size:11.5px}#diag li small{color:#9fd3e0}",
      "#diag mark{background:#51cf66;color:#032;border-radius:4px;padding:0 3px;font-weight:700}",
      "@media (max-width:560px){#diag .stats{grid-template-columns:repeat(2,1fr)}}"
    ].join("");
    document.head.appendChild(css);

    var btn = document.createElement("button");
    btn.id = "diag-btn"; btn.textContent = "🔍 Diagnose"; btn.title = "Zeigt, was die Spracherkennung versteht";
    document.body.appendChild(btn);

    panel = document.createElement("div");
    panel.id = "diag";
    panel.innerHTML =
      '<header><b>🔍 Diagnose Spracherkennung</b>' +
      '<a href="diagnose.html" target="_blank" title="Große Diagnose-Seite mit Auswertung">🔬 Diagnose-Seite</a>' +
      '<button data-a="export">⬇ TXT</button><button data-a="json">⬇ JSON</button>' +
      '<button data-a="new" title="Aktuelle Sitzung abschließen und eine neue beginnen">Neue Sitzung</button><button data-a="close">✕</button></header>' +
      '<div class="flags">' +
      '<button data-f="missed">😶 Verpasst (+1)</button><button data-f="false">🚫 Falsch (−1)</button><button data-f="double">✌️ Doppelt (−1)</button>' +
      '<small>Markieren, wenn die Erkennung danebenlag – korrigiert den Zähler und merkt sich, was davor gehört wurde. Tasten bei offenem Panel: V / F / D.</small></div>' +
      '<div class="level">Mikrofon-Pegel <span class="lv-text">(startet beim Öffnen …)</span>' +
      '<div class="meter"><i></i><s></s></div></div>' +
      '<div class="stats"></div>' +
      '<div class="boost">🎚️ Verstärker: ' +
      '<button data-b="0">Aus</button><button data-b="2">2×</button><button data-b="4">4×</button><button data-b="8">8×</button>' +
      '<label title="Sitzung lokal speichern, damit die Diagnose-Seite sie auswerten kann"><input type="checkbox" class="rec"> 💾 aufzeichnen</label>' +
      '<small class="b-status"></small></div>' +
      '<ol></ol>';
    document.body.appendChild(panel);

    listEl = panel.querySelector("ol");
    statsEl = panel.querySelector(".stats");
    levelBar = panel.querySelector(".meter i");
    levelPeak = panel.querySelector(".meter s");
    levelText = panel.querySelector(".lv-text");
    var rec = panel.querySelector(".rec");
    rec.checked = recordOn;
    rec.addEventListener("change", function () { Diag.setRecording(rec.checked); });

    btn.addEventListener("click", function () { setOpen(!panelOpen); });
    panel.addEventListener("click", function (e) {
      var t = e.target;
      if (!t.getAttribute) return;
      var a = t.getAttribute("data-a"), f = t.getAttribute("data-f"), b = t.getAttribute("data-b");
      if (a === "close") setOpen(false);
      else if (a === "new") { Diag.newSession(); listEl.innerHTML = ""; renderStats(); }
      else if (a === "export") Diag.exportTxt();
      else if (a === "json") Diag.exportJson();
      if (f) Diag.flag(f);
      if (b !== null && global.AnderStelleBoost) {
        global.AnderStelleBoost.setLevel(parseFloat(b)).then(renderBoost, renderBoost);
        renderBoost();
      }
    });
    document.addEventListener("keydown", function (e) {
      if (!panelOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/input|textarea|select/i.test((e.target && e.target.tagName) || "")) return;
      var k = { v: "missed", f: "false", d: "double" }[(e.key || "").toLowerCase()];
      if (k) { e.preventDefault(); Diag.flag(k); }
    });
    Diag.subscribe(function (entry) { if (panelOpen && entry) { appendRow(entry); renderStats(); } });
    setInterval(function () { if (panelOpen) { renderStats(); renderBoost(); } }, 1000);
    renderBoost();
  }

  function setOpen(v) {
    panelOpen = v;
    panel.classList.toggle("on", v);
    if (v) {
      listEl.innerHTML = "";
      session.e.slice(-400).forEach(appendRow);
      renderStats(); renderBoost();
      startSampler();
      (function loop() {
        if (!panelOpen) return;
        var db = levelNow, r = recentDb();
        levelBar.style.width = (db == null ? 0 : Math.max(0, Math.min(100, (db + 70) / 70 * 100))) + "%";
        levelPeak.style.left = (r == null ? 0 : Math.max(0, Math.min(100, (r + 70) / 70 * 100))) + "%";
        levelText.textContent = db == null ? "(startet …)" : Math.round(db) + " dB · Ø 3 s: " + Math.round(r) + " dB" + (Diag.micLabel() ? " · " + Diag.micLabel() : "");
        meterRaf = requestAnimationFrame(loop);
      })();
    } else {
      cancelAnimationFrame(meterRaf);
      if (!running) stopSampler();
    }
  }
  function appendRow(e) {
    var r = renderEntry(e), li = document.createElement("li");
    li.className = r.cls;
    li.innerHTML = "<time>" + clock(e.t) + "</time>" + r.html;
    var atBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 40;
    listEl.appendChild(li);
    while (listEl.children.length > 400) listEl.removeChild(listEl.firstChild);
    if (atBottom) listEl.scrollTop = listEl.scrollHeight;
  }
  function renderBoost() {
    var B = global.AnderStelleBoost, row = panel.querySelector(".boost");
    if (!B) { Array.prototype.forEach.call(row.querySelectorAll("button"), function (x) { x.style.display = "none"; }); return; }
    Array.prototype.forEach.call(row.querySelectorAll("button"), function (x) {
      x.classList.toggle("on", parseFloat(x.getAttribute("data-b")) === (B.level || 0));
    });
    var st = B.status();
    row.querySelector(".b-status").textContent = "Verstärker: " + st.amp + " · Phrasen-Boost: " + st.phrases +
      ". Umschalten startet die Erkennung kurz neu.";
  }
  function renderStats() {
    var st = computeStats(session);
    var cells = [
      [st.counted, "gezählt (auto)"], [st.live, "davon live"], [st.kept, "gerettet"],
      [st.missed + " / " + st["false"] + " / " + st.double, "markiert verp./falsch/dopp."],
      [st.recall == null ? "–" : Math.round(st.recall * 100) + " %", "Trefferquote (geschätzt)"],
      [Math.max(0, st.starts - 1), "Neustarts"], [secs(st.gapMs), "Hörlücken"],
      [st.gapPct.toFixed(1).replace(".", ",") + " %", "Zeit ohne Erkennung"],
      [st.errCount + " / " + st.silence, "Fehler / Stille"],
      [st.avgDb == null ? "–" : Math.round(st.avgDb) + " dB", "Ø Pegel"]
    ];
    statsEl.innerHTML = cells.map(function (c) { return "<div><b>" + c[0] + "</b><span>" + c[1] + "</span></div>"; }).join("");
  }

  global.AnderStelleDiag = Diag;
})(window);
