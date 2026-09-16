/* 눈치 대결 — 신호 후 빠른 손, 3판 2선승 */
(function (global) {
  "use strict";

  function createDraw() {
    var root = null;
    var cfg = null;
    var input = null;
    var destroyed = false;
    var phase = "idle";
    var scores = { p1: 0, p2: 0 };
    var round = 0;
    var timers = [];
    var aiTimer = 0;
    var raf = 0;
    var els = {};

    function p2Label() {
      return cfg.mode === "ai" ? "AI" : "P2";
    }

    function sfx(name) {
      if (global.PartyApp && PartyApp.sfx) PartyApp.sfx(name);
    }

    function clearTimers() {
      for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
      timers = [];
      if (aiTimer) {
        clearTimeout(aiTimer);
        aiTimer = 0;
      }
    }

    function later(fn, ms) {
      var id = setTimeout(function () {
        if (!destroyed) fn();
      }, ms);
      timers.push(id);
      return id;
    }

    function build() {
      root.innerHTML =
        '<div class="hud">' +
        '<div class="hud-player p1"><span class="tag">P1</span><span id="draw-s1">0</span></div>' +
        '<div class="hud-center"><div class="hud-timer" id="draw-round">라운드 1</div></div>' +
        '<div class="hud-player p2"><span class="tag">' +
        p2Label() +
        '</span><span id="draw-s2">0</span></div>' +
        "</div>" +
        '<div class="game-stage draw-arena" id="draw-arena">' +
        '<div class="game-hint">신호 전·가짜 신호에 누르면 실격 · 주행동 A / L</div>' +
        '<div class="draw-signal wait" id="draw-sig">준비</div>' +
        '<div class="draw-rounds"><span>P1 <strong id="draw-w1">0</strong></span><span>' +
        p2Label() +
        ' <strong id="draw-w2">0</strong></span></div>' +
        '<div class="overlay" id="draw-overlay"><div class="countdown-num">3</div></div>' +
        "</div>";
      els.sig = root.querySelector("#draw-sig");
      els.overlay = root.querySelector("#draw-overlay");
      els.round = root.querySelector("#draw-round");
      els.w1 = root.querySelector("#draw-w1");
      els.w2 = root.querySelector("#draw-w2");
      els.s1 = root.querySelector("#draw-s1");
      els.s2 = root.querySelector("#draw-s2");
      els.arena = root.querySelector("#draw-arena");
    }

    function updateScores() {
      els.w1.textContent = String(scores.p1);
      els.w2.textContent = String(scores.p2);
      els.s1.textContent = String(scores.p1);
      els.s2.textContent = String(scores.p2);
    }

    function setSig(text, cls) {
      els.sig.textContent = text;
      els.sig.className = "draw-signal " + cls;
    }

    function winRound(who, reason) {
      if (phase === "locked") return;
      phase = "locked";
      clearTimers();
      if (who === "p1") scores.p1++;
      else if (who === "p2") scores.p2++;
      updateScores();
      sfx("tap");
      setSig(reason, who === "p1" ? "go" : "fake");
      later(function () {
        if (scores.p1 >= 2 || scores.p2 >= 2 || round >= 3) endMatch();
        else beginRound();
      }, 900);
    }

    function endMatch() {
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
        '<button type="button" class="btn btn-primary" id="draw-again">다시하기</button>' +
        '<button type="button" class="btn" id="draw-lobby">로비</button>' +
        "</div>";
      els.overlay.classList.remove("hidden");
      sfx(winner === "draw" ? "draw" : "win");
      if (cfg.onFinish) cfg.onFinish({ winner: winner, pending: true });
      root.querySelector("#draw-again").onclick = function () {
        if (cfg.onFinish) cfg.onFinish({ winner: winner, replay: true });
      };
      root.querySelector("#draw-lobby").onclick = function () {
        if (cfg.onFinish) cfg.onFinish({ winner: winner, replay: false });
      };
    }

    function beginGo() {
      phase = "go";
      setSig("지금!", "go");
      sfx("go");
      if (cfg.mode === "ai") {
        if (aiTimer) clearTimeout(aiTimer);
        var delay = PartyAI.reactionDelay(cfg.difficulty || "normal");
        aiTimer = setTimeout(function () {
          if (destroyed || phase !== "go") return;
          winRound("p2", "AI가 더 빠름!");
        }, delay);
      }
    }

    function beginRound() {
      clearTimers();
      round++;
      phase = "wait";
      els.round.textContent = "라운드 " + round;
      setSig("대기...", "wait");

      var wait = 1200 + Math.random() * 2300;
      var useFake = Math.random() < 0.35;

      if (useFake) {
        var fakeAt = 700 + Math.random() * Math.min(1200, wait - 500);
        later(function () {
          if (phase !== "wait") return;
          phase = "fake";
          setSig("잠깐!", "fake");
          sfx("fake");
          later(function () {
            if (phase !== "fake") return;
            phase = "wait";
            setSig("대기...", "wait");
          }, 450 + Math.random() * 350);
        }, fakeAt);
      }

      later(function () {
        if (phase === "locked") return;
        beginGo();
      }, wait);

      // 신호 전 AI 실수
      if (cfg.mode === "ai" && PartyAI.shouldFalseStart(cfg.difficulty || "normal")) {
        var early = 500 + Math.random() * Math.min(1500, wait - 200);
        aiTimer = setTimeout(function () {
          if (destroyed) return;
          if (phase === "wait" || phase === "fake") winRound("p1", "AI 실격!");
        }, early);
      }
    }

    function onInput(msg) {
      if (msg.type !== "down") return;
      var who = null;
      if (msg.code === PartyInput.KEYS.P1_MAIN) who = "p1";
      else if (cfg.mode === "pvp" && msg.code === PartyInput.KEYS.P2_MAIN) who = "p2";
      else return;

      if (phase === "wait" || phase === "fake") {
        winRound(who === "p1" ? "p2" : "p1", (who === "p1" ? "P1" : p2Label()) + " 실격!");
        return;
      }
      if (phase === "go") {
        if (aiTimer) {
          clearTimeout(aiTimer);
          aiTimer = 0;
        }
        winRound(who, (who === "p1" ? "P1" : p2Label()) + " 선제!");
      }
    }

    function countdown(done) {
      els.overlay.classList.remove("hidden");
      els.overlay.innerHTML = '<div class="countdown-num" id="draw-cd">3</div>';
      var cd = root.querySelector("#draw-cd");
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
        scores = { p1: 0, p2: 0 };
        round = 0;
        phase = "idle";
        build();
        input = PartyInput.create({ ignoreP2: cfg.mode === "ai" });
        input.on(onInput);
      },
      start: function () {
        countdown(function () {
          if (!destroyed) beginRound();
        });
      },
      destroy: function () {
        destroyed = true;
        clearTimers();
        if (raf) cancelAnimationFrame(raf);
        if (input) input.destroy();
        input = null;
        root = null;
      },
    };
  }

  global.GameDraw = { create: createDraw };
})(window);
