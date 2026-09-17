/* 사다리 오르기 — 주키/보조키 번갈아 연타 */
(function (global) {
  "use strict";

  var DURATION = 18;
  var STEP = 4.2;

  function createLadder() {
    var root = null;
    var cfg = null;
    var input = null;
    var ai = null;
    var raf = 0;
    var destroyed = false;
    var running = false;
    var finished = false;
    var height = { p1: 0, p2: 0 };
    var expectAlt = { p1: false, p2: false };
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
        '<div class="hud-player p1"><span class="tag">P1</span><span id="ld-s1">0</span></div>' +
        '<div class="hud-center"><div class="hud-timer" id="ld-timer">18.0</div></div>' +
        '<div class="hud-player p2"><span class="tag">' +
        p2Label() +
        '</span><span id="ld-s2">0</span></div>' +
        "</div>" +
        '<div class="game-stage ladder-arena" id="ld-arena">' +
        '<div class="game-hint">A↔S / L↔K 번갈아 누르며 올라가세요</div>' +
        '<div class="ladder-row">' +
        '<div class="ladder-col"><div class="ladder-fill" id="ld-f1"></div><div class="ladder-climber" id="ld-c1"></div><div>P1</div><div class="ladder-next" id="ld-n1">다음: A</div></div>' +
        '<div class="ladder-col"><div class="ladder-fill" id="ld-f2"></div><div class="ladder-climber" id="ld-c2"></div><div>' +
        p2Label() +
        '</div><div class="ladder-next" id="ld-n2">다음: L</div></div>' +
        "</div>" +
        '<div class="overlay" id="ld-overlay"><div class="countdown-num">3</div></div>' +
        "</div>";
      els.timer = root.querySelector("#ld-timer");
      els.s1 = root.querySelector("#ld-s1");
      els.s2 = root.querySelector("#ld-s2");
      els.f1 = root.querySelector("#ld-f1");
      els.f2 = root.querySelector("#ld-f2");
      els.c1 = root.querySelector("#ld-c1");
      els.c2 = root.querySelector("#ld-c2");
      els.n1 = root.querySelector("#ld-n1");
      els.n2 = root.querySelector("#ld-n2");
      els.overlay = root.querySelector("#ld-overlay");
      els.arena = root.querySelector("#ld-arena");
    }

    function paint() {
      els.s1.textContent = String(Math.floor(height.p1));
      els.s2.textContent = String(Math.floor(height.p2));
      var h1 = Math.min(100, height.p1);
      var h2 = Math.min(100, height.p2);
      els.f1.style.height = h1 + "%";
      els.f2.style.height = h2 + "%";
      els.c1.style.bottom = h1 + "%";
      els.c2.style.bottom = h2 + "%";
      els.n1.textContent = "다음: " + (expectAlt.p1 ? "S" : "A");
      els.n2.textContent = "다음: " + (expectAlt.p2 ? "K" : "L");
    }

    function step(who, isAlt) {
      if (!running || finished) return;
      if (expectAlt[who] !== isAlt) {
        sfx("miss");
        return;
      }
      expectAlt[who] = !expectAlt[who];
      height[who] += STEP;
      paint();
      sfx("mash");
      if (height[who] >= 100) endGame();
    }

    function onInput(msg) {
      if (msg.type !== "down" || !running) return;
      if (msg.code === PartyInput.KEYS.P1_MAIN) step("p1", false);
      if (msg.code === PartyInput.KEYS.P1_ALT) step("p1", true);
      if (cfg.mode === "pvp") {
        if (msg.code === PartyInput.KEYS.P2_MAIN) step("p2", false);
        if (msg.code === PartyInput.KEYS.P2_ALT) step("p2", true);
      }
    }

    function loop(now) {
      if (destroyed) return;
      raf = requestAnimationFrame(loop);
      if (!running || finished) return;
      var left = Math.max(0, DURATION - (now - startAt) / 1000);
      els.timer.textContent = left.toFixed(1);
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
      if (height.p1 > height.p2) winner = "p1";
      else if (height.p2 > height.p1) winner = "p2";
      if (cfg.onFinish) cfg.onFinish({ winner: winner, pending: true });
      resultCtrl = PartyUI.showResult(els.overlay, {
        winner: winner,
        mode: cfg.mode,
        sub: Math.floor(height.p1) + " : " + Math.floor(height.p2),
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
        height = { p1: 0, p2: 0 };
        expectAlt = { p1: false, p2: false };
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
              ai = PartyAI.createMasher(
                cfg.difficulty || "normal",
                function () {
                  step("p2", expectAlt.p2);
                },
                {
                  paceScale: function () {
                    return 0.95;
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

  global.GameLadder = { create: createLadder };
})(window);
