/*
 * Minigames für countdown.html (lautlos, für die Vorlesung).
 *
 *   MiniGames.mount({ speed, say, toast })   Button + Fenster einbauen
 *   MiniGames.update(remainingSec)           jede Tick-Runde (für das Orakel)
 *   MiniGames.hit()                          „an der Stelle“ gehört (Bingo + Orakel)
 *
 * Spiele: Dozenten-Bingo, Flappy Wal, Whack-a-Wal, Six-Seven-Reaktion, Brainrot-Memory,
 * Wal-2048, Klausur-Minesweeper, Wal-Snake, Wal-Subway-Surfer, Mitschreib-Simulator, Aura-Clicker,
 * Tic-Tac-Toe gegen den Dozenten, Orakel.
 *
 * Den „an der Stelle“-Zähler (localStorage "anderstelle.count") liest das Modul auf jeder Seite selbst mit.
 * Jeder Treffer zählt nur einmal, auch wenn mehrere Tabs offen sind (data.lastCount). Ändert ein
 * anderer Tab die Spieldaten, lädt dieser Tab sie per storage-Event neu, damit nichts überschrieben wird.
 * Direkt öffnen: Seite mit #minigames in der Adresse aufrufen. Rekorde liegen in localStorage ("anderstelle.minigames").
 */
(function (global) {
  "use strict";

  var STORE = "anderstelle.minigames";
  function rnd(a) { return a[(Math.random() * a.length) | 0]; }
  function rint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0, t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function de(n) { return n.toLocaleString("de-DE"); }
  function today() { var d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }

  var data = load();
  function load() {
    try { var o = JSON.parse(localStorage.getItem(STORE)); if (o && typeof o === "object") return o; } catch (e) {}
    return {};
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(data)); } catch (e) {} }
  // Rekord setzen; lowerBetter für Zeiten/Züge
  function record(key, val, lowerBetter) {
    var old = data["best_" + key];
    var better = old == null || (lowerBetter ? val < old : val > old);
    if (better) { data["best_" + key] = val; save(); }
    return better;
  }
  function best(key) { return data["best_" + key]; }

  // ---------------- CSS ----------------
  var CSS = [
    "#mg-open{position:fixed;right:12px;bottom:12px;z-index:79;font:800 15px/1 -apple-system,system-ui,sans-serif;padding:11px 15px;border-radius:14px;border:none;",
    "cursor:pointer;color:#022;background:linear-gradient(90deg,#ffd166,#5ff0d8);box-shadow:0 8px 24px rgba(0,0,0,.4)}",
    "#mg{position:fixed;inset:0;z-index:95;display:none;align-items:center;justify-content:center;background:rgba(1,12,22,.72);backdrop-filter:blur(3px);padding:12px}",
    "#mg.on{display:flex}",
    ".mg-panel{width:min(720px,100%);max-height:94vh;overflow:auto;background:linear-gradient(180deg,#05324b,#032236);color:#eafcff;border:1px solid rgba(255,255,255,.15);",
    "border-radius:20px;box-shadow:0 30px 80px rgba(0,0,0,.6);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}",
    ".mg-head{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,.1);position:sticky;top:0;background:#05324b;z-index:2}",
    ".mg-head b{flex:1;font-size:1.15rem}",
    ".mg-panel button{font:inherit;font-weight:700;font-size:.92rem;padding:8px 14px;border:none;border-radius:10px;cursor:pointer;color:#022;background:#5ff0d8}",
    ".mg-panel button.sec{background:rgba(255,255,255,.12);color:#eafcff}",
    ".mg-body{padding:16px}",
    ".mg-menu{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}",
    // höhere Spezifität als ".mg-panel button", sonst erben die Karten den türkisen Button-Stil
    ".mg-panel button.mg-card{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:14px;cursor:pointer;text-align:left;color:#eafcff;font-weight:400;",
    "transition:transform .15s ease,background .15s}",
    ".mg-panel button.mg-card:hover{transform:translateY(-3px);background:rgba(255,255,255,.12)}",
    ".mg-card .ic{font-size:2.2rem}.mg-card h3{margin:6px 0 4px;font-size:1.05rem}.mg-card p{margin:0;font-size:.85rem;color:#9fd3e0;line-height:1.35}",
    ".mg-card small{display:block;margin-top:8px;color:#ffd166;font-weight:700}",
    ".mg-info{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px;font-weight:700}",
    ".mg-info span{background:rgba(255,255,255,.08);padding:6px 12px;border-radius:999px}",
    ".mg-msg{text-align:center;font-weight:800;font-size:1.1rem;min-height:1.6em;margin:10px 0}",
    ".mg-row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:10px}",
    // Bingo
    ".mg-bingo{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}",
    ".mg-bingo div{aspect-ratio:1.25;display:flex;align-items:center;justify-content:center;text-align:center;padding:6px;border-radius:10px;cursor:pointer;",
    "background:rgba(255,255,255,.08);font-size:clamp(.66rem,2.1vw,.9rem);font-weight:700;line-height:1.2;position:relative;transition:background .2s}",
    ".mg-bingo div.x{background:#1f8f6a}.mg-bingo div.x::after{content:'🐳';position:absolute;right:4px;top:2px;font-size:1rem}",
    ".mg-bingo div.auto{outline:2px dashed #ffd166;outline-offset:-4px}",
    ".mg-bingo div.win{background:#d4a017;color:#1a1200;animation:mgPulse .6s ease-in-out infinite alternate}",
    "@keyframes mgPulse{to{transform:scale(1.05)}}",
    // Flappy
    ".mg-canvas{width:100%;display:block;border-radius:14px;background:#03263b;cursor:pointer;touch-action:manipulation}",
    // Whack
    ".mg-whack{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:420px;margin:0 auto}",
    ".mg-whack div{aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 50% 70%,#021522 0 55%,#0b4f6c 56% 100%);display:flex;align-items:center;",
    "justify-content:center;font-size:clamp(2.2rem,9vw,3.6rem);cursor:pointer;user-select:none;overflow:hidden}",
    ".mg-whack span{animation:mgUp .15s ease-out}",
    "@keyframes mgUp{from{transform:translateY(70%)}}",
    ".mg-whack div.bonk{background:radial-gradient(circle at 50% 70%,#3a0d0d 0 55%,#8f1d2c 56% 100%)}",
    // Reaktion
    ".mg-react{height:220px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:6rem;font-weight:900;cursor:pointer;",
    "background:rgba(255,255,255,.07);user-select:none;font-variant-numeric:tabular-nums;transition:background .1s}",
    ".mg-react.go{background:#1f8f6a}.mg-react.bad{background:#8f1d2c}",
    // Memory
    ".mg-mem{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;max-width:520px;margin:0 auto}",
    ".mg-mem div{aspect-ratio:1;border-radius:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;",
    "background:linear-gradient(135deg,#2e7dff,#5ff0d8);font-size:clamp(1.6rem,6vw,2.4rem);user-select:none;transition:transform .25s}",
    ".mg-mem div small{font-size:.5rem;font-weight:800;text-align:center;margin-top:2px;padding:0 2px}",
    ".mg-mem div.h{background:linear-gradient(135deg,#0b4f6c,#043b57);font-size:1.8rem}",
    ".mg-mem div.ok{background:#1f8f6a;transform:scale(.94)}",
    // Orakel
    ".mg-oracle{text-align:center}.mg-oracle .ball{font-size:4.5rem;animation:mgFloat 2s ease-in-out infinite alternate}",
    "@keyframes mgFloat{to{transform:translateY(-10px)}}",
    ".mg-oracle input{font:inherit;font-size:1.4rem;width:110px;text-align:center;padding:8px;border-radius:10px;border:1px solid rgba(255,255,255,.25);",
    "background:rgba(255,255,255,.08);color:#eafcff}",
    // Challenge-Popup
    "#mg-chal{position:fixed;left:12px;bottom:60px;z-index:78;max-width:min(340px,calc(100vw - 24px));background:#05324b;color:#eafcff;border:2px solid #ffd166;",
    "border-radius:16px;padding:12px 14px;font:600 .92rem/1.4 -apple-system,system-ui,sans-serif;box-shadow:0 14px 40px rgba(0,0,0,.5);",
    "transform:translateX(-120%);transition:transform .45s cubic-bezier(.3,1.4,.4,1)}",
    "#mg-chal.on{transform:translateX(0)}",
    "#mg-chal b{color:#ffd166}#mg-chal .mg-row{justify-content:flex-start;margin-top:8px}",
    "#mg-chal button{font:inherit;font-weight:800;padding:6px 12px;border:none;border-radius:8px;cursor:pointer;background:#5ff0d8;color:#022}",
    "#mg-chal button.sec{background:rgba(255,255,255,.12);color:#eafcff}",
    // 2048
    ".mg-2048{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;max-width:400px;margin:0 auto;touch-action:none;user-select:none}",
    ".mg-2048 div{aspect-ratio:1;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:clamp(1.8rem,8vw,2.6rem);transition:background .15s}",
    ".mg-2048 div small{font-size:.7rem;font-weight:800;opacity:.8}",
    // Minesweeper
    ".mg-mines{display:grid;grid-template-columns:repeat(9,1fr);gap:3px;max-width:440px;margin:0 auto;user-select:none}",
    ".mg-mines div{aspect-ratio:1;border-radius:5px;background:#2e7dff;display:flex;align-items:center;justify-content:center;cursor:pointer;",
    "font-weight:900;font-size:clamp(.8rem,3.4vw,1.1rem)}",
    ".mg-mines div:hover{filter:brightness(1.15)}.mg-mines div.o{background:rgba(255,255,255,.08);cursor:default}",
    ".mg-mines div.boom{background:#ff3b30}",
    // Tipp-Spiel
    ".mg-type{position:relative;height:300px;border-radius:14px;overflow:hidden;background:linear-gradient(#1d3b2a,#0f2a1c);border:6px solid #6b4f2a;transition:border-color .2s}",
    ".mg-type.miss{border-color:#ff3b30}",
    ".mg-type .w{position:absolute;top:0;color:#f4f4e8;font:700 1.15rem 'Chalkboard SE','Comic Sans MS',cursive;white-space:nowrap;text-shadow:0 0 6px rgba(255,255,255,.3)}",
    ".mg-type-in{display:block;width:100%;margin-top:10px;font:inherit;font-size:1.2rem;padding:10px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.25);",
    "background:rgba(255,255,255,.08);color:#eafcff}",
    // Clicker
    ".mg-moai{position:relative;width:170px;height:170px;margin:4px auto 14px;border-radius:50%;display:flex;align-items:center;justify-content:center;",
    "font-size:6rem;cursor:pointer;user-select:none;background:radial-gradient(circle,#5ff0d8 0,#2e7dff 60%,transparent 70%);touch-action:manipulation}",
    ".mg-moai.bop{animation:mgBop .12s ease}@keyframes mgBop{50%{transform:scale(.92)}}",
    ".mg-plus{position:absolute;font-size:1.1rem;font-weight:900;color:#ffd166;pointer-events:none;animation:mgPlus .8s ease-out forwards}",
    "@keyframes mgPlus{to{transform:translateY(-60px);opacity:0}}",
    ".mg-shop{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}",
    ".mg-panel .mg-shop button{text-align:left;line-height:1.35;background:rgba(255,255,255,.1);color:#eafcff;font-size:.85rem}",
    ".mg-panel .mg-shop button:disabled{opacity:.4;cursor:not-allowed}",
    ".mg-shop strong{float:right;color:#ffd166}.mg-shop small{color:#9fd3e0}",
    // Tic-Tac-Toe
    ".mg-ttt{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-width:320px;margin:0 auto}",
    ".mg-ttt div{aspect-ratio:1;border-radius:14px;background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;",
    "font-size:clamp(2.4rem,11vw,3.6rem);cursor:pointer;user-select:none}",
    ".mg-ttt div:hover{background:rgba(255,255,255,.14)}"
  ].join("");

  // ---------------- Spiel-Rahmen ----------------
  var o = {}, speed = 1, modal, bodyEl, titleEl, current = null, cleanup = null;
  var GAMES = {};

  function mount(opts) {
    o = opts || {};
    speed = o.speed || 1;
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);

    var btn = document.createElement("button");
    btn.id = "mg-open"; btn.textContent = "🎮 Minigames";
    btn.addEventListener("click", function () { open(null); });
    document.body.appendChild(btn);

    modal = document.createElement("div");
    modal.id = "mg";
    modal.innerHTML = '<div class="mg-panel"><div class="mg-head"><b></b><button class="sec" data-a="menu">☰ Menü</button>' +
                      '<button class="sec" data-a="close">✕</button></div><div class="mg-body"></div></div>';
    document.body.appendChild(modal);
    bodyEl = modal.querySelector(".mg-body");
    titleEl = modal.querySelector(".mg-head b");
    modal.addEventListener("click", function (e) {
      var a = e.target.getAttribute && e.target.getAttribute("data-a");
      if (a === "close" || e.target === modal) close();
      else if (a === "menu") open(null);
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && modal.classList.contains("on")) close(); });

    buildChallenge();
    scheduleChallenge();

    // Zähler selbst mitlesen (Bingo/Orakel) und Orakel-Ende prüfen
    var poll = function () { syncCount(); oracleCheckEnd(); };
    setTimeout(poll, 0); setInterval(poll, 1500);   // erst nach dem ersten Countdown-Tick (hasUpdate)
    // Andere Tabs haben gespeichert → frisch laden, sonst überschreibt dieser Tab deren Rekorde
    addEventListener("storage", function (e) {
      if (e.key === STORE) { data = load(); redrawLive(); }
      else if (e.key === "anderstelle.count") syncCount();
    });
    if (/minigames/i.test(location.hash)) open(null);
  }

  function open(game) {
    if (cleanup) { cleanup(); cleanup = null; }
    modal.classList.add("on");
    current = game;
    bodyEl.innerHTML = "";
    if (!game) { titleEl.textContent = "🎮 Minigames"; menu(); return; }
    titleEl.textContent = GAMES[game].icon + " " + GAMES[game].name;
    cleanup = GAMES[game].start(bodyEl) || null;
  }
  function close() {
    if (cleanup) { cleanup(); cleanup = null; }
    modal.classList.remove("on");
    current = null;
  }
  function menu() {
    var grid = document.createElement("div");
    grid.className = "mg-menu";
    Object.keys(GAMES).forEach(function (k) {
      var g = GAMES[k], c = document.createElement("button");
      c.className = "mg-card";
      c.innerHTML = '<div class="ic">' + g.icon + "</div><h3>" + g.name + "</h3><p>" + g.desc + "</p>" +
                    (g.bestText && g.bestText() ? "<small>" + g.bestText() + "</small>" : "");
      c.addEventListener("click", function () { open(k); });
      grid.appendChild(c);
    });
    bodyEl.appendChild(grid);
  }
  function reward(n, why) {
    if (global.Brainrot && global.Brainrot.aura) global.Brainrot.aura(n, why);
  }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  // ================= 1) Dozenten-Bingo =================
  var BINGO_POOL = [
    "„Gibt es Fragen?“ 🦗", "„klausurrelevant“", "„wie gesagt …“", "„nur noch eine Folie“", "Beamer-Problem 📽️",
    "Handy klingelt 📱", "jemand kommt zu spät 🚪", "Mikro pfeift 🎤", "„Das sehen wir nächste Woche“", "Folie wird übersprungen",
    "„kurz zur Wiederholung“", "Tafel wird gewischt", "jemand niest 🤧", "Dozent trinkt Wasser 💧", "„Ist das hinten lesbar?“",
    "Laptop-Update-Popup 💻", "„Das ist eigentlich ganz einfach“", "Wikipedia wird zitiert", "„Wo war ich stehen geblieben?“",
    "Tippfehler auf der Folie", "Witz, über den keiner lacht 😐", "Hörsaaltür knallt", "„Pause machen wir heute nicht“"
  ];
  var BINGO_AUTO = { "„an der Stelle“ 🐳": 1, "3× „an der Stelle“": 3, "5× „an der Stelle“": 5 };

  function bingoCard() {
    if (data.bingo && data.bingo.day === today()) return data.bingo;
    var cells = shuffle(BINGO_POOL.slice()).slice(0, 13).concat(Object.keys(BINGO_AUTO));
    data.bingo = { day: today(), cells: shuffle(cells), marked: [], hits: 0, won: false };
    save();
    return data.bingo;
  }
  function bingoLines(marked) {
    var L = [], i;
    for (i = 0; i < 4; i++) { L.push([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 3]); L.push([i, i + 4, i + 8, i + 12]); }
    L.push([0, 5, 10, 15]); L.push([3, 6, 9, 12]);
    return L.filter(function (l) { return l.every(function (x) { return marked.indexOf(x) >= 0; }); });
  }
  function bingoAutoMark() {
    var c = bingoCard(), changed = false;
    c.cells.forEach(function (t, i) {
      if (BINGO_AUTO[t] && c.hits >= BINGO_AUTO[t] && c.marked.indexOf(i) < 0) { c.marked.push(i); changed = true; }
    });
    if (changed) { save(); bingoCheck(); }
    return changed;
  }
  function bingoCheck() {
    var c = bingoCard(), wins = bingoLines(c.marked);
    if (wins.length && !c.won) {
      c.won = true; save();
      if (o.say) o.say("🎯 BINGO! 🐳<small>Dozenten-Bingo gewonnen</small>", 3500);
      reward(6767, "Dozenten-Bingo");
      data.bingoWins = (data.bingoWins || 0) + 1; save();
    }
    return wins;
  }
  GAMES.bingo = {
    icon: "🎯", name: "Dozenten-Bingo", desc: "Typische Vorlesungs-Momente abhaken. „an der Stelle“-Felder hakt die Erkennung automatisch ab.",
    bestText: function () { return data.bingoWins ? "Bingos bisher: " + data.bingoWins : ""; },
    start: function (root) {
      var info = el("div", "mg-info", "<span>Karte von heute</span><span></span>");
      var grid = el("div", "mg-bingo"), msg = el("div", "mg-msg");
      function draw() {
        var c = bingoCard();   // jedes Mal frisch: Treffer/andere Tabs können die Karte ersetzt haben
        info.lastChild.textContent = "„an der Stelle“ seit Kartenstart: " + c.hits;
        var wins = bingoLines(c.marked), winCells = [].concat.apply([], wins);
        grid.innerHTML = "";
        c.cells.forEach(function (t, i) {
          var d = el("div", (c.marked.indexOf(i) >= 0 ? "x " : "") + (BINGO_AUTO[t] ? "auto " : "") + (winCells.indexOf(i) >= 0 ? "win" : ""), t);
          d.addEventListener("click", function () {
            if (BINGO_AUTO[t]) { msg.textContent = "Das Feld hakt die Spracherkennung ab. Kein Schummeln 🧐"; return; }
            var m = bingoCard().marked, k = m.indexOf(i);   // frisch holen: data kann inzwischen neu geladen sein
            if (k >= 0) m.splice(k, 1); else m.push(i);
            save(); bingoCheck(); draw();
          });
          grid.appendChild(d);
        });
        msg.textContent = wins.length ? "🎉 BINGO! (" + wins.length + " Reihe" + (wins.length > 1 ? "n" : "") + ")" : "Noch kein Bingo …";
      }
      var row = el("div", "mg-row");
      var nb = el("button", "sec", "🔄 Neue Karte");
      nb.addEventListener("click", function () { delete data.bingo; bingoCard(); draw(); });
      row.appendChild(nb);
      root.appendChild(info); root.appendChild(grid); root.appendChild(msg); root.appendChild(row);
      draw();
      GAMES.bingo.redraw = draw;
      return function () { GAMES.bingo.redraw = null; };
    }
  };

  // ================= 2) Flappy Wal =================
  GAMES.flappy = {
    icon: "🐳", name: "Flappy Wal", desc: "Durch die Folien-Stapel tauchen. Klick, Leertaste oder ↑.",
    bestText: function () { return best("flappy") != null ? "Rekord: " + best("flappy") + " Folien" : ""; },
    start: function (root) {
      var W = 640, H = 360;
      var info = el("div", "mg-info", "<span>Folien: <b>0</b></span><span>Rekord: " + (best("flappy") || 0) + "</span>");
      var cv = el("canvas", "mg-canvas"); cv.width = W; cv.height = H;
      var msg = el("div", "mg-msg", "Klicken oder Leertaste zum Starten");
      root.appendChild(info); root.appendChild(cv); root.appendChild(msg);
      var ctx = cv.getContext("2d"), scoreEl = info.querySelector("b");
      var y, vy, pipes, score, state = "ready", raf = null, last = 0, spawnT, overAt = 0;

      function reset() { y = H / 2; vy = 0; pipes = []; score = 0; spawnT = 0; scoreEl.textContent = 0; }
      function flap() {
        if (state === "over" && performance.now() - overAt < 600) return;   // Panik-Klicks nach dem Tod ignorieren
        if (state === "ready" || state === "over") { reset(); state = "run"; msg.textContent = ""; last = performance.now(); raf = requestAnimationFrame(loop); }
        vy = -6.2;
      }
      function loop(t) {
        var dt = Math.min(2.5, (t - last) / 16.67); last = t;
        var sp = 2.6 + score * 0.06;
        vy += 0.36 * dt; y += vy * dt;
        spawnT -= dt;
        if (spawnT <= 0) { var gap = Math.max(105, 140 - score * 2); pipes.push({ x: W + 30, top: rint(40, H - 40 - gap), gap: gap, done: false }); spawnT = 95; }
        pipes.forEach(function (p) { p.x -= sp * dt; });
        pipes = pipes.filter(function (p) { return p.x > -70; });
        // Kollision (Wal als Kreis r=16 bei x=120)
        var hit = y < 14 || y > H - 14;
        pipes.forEach(function (p) {
          if (120 + 16 > p.x && 120 - 16 < p.x + 56 && (y - 14 < p.top || y + 14 > p.top + p.gap)) hit = true;
          if (!p.done && p.x + 56 < 120) { p.done = true; score++; scoreEl.textContent = score; }
        });
        draw();
        if (hit) { over(); return; }
        raf = requestAnimationFrame(loop);
      }
      function draw() {
        ctx.clearRect(0, 0, W, H);
        var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#04466a"); g.addColorStop(1, "#021b2e");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        pipes.forEach(function (p) {
          ctx.fillStyle = "#e8eef2";
          ctx.fillRect(p.x, 0, 56, p.top); ctx.fillRect(p.x, p.top + p.gap, 56, H - p.top - p.gap);
          ctx.fillStyle = "#2e7dff";   // Folien-Kopfzeile
          ctx.fillRect(p.x, p.top - 12, 56, 12); ctx.fillRect(p.x, p.top + p.gap, 56, 12);
          ctx.font = "18px sans-serif"; ctx.textAlign = "center";
          ctx.fillText("📊", p.x + 28, p.top - 24); ctx.fillText("📊", p.x + 28, p.top + p.gap + 34);
        });
        ctx.save(); ctx.translate(120, y); ctx.rotate(Math.max(-0.5, Math.min(0.8, vy / 10)));
        ctx.scale(-1, 1); ctx.font = "34px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("🐳", 0, 0); ctx.restore();
      }
      function over() {
        state = "over"; overAt = performance.now(); cancelAnimationFrame(raf);
        var rec = record("flappy", score);
        msg.textContent = (rec && score > 0 ? "🏆 Neuer Rekord: " : "💀 Gegen die Folie geschwommen. ") + score + " Folien · Klicken für neuen Versuch";
        info.lastChild.textContent = "Rekord: " + best("flappy");
        if (score >= 10) reward(score * 100, "Flappy Wal: " + score + " Folien");
      }
      function key(e) { if (e.code === "Space" || e.key === "ArrowUp") { e.preventDefault(); flap(); } }
      cv.addEventListener("pointerdown", function (e) { e.preventDefault(); flap(); });
      document.addEventListener("keydown", key);
      reset(); draw();
      return function () { cancelAnimationFrame(raf); document.removeEventListener("keydown", key); };
    }
  };

  // ================= 3) Whack-a-Wal =================
  GAMES.whack = {
    icon: "🔨", name: "Whack-a-Wal", desc: "30 Sekunden: Wale anklicken (+1, 🐋 +3). Finger weg vom Dozenten 👨‍🏫 und der Klausur 📝!",
    bestText: function () { return best("whack") != null ? "Rekord: " + best("whack") + " Punkte" : ""; },
    start: function (root) {
      var info = el("div", "mg-info", "<span>Punkte: <b>0</b></span><span>Zeit: <i>30</i> s</span><span>Rekord: " + (best("whack") || 0) + "</span>");
      var grid = el("div", "mg-whack"), msg = el("div", "mg-msg", "Los geht's mit Klick auf „Start“");
      var row = el("div", "mg-row"), sb = el("button", "", "▶ Start");
      row.appendChild(sb);
      root.appendChild(info); root.appendChild(grid); root.appendChild(msg); root.appendChild(row);
      var holes = [], score = 0, left = 0, timers = [], running = false;
      for (var i = 0; i < 9; i++) {
        (function (idx) {
          var h = el("div");
          h.addEventListener("pointerdown", function () {
            var it = h.getAttribute("data-it");
            if (!running || !it) return;
            var pts = { "🐳": 1, "🐋": 3, "👨‍🏫": -3, "📝": -2 }[it];
            score = Math.max(0, score + pts);
            info.querySelector("b").textContent = score;
            msg.textContent = pts > 0 ? rnd(["Bonk! 🔨", "W 🐳", "Aura +" + pts * 100, "sauber"]) : (it === "📝" ? "Klausur angefasst 😱 " + pts : "Den Dozenten gehauen?! " + pts + " 💀");
            h.innerHTML = ""; h.removeAttribute("data-it"); h._tok = null;
            if (pts < 0) { h.classList.add("bonk"); setTimeout(function () { h.classList.remove("bonk"); }, 300); }
          });
          grid.appendChild(h); holes.push(h);
        })(i);
      }
      function spawn() {
        if (!running) return;
        var free = holes.filter(function (h) { return !h.getAttribute("data-it"); });
        if (free.length) {
          var h = rnd(free), r = Math.random();
          var it = r < 0.55 ? "🐳" : r < 0.68 ? "🐋" : r < 0.88 ? "👨‍🏫" : "📝";
          var tok = {};   // pro Auftauchen eindeutig, damit ein alter Timer keinen neuen Wal wegräumt
          h._tok = tok; h.setAttribute("data-it", it); h.innerHTML = "<span>" + it + "</span>";
          timers.push(setTimeout(function () { if (h._tok === tok) { h.innerHTML = ""; h.removeAttribute("data-it"); h._tok = null; } }, rint(650, 1100)));
        }
        timers.push(setTimeout(spawn, rint(350, 700)));
      }
      function tick() {
        if (!running) return;
        left--; info.querySelector("i").textContent = left;
        if (left <= 0) return end();
        timers.push(setTimeout(tick, 1000));
      }
      function end() {
        running = false; timers.forEach(clearTimeout); timers = [];
        holes.forEach(function (h) { h.innerHTML = ""; h.removeAttribute("data-it"); });
        var rec = record("whack", score);
        msg.textContent = (rec && score > 0 ? "🏆 Neuer Rekord! " : "Zeit um! ") + score + " Punkte";
        info.lastChild.textContent = "Rekord: " + best("whack");
        if (score >= 15) reward(score * 50, "Whack-a-Wal: " + score);
        sb.textContent = "▶ Nochmal";
      }
      sb.addEventListener("click", function () {
        if (running) return;
        score = 0; left = 30; running = true;
        info.querySelector("b").textContent = 0; info.querySelector("i").textContent = 30; msg.textContent = "Hau rein! 🔨";
        spawn(); timers.push(setTimeout(tick, 1000));
      });
      return function () { running = false; timers.forEach(clearTimeout); };
    }
  };

  // ================= 4) Six-Seven-Reaktion =================
  GAMES.react = {
    icon: "⚡", name: "Six-Seven-Reaktion", desc: "Klick, sobald „67“ erscheint. Bei 66, 76, 69 & Co. nicht klicken! 5 Runden.",
    bestText: function () { return best("react") != null ? "Bestzeit: Ø " + best("react") + " ms" : ""; },
    start: function (root) {
      var info = el("div", "mg-info", "<span>Runde: <b>0</b>/5</span><span>Bestzeit: " + (best("react") != null ? "Ø " + best("react") + " ms" : "–") + "</span>");
      var box = el("div", "mg-react", "🫴🫳"), msg = el("div", "mg-msg", "Klick auf das Feld zum Starten");
      root.appendChild(info); root.appendChild(box); root.appendChild(msg);
      var DECOYS = [66, 68, 76, 69, 61, 57, 77, 96, 76, 6, 7, 676, 42];
      var state = "idle", round = 0, times = [], penalties = 0, shownAt = 0, timer = null;
      function next() {
        box.className = "mg-react";
        var n = rint(2, 6), i = 0;   // ein paar Fallen, dann die 67
        (function step() {
          if (i < n) { box.textContent = rnd(DECOYS); state = "decoy"; i++; timer = setTimeout(step, rint(450, 1100)); }
          else { box.textContent = "67"; box.classList.add("go"); state = "go"; shownAt = performance.now();
                 timer = setTimeout(function () { if (state === "go") { msg.textContent = "Zu langsam 🐌 (zählt als 1000 ms)"; times.push(1000); done(); } }, 1500); }
        })();
      }
      function done() {
        clearTimeout(timer);
        round++; info.querySelector("b").textContent = round;
        if (round >= 5) return finish();
        state = "wait"; box.className = "mg-react"; box.textContent = "…";
        timer = setTimeout(next, rint(700, 1300));
      }
      function finish() {
        state = "idle";
        var avg = Math.round(times.reduce(function (a, b) { return a + b; }, 0) / times.length) + penalties * 150;
        var rec = record("react", avg, true);
        box.className = "mg-react"; box.textContent = avg + " ms";
        msg.textContent = (rec ? "🏆 Neue Bestzeit! " : "") + "Ø " + avg + " ms" + (penalties ? " (inkl. " + penalties + " × 150 ms Strafe für Fehlklicks)" : "") +
                          " · " + (avg < 350 ? "Sigma-Reflexe 🗿" : avg < 500 ? "solide 👍" : "Bro ist cooked 💀") + " · Klick für neue Runde";
        info.lastChild.textContent = "Bestzeit: Ø " + best("react") + " ms";
        if (avg < 400) reward(6700, "Six-Seven-Reflexe");
      }
      box.addEventListener("pointerdown", function () {
        if (state === "idle") { round = 0; times = []; penalties = 0; info.querySelector("b").textContent = 0; msg.textContent = "Warte auf die 67 …"; state = "wait"; timer = setTimeout(next, 800); return; }
        if (state === "go") { var ms = Math.round(performance.now() - shownAt); times.push(ms); msg.textContent = "⚡ " + ms + " ms"; done(); return; }
        if (state === "decoy") {
          penalties++; box.classList.add("bad");
          msg.textContent = "Falsch! Das war " + box.textContent + " 💀" + (box.textContent === "69" ? " (nice, aber falsch)" : "");
          setTimeout(function () { box.classList.remove("bad"); }, 250);
        }
      });
      return function () { clearTimeout(timer); };
    }
  };

  // ================= 5) Brainrot-Memory =================
  var MEM = [["🦈👟", "Tralalero"], ["🪵🥁", "Tung Tung"], ["🐊✈️", "Bombardiro"], ["🩰☕", "Ballerina"], ["🐒🍌", "Bananini"], ["🍓🐘", "Strawberry"]];
  GAMES.memory = {
    icon: "🧠", name: "Brainrot-Memory", desc: "Finde die Italian-Brainrot-Paare mit möglichst wenigen Zügen.",
    bestText: function () { return best("memory") != null ? "Rekord: " + best("memory") + " Züge" : ""; },
    start: function (root) {
      var info = el("div", "mg-info", "<span>Züge: <b>0</b></span><span>Rekord: " + (best("memory") || "–") + "</span>");
      var grid = el("div", "mg-mem"), msg = el("div", "mg-msg");
      root.appendChild(info); root.appendChild(grid); root.appendChild(msg);
      var deck = shuffle(MEM.concat(MEM).map(function (m, i) { return { m: m, id: i }; }));
      var flipped = [], moves = 0, found = 0, lock = false;
      deck.forEach(function (c) {
        var d = el("div", "h", "❓");
        d.addEventListener("click", function () {
          if (lock || d.classList.contains("ok") || flipped.indexOf(d) >= 0) return;
          d.classList.remove("h"); d.innerHTML = c.m[0] + "<small>" + c.m[1] + "</small>"; d._k = c.m[1];
          flipped.push(d);
          if (flipped.length === 2) {
            moves++; info.querySelector("b").textContent = moves;
            if (flipped[0]._k === flipped[1]._k) {
              flipped.forEach(function (x) { x.classList.add("ok"); }); flipped = []; found++;
              msg.textContent = rnd(["Paar! 🧠", "W", "Brainrot-Kenner 🗿", "mamma mia 🤌"]);
              if (found === MEM.length) {
                var rec = record("memory", moves, true);
                msg.textContent = (rec ? "🏆 Neuer Rekord: " + moves + " Züge" : "Geschafft in " + moves + " Zügen") + " 🤌";
                info.lastChild.textContent = "Rekord: " + best("memory");
                if (moves <= 10) reward(4200, "Memory in " + moves + " Zügen");
              }
            } else {
              lock = true;
              setTimeout(function () { flipped.forEach(function (x) { x.classList.add("h"); x.textContent = "❓"; }); flipped = []; lock = false; }, 800);
            }
          }
        });
        grid.appendChild(d);
      });
      var row = el("div", "mg-row"), nb = el("button", "sec", "🔄 Neu mischen");
      nb.addEventListener("click", function () { open("memory"); });
      row.appendChild(nb); root.appendChild(row);
    }
  };
  // ================= 7) Wal-2048 =================
  var EVO = ["", "🦐", "🐟", "🐠", "🐡", "🦑", "🐙", "🦭", "🐬", "🦈", "🐋", "🐳"];
  var EVO_BG = ["", "#0b4f6c", "#0e5d7d", "#11708f", "#1483a0", "#1a96b0", "#21a8bd", "#2bb9c6", "#3ccacb", "#d4a017", "#e88a17", "#ff5e3a"];
  // Wischgesten auf einem Element erkennen (für Handy)
  function onSwipe(elm, fn) {
    var sx = 0, sy = 0;
    elm.addEventListener("pointerdown", function (e) { sx = e.clientX; sy = e.clientY; });
    elm.addEventListener("pointerup", function (e) {
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 25) return;
      fn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
    });
  }
  function keyDir(e) {
    return { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down", a: "left", d: "right", w: "up", s: "down" }[e.key];
  }
  GAMES.w2048 = {
    icon: "🐳", name: "Wal-2048", desc: "Gleiche Tiere zusammenschieben: 🦐 → 🐟 → … → 🐋 → 🐳. Pfeiltasten/WASD oder wischen.",
    bestText: function () { return best("w2048") != null ? "Rekord: " + de(best("w2048")) + " Punkte" : ""; },
    start: function (root) {
      var info = el("div", "mg-info", "<span>Punkte: <b>0</b></span><span>Rekord: " + de(best("w2048") || 0) + "</span>");
      var grid = el("div", "mg-2048"), msg = el("div", "mg-msg", "Evolution: " + EVO.slice(1).join(" → "));
      var row = el("div", "mg-row"), nb = el("button", "sec", "🔄 Neues Spiel");
      row.appendChild(nb);
      root.appendChild(info); root.appendChild(grid); root.appendChild(msg); root.appendChild(row);
      var cells, score, won, over;
      function add() {
        var free = []; cells.forEach(function (v, i) { if (!v) free.push(i); });
        if (free.length) cells[rnd(free)] = Math.random() < 0.9 ? 1 : 2;
      }
      function reset() { cells = []; for (var i = 0; i < 16; i++) cells.push(0); score = 0; won = false; over = false; add(); add(); draw(); }
      function idx(dir, k, i) {
        return dir === "left" ? k * 4 + i : dir === "right" ? k * 4 + (3 - i) : dir === "up" ? i * 4 + k : (3 - i) * 4 + k;
      }
      function move(dir) {
        if (over) return;
        var changed = false;
        for (var k = 0; k < 4; k++) {
          var line = [], i;
          for (i = 0; i < 4; i++) line.push(cells[idx(dir, k, i)]);
          var a = line.filter(Boolean), out = [];
          for (i = 0; i < a.length; i++) {
            if (a[i] === a[i + 1] && a[i] < 11) { out.push(a[i] + 1); score += Math.pow(2, a[i] + 1); i++; } else out.push(a[i]);
          }
          while (out.length < 4) out.push(0);
          for (i = 0; i < 4; i++) { if (cells[idx(dir, k, i)] !== out[i]) changed = true; cells[idx(dir, k, i)] = out[i]; }
        }
        if (!changed) return;
        add(); draw();
        if (!won && cells.indexOf(11) >= 0) { won = true; msg.textContent = "🐳 BLAUWAL ERREICHT! 2048!"; reward(20480, "Wal-2048"); if (o.say) o.say("🐳 2048 🐳"); }
        if (!canMove()) {
          over = true;
          var rec = record("w2048", score);
          msg.textContent = (rec ? "🏆 Neuer Rekord: " : "Keine Züge mehr 💀 ") + de(score) + " Punkte · höchstes Tier: " + EVO[Math.max.apply(null, cells)];
          info.lastChild.textContent = "Rekord: " + de(best("w2048"));
        }
      }
      function canMove() {
        for (var i = 0; i < 16; i++) {
          if (!cells[i]) return true;
          if (cells[i] >= 11) continue;   // 🐳 verschmilzt nicht weiter (siehe move)
          if (i % 4 < 3 && cells[i] === cells[i + 1]) return true;
          if (i < 12 && cells[i] === cells[i + 4]) return true;
        }
        return false;
      }
      function draw() {
        grid.innerHTML = "";
        cells.forEach(function (v) {
          var d = el("div", "", v ? EVO[v] + "<small>" + Math.pow(2, v) + "</small>" : "");
          d.style.background = v ? EVO_BG[v] : "rgba(255,255,255,.06)";
          grid.appendChild(d);
        });
        info.querySelector("b").textContent = de(score);
      }
      function key(e) { var d = keyDir(e); if (d) { e.preventDefault(); move(d); } }
      document.addEventListener("keydown", key);
      onSwipe(grid, move);
      nb.addEventListener("click", reset);
      reset();
      return function () { document.removeEventListener("keydown", key); };
    }
  };

  // ================= 8) Klausur-Minesweeper =================
  GAMES.mines = {
    icon: "📝", name: "Klausur-Minesweeper", desc: "Finde alle sicheren Felder. 10 Klausuren 📝 sind versteckt. Rechtsklick (oder 🚩-Modus) = Fahne.",
    bestText: function () { return best("mines") != null ? "Bestzeit: " + best("mines") + " s" : ""; },
    start: function (root) {
      var N = 9, M = 10;
      var info = el("div", "mg-info", "<span>📝 übrig: <b>10</b></span><span>Zeit: <i>0</i> s</span><span>Bestzeit: " + (best("mines") != null ? best("mines") + " s" : "–") + "</span>");
      var grid = el("div", "mg-mines"), msg = el("div", "mg-msg", "Erster Klick ist immer sicher.");
      var row = el("div", "mg-row"), fb = el("button", "sec", "🚩-Modus: aus"), nb = el("button", "sec", "🔄 Neu");
      row.appendChild(fb); row.appendChild(nb);
      root.appendChild(info); root.appendChild(grid); root.appendChild(msg); root.appendChild(row);
      var mine, open, flag, started, done, t0, timer, flagMode = false, divs = [];
      function nb8(i) {
        var r = (i / N) | 0, c = i % N, out = [];
        for (var dr = -1; dr <= 1; dr++) for (var dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          var rr = r + dr, cc = c + dc;
          if (rr >= 0 && rr < N && cc >= 0 && cc < N) out.push(rr * N + cc);
        }
        return out;
      }
      function count(i) { return nb8(i).filter(function (j) { return mine[j]; }).length; }
      function reset() {
        mine = []; open = []; flag = []; started = false; done = false; clearInterval(timer);
        for (var i = 0; i < N * N; i++) { mine.push(false); open.push(false); flag.push(false); }
        info.querySelector("i").textContent = 0; msg.textContent = "Erster Klick ist immer sicher.";
        draw();
      }
      function place(safe) {
        var forbidden = nb8(safe).concat([safe]), placed = 0;
        while (placed < M) { var k = rint(0, N * N - 1); if (!mine[k] && forbidden.indexOf(k) < 0) { mine[k] = true; placed++; } }
        started = true; t0 = Date.now();
        timer = setInterval(function () { info.querySelector("i").textContent = Math.floor((Date.now() - t0) / 1000); }, 500);
      }
      function reveal(i) {
        if (open[i] || flag[i]) return;
        open[i] = true;
        if (!mine[i] && count(i) === 0) nb8(i).forEach(reveal);
      }
      function click(i, asFlag) {
        if (done || open[i]) return;
        if (asFlag) { flag[i] = !flag[i]; draw(); return; }
        if (flag[i]) return;
        if (!started) place(i);
        if (mine[i]) {
          done = true; clearInterval(timer);
          mine.forEach(function (m, k) { if (m) open[k] = true; });
          msg.textContent = rnd(["Durchgefallen 💀", "Klausur erwischt 📝💥", "Nachschreibtermin! 🥀"]);
          draw(); divs[i].classList.add("boom"); return;
        }
        reveal(i);
        var safeLeft = 0; for (var k = 0; k < N * N; k++) if (!mine[k] && !open[k]) safeLeft++;
        if (!safeLeft) {
          done = true; clearInterval(timer);
          var s = Math.max(1, Math.round((Date.now() - t0) / 1000)), rec = record("mines", s, true);
          msg.textContent = (rec ? "🏆 Neue Bestzeit: " : "Bestanden! 🎓 ") + s + " s";
          info.lastChild.textContent = "Bestzeit: " + best("mines") + " s";
          reward(Math.max(500, 6000 - s * 40), "Minesweeper in " + s + " s");
        }
        draw();
      }
      function draw() {
        grid.innerHTML = ""; divs = [];
        var flags = 0;
        for (var i = 0; i < N * N; i++) {
          var d = el("div");
          if (flag[i]) flags++;
          if (open[i]) {
            d.className = "o";
            if (mine[i]) d.textContent = "📝";
            else { var c = count(i); if (c) { d.textContent = c; d.style.color = ["", "#5aa9ff", "#51cf66", "#ff6b6b", "#c77dff", "#ffd166", "#5ff0d8", "#fff", "#aaa"][c]; } }
          } else if (flag[i]) d.textContent = "🚩";
          (function (k) {
            d.addEventListener("click", function () { click(k, flagMode); });
            d.addEventListener("contextmenu", function (e) { e.preventDefault(); click(k, true); });
          })(i);
          grid.appendChild(d); divs.push(d);
        }
        info.querySelector("b").textContent = M - flags;
      }
      fb.addEventListener("click", function () { flagMode = !flagMode; fb.textContent = "🚩-Modus: " + (flagMode ? "an" : "aus"); });
      nb.addEventListener("click", reset);
      reset();
      return function () { clearInterval(timer); };
    }
  };

  // ================= 9) Wal-Snake =================
  GAMES.snake = {
    icon: "🦐", name: "Wal-Snake", desc: "Der Wal frisst Krill 🦐 und wird länger. Nicht gegen die Wand oder sich selbst! Pfeiltasten/WASD oder wischen.",
    bestText: function () { return best("snake") != null ? "Rekord: " + best("snake") + " Krill" : ""; },
    start: function (root) {
      var C = 20, R = 14, S = 26, W = C * S, H = R * S;
      var info = el("div", "mg-info", "<span>Krill: <b>0</b></span><span>Rekord: " + (best("snake") || 0) + "</span>");
      var cv = el("canvas", "mg-canvas"); cv.width = W; cv.height = H;
      var msg = el("div", "mg-msg", "Pfeiltaste, Klick oder Wischen zum Starten");
      root.appendChild(info); root.appendChild(cv); root.appendChild(msg);
      var ctx = cv.getContext("2d"), snake, dir, nextDir, food, gold, score, state = "ready", timer = null, overAt = 0;
      var DIRS = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } };
      function freeCell() {
        while (true) { var p = { x: rint(0, C - 1), y: rint(0, R - 1) };
          if (!snake.some(function (s) { return s.x === p.x && s.y === p.y; })) return p; }
      }
      // v = Startrichtung; der Körper liegt dahinter, damit jede Richtung als erster Zug klappt
      function reset(v) {
        v = v || DIRS.right;
        snake = [0, 1, 2].map(function (i) { return { x: 10 - v.x * i, y: 7 - v.y * i }; });
        dir = nextDir = v; score = 0; gold = null; food = freeCell(); info.querySelector("b").textContent = 0; draw();
      }
      function setDir(d) {
        var v = DIRS[d];
        if (!v) return;
        if (state !== "run") {
          if (state === "over" && performance.now() - overAt < 600) return;   // Panik-Tasten nach dem Tod ignorieren
          reset(v); go(); return;
        }
        if (v.x === -dir.x && v.y === -dir.y) return;
        nextDir = v;
      }
      function go() {
        if (state === "over") { if (performance.now() - overAt < 600) return; reset(); }
        state = "run"; msg.textContent = "";
        clearTimeout(timer); step();
      }
      function step() {
        dir = nextDir;
        var h = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
        var eatFood = h.x === food.x && h.y === food.y, eatGold = !eatFood && gold && h.x === gold.p.x && h.y === gold.p.y;
        var body = eatFood || eatGold ? snake : snake.slice(0, -1);   // das Schwanzende rückt im selben Schritt weiter
        if (h.x < 0 || h.y < 0 || h.x >= C || h.y >= R || body.some(function (s) { return s.x === h.x && s.y === h.y; })) return die();
        snake.unshift(h);
        if (eatFood) { score++; food = freeCell(); if (!gold && Math.random() < 0.2) gold = { p: freeCell(), t: 40 }; }
        else if (eatGold) { score += 5; gold = null; snake.push(snake[snake.length - 1]); }
        else snake.pop();
        if (gold && --gold.t <= 0) gold = null;
        info.querySelector("b").textContent = score;
        draw();
        timer = setTimeout(step, Math.max(60, 140 - score * 3));
      }
      function die() {
        state = "over"; overAt = performance.now();
        var rec = record("snake", score);
        msg.textContent = (rec && score ? "🏆 Neuer Rekord: " : "💀 Bonk. ") + score + " Krill · Klicken für neuen Versuch";
        info.lastChild.textContent = "Rekord: " + best("snake");
        if (score >= 20) reward(score * 100, "Wal-Snake: " + score);
      }
      function draw() {
        ctx.fillStyle = "#03263b"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "rgba(255,255,255,.03)";
        for (var x = 0; x < C; x++) for (var y = 0; y < R; y++) if ((x + y) % 2) ctx.fillRect(x * S, y * S, S, S);
        ctx.font = (S - 4) + "px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = "#fff";   // Emojis übernehmen die Deckkraft von fillStyle – sonst ist der Krill fast unsichtbar
        ctx.fillText("🦐", food.x * S + S / 2, food.y * S + S / 2 + 1);
        if (gold) ctx.fillText("🐟", gold.p.x * S + S / 2, gold.p.y * S + S / 2 + 1);
        for (var i = snake.length - 1; i > 0; i--) {
          ctx.fillStyle = "hsl(" + (190 + i * 3) + ",80%," + (60 - Math.min(i, 20)) + "%)";
          ctx.beginPath(); ctx.arc(snake[i].x * S + S / 2, snake[i].y * S + S / 2, S / 2 - 3, 0, 6.29); ctx.fill();
        }
        ctx.save(); ctx.translate(snake[0].x * S + S / 2, snake[0].y * S + S / 2 + 1);
        if (dir.x > 0) ctx.scale(-1, 1);
        ctx.font = S + "px sans-serif"; ctx.fillStyle = "#fff"; ctx.fillText("🐳", 0, 0); ctx.restore();
      }
      function key(e) { var d = keyDir(e); if (d) { e.preventDefault(); setDir(d); } }
      document.addEventListener("keydown", key);
      onSwipe(cv, setDir);
      cv.addEventListener("click", function () { if (state !== "run") go(); });
      reset();
      return function () { clearTimeout(timer); document.removeEventListener("keydown", key); };
    }
  };

  // ================= 13) Wal-Subway-Surfer =================
  // Pseudo-3D: Objekte haben eine Position „at“ (Meter) auf der Strecke, z = at − dist ist der Abstand zum Wal.
  GAMES.surf = {
    icon: "🚇", name: "Wal-Subway-Surfer", desc: "Flucht vor dem Dozenten durch die U-Bahn-Gleise. ←/→ Spur wechseln, ↑ springen, ↓ abtauchen, Krill sammeln. Wischen geht auch.",
    bestText: function () { return best("surf") != null ? "Rekord: " + de(best("surf")) + " Punkte" : ""; },
    start: function (root) {
      var W = 640, H = 360, HOR = 92, BASE = 300, D = 10, ZMAX = 130, LANE = 150;
      var info = el("div", "mg-info", "<span>Punkte: <b>0</b></span><span>🦐 <i>0</i></span><span>Rekord: " + de(best("surf") || 0) + "</span>");
      var cv = el("canvas", "mg-canvas"); cv.width = W; cv.height = H;
      var msg = el("div", "mg-msg", "Klick, Taste oder Wischen zum Starten · ←/→ Spur · ↑/Leertaste springen · ↓ abtauchen");
      root.appendChild(info); root.appendChild(cv); root.appendChild(msg);
      var ctx = cv.getContext("2d"), state = "ready", raf = null, last = 0, overAt = 0, swipedAt = 0, caught = null;
      var lane, px, jy, jv, duck, objs, dist, speed, krill, nextRow, magnet, t;
      var CRASH = { train: "🚃 Gegen den Mensa-Express geschwommen", low: "📝 Über einen Klausurstapel gestolpert", high: "📽️ Gegen den Beamer geknallt" };

      function reset() { lane = 0; px = 0; jy = 0; jv = 0; duck = 0; objs = []; dist = 0; speed = 16; krill = 0; nextRow = 45; magnet = 0; t = 0; caught = null; hud(); draw(); }
      function score() { return Math.floor(dist) + krill * 25; }
      function hud() { info.querySelector("b").textContent = de(score()); info.querySelector("i").textContent = krill; }
      function begin() {
        if (state === "run" || (state === "over" && performance.now() - overAt < 600)) return;   // Panik-Eingaben nach dem Crash ignorieren
        reset(); state = "run"; msg.textContent = ""; last = performance.now(); raf = requestAnimationFrame(loop);
      }
      function act(d) {
        if (state !== "run") return begin();
        if (d === "left" && lane > -1) lane--;
        else if (d === "right" && lane < 1) lane++;
        else if (d === "up" && jy === 0) { jv = 390; duck = 0; }
        else if (d === "down") { duck = 0.7; if (jy > 0) jv = -650; }   // in der Luft: schnell wieder runter
      }
      // Eine Reihe Hindernisse; mindestens eine Spur bleibt ohne Zug, die freie Spur bekommt Krill
      function spawnRow() {
        var at = nextRow, lanes = shuffle([-1, 0, 1]), n = Math.random() < 0.45 ? 1 : 2, trains = 0, maxLen = 1;
        if (speed > 24 && Math.random() < 0.25) n = 3;
        for (var i = 0; i < n; i++) {
          var type = rnd(["low", "high", "train", "train"]);
          if (type === "train" && trains >= Math.min(2, n - 1 || 1)) type = rnd(["low", "high"]);
          if (type === "train") trains++;
          var len = type === "train" ? rint(8, 22) : 1;
          maxLen = Math.max(maxLen, len);
          objs.push({ lane: lanes[i], at: at, type: type, len: len });
        }
        if (n < 3) {
          var free = lanes[n];
          if (Math.random() < 0.07) objs.push({ lane: free, at: at + 6, type: "coffee", len: 0 });
          else for (var k = 0; k < 5; k++) objs.push({ lane: free, at: at + 2 + k * 3, type: "krill", len: 0 });
        }
        nextRow = at + maxLen + Math.max(15, 30 - speed * 0.35);
      }
      function loop(now) {
        var dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
        speed = Math.min(42, 16 + t * 0.35);
        var step = speed * dt; dist += step;
        px += (lane - px) * Math.min(1, dt * 14);
        if (jy > 0 || jv > 0) { jy += jv * dt; jv -= 1000 * dt; if (jy <= 0) { jy = 0; jv = 0; } }
        if (duck > 0) duck -= dt;
        if (magnet > 0) magnet -= dt;
        while (nextRow < dist + ZMAX) spawnRow();
        var pl = Math.round(px), crash = null;
        objs = objs.filter(function (ob) {
          var z = ob.at - dist, zOld = z + step;
          if (ob.type === "krill" || ob.type === "coffee") {
            var take = (zOld > 0 && z <= 0 && ob.lane === pl) || (ob.type === "krill" && magnet > 0 && z <= 6);
            if (take) { if (ob.type === "krill") krill++; else magnet = 8; return false; }
            return z > -3;
          }
          if (ob.lane === pl && !crash) {
            if (ob.type === "train") { if (z <= 0.5 && z + ob.len > -0.5) crash = ob; }
            else if (zOld > 0 && z <= 0 && (ob.type === "low" ? jy < 30 : duck <= 0)) crash = ob;   // genau beim Durchqueren prüfen
          }
          return z + ob.len > -4;
        });
        hud(); 
        if (crash) return over(crash);
        draw();
        raf = requestAnimationFrame(loop);
      }
      function over(ob) {
        state = "over"; overAt = performance.now(); caught = ob; cancelAnimationFrame(raf);
        draw();
        var sc = score(), rec = record("surf", sc);
        msg.textContent = CRASH[ob.type] + " – 👨‍🏫 hat dich erwischt! " + (rec && sc ? "🏆 Neuer Rekord: " : "") + de(sc) + " Punkte · Klick/Taste für neuen Versuch";
        info.lastChild.textContent = "Rekord: " + de(best("surf"));
        if (sc >= 1500) reward(sc, "Wal-Subway-Surfer: " + de(sc) + " Punkte");
      }
      function P(x, z) { var p = D / (D + z); return { x: W / 2 + x * LANE * p, y: HOR + (BASE - HOR) * p, p: p }; }
      function emoji(ch, x, y, size) {
        ctx.fillStyle = "#fff"; ctx.font = Math.round(size) + "px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(ch, x, y);
      }
      function quad(a, b, c, d2, col) {
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d2.x, d2.y); ctx.closePath(); ctx.fill();
      }
      function draw() {
        var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#04466a"); g.addColorStop(1, "#021b2e");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        // Tunnel-Lichter am Horizont
        ctx.fillStyle = "rgba(255,209,102,.5)";
        for (var li = 0; li < 7; li++) ctx.fillRect(40 + li * 95 - ((dist * 8) % 95), 30, 30, 4);
        // Gleisbett
        quad(P(-1.6, -4), P(1.6, -4), P(1.6, ZMAX), P(-1.6, ZMAX), "#0b3a52");
        ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.lineWidth = 2;
        for (var s = 0; s < ZMAX; s += 4) {   // Schwellen, laufen mit der Strecke mit
          var zz = s - (dist % 4); if (zz < -4) continue;
          var a = P(-1.5, zz), b = P(1.5, zz);
          ctx.lineWidth = 1 + 3 * a.p; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        ctx.strokeStyle = "rgba(159,211,224,.55)";
        [-1.5, -0.5, 0.5, 1.5].forEach(function (x) {
          var a = P(x, -4), b = P(x, ZMAX); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        });
        // Objekte von hinten nach vorne
        objs.slice().sort(function (u, v) { return v.at - u.at; }).forEach(function (ob) {
          var z = ob.at - dist;
          if (z > ZMAX || z + ob.len < -3) return;
          var f = P(ob.lane, Math.max(z, -2));
          if (ob.type === "train") {
            var zb = z + ob.len, hgt = 110;
            var fl = P(ob.lane - 0.42, Math.max(z, -2)), fr = P(ob.lane + 0.42, Math.max(z, -2)), bl = P(ob.lane - 0.42, zb), br = P(ob.lane + 0.42, zb);
            quad({ x: fl.x, y: fl.y - hgt * fl.p }, { x: fr.x, y: fr.y - hgt * fr.p }, { x: br.x, y: br.y - hgt * br.p }, { x: bl.x, y: bl.y - hgt * bl.p }, "#e05a4a");
            ctx.fillStyle = "#b8392b"; ctx.fillRect(fl.x, fl.y - hgt * fl.p, fr.x - fl.x, hgt * fl.p);
            ctx.fillStyle = "#cfe9f2"; ctx.fillRect(fl.x + 10 * fl.p, fl.y - hgt * fl.p * 0.85, (fr.x - fl.x) - 20 * fl.p, hgt * fl.p * 0.3);
            emoji("🚃", f.x, f.y - hgt * f.p * 0.32, 40 * f.p);
          } else if (ob.type === "low") {
            var w = 0.8 * LANE * f.p, h = 30 * f.p;
            ctx.fillStyle = "#f4f4e8"; ctx.fillRect(f.x - w / 2, f.y - h, w, h);
            ctx.fillStyle = "#ff6b6b"; ctx.fillRect(f.x - w / 2, f.y - h, w, 4 * f.p);
            emoji("📝", f.x, f.y - h - 14 * f.p, 28 * f.p);
          } else if (ob.type === "high") {
            var w2 = 0.86 * LANE * f.p, top = 92 * f.p, bar = 22 * f.p;
            ctx.fillStyle = "#6b7c86"; ctx.fillRect(f.x - w2 / 2, f.y - top, 5 * f.p, top); ctx.fillRect(f.x + w2 / 2 - 5 * f.p, f.y - top, 5 * f.p, top);
            ctx.fillStyle = "#ffd166"; ctx.fillRect(f.x - w2 / 2, f.y - top, w2, bar);
            emoji("📽️", f.x, f.y - top + bar / 2, 20 * f.p);
          } else {
            var bob = Math.sin((ob.at + t * 6)) * 4 * f.p;
            emoji(ob.type === "krill" ? "🦐" : "☕", f.x, f.y - 22 * f.p + bob, (ob.type === "krill" ? 26 : 32) * f.p);
          }
        });
        // Wal mit Schatten
        var me = P(px, 0);
        ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(me.x, me.y - 2, 30 - jy * 0.08, 8, 0, 0, 6.29); ctx.fill();
        ctx.save(); ctx.translate(me.x, me.y - 28 - jy);
        if (duck > 0 && jy === 0) { ctx.translate(0, 14); ctx.scale(1.2, 0.5); }
        emoji("🐳", 0, 0, 56); ctx.restore();
        if (magnet > 0) { ctx.textAlign = "left"; emoji("☕", 26, 26, 22); ctx.fillStyle = "#ffd166"; ctx.font = "800 15px sans-serif"; ctx.textAlign = "left"; ctx.fillText("Krill-Magnet " + Math.ceil(magnet) + " s", 42, 27); }
        // Der Dozent jagt hinterher: am Anfang und beim Erwischen sichtbar
        if (state !== "run" || t < 2.5) {
          var dz = P(caught ? px : px - 0.5, caught ? -1.3 : -1.8 - Math.max(0, t - 1.5));
          emoji("👨‍🏫", dz.x, dz.y - 30, 48);
          if (caught) { ctx.fillStyle = "#fff"; ctx.font = "800 16px sans-serif"; ctx.textAlign = "center"; ctx.fillText("„Wo wollen Sie denn hin?“", dz.x, dz.y - 66); }
        }
      }
      function key(e) {
        var d = e.code === "Space" ? "up" : keyDir(e);
        if (d) { e.preventDefault(); act(d); }
      }
      document.addEventListener("keydown", key);
      onSwipe(cv, function (d) { swipedAt = performance.now(); act(d); });
      cv.addEventListener("click", function () {
        if (performance.now() - swipedAt < 300) return;   // nach einer Wischgeste feuert der Browser noch einen Klick
        act("up");
      });
      reset();
      return function () { cancelAnimationFrame(raf); document.removeEventListener("keydown", key); };
    }
  };

  // ================= 10) Mitschreib-Simulator =================
  var TYPE_WORDS = ["an der Stelle", "klausurrelevant", "Folie", "Integral", "Matrix", "Hörsaal", "Mensa", "Aura", "Beamer", "Fragen",
                    "Wiederholung", "Semester", "Skibidi", "Ohio", "Mewing", "Tralalero", "Vorlesung", "Übungsblatt", "Prüfung",
                    "Definition", "Beweis", "Sigma", "Kaffee", "Pause", "wie gesagt", "Tafel", "Skript", "Wal", "Krill", "Rizz"];
  GAMES.typing = {
    icon: "⌨️", name: "Mitschreib-Simulator", desc: "Wörter fallen von der Tafel – abtippen, bevor sie unten ankommen. 3 Leben.",
    bestText: function () { return best("typing") != null ? "Rekord: " + best("typing") + " Wörter" : ""; },
    start: function (root) {
      var info = el("div", "mg-info", "<span>Wörter: <b>0</b></span><span>Leben: <i>❤️❤️❤️</i></span><span>Rekord: " + (best("typing") || 0) + "</span>");
      var box = el("div", "mg-type"), inp = el("input"), msg = el("div", "mg-msg", "Tippen startet das Spiel");
      inp.placeholder = "hier mitschreiben …"; inp.className = "mg-type-in"; inp.autocomplete = "off"; inp.spellcheck = false;
      root.appendChild(info); root.appendChild(box); root.appendChild(inp); root.appendChild(msg);
      var words = [], score = 0, lives = 3, state = "ready", raf = null, last = 0, spawnIn = 0;
      function start() { state = "run"; score = 0; lives = 3; words.forEach(function (w) { w.el.remove(); }); words = []; spawnIn = 0; last = performance.now(); msg.textContent = ""; upd(); raf = requestAnimationFrame(loop); }
      function upd() { info.querySelector("b").textContent = score; info.querySelector("i").textContent = lives > 0 ? "❤️".repeat(lives) : "💀"; }
      function loop(t) {
        var dt = Math.min(50, t - last) / 1000; last = t;
        spawnIn -= dt;
        if (spawnIn <= 0) {
          var w = { text: rnd(TYPE_WORDS), y: 0, el: el("div", "w") };
          w.el.textContent = w.text; w.el.style.left = rint(2, 70) + "%";
          box.appendChild(w.el); words.push(w);
          spawnIn = Math.max(0.9, 2.4 - score * 0.06);
        }
        var sp = 34 + score * 2.2, hb = box.clientHeight - 24;
        words = words.filter(function (w) {
          w.y += sp * dt; w.el.style.top = w.y + "px";
          if (w.y > hb) { w.el.remove(); lives--; upd(); box.classList.add("miss"); setTimeout(function () { box.classList.remove("miss"); }, 200); return false; }
          return true;
        });
        if (lives <= 0) return end();
        raf = requestAnimationFrame(loop);
      }
      function end() {
        state = "over"; cancelAnimationFrame(raf); inp.value = "";
        var rec = record("typing", score);
        msg.textContent = (rec && score ? "🏆 Neuer Rekord: " : "Mitschrift verloren 📉 ") + score + " Wörter · Enter für neue Runde";
        info.lastChild.textContent = "Rekord: " + best("typing");
        if (score >= 25) reward(score * 80, "Mitschreib-Simulator");
      }
      inp.addEventListener("input", function () {
        if (state === "over") { inp.value = ""; return; }   // nach Game Over erst per Enter neu starten
        if (state === "ready") start();
        var v = inp.value.trim().toLowerCase();
        for (var i = 0; i < words.length; i++) {
          if (words[i].text.toLowerCase() === v) {
            words[i].el.remove(); words.splice(i, 1); score++; upd(); inp.value = ""; return;
          }
        }
      });
      inp.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && state === "over") { e.preventDefault(); inp.value = ""; start(); }
      });
      setTimeout(function () { inp.focus(); }, 50);
      return function () { cancelAnimationFrame(raf); };
    }
  };

  // ================= 11) Aura-Clicker (Idle) =================
  var UPGRADES = [
    ["krill", "🦐 Krill-Farm", 15, 0.5, 0], ["mew", "🤫 Mewing-Kurs", 60, 0, 1], ["boot", "🛶 Aura-Boot", 150, 3, 0],
    ["tral", "🦈 Tralalero-Fanclub", 700, 12, 0], ["rizz", "😏 Rizz-Seminar", 2500, 0, 15], ["sigma", "🗿 Sigma-Akademie", 4000, 45, 0],
    ["ohio", "🌽 Ohio-Portal", 20000, 180, 0], ["wal", "🐳 Blauwal-Rat", 120000, 900, 0]
  ];
  function clicker() {
    if (!data.clicker) data.clicker = { aura: 0, total: 0, owned: {}, ts: Date.now() };
    var c = data.clicker, now = Date.now();
    c.aura += rate() * Math.min(8 * 3600, (now - c.ts) / 1000);   // läuft auch weiter, wenn die Seite zu ist (max. 8 Std.)
    c.ts = now;
    return c;
  }
  function owned(k) { return (data.clicker && data.clicker.owned[k]) || 0; }
  function rate() { return UPGRADES.reduce(function (s, u) { return s + u[3] * owned(u[0]); }, 0); }
  function perClick() { return 1 + UPGRADES.reduce(function (s, u) { return s + u[4] * owned(u[0]); }, 0); }
  function cost(u) { return Math.ceil(u[2] * Math.pow(1.15, owned(u[0]))); }
  function fmtA(n) { return n >= 1e6 ? de(Math.round(n / 1e5) / 10) + " Mio." : de(Math.floor(n)); }
  GAMES.clicker = {
    icon: "🗿", name: "Aura-Clicker", desc: "Klick den Moai, kauf Upgrades, farme Aura. Läuft im Hintergrund weiter – auch wenn die Seite zu ist.",
    bestText: function () { return data.clicker ? "Aura: " + fmtA(clicker().aura) : ""; },
    start: function (root) {
      var info = el("div", "mg-info", "<span>Aura: <b>0</b></span><span><i>0</i>/s</span><span>pro Klick: <u>1</u></span>");
      var big = el("div", "mg-moai", "🗿"), shop = el("div", "mg-shop");
      root.appendChild(info); root.appendChild(big); root.appendChild(shop);
      function render() {
        var c = clicker();
        info.querySelector("b").textContent = fmtA(c.aura);
        info.querySelector("i").textContent = de(Math.round(rate() * 10) / 10);
        info.querySelector("u").textContent = de(perClick());
        Array.prototype.forEach.call(shop.children, function (b, i) {
          var u = UPGRADES[i];
          b.disabled = c.aura < cost(u);
          b.querySelector("em").textContent = fmtA(cost(u)) + " Aura";
          b.querySelector("strong").textContent = owned(u[0]) ? "×" + owned(u[0]) : "";
        });
      }
      UPGRADES.forEach(function (u) {
        var b = el("button", "", u[1] + " <strong></strong><br><small>" + (u[3] ? "+" + de(u[3]) + "/s" : "+" + u[4] + " pro Klick") + " · <em></em></small>");
        b.addEventListener("click", function () {
          var c = clicker(), k = cost(u);
          if (c.aura < k) return;
          c.aura -= k; c.owned[u[0]] = owned(u[0]) + 1; save(); render();
        });
        shop.appendChild(b);
      });
      big.addEventListener("pointerdown", function (e) {
        var c = clicker(), n = perClick();
        c.aura += n; c.total += n; save(); render();
        var f = el("span", "mg-plus", "+" + de(n));
        var r = big.getBoundingClientRect();
        f.style.left = (e.clientX - r.left) + "px"; f.style.top = (e.clientY - r.top) + "px";
        big.appendChild(f); setTimeout(function () { f.remove(); }, 800);
        big.classList.remove("bop"); void big.offsetWidth; big.classList.add("bop");
      });
      render();
      var iv = setInterval(function () { render(); save(); }, 500);
      return function () { clearInterval(iv); clicker(); save(); };
    }
  };

  // ================= 12) Tic-Tac-Toe gegen den Dozenten =================
  var TTT_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  function tttWinner(b) {
    for (var i = 0; i < 8; i++) { var l = TTT_LINES[i]; if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]) return b[l[0]]; }
    return b.indexOf(null) < 0 ? "draw" : null;
  }
  // Tiefe fließt in die Wertung ein: schneller Sieg > später Sieg, späte Niederlage > frühe
  function minimax(b, me, depth) {
    depth = depth || 0;
    var w = tttWinner(b);
    if (w === "D") return { s: 10 - depth }; if (w === "P") return { s: depth - 10 }; if (w === "draw") return { s: 0 };
    var bestM = null;
    for (var i = 0; i < 9; i++) if (!b[i]) {
      b[i] = me ? "D" : "P";
      var r = minimax(b, !me, depth + 1).s;
      b[i] = null;
      if (!bestM || (me ? r > bestM.s : r < bestM.s)) bestM = { s: r, i: i };
    }
    return bestM;
  }
  GAMES.ttt = {
    icon: "❌", name: "Tic-Tac-Toe vs. Dozent", desc: "Du 🐳 gegen den Dozenten 👨‍🏫. Er ist fast unschlagbar – außer er ist abgelenkt.",
    bestText: function () { var t = data.ttt; return t ? "Bilanz: " + t.w + "S / " + t.d + "U / " + t.l + "N" : ""; },
    start: function (root) {
      function tt() { if (!data.ttt) data.ttt = { w: 0, d: 0, l: 0 }; return data.ttt; }
      var info = el("div", "mg-info", ""), grid = el("div", "mg-ttt"), msg = el("div", "mg-msg");
      var row = el("div", "mg-row"), nb = el("button", "sec", "🔄 Neue Runde");
      row.appendChild(nb);
      root.appendChild(info); root.appendChild(grid); root.appendChild(msg); root.appendChild(row);
      var b, done, t = null;
      var QUIPS = ["„Interessanter Zug. Falsch, aber interessant.“", "„Das hatten wir letzte Woche.“", "„An der Stelle setze ich hierhin.“",
                   "„Ist das klausurrelevant? Ja.“", "„Gibt es Fragen zu meinem Zug?“"];
      function stats() { var s = tt(); info.innerHTML = "<span>Siege: <b>" + s.w + "</b></span><span>Unentschieden: " + s.d + "</span><span>Niederlagen: " + s.l + "</span>"; }
      function reset() { clearTimeout(t); b = [null, null, null, null, null, null, null, null, null]; done = false; msg.textContent = "Du fängst an 🐳"; draw(); }
      function finish(w) {
        done = true;
        if (w === "P") { tt().w++; msg.textContent = "🏆 Du hast den Dozenten besiegt! +5000 Aura"; reward(5000, "Dozent im Tic-Tac-Toe besiegt"); }
        else if (w === "D") { tt().l++; msg.textContent = rnd(["👨‍🏫 „Setzen, sechs.“", "👨‍🏫 „Das üben wir nochmal.“", "👨‍🏫 „Nicht bestanden.“"]); }
        else { tt().d++; msg.textContent = "Unentschieden 🤝 „Damit kann ich leben.“"; }
        save(); stats();
      }
      function draw() {
        grid.innerHTML = "";
        b.forEach(function (v, i) {
          var d = el("div", "", v === "P" ? "🐳" : v === "D" ? "👨‍🏫" : "");
          d.addEventListener("click", function () {
            if (done || b[i]) return;
            b[i] = "P"; draw();
            var w = tttWinner(b); if (w) return finish(w);
            done = true;   // kurz sperren, während der Dozent „nachdenkt“
            t = setTimeout(function () {
              done = false;
              var free = []; b.forEach(function (x, k) { if (!x) free.push(k); });
              var distracted = Math.random() < 0.25;
              var m = distracted ? rnd(free) : minimax(b.slice(), true).i;
              b[m] = "D";
              msg.textContent = distracted ? "👨‍🏫 ist abgelenkt (Beamer-Problem) …" : rnd(QUIPS);
              draw();
              var w2 = tttWinner(b); if (w2) finish(w2);
            }, 450);
          });
          grid.appendChild(d);
        });
      }
      nb.addEventListener("click", reset);
      stats(); reset();
      return function () { clearTimeout(t); };
    }
  };

  // ================= 6) Orakel =================
  // Tipp: Wie oft kommt „an der Stelle“ noch bis Vorlesungsende? Ausgewertet beim Ende des Countdowns.
  GAMES.oracle = {
    icon: "🔮", name: "Orakel", desc: "Tippe, wie oft der Dozent bis Vorlesungsende noch „an der Stelle“ sagt. Auswertung am Ende.",
    bestText: function () { return data.oracle && !data.oracle.done ? "Aktiver Tipp: " + data.oracle.guess + "×" : (data.oracleWins ? "Volltreffer bisher: " + data.oracleWins : ""); },
    start: function (root) {
      var w = el("div", "mg-oracle");
      root.appendChild(w);
      function draw() {
        var t = data.oracle;
        if (t && !t.done) {
          w.innerHTML = '<div class="ball">🔮</div><p>Dein Tipp: <b>' + t.guess + "×</b> „an der Stelle“ bis Vorlesungsende.</p>" +
                        "<p>Seit dem Tipp gehört: <b>" + t.seen + "×</b></p><p style='color:#9fd3e0'>" + oracleEndText() + "</p>";
          var b = el("button", "sec", "Tipp zurückziehen");
          b.addEventListener("click", function () { delete data.oracle; save(); draw(); });
          w.appendChild(el("div", "mg-row")).appendChild(b);
        } else {
          w.innerHTML = '<div class="ball">🔮</div><p>Wie oft sagt der Dozent bis zum Ende noch <b>„an der Stelle“</b>?</p>' +
                        (t && t.done ? "<p>Letztes Mal: Tipp " + t.guess + "×, tatsächlich " + t.seen + "× → " + t.verdict + "</p>" : "");
          var inp = el("input"); inp.type = "number"; inp.min = 0; inp.max = 999; inp.value = 5;
          var b2 = el("button", "", "🔮 Tipp abgeben");
          b2.addEventListener("click", function () {
            var g = parseInt(inp.value, 10);
            if (isNaN(g) || g < 0) return;
            data.oracle = { guess: g, seen: 0, done: false, ts: Date.now() }; save(); draw();
            if (o.toast) o.toast("🔮 Das Orakel hat deinen Tipp (" + g + "×) notiert.");
          });
          var row = el("div", "mg-row"); row.appendChild(inp); row.appendChild(b2); w.appendChild(row);
        }
      }
      draw();
      GAMES.oracle.redraw = draw;
      return function () { GAMES.oracle.redraw = null; };
    }
  };
  // Vorlesungsende aus dem Countdown (nur gespeicherte Einstellung, d. h. echte Uhrzeit, kein Demo-Zeitraffer)
  function countdownEnd() {
    try { var c = JSON.parse(localStorage.getItem("anderstelle.countdown")); return c && c.end > 0 ? c.end : null; } catch (e) { return null; }
  }
  function oracleEndText() {
    if (hasUpdate) return "Die Auswertung kommt automatisch, wenn der Countdown abläuft.";
    var end = countdownEnd();
    if (end && end > Date.now()) {
      var d = new Date(end);
      return "Auswertung automatisch um " + d.getHours() + ":" + ("0" + d.getMinutes()).slice(-2) + " Uhr (Vorlesungsende laut ⏳ Countdown).";
    }
    return "⚠️ Kein Vorlesungsende bekannt – stell es im ⏳ Countdown ein, dann wird automatisch ausgewertet.";
  }
  // Seiten ohne Countdown-Uhr (index/wal-party): Ende anhand der gespeicherten Countdown-Einstellung erkennen
  function oracleCheckEnd() {
    if (hasUpdate) return;   // countdown.html wertet selbst über update() aus
    var t = data.oracle, end = countdownEnd();
    if (!t || t.done || !end) return;
    if (!t.ts) { t.ts = Date.now(); save(); }   // alter Tipp ohne Zeitstempel
    if (t.ts < end && Date.now() >= end) oracleResolve();
  }
  function oracleResolve() {
    data = load();   // frischer Stand, damit nicht zwei Tabs gleichzeitig auswerten
    var t = data.oracle;
    if (!t || t.done) return;
    var diff = Math.abs(t.guess - t.seen);
    t.done = true;
    t.verdict = diff === 0 ? "VOLLTREFFER 🎯" : diff <= 2 ? "knapp daneben 👌" : "komplett daneben 💀";
    save();
    if (diff === 0) { data.oracleWins = (data.oracleWins || 0) + 1; save(); reward(10000, "Orakel-Volltreffer"); }
    else if (diff <= 2) reward(1000, "Orakel fast richtig");
    redrawLive();
    setTimeout(function () {
      if (o.say) o.say("🔮 ORAKEL<small>Tipp " + t.guess + "× · tatsächlich " + t.seen + "× · " + t.verdict + "</small>", 5000);
      else popup("🔮 <b>Orakel-Auswertung</b><br>Tipp " + t.guess + "× · tatsächlich " + t.seen + "× · " + t.verdict, null, 15000);
    }, hasUpdate ? 6500 : 0);   // auf dem Countdown erst nach der Schluss-Party
  }

  // ================= Challenges =================
  var chal;
  var CHALLENGES = [
    ["flappy", "Schaffst du <b>10 Folien</b> bei Flappy Wal?"], ["whack", "Knackst du <b>20 Punkte</b> bei Whack-a-Wal?"],
    ["react", "Bist du schneller als <b>400 ms</b> bei Six-Seven?"], ["memory", "Memory in <b>unter 10 Zügen</b>?"],
    ["bingo", "Schon ein <b>Bingo</b>? Check deine Karte!"], ["oracle", "Das <b>Orakel</b> wartet auf deinen Tipp 🔮"],
    ["w2048", "Schaffst du den <b>🐳 Blauwal</b> bei Wal-2048?"], ["mines", "Klausur-Minesweeper in <b>unter 60 s</b>?"],
    ["snake", "Wird dein Wal <b>20 Krill</b> lang?"], ["surf", "Schaffst du <b>2.000 Punkte</b> bei Wal-Subway-Surfer?"], ["typing", "Schreibst du <b>25 Wörter</b> mit, bevor die Tafel gewischt wird?"],
    ["clicker", "Deine <b>Aura</b> wartet aufs Abholen 🗿"], ["ttt", "Besiegst du den <b>Dozenten</b> im Tic-Tac-Toe?"]
  ];
  function buildChallenge() {
    chal = document.createElement("div");
    chal.id = "mg-chal";
    document.body.appendChild(chal);
  }
  // Kleines Popup unten links; game = Spiel für den „Spielen“-Knopf (oder null)
  var chalHide = null;
  function popup(html, game, ms) {
    chal.innerHTML = html + '<div class="mg-row">' + (game ? "<button>Spielen</button>" : "") + '<button class="sec">' + (game ? "Nö" : "OK") + "</button></div>";
    var bs = chal.querySelectorAll("button");
    if (game) bs[0].onclick = function () { chal.classList.remove("on"); open(game); };
    bs[bs.length - 1].onclick = function () { chal.classList.remove("on"); };
    chal.classList.add("on");
    clearTimeout(chalHide);
    chalHide = setTimeout(function () { chal.classList.remove("on"); }, ms || 12000);
  }
  function scheduleChallenge() {
    setTimeout(function () {
      if (!modal.classList.contains("on")) {
        var c = rnd(CHALLENGES);
        popup("🎮 <b>Minigame-Challenge</b><br>" + c[1], c[0]);
      }
      scheduleChallenge();
    }, rint(360, 600) * 1000 / speed);   // alle 6–10 Minuten
  }

  // ================= Hooks =================
  var lastR = null, hasUpdate = false;
  function update(R) {
    hasUpdate = true;
    if (lastR !== null && lastR > 0 && R <= 0) oracleResolve();
    lastR = R;
  }
  function redrawLive() {
    if (GAMES.bingo.redraw) GAMES.bingo.redraw();
    if (GAMES.oracle.redraw) GAMES.oracle.redraw();
  }
  // Neue Treffer anhand des gemeinsamen Zählers verbuchen. data.lastCount liegt mit im Speicher,
  // daher zählt jeder Treffer genau einmal – egal, wie viele Tabs gleichzeitig mitlesen.
  function syncCount() {
    var n = parseInt(localStorage.getItem("anderstelle.count"), 10) || 0;
    data = load();
    var last = data.lastCount;
    if (last === n) return;
    data.lastCount = n;
    if (last != null && n > last) {
      var c = bingoCard();
      c.hits += n - last;
      if (data.oracle && !data.oracle.done) data.oracle.seen += n - last;
      save();
      bingoAutoMark();
    } else save();   // erster Start oder Zähler zurückgesetzt/−1: nur merken
    redrawLive();
  }
  function hit() { syncCount(); }   // countdown.html meldet Treffer; gezählt wird über den gemeinsamen Zähler

  global.MiniGames = { mount: mount, update: update, hit: hit, open: open, close: close, games: Object.keys(GAMES) };
})(window);
