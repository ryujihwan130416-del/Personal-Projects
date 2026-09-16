/* 줄다리기 — 연타로 깃발 끌기 (~20초) */
(function (global) {
  "use strict";

  var DURATION = 20;
  var RANGE = 42;

  function createTug() {
    var root = null;
    var cfg = null;
    var input = null;
    var ai = null;
    var raf = 0;
    var destroyed = false;
    var running = false;
    var flag = 50;
    var startAt = 0;
    var finished = false;
    var els = {};

    function p2Label() {
      return cfg.mode === "ai" ? "AI" : "P2";
    }

    function sfx(name) {
      if (global.PartyApp && PartyApp.sfx) PartyApp.sfx(name);
    }

    function build() {
      root.innerHTML =
        '<div class="hud">' +
        '<div class="hud-player p1"><span class="tag">P1</span><span>연타 A</span></div>' +
        '<div class="hud-center"><div class="hud-timer" id="tug-timer">20.0</div></div>' +
        '<div class="hud-player p2"><span class="tag">' +
        p2Label() +
        "</span><span>연타 L</span></div>" +
        "</div>" +
        '<div class="game-stage tug-arena" id="tug-arena">' +
        '<div class="tug-rope"></div>' +
        '<div class="tug-flag" id="tug-flag" style="left:50%"></div>' +
        '<div class="tug-labels"><span style="color:var(--p1-dark)">P1</span><span style="color:var(--p2-dark)">' +
        p2Label() +
        "</span></div>" +
        '<div class="overlay" id="tug-overlay"><div class="countdown-num" id="tug-cd">3</div></div>' +
        "</div>";
      els.timer = root.querySelector("#tug-timer");
      els.flag = root.querySelector("#tug-flag");
      els.overlay = root.querySelector("#tug-overlay");
      els.cd = root.querySelector("#tug-cd");
      els.arena = root.querySelector("#tug-arena");
    }

    function nudge(dir) {
      if (!running || finished) return;
      flag = Math.max(50 - RANGE, Math.min(50 + RANGE, flag + dir));
      els.flag.style.left = flag + "%";
      sfx("tap");
    }

    function onInput(msg) {
      if (msg.type !== "down" || !running) return;
      if (msg.code === PartyInput.KEYS.P1_MAIN) nudge(-1.15);
      if (cfg.mode === "pvp" && msg.code === PartyInput.KEYS.P2_MAIN) nudge(1.15);
    }

    function loop(now) {
      if (destroyed) return;
      raf = requestAnimationFrame(loop);
      if (!running || finished) return;
      var left = Math.max(0, DURATION - (now - startAt) / 1000);
      els.timer.textContent = left.toFixed(1);
      if (left <= 0) endRound();
    }

    function endRound() {
      if (finished) return;
      finished = true;
      running = false;
      if (ai) {
        ai.destroy();
        ai = null;
      }
      var winner = "draw";
      if (flag < 49.2) winner = "p1";
      else if (flag > 50.8) winner = "p2";
      showResult(winner);
    }

    function showResult(winner) {
      els.arena.classList.add("shake");
      var title =
        winner === "draw" ? "무승부!" : winner === "p1" ? "P1 승리!" : p2Label() + " 승리!";
      els.overlay.innerHTML =
        '<div class="result-title">' +
        title +
        "</div>" +
        '<div class="result-sub">깃발 위치 ' +
        flag.toFixed(1) +
        "%</div>" +
        '<div class="result-actions">' +
        '<button type="button" class="btn btn-primary" id="tug-again">다시하기</button>' +
        '<button type="button" class="btn" id="tug-lobby">로비</button>' +
        "</div>";
      els.overlay.classList.remove("hidden");
      sfx(winner === "draw" ? "draw" : "win");
      if (cfg.onFinish) cfg.onFinish({ winner: winner, pending: true });
      root.querySelector("#tug-again").onclick = function () {
        if (cfg.onFinish) cfg.onFinish({ winner: winner, replay: true });
      };
      root.querySelector("#tug-lobby").onclick = function () {
        if (cfg.onFinish) cfg.onFinish({ winner: winner, replay: false });
      };
    }

    function countdown(done) {
      var n = 3;
      els.overlay.classList.remove("hidden");
      els.overlay.innerHTML = '<div class="countdown-num" id="tug-cd">3</div>';
      els.cd = root.querySelector("#tug-cd");
      sfx("cd");
      var t0 = performance.now();
      function tick(now) {
        if (destroyed) return;
        var elapsed = (now - t0) / 1000;
        var next = 3 - Math.floor(elapsed);
        if (next !== n && next >= 1) {
          n = next;
          els.cd.textContent = String(n);
          els.cd.style.animation = "none";
          void els.cd.offsetWidth;
          els.cd.style.animation = "";
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
        flag = 50;
        running = false;
        build();
        input = PartyInput.create({ ignoreP2: cfg.mode === "ai" });
        input.on(onInput);
      },
      start: function () {
        countdown(function () {
          if (destroyed) return;
          running = true;
          startAt = performance.now();
          raf = requestAnimationFrame(loop);
          if (cfg.mode === "ai") {
            ai = PartyAI.createMasher(cfg.difficulty || "normal", function () {
              nudge(1.15);
            });
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

  global.GameTug = { create: createTug };
})(window);
