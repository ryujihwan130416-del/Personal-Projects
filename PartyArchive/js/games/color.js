/* 색 신호 — 내 색만 누르기, 3판 2선승 */
(function (global) {
  "use strict";

  var TIE_MS = 40;

  function createColor() {
    var root = null;
    var cfg = null;
    var input = null;
    var destroyed = false;
    var phase = "idle";
    var scores = { p1: 0, p2: 0 };
    var round = 0;
    var bag = null;
    var aiTimer = 0;
    var signal = null; // "p1" | "p2" | "both" | "none"
    var pendingWho = null;
    var pendingAt = 0;
    var cdCtrl = null;
    var resultCtrl = null;
    var els = {};

    function p2Label() {
      return PartyUI.p2Label(cfg.mode);
    }

    function sfx(name) {
      if (global.PartyApp && PartyApp.sfx) PartyApp.sfx(name);
    }

    function clearAi() {
      if (aiTimer) {
        clearTimeout(aiTimer);
        aiTimer = 0;
      }
    }

    function build() {
      root.innerHTML =
        '<div class="hud">' +
        '<div class="hud-player p1"><span class="tag">P1</span><span id="cl-s1">0</span></div>' +
        '<div class="hud-center"><div class="hud-timer" id="cl-round">라운드 1</div></div>' +
        '<div class="hud-player p2"><span class="tag">' +
        p2Label() +
        '</span><span id="cl-s2">0</span></div>' +
        "</div>" +
        '<div class="game-stage color-arena" id="cl-arena">' +
        '<div class="game-hint">빨강=P1 · 파랑=' +
        p2Label() +
        " · 노랑=둘 다 · 회색=금지</div>" +
        '<div class="color-lamp wait" id="cl-lamp">대기</div>' +
        '<div class="overlay" id="cl-overlay"><div class="countdown-num">3</div></div>' +
        "</div>";
      els.lamp = root.querySelector("#cl-lamp");
      els.overlay = root.querySelector("#cl-overlay");
      els.round = root.querySelector("#cl-round");
      els.s1 = root.querySelector("#cl-s1");
      els.s2 = root.querySelector("#cl-s2");
      els.arena = root.querySelector("#cl-arena");
    }

    function setLamp(text, cls) {
      els.lamp.textContent = text;
      els.lamp.className = "color-lamp " + cls;
    }

    function updateScores() {
      els.s1.textContent = String(scores.p1);
      els.s2.textContent = String(scores.p2);
    }

    function winRound(who, reason) {
      if (phase === "locked") return;
      phase = "locked";
      pendingWho = null;
      if (bag) bag.clear();
      clearAi();
      if (who === "p1") scores.p1++;
      else if (who === "p2") scores.p2++;
      updateScores();
      sfx(who === "tie" ? "draw" : "tap");
      setLamp(reason, "wait");
      bag = PartyUI.createTimerBag();
      bag.later(function () {
        if (scores.p1 >= 2 || scores.p2 >= 2 || round >= 3) endMatch();
        else beginRound();
      }, 850);
    }

    function endMatch() {
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

    function allowed(who) {
      if (signal === "both") return true;
      return signal === who;
    }

    function resolvePress(who) {
      if (phase !== "go") return;
      if (signal === "none") {
        winRound(who === "p1" ? "p2" : "p1", (who === "p1" ? "P1" : p2Label()) + " 오답!");
        return;
      }
      if (!allowed(who)) {
        winRound(who === "p1" ? "p2" : "p1", (who === "p1" ? "P1" : p2Label()) + " 오답!");
        return;
      }
      var now = performance.now();
      if (pendingWho && pendingWho !== who && now - pendingAt <= TIE_MS) {
        winRound("tie", "동시!");
        return;
      }
      if (!pendingWho) {
        pendingWho = who;
        pendingAt = now;
        bag.later(function () {
          if (phase !== "go" || pendingWho !== who) return;
          clearAi();
          winRound(who, (who === "p1" ? "P1" : p2Label()) + " 선제!");
        }, TIE_MS + 2);
        return;
      }
      if (pendingWho !== who) winRound("tie", "동시!");
    }

    function flashSignal() {
      phase = "go";
      pendingWho = null;
      var roll = Math.random();
      if (roll < 0.28) {
        signal = "p1";
        setLamp("빨강!", "sig-p1");
      } else if (roll < 0.56) {
        signal = "p2";
        setLamp("파랑!", "sig-p2");
      } else if (roll < 0.82) {
        signal = "both";
        setLamp("노랑!", "sig-both");
      } else {
        signal = "none";
        setLamp("금지!", "sig-none");
      }
      sfx(signal === "none" ? "fake" : "signal");

      if (cfg.mode === "ai") {
        clearAi();
        var delay = PartyAI.reactionDelay(cfg.difficulty || "normal");
        if (signal === "none" || signal === "p1") {
          // maybe false press
          if (PartyAI.shouldFalseStart(cfg.difficulty || "normal")) {
            aiTimer = setTimeout(function () {
              if (destroyed || phase !== "go") return;
              resolvePress("p2");
            }, delay);
          }
        } else {
          aiTimer = setTimeout(function () {
            if (destroyed || phase !== "go") return;
            resolvePress("p2");
          }, delay);
        }
      }

      // auto expire round if no one presses
      bag.later(function () {
        if (phase !== "go") return;
        if (signal === "none") winRound("tie", "참아냄!");
        else winRound("tie", "시간 초과");
      }, 1800);
    }

    function beginRound() {
      if (bag) bag.clear();
      bag = PartyUI.createTimerBag();
      clearAi();
      round++;
      phase = "wait";
      signal = null;
      els.round.textContent = "라운드 " + round;
      setLamp("대기...", "wait");
      bag.later(flashSignal, 900 + Math.random() * 1600);
    }

    function onInput(msg) {
      if (msg.type !== "down") return;
      var who = null;
      if (msg.code === PartyInput.KEYS.P1_MAIN) who = "p1";
      else if (cfg.mode === "pvp" && msg.code === PartyInput.KEYS.P2_MAIN) who = "p2";
      else return;
      if (phase === "wait") {
        winRound(who === "p1" ? "p2" : "p1", (who === "p1" ? "P1" : p2Label()) + " 성급!");
        return;
      }
      if (phase === "go") resolvePress(who);
    }

    return {
      init: function (rootEl, options) {
        root = rootEl;
        cfg = options || {};
        destroyed = false;
        scores = { p1: 0, p2: 0 };
        round = 0;
        phase = "idle";
        bag = PartyUI.createTimerBag();
        build();
        input = PartyInput.create({ ignoreP2: cfg.mode === "ai" });
        input.on(onInput);
      },
      start: function () {
        cdCtrl = PartyUI.runCountdown(els.overlay, {
          done: function () {
            if (!destroyed) beginRound();
          },
        });
      },
      destroy: function () {
        destroyed = true;
        if (bag) bag.clear();
        clearAi();
        if (cdCtrl) cdCtrl.cancel();
        if (resultCtrl) resultCtrl.destroy();
        if (input) input.destroy();
        input = null;
        root = null;
      },
    };
  }

  global.GameColor = { create: createColor };
})(window);
