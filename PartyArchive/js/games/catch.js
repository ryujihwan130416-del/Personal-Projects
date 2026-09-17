/* 공 받기 — 떨어지는 공을 캐치 존에서 정지 */
(function (global) {
  "use strict";

  var ROUNDS = 3;
  var FALL_H = 300;
  var ZONE_TOP = 210;
  var ZONE_H = 44;
  var BALL_H = 28;
  var ROUND_TIMEOUT = 6500;

  function createCatch() {
    var root = null;
    var cfg = null;
    var input = null;
    var destroyed = false;
    var running = false;
    var finished = false;
    var round = 0;
    var scores = { p1: 0, p2: 0 };
    var roundScore = { p1: null, p2: null };
    var balls = {
      p1: { y: 0, speed: 220, stopped: false },
      p2: { y: 0, speed: 220, stopped: false },
    };
    var last = 0;
    var raf = 0;
    var ai = null;
    var bag = null;
    var roundTimer = 0;
    var cdCtrl = null;
    var resultCtrl = null;
    var els = {};

    function p2Label() {
      return PartyUI.p2Label(cfg.mode);
    }

    function sfx(name, opts) {
      if (global.PartyApp && PartyApp.sfx) PartyApp.sfx(name, opts);
    }

    function build() {
      root.innerHTML =
        '<div class="hud">' +
        '<div class="hud-player p1"><span class="tag">P1</span><span id="ca-s1">0</span></div>' +
        '<div class="hud-center"><div class="hud-timer" id="ca-round">라운드 1 / 3</div></div>' +
        '<div class="hud-player p2"><span class="tag">' +
        p2Label() +
        '</span><span id="ca-s2">0</span></div>' +
        "</div>" +
        '<div class="game-stage catch-arena" id="ca-arena">' +
        '<div class="catch-lane p1"><div>P1 · A</div><div class="catch-well" id="well1"><div class="catch-zone"></div><div class="catch-ball" id="ball1"></div></div><div class="catch-score" id="csc1">-</div></div>' +
        '<div class="catch-lane p2"><div>' +
        p2Label() +
        ' · L</div><div class="catch-well" id="well2"><div class="catch-zone"></div><div class="catch-ball" id="ball2"></div></div><div class="catch-score" id="csc2">-</div></div>' +
        '<div class="overlay" id="ca-overlay"><div class="countdown-num">3</div></div>' +
        "</div>";
      els.overlay = root.querySelector("#ca-overlay");
      els.round = root.querySelector("#ca-round");
      els.s1 = root.querySelector("#ca-s1");
      els.s2 = root.querySelector("#ca-s2");
      els.b1 = root.querySelector("#ball1");
      els.b2 = root.querySelector("#ball2");
      els.sc1 = root.querySelector("#csc1");
      els.sc2 = root.querySelector("#csc2");
      els.arena = root.querySelector("#ca-arena");
    }

    function resetBalls() {
      balls.p1 = { y: -20, speed: 180 + Math.random() * 120, stopped: false };
      balls.p2 = { y: -20, speed: 180 + Math.random() * 120, stopped: false };
      roundScore.p1 = null;
      roundScore.p2 = null;
      els.sc1.textContent = "-";
      els.sc2.textContent = "-";
      paint();
    }

    function paint() {
      els.b1.style.top = balls.p1.y + "px";
      els.b2.style.top = balls.p2.y + "px";
    }

    function scoreFor(who) {
      var mid = balls[who].y + BALL_H / 2;
      var zoneMid = ZONE_TOP + ZONE_H / 2;
      var dist = Math.abs(mid - zoneMid);
      var half = ZONE_H / 2;
      if (dist > half + 10) return Math.max(0, Math.round(35 - dist * 0.4));
      return Math.round(60 + 40 * (1 - dist / half));
    }

    function stop(who) {
      if (!running || finished || balls[who].stopped) return;
      balls[who].stopped = true;
      var sc = scoreFor(who);
      roundScore[who] = sc;
      if (who === "p1") els.sc1.textContent = String(sc);
      else els.sc2.textContent = String(sc);
      sfx("score", { score: sc });
      if (roundScore.p1 != null && roundScore.p2 != null) endRound();
    }

    function forceTimeout() {
      if (!running || finished) return;
      if (roundScore.p1 == null) {
        balls.p1.stopped = true;
        roundScore.p1 = 0;
        els.sc1.textContent = "0";
      }
      if (roundScore.p2 == null) {
        balls.p2.stopped = true;
        roundScore.p2 = 0;
        els.sc2.textContent = "0";
      }
      sfx("miss");
      endRound();
    }

    function endRound() {
      if (roundTimer) {
        clearTimeout(roundTimer);
        roundTimer = 0;
      }
      scores.p1 += roundScore.p1 | 0;
      scores.p2 += roundScore.p2 | 0;
      els.s1.textContent = String(scores.p1);
      els.s2.textContent = String(scores.p2);
      running = false;
      if (ai) {
        ai.destroy();
        ai = null;
      }
      if (round >= ROUNDS) bag.later(endMatch, 700);
      else bag.later(startRound, 900);
    }

    function endMatch() {
      finished = true;
      var winner = "draw";
      if (scores.p1 > scores.p2) winner = "p1";
      else if (scores.p2 > scores.p1) winner = "p2";
      if (cfg.onFinish) cfg.onFinish({ winner: winner, pending: true });
      resultCtrl = PartyUI.showResult(els.overlay, {
        winner: winner,
        mode: cfg.mode,
        sub: "합계 " + scores.p1 + " : " + scores.p2,
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

    function startRound() {
      round++;
      els.round.textContent = "라운드 " + round + " / " + ROUNDS;
      resetBalls();
      running = true;
      last = performance.now();
      if (roundTimer) clearTimeout(roundTimer);
      roundTimer = setTimeout(function () {
        if (!destroyed) forceTimeout();
      }, ROUND_TIMEOUT);
      if (cfg.mode === "ai") {
        var offset = PartyAI.timingOffset(cfg.difficulty || "normal", ZONE_H / 2);
        ai = PartyAI.createActor(
          cfg.difficulty || "normal",
          function () {
            if (balls.p2.stopped || !running) return false;
            var mid = balls.p2.y + BALL_H / 2;
            var target = ZONE_TOP + ZONE_H / 2 + offset;
            return Math.abs(mid - target) < 22 && mid > ZONE_TOP - 30;
          },
          function () {
            stop("p2");
          },
          { minGap: 100 }
        );
      }
    }

    function loop(now) {
      if (destroyed) return;
      raf = requestAnimationFrame(loop);
      if (!running || finished) return;
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ["p1", "p2"].forEach(function (who) {
        var b = balls[who];
        if (b.stopped) return;
        b.y += b.speed * dt;
        if (b.y > FALL_H) {
          b.y = FALL_H;
          b.stopped = true;
          roundScore[who] = 0;
          if (who === "p1") els.sc1.textContent = "0";
          else els.sc2.textContent = "0";
          sfx("miss");
          if (roundScore.p1 != null && roundScore.p2 != null) endRound();
        }
      });
      paint();
    }

    function onInput(msg) {
      if (msg.type !== "down" || !running) return;
      if (msg.code === PartyInput.KEYS.P1_MAIN) stop("p1");
      if (cfg.mode === "pvp" && msg.code === PartyInput.KEYS.P2_MAIN) stop("p2");
    }

    return {
      init: function (rootEl, options) {
        root = rootEl;
        cfg = options || {};
        destroyed = false;
        finished = false;
        running = false;
        round = 0;
        scores = { p1: 0, p2: 0 };
        bag = PartyUI.createTimerBag();
        build();
        input = PartyInput.create({ ignoreP2: cfg.mode === "ai" });
        input.on(onInput);
      },
      start: function () {
        cdCtrl = PartyUI.runCountdown(els.overlay, {
          done: function () {
            if (destroyed) return;
            raf = requestAnimationFrame(loop);
            startRound();
          },
        });
      },
      destroy: function () {
        destroyed = true;
        running = false;
        if (roundTimer) clearTimeout(roundTimer);
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

  global.GameCatch = { create: createCatch };
})(window);
