/* 풍선 펌프 — 숨겨진 랜덤 폭발 임계치. 터지면 패배 */
(function (global) {
  "use strict";

  var DURATION = 22;
  var PER_TAP = 4.5;
  var CAREFUL = 2.2;

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
    var popAt = { p1: 70, p2: 70 };
    var popped = { p1: false, p2: false };
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

    function rollPop() {
      // 58~92% 사이 랜덤 — 서로 다르게
      popAt.p1 = 58 + Math.random() * 34;
      popAt.p2 = 58 + Math.random() * 34;
    }

    function build() {
      root.innerHTML =
        '<div class="hud">' +
        '<div class="hud-player p1"><span class="tag">P1</span><span id="bl-s1">0%</span></div>' +
        '<div class="hud-center"><div class="hud-timer" id="bl-timer">22.0</div></div>' +
        '<div class="hud-player p2"><span class="tag">' +
        p2Label() +
        '</span><span id="bl-s2">0%</span></div>' +
        "</div>" +
        '<div class="game-stage balloon-arena" id="bl-arena">' +
        '<div class="game-hint">A/L 크게 펌프 · Q/O 조심 펌프 · 언제 터질지 모름!</div>' +
        '<div class="balloon-row">' +
        '<div class="balloon-side p1"><div class="balloon" id="bl-b1"></div><div id="bl-l1">P1</div></div>' +
        '<div class="balloon-side p2"><div class="balloon" id="bl-b2"></div><div id="bl-l2">' +
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
      els.l1 = root.querySelector("#bl-l1");
      els.l2 = root.querySelector("#bl-l2");
      els.overlay = root.querySelector("#bl-overlay");
      els.arena = root.querySelector("#bl-arena");
    }

    function paint() {
      els.s1.textContent = popped.p1 ? "펑!" : Math.floor(fill.p1) + "%";
      els.s2.textContent = popped.p2 ? "펑!" : Math.floor(fill.p2) + "%";
      var s1 = popped.p1 ? 0.15 : 0.35 + (fill.p1 / 100) * 0.95;
      var s2 = popped.p2 ? 0.15 : 0.35 + (fill.p2 / 100) * 0.95;
      els.b1.style.transform = "scale(" + s1 + ")";
      els.b2.style.transform = "scale(" + s2 + ")";
      els.b1.classList.toggle("popped", popped.p1);
      els.b2.classList.toggle("popped", popped.p2);
      // 위기 연출: 임계치에 가까우면 흔들림 (플레이어는 정확한 값 모름)
      var near1 = !popped.p1 && fill.p1 > popAt.p1 - 12;
      var near2 = !popped.p2 && fill.p2 > popAt.p2 - 12;
      els.b1.classList.toggle("danger", near1);
      els.b2.classList.toggle("danger", near2);
    }

    function burst(who) {
      if (popped[who]) return;
      popped[who] = true;
      sfx("boom");
      PartyUI.spawnPopup(els.arena, "펑!", who === "p1" ? 30 : 70, 40, who === "p1" ? "pop-p1" : "pop-p2");
      paint();
      // 한쪽만 터지면 즉시 상대 승
      if (popped.p1 && !popped.p2) endGame("p2");
      else if (popped.p2 && !popped.p1) endGame("p1");
      else if (popped.p1 && popped.p2) endGame("draw");
    }

    function pump(who, amount) {
      if (!running || finished || popped[who]) return;
      fill[who] += amount;
      paint();
      sfx(amount >= PER_TAP ? "mash" : "tick");
      if (fill[who] >= popAt[who]) burst(who);
    }

    function onInput(msg) {
      if (msg.type !== "down" || !running) return;
      if (msg.code === PartyInput.KEYS.P1_MAIN) pump("p1", PER_TAP);
      if (msg.code === PartyInput.KEYS.P1_EXTRA) pump("p1", CAREFUL);
      if (cfg.mode === "pvp") {
        if (msg.code === PartyInput.KEYS.P2_MAIN) pump("p2", PER_TAP);
        if (msg.code === PartyInput.KEYS.P2_EXTRA) pump("p2", CAREFUL);
      }
    }

    function loop(now) {
      if (destroyed) return;
      raf = requestAnimationFrame(loop);
      if (!running || finished) return;
      var left = Math.max(0, DURATION - (now - startAt) / 1000);
      els.timer.textContent = left.toFixed(1);
      if (left <= 0) {
        var winner = "draw";
        if (!popped.p1 && !popped.p2) {
          if (fill.p1 > fill.p2) winner = "p1";
          else if (fill.p2 > fill.p1) winner = "p2";
        } else if (!popped.p1) winner = "p1";
        else if (!popped.p2) winner = "p2";
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
      var sub =
        (popped.p1 ? "펑" : Math.floor(fill.p1) + "%") +
        " : " +
        (popped.p2 ? "펑" : Math.floor(fill.p2) + "%");
      resultCtrl = PartyUI.showResult(els.overlay, {
        winner: winner,
        mode: cfg.mode,
        sub: sub,
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
        popped = { p1: false, p2: false };
        rollPop();
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
              var profile = PartyAI.pickProfile(cfg.difficulty || "normal");
              ai = PartyAI.createMasher(
                cfg.difficulty || "normal",
                function () {
                  if (popped.p2 || finished) return;
                  // 커질수록 조심 펌프 비율↑
                  var risky = fill.p2 > 50;
                  var careful =
                    risky && Math.random() < 0.35 + profile.mistakeRate * 0.5;
                  // hard takes more risk late for bigger score
                  if (profile.mistakeRate < 0.1 && fill.p2 < popAt.p2 - 8) {
                    careful = Math.random() < 0.25;
                  }
                  pump("p2", careful ? CAREFUL : PER_TAP);
                },
                {
                  paceScale: function () {
                    return fill.p2 > 55 ? 1.25 : 1;
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

  global.GameBalloon = { create: createBalloon };
})(window);
