/* 퍽 밀치기 — 연타로 상대 골대 쪽 */
(function (global) {
  "use strict";

  var DURATION = 20;
  var RANGE = 40;

  function createPush() {
    var root = null;
    var cfg = null;
    var input = null;
    var ai = null;
    var raf = 0;
    var destroyed = false;
    var running = false;
    var finished = false;
    var puck = 50;
    var startAt = 0;
    var cdCtrl = null;
    var resultCtrl = null;
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
        '<div class="hud-player p1"><span class="tag">P1</span><span>밀기 A</span></div>' +
        '<div class="hud-center"><div class="hud-timer" id="pu-timer">20.0</div></div>' +
        '<div class="hud-player p2"><span class="tag">' +
        p2Label() +
        "</span><span>밀기 L</span></div>" +
        "</div>" +
        '<div class="game-stage push-arena" id="pu-arena">' +
        '<div class="push-goal p1-goal">P1 골</div>' +
        '<div class="push-track"><div class="push-puck" id="pu-puck" style="left:50%"></div></div>' +
        '<div class="push-goal p2-goal">' +
        p2Label() +
        " 골</div>" +
        '<div class="overlay" id="pu-overlay"><div class="countdown-num">3</div></div>' +
        "</div>";
      els.timer = root.querySelector("#pu-timer");
      els.puck = root.querySelector("#pu-puck");
      els.overlay = root.querySelector("#pu-overlay");
      els.arena = root.querySelector("#pu-arena");
    }

    function paint() {
      els.puck.style.left = puck + "%";
    }

    function nudge(dir) {
      if (!running || finished) return;
      puck = Math.max(50 - RANGE, Math.min(50 + RANGE, puck + dir));
      paint();
      sfx("mash");
      // instant goal
      if (puck <= 50 - RANGE + 0.5) {
        puck = 50 - RANGE;
        endGame("p2");
      } else if (puck >= 50 + RANGE - 0.5) {
        puck = 50 + RANGE;
        endGame("p1");
      }
    }

    function onInput(msg) {
      if (msg.type !== "down" || !running) return;
      if (msg.code === PartyInput.KEYS.P1_MAIN) nudge(1.4);
      if (cfg.mode === "pvp" && msg.code === PartyInput.KEYS.P2_MAIN) nudge(-1.4);
    }

    function loop(now) {
      if (destroyed) return;
      raf = requestAnimationFrame(loop);
      if (!running || finished) return;
      var left = Math.max(0, DURATION - (now - startAt) / 1000);
      els.timer.textContent = left.toFixed(1);
      if (left <= 0) {
        var winner = "draw";
        if (puck > 51) winner = "p1";
        else if (puck < 49) winner = "p2";
        endGame(winner);
      }
    }

    function endGame(winner) {
      if (finished) return;
      finished = true;
      running = false;
      if (ai) {
        ai.destroy();
        ai = null;
      }
      if (cfg.onFinish) cfg.onFinish({ winner: winner, pending: true });
      resultCtrl = PartyUI.showResult(els.overlay, {
        winner: winner,
        mode: cfg.mode,
        sub: "퍽 위치 " + puck.toFixed(1) + "%",
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
        puck = 50;
        build();
        paint();
        input = PartyInput.create({ ignoreP2: cfg.mode === "ai" });
        input.on(onInput);
      },
      start: function () {
        cdCtrl = PartyUI.runCountdown(els.overlay, {
          done: function () {
            if (destroyed) return;
            running = true;
            startAt = performance.now();
            if (global.PartyApp) PartyApp.sfx("mashReset");
            raf = requestAnimationFrame(loop);
            if (cfg.mode === "ai") {
              ai = PartyAI.createMasher(cfg.difficulty || "normal", function () {
                nudge(-1.4);
              });
            }
          },
        });
      },
      destroy: function () {
        destroyed = true;
        running = false;
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

  global.GamePush = { create: createPush };
})(window);
