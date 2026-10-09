/*
 * Meme-Fortschrittsbalken für countdown.html – absichtlich nervig.
 *
 *   MemeBar.mount(element, { speed })   einbauen
 *   MemeBar.update(pct, remainingSec, totalSec)   (pct als Kommazahl 0..100)
 *   MemeBar.hit()                        „an der Stelle“ gehört
 *
 * Der Balken wechselt alle paar Minuten sein Kostüm (Skin) und spielt
 * zwischendurch Streiche (läuft rückwärts, springt auf 99 %, friert ein …).
 * Die echte Prozentzahl steht weiterhin oben in „Geschafft: x %“.
 */
(function (global) {
  "use strict";

  function rnd(a) { return a[(Math.random() * a.length) | 0]; }
  function rint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function de(n, d) { return n.toLocaleString("de-DE", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function mmss(sec) { sec = Math.max(0, Math.round(sec)); var h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
                       return (h ? h + ":" + pad(m) : m) + ":" + pad(s); }

  // ---------------- CSS ----------------
  var CSS = [
    ".mb{width:min(760px,92vw);margin-top:6px;user-select:none;cursor:pointer;position:relative}",
    ".mb-head,.mb-foot{display:flex;justify-content:space-between;gap:10px;font-size:.9rem;font-weight:700;min-height:1.4em}",
    ".mb-head{margin-bottom:6px}.mb-foot{margin-top:6px;color:#9fd3e0;font-weight:600;font-size:.85rem}",
    ".mb-eta{color:#9fd3e0;font-weight:600;text-align:right;white-space:nowrap}",
    ".mb-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".mb-wrap{position:relative;padding:18px 34px 0 0;transition:transform .5s cubic-bezier(.3,1.6,.4,1)}",
    ".mb-bar{position:relative;height:24px;border-radius:12px;background:rgba(255,255,255,.12);overflow:hidden}",
    ".mb-fill,.mb-buf,.mb-lag{position:absolute;left:0;top:0;bottom:0;width:0}",
    ".mb-fill{background:linear-gradient(90deg,#2e7dff,#5ff0d8);transition:width .4s ease}",
    ".mb-buf{background:rgba(255,255,255,.18);transition:width .8s ease;display:none}",
    ".mb-lag{background:#ffd166;transition:width 1.4s ease .5s;display:none}",
    ".mb-knob{position:absolute;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:#ff0033;display:none;transition:left .4s ease;z-index:2}",
    ".mb-whale{position:absolute;top:-6px;font-size:1.8rem;transform:translateX(-50%) scaleX(-1);transition:left .4s ease,transform .4s ease;filter:drop-shadow(0 3px 6px rgba(0,0,0,.4));z-index:3}",
    ".mb-goal{position:absolute;right:0;top:4px;font-size:1.7rem}",
    ".mb-deco{position:absolute;left:0;top:-4px;font-size:1.1rem;display:none}",
    ".mb-ad{position:absolute;inset:18px 34px 0 0;border-radius:12px;background:#111;color:#fff;display:none;align-items:center;justify-content:space-between;",
    "padding:0 10px;font-size:.78rem;font-weight:700;z-index:4;gap:8px}",
    ".mb-ad b{color:#ffd166}.mb-ad span:last-child{background:rgba(255,255,255,.18);padding:3px 8px;border-radius:4px;white-space:nowrap}",
    ".mb.on-ad .mb-ad{display:flex}",
    ".mb-pop{position:absolute;font-weight:900;pointer-events:none;animation:mbPop 1.3s ease-out forwards;white-space:nowrap;z-index:5;text-shadow:0 2px 0 rgba(0,0,0,.4)}",
    "@keyframes mbPop{0%{transform:translateY(0) scale(.6);opacity:0}15%{opacity:1;transform:translateY(-6px) scale(1.2)}100%{transform:translateY(-46px) scale(1);opacity:0}}",
    // Gags
    ".mb.frozen .mb-wrap{filter:grayscale(1) brightness(.75)}",
    ".mb.frozen .mb-title::after{content:' (Keine Rückmeldung)';color:#ff9b9b}",
    ".mb.tiny .mb-wrap{transform:scaleX(.3)}",
    ".mb.rtl .mb-bar{transform:scaleX(-1)}",
    ".mb.back .mb-whale{transform:translateX(-50%) scaleX(1)}",
    ".mb.shake .mb-wrap{animation:mbShake .1s linear 8}",
    "@keyframes mbShake{25%{transform:translate(-5px,2px)}75%{transform:translate(5px,-2px)}}",
    // Skin: Windows XP
    ".skin-xp .mb-bar{background:#fff;border:2px solid #9ab;border-radius:4px;height:22px;padding:2px}",
    ".skin-xp .mb-fill{top:2px;bottom:2px;left:2px;background:repeating-linear-gradient(90deg,#3c3 0 10px,transparent 10px 13px);",
    "box-shadow:none;border-radius:0;transition:width .4s steps(4)}",
    ".skin-xp .mb-deco{display:block;animation:mbFly 1.6s linear infinite}",
    "@keyframes mbFly{0%{transform:translateX(0)}100%{transform:translateX(70px);opacity:0}}",
    // Skin: YouTube
    ".skin-yt .mb-bar{height:6px;border-radius:0;margin-top:9px;overflow:visible}",
    ".skin-yt .mb-fill{background:#ff0033}.skin-yt .mb-buf,.skin-yt .mb-knob{display:block}",
    // Skin: Boss
    ".skin-boss .mb-bar{height:22px;border-radius:3px;border:2px solid #e8c37b;background:#2a0b0b}",
    ".skin-boss .mb-fill{background:linear-gradient(#ff5050,#a10000)}.skin-boss .mb-lag{display:block}",
    ".skin-boss .mb-title{color:#ffb3b3;letter-spacing:1px;text-transform:uppercase}",
    // Skin: Pokémon
    ".skin-poke .mb-bar{height:12px;border-radius:6px;border:3px solid #333;background:#555;margin-top:6px}",
    ".skin-poke .mb-fill{background:#3ddc4b;transition:width .6s ease,background .4s}",
    ".skin-poke.mid .mb-fill{background:#f2c400}.skin-poke.low .mb-fill{background:#ef3b2c}",
    // Skin: Akku
    ".skin-battery .mb-bar{height:30px;border-radius:7px;border:3px solid #eafcff;background:transparent;padding:3px;overflow:visible}",
    ".skin-battery .mb-bar::after{content:'';position:absolute;right:-9px;top:7px;width:5px;height:10px;border-radius:0 3px 3px 0;background:#eafcff}",
    ".skin-battery .mb-fill{top:3px;bottom:3px;left:3px;border-radius:3px;background:#51cf66}",
    ".skin-battery.low .mb-fill{background:#ff3b30;animation:mbBlink 1s steps(1) infinite}",
    "@keyframes mbBlink{50%{opacity:.35}}",
    // Skin: Download
    ".skin-download .mb-bar{height:14px;border-radius:7px}",
    ".skin-download .mb-fill{background:linear-gradient(90deg,#1a73e8,#4fa3ff)}",
    // Skin: Mac
    ".skin-mac .mb-bar{height:12px;border-radius:6px;background:#d8d8d8}",
    ".skin-mac .mb-fill{background:repeating-linear-gradient(-45deg,#2f7bf5 0 10px,#6aa6ff 10px 20px);background-size:28px 28px;animation:mbStripes .8s linear infinite}",
    "@keyframes mbStripes{to{background-position:28px 0}}",
    ".skin-mac .mb-deco{display:block;width:22px;height:22px;border-radius:50%;top:-6px;left:auto;right:40px;",
    "background:conic-gradient(#ff3b30,#ff9500,#ffcc00,#34c759,#007aff,#af52de,#ff3b30);animation:mbSpin .9s linear infinite}",
    "@keyframes mbSpin{to{transform:rotate(360deg)}}",
    // Skin: Spiel-Ladebildschirm
    ".skin-game .mb-bar{height:20px;border-radius:0;border:3px solid #fff;background:#000;image-rendering:pixelated}",
    ".skin-game .mb-fill{background:repeating-linear-gradient(90deg,#ffd166 0 14px,#ff9f1c 14px 16px);transition:width .4s steps(6)}",
    ".skin-game .mb-head,.skin-game .mb-foot{font-family:'Courier New',monospace;text-transform:uppercase}",
    "@media (prefers-reduced-motion:reduce){.mb *{animation:none!important}}"
  ].join("");

  // ---------------- Texte ----------------
  var ETAS = ["3 Tage", "12 Sekunden", "4 Jahre", "∞", "eine Folie", "bis die Mensa zumacht", "Ja", "42 Sekunden",
              "ca. 2 Std. (Windows-Schätzung)", "unbekannt", "−5 Min.", "1 Semester", "gleich™", "noch eine Frage",
              "π Minuten", "so lange wie ein Wal-Seufzer", "67 Minuten", "keine Ahnung, frag den Dozenten"];
  var GAME_TIPS = [
    "Tipp: Kaffee regeneriert 20 % Konzentration.", "Tipp: Nicken signalisiert Verständnis.",
    "Tipp: Der Dozent sieht dich. Vielleicht.", "Tipp: Alt+F4 beendet die Vorlesung (nicht).",
    "Tipp: Fenster-Gucken zählt als Pause.", "Tipp: Mitschreiben verdoppelt die gefühlte Zeit.",
    "Tipp: Wale schlafen mit einer Gehirnhälfte. Du auch.", "Tipp: „An der Stelle“ ist kein Ort, sondern ein Gefühl.",
    "Tipp: Wer zuerst einpackt, verliert.", "Tipp: Die Uhr hinten im Saal geht 3 Minuten nach."
  ];
  var POKE_LINES = [
    "PROF. setzt FOLIE ein! Es ist nicht sehr effektiv …", "Du setzt GÄHNEN ein!", "PROF. setzt ÜBERZIEHEN ein! Es ist sehr effektiv!",
    "Du kannst nicht fliehen!", "PROF. setzt WIE GESAGT ein! Es wiederholt sich …", "Du setzt HANDY CHECKEN ein! Konzentration sinkt!",
    "PROF. setzt KLAUSURRELEVANT ein! Alle sind wach!", "Wilder KOMMILITONE stellt eine Frage! Kampf verlängert sich!"
  ];
  var XP_STATUS = ["Von: Hörsaal 1 · Nach: Freiheit", "Kopiere „Wissen.docx“ (1 von 8.214)", "Kopiere „Langeweile.tmp“ (68 GB)",
                   "Verschiebe Motivation in den Papierkorb …", "Überspringe „Pause.exe“ (Datei nicht gefunden)"];
  var MAC_STATUS = ["Vorlesung wird vorbereitet …", "Optimiere Hörsaal-Speicher …", "Indiziere Folien (Spotlight)",
                    "Warte auf iCloud …", "Neustart erforderlich (ignoriert)"];
  var DL_STATUS = ["Verbindung zum Hörsaal wird hergestellt …", "Server antwortet langsam (Beamer)", "Prüfe auf Viren: 1 gefunden (Langeweile)",
                   "Fortsetzen nach Unterbrechung …", "Download nur über eduroam möglich"];
  var BATTERY_STATUS = ["Geduld wird entladen", "Hintergrund-Apps: Tagträume (34 %)", "Optimiertes Laden: Ladung bis 18 Uhr pausiert",
                        "Akku-Zustand: Normal (gelogen)"];
  var YT_STATUS = ["1,2 Mio. Aufrufe · vor 0 Sekunden", "👍 67  👎 1.337", "Nächstes Video: „Noch mehr Vorlesung (4 Std.)“",
                   "Kommentar: „wer guckt das 2026 noch 💀“"];
  var ADS = ["🐳 WalCoin – jetzt investieren!", "Lerne Latein in 3 Tagen (Wale hassen diesen Trick)",
             "Mensa-Premium: Pommes ohne Warten", "Ein Dozent in deiner Nähe will reden", "Raid: Shadow Folien – jetzt gratis spielen"];

  // Skins: Titel, Fußzeile, Prozent-Darstellung
  var SKINS = {
    xp:       { title: function () { return "📁 Vorlesung wird kopiert …"; }, foot: function () { return rnd(XP_STATUS); }, deco: "📄" },
    yt:       { title: function () { return "▶ vorlesung_live_FINAL.mp4"; },
                foot: function (st) { return mmss(st.total - st.R) + " / " + mmss(st.total) + " · " + rnd(YT_STATUS); }, pctHidden: true },
    boss:     { title: function () { return "👹 Dozent – Endgegner · Lv. 99"; },
                foot: function (st) { return "HP " + de(Math.max(0, st.R)) + " / " + de(Math.round(st.total)) + " · Schwachstelle: Mittagspause"; }, inverse: true },
    poke:     { title: function () { return "Ein wilder PROF. (Lv. 67) erscheint!"; }, foot: function () { return rnd(POKE_LINES); },
                inverse: true, pctText: function (st) { return "KP " + Math.ceil(Math.max(0, st.R) / 60) + "/" + Math.round(st.total / 60); } },
    battery:  { title: function () { return "🔋 Geduld"; }, foot: function () { return rnd(BATTERY_STATUS); }, inverse: true },
    download: { title: function () { return "⬇ vorlesung_FINAL_final_v3(2).zip"; },
                foot: function () { return rnd(DL_STATUS); },
                pctText: function (st, p) { return de(p, 0) + " % · " + dlSpeed; } },
    mac:      { title: function () { return "Vorlesung.app"; }, foot: function () { return rnd(MAC_STATUS); }, deco: " " },
    game:     { title: function () { return "LÄDT …"; }, foot: function () { return rnd(GAME_TIPS); } }
  };
  var SKIN_NAMES = Object.keys(SKINS);

  // ---------------- Zustand ----------------
  var root, el = {}, speed = 1;
  var st = { pct: 0, R: null, total: 1 };   // R = null bis zum ersten update()
  var skin = null, gag = null, gagUntil = 0, gagData = {};
  var dlSpeed = "14 KB/s";
  var etaText = "", footText = "", lastEtaAt = 0, lastFootAt = 0, lastMinute = null;

  function $(cls) { return root.querySelector("." + cls); }

  function mount(container, opts) {
    speed = (opts && opts.speed) || 1;
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    root = document.createElement("div");
    root.className = "mb";
    root.title = "Klicken für einen neuen Balken (bringt nichts)";
    root.innerHTML =
      '<div class="mb-head"><span class="mb-title"></span><span class="mb-eta"></span></div>' +
      '<div class="mb-wrap"><div class="mb-deco"></div>' +
      '<div class="mb-bar"><div class="mb-buf"></div><div class="mb-lag"></div><div class="mb-fill"></div><div class="mb-knob"></div></div>' +
      '<div class="mb-whale">🐳</div><div class="mb-goal">🏝️</div>' +
      '<div class="mb-ad"><span></span><span></span></div></div>' +
      '<div class="mb-foot"><span class="mb-pct"></span><span class="mb-status"></span></div>';
    container.appendChild(root);
    ["mb-title", "mb-eta", "mb-wrap", "mb-deco", "mb-bar", "mb-buf", "mb-lag", "mb-fill", "mb-knob", "mb-whale", "mb-ad", "mb-pct", "mb-status"]
      .forEach(function (c) { el[c.slice(3)] = $(c); });

    root.addEventListener("click", function () {
      setSkin(nextSkin());
      pop(rnd(["Bitte nicht klicken.", "Das macht es nicht schneller.", "Klick registriert. Ignoriert.", "+0 % 🙃"]), "#ffd166");
    });
    setSkin(rnd(SKIN_NAMES));
    setInterval(function () { setSkin(nextSkin()); }, 150000 / speed);   // alle 2,5 Min. neues Kostüm
    scheduleGag();
    scheduleAd();
  }

  function nextSkin() {
    var others = SKIN_NAMES.filter(function (n) { return n !== skin; });
    return rnd(others);
  }
  function setSkin(name) {
    if (skin) root.classList.remove("skin-" + skin);
    skin = name;
    root.classList.add("skin-" + skin);
    root.classList.remove("on-ad");
    el.deco.textContent = SKINS[skin].deco || "";
    lastFootAt = 0;
    render();
  }

  // ---------------- Streiche ----------------
  var GAGS = {
    back:      { ms: 3500, start: function () { gagData.off = rint(6, 18); root.classList.add("back"); status("⏪ Fortschritt wird rückgängig gemacht …"); },
                 end: function () { root.classList.remove("back"); } },
    fake99:    { ms: 2400, start: function () { status("Fast fertig! 🎉"); },
                 end: function () { pop("War nur Spaß 🙃", "#ff9b9b"); } },
    freeze:    { ms: 6000, start: function () { gagData.frozen = st.pct; root.classList.add("frozen"); },
                 end: function () { root.classList.remove("frozen"); root.classList.add("shake"); setTimeout(function () { root.classList.remove("shake"); }, 900); } },
    precision: { ms: 6000, start: function () {} },
    bananas:   { ms: 5000, start: function () {} },
    tiny:      { ms: 3500, start: function () { root.classList.add("tiny"); status("🔋 Stromsparmodus: Balken verkleinert"); },
                 end: function () { root.classList.remove("tiny"); } },
    rtl:       { ms: 4500, start: function () { root.classList.add("rtl"); status("Fortschritt jetzt von rechts nach links (neue EU-Norm)"); },
                 end: function () { root.classList.remove("rtl"); } },
    turbo:     { ms: 2500, start: function () { status("🚀 TURBO-MODUS aktiviert"); },
                 end: function () { status("Turbo-Modus abgelaufen. Bitte kostenpflichtig verlängern."); } }
  };
  var GAG_NAMES = Object.keys(GAGS);

  function scheduleGag() {
    setTimeout(function () {
      if (!gag && st.R > 0) {
        gag = rnd(GAG_NAMES);
        gagUntil = Date.now() + GAGS[gag].ms;
        gagData = {};
        GAGS[gag].start();
        render();
      }
      scheduleGag();
    }, rint(20, 50) * 1000 / speed);
  }
  function endGag() {
    var g = GAGS[gag];
    gag = null;
    if (g.end) g.end();
  }

  // YouTube-Werbung, die man nicht überspringen kann
  function scheduleAd() {
    setTimeout(function () {
      if (skin === "yt" && !gag) runAd();
      scheduleAd();
    }, rint(25, 45) * 1000 / speed);
  }
  function runAd() {
    var n = 5, spans = el.ad.children;
    spans[0].innerHTML = "<b>Werbung</b> · " + rnd(ADS);
    root.classList.add("on-ad");
    (function step() {
      if (skin !== "yt") { root.classList.remove("on-ad"); return; }
      if (n > 0) { spans[1].textContent = "Überspringen in " + n; n--; setTimeout(step, 1000); }
      else if (n === 0) { spans[1].textContent = "Überspringen ▶"; n--; setTimeout(step, 1300); }
      else { spans[1].textContent = "Werbung 2 von 3 🙃"; setTimeout(function () { root.classList.remove("on-ad"); }, 2200); }
    })();
  }

  // ---------------- Anzeige ----------------
  function status(text) { footText = text; lastFootAt = Date.now() + 4000; }   // 4 s festhalten

  function shownPct() {
    var p = st.pct;
    if (gag === "back") p = Math.max(0, p - gagData.off);
    else if (gag === "fake99") p = 99.4;
    else if (gag === "freeze") p = gagData.frozen;
    else if (gag === "turbo") p = Math.min(100, p + (1 - (gagUntil - Date.now()) / GAGS.turbo.ms) * 30);
    return p;
  }

  function pctLabel(p) {
    var S = SKINS[skin];
    if (gag === "precision") return de(p + Math.random() * 1e-7, 9) + " %";
    if (gag === "bananas") return de(p, 0) + " % ≈ " + de(p * 0.67, 1) + " Bananen 🍌";
    if (S.pctText) return S.pctText(st, p);
    var shown = S.inverse ? 100 - p : p;
    var r = Math.floor(shown);
    var extra = r === 67 ? " 🫴🫳" : r === 69 ? " (nice)" : r === 42 ? " (die Antwort)" : r >= 99 && !S.inverse ? " … gleich™" : "";
    return de(shown, skin === "game" ? 0 : 1) + " %" + extra;
  }

  function render() {
    if (!root || st.R === null) return;
    if (gag && Date.now() > gagUntil) endGag();
    var S = SKINS[skin], now = Date.now();
    var p = shownPct();
    var barP = S.inverse ? 100 - p : p;

    el.fill.style.width = barP + "%";
    el.lag.style.width = barP + "%";
    el.knob.style.left = barP + "%";
    el.buf.style.width = Math.min(100, barP + 4 + (now / 700 % 9)) + "%";
    el.whale.style.left = "calc(" + p + "% * 0.95)";
    el.title.textContent = S.title(st);
    el.pct.textContent = S.pctHidden && !gag ? "" : pctLabel(p);

    root.classList.toggle("low", S.inverse && barP < 20);
    root.classList.toggle("mid", S.inverse && barP >= 20 && barP < 50);

    if (now - lastEtaAt > 3500) {
      lastEtaAt = now;
      dlSpeed = rnd(["0,3 KB/s", "14 KB/s", "1,2 GB/s", "56k-Modem", "−3 KB/s", "2 Brieftauben/s", "1 Diskette/Std."]);
      etaText = Math.random() < 0.35 ? "Restzeit: " + Math.ceil(Math.max(0, st.R) / 60) + " Min." : "Restzeit: " + rnd(ETAS);
    }
    el.eta.textContent = st.R <= 0 ? "Restzeit: −∞ (Überziehung)" : etaText;

    if (now > lastFootAt + 5000) { lastFootAt = now; footText = S.foot(st); }
    if (gag === "freeze") el.status.textContent = "Windows sucht nach einer Lösung …";
    else el.status.textContent = footText;
  }

  function pop(text, color) {
    if (!root) return;
    var d = document.createElement("div");
    d.className = "mb-pop";
    d.textContent = text;
    d.style.left = Math.min(70, Math.max(5, st.pct)) + "%";
    d.style.top = "0";
    d.style.color = color || "#fff";
    root.appendChild(d);
    setTimeout(function () { d.remove(); }, 1400);
  }

  function update(pct, R, total) {
    st.pct = Math.max(0, Math.min(100, pct)); st.R = R; st.total = total;
    var m = Math.floor(Math.max(0, R) / 60);
    if (lastMinute !== null && m !== lastMinute && R > 0) {
      // jede Minute ein kleiner Schadens-/Fortschritts-Popup
      if (skin === "boss") pop("−60 HP", "#ff6b6b");
      else if (skin === "poke") pop("Es ist nicht sehr effektiv …", "#ffd166");
      else if (skin === "battery") pop("−1 % Geduld", "#ff9b9b");
      else pop("+" + de(100 / Math.max(1, total / 60), 1) + " %", "#5ff0d8");
    }
    lastMinute = m;
    render();
  }

  function hit() {
    if (skin === "boss") { pop("KRITISCHER TREFFER! −999 🐳", "#ffd166"); root.classList.add("shake"); setTimeout(function () { root.classList.remove("shake"); }, 900); }
    else if (skin === "poke") { status("„AN DER STELLE“! Volltreffer! 🐳"); pop("Volltreffer!", "#ffd166"); }
    else pop("+🐳", "#5ff0d8");
  }

  global.MemeBar = { mount: mount, update: update, hit: hit, setSkin: function (n) { setSkin(n); }, skins: SKIN_NAMES,
                     gag: function (n) { gag = n; gagUntil = Date.now() + GAGS[n].ms; gagData = {}; GAGS[n].start(); render(); }, gags: GAG_NAMES };
})(window);
