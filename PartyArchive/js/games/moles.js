/* 두더지 쟁탈 — 3x3, 열별 소유권 (~25초) */
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
    var moles = []; // {idx, col, upUntil, claimed}
    var stunUntil = { p1: 0, p2: 0 };
    var nextSpawn = 0;
    var els = {};
    var holeEls = [];

    function p2Label() {
      return cfg.mode === "ai" ? "AI" : "P2";
    }

    function sfx(name) {
      if (global.PartyApp && PartyApp.sfx) PartyApp.sfx(name);
    }

    function colOwner(col) {
      if (col === 0) return "p1";
      if (col === 2) return "p2";
      return "both";
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
        '<div class="game-hint">왼쪽=P1 · 가운데=쟁탈 · 오른쪽=' +
        p2Label() +
        " · A / L</div>" +
        '<div class="mole-col-label"><span style="color:var(--p1)">P1</span><span>쟁탈</span><span style="color:var(--p2)">' +
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
    }

    function paint() {
      for (var i = 0; i < 9; i++) {
        holeEls[i].classList.remove("up");
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

      // 자기 열 또는 가운데에서 올라온 두더지 중 가장 빨리 사라질 것
      var best = null;
      for (var i = 0; i < moles.length; i++) {
        var m = moles[i];
        if (m.claimed) continue;
        if (now > m.upUntil) continue;
        var owner = colOwner(m.col);
        if (owner !== "both" && owner !== who) continue;
        if (!best || m.upUntil < best.upUntil) best = m;
      }

      if (!best) {
        stunUntil[who] = now + STUN;
        els.arena.classList.add("stun-flash");
        setTimeout(function () {
          if (els.arena) els.arena.classList.remove("stun-flash");
        }, 350);
        sfx("miss");
        return;
      }

      best.claimed = true;
      scores[who]++;
      sfx("tap");
      paint();
    }

    function onInput(msg) {
      if (msg.type !== "down" || !running) return;
      var now = performance.now();
      if (msg.code === PartyInput.KEYS.P1_MAIN) tryHit("p1", now);
      if (cfg.mode === "pvp" && msg.code === PartyInput.KEYS.P2_MAIN) tryHit("p2", now);
    }

    function loop(now) {
      if (destroyed) return;
      raf = requestAnimationFrame(loop);
      if (!running || finished) return;

      var left = Math.max(0, DURATION - (now - startAt) / 1000);
      els.timer.textContent = left.toFixed(1);

      // 만료된 두더지 제거
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
      els.arena.classList.add("shake");
      var title =
        winner === "draw" ? "무승부!" : winner === "p1" ? "P1 승리!" : p2Label() + " 승리!";
      els.overlay.innerHTML =
        '<div class="result-title">' +
        title +
        "</div>" +
        '<div class="result-sub">' +
        scores.p1 +
        " : " +
        scores.p2 +
        "</div>" +
        '<div class="result-actions">' +
        '<button type="button" class="btn btn-primary" id="mo-again">다시하기</button>' +
        '<button type="button" class="btn" id="mo-lobby">로비</button>' +
        "</div>";
      els.overlay.classList.remove("hidden");
      sfx(winner === "draw" ? "draw" : "win");
      if (cfg.onFinish) cfg.onFinish({ winner: winner, pending: true });
      root.querySelector("#mo-again").onclick = function () {
        if (cfg.onFinish) cfg.onFinish({ winner: winner, replay: true });
      };
      root.querySelector("#mo-lobby").onclick = function () {
        if (cfg.onFinish) cfg.onFinish({ winner: winner, replay: false });
      };
    }

    function countdown(done) {
      els.overlay.classList.remove("hidden");
      els.overlay.innerHTML = '<div class="countdown-num" id="mo-cd">3</div>';
      var cd = root.querySelector("#mo-cd");
      var n = 3;
      sfx("cd");
      var t0 = performance.now();
      function tick(now) {
        if (destroyed) return;
        var elapsed = (now - t0) / 1000;
        var next = 3 - Math.floor(elapsed);
        if (next !== n && next >= 1) {
          n = next;
          cd.textContent = String(n);
          sfx("cd");
        }
        if (elapsed >= 3) {
          els.overlay.classList.add("hidden");
          done();
          return;
        }
        raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
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
        build();
        input = PartyInput.create({ ignoreP2: cfg.mode === "ai" });
        input.on(onInput);
      },
      start: function () {
        countdown(function () {
          if (destroyed) return;
          running = true;
          startAt = performance.now();
          nextSpawn = startAt + 300;
          raf = requestAnimationFrame(loop);

          if (cfg.mode === "ai") {
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
                tryHit("p2", performance.now());
              },
              { minGap: 90 }
            );
          }
        });
      },
      destroy: function () {
        destroyed = true;
        running = false;
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
