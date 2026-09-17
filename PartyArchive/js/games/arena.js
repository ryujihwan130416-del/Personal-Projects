/* 링 아웃 — WASD vs 화살표 피지컬 밀어내기 */
(function (global) {
  "use strict";

  var DURATION = 30;
  var ARENA_R = 38; // % from center
  var SPEED = 38; // % per second
  var RADIUS = 3.2; // player radius in %
  var KNOCK = 14;

  function createArena() {
    var root = null;
    var cfg = null;
    var input = null;
    var raf = 0;
    var destroyed = false;
    var running = false;
    var finished = false;
    var startAt = 0;
    var last = 0;
    var pos = {
      p1: { x: 38, y: 50 },
      p2: { x: 62, y: 50 },
    };
    var vel = {
      p1: { x: 0, y: 0 },
      p2: { x: 0, y: 0 },
    };
    var lives = { p1: 2, p2: 2 };
    var aiTarget = { x: 50, y: 50 };
    var aiRetarget = 0;
    var respawnUntil = 0;
    var cdCtrl = null;
    var resultCtrl = null;
    var bag = null;
    var els = {};

    function p2Label() {
      return PartyUI.p2Label(cfg.mode);
    }

    function sfx(name) {
      if (global.PartyApp && PartyApp.sfx) PartyApp.sfx(name);
    }

    function build() {
      root.innerHTML =
        '<div class="hud">' +
        '<div class="hud-player p1"><span class="tag">P1</span><span id="ar-s1">♥♥</span></div>' +
        '<div class="hud-center"><div class="hud-timer" id="ar-timer">30.0</div></div>' +
        '<div class="hud-player p2"><span class="tag">' +
        p2Label() +
        '</span><span id="ar-s2">♥♥</span></div>' +
        "</div>" +
        '<div class="game-stage arena-stage" id="ar-arena">' +
        '<div class="game-hint">P1 WASD · ' +
        p2Label() +
        " 화살표 · 상대를 링 밖으로!</div>" +
        '<div class="arena-ring" id="ar-ring">' +
        '<div class="arena-player p1" id="ar-p1"></div>' +
        '<div class="arena-player p2" id="ar-p2"></div>' +
        "</div>" +
        '<div class="overlay" id="ar-overlay"><div class="countdown-num">3</div></div>' +
        "</div>";
      els.timer = root.querySelector("#ar-timer");
      els.s1 = root.querySelector("#ar-s1");
      els.s2 = root.querySelector("#ar-s2");
      els.p1 = root.querySelector("#ar-p1");
      els.p2 = root.querySelector("#ar-p2");
      els.ring = root.querySelector("#ar-ring");
      els.overlay = root.querySelector("#ar-overlay");
      els.arena = root.querySelector("#ar-arena");
    }

    function hearts(n) {
      if (n <= 0) return "아웃";
      return n === 2 ? "♥♥" : "♥";
    }

    function paint() {
      els.p1.style.left = pos.p1.x + "%";
      els.p1.style.top = pos.p1.y + "%";
      els.p2.style.left = pos.p2.x + "%";
      els.p2.style.top = pos.p2.y + "%";
      els.s1.textContent = hearts(lives.p1);
      els.s2.textContent = hearts(lives.p2);
    }

    function distFromCenter(p) {
      var dx = p.x - 50;
      var dy = p.y - 50;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function resetPositions() {
      pos.p1 = { x: 38, y: 50 };
      pos.p2 = { x: 62, y: 50 };
      vel.p1 = { x: 0, y: 0 };
      vel.p2 = { x: 0, y: 0 };
      paint();
    }

    function fallOut(who) {
      if (finished || performance.now() < respawnUntil) return;
      lives[who]--;
      sfx("miss");
      els.arena.classList.add("shake");
      bag.later(function () {
        if (els.arena) els.arena.classList.remove("shake");
      }, 280);
      if (lives[who] <= 0) {
        endGame(who === "p1" ? "p2" : "p1");
        return;
      }
      resetPositions();
      respawnUntil = performance.now() + 500;
    }

    function collide() {
      var dx = pos.p2.x - pos.p1.x;
      var dy = pos.p2.y - pos.p1.y;
      var d = Math.sqrt(dx * dx + dy * dy) || 0.001;
      var min = RADIUS * 2;
      if (d >= min) return;
      var nx = dx / d;
      var ny = dy / d;
      var overlap = min - d;
      pos.p1.x -= nx * overlap * 0.5;
      pos.p1.y -= ny * overlap * 0.5;
      pos.p2.x += nx * overlap * 0.5;
      pos.p2.y += ny * overlap * 0.5;
      // relative approach
      var rvx = vel.p2.x - vel.p1.x;
      var rvy = vel.p2.y - vel.p1.y;
      var impact = Math.max(0.4, Math.abs(rvx * nx + rvy * ny));
      vel.p1.x -= nx * KNOCK * impact * 0.08;
      vel.p1.y -= ny * KNOCK * impact * 0.08;
      vel.p2.x += nx * KNOCK * impact * 0.08;
      vel.p2.y += ny * KNOCK * impact * 0.08;
      sfx("thud");
    }

    function aiStep(dt) {
      if (cfg.mode !== "ai") return;
      var now = performance.now();
      var profile = PartyAI.pickProfile(cfg.difficulty || "normal");
      if (now > aiRetarget) {
        // chase p1 with error
        var err = profile.timingError * 18;
        aiTarget.x = pos.p1.x + (Math.random() - 0.5) * err * 4;
        aiTarget.y = pos.p1.y + (Math.random() - 0.5) * err * 4;
        // sometimes wander to center
        if (Math.random() < profile.mistakeRate) {
          aiTarget.x = 50 + (Math.random() - 0.5) * 20;
          aiTarget.y = 50 + (Math.random() - 0.5) * 20;
        }
        aiRetarget = now + 280 + profile.reactMax;
      }
      var dx = aiTarget.x - pos.p2.x;
      var dy = aiTarget.y - pos.p2.y;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var sp = SPEED * (profile.mistakeRate < 0.1 ? 1.05 : profile.mistakeRate > 0.25 ? 0.78 : 0.92);
      vel.p2.x = (dx / len) * sp * 0.02;
      vel.p2.y = (dy / len) * sp * 0.02;
      pos.p2.x += (dx / len) * sp * dt;
      pos.p2.y += (dy / len) * sp * dt;
    }

    function loop(now) {
      if (destroyed) return;
      raf = requestAnimationFrame(loop);
      if (!running || finished) return;
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      var left = Math.max(0, DURATION - (now - startAt) / 1000);
      els.timer.textContent = left.toFixed(1);

      // player movement via held keys
      var v1 = input.moveVector("p1");
      pos.p1.x += v1.x * SPEED * dt;
      pos.p1.y += v1.y * SPEED * dt;
      vel.p1.x = v1.x * SPEED * 0.02;
      vel.p1.y = v1.y * SPEED * 0.02;

      if (cfg.mode === "pvp") {
        var v2 = input.moveVector("p2");
        pos.p2.x += v2.x * SPEED * dt;
        pos.p2.y += v2.y * SPEED * dt;
        vel.p2.x = v2.x * SPEED * 0.02;
        vel.p2.y = v2.y * SPEED * 0.02;
      } else {
        aiStep(dt);
      }

      // knockback decay apply
      pos.p1.x += vel.p1.x * dt * 60;
      pos.p1.y += vel.p1.y * dt * 60;
      pos.p2.x += vel.p2.x * dt * 60;
      pos.p2.y += vel.p2.y * dt * 60;
      vel.p1.x *= 0.86;
      vel.p1.y *= 0.86;
      vel.p2.x *= 0.86;
      vel.p2.y *= 0.86;

      collide();
      paint();

      if (performance.now() >= respawnUntil) {
        if (distFromCenter(pos.p1) > ARENA_R) fallOut("p1");
        else if (distFromCenter(pos.p2) > ARENA_R) fallOut("p2");
      }

      if (left <= 0 && !finished) {
        var d1 = distFromCenter(pos.p1);
        var d2 = distFromCenter(pos.p2);
        var winner = "draw";
        if (lives.p1 !== lives.p2) winner = lives.p1 > lives.p2 ? "p1" : "p2";
        else if (d1 < d2 - 0.5) winner = "p1";
        else if (d2 < d1 - 0.5) winner = "p2";
        endGame(winner);
      }
    }

    function endGame(winner) {
      if (finished) return;
      finished = true;
      running = false;
      if (cfg.onFinish) cfg.onFinish({ winner: winner, pending: true });
      resultCtrl = PartyUI.showResult(els.overlay, {
        winner: winner,
        mode: cfg.mode,
        sub: "잔여 " + hearts(lives.p1) + " : " + hearts(lives.p2),
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
        lives = { p1: 2, p2: 2 };
        bag = PartyUI.createTimerBag();
        build();
        resetPositions();
        input = PartyInput.create({ ignoreP2: cfg.mode === "ai" });
      },
      start: function () {
        cdCtrl = PartyUI.runCountdown(els.overlay, {
          done: function () {
            if (destroyed) return;
            running = true;
            startAt = performance.now();
            last = startAt;
            raf = requestAnimationFrame(loop);
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
        input = null;
        root = null;
      },
    };
  }

  global.GameArena = { create: createArena };
})(window);
