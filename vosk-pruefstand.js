/*
 * Vosk-Prüfstand für diagnose.html – gezielte Tests, bei denen die Wahrheit bekannt ist.
 *
 *  1) Vorlese-Test: Testsätze (mit/ohne „an der Stelle“, Fallen, schwierige Varianten)
 *     vorlesen; ausgewertet wird, was Chrome, Vosk und Vosk frei in dem Zeitfenster
 *     erkannt haben. Nutzt die laufende Live-Verbindung zu Vosk (und Chrome, falls an).
 *  2) Aufnahme-Test: Audiodatei hochladen, Vosk wertet sie (schneller als Echtzeit) über
 *     eine eigene Verbindung aus. Jeden Treffer kann man anhören und als richtig/falsch
 *     bewerten, fehlende Stellen beim Anhören ergänzen.
 *
 *   AnderStelleVoskPruefstand.mount(container, {
 *     D,                       // AnderStelleDiag
 *     cfg(): { url, grammar, free, thr },
 *     ensureLiveVosk(): Instanz der Live-Verbindung (startet sie bei Bedarf),
 *     chromeRunning(): bool
 *   })
 */
(function (global) {
  "use strict";

  var SENTENCES = [
    { t: "Und genau an der Stelle sehen wir, dass die Funktion steigt.", n: 1, how: "ganz normal" },
    { t: "An dieser Stelle machen wir eine kurze Pause.", n: 0, how: "Falle: „an dieser Stelle“ darf nicht zählen" },
    { t: "Das sieht man dann an der Stelle.", n: 1, how: "zum Satzende hin leiser werden – wie angehängt" },
    { t: "Die Stellwand steht an der Seite.", n: 0, how: "Falle: „Stellwand“, „an der Seite“" },
    { t: "An der Stelle, an der Stelle, ja genau.", n: 2, how: "zweimal hintereinander" },
    { t: "Wir rechnen das jetzt an der Tafel aus.", n: 0, how: "Falle: „an der Tafel“" },
    { t: "Das ist eigentlich ganz einfach an der Stelle.", n: 1, how: "schnell und etwas genuschelt" },
    { t: "Das hatten wir an anderer Stelle schon gesehen.", n: 0, how: "Falle: „an anderer Stelle“" },
    { t: "Und dann, äh, an der Stelle kommt der Beweis.", n: 1, how: "mit Füllwort davor" },
    { t: "Bitte stellen Sie Ihre Fragen am Ende.", n: 0, how: "Falle: „stellen“" },
    { t: "In der Stelle steckt der Fehler.", n: 1, how: "„in der Stelle“ zählt auch" },
    { t: "An der Stelle würde ich sagen, das ist klausurrelevant.", n: 1, how: "vom Mikrofon abgewandt oder 2 m entfernt" }
  ];
  var DET = [["chrome", "Chrome"], ["kws", "Vosk"], ["kwsLow", "Vosk unsicher"], ["free", "Vosk frei"]];

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function mmss(sec) { sec = Math.max(0, sec); var m = Math.floor(sec / 60), s = Math.floor(sec % 60); return m + ":" + (s < 10 ? "0" : "") + s; }
  function pc(v) { return v == null ? "–" : Math.round(v * 100) + " %"; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  var CSS = [
    ".ps-tabs{display:flex;gap:6px;margin-bottom:12px}",
    ".ps-tabs button.on{background:var(--accent);color:#022}",
    ".ps-sent{font-size:clamp(1.3rem,3.2vw,2rem);font-weight:800;line-height:1.35;padding:18px;border-radius:14px;background:rgba(0,0,0,.25);margin:10px 0}",
    ".ps-how{color:var(--warn);font-weight:700}",
    ".ps-prog{height:8px;border-radius:4px;background:rgba(255,255,255,.1);overflow:hidden;margin:8px 0}",
    ".ps-prog i{display:block;height:100%;width:0;background:var(--accent);transition:width .2s}",
    "table.ps{width:100%;border-collapse:collapse;font-size:.88rem;margin-top:10px}",
    "table.ps th,table.ps td{padding:5px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}",
    "table.ps td.ok{color:var(--ok);font-weight:800}table.ps td.bad{color:var(--err);font-weight:800}table.ps td.n{color:var(--muted)}",
    "table.ps button{padding:2px 9px;font-size:.8rem;border-radius:7px}",
    "table.ps button.yes.on{background:var(--ok);color:#032}table.ps button.no.on{background:var(--err);color:#fff}",
    "table.ps tr.cur td{background:rgba(95,240,216,.12)}",
    ".ps-audio{width:100%;margin-top:10px}"
  ].join("");

  function mount(root, deps) {
    var D = deps.D;
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    root.innerHTML = "";
    var tabs = el("div", "ps-tabs", '<button data-tab="read" class="on">🗣️ Vorlese-Test</button><button data-tab="file">🎧 Aufnahme-Test</button>');
    var paneRead = el("div"), paneFile = el("div");
    paneFile.style.display = "none";
    root.appendChild(tabs); root.appendChild(paneRead); root.appendChild(paneFile);
    tabs.addEventListener("click", function (e) {
      var t = e.target.getAttribute && e.target.getAttribute("data-tab"); if (!t) return;
      Array.prototype.forEach.call(tabs.children, function (b) { b.classList.toggle("on", b === e.target); });
      paneRead.style.display = t === "read" ? "" : "none";
      paneFile.style.display = t === "file" ? "" : "none";
    });
    buildRead(paneRead, deps);
    buildFile(paneFile, deps);
  }

  // ======================= 1) Vorlese-Test =======================
  function buildRead(root, deps) {
    var D = deps.D;
    root.innerHTML =
      '<p class="small muted" style="margin:0">Du liest Testsätze vor – die Seite weiß, wie oft „an der Stelle“ darin vorkommt, und prüft, was Vosk (und Chrome, ' +
      'falls der Live-Test läuft) erkannt hat. Fallen wie „an dieser Stelle“ zeigen Fehlalarme. Nach jedem Satz <b>Weiter</b> drücken (oder Leertaste).</p>' +
      '<div class="row" style="margin-top:10px"><button class="primary" data-a="start">▶ Vorlese-Test starten</button>' +
      '<label class="small"><input type="checkbox" data-a="shuffle" checked> Reihenfolge mischen</label></div>' +
      '<div data-a="stage" style="display:none">' +
      '  <div class="row small"><b data-a="pos"></b><span class="ps-how" data-a="how"></span></div>' +
      '  <div class="ps-sent" data-a="sent"></div>' +
      '  <div class="row"><button class="primary" data-a="next">Gelesen → weiter <kbd>Leertaste</kbd></button><button data-a="again">↺ Satz wiederholen</button><button data-a="stop">Abbrechen</button>' +
      '  <span class="small muted" data-a="state"></span></div>' +
      '</div>' +
      '<div data-a="result"></div>';
    var q = function (a) { return root.querySelector('[data-a="' + a + '"]'); };
    var order = [], idx = 0, tStart = 0, results = [], busy = false, active = false;

    function startTest() {
      deps.ensureLiveVosk();
      order = SENTENCES.map(function (s, i) { return i; });
      if (q("shuffle").checked) order.sort(function () { return Math.random() - 0.5; });
      idx = 0; results = []; active = true;
      q("stage").style.display = ""; q("start").style.display = "none";
      D.note("Vorlese-Test gestartet (" + order.length + " Sätze)");
      show();
      renderResult();
    }
    function show() {
      var s = SENTENCES[order[idx]];
      q("pos").textContent = "Satz " + (idx + 1) + " von " + order.length + " · ";
      q("how").textContent = "Variante: " + s.how;
      q("sent").textContent = s.t;
      q("state").textContent = deps.chromeRunning() ? "Chrome + Vosk hören zu" : "nur Vosk (Live-Test oben ist aus)";
      tStart = Date.now();
    }
    function finishSentence() {
      if (busy || !active) return;
      busy = true;
      q("state").textContent = "werte aus …";
      var v = deps.ensureLiveVosk();
      if (v && v.flush) v.flush();   // Vosk soll den Satz jetzt abschließen
      sleep(1800).then(function () {
        var tEnd = Date.now(), s = SENTENCES[order[idx]], sess = D.session(), thr = deps.cfg().thr;
        var r = { i: order[idx], soll: s.n, chrome: 0, kws: 0, kwsLow: 0, free: 0, voskText: "" };
        (sess.adds || []).forEach(function (a) { if (a[0] >= tStart && a[0] <= tEnd) r.chrome += a[1]; });
        sess.e.forEach(function (e) {
          if (e.k !== "vosk" || e.t < tStart || e.t > tEnd) return;
          if (e.r === "kws") { if (e.n) { if (e.c == null || e.c >= thr) r.kws += e.n; else r.kwsLow += e.n; } r.voskText += (r.voskText ? " | " : "") + e.x; }
          else r.free += e.n;
        });
        r.chromeOn = deps.chromeRunning();
        results.push(r);
        D.note("Vorlese-Test Satz „" + s.t + "“: soll " + s.n + " · Chrome " + (r.chromeOn ? r.chrome : "aus") + " · Vosk " + r.kws + (r.kwsLow ? " (+" + r.kwsLow + " unsicher)" : "") + " · frei " + r.free);
        busy = false;
        idx++;
        if (idx >= order.length) endTest(); else show();
        renderResult();
      });
    }
    function again() { tStart = Date.now(); q("state").textContent = "nochmal – hört zu"; }
    function endTest() {
      active = false;
      q("stage").style.display = "none"; q("start").style.display = ""; q("start").textContent = "↺ Vorlese-Test nochmal";
      D.note("Vorlese-Test beendet");
    }
    function renderResult() {
      if (!results.length) { q("result").innerHTML = ""; return; }
      // pro Detektor: richtig / verpasst / Fehlalarm aus Soll vs. Ist je Satz
      var agg = {};
      DET.forEach(function (d) { agg[d[0]] = { tp: 0, fn: 0, fp: 0, exact: 0, n: 0 }; });
      results.forEach(function (r) {
        DET.forEach(function (d) {
          if (d[0] === "chrome" && !r.chromeOn) return;
          var a = agg[d[0]], ist = d[0] === "kwsLow" ? r.kws + r.kwsLow : r[d[0]];
          a.n++; a.tp += Math.min(ist, r.soll); a.fn += Math.max(0, r.soll - ist); a.fp += Math.max(0, ist - r.soll); if (ist === r.soll) a.exact++;
        });
      });
      var sum = '<table class="ps"><thead><tr><th>Detektor</th><th>Sätze exakt richtig</th><th>richtig</th><th>verpasst</th><th>Fehlalarm</th><th>Trefferquote</th><th>Genauigkeit</th></tr></thead><tbody>' +
        DET.map(function (d) {
          var a = agg[d[0]], name = d[0] === "kwsLow" ? "Vosk inkl. unsicher" : d[1];
          if (!a.n) return "<tr><td>" + name + '</td><td colspan="6" class="n">nicht aktiv</td></tr>';
          return "<tr><td>" + name + "</td><td>" + a.exact + " / " + a.n + '</td><td class="ok">' + a.tp + "</td><td" + (a.fn ? ' class="bad"' : "") + ">" + a.fn +
                 "</td><td" + (a.fp ? ' class="bad"' : "") + ">" + a.fp + "</td><td>" + pc(a.tp + a.fn ? a.tp / (a.tp + a.fn) : null) + "</td><td>" + pc(a.tp + a.fp ? a.tp / (a.tp + a.fp) : null) + "</td></tr>";
        }).join("") + "</tbody></table>";
      var rows = '<table class="ps"><thead><tr><th>Satz</th><th>soll</th><th>Chrome</th><th>Vosk</th><th>Vosk frei</th><th>Vosk hörte</th></tr></thead><tbody>' +
        results.map(function (r) {
          var c = function (v, on) { return on === false ? '<td class="n">aus</td>' : '<td class="' + (v === r.soll ? "ok" : "bad") + '">' + v + "</td>"; };
          return "<tr><td>" + SENTENCES[r.i].t + '<br><small class="muted">' + SENTENCES[r.i].how + "</small></td><td>" + r.soll + "</td>" + c(r.chrome, r.chromeOn) +
                 c(r.kws) .replace("</td>", (r.kwsLow ? ' <small class="muted">(+' + r.kwsLow + " unsicher)</small>" : "") + "</td>") + c(r.free) +
                 '<td class="small muted">' + D.esc(r.voskText || "–") + "</td></tr>";
        }).join("") + "</tbody></table>";
      q("result").innerHTML = '<h3 class="small" style="margin:14px 0 0">Ergebnis</h3>' + sum + rows;
    }

    q("start").addEventListener("click", startTest);
    q("next").addEventListener("click", finishSentence);
    q("again").addEventListener("click", again);
    q("stop").addEventListener("click", endTest);
    document.addEventListener("keydown", function (e) {
      if (!active || e.code !== "Space" || /input|textarea|select|button/i.test(e.target.tagName)) return;
      if (root.offsetParent === null) return;   // Tab nicht sichtbar
      e.preventDefault(); finishSentence();
    });
  }

  // ======================= 2) Aufnahme-Test =======================
  function buildFile(root, deps) {
    var D = deps.D;
    root.innerHTML =
      '<p class="small muted" style="margin:0">Lade eine Aufnahme (z. B. Sprachmemo der Vorlesung, mp3/m4a/wav). Vosk wertet sie mit den Einstellungen aus dem Vosk-Test aus ' +
      '(Grammatik, freie Erkennung, Schwelle) – deutlich schneller als Echtzeit. Danach jeden Treffer <b>anhören</b> und bewerten; fehlende Stellen beim Anhören mit ' +
      '„＋ hier wurde es gesagt“ ergänzen. Ideal, um Einstellungen und Modelle an derselben Aufnahme zu vergleichen. Die Datei bleibt auf deinem Rechner.</p>' +
      '<div class="row" style="margin-top:10px"><input type="file" accept="audio/*,video/*" data-a="file" /><button class="primary" data-a="run" disabled>▶ Auswerten</button>' +
      '<span class="small muted" data-a="info"></span></div>' +
      '<div class="ps-prog"><i data-a="bar"></i></div><div class="small muted" data-a="state"></div>' +
      '<audio class="ps-audio" controls data-a="audio" style="display:none"></audio>' +
      '<div class="row" style="margin-top:8px"><button data-a="add" style="display:none">＋ hier wurde es gesagt (aktuelle Abspielposition)</button></div>' +
      '<div data-a="result"></div>';
    var q = function (a) { return root.querySelector('[data-a="' + a + '"]'); };
    var file = null, run = null;   // run: { hits:[{sec, det, conf, text}], verdicts:{key:bool}, added:[sec], dur }

    q("file").addEventListener("change", function () {
      file = this.files[0] || null;
      q("run").disabled = !file;
      if (!file) return;
      q("info").textContent = file.name + " · " + (file.size / 1e6).toFixed(1).replace(".", ",") + " MB";
      var a = q("audio"); a.src = URL.createObjectURL(file); a.style.display = "";
      a.onloadedmetadata = function () {
        q("info").textContent += " · " + mmss(a.duration);
        if (a.duration > 25 * 60) q("state").textContent = "Hinweis: Lange Aufnahmen brauchen viel Arbeitsspeicher beim Entpacken – am besten in Stücke ≤ 20 Min. teilen.";
      };
    });
    q("run").addEventListener("click", function () { if (file) analyse(file); });
    q("add").addEventListener("click", function () {
      if (!run) return;
      var now = q("audio").currentTime;
      // Liegt dort schon ein Vosk-Treffer (±3 s), diesen als „gesagt“ bewerten statt eine zweite Zeile anzulegen
      var near = groupsOf(run).filter(function (g) { return !g.added && Math.abs(g.sec - now) <= 3; })[0];
      if (near) run.verdicts[near.key] = true;
      else run.added.push(now);
      D.note("Aufnahme-Test: als gesagt " + (near ? "bestätigt" : "ergänzt") + " bei " + mmss(now));
      render();
    });

    function setState(t, p) { q("state").textContent = t; if (p != null) q("bar").style.width = Math.round(p * 100) + "%"; }

    // Datei -> 16 kHz mono Int16
    function decode(f) {
      return f.arrayBuffer().then(function (buf) {
        var Ctx = global.AudioContext || global.webkitAudioContext, ctx = new Ctx();
        return ctx.decodeAudioData(buf).then(function (ab) { ctx.close(); return ab; });
      }).then(function (ab) {
        var OAC = global.OfflineAudioContext || global.webkitOfflineAudioContext;
        var len = Math.ceil(ab.duration * 16000), off = new OAC(1, len, 16000);
        var src = off.createBufferSource(); src.buffer = ab; src.connect(off.destination); src.start();
        return off.startRendering();
      }).then(function (rendered) {
        var f32 = rendered.getChannelData(0), out = new Int16Array(f32.length);
        for (var i = 0; i < f32.length; i++) out[i] = Math.max(-32768, Math.min(32767, Math.round(f32[i] * 32767)));
        return { pcm: out, dur: rendered.duration };
      });
    }

    function analyse(f) {
      var c = deps.cfg(), hits = [], v = null, dur = 0;
      q("run").disabled = true;
      setState("entpacke Audio …", 0);
      decode(f).then(function (d) {
        dur = d.dur;
        setState("verbinde mit Vosk …", 0);
        v = AnderStelleVosk.create({ url: c.url, mic: false, grammar: c.grammar, free: c.free, onStatus: function () {}, onMessage: function (m) {
          if (m.type === "ack") setState("Vosk verarbeitet … " + mmss(m.sec) + " / " + mmss(dur), 0.5 + 0.5 * Math.min(1, m.sec / dur));
          if (m.type !== "final") return;
          var text = (m.text || "").replace(/\[unk\]/g, " ").replace(/\s+/g, " ").trim();
          AnderStelleVosk.findHits(m.words).forEach(function (h) { hits.push({ sec: h.start || 0, det: m.rec, conf: m.rec === "kws" ? h.conf : null, text: text }); });
        } });
        v.start();
        return v.whenConnected().then(function () {
          v.reset();
          return v.sendPcm(d.pcm, function (p) { setState("sende Audio an Vosk … " + Math.round(p * 100) + " %", p * 0.5); });
        });
      }).then(function () {
        return new Promise(function (resolve) {
          var prev = v.o.onMessage;
          v.o.onMessage = function (m) { prev(m); if (m.type === "flushed") resolve(); };
          v.flush();
        });
      }).then(function () {
        v.stop();
        hits.sort(function (a, b) { return a.sec - b.sec; });
        run = { name: f.name, dur: dur, hits: hits, verdicts: {}, added: [], cfg: c };
        setState("fertig: " + hits.length + " Treffer in " + mmss(dur), 1);
        D.note("Aufnahme-Test „" + f.name + "“ (" + mmss(dur) + "): " + hits.filter(function (h) { return h.det === "kws"; }).length + " Vosk-Treffer, " +
               hits.filter(function (h) { return h.det === "free"; }).length + " freie Treffer · Grammatik [" + c.grammar.join(" | ") + "]");
        q("add").style.display = "";
        q("run").disabled = false;
        render();
      }).catch(function (e) {
        if (v) v.stop();
        q("run").disabled = false;
        setState("Fehler: " + e.message, 0);
      });
    }

    // Treffer innerhalb von 3 s zu Stellen zusammenfassen
    function groupsOf(r) {
      var thr = deps.cfg().thr, groups = [];
      r.hits.forEach(function (h) {
        var g = groups.length && h.sec - groups[groups.length - 1].sec <= 3 ? groups[groups.length - 1] : null;
        if (!g) { g = { sec: h.sec, kws: 0, kwsLow: 0, free: 0, conf: null, text: h.text }; groups.push(g); }
        if (h.det === "kws") { if (h.conf >= thr) g.kws++; else g.kwsLow++; g.conf = Math.max(g.conf || 0, h.conf); }
        else g.free++;
      });
      r.added.forEach(function (sec) { groups.push({ sec: sec, kws: 0, kwsLow: 0, free: 0, conf: null, text: "", added: true }); });
      groups.sort(function (a, b) { return a.sec - b.sec; });
      groups.forEach(function (g) { g.key = g.added ? "a" + g.sec.toFixed(1) : g.sec.toFixed(1); g.truth = g.added ? true : r.verdicts[g.key]; });
      return groups;
    }
    function render() {
      if (!run) return;
      var groups = groupsOf(run);
      var det = [["kws", "Vosk (sicher)"], ["kwsAll", "Vosk inkl. unsicher"], ["free", "Vosk frei"]], agg = {};
      det.forEach(function (d) { agg[d[0]] = { tp: 0, fn: 0, fp: 0 }; });
      groups.forEach(function (g) {
        if (g.truth == null) return;
        det.forEach(function (d) {
          var n = d[0] === "kwsAll" ? g.kws + g.kwsLow : g[d[0]], a = agg[d[0]];
          if (g.truth) { if (n) { a.tp++; a.fp += n - 1; } else a.fn++; } else a.fp += n;
        });
      });
      var judged = groups.filter(function (g) { return g.truth != null; }).length;
      var html = '<table class="ps"><thead><tr><th>Detektor</th><th>richtig</th><th>verpasst</th><th>Fehlalarm</th><th>Trefferquote</th><th>Genauigkeit</th></tr></thead><tbody>' +
        det.map(function (d) { var a = agg[d[0]];
          return "<tr><td>" + d[1] + '</td><td class="ok">' + a.tp + "</td><td" + (a.fn ? ' class="bad"' : "") + ">" + a.fn + "</td><td" + (a.fp ? ' class="bad"' : "") + ">" + a.fp +
                 "</td><td>" + pc(a.tp + a.fn ? a.tp / (a.tp + a.fn) : null) + "</td><td>" + pc(a.tp + a.fp ? a.tp / (a.tp + a.fp) : null) + "</td></tr>"; }).join("") +
        '<tr><td colspan="6" class="n">' + judged + " von " + groups.length + " Stellen bewertet · Schwelle " + Math.round(deps.cfg().thr * 100) + " % · " + D.esc(run.name) + "</td></tr></tbody></table>";
      html += '<table class="ps"><thead><tr><th>Zeit</th><th>Vosk</th><th>frei</th><th>gehört</th><th></th><th>Wurde gesagt?</th></tr></thead><tbody>' +
        groups.map(function (g) {
          var vk = g.kws ? '<td class="ok">✓ ' + Math.round(g.conf * 100) + " %</td>" : g.kwsLow ? '<td class="n">? ' + Math.round(g.conf * 100) + " %</td>" : '<td class="n">–</td>';
          return "<tr><td>" + mmss(g.sec) + "</td>" + vk + (g.free ? '<td class="ok">✓</td>' : '<td class="n">–</td>') +
            '<td class="small">' + (g.added ? "<i>von dir ergänzt</i>" : D.highlight(g.text.slice(0, 140))) + "</td>" +
            '<td><button data-play="' + g.sec + '" title="3 s davor bis 3 s danach anhören">▶</button></td>' +
            (g.added ? '<td><button data-del="' + g.sec + '" title="Ergänzung entfernen">entfernen</button></td>' :
              '<td><button class="yes' + (g.truth === true ? " on" : "") + '" data-k="' + g.key + '" data-v="1">✓</button> <button class="no' + (g.truth === false ? " on" : "") + '" data-k="' + g.key + '" data-v="0">✗</button></td>') +
            "</tr>";
        }).join("") + "</tbody></table>";
      q("result").innerHTML = html;
    }
    var stopAt = null;
    q("audio").addEventListener("timeupdate", function () { if (stopAt != null && this.currentTime >= stopAt) { this.pause(); stopAt = null; } });
    root.addEventListener("click", function (e) {
      var t = e.target;
      if (!t.getAttribute) return;
      var play = t.getAttribute("data-play"), k = t.getAttribute("data-k"), del = t.getAttribute("data-del");
      if (play != null) { var a = q("audio"); a.currentTime = Math.max(0, +play - 3); stopAt = +play + 4; a.play(); }
      if (k != null) { run.verdicts[k] = t.getAttribute("data-v") === "1"; render(); }
      if (del != null) { run.added = run.added.filter(function (x) { return x !== +del; }); render(); }
    });
    deps.onThresholdChange && deps.onThresholdChange(render);
  }

  global.AnderStelleVoskPruefstand = { mount: mount, SENTENCES: SENTENCES };
})(window);
