/* 색 신호 — 색 판정 + 금지색 패스(Q/O). draw와 차별 */
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
    var passed = { p1: false, p2: false };
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
        " · 노랑=둘 · 회색=금지(Q/O 패스)</div>" +
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

    function tryPass(who) {
      if (phase !== "go") return;
      if (signal !== "none") {
        // 패스는 금지색에서만 — 아니면 실격
        winRound(who === "p1" ? "p2" : "p1", (who === "p1" ? "P1" : p2Label()) + " 잘못된 패스!");
        return;
      }
      if (passed[who]) return;
      passed[who] = true;
      sfx("tick");
      if (passed.p1 && (cfg.mode === "ai" || passed.p2)) {
        winRound("tie", "둘 다 패스!");
      } else if (cfg.mode === "pvp" && passed.p1 && passed.p2) {
        winRound("tie", "둘 다 패스!");
      } else if (cfg.mode === "ai" && passed.p1) {
        // AI also should pass on none — if AI already passed via timer
        if (passed.p2) winRound("tie", "둘 다 패스!");
      }
    }

    function flashSignal() {
      phase = "go";
      pendingWho = null;
      passed = { p1: false, p2: false };
      var roll = Math.random();
      if (roll < 0.26) {
        signal = "p1";
        setLamp("빨강!", "sig-p1");
      } else if (roll < 0.52) {
        signal = "p2";
        setLamp("파랑!", "sig-p2");
      } else if (roll < 0.74) {
        signal = "both";
        setLamp("노랑!", "sig-both");
      } else {
        signal = "none";
        setLamp("금지! 패스", "sig-none");
      }
      sfx(signal === "none" ? "fake" : "signal");

      if (cfg.mode === "ai") {
        clearAi();
        var delay = PartyAI.reactionDelay(cfg.difficulty || "normal");
        if (signal === "none") {
          // AI should pass with EXTRA; sometimes mistakes and presses main
          aiTimer = setTimeout(function () {
            if (destroyed || phase !== "go") return;
            if (PartyAI.shouldFalseStart(cfg.difficulty || "normal") && Math.random() < 0.5) {
              resolvePress("p2");
            } else {
              tryPass("p2");
              if (passed.p1) winRound("tie", "둘 다 패스!");
            }
          }, delay);
        } else if (signal === "p1") {
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

      bag.later(function () {
        if (phase !== "go") return;
        if (signal === "none") {
          // 패스 안 한 사람 실격
          if (!passed.p1 && !passed.p2) winRound("tie", "시간 초과");
          else if (!passed.p1) winRound("p2", "P1 미패스");
          else if (!passed.p2 && cfg.mode === "pvp") winRound("p1", p2Label() + " 미패스");
          else winRound("tie", "패스 성공");
        } else winRound("tie", "시간 초과");
      }, 2000);
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
      var isPass = false;
      if (msg.code === PartyInput.KEYS.P1_MAIN) who = "p1";
      else if (msg.code === PartyInput.KEYS.P1_EXTRA) {
        who = "p1";
        isPass = true;
      } else if (cfg.mode === "pvp" && msg.code === PartyInput.KEYS.P2_MAIN) who = "p2";
      else if (cfg.mode === "pvp" && msg.code === PartyInput.KEYS.P2_EXTRA) {
        who = "p2";
        isPass = true;
      } else return;

      if (phase === "wait") {
        winRound(who === "p1" ? "p2" : "p1", (who === "p1" ? "P1" : p2Label()) + " 성급!");
        return;
      }
      if (phase === "go") {
        if (isPass) tryPass(who);
        else resolvePress(who);
      }
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
