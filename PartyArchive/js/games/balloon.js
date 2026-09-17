/* 풍선 레이스 — 연타로 먼저 가득 채우기 */
(function (global) {
  "use strict";

  var DURATION = 20;
  var TARGET = 100;
  var PER_TAP = 3.2;

  function createBalloon() {
    var root = null;
    var cfg = null;
    var input = null;
    var ai = null;
    var raf = 0;
    var destroyed = false;
    var running = false;
    var finished = false;
    var fill = { p1: 0, p2: 0 };
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
        '<div class="hud-player p1"><span class="tag">P1</span><span id="bl-s1">0%</span></div>' +
        '<div class="hud-center"><div class="hud-timer" id="bl-timer">20.0</div></div>' +
        '<div class="hud-player p2"><span class="tag">' +
        p2Label() +
        '</span><span id="bl-s2">0%</span></div>' +
        "</div>" +
        '<div class="game-stage balloon-arena" id="bl-arena">' +
        '<div class="game-hint">연타로 풍선을 부풀리세요 · 먼저 100% 또는 시간 종료 시 더 큰 쪽</div>' +
        '<div class="balloon-row">' +
        '<div class="balloon-side p1"><div class="balloon" id="bl-b1"></div><div>P1</div></div>' +
        '<div class="balloon-side p2"><div class="balloon" id="bl-b2"></div><div>' +
        p2Label() +
        "</div></div>" +
        "</div>" +
        '<div class="overlay" id="bl-overlay"><div class="countdown-num">3</div></div>' +
        "</div>";
      els.timer = root.querySelector("#bl-timer");
      els.s1 = root.querySelector("#bl-s1");
      els.s2 = root.querySelector("#bl-s2");
      els.b1 = root.querySelector("#bl-b1");
      els.b2 = root.querySelector("#bl-b2");
      els.overlay = root.querySelector("#bl-overlay");
      els.arena = root.querySelector("#bl-arena");
    }

    function paint() {
      els.s1.textContent = Math.floor(fill.p1) + "%";
      els.s2.textContent = Math.floor(fill.p2) + "%";
      var s1 = 0.35 + (fill.p1 / TARGET) * 0.9;
      var s2 = 0.35 + (fill.p2 / TARGET) * 0.9;
      els.b1.style.transform = "scale(" + s1 + ")";
      els.b2.style.transform = "scale(" + s2 + ")";
    }

    function pump(who) {
      if (!running || finished) return;
      fill[who] = Math.min(TARGET, fill[who] + PER_TAP);
      paint();
      sfx("mash");
      if (fill[who] >= TARGET) endGame();
    }

    function onInput(msg) {
      if (msg.type !== "down" || !running) return;
      if (msg.code === PartyInput.KEYS.P1_MAIN) pump("p1");
      if (cfg.mode === "pvp" && msg.code === PartyInput.KEYS.P2_MAIN) pump("p2");
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
      if (fill.p1 > fill.p2) winner = "p1";
      else if (fill.p2 > fill.p1) winner = "p2";
      if (cfg.onFinish) cfg.onFinish({ winner: winner, pending: true });
      resultCtrl = PartyUI.showResult(els.overlay, {
        winner: winner,
        mode: cfg.mode,
        sub: Math.floor(fill.p1) + "% : " + Math.floor(fill.p2) + "%",
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
        fill = { p1: 0, p2: 0 };
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
                pump("p2");
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

  global.GameBalloon = { create: createBalloon };
})(window);
