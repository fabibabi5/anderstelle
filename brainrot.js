/*
 * Brainrot-Erweiterung für countdown.html.
 *
 *   Brainrot.mount({ speed, say, toast })   einbauen (say/toast kommen aus countdown.html)
 *   Brainrot.update(pct)                    Fortschritt 0..100
 *   Brainrot.hit()                          „an der Stelle“ gehört
 *
 * Enthält: Aura-Zähler, Brainrot-Pegel, Italian-Brainrot-Parade, TikTok-Untertitel
 * mit Subway-Surfers-Fenster, Fanum Tax, Skibidi, Mewing-Pause, Aura-Farming,
 * Chill Guy und einen Schalter für Brainrot-Sprache.
 */
(function (global) {
  "use strict";

  function rnd(a) { return a[(Math.random() * a.length) | 0]; }
  function rint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function de(n) { return n.toLocaleString("de-DE"); }

  var CSS = [
    // Läufer (Parade, Chill Guy, Boot …)
    ".br-walker{position:fixed;left:0;z-index:46;pointer-events:none;display:flex;flex-direction:column;align-items:center;",
    "animation:brWalk linear forwards}",
    "@keyframes brWalk{from{transform:translateX(var(--from))}to{transform:translateX(var(--to))}}",
    ".br-char{font-size:clamp(3rem,9vw,5rem);line-height:1;animation:brBob .4s ease-in-out infinite alternate;filter:drop-shadow(0 6px 10px rgba(0,0,0,.45))}",
    ".br-char.sway{animation:brSway .8s ease-in-out infinite alternate}",
    "@keyframes brBob{to{transform:translateY(-12px) rotate(4deg)}}",
    "@keyframes brSway{from{transform:rotate(-12deg)}to{transform:rotate(12deg)}}",
    ".br-name{margin-top:6px;background:rgba(0,0,0,.6);color:#fff;font-weight:900;font-size:.95rem;padding:4px 10px;border-radius:8px;white-space:nowrap}",
    ".br-name small{display:block;font-weight:600;font-size:.75rem;opacity:.85;text-align:center}",
    // TikTok-Untertitel
    ".br-cap{position:fixed;left:50%;bottom:16vh;transform:translateX(-50%);z-index:66;pointer-events:none;width:min(90vw,820px);",
    "text-align:center;font-weight:900;font-size:clamp(1.6rem,5vw,3.1rem);line-height:1.15;color:#fff;font-family:'Arial Black',Impact,sans-serif;",
    "text-shadow:-3px -3px 0 #000,3px -3px 0 #000,-3px 3px 0 #000,3px 3px 0 #000,0 6px 12px rgba(0,0,0,.6)}",
    ".br-cap span{display:inline-block;margin:0 .14em;animation:brWord .18s cubic-bezier(.2,1.8,.4,1)}",
    ".br-cap span.y{color:#ffe600}.br-cap span.g{color:#39ff14}",
    "@keyframes brWord{from{transform:scale(.3);opacity:0}}",
    // Subway Surfers
    ".br-subway{position:fixed;right:12px;top:50%;width:150px;height:270px;margin-top:-135px;z-index:44;border-radius:16px;overflow:hidden;",
    "border:3px solid #fff;box-shadow:0 14px 40px rgba(0,0,0,.5);pointer-events:none;",
    "background:repeating-linear-gradient(180deg,#6b4f2a 0 6px,#8a6a3c 6px 28px),#8a6a3c;animation:brTrack .35s linear infinite;",
    "transform:translateX(200px);transition:transform .5s cubic-bezier(.3,1.4,.4,1)}",
    ".br-subway.on{transform:translateX(0)}",
    "@keyframes brTrack{to{background-position:0 28px}}",
    ".br-subway::before,.br-subway::after{content:'';position:absolute;top:0;bottom:0;width:3px;background:rgba(200,200,200,.8)}",
    ".br-subway::before{left:33%}.br-subway::after{left:66%}",
    ".br-subway .lbl{position:absolute;left:0;right:0;top:0;background:rgba(0,0,0,.65);color:#fff;font:800 11px/1.3 sans-serif;text-align:center;padding:4px;z-index:3;white-space:nowrap}",
    ".br-subway .score{position:absolute;right:6px;top:26px;color:#ffe600;font:900 13px sans-serif;text-shadow:0 2px 0 #000;z-index:3}",
    ".br-subway .runner{position:absolute;bottom:14px;font-size:32px;width:50px;text-align:center;transition:left .18s ease;z-index:2;",
    "animation:brRun .25s steps(2) infinite}",
    "@keyframes brRun{50%{transform:translateY(-4px)}}",
    ".br-subway .obj{position:absolute;top:-50px;width:50px;text-align:center;font-size:30px;animation:brFall linear forwards}",
    "@keyframes brFall{to{transform:translateY(340px)}}",
    // Skibidi
    ".br-rise{position:fixed;bottom:-140px;z-index:47;pointer-events:none;font-size:5rem;text-align:center;animation:brRise 3.2s ease-in-out forwards}",
    ".br-rise b{display:block;font-size:1.1rem;color:#fff;background:#000;padding:2px 8px;border-radius:6px}",
    "@keyframes brRise{0%,100%{transform:translateY(0)}25%,75%{transform:translateY(-170px)}35%,65%{transform:translateY(-160px) rotate(8deg)}}",
    // Fanum Tax / Aura-Pops
    ".br-badge{position:absolute;z-index:5;pointer-events:none;font-weight:900;white-space:nowrap;padding:5px 12px;border-radius:999px;",
    "animation:brBadge 2.2s ease-out forwards;font-size:1.1rem}",
    "@keyframes brBadge{0%{transform:scale(.3) rotate(-10deg);opacity:0}15%{transform:scale(1.15) rotate(3deg);opacity:1}80%{opacity:1}100%{transform:translateY(-40px);opacity:0}}",
    ".br-aura-up{color:#39ff14}.br-aura-down{color:#ff6b6b}",
    "#timerWrap.br-taxed #timer{animation:brTax .6s ease}",
    "@keyframes brTax{30%{transform:scale(.92);filter:grayscale(1)}}",
    // Mewing
    ".br-mew{position:fixed;inset:0;z-index:68;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;",
    "background:rgba(0,0,0,.82);color:#fff;font-weight:900;text-align:center;animation:brFade 3.4s ease forwards}",
    ".br-mew div{font-size:clamp(5rem,20vw,11rem)}.br-mew p{font-size:clamp(1.2rem,4vw,2rem);margin:8px 16px}",
    "@keyframes brFade{0%,100%{opacity:0}10%,85%{opacity:1}}",
    "body.br-npc .world{filter:grayscale(.85) contrast(1.1)}",
    "@media (max-width:640px){.br-subway{width:110px;height:200px;margin-top:-100px;right:6px}.br-subway .runner{font-size:24px;width:36px}.br-subway .obj{font-size:22px;width:36px}}",
    "@media (prefers-reduced-motion:reduce){.br-char,.br-subway,.br-subway .runner{animation:none!important}}"
  ].join("");

  // ---------------- Inhalte ----------------
  var ITALIANS = [
    ["🦈👟", "Tralalero Tralala", "Hai mit drei Nikes"],
    ["🪵🥁", "Tung Tung Tung Sahur", "Holzstamm mit Baseballschläger"],
    ["🐊✈️", "Bombardiro Crocodilo", "Krokodil-Bomber über dem Hörsaal"],
    ["🩰☕", "Ballerina Cappuccina", "mi-mi-mi-mi"],
    ["🐒🍌", "Chimpanzini Bananini", "wa-wa-wa"],
    ["🌵🐘", "Lirilì Larilà", "Kaktus-Elefant mit Sandalen"],
    ["🌳🦶", "Brr Brr Patapim", "Baum mit sehr großen Füßen"],
    ["☕🔪", "Cappuccino Assassino", "lautlos, tödlich, koffeinhaltig"],
    ["🍓🐘", "Strawberry Elephant", "selten. sehr selten."],
    ["🐸🛞", "Boneca Ambalabu", "Frosch mit Reifen-Beinen"]
  ];
  var STORIES = [
    "POV: der Dozent sagt zum 67. Mal „an der Stelle“ und du bist der Einzige, der mitzählt 💀",
    "AITA weil ich seit 40 Minuten nur auf diesen Countdown starre? Edit: danke für das Gold",
    "Niemand: … Absolut niemand: … Der Dozent: „Nur noch eine Folie“",
    "Tralalero Tralala hat mehr Aura als diese komplette Vorlesung, no cap",
    "Mein Gehirn nach 60 Minuten Vorlesung: 🧠 ➡️ 🫠 Brainrot-Speedrun any%",
    "Story time: Ich hab einmal mitgeschrieben. Hab mich nie wieder davon erholt.",
    "Wenn der Beamer flackert und alle so tun als wär nichts 😐",
    "Bro dachte die Vorlesung ist pünktlich vorbei 💀💀💀",
    "Der Dozent hat gerade „Gibt es Fragen?“ gesagt und der ganze Saal hat Mewing angefangen 🤫🧏",
    "Wenn du merkst, dass Folie 3 von 87 ist 🥀"
  ];
  var PHRASES = [
    "no cap, das ist die längste Vorlesung ever 🧢", "bro ist komplett cooked 💀", "only in Ohio 🌽",
    "das ist lowkey crazy fr fr", "W Vorlesung? Nein. L Vorlesung.", "NPC-Modus: nicken, nicken, nicken 🤖",
    "Sigma-Grindset: 0 Fragen gestellt 🗿", "Crashout-Gefahr: hoch 📈", "Delulu is the solulu 🌈",
    "Dozent mogged gerade den ganzen Saal 🗿", "it's giving … Montagmorgen", "Skibidi-Vorlesung 🚽",
    "Unc-Status: Dozent erklärt Overhead-Projektor 👴", "Rizz-Level des Beamers: 0 📽️", "Gehirn: 3 % Akku 🔋",
    "ate and left no crumbs (die Mensa) 🍝", "Clanker-Alarm: Beamer piept 🤖", "das ist Rage Bait und ich fall drauf rein 😤",
    "tuff 🥶", "Aura-Check läuft … 🔍"
  ];
  var AURA_EVENTS = [
    [+500, "nicht gegähnt"], [+1000, "Augenkontakt mit der Uhr"], [-1000, "Dozent hat dich angeguckt"],
    [+67, "six seven"], [-300, "Handy fallen gelassen"], [+2000, "Snack lautlos geöffnet"],
    [-500, "zu laut geniest"], [+150, "mitgeschrieben (Fake)"], [-2000, "beim Einschlafen gezuckt"],
    [+420, "Folie vorhergesagt"], [-67, "„an der Stelle“ verpasst"], [+999, "cool geblieben"]
  ];
  var LEVELS = [[0, "gesund 🧠"], [15, "leicht cooked 🍳"], [35, "cooked 💀"], [55, "well done 🔥"],
                [75, "Ohio-Final-Boss 🌽"], [92, "komplett verrottet 🫠"]];

  // Übersetzung der Countdown-Seite in Brainrot-Sprache
  var TRANSLATE = [
    ["h1", "⏳ Noch bis <span>Vorlesungsende</span> 🐳", "⏳ bro wann ist die <span>Lecture</span> endlich over 💀"],
    ["#p90", "90 min ab jetzt", "90 min grinden 🗿"],
    ["#p45", "45 min ab jetzt", "45 min (Unc-Modus)"],
    ["#gag", "🎲 Gag", "🎲 Brainrot"]
  ];
  var PILL_LABELS = [["„an der Stelle“ bisher: ", "„an der Stelle“-Rizz: "], ["Geschafft: ", "Grind-Fortschritt: "], ["Uhrzeit: ", "Ohio-Zeit: "]];

  // ---------------- Zustand ----------------
  var o = {}, speed = 1, aura = 0, rot = 0, pct = 0, brainLang = false;
  var auraEl, rotEl, subwayEl, capEl, subwayTimer = null, subwayStop = 0, subwayKeep = false;

  function mount(opts) {
    o = opts || {};
    speed = o.speed || 1;
    var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);

    // Pills: Aura + Brainrot-Pegel
    var row = document.querySelector(".row");
    var p1 = document.createElement("div"); p1.className = "pill"; p1.innerHTML = "Aura: <b>0</b>";
    var p2 = document.createElement("div"); p2.className = "pill"; p2.innerHTML = "Brainrot: <b>gesund 🧠</b>";
    row.appendChild(p1); row.appendChild(p2);
    auraEl = p1.querySelector("b"); rotEl = p2.querySelector("b");

    // Schalter in den Einstellungen
    var settings = document.querySelector(".settings");
    var b1 = button("🧠 Brainrot-Sprache", function () { setLang(!brainLang); });
    var b2 = button("🚇 Aufmerksamkeits-Hilfe", function () {
      subwayKeep = !subwayKeep; b2.textContent = subwayKeep ? "🚇 Hilfe: an" : "🚇 Aufmerksamkeits-Hilfe";
      if (subwayKeep) showSubway(0); else hideSubway();
    });
    settings.appendChild(b1); settings.appendChild(b2);
    b1.id = "br-lang";

    capEl = document.createElement("div"); capEl.className = "br-cap"; document.body.appendChild(capEl);
    buildSubway();

    try { if (localStorage.getItem("anderstelle.brainrot.lang") === "1") setLang(true); } catch (e) {}

    loop(EVENTS_MAIN, 18, 40);   // Brainrot-Ereignisse
    loop([caption], 55, 100);   // TikTok-Untertitel
    setTimeout(function () { changeAura(rnd(AURA_EVENTS)); }, 4000 / speed);
  }

  function button(text, fn) {
    var b = document.createElement("button"); b.className = "sec"; b.textContent = text;
    b.addEventListener("click", fn); return b;
  }
  function loop(list, minS, maxS) {
    (function next() {
      setTimeout(function () { try { rnd(list)(); } catch (e) {} next(); }, rint(minS, maxS) * 1000 / speed);
    })();
  }
  function bump(n) { rot = Math.min(100, rot + n); renderRot(); }
  function toast(t, ms) { if (o.toast) o.toast(t, ms); }
  function say(h, ms, st) { if (o.say) o.say(h, ms, st); }

  // ---------------- Aura & Pegel ----------------
  function changeAura(ev) {
    aura += ev[0];
    auraEl.textContent = (aura > 0 ? "+" : "") + de(aura);
    var b = document.createElement("div");
    b.className = "br-badge " + (ev[0] >= 0 ? "br-aura-up" : "br-aura-down");
    b.style.background = "rgba(0,0,0,.7)";
    b.textContent = (ev[0] > 0 ? "+" : "") + de(ev[0]) + " Aura · " + ev[1];
    var r = auraEl.getBoundingClientRect();
    b.style.position = "fixed"; b.style.left = Math.max(8, Math.min(innerWidth - 260, r.left - 40)) + "px"; b.style.top = (r.top - 40) + "px";
    document.body.appendChild(b);
    setTimeout(function () { b.remove(); }, 2300);
    bump(1);
  }
  function renderRot() {
    var v = Math.min(100, pct * 0.75 + rot), name = LEVELS[0][1];
    for (var i = 0; i < LEVELS.length; i++) if (v >= LEVELS[i][0]) name = LEVELS[i][1];
    rotEl.textContent = name;
  }

  // ---------------- Ereignisse ----------------
  function walker(html, opts) {
    var w = document.createElement("div");
    w.className = "br-walker";
    w.innerHTML = html;
    var ltr = Math.random() < 0.5;
    w.style.setProperty("--from", ltr ? "-40vw" : "110vw");
    w.style.setProperty("--to", ltr ? "110vw" : "-40vw");
    w.style.bottom = (opts.bottom || rint(6, 30)) + "vh";
    var dur = opts.dur || 8;
    w.style.animationDuration = dur + "s";
    if (!ltr) { var c = w.querySelector(".br-char"); if (c && opts.flip) c.style.transform = "scaleX(-1)"; }
    document.body.appendChild(w);
    setTimeout(function () { w.remove(); }, dur * 1000 + 100);
  }

  function italian() {
    var c = rnd(ITALIANS);
    walker('<div class="br-char">' + c[0] + '</div><div class="br-name">' + c[1] + "<small>" + c[2] + "</small></div>", { dur: 9 });
    say(c[0] + " " + c[1].toUpperCase() + " " + c[0], 2600, { top: "22%", fontSize: "clamp(1.4rem,4.5vw,2.8rem)" });
    bump(3);
  }
  function phrase() { toast(rnd(PHRASES), 4500); bump(1); }
  function auraEvent() { changeAura(rnd(AURA_EVENTS)); }
  function fanumTax() {
    var wrap = document.getElementById("timerWrap");
    var s = rint(2, 7);
    var b = document.createElement("div");
    b.className = "br-badge"; b.style.background = "#ff3b30"; b.style.color = "#fff";
    b.style.right = "-10px"; b.style.top = "-14px";
    b.textContent = "🍟 Fanum Tax: −" + s + " s";
    wrap.appendChild(b);
    wrap.classList.remove("br-taxed"); void wrap.offsetWidth; wrap.classList.add("br-taxed");
    setTimeout(function () { b.remove(); wrap.classList.remove("br-taxed"); }, 2300);
    toast("Fanum hat " + s + " Sekunden deiner Freizeit besteuert 🍟 (keine Sorge, nur Spaß)");
    bump(2);
  }
  function skibidi() {
    var r = document.createElement("div");
    r.className = "br-rise"; r.style.left = rint(5, 80) + "vw";
    r.innerHTML = "🚽<b>skibidi</b>";
    document.body.appendChild(r);
    setTimeout(function () { r.remove(); }, 3300);
    bump(2);
  }
  function mewing() {
    var m = document.createElement("div");
    m.className = "br-mew";
    m.innerHTML = "<div>🤫🧏‍♂️</div><p>Mewing-Pause. Kiefer anspannen. Nichts sagen.</p>";
    document.body.appendChild(m);
    setTimeout(function () { m.remove(); }, 3500);
    bump(2);
  }
  function auraFarming() {
    walker('<div class="br-char sway">🛶🕺</div><div class="br-name">Aura Farming<small>+10.000 Aura pro Paddelschlag</small></div>', { dur: 11, bottom: 8 });
    setTimeout(function () { changeAura([10000, "Aura Farming"]); }, 2500);
  }
  function chillGuy() {
    walker('<div class="br-char">🐕</div><div class="br-name">Chill Guy<small>„bin nur ein chill guy, der aufs Ende wartet“</small></div>', { dur: 12, bottom: 6 });
    bump(1);
  }
  function npc() {
    document.body.classList.add("br-npc");
    toast("🤖 NPC-Modus aktiviert. Bitte weiter nicken.", 4000);
    setTimeout(function () { document.body.classList.remove("br-npc"); }, 5000);
    bump(1);
  }
  function L() {
    say("L + ratio + Vorlesung 💀", 2200, { top: "68%", fontSize: "clamp(1.4rem,4vw,2.4rem)" });
    bump(1);
  }
  var EVENTS_MAIN = [italian, italian, italian, phrase, phrase, auraEvent, auraEvent, fanumTax, skibidi, mewing, auraFarming, chillGuy, npc, L];

  // ---------------- TikTok-Untertitel + Subway Surfers ----------------
  function caption(text) {
    text = text || rnd(STORIES);
    var words = text.split(" "), i = 0;
    showSubway(words.length * 330 + 6000);
    capEl.innerHTML = "";
    (function nextWord() {
      if (i >= words.length) { setTimeout(function () { capEl.innerHTML = ""; }, 1800); return; }
      // immer nur 3 Wörter gleichzeitig, wie bei TikTok
      if (i % 3 === 0) capEl.innerHTML = "";
      var s = document.createElement("span");
      s.textContent = words[i];   // Abstand kommt per CSS (inline-block verschluckt Leerzeichen)
      if (Math.random() < 0.3) s.className = Math.random() < 0.7 ? "y" : "g";
      capEl.appendChild(s);
      i++;
      setTimeout(nextWord, 330);
    })();
    bump(3);
  }

  function buildSubway() {
    subwayEl = document.createElement("div");
    subwayEl.className = "br-subway";
    subwayEl.innerHTML = '<div class="lbl">🧠 Fokus-Hilfe</div><div class="score">🪙 0</div><div class="runner">🏃</div>';
    document.body.appendChild(subwayEl);
  }
  var lane = 1, coins = 0;
  function laneX(l) { return (l * 33.33 + 16.66) + "%"; }
  function showSubway(ms) {
    subwayEl.classList.add("on");
    var runner = subwayEl.querySelector(".runner"), score = subwayEl.querySelector(".score");
    runner.style.left = "calc(" + laneX(lane) + " - " + (runner.offsetWidth / 2) + "px)";
    subwayStop = Math.max(subwayStop, Date.now() + ms);
    if (subwayTimer) return;
    subwayTimer = setInterval(function () {
      if (!subwayKeep && Date.now() > subwayStop) { hideSubway(); return; }
      // Hindernis oder Münze in zufälliger Spur
      var l = rint(0, 2), obj = document.createElement("div");
      obj.className = "obj"; obj.textContent = Math.random() < 0.55 ? "🚆" : "🪙";
      obj.style.left = "calc(" + laneX(l) + " - " + (runner.offsetWidth / 2) + "px)";   // .obj ist so breit wie der Läufer
      obj.style.animationDuration = "1.1s";
      subwayEl.appendChild(obj);
      setTimeout(function () { obj.remove(); }, 1150);
      // Läufer weicht Zügen aus und sammelt Münzen
      if (obj.textContent === "🚆" && l === lane) lane = (lane + rnd([1, 2])) % 3;
      else if (obj.textContent === "🪙") { lane = l; setTimeout(function () { coins += 1; score.textContent = "🪙 " + de(coins); }, 900); }
      runner.style.left = "calc(" + laneX(lane) + " - " + (runner.offsetWidth / 2) + "px)";
    }, 600);
  }
  function hideSubway() {
    subwayEl.classList.remove("on");
    clearInterval(subwayTimer); subwayTimer = null;
  }

  // ---------------- Sprache ----------------
  function setLang(on) {
    brainLang = on;
    try { localStorage.setItem("anderstelle.brainrot.lang", on ? "1" : "0"); } catch (e) {}
    TRANSLATE.forEach(function (t) { var el = document.querySelector(t[0]); if (el) el.innerHTML = on ? t[2] : t[1]; });
    var pills = document.querySelectorAll(".row .pill");
    PILL_LABELS.forEach(function (l, i) { if (pills[i] && pills[i].firstChild) pills[i].firstChild.nodeValue = on ? l[1] : l[0]; });
    var b = document.getElementById("br-lang");
    if (b) b.textContent = on ? "🧠 Brainrot-Sprache: an" : "🧠 Brainrot-Sprache";
  }

  // ---------------- Hooks ----------------
  function update(p) { pct = p; renderRot(); }
  function hit() {
    changeAura([6767, "„an der Stelle“ erkannt"]);
    say("W DOZENT 🐳 +6767 AURA", 2200, { top: "30%", fontSize: "clamp(1.6rem,5vw,3rem)" });
  }

  global.Brainrot = {
    mount: mount, update: update, hit: hit,
    // für Tests
    events: { italian: italian, phrase: phrase, aura: auraEvent, fanumTax: fanumTax, skibidi: skibidi, mewing: mewing,
              auraFarming: auraFarming, chillGuy: chillGuy, npc: npc, L: L, caption: caption }
  };
})(window);
