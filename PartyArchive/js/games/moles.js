/* 두더지 쟁탈 — 보조키로 열 선택 + 타이머 누수 방지 */
(function (global) {
  "use strict";

  var DURATION = 25;
  var STUN = 400;

  function createMoles() {
    var root = null;
    var cfg = null;
    var input = null;
    var ai = null;
    var raf = 0;
    var destroyed = false;
    var running = false;
    var finished = false;
    var scores = { p1: 0, p2: 0 };
    var startAt = 0;
    var moles = [];
    var stunUntil = { p1: 0, p2: 0 };
    var aimCol = { p1: 0, p2: 2 };
    var nextSpawn = 0;
    var bag = null;
    var cdCtrl = null;
    var resultCtrl = null;
    var els = {};
    var holeEls = [];
    var colEls = [];

    function p2Label() {
      return PartyUI.p2Label(cfg.mode);
    }

    function sfx(name) {
      if (global.PartyApp && PartyApp.sfx) PartyApp.sfx(name);
    }

    function colOwner(col) {
      if (col === 0) return "p1";
      if (col === 2) return "p2";
      return "both";
    }

    function cycleAim(who) {
      if (who === "p1") {
        // 0 ↔ 1
        aimCol.p1 = aimCol.p1 === 0 ? 1 : 0;
      } else {
        // 2 ↔ 1
        aimCol.p2 = aimCol.p2 === 2 ? 1 : 2;
      }
      paintAim();
      sfx("tick");
    }

    function paintAim() {
      for (var c = 0; c < 3; c++) {
        colEls[c].classList.toggle("aim-p1", aimCol.p1 === c);
        colEls[c].classList.toggle("aim-p2", aimCol.p2 === c);
      }
      for (var i = 0; i < 9; i++) {
        var col = i % 3;
        var hole = holeEls[i].parentNode;
        hole.classList.toggle("aimed-p1", aimCol.p1 === col);
        hole.classList.toggle("aimed-p2", aimCol.p2 === col);
      }
    }

    function build() {
      var holes = "";
      for (var i = 0; i < 9; i++) {
        holes +=
          '<div class="mole-hole" data-idx="' +
          i +
          '"><div class="mole" id="mole-' +
          i +
          '"></div></div>';
      }
      root.innerHTML =
        '<div class="hud">' +
        '<div class="hud-player p1"><span class="tag">P1</span><span id="mo-s1">0</span></div>' +
        '<div class="hud-center"><div class="hud-timer" id="mo-timer">25.0</div></div>' +
        '<div class="hud-player p2"><span class="tag">' +
        p2Label() +
        '</span><span id="mo-s2">0</span></div>' +
        "</div>" +
        '<div class="game-stage moles-arena" id="mo-arena">' +
        '<div class="game-hint">S/K로 열 선택 · A/L로 타격 · 가운데=쟁탈</div>' +
        '<div class="mole-col-label">' +
        '<span class="col-aim" data-col="0" style="color:var(--p1)">P1</span>' +
        '<span class="col-aim" data-col="1">쟁탈</span>' +
        '<span class="col-aim" data-col="2" style="color:var(--p2)">' +
        p2Label() +
        "</span></div>" +
        '<div class="mole-grid">' +
        holes +
        "</div>" +
        '<div class="overlay" id="mo-overlay"><div class="countdown-num">3</div></div>' +
        "</div>";
      els.timer = root.querySelector("#mo-timer");
      els.s1 = root.querySelector("#mo-s1");
      els.s2 = root.querySelector("#mo-s2");
      els.overlay = root.querySelector("#mo-overlay");
      els.arena = root.querySelector("#mo-arena");
      holeEls = [];
      for (var j = 0; j < 9; j++) {
        holeEls.push(root.querySelector("#mole-" + j));
      }
      colEls = [];
      root.querySelectorAll(".col-aim").forEach(function (el) {
        colEls.push(el);
      });
    }

    function paint() {
      for (var i = 0; i < 9; i++) {
        holeEls[i].classList.remove("up", "claimed");
      }
      for (var k = 0; k < moles.length; k++) {
        if (!moles[k].claimed) holeEls[moles[k].idx].classList.add("up");
      }
      els.s1.textContent = String(scores.p1);
      els.s2.textContent = String(scores.p2);
    }

    function spawn(now) {
      var count = Math.random() < 0.22 ? 2 : 1;
      var used = {};
      for (var n = 0; n < count; n++) {
        var idx = (Math.random() * 9) | 0;
        var tries = 0;
        while (used[idx] || moles.some(function (m) { return m.idx === idx && !m.claimed; })) {
          idx = (Math.random() * 9) | 0;
          if (++tries > 12) break;
        }
        used[idx] = true;
        var col = idx % 3;
        moles.push({
          idx: idx,
          col: col,
          upUntil: now + 900 + Math.random() * 700,
          claimed: false,
        });
      }
      nextSpawn = now + 550 + Math.random() * 650;
      paint();
    }

    function tryHit(who, now) {
      if (!running || finished) return;
      if (now < stunUntil[who]) return;

      var targetCol = aimCol[who];
      var best = null;
      for (var i = 0; i < moles.length; i++) {
        var m = moles[i];
        if (m.claimed) continue;
        if (now > m.upUntil) continue;
        if (m.col !== targetCol) continue;
        var owner = colOwner(m.col);
        if (owner !== "both" && owner !== who) continue;
        if (!best || m.upUntil < best.upUntil) best = m;
      }

      if (!best) {
        stunUntil[who] = now + STUN;
        els.arena.classList.add("stun-flash");
        bag.later(function () {
          if (els.arena) els.arena.classList.remove("stun-flash");
        }, 350);
        sfx("thud");
        return;
      }

      best.claimed = true;
      scores[who]++;
      holeEls[best.idx].classList.add("claimed");
      var hole = holeEls[best.idx].parentNode;
      var rect = hole.getBoundingClientRect();
      var arenaRect = els.arena.getBoundingClientRect();
      var x = ((rect.left + rect.width / 2 - arenaRect.left) / arenaRect.width) * 100;
      var y = ((rect.top + rect.height / 2 - arenaRect.top) / arenaRect.height) * 100;
      PartyUI.spawnPopup(els.arena, "+1", x, y, who === "p1" ? "pop-p1" : "pop-p2");
      sfx("pop");
      paint();
    }

    function onInput(msg) {
      if (msg.type !== "down" || !running) return;
      var now = performance.now();
      if (msg.code === PartyInput.KEYS.P1_ALT) cycleAim("p1");
      else if (msg.code === PartyInput.KEYS.P1_MAIN) tryHit("p1", now);
      if (cfg.mode === "pvp") {
        if (msg.code === PartyInput.KEYS.P2_ALT) cycleAim("p2");
        else if (msg.code === PartyInput.KEYS.P2_MAIN) tryHit("p2", now);
      }
    }

    function loop(now) {
      if (destroyed) return;
      raf = requestAnimationFrame(loop);
      if (!running || finished) return;

      var left = Math.max(0, DURATION - (now - startAt) / 1000);
      els.timer.textContent = left.toFixed(1);

      var changed = false;
      moles = moles.filter(function (m) {
        if (!m.claimed && now > m.upUntil) {
          changed = true;
          return false;
        }
        if (m.claimed) return false;
        return true;
      });
      if (changed) paint();

      if (now >= nextSpawn) spawn(now);
      if (left <= 0) endGame();
    }

    function endGame() {
      if (finished) return;
      finished = true;
      running = false;
      if (ai) {
        ai.destroy();
        ai = null;
      }
      var winner = "draw";
      if (scores.p1 > scores.p2) winner = "p1";
      else if (scores.p2 > scores.p1) winner = "p2";
      if (cfg.onFinish) cfg.onFinish({ winner: winner, pending: true });
      resultCtrl = PartyUI.showResult(els.overlay, {
        winner: winner,
        mode: cfg.mode,
        sub: scores.p1 + " : " + scores.p2,
        arenaEl: els.arena,
        punch: true,
        onReplay: function () {
          if (cfg.onFinish) cfg.onFinish({ winner: winner, replay: true });
        },
        onLobby: function () {
          if (cfg.onFinish) cfg.onFinish({ winner: winner, replay: false });
        },
      });
    }

    return {
      init: function (rootEl, options) {
        root = rootEl;
        cfg = options || {};
        destroyed = false;
        finished = false;
        running = false;
        scores = { p1: 0, p2: 0 };
        moles = [];
        stunUntil = { p1: 0, p2: 0 };
        aimCol = { p1: 0, p2: 2 };
        bag = PartyUI.createTimerBag();
        build();
        paintAim();
        input = PartyInput.create({ ignoreP2: cfg.mode === "ai" });
        input.on(onInput);
      },
      start: function () {
        cdCtrl = PartyUI.runCountdown(els.overlay, {
          done: function () {
            if (destroyed) return;
            running = true;
            startAt = performance.now();
            nextSpawn = startAt + 300;
            raf = requestAnimationFrame(loop);

            if (cfg.mode === "ai") {
              var profile = PartyAI.pickProfile(cfg.difficulty || "normal");
              ai = PartyAI.createActor(
                cfg.difficulty || "normal",
                function (now) {
                  if (now < stunUntil.p2) return false;
                  for (var i = 0; i < moles.length; i++) {
                    var m = moles[i];
                    if (m.claimed || now > m.upUntil) continue;
                    var owner = colOwner(m.col);
                    if (owner === "p2" || owner === "both") return true;
                  }
                  return false;
                },
                function () {
                  var now = performance.now();
                  // pick best available col for AI
                  var bestCol = null;
                  var bestUntil = Infinity;
                  for (var i = 0; i < moles.length; i++) {
                    var m = moles[i];
                    if (m.claimed || now > m.upUntil) continue;
                    var owner = colOwner(m.col);
                    if (owner !== "p2" && owner !== "both") continue;
                    // easy: hesitate on center
                    if (owner === "both" && profile.mistakeRate > 0.25 && Math.random() < 0.4) {
                      continue;
                    }
                    if (m.upUntil < bestUntil) {
                      bestUntil = m.upUntil;
                      bestCol = m.col;
                    }
                  }
                  if (bestCol == null) return;
                  aimCol.p2 = bestCol;
                  paintAim();
                  // hard: act sooner via smaller artificial delay already in actor
                  tryHit("p2", performance.now());
                },
                {
                  minGap: 90,
                  extraDelay: function () {
                    // easy slower on center contests
                    if (aimCol.p2 === 1 && profile.mistakeRate > 0.2) return 80;
                    if (profile.mistakeRate < 0.1) return -20;
                    return 0;
                  },
                }
              );
            }
          },
        });
      },
      destroy: function () {
        destroyed = true;
        running = false;
        if (bag) bag.clear();
        if (cdCtrl) cdCtrl.cancel();
        if (resultCtrl) resultCtrl.destroy();
        if (raf) cancelAnimationFrame(raf);
        if (input) input.destroy();
        if (ai) ai.destroy();
        input = null;
        ai = null;
        root = null;
      },
    };
  }

  global.GameMoles = { create: createMoles };
})(window);
