/*
 * Kombi-Erkennung für die Zähl-Seiten (zaehler.html, wal-party.html):
 * Chrome-Spracherkennung + optional Vosk (lokaler Schlüsselwort-Detektor, vosk/start.sh).
 *
 * Regeln (aus der Diagnose abgeleitet):
 *   - Chrome zählt wie bisher.
 *   - Vosk zählt zusätzlich, wenn es sich mindestens THRESHOLD (75 %) sicher ist.
 *   - Erkennen beide dieselbe Stelle innerhalb von WINDOW_MS (8 s), zählt sie nur einmal –
 *     egal, wer zuerst war.
 *   - Läuft der Vosk-Server nicht, zählt Chrome allein; verbunden wird automatisch.
 *
 *   var kombi = AnderStelleKombi.create({
 *     onVoskHits: function (n, text, conf) {},   // Vosk hat n Treffer, die Chrome nicht hatte -> zählen
 *     diag: AnderStelleDiag                       // optional: Protokoll
 *   });
 *   kombi.start(); kombi.stop();
 *   var n = kombi.fromChrome(k);   // Chrome meldet k Treffer -> n davon wirklich neu zählen
 *
 * Kleine Statusanzeige unten links (Klick schaltet Vosk an/aus, Einstellung wird gemerkt).
 */
(function (global) {
  "use strict";

  var THRESHOLD = 0.75, WINDOW_MS = 8000;
  var ENABLED_KEY = "anderstelle.kombi.vosk";
  var DEFAULT_GRAMMAR = ["an der stelle", "an dieser stelle", "[unk]"];

  function readEnabled() { try { return localStorage.getItem(ENABLED_KEY) !== "0"; } catch (e) { return true; } }
  function grammar() {   // gleiche Grammatik wie zuletzt im Vosk-Test der Diagnose-Seite
    try { var c = JSON.parse(localStorage.getItem("anderstelle.vosk.cfg") || "null"); if (c && c.grammar && c.grammar.length) return c.grammar; } catch (e) {}
    return DEFAULT_GRAMMAR;
  }

  var CSS = [
    "#kombi-pill{position:fixed;left:122px;bottom:12px;z-index:90;display:inline-flex;align-items:center;gap:7px;",
    "font:600 12.5px/1 -apple-system,system-ui,sans-serif;padding:9px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.2);",
    "background:rgba(2,27,46,.85);color:#eafcff;cursor:pointer;user-select:none}",
    "#kombi-pill i{width:9px;height:9px;border-radius:50%;background:#7a8a94;display:inline-block}",
    "#kombi-pill.ok i{background:#51cf66;box-shadow:0 0 0 3px rgba(81,207,102,.25)}",
    "#kombi-pill.wait i{background:#ffd166}#kombi-pill.bad i{background:#ff6b6b}",
    "#kombi-pill b{color:#5ff0d8;font-weight:800}",
    "#kombi-pill:hover{filter:brightness(1.2)}"
  ].join("");

  function Kombi(o) {
    this.o = o || {};
    this.enabled = readEnabled();
    this.running = false;
    this.events = [];      // gezählte Erkennungen: { t, src: "chrome"|"vosk", matched }
    this.extra = 0;        // Treffer, die nur Vosk hatte
    this.state = "aus";
    this.vosk = null;
    this.buildPill();
  }

  // Erkennung derselben Stelle durch den anderen Detektor suchen (noch nicht verrechnet, ≤ WINDOW_MS)
  Kombi.prototype.claim = function (src, now) {
    this.events = this.events.filter(function (e) { return now - e.t <= WINDOW_MS; });
    for (var i = 0; i < this.events.length; i++) {
      var e = this.events[i];
      if (e.src !== src && !e.matched) { e.matched = true; return true; }
    }
    return false;
  };

  // Chrome meldet k neue Treffer -> Anzahl, die wirklich gezählt werden soll
  Kombi.prototype.fromChrome = function (k) {
    var now = Date.now(), add = 0;
    for (var i = 0; i < k; i++) {
      if (this.claim("chrome", now)) {
        // Vosk hatte die Stelle schon gezählt -> nur verrechnen
        this.extra = Math.max(0, this.extra - 1);
        this.note("Chrome bestätigt einen Vosk-Treffer (nicht doppelt gezählt)");
      } else {
        this.events.push({ t: now, src: "chrome", matched: false });
        add++;
      }
    }
    this.render();
    return add;
  };

  Kombi.prototype.fromVosk = function (hits, text) {
    var now = Date.now(), add = 0, d = this.o.diag, best = 0;
    var self = this;
    hits.forEach(function (h) {
      best = Math.max(best, h.conf);
      if (h.conf < THRESHOLD) return;
      if (self.claim("vosk", now)) return;                  // Chrome hatte die Stelle schon
      self.events.push({ t: now, src: "vosk", matched: false });
      add++;
    });
    if (d && d.vosk) d.vosk("kws", text, hits.length ? Math.min.apply(null, hits.map(function (h) { return h.conf; })) : null, hits.length, THRESHOLD);
    if (add) {
      this.extra += add;
      this.note("🧩 Vosk zählt " + add + "× (Chrome hatte es nicht): „" + text + "“");
      if (this.o.onVoskHits) this.o.onVoskHits(add, text, best);
    }
    this.render();
  };

  Kombi.prototype.note = function (t) { if (this.o.diag && this.o.diag.note) this.o.diag.note(t); };

  // ---------- Vosk-Verbindung ----------
  Kombi.prototype.start = function () {
    this.running = true;
    if (!this.enabled || !global.AnderStelleVosk) { this.render(); return; }
    var self = this;
    if (!this.vosk) {
      this.vosk = global.AnderStelleVosk.create({
        grammar: grammar(), free: false,
        onStatus: function (st) { self.state = st; self.render(); },
        onMessage: function (m) {
          if (m.type !== "final" || m.rec !== "kws") return;
          var hits = global.AnderStelleVosk.findHits(m.words);
          var text = (m.text || "").replace(/\[unk\]/g, " ").replace(/\s+/g, " ").trim();
          if (hits.length) self.fromVosk(hits, text);
        }
      });
    }
    this.vosk.start();
  };
  Kombi.prototype.stop = function () {
    this.running = false;
    if (this.vosk) this.vosk.stop();
    this.state = "aus";
    this.render();
  };
  Kombi.prototype.toggle = function () {
    this.enabled = !this.enabled;
    try { localStorage.setItem(ENABLED_KEY, this.enabled ? "1" : "0"); } catch (e) {}
    if (!this.enabled) { if (this.vosk) this.vosk.stop(); this.state = "aus"; this.note("Vosk für die Kombi-Erkennung ausgeschaltet"); }
    else { this.note("Vosk für die Kombi-Erkennung eingeschaltet"); if (this.running) this.start(); }
    this.render();
  };

  // ---------- Anzeige ----------
  Kombi.prototype.buildPill = function () {
    if (!document.getElementById("kombi-css")) {
      var st = document.createElement("style"); st.id = "kombi-css"; st.textContent = CSS; document.head.appendChild(st);
    }
    var p = document.createElement("div");
    p.id = "kombi-pill";
    var self = this;
    p.addEventListener("click", function () { self.toggle(); });
    document.body.appendChild(p);
    this.pill = p;
    this.render();
  };
  Kombi.prototype.render = function () {
    if (!this.pill) return;
    var cls = "", label, tip;
    if (!this.enabled) { label = "Vosk aus"; tip = "Kombi-Erkennung: nur Chrome. Klicken, um Vosk dazuzuschalten."; }
    else if (!this.running) { label = "Vosk bereit"; tip = "Vosk startet zusammen mit der Erkennung (▶︎ Start). Klicken schaltet Vosk ab."; }
    else if (this.state === "verbunden") { cls = "ok"; label = "Vosk verbunden"; tip = "Chrome + Vosk (ab " + Math.round(THRESHOLD * 100) + " % Sicherheit) zählen gemeinsam; dieselbe Stelle zählt nur einmal. Klicken schaltet Vosk ab."; }
    else if (this.state === "verbinde") { cls = "wait"; label = "Vosk verbindet …"; tip = "Suche den Vosk-Server auf ws://127.0.0.1:2700 …"; }
    else { cls = "bad"; label = "Vosk nicht erreichbar"; tip = "Vosk-Server läuft nicht – im Terminal ./start.sh (startet Vosk mit) – Details in daten/vosk.log. Bis dahin zählt Chrome allein. Klicken schaltet Vosk ab."; }
    this.pill.className = cls;
    this.pill.title = tip;
    this.pill.innerHTML = "<i></i>🧩 " + label + (this.extra && this.enabled ? " · <b>+" + this.extra + "</b>" : "");
  };

  global.AnderStelleKombi = {
    create: function (o) { var k = new Kombi(o); global.AnderStelleKombi.last = k; return k; },   // last: für Tests/Konsole
    THRESHOLD: THRESHOLD, WINDOW_MS: WINDOW_MS
  };
})(window);
