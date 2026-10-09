/*
 * Minigames für countdown.html (lautlos, für die Vorlesung).
 *
 *   MiniGames.mount({ speed, say, toast })   Button + Fenster einbauen
 *   MiniGames.update(remainingSec)           jede Tick-Runde (für das Orakel)
 *   MiniGames.hit()                          „an der Stelle“ gehört (Bingo + Orakel)
 *
 * Spiele: Dozenten-Bingo, Flappy Wal, Whack-a-Wal, Six-Seven-Reaktion,
 * Brainrot-Memory, Orakel. Rekorde liegen in localStorage ("anderstelle.minigames").
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
    "#mg{position:fixed;inset:0;z-index:80;display:none;align-items:center;justify-content:center;background:rgba(1,12,22,.72);backdrop-filter:blur(3px);padding:12px}",
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
    "#mg-chal button.sec{background:rgba(255,255,255,.12);color:#eafcff}"
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
      var c = bingoCard();
      var info = el("div", "mg-info", "<span>Karte von heute</span><span>„an der Stelle“ seit Kartenstart: " + c.hits + "</span>");
      var grid = el("div", "mg-bingo"), msg = el("div", "mg-msg");
      function draw() {
        var wins = bingoLines(c.marked), winCells = [].concat.apply([], wins);
        grid.innerHTML = "";
        c.cells.forEach(function (t, i) {
          var d = el("div", (c.marked.indexOf(i) >= 0 ? "x " : "") + (BINGO_AUTO[t] ? "auto " : "") + (winCells.indexOf(i) >= 0 ? "win" : ""), t);
          d.addEventListener("click", function () {
            if (BINGO_AUTO[t]) { msg.textContent = "Das Feld hakt die Spracherkennung ab. Kein Schummeln 🧐"; return; }
            var k = c.marked.indexOf(i);
            if (k >= 0) c.marked.splice(k, 1); else c.marked.push(i);
            save(); bingoCheck(); draw();
          });
          grid.appendChild(d);
        });
        msg.textContent = wins.length ? "🎉 BINGO! (" + wins.length + " Reihe" + (wins.length > 1 ? "n" : "") + ")" : "Noch kein Bingo …";
      }
      var row = el("div", "mg-row");
      var nb = el("button", "sec", "🔄 Neue Karte");
      nb.addEventListener("click", function () { delete data.bingo; c = bingoCard(); draw(); });
      row.appendChild(nb);
      root.appendChild(info); root.appendChild(grid); root.appendChild(msg); root.appendChild(row);
      draw();
      GAMES.bingo.redraw = function () { info.lastChild.textContent = "„an der Stelle“ seit Kartenstart: " + c.hits; draw(); };
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
      var y, vy, pipes, score, state = "ready", raf = null, last = 0, spawnT;

      function reset() { y = H / 2; vy = 0; pipes = []; score = 0; spawnT = 0; scoreEl.textContent = 0; }
      function flap() {
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
        state = "over"; cancelAnimationFrame(raf);
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
            h.innerHTML = ""; h.removeAttribute("data-it");
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
          h.setAttribute("data-it", it); h.innerHTML = "<span>" + it + "</span>";
          timers.push(setTimeout(function () { if (h.getAttribute("data-it") === it) { h.innerHTML = ""; h.removeAttribute("data-it"); } }, rint(650, 1100)));
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
                 timer = setTimeout(function () { if (state === "go") { penalties++; msg.textContent = "Zu langsam 🐌 (+500 ms)"; times.push(1000); done(); } }, 1500); }
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
        msg.textContent = (rec ? "🏆 Neue Bestzeit! " : "") + "Ø " + avg + " ms" + (penalties ? " (inkl. " + penalties + " Fehler-Strafen)" : "") +
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
                        "<p>Seit dem Tipp gehört: <b>" + t.seen + "×</b></p><p style='color:#9fd3e0'>Die Auswertung kommt automatisch, wenn der Countdown abläuft.</p>";
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
            data.oracle = { guess: g, seen: 0, done: false }; save(); draw();
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
  function oracleResolve() {
    var t = data.oracle;
    if (!t || t.done) return;
    var diff = Math.abs(t.guess - t.seen);
    t.done = true;
    t.verdict = diff === 0 ? "VOLLTREFFER 🎯" : diff <= 2 ? "knapp daneben 👌" : "komplett daneben 💀";
    save();
    if (diff === 0) { data.oracleWins = (data.oracleWins || 0) + 1; save(); reward(10000, "Orakel-Volltreffer"); }
    else if (diff <= 2) reward(1000, "Orakel fast richtig");
    setTimeout(function () {
      if (o.say) o.say("🔮 ORAKEL<small>Tipp " + t.guess + "× · tatsächlich " + t.seen + "× · " + t.verdict + "</small>", 5000);
    }, 6500);   // nach der Schluss-Party
  }

  // ================= Challenges =================
  var chal;
  var CHALLENGES = [
    ["flappy", "Schaffst du <b>10 Folien</b> bei Flappy Wal?"], ["whack", "Knackst du <b>20 Punkte</b> bei Whack-a-Wal?"],
    ["react", "Bist du schneller als <b>400 ms</b> bei Six-Seven?"], ["memory", "Memory in <b>unter 10 Zügen</b>?"],
    ["bingo", "Schon ein <b>Bingo</b>? Check deine Karte!"], ["oracle", "Das <b>Orakel</b> wartet auf deinen Tipp 🔮"]
  ];
  function buildChallenge() {
    chal = document.createElement("div");
    chal.id = "mg-chal";
    document.body.appendChild(chal);
  }
  function scheduleChallenge() {
    setTimeout(function () {
      if (!modal.classList.contains("on")) {
        var c = rnd(CHALLENGES);
        chal.innerHTML = "🎮 <b>Minigame-Challenge</b><br>" + c[1] + '<div class="mg-row"><button>Spielen</button><button class="sec">Nö</button></div>';
        var bs = chal.querySelectorAll("button");
        bs[0].onclick = function () { chal.classList.remove("on"); open(c[0]); };
        bs[1].onclick = function () { chal.classList.remove("on"); };
        chal.classList.add("on");
        setTimeout(function () { chal.classList.remove("on"); }, 12000);
      }
      scheduleChallenge();
    }, rint(360, 600) * 1000 / speed);   // alle 6–10 Minuten
  }

  // ================= Hooks =================
  var lastR = null;
  function update(R) {
    if (lastR !== null && lastR > 0 && R <= 0) oracleResolve();
    lastR = R;
  }
  function hit() {
    var c = bingoCard();
    c.hits++; save();
    bingoAutoMark();
    if (data.oracle && !data.oracle.done) { data.oracle.seen++; save(); }
    if (GAMES.bingo.redraw) GAMES.bingo.redraw();
    if (GAMES.oracle.redraw) GAMES.oracle.redraw();
  }

  global.MiniGames = { mount: mount, update: update, hit: hit, open: open, close: close, games: Object.keys(GAMES) };
})(window);
