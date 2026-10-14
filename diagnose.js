/*
 * Diagnose-Modus für die Spracherkennung (index.html, wal-party.html).
 *
 * Zeigt per Button "🔍 Diagnose" ein Panel mit:
 *   - allem, was Google erkannt hat (alle Alternativen + Konfidenz),
 *     Treffer grün, "Beinahe-Treffer" (z. B. "an dieser Stelle", "Schelle") gelb
 *   - Erkennungs-Starts/-Enden, Fehlern und Lücken (Zeit ohne Erkennung)
 *   - einem Mikrofon-Pegel (nur solange das Panel offen ist)
 *   - Export als .txt, um das Log weiterzugeben
 *
 * Datenschutz: Das Log lebt nur im Arbeitsspeicher. Nichts wird gespeichert,
 * nur der Export lädt bewusst eine Datei herunter.
 */
(function (global) {
  "use strict";

  var MAX_ENTRIES = 1500;
  // Wörter, die auf eine verpasste Phrase hindeuten können
  var NEAR_RE = /st[eä]l|schell|stähl|an dieser|andere[nr]? st|an de[rnm] |stehle/i;

  var matchRe = null;
  var entries = [];          // { t, kind, text, cls }
  var stats = {
    since: null, starts: 0, ends: 0, finals: 0, hits: 0, near: 0,
    gapMs: 0, maxGapMs: 0, errors: {}, sessionMs: []
  };
  var lastEndAt = null, lastStartAt = null;
  var panel, listEl, statsEl, btn, levelBar, levelPeak, levelText;
  var open = false;

  // ---------- Helfer ----------
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function clock(t) { var d = new Date(t); return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()); }
  function secs(ms) { return (ms / 1000).toFixed(1) + " s"; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function countMatches(text) {
    if (!matchRe) return 0;
    matchRe.lastIndex = 0;
    var m = text.match(matchRe);
    return m ? m.length : 0;
  }
  function highlight(text) {
    var safe = esc(text);
    if (!matchRe) return safe;
    matchRe.lastIndex = 0;
    return safe.replace(matchRe, function (m) { return "<mark>" + m + "</mark>"; });
  }

  function add(kind, html, cls, plain) {
    var e = { t: Date.now(), kind: kind, html: html, cls: cls || "", plain: plain || html };
    entries.push(e);
    if (entries.length > MAX_ENTRIES) entries.shift();
    if (open) { appendRow(e); renderStats(); }
  }

  // ---------- Öffentliche Hooks ----------
  var Diag = {
    init: function (opts) {
      matchRe = new RegExp(opts.matchRe.source, opts.matchRe.flags);
      stats.since = Date.now();
      buildUi();
    },

    recStart: function () {
      var now = Date.now();
      stats.starts++;
      lastStartAt = now;
      if (lastEndAt) {
        var gap = now - lastEndAt;
        stats.gapMs += gap; stats.maxGapMs = Math.max(stats.maxGapMs, gap);
        add("start", "▶ Erkennung läuft wieder (Lücke " + secs(gap) + ")", gap > 2000 ? "warn" : "sys");
        lastEndAt = null;
      } else {
        add("start", "▶ Erkennung gestartet", "sys");
      }
    },

    recEnd: function (userStopped) {
      var now = Date.now();
      stats.ends++;
      var dur = lastStartAt ? now - lastStartAt : 0;
      if (dur) stats.sessionMs.push(dur);
      add("end", "■ Erkennung beendet nach " + secs(dur) + (userStopped ? " (gestoppt)" : " – Chrome hat beendet, Neustart …"),
          userStopped ? "sys" : "warn");
      lastEndAt = userStopped ? null : now;
    },

    error: function (type) {
      stats.errors[type] = (stats.errors[type] || 0) + 1;
      var hint = {
        "no-speech": "Chrome hört gerade keine Sprache (zu leise/zu weit weg?)",
        "network": "Netzwerk-Problem – Audio kommt nicht bei Google an",
        "audio-capture": "Kein Mikrofon",
        "not-allowed": "Mikrofon verweigert",
        "aborted": "abgebrochen"
      }[type] || "";
      add("error", "⚠ Fehler: " + esc(type) + (hint ? " – " + hint : ""), type === "no-speech" || type === "aborted" ? "sys" : "err");
    },

    note: function (text) { add("note", esc(text), "sys"); },

    // SpeechRecognitionResult (final) übergeben
    final: function (result, countedN) {
      stats.finals++;
      var alts = [];
      for (var a = 0; a < result.length; a++) alts.push({ text: result[a].transcript.trim(), conf: result[a].confidence });
      var anyHit = false, near = false;
      var html = alts.map(function (al, idx) {
        var n = countMatches(al.text);
        if (n) anyHit = true;
        else if (NEAR_RE.test(al.text)) near = true;
        var conf = al.conf ? " <small>(" + Math.round(al.conf * 100) + "%)</small>" : "";
        return (idx ? "<span class=\"alt\">alt " + idx + ": </span>" : "") + highlight(al.text || "(leer)") + conf;
      }).join("<br>");
      var plain = alts.map(function (al, idx) {
        return (idx ? "    alt " + idx + ": " : "") + al.text + (al.conf ? " (" + Math.round(al.conf * 100) + "%)" : "");
      }).join("\n");
      var cls = "final";
      if (countedN > 0) { cls = "hit"; stats.hits += countedN; html = "✅ " + html; plain = "[TREFFER x" + countedN + "] " + plain; }
      else if (near) { cls = "near"; stats.near++; html = "🤔 Beinahe? " + html; plain = "[BEINAHE?] " + plain; }
      add("final", html, cls, esc(plain));
    }
  };

  // ---------- UI ----------
  function buildUi() {
    var css = document.createElement("style");
    css.textContent = [
      "#diag-btn{position:fixed;left:12px;bottom:12px;z-index:90;font:600 13px/1 -apple-system,system-ui,sans-serif;",
      "padding:9px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(2,27,46,.85);color:#eafcff;cursor:pointer;box-shadow:none}",
      "#diag-btn:hover{filter:brightness(1.2)}",
      "#diag{position:fixed;left:12px;bottom:56px;z-index:90;width:min(560px,calc(100vw - 24px));height:min(70vh,640px);display:none;flex-direction:column;",
      "background:rgba(2,20,34,.96);color:#eafcff;border:1px solid rgba(255,255,255,.18);border-radius:14px;",
      "font:13px/1.45 -apple-system,system-ui,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.5);overflow:hidden}",
      "#diag.on{display:flex}",
      "#diag header{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.1)}",
      "#diag header b{flex:1;font-size:14px}",
      "#diag button{font:600 12px/1 inherit;padding:7px 10px;border-radius:8px;border:none;cursor:pointer;background:rgba(255,255,255,.12);color:#eafcff;box-shadow:none}",
      "#diag .level{padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.1)}",
      "#diag .meter{position:relative;height:10px;border-radius:5px;background:rgba(255,255,255,.1);overflow:hidden;margin-top:4px}",
      "#diag .meter i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#51cf66,#ffd166 70%,#ff6b6b);width:0}",
      "#diag .meter s{position:absolute;top:0;bottom:0;width:2px;background:#fff;left:0}",
      "#diag .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.1)}",
      "#diag .stats div{background:rgba(255,255,255,.06);border-radius:8px;padding:5px 7px}",
      "#diag .stats b{display:block;font-size:15px;color:#5ff0d8}",
      "#diag .stats span{font-size:10.5px;color:#9fd3e0;text-transform:uppercase;letter-spacing:.5px}",
      "#diag .tip{padding:7px 12px;font-size:11.5px;color:#9fd3e0;border-bottom:1px solid rgba(255,255,255,.1)}",
      "#diag ol{list-style:none;margin:0;padding:6px 8px;overflow-y:auto;flex:1}",
      "#diag li{padding:5px 7px;border-radius:7px;margin-bottom:3px;word-break:break-word}",
      "#diag li time{color:#9fd3e0;font-variant-numeric:tabular-nums;margin-right:6px}",
      "#diag li.sys{color:#9fd3e0}",
      "#diag li.warn{background:rgba(255,209,102,.1);color:#ffd166}",
      "#diag li.err{background:rgba(255,107,107,.15);color:#ff9b9b}",
      "#diag li.hit{background:rgba(81,207,102,.15)}",
      "#diag li.near{background:rgba(255,209,102,.16)}",
      "#diag li .alt{color:#9fd3e0;font-size:11.5px}",
      "#diag li small{color:#9fd3e0}",
      "#diag mark{background:#51cf66;color:#032;border-radius:4px;padding:0 3px;font-weight:700}",
      "@media (max-width:520px){#diag .stats{grid-template-columns:repeat(2,1fr)}}"
    ].join("");
    document.head.appendChild(css);

    btn = document.createElement("button");
    btn.id = "diag-btn";
    btn.textContent = "🔍 Diagnose";
    btn.title = "Zeigt, was die Spracherkennung versteht";
    document.body.appendChild(btn);

    panel = document.createElement("div");
    panel.id = "diag";
    panel.innerHTML =
      '<header><b>🔍 Diagnose Spracherkennung</b>' +
      '<button data-a="export" title="Log als Textdatei herunterladen">⬇ Export</button>' +
      '<button data-a="clear">Leeren</button><button data-a="close">✕</button></header>' +
      '<div class="level">Mikrofon-Pegel <span class="lv-text">(startet beim Öffnen …)</span>' +
      '<div class="meter"><i></i><s></s></div></div>' +
      '<div class="stats"></div>' +
      '<div class="tip">Mac-Tipp: Während Chrome das Mikro nutzt, im Kontrollzentrum „Mikrofonmodus“ auf ' +
      '<b>Standard</b> oder <b>Breites Spektrum</b> stellen – „Sprachisolierung“ filtert entfernte Sprecher weg. ' +
      'Das Log wird nicht gespeichert.</div>' +
      '<ol></ol>';
    document.body.appendChild(panel);

    listEl = panel.querySelector("ol");
    statsEl = panel.querySelector(".stats");
    levelBar = panel.querySelector(".meter i");
    levelPeak = panel.querySelector(".meter s");
    levelText = panel.querySelector(".lv-text");

    btn.addEventListener("click", function () { setOpen(!open); });
    panel.addEventListener("click", function (e) {
      var a = e.target.getAttribute && e.target.getAttribute("data-a");
      if (a === "close") setOpen(false);
      else if (a === "clear") { entries = []; listEl.innerHTML = ""; }
      else if (a === "export") exportLog();
    });
    setInterval(function () { if (open) renderStats(); }, 1000);
  }

  function setOpen(v) {
    open = v;
    panel.classList.toggle("on", v);
    if (v) {
      listEl.innerHTML = "";
      entries.forEach(appendRow);
      renderStats();
      startMeter();
    } else {
      stopMeter();
    }
  }

  function appendRow(e) {
    var li = document.createElement("li");
    li.className = e.cls;
    li.innerHTML = "<time>" + clock(e.t) + "</time>" + e.html;
    var atBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 40;
    listEl.appendChild(li);
    while (listEl.children.length > MAX_ENTRIES) listEl.removeChild(listEl.firstChild);
    if (atBottom) listEl.scrollTop = listEl.scrollHeight;
  }

  function currentGap() { return lastEndAt ? Date.now() - lastEndAt : 0; }

  function renderStats() {
    var run = Date.now() - stats.since;
    var gap = stats.gapMs + currentGap();
    var avgSess = stats.sessionMs.length
      ? stats.sessionMs.reduce(function (a, b) { return a + b; }, 0) / stats.sessionMs.length : 0;
    var errs = Object.keys(stats.errors).filter(function (k) { return k !== "no-speech" && k !== "aborted"; })
      .reduce(function (s, k) { return s + stats.errors[k]; }, 0);
    var cells = [
      [stats.finals, "Sätze erkannt"],
      [stats.hits, "Treffer"],
      [stats.near, "Beinahe-Treffer"],
      [stats.starts ? stats.starts - 1 : 0, "Neustarts"],
      [secs(gap), "Lücken gesamt"],
      [run ? (gap / run * 100).toFixed(1) + " %" : "–", "Zeit ohne Erkennung"],
      [avgSess ? secs(avgSess) : "–", "Ø Laufzeit am Stück"],
      [errs + " / " + (stats.errors["no-speech"] || 0), "Fehler / Stille"]
    ];
    statsEl.innerHTML = cells.map(function (c) { return "<div><b>" + c[0] + "</b><span>" + c[1] + "</span></div>"; }).join("");
  }

  // ---------- Mikrofon-Pegel ----------
  var meter = null;
  function startMeter() {
    if (meter || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    meter = { stopped: false };
    var m = meter;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      if (m.stopped) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
      var Ctx = global.AudioContext || global.webkitAudioContext;
      m.stream = stream;
      m.ctx = new Ctx();
      var src = m.ctx.createMediaStreamSource(stream);
      var an = m.ctx.createAnalyser();
      an.fftSize = 1024;
      src.connect(an);
      var buf = new Float32Array(an.fftSize), peak = 0, peakAt = 0;
      var label = stream.getAudioTracks()[0] ? stream.getAudioTracks()[0].label : "";
      (function loop() {
        if (m.stopped) return;
        an.getFloatTimeDomainData(buf);
        var sum = 0;
        for (var i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        var db = 20 * Math.log10(Math.sqrt(sum / buf.length) || 1e-8);   // ca. -100 … 0 dB
        var pct = Math.max(0, Math.min(100, (db + 70) / 70 * 100));
        var now = performance.now();
        if (pct > peak || now - peakAt > 1500) { peak = pct; peakAt = now; }
        levelBar.style.width = pct + "%";
        levelPeak.style.left = peak + "%";
        levelText.textContent = Math.round(db) + " dB" + (label ? " · " + label : "");
        requestAnimationFrame(loop);
      })();
    }).catch(function (e) {
      levelText.textContent = "(kein Zugriff: " + e.name + ")";
      meter = null;
    });
  }
  function stopMeter() {
    if (!meter) return;
    meter.stopped = true;
    if (meter.stream) meter.stream.getTracks().forEach(function (t) { t.stop(); });
    if (meter.ctx) meter.ctx.close();
    meter = null;
  }

  // ---------- Export ----------
  function exportLog() {
    renderStats();
    var head = [
      "Diagnose „an der Stelle“ – " + new Date().toLocaleString("de-DE"),
      "Seite: " + location.pathname.split("/").pop(),
      "Browser: " + navigator.userAgent,
      "Statistik: " + Array.prototype.map.call(statsEl.children, function (d) {
        return d.querySelector("span").textContent + " = " + d.querySelector("b").textContent;
      }).join(" | "),
      "Fehler: " + JSON.stringify(stats.errors),
      ""
    ];
    var lines = entries.map(function (e) {
      var tmp = document.createElement("div");
      tmp.innerHTML = e.plain;
      return clock(e.t) + "  " + (tmp.textContent || tmp.innerText || "");
    });
    var blob = new Blob([head.concat(lines).join("\n")], { type: "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "diagnose-" + new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-") + ".txt";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  global.AnderStelleDiag = Diag;
})(window);
