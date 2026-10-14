/*
 * Gemeinsame Erkennungs-Logik für index.html und wal-party.html.
 *
 * 1) AnderStelleCounter – zählt Treffer pro Result-Index und nimmt NIE zurück.
 *    Hintergrund: Leise angehängte Satzenden („… an der Stelle“) tauchen oft nur
 *    im Live-Zwischenstand auf und werden von Google im Endergebnis wieder
 *    gestrichen. Früher wurde der Treffer dann abgezogen – jetzt bleibt er.
 *    Taucht ein gestrichener Treffer kurz danach in einem anderen Satzteil wieder
 *    auf (Chrome verschiebt manchmal Satzgrenzen), wird er nicht doppelt gezählt.
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
  var CARRY_MS = 8000;   // so lange darf ein gestrichener Treffer „wieder auftauchen“, ohne doppelt zu zählen

  function Counter(opts) {
    this.best = opts.bestAlternative;   // (result) -> { text, n }
    this.reset();
  }
  Counter.prototype.reset = function () {
    this.counted = {};     // Result-Index -> bereits gezählte Treffer
    this.hitText = {};     // Result-Index -> Text, in dem der Treffer gehört wurde
    this.finalized = {};   // Result-Index -> Endergebnis schon verarbeitet
    this.carry = 0;
    this.carryUntil = 0;
  };
  // Liefert { added, interimText, live:[{text,n}], kept:[{text,finalText,n}], finals:[{result,text,n}] }
  Counter.prototype.process = function (event) {
    var out = { added: 0, interimText: "", live: [], kept: [], finals: [] };
    var now = Date.now();
    if (now > this.carryUntil) this.carry = 0;
    for (var i = event.resultIndex; i < event.results.length; i++) {
      var res = event.results[i], alt = this.best(res), have = this.counted[i] || 0;
      if (alt.n > have) {
        var extra = alt.n - have, absorbed = Math.min(this.carry, extra);
        this.carry -= absorbed;
        extra -= absorbed;
        this.counted[i] = alt.n;
        this.hitText[i] = alt.text;
        if (extra > 0) {
          out.added += extra;
          if (!res.isFinal) out.live.push({ text: alt.text, n: extra });
        }
      }
      if (res.isFinal) {
        if (this.finalized[i]) continue;
        this.finalized[i] = true;
        var c = this.counted[i] || 0;
        if (alt.n < c) {
          // Live gehört, im Endergebnis verschwunden -> trotzdem gezählt lassen
          this.carry += c - alt.n;
          this.carryUntil = now + CARRY_MS;
          out.kept.push({ text: this.hitText[i], finalText: alt.text, n: c - alt.n });
        }
        out.finals.push({ result: res, text: alt.text, n: alt.n });
      } else {
        out.interimText += alt.text + " ";
      }
    }
    return out;
  };
  global.AnderStelleCounter = { create: function (opts) { return new Counter(opts); } };

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

    setLevel: function (v) {
      Boost.level = v;
      try { localStorage.setItem(LEVEL_KEY, String(v)); } catch (e) {}
      if (Boost._graph) Boost._graph.gain.gain.value = v || 1;
      if (v > 0) return Boost.prepare();
      Boost.release();
      return Promise.resolve(null);
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
        audio: { echoCancellation: false, autoGainControl: false, noiseSuppression: true }
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
