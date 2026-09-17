/* 줄다리기 — 연타 + 보조키 버티기(저항) */
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
    var braceUntil = { p1: 0, p2: 0 };
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
        '<div class="hud-player p1"><span class="tag">P1</span><span>A 끌기 · S 버티기</span></div>' +
        '<div class="hud-center"><div class="hud-timer" id="tug-timer">20.0</div></div>' +
        '<div class="hud-player p2"><span class="tag">' +
        p2Label() +
        "</span><span>L 끌기 · K 버티기</span></div>" +
        "</div>" +
        '<div class="game-stage tug-arena" id="tug-arena">' +
        '<div class="game-hint">버티기 중엔 끌림이 줄어듭니다 (0.45초)</div>' +
        '<div class="tug-rope" id="tug-rope"></div>' +
        '<div class="tug-flag" id="tug-flag" style="left:50%"></div>' +
        '<div class="tug-labels"><span style="color:var(--p1-dark)">P1</span><span style="color:var(--p2-dark)">' +
        p2Label() +
        "</span></div>" +
        '<div class="overlay" id="tug-overlay"><div class="countdown-num">3</div></div>' +
        "</div>";
      els.timer = root.querySelector("#tug-timer");
      els.flag = root.querySelector("#tug-flag");
      els.rope = root.querySelector("#tug-rope");
      els.overlay = root.querySelector("#tug-overlay");
      els.arena = root.querySelector("#tug-arena");
    }

    function paintFlag() {
      els.flag.style.left = flag + "%";
      var stretch = 1 + Math.abs(flag - 50) / 80;
      els.rope.style.transform = "translateY(-50%) scaleX(" + stretch + ")";
      els.flag.style.transform =
        "translateY(-70%) rotate(" + (flag - 50) * 0.35 + "deg)";
      els.arena.classList.toggle("brace-p1", performance.now() < braceUntil.p1);
      els.arena.classList.toggle("brace-p2", performance.now() < braceUntil.p2);
    }

    function nudge(dir, from) {
      if (!running || finished) return;
      var now = performance.now();
      var target = dir < 0 ? "p2" : "p1"; // pulling toward self moves flag; dir negative = p1
      // if opponent bracing, reduce pull
      var scale = 1;
      if (dir < 0 && now < braceUntil.p2) scale = 0.35;
      if (dir > 0 && now < braceUntil.p1) scale = 0.35;
      flag = Math.max(50 - RANGE, Math.min(50 + RANGE, flag + dir * scale));
      paintFlag();
      sfx("mash");
    }

    function brace(who) {
      if (!running || finished) return;
      braceUntil[who] = performance.now() + 450;
      sfx("thud");
      paintFlag();
    }

    function onInput(msg) {
      if (msg.type !== "down" || !running) return;
      if (msg.code === PartyInput.KEYS.P1_MAIN) nudge(-1.2, "p1");
      if (msg.code === PartyInput.KEYS.P1_ALT) brace("p1");
      if (cfg.mode === "pvp") {
        if (msg.code === PartyInput.KEYS.P2_MAIN) nudge(1.2, "p2");
        if (msg.code === PartyInput.KEYS.P2_ALT) brace("p2");
      }
    }

    function loop(now) {
      if (destroyed) return;
      raf = requestAnimationFrame(loop);
      if (!running || finished) return;
      paintFlag();
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
      if (cfg.onFinish) cfg.onFinish({ winner: winner, pending: true });
      resultCtrl = PartyUI.showResult(els.overlay, {
        winner: winner,
        mode: cfg.mode,
        sub: "깃발 위치 " + flag.toFixed(1) + "%",
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
        flag = 50;
        running = false;
        braceUntil = { p1: 0, p2: 0 };
        build();
        paintFlag();
        input = PartyInput.create({ ignoreP2: cfg.mode === "ai" });
        input.on(onInput);
      },
      start: function () {
        cdCtrl = PartyUI.runCountdown(els.overlay, {
          done: function () {
            if (destroyed) return;
            running = true;
            startAt = performance.now();
            sfx("mashReset");
            raf = requestAnimationFrame(loop);
            if (cfg.mode === "ai") {
              var lastBrace = 0;
              ai = PartyAI.createMasher(cfg.difficulty || "normal", function () {
                var now = performance.now();
                // sometimes brace when flag is near AI side being pulled
                if (flag < 48 && now - lastBrace > 800 && Math.random() < 0.35) {
                  brace("p2");
                  lastBrace = now;
                  return;
                }
                nudge(1.2, "p2");
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

  global.GameTug = { create: createTug };
})(window);
