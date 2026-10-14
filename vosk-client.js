/*
 * Browser-Seite für den lokalen Vosk-Server (vosk/vosk-server.py).
 *
 *   var v = AnderStelleVosk.create({
 *     url: "ws://127.0.0.1:2700",
 *     grammar: ["an der stelle", "an dieser stelle", "[unk]"],
 *     free: true,                   // zusätzlich freie Erkennung
 *     raw: false,                   // true = ohne Rauschunterdrückung/Auto-Pegel
 *     onStatus: function (state, info) {},   // "aus" | "verbinde" | "verbunden" | "getrennt" | "fehler"
 *     onMessage: function (msg) {}           // partial/final/hello/error vom Server
 *   });
 *   v.start(); v.stop(); v.configure({ grammar, free }); v.setRaw(bool)
 *
 * Ohne Mikrofon (für Aufnahmen):  create({ mic: false, ... }); v.start();
 *   v.whenConnected().then(...); v.reset(); v.sendPcm(int16, onProgress).then(...); v.flush()
 *
 * Audio: eigenes Mikrofon-Abgreifen, Umrechnung auf 16 kHz Int16 mono, alle ~250 ms
 * ein Paket an den Server. Ist der Server (noch) nicht da, wird alle 3–10 s neu verbunden.
 */
(function (global) {
  "use strict";

  var TARGET_RATE = 16000;

  // AudioWorklet als Blob – sammelt Samples und schickt sie an den Haupt-Thread
  var WORKLET = "class P extends AudioWorkletProcessor{process(i){var c=i[0]&&i[0][0];if(c)this.port.postMessage(c.slice(0));return true}}registerProcessor('as-tap',P);";

  function Vosk(opts) {
    this.o = opts || {};
    this.url = this.o.url || "ws://127.0.0.1:2700";
    this.cfg = { type: "config", sampleRate: TARGET_RATE, grammar: this.o.grammar, free: this.o.free !== false };
    this.raw = !!this.o.raw;
    this.running = false;
    this.ws = null;
    this.state = "aus";
    this.buf = [];
    this.bufLen = 0;
    this.sentBytes = 0;
  }

  Vosk.prototype.status = function (state, info) {
    this.state = state;
    if (this.o.onStatus) this.o.onStatus(state, info || "");
  };

  Vosk.prototype.start = function () {
    if (this.running) return Promise.resolve();
    this.running = true;
    this.connect();
    return this.o.mic === false ? Promise.resolve() : this.openMic();
  };

  // ---------- ohne Mikrofon: fertige Audiodaten schicken ----------
  Vosk.prototype.whenConnected = function (timeoutMs) {
    var self = this, t0 = Date.now();
    return new Promise(function (resolve, reject) {
      (function check() {
        if (self.ws && self.ws.readyState === 1 && self.state === "verbunden") return resolve();
        if (Date.now() - t0 > (timeoutMs || 8000)) return reject(new Error("Vosk-Server nicht erreichbar – läuft ./vosk/start.sh?"));
        setTimeout(check, 150);
      })();
    });
  };
  Vosk.prototype.sendJson = function (obj) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj)); };
  Vosk.prototype.reset = function () { this.sendJson(this.cfg); };   // neue Konfiguration = frische Erkenner, Zeit ab 0
  Vosk.prototype.flush = function () { this.sendJson({ type: "flush" }); };
  // int16: komplette Aufnahme (16 kHz mono). Sendet in 1-s-Stücken und wartet, wenn der Puffer voll ist.
  Vosk.prototype.sendPcm = function (int16, onProgress) {
    var self = this, CH = TARGET_RATE, pos = 0;
    return new Promise(function (resolve, reject) {
      (function next() {
        if (!self.ws || self.ws.readyState !== 1) return reject(new Error("Verbindung zum Vosk-Server verloren"));
        while (pos < int16.length && self.ws.bufferedAmount < 2e6) {
          var part = int16.subarray(pos, Math.min(int16.length, pos + CH));
          self.ws.send(part.slice().buffer);
          pos += CH;
        }
        if (onProgress) onProgress(Math.min(1, pos / int16.length));
        if (pos >= int16.length) return resolve();
        setTimeout(next, 30);
      })();
    });
  };

  Vosk.prototype.stop = function () {
    this.running = false;
    clearTimeout(this.retry);
    if (this.ws) { try { this.ws.close(); } catch (e) {} this.ws = null; }
    this.closeMic();
    this.status("aus");
  };

  Vosk.prototype.configure = function (c) {
    if (c.grammar) this.cfg.grammar = c.grammar;
    if (c.free !== undefined) this.cfg.free = !!c.free;
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(this.cfg));
  };

  Vosk.prototype.setRaw = function (raw) {
    this.raw = !!raw;
    if (this.running) { this.closeMic(); this.openMic(); }
  };

  // ---------- WebSocket ----------
  Vosk.prototype.connect = function () {
    var self = this;
    if (!this.running) return;
    this.status("verbinde", this.url);
    var ws;
    try { ws = new WebSocket(this.url); } catch (e) { this.status("fehler", e.message); return this.scheduleRetry(); }
    ws.binaryType = "arraybuffer";
    this.ws = ws;
    ws.onopen = function () {
      self.retryMs = 3000;
      ws.send(JSON.stringify(self.cfg));
      self.status("verbunden", self.url);
    };
    ws.onmessage = function (ev) {
      var msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.type === "hello") self.status("verbunden", msg.model || "");
      if (self.o.onMessage) self.o.onMessage(msg);
    };
    ws.onclose = function () {
      if (self.ws === ws) self.ws = null;
      if (!self.running) return;
      self.status("getrennt", "Server nicht erreichbar – läuft ./vosk/start.sh im Terminal?");
      self.scheduleRetry();
    };
    ws.onerror = function () {};
  };
  Vosk.prototype.scheduleRetry = function () {
    var self = this;
    clearTimeout(this.retry);
    // 3 s, dann länger warten (max. 10 s), solange der Server nicht läuft
    this.retryMs = Math.min(10000, (this.retryMs || 2000) + 1500);
    this.retry = setTimeout(function () { self.connect(); }, this.retryMs);
  };

  // ---------- Mikrofon ----------
  Vosk.prototype.openMic = function () {
    var self = this;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { this.status("fehler", "kein Mikrofonzugriff möglich"); return Promise.resolve(); }
    var c = this.raw ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false } : { echoCancellation: false, noiseSuppression: true, autoGainControl: true };
    // Manche Chrome-Versionen lehnen eine zweite Aufnahme mit anderen Einstellungen ab (AbortError) –
    // dann mit Standard-Einstellungen erneut versuchen.
    var get = navigator.mediaDevices.getUserMedia({ audio: c }).catch(function (e) {
      if (e && (e.name === "AbortError" || e.name === "NotReadableError" || e.name === "OverconstrainedError")) {
        self.status(self.state, "Mikrofon mit Sondereinstellungen nicht verfügbar – nutze Standard");
        return navigator.mediaDevices.getUserMedia({ audio: true });
      }
      throw e;
    });
    return get.then(function (stream) {
      if (!self.running) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
      var Ctx = global.AudioContext || global.webkitAudioContext;
      var ctx = new Ctx();
      self.mic = { stream: stream, ctx: ctx };
      var src = ctx.createMediaStreamSource(stream);
      var onChunk = function (f32) { self.push(f32, ctx.sampleRate); };
      // Älterer Weg: funktioniert überall, auch wenn die Seite als Datei (file://) geöffnet ist
      var legacy = function () {
        var sp = ctx.createScriptProcessor(4096, 1, 1);
        var mute = ctx.createGain(); mute.gain.value = 0;   // nicht hörbar ausgeben
        sp.onaudioprocess = function (ev) { onChunk(ev.inputBuffer.getChannelData(0).slice(0)); };
        src.connect(sp); sp.connect(mute); mute.connect(ctx.destination);
        self.mic.node = sp;
      };
      if (!(ctx.audioWorklet && global.Blob)) return legacy();
      var url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
      return ctx.audioWorklet.addModule(url).then(function () {
        var node = new AudioWorkletNode(ctx, "as-tap");
        node.port.onmessage = function (ev) { onChunk(ev.data); };
        src.connect(node);
        self.mic.node = node;
      }).catch(legacy);   // AudioWorklet lädt z. B. unter file:// nicht
    }).catch(function (e) { self.status("fehler", "Mikrofon: " + e.name + (e.message ? " – " + e.message : "")); });
  };
  Vosk.prototype.closeMic = function () {
    var m = this.mic;
    this.mic = null;
    if (!m) return;
    m.stream.getTracks().forEach(function (t) { t.stop(); });
    try { m.ctx.close(); } catch (e) {}
  };

  // Samples sammeln, auf 16 kHz umrechnen und ca. alle 250 ms senden
  Vosk.prototype.push = function (f32, rate) {
    this.buf.push(f32);
    this.bufLen += f32.length;
    if (this.bufLen < rate / 4) return;
    var all = new Float32Array(this.bufLen), off = 0;
    this.buf.forEach(function (b) { all.set(b, off); off += b.length; });
    this.buf = []; this.bufLen = 0;
    var ratio = rate / TARGET_RATE, n = Math.floor(all.length / ratio), out = new Int16Array(n);
    for (var i = 0; i < n; i++) {
      // einfacher Tiefpass durch Mittelwert über das Intervall, dann auf 16 Bit
      var a = Math.floor(i * ratio), b2 = Math.min(all.length, Math.floor((i + 1) * ratio)), s = 0;
      for (var k = a; k < b2; k++) s += all[k];
      var v = b2 > a ? s / (b2 - a) : all[a];
      out[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
    }
    if (this.ws && this.ws.readyState === 1) { this.ws.send(out.buffer); this.sentBytes += out.byteLength; }
  };

  // Treffer in einem Vosk-Ergebnis: „an/in/am der/die/dem stelle(n)“ als drei Wörter hintereinander
  // (oder zusammengeschrieben „anderstelle“). Sicherheit = schwächstes der Wörter, Zeiten in Sekunden.
  var PHRASE = /^(an|in|am) (der|die|dem) stellen?$/, ONE = /^(an|in|am)(der|die|dem)stellen?$/;
  function findHits(words) {
    var hits = [];
    words = words || [];
    for (var i = 0; i < words.length; i++) {
      var w3 = words.slice(i, i + 3);
      if (w3.length === 3 && PHRASE.test(w3.map(function (x) { return x.word; }).join(" "))) {
        hits.push({ conf: Math.min.apply(null, w3.map(function (x) { return x.conf == null ? 1 : x.conf; })), start: w3[0].start, end: w3[2].end });
        i += 2;
      } else if (ONE.test(words[i].word)) {
        hits.push({ conf: words[i].conf == null ? 1 : words[i].conf, start: words[i].start, end: words[i].end });
      }
    }
    return hits;
  }

  global.AnderStelleVosk = { create: function (o) { return new Vosk(o); }, TARGET_RATE: TARGET_RATE, findHits: findHits };
})(window);
