/*
 * Gemeinsame Erkennungs-Logik für index.html und wal-party.html.
 *
 * 1) AnderStelleCounter – zählt Treffer im ZUSAMMENHÄNGENDEN Live-Text und nimmt nie zurück.
 *    - Chrome liefert den Live-Text in mehreren Teilen (sicherer Anfang + unsicherer Rest),
 *      und Text wandert zwischen diesen Teilen. Deshalb wird über alle noch offenen
 *      Teile gemeinsam gezählt – nicht pro Teil (das hatte zu Doppelzählungen geführt).
 *    - Leise angehängte „… an der Stelle“ streicht Google im Endergebnis oft wieder.
 *      Einmal live gezählte Treffer bleiben trotzdem gezählt. Taucht so ein Treffer
 *      innerhalb von 8 s wieder auf, wird er nicht doppelt gezählt; danach gilt er als
 *      „gerettet“.
 *
 * 2) AnderStelleBoost – optionale Verbesserungen, jeweils mit Feature-Erkennung:
 *    - Phrasen-Boost: sagt Chrome, dass „an der Stelle“ wichtig ist
 *      (SpeechRecognitionPhrase). Meldet Chrome "phrases-not-supported",
 *      wird er für die Sitzung abgeschaltet.
 *    - Verstärker: Mikrofon → Hochpass → Verstärkung → Kompressor → Limiter,
 *      die bearbeitete Tonspur geht per start(track) an die Erkennung. Hebt leise
 *      Satzenden an. Kann Chrome keine eigene Tonspur, nimmt es wie bisher das
 *      normale Mikro.
 */
(function (global) {
  "use strict";

  // ======================= Zähler =======================
  var CARRY_MS = 8000;   // so lange gilt ein verschwundener Treffer als „vielleicht kommt er wieder“

  // Teile zusammensetzen; wiederholt der nächste Teil das Ende des vorigen (≥ 2 Wörter), wird die Dopplung entfernt
  function joinParts(parts) {
    var words = [];
    parts.forEach(function (p) {
      var w = p.split(/\s+/).filter(Boolean), best = 0;
      for (var k = Math.min(words.length, w.length); k >= 2; k--) {
        if (words.slice(-k).join(" ").toLowerCase() === w.slice(0, k).join(" ").toLowerCase()) { best = k; break; }
      }
      words = words.concat(w.slice(best));
    });
    return words.join(" ");
  }

  function Counter(opts) {
    this.best = opts.bestAlternative;   // (result) -> { text, n }
    this.count = opts.countMatches;     // (text) -> n
    this.reset();
  }
  Counter.prototype.reset = function () {
    this.finalized = {};    // Result-Index -> Endergebnis schon verarbeitet
    this.pending = 0;       // gezählte Treffer, die noch nicht in einem Endergebnis stecken
    this.lastInterimN = 0;
    this.lastInterimText = "";
    this.hitText = "";      // Live-Text, in dem zuletzt ein Treffer gezählt wurde
    this.lastFinalText = "";
    this.orphanSince = 0;   // seit wann gezählte Treffer aus Chromes Text verschwunden sind
  };
  // Verschwundene Treffer, die nicht wiederkamen, als „gerettet“ melden (bei Session-Ende aufrufen)
  Counter.prototype.flush = function () {
    var kept = [];
    var orphan = this.pending - this.lastInterimN;
    if (orphan > 0) kept.push({ text: this.hitText, finalText: this.lastFinalText, n: orphan });
    this.reset();
    return kept;
  };
  // Liefert { added, interimText, live:[{text,n}], kept:[{text,finalText,n}], finals:[{result,text,n}] }
  Counter.prototype.process = function (event) {
    var out = { added: 0, interimText: "", live: [], kept: [], finals: [] };
    var now = Date.now();

    // Verschwundene Treffer, die zu lange weg sind: gerettet (bleiben gezählt), Konto bereinigen
    if (this.orphanSince && now - this.orphanSince > CARRY_MS) {
      var gone = this.pending - this.lastInterimN;
      if (gone > 0) out.kept.push({ text: this.hitText, finalText: this.lastFinalText, n: gone });
      this.pending = this.lastInterimN;
      this.orphanSince = 0;
    }

    var finalsN = 0, parts = [];
    for (var i = event.resultIndex; i < event.results.length; i++) {
      var res = event.results[i], alt = this.best(res);
      if (res.isFinal) {
        if (this.finalized[i]) continue;
        this.finalized[i] = true;
        finalsN += alt.n;
        if (alt.text) this.lastFinalText = alt.text;
        out.finals.push({ result: res, text: alt.text, n: alt.n });
      } else if (alt.text) {
        parts.push(alt.text);
      }
    }
    var interimText = joinParts(parts), interimN = this.count(interimText);
    out.interimText = interimText;

    // Alles, was gerade zu sehen ist (neue Endergebnisse + offener Live-Text), gegen das schon Gezählte
    var observed = finalsN + interimN;
    if (observed > this.pending) {
      var extra = observed - this.pending;
      out.added = extra;
      this.pending = observed;
      var liveExtra = Math.min(extra, interimN);
      if (liveExtra > 0) { out.live.push({ text: interimText, n: liveExtra }); this.hitText = interimText; }
    }
    this.pending -= finalsN;   // diese Treffer sind jetzt in Endergebnissen verbucht

    var orphan = this.pending - interimN;   // gezählt, aber gerade nirgends mehr zu sehen
    if (orphan > 0) { if (!this.orphanSince) this.orphanSince = now; }
    else this.orphanSince = 0;

    this.lastInterimN = interimN;
    this.lastInterimText = interimText;
    return out;
  };
  global.AnderStelleCounter = {
    create: function (opts) { return new Counter(opts); },
    joinParts: joinParts,
    // gleiche Suche wie in den Seiten (für diagnose.html)
    MATCH_RE: /\b(?:an|in|am|ander|anner)\s*(?:der|die|dem)?\s*st[eä]l{1,2}en?\b/gi
  };

  // ======================= Boost =======================
  var LEVEL_KEY = "anderstelle.boost";
  var PHRASE_OFF_KEY = "anderstelle.phrasesOff";
  var SR = global.SpeechRecognition || global.webkitSpeechRecognition;

  function readLevel() { try { var v = parseFloat(localStorage.getItem(LEVEL_KEY)); return isNaN(v) ? 0 : v; } catch (e) { return 0; } }
  function note(t) { if (global.AnderStelleDiag && global.AnderStelleDiag.note) global.AnderStelleDiag.note(t); }

  var Boost = {
    level: readLevel(),          // 0 = aus, sonst Verstärkungsfaktor
    trackSupport: null,          // null = unbekannt, true/false nach dem ersten Versuch
    phrases: null,               // null = ungetestet, true = gesetzt, false = nicht unterstützt
    _graph: null, _preparing: null,
    onRestartNeeded: null,       // von der Seite gesetzt: Erkennung kurz neu starten
    deviceId: (function () { try { return localStorage.getItem("anderstelle.boost.device") || ""; } catch (e) { return ""; } })(),

    setLevel: function (v) {
      Boost.level = v;
      try { localStorage.setItem(LEVEL_KEY, String(v)); } catch (e) {}
      if (Boost._graph) Boost._graph.gain.gain.value = v || 1;
      // Damit die Änderung sofort greift, startet die Seite die Erkennung kurz neu (onRestartNeeded)
      var restart = function (x) { if (Boost.onRestartNeeded) Boost.onRestartNeeded(); return x; };
      if (v > 0) return Boost.prepare().then(restart);
      Boost.release();
      return Promise.resolve(restart(null));
    },

    // Phrasen-Boost setzen (falls der Browser ihn kennt)
    applyPhrases: function (r) {
      var off = false;
      try { off = sessionStorage.getItem(PHRASE_OFF_KEY) === "1"; } catch (e) {}
      if (off || typeof global.SpeechRecognitionPhrase !== "function" || !("phrases" in r)) {
        Boost.phrases = false;
        return false;
      }
      try {
        r.phrases = [new global.SpeechRecognitionPhrase("an der Stelle", 6.0)];
        Boost.phrases = true;
        return true;
      } catch (e) {
        Boost.phrases = false;
        return false;
      }
    },
    // onerror "phrases-not-supported": abschalten, der normale Neustart übernimmt
    phrasesFailed: function (r) {
      try { r.phrases = []; } catch (e) {}
      if (Boost.phrases === false) return;   // Chrome meldet das manchmal doppelt
      Boost.phrases = false;
      try { sessionStorage.setItem(PHRASE_OFF_KEY, "1"); } catch (e) {}
      note("Phrasen-Boost wird von diesem Chrome (ohne Offline-Erkennung) nicht unterstützt – abgeschaltet.");
    },

    // Verstärker-Tonspur vorbereiten (beim Klick auf Start aufrufen, braucht eine Nutzeraktion)
    prepare: function () {
      if (!(Boost.level > 0)) return Promise.resolve(null);
      var t = Boost.track();
      if (t) return Promise.resolve(t);
      if (Boost._preparing) return Boost._preparing;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.resolve(null);
      Boost._preparing = navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, autoGainControl: false, noiseSuppression: true,
                 deviceId: Boost.deviceId ? { exact: Boost.deviceId } : undefined }
      }).then(function (stream) {
        var Ctx = global.AudioContext || global.webkitAudioContext;
        var ctx = new Ctx();
        var src = ctx.createMediaStreamSource(stream);
        var hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 110;   // Rumpeln/Lüftung raus
        var gain = ctx.createGain(); gain.gain.value = Boost.level;
        var comp = ctx.createDynamicsCompressor();     // leise Stellen anheben, laute bremsen
        comp.threshold.value = -45; comp.knee.value = 18; comp.ratio.value = 8; comp.attack.value = 0.004; comp.release.value = 0.25;
        var lim = ctx.createDynamicsCompressor();      // gegen Übersteuern
        lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.1;
        var dest = ctx.createMediaStreamDestination();
        src.connect(hp); hp.connect(gain); gain.connect(comp); comp.connect(lim); lim.connect(dest);
        Boost._graph = { ctx: ctx, stream: stream, gain: gain, track: dest.stream.getAudioTracks()[0] };
        Boost._preparing = null;
        return Boost._graph.track;
      }).catch(function (e) {
        Boost._preparing = null;
        note("Verstärker: kein Mikrofonzugriff (" + e.name + ") – nutze normales Mikro.");
        return null;
      });
      return Boost._preparing;
    },
    track: function () {
      var g = Boost._graph;
      if (!g || g.track.readyState !== "live") return null;
      if (g.ctx.state === "suspended") g.ctx.resume();
      return g.track;
    },
    release: function () {
      var g = Boost._graph;
      if (!g) return;
      g.stream.getTracks().forEach(function (t) { t.stop(); });
      try { g.ctx.close(); } catch (e) {}
      Boost._graph = null;
    },

    // Erkennung starten – mit Verstärker-Tonspur, wenn möglich. Wirft wie recognition.start().
    start: function (r) {
      var t = Boost.level > 0 ? Boost.track() : null;
      if (!t || Boost.trackSupport === false) { r.start(); return; }
      if (Boost.trackSupport === null) {
        // Feature-Test ohne Extra-Sitzung: Kennt Chrome start(track), wirft ein falscher Typ
        // sofort einen TypeError. Sonst wird das Argument ignoriert und es läuft das normale Mikro.
        try {
          r.start("kein-track");
          Boost.trackSupport = false;
          note("Verstärker: Dieses Chrome kann der Erkennung keine eigene Tonspur geben – läuft mit normalem Mikro.");
          return;
        } catch (e) {
          if (!(e instanceof TypeError)) throw e;   // z. B. „läuft schon“ -> Aufrufer versucht es erneut
          Boost.trackSupport = true;
          note("Verstärker aktiv (" + Boost.level + "× + Kompressor).");
        }
      }
      r.start(t);
    },

    // Mikrofon für den Verstärker wählen ("" = Standard)
    setDevice: function (id) {
      Boost.deviceId = id || "";
      try { localStorage.setItem("anderstelle.boost.device", Boost.deviceId); } catch (e) {}
      Boost.release();
      return Boost.level > 0 ? Boost.prepare().then(function (t) { if (Boost.onRestartNeeded) Boost.onRestartNeeded(); return t; }) : Promise.resolve(null);
    },

    status: function () {
      var amp = !(Boost.level > 0) ? "aus" :
                Boost.trackSupport === false ? "nicht unterstützt (normales Mikro)" :
                Boost.trackSupport === true ? (Boost.track() ? "aktiv, " + Boost.level + "×" : "wartet auf Mikro …") :
                "wird beim nächsten (Neu-)Start der Erkennung geprüft";
      var ph = Boost.phrases === true ? "aktiv" : Boost.phrases === false ? "nicht unterstützt" : "noch nicht geprüft";
      return { amp: amp, phrases: ph };
    },
    supported: !!SR
  };

  global.AnderStelleBoost = Boost;
})(window);
