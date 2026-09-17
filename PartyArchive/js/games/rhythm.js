/* 비트 탭 — 박자에 맞춰 탭, 합산 점수 */
(function (global) {
  "use strict";

  var DURATION = 20;
  var BEAT_MS = 650;
  var WINDOW = 140;

  function createRhythm() {
    var root = null;
    var cfg = null;
    var input = null;
    var ai = null;
    var raf = 0;
    var destroyed = false;
    var running = false;
    var finished = false;
    var scores = { p1: 0, p2: 0 };
    var startAt = 0;
    var nextBeat = 0;
    var beatIdx = 0;
    var hitThisBeat = { p1: false, p2: false };
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
        '<div class="hud-player p1"><span class="tag">P1</span><span id="rh-s1">0</span></div>' +
        '<div class="hud-center"><div class="hud-timer" id="rh-timer">20.0</div></div>' +
        '<div class="hud-player p2"><span class="tag">' +
        p2Label() +
        '</span><span id="rh-s2">0</span></div>' +
        "</div>" +
        '<div class="game-stage rhythm-arena" id="rh-arena">' +
        '<div class="game-hint">원이 작아질 때 탭! 빗나가면 -1</div>' +
        '<div class="rhythm-pulse" id="rh-pulse"></div>' +
        '<div class="rhythm-beat" id="rh-beat">준비</div>' +
        '<div class="overlay" id="rh-overlay"><div class="countdown-num">3</div></div>' +
        "</div>";
      els.timer = root.querySelector("#rh-timer");
      els.s1 = root.querySelector("#rh-s1");
      els.s2 = root.querySelector("#rh-s2");
      els.pulse = root.querySelector("#rh-pulse");
      els.beat = root.querySelector("#rh-beat");
      els.overlay = root.querySelector("#rh-overlay");
      els.arena = root.querySelector("#rh-arena");
    }

    function paintScores() {
      els.s1.textContent = String(scores.p1);
      els.s2.textContent = String(scores.p2);
    }

    function tryTap(who, now) {
      if (!running || finished) return;
      var dist = Math.abs(now - nextBeat);
      // also allow just-after previous beat window
      var prev = nextBeat - BEAT_MS;
      var d2 = Math.abs(now - prev);
      var best = Math.min(dist, d2);
      if (best <= WINDOW) {
        if (hitThisBeat[who] && dist <= WINDOW) return;
        if (d2 <= WINDOW && dist > WINDOW) {
          // late for previous — already counted window, ignore double
        }
        hitThisBeat[who] = true;
        var pts = best < 50 ? 3 : best < 90 ? 2 : 1;
        scores[who] += pts;
        PartyUI.spawnPopup(els.arena, "+" + pts, who === "p1" ? 30 : 70, 45, who === "p1" ? "pop-p1" : "pop-p2");
        sfx("score", { score: 40 + pts * 20 });
        paintScores();
      } else {
        scores[who] = Math.max(0, scores[who] - 1);
        sfx("miss");
        paintScores();
      }
    }

    function onInput(msg) {
      if (msg.type !== "down" || !running) return;
      var now = performance.now();
      if (msg.code === PartyInput.KEYS.P1_MAIN) tryTap("p1", now);
      if (cfg.mode === "pvp" && msg.code === PartyInput.KEYS.P2_MAIN) tryTap("p2", now);
    }

    function loop(now) {
      if (destroyed) return;
      raf = requestAnimationFrame(loop);
      if (!running || finished) return;

      var left = Math.max(0, DURATION - (now - startAt) / 1000);
      els.timer.textContent = left.toFixed(1);

      var until = nextBeat - now;
      var t = 1 - Math.max(0, Math.min(1, until / BEAT_MS));
      var scale = 1.6 - t * 0.9;
      els.pulse.style.transform = "scale(" + scale + ")";
      els.pulse.style.opacity = String(0.35 + t * 0.55);

      if (now >= nextBeat) {
        beatIdx++;
        els.beat.textContent = "박!";
        els.beat.classList.remove("flash");
        void els.beat.offsetWidth;
        els.beat.classList.add("flash");
        sfx("tick");
        hitThisBeat = { p1: false, p2: false };
        nextBeat += BEAT_MS;
      }

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

    return {
      init: function (rootEl, options) {
        root = rootEl;
        cfg = options || {};
        destroyed = false;
        finished = false;
        running = false;
        scores = { p1: 0, p2: 0 };
        build();
        paintScores();
        input = PartyInput.create({ ignoreP2: cfg.mode === "ai" });
        input.on(onInput);
      },
      start: function () {
        cdCtrl = PartyUI.runCountdown(els.overlay, {
          done: function () {
            if (destroyed) return;
            running = true;
            startAt = performance.now();
            nextBeat = startAt + BEAT_MS;
            beatIdx = 0;
            raf = requestAnimationFrame(loop);
            if (cfg.mode === "ai") {
              ai = PartyAI.createActor(
                cfg.difficulty || "normal",
                function (now) {
                  return Math.abs(now - nextBeat) < WINDOW + 30;
                },
                function () {
                  var offset = PartyAI.timingOffset(cfg.difficulty || "normal", WINDOW);
                  // approximate by tapping "now" with error already in reaction delay
                  tryTap("p2", performance.now() + offset * 0.2);
                },
                { minGap: BEAT_MS * 0.7 }
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

  global.GameRhythm = { create: createRhythm };
})(window);
