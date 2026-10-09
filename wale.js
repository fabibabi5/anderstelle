/*
 * Noch mehr Wale für countdown.html – läuft zusätzlich zu allen anderen Effekten.
 *
 *   Wale.mount({ speed, say, toast })   einbauen
 *   Wale.update(remainingSec)           jede Tick-Runde
 *   Wale.hit()                          „an der Stelle“ gehört
 *
 * Dauerhaft: Wal-Aquarium im Hintergrund (mit Fontänen und Babys), ein Wal folgt
 * der Maus, Klick ins Leere lässt einen Wal springen, Zähler „Wale gesichtet“.
 * Zwischendurch: Banner-Wal, Blauwal-Sonnenfinsternis, Sprung über den Timer,
 * Wal-Schule, Wal-Gesang, Wal gegen Krake, Wal-o-clock, Minuten-Fontäne.
 */
(function (global) {
  "use strict";

  function rnd(a) { return a[(Math.random() * a.length) | 0]; }
  function rint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function de(n) { return n.toLocaleString("de-DE"); }
  var reduce = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var CSS = [
    "#wale-tank{position:fixed;inset:0;z-index:3;pointer-events:none;overflow:hidden}",
    ".wl{position:absolute;left:0;top:0;line-height:1;will-change:transform;filter:drop-shadow(0 6px 12px rgba(0,0,0,.35))}",
    ".wl i{position:absolute;left:30%;top:-.55em;font-style:normal;font-size:.45em;opacity:0}",
    ".wl i.on{animation:wlSpout 1.4s ease-out}",
    "@keyframes wlSpout{0%{opacity:0;transform:translateY(10px) scale(.3)}25%{opacity:1}100%{opacity:0;transform:translateY(-40px) scale(1.4)}}",
    "#wale-fx{position:fixed;inset:0;z-index:52;pointer-events:none;overflow:hidden}",
    // Maus-Wal
    "#wale-pet{position:fixed;left:0;top:0;z-index:51;pointer-events:none;font-size:1.9rem;transition:opacity .3s;filter:drop-shadow(0 4px 8px rgba(0,0,0,.4))}",
    ".wl-bub{position:fixed;z-index:50;pointer-events:none;width:8px;height:8px;border-radius:50%;border:1.5px solid rgba(255,255,255,.7);animation:wlBub 1.2s ease-out forwards}",
    "@keyframes wlBub{to{transform:translateY(-40px) scale(1.6);opacity:0}}",
    // Sprung (Klick / über den Timer)
    ".wl-jump{position:fixed;font-size:3.4rem;line-height:1;pointer-events:none;z-index:52;animation:wlJump var(--d,1.3s) cubic-bezier(.3,.6,.5,1) forwards}",
    "@keyframes wlJump{0%{transform:translate(0,0) rotate(-35deg)}50%{transform:translate(calc(var(--dx)*.5),var(--h)) rotate(0deg)}100%{transform:translate(var(--dx),0) rotate(45deg);opacity:.2}}",
    ".wl-drop{position:fixed;width:7px;height:10px;border-radius:50% 50% 50% 50%/60% 60% 40% 40%;background:#a5e9ff;pointer-events:none;z-index:52;",
    "animation:wlDrop .9s ease-out forwards}",
    "@keyframes wlDrop{to{transform:translate(var(--x),var(--y));opacity:0}}",
    // Banner-Wal
    ".wl-banner{position:absolute;display:flex;align-items:center;gap:0;white-space:nowrap;animation:wlFly linear forwards}",
    "@keyframes wlFly{from{transform:translateX(var(--from))}to{transform:translateX(var(--to))}}",
    ".wl-banner .w{font-size:3.2rem;line-height:1}",
    ".wl-banner .rope{width:46px;height:2px;background:rgba(255,255,255,.7)}",
    ".wl-banner .flag{background:#fff;color:#04314a;font-weight:900;font-size:1.15rem;padding:7px 16px;border-radius:4px 14px 14px 4px;",
    "box-shadow:0 6px 16px rgba(0,0,0,.35);animation:wlWave 1s ease-in-out infinite alternate}",
    "@keyframes wlWave{from{transform:skewY(-3deg)}to{transform:skewY(3deg)}}",
    // Sonnenfinsternis
    ".wl-giant{position:absolute;top:8vh;font-size:min(70vw,70vh);line-height:1;opacity:.92;animation:wlFly 16s linear forwards;filter:brightness(.35) saturate(.6) drop-shadow(0 0 60px #000)}",
    "#wale-dim{position:fixed;inset:0;z-index:2;pointer-events:none;background:#000;opacity:0;transition:opacity 3s ease}",
    // Gesang
    ".wl-song{position:absolute;left:50%;top:26%;transform:translateX(-50%);font-weight:900;font-size:clamp(1.6rem,5vw,2.8rem);color:#a5e9ff;white-space:nowrap;",
    "text-shadow:0 0 20px #2e7dff;animation:wlFade 5s ease forwards}",
    ".wl-song span{display:inline-block;animation:wlWavy 1.2s ease-in-out infinite}",
    "@keyframes wlWavy{50%{transform:translateY(-14px)}}",
    "@keyframes wlFade{0%,100%{opacity:0}12%,85%{opacity:1}}",
    ".wl-ring{position:absolute;border:3px solid rgba(165,233,255,.6);border-radius:50%;animation:wlRing 2.4s ease-out forwards}",
    "@keyframes wlRing{from{width:20px;height:20px;opacity:1}to{width:70vmin;height:70vmin;opacity:0}}",
    // Kampf
    ".wl-fight{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);font-size:clamp(3rem,10vw,6rem);white-space:nowrap;animation:wlFade 4.6s ease forwards}",
    ".wl-fight span{display:inline-block;animation:wlClash .35s ease-in-out infinite alternate}",
    ".wl-fight span:last-child{animation-direction:alternate-reverse}",
    "@keyframes wlClash{from{transform:translateX(-14px) rotate(-10deg)}to{transform:translateX(14px) rotate(10deg)}}",
    // Wal-o-clock
    "#timerWrap.wl-oclock #timer{opacity:0}",
    ".wl-clock{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:clamp(2.4rem,9vw,7rem);pointer-events:none;white-space:nowrap}",
    "@media (prefers-reduced-motion:reduce){#wale-tank,#wale-pet{display:none}}"
  ].join("");

  var o = {}, speed = 1, tank, fx, pet, dim, seenEl, seen = 0, R = null, lastMin = null;
  var swimmers = [];

  function mount(opts) {
    o = opts || {};
    speed = o.speed || 1;
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
    tank = add("div", "wale-tank"); fx = add("div", "wale-fx"); dim = add("div", "wale-dim");

    var row = document.querySelector(".row");
    if (row) { var p = document.createElement("div"); p.className = "pill"; p.innerHTML = "Wale gesichtet: <b>0</b>"; row.appendChild(p); seenEl = p.querySelector("b"); }

    if (!reduce) { for (var i = 0; i < 7; i++) spawnSwimmer(true); requestAnimationFrame(swimLoop); }
    initPet();
    initClick();

    every(40, 80, banner);
    every(150, 280, eclipse);
    every(60, 120, breachTimer);
    every(110, 200, pod);
    every(100, 180, song);
    every(220, 380, fight);
    every(240, 360, oclock);
  }
  function add(tag, id) { var e = document.createElement(tag); e.id = id; document.body.appendChild(e); return e; }
  function every(a, b, fn) {
    (function next() { setTimeout(function () { try { fn(); } catch (e) {} next(); }, rint(a, b) * 1000 / speed); })();
  }
  function count(n) { seen += n; if (seenEl) seenEl.textContent = de(seen); }
  function urgent() { return R !== null && R > 0 && R <= 600; }

  // ---------------- Aquarium ----------------
  function spawnSwimmer(initial) {
    var depth = Math.random();                       // 0 = weit hinten, 1 = vorne
    var size = 1.6 + depth * 3.8;
    var ltr = Math.random() < 0.5;
    var s = {
      el: document.createElement("div"), depth: depth, ltr: ltr,
      x: initial ? Math.random() * innerWidth : (ltr ? -200 : innerWidth + 200),
      y: rint(8, 88) / 100 * innerHeight, vx: (18 + depth * 40) * (ltr ? 1 : -1),
      phase: Math.random() * 6.28, nextSpout: Date.now() + rint(2000, 9000)
    };
    var baby = Math.random() < 0.3;
    s.el.className = "wl";
    s.el.style.fontSize = size + "rem";
    s.el.style.opacity = (0.25 + depth * 0.55).toFixed(2);
    s.el.innerHTML = '<span style="display:inline-block;transform:scaleX(' + (ltr ? -1 : 1) + ')">' + rnd(["🐋", "🐳", "🐋"]) + "</span><i>💦</i>" +
                     (baby ? '<span style="position:absolute;font-size:.45em;top:60%;' + (ltr ? "right:105%" : "left:105%") +
                     ';transform:scaleX(' + (ltr ? -1 : 1) + ')">🐳</span>' : "");
    tank.appendChild(s.el);
    swimmers.push(s);
    if (!initial) count(baby ? 2 : 1);
  }
  var lastT = 0;
  function swimLoop(t) {
    var dt = Math.min(0.05, (t - lastT) / 1000 || 0); lastT = t;
    var boost = urgent() ? 2.2 : 1;
    for (var i = swimmers.length - 1; i >= 0; i--) {
      var s = swimmers[i];
      s.x += s.vx * dt * boost * Math.min(speed, 4);
      s.phase += dt * 1.6;
      var y = s.y + Math.sin(s.phase) * 12;
      s.el.style.transform = "translate(" + s.x.toFixed(1) + "px," + y.toFixed(1) + "px) rotate(" + (Math.cos(s.phase) * 4).toFixed(1) + "deg)";
      if (Date.now() > s.nextSpout) {
        var sp = s.el.querySelector("i");
        sp.classList.remove("on"); void sp.offsetWidth; sp.classList.add("on");
        s.nextSpout = Date.now() + rint(4000, 12000);
      }
      if (s.x < -260 || s.x > innerWidth + 260) { s.el.remove(); swimmers.splice(i, 1); spawnSwimmer(false); }
    }
    requestAnimationFrame(swimLoop);
  }

  // ---------------- Maus-Wal ----------------
  function initPet() {
    if (reduce || !(global.matchMedia && global.matchMedia("(hover: hover)").matches)) return;   // nur mit Maus
    pet = add("div", "wale-pet"); pet.textContent = "🐳"; pet.style.opacity = 0;
    var mx = -100, my = -100, px = -100, py = -100, lastBub = 0;
    document.addEventListener("pointermove", function (e) { mx = e.clientX; my = e.clientY; pet.style.opacity = 1; });
    document.addEventListener("pointerleave", function () { pet.style.opacity = 0; });
    (function follow() {
      var hidden = document.querySelector("#mg.on");   // während Minigames nicht stören
      pet.style.visibility = hidden ? "hidden" : "visible";
      var dx = mx + 22 - px, dy = my + 16 - py;
      px += dx * 0.08; py += dy * 0.08;
      pet.style.transform = "translate(" + px + "px," + py + "px) scaleX(" + (dx > 0 ? -1 : 1) + ")";
      if (!hidden && Math.abs(dx) + Math.abs(dy) > 40 && Date.now() - lastBub > 120) {
        lastBub = Date.now();
        var b = document.createElement("div"); b.className = "wl-bub";
        b.style.left = (px + 10) + "px"; b.style.top = (py + 10) + "px";
        document.body.appendChild(b); setTimeout(function () { b.remove(); }, 1300);
      }
      requestAnimationFrame(follow);
    })();
  }

  // ---------------- Klick ins Leere: Wal springt ----------------
  function initClick() {
    document.addEventListener("click", function (e) {
      if (e.target.closest("button,input,a,label,#mg,#mg-chal,#diag,.mb,.dialog")) return;
      jump(e.clientX, innerHeight + 10, rint(-120, 120), -rint(160, 260), 1.2);
      count(1);
    });
  }
  function jump(x, y, dx, h, dur, emoji) {
    var j = document.createElement("div");
    j.className = "wl-jump"; j.textContent = emoji || rnd(["🐳", "🐋", "🐬"]);
    j.style.left = (x - 28) + "px"; j.style.top = (y - 50) + "px";
    j.style.setProperty("--dx", dx + "px"); j.style.setProperty("--h", h + "px"); j.style.setProperty("--d", dur + "s");
    document.body.appendChild(j);
    splash(x, Math.min(y, innerHeight - 10), 10);
    setTimeout(function () { splash(x + dx, Math.min(y, innerHeight - 10), 14); j.remove(); }, dur * 1000);
  }
  function splash(x, y, n) {
    for (var i = 0; i < n; i++) {
      var d = document.createElement("div"); d.className = "wl-drop";
      d.style.left = x + "px"; d.style.top = y + "px";
      d.style.setProperty("--x", rint(-70, 70) + "px"); d.style.setProperty("--y", -rint(30, 120) + "px");
      document.body.appendChild(d);
      (function (el) { setTimeout(function () { el.remove(); }, 950); })(d);
    }
  }

  // ---------------- Ereignisse ----------------
  function bannerText() {
    var ads = parseInt(localStorage.getItem("anderstelle.count"), 10) || 0;
    var m = R !== null ? Math.ceil(Math.max(0, R) / 60) : null;
    var list = ["Grüße an Reihe 4 👋", "Mensa heute: Krill 🦐", "Wal-Gewerkschaft fordert kürzere Vorlesungen ✊",
                "„an der Stelle“ heute: " + ads + "×", "Blubb. 🫧", "Hier könnte Ihre Werbung schwimmen", "Bitte nicht füttern 🚫🍟",
                "Wale gesichtet: " + de(seen), "Nicht einschlafen! 👀", "🐳 > 📊"];
    if (m !== null && R > 0) list.push("Noch " + m + " Min.!", "Noch " + m + " Min. – durchhalten!");
    if (R !== null && R <= 0) list.push("ÜBERZIEHUNG 😭", "Wir wollen raus! 🐳🚪");
    return rnd(list);
  }
  function banner() {
    var b = document.createElement("div"), ltr = Math.random() < 0.5;
    b.className = "wl-banner";
    b.style.top = rint(6, 22) + "vh";
    b.style.setProperty("--from", ltr ? "-70vw" : "110vw"); b.style.setProperty("--to", ltr ? "110vw" : "-70vw");
    b.style.animationDuration = rint(14, 18) + "s";
    var w = '<span class="w" style="display:inline-block;transform:scaleX(' + (ltr ? -1 : 1) + ')">🐋</span>';
    var parts = ['<span class="flag">' + bannerText() + "</span>", '<span class="rope"></span>', w];
    b.innerHTML = (ltr ? parts : parts.reverse()).join("");
    fx.appendChild(b);
    setTimeout(function () { b.remove(); }, 18500);
    count(1);
  }
  function eclipse() {
    var g = document.createElement("div"), ltr = Math.random() < 0.5;
    g.className = "wl-giant";
    // Spiegelung am inneren Element, weil die Flug-Animation transform am äußeren setzt
    g.innerHTML = '<span style="display:inline-block;transform:scaleX(' + (ltr ? -1 : 1) + ')">🐋</span>';
    g.style.setProperty("--from", ltr ? "-110vw" : "110vw"); g.style.setProperty("--to", ltr ? "110vw" : "-110vw");
    tank.appendChild(g);
    dim.style.opacity = 0.45;
    if (o.toast) o.toast("🌑 Blauwal-Sonnenfinsternis. Bitte nicht direkt hinschauen.");
    setTimeout(function () { dim.style.opacity = 0; }, 10000);
    setTimeout(function () { g.remove(); }, 16200);
    count(1);
  }
  function timerRect() { var t = document.getElementById("timerWrap"); return t ? t.getBoundingClientRect() : { left: innerWidth / 3, right: innerWidth * 2 / 3, top: 100, bottom: 300, width: innerWidth / 3 }; }
  function breachTimer() {
    var r = timerRect();
    jump(r.left - 20, r.bottom + 20, r.width + 40, -(r.bottom - r.top + 120), 1.8, "🐋");
    if (o.toast) o.toast(rnd(["🐋 Wal-Sprung über die Zeit!", "Ein Wal hat die Zeit übersprungen (leider nur optisch)", "Splash! 💦"]));
    count(1);
  }
  function pod() {
    var n = rint(5, 9), ltr = Math.random() < 0.5, top = rint(20, 65);
    for (var i = 0; i < n; i++) {
      var w = document.createElement("div");
      w.className = "wl-banner";
      var row = Math.floor((i + 1) / 2), side = i % 2 ? 1 : -1;
      w.style.top = "calc(" + top + "vh + " + (row * side * 34) + "px)";
      w.style.setProperty("--from", ltr ? (-20 - row * 6) + "vw" : (105 + row * 6) + "vw");
      w.style.setProperty("--to", ltr ? (110 - row * 6) + "vw" : (-30 + row * 6) + "vw");
      w.style.animationDuration = "9s";
      w.innerHTML = '<span class="w" style="font-size:2.2rem;display:inline-block;transform:scaleX(' + (ltr ? -1 : 1) + ')">' + (i ? "🐳" : "🐋") + "</span>";
      fx.appendChild(w);
      (function (el) { setTimeout(function () { el.remove(); }, 9200); })(w);
    }
    if (o.toast) o.toast("🐳 Wal-Schule auf Klassenfahrt (" + n + " Wale)");
    count(n);
  }
  var SONGS = ["uuuuuuuuuh 🎶", "ooooOOOOooo 🎵", "wuuuuu-iiiiii 🎶", "*Wal-Gesang in d-Moll* 🎻", "mmmmmmmmMMMM 🎶"];
  function song() {
    var s = document.createElement("div");
    s.className = "wl-song";
    // Array.from statt split(""), sonst werden Emojis (Surrogatpaare) zerhackt
    s.innerHTML = Array.from(rnd(SONGS)).map(function (ch, i) { return '<span style="animation-delay:' + (i * 0.07) + 's">' + (ch === " " ? "&nbsp;" : ch) + "</span>"; }).join("");
    fx.appendChild(s);
    var r = timerRect();
    for (var i = 0; i < 4; i++) (function (k) {
      setTimeout(function () {
        var ring = document.createElement("div"); ring.className = "wl-ring";
        ring.style.left = (r.left + r.width / 2) + "px"; ring.style.top = (r.top + (r.bottom - r.top) / 2) + "px";
        ring.style.transform = "translate(-50%,-50%)";
        fx.appendChild(ring); setTimeout(function () { ring.remove(); }, 2500);
      }, k * 500);
    })(i);
    setTimeout(function () { s.remove(); }, 5100);
  }
  function fight() {
    var f = document.createElement("div");
    f.className = "wl-fight";
    f.innerHTML = "<span>🐳</span>💥<span>🦑</span>";
    fx.appendChild(f);
    setTimeout(function () {
      if (o.say) o.say("🐳 WAL GEWINNT! 🏆<small>Die Krake muss die Vorlesung zu Ende hören</small>", 3200);
    }, 3000);
    setTimeout(function () { f.remove(); }, 4700);
    count(1);
  }
  function oclock() {
    var wrap = document.getElementById("timerWrap");
    if (!wrap) return;
    var c = document.createElement("div");
    c.className = "wl-clock";
    c.textContent = "🐳🐳:🐋🐋";
    wrap.appendChild(c);
    wrap.classList.add("wl-oclock");
    if (o.toast) o.toast("🕰️ Es ist Wal-o-clock.");
    setTimeout(function () { wrap.classList.remove("wl-oclock"); c.remove(); }, 2600);
    count(4);
  }
  // jede volle Minute eine kleine Fontäne aus dem Timer
  function minuteSpout() {
    var r = timerRect();
    for (var i = 0; i < 3; i++) splash(r.left + r.width * (0.25 + i * 0.25), r.top + 10, 8);
  }

  // ---------------- Hooks ----------------
  function update(rem) {
    R = rem;
    var m = Math.floor(Math.max(0, rem) / 60);
    if (lastMin !== null && m !== lastMin && rem > 0) minuteSpout();
    lastMin = m;
  }
  function hit() {
    var r = timerRect();
    for (var i = 0; i < 6; i++) (function (k) {
      setTimeout(function () { jump(rint(20, innerWidth - 80), innerHeight + 10, rint(-150, 150), -rint(220, 420), 1.4); }, k * 140);
    })(i);
    splash(r.left + r.width / 2, r.top, 20);
    count(6);
  }

  global.Wale = {
    mount: mount, update: update, hit: hit,
    events: { banner: banner, eclipse: eclipse, breachTimer: breachTimer, pod: pod, song: song, fight: fight, oclock: oclock, minuteSpout: minuteSpout }
  };
})(window);
