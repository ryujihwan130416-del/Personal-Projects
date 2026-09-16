/* 타이밍 스톱 — 좌우 바 동시, 3라운드 합산 */
(function (global) {
  "use strict";

  var ROUNDS = 3;
  var TRACK_H = 280;
  var ZONE_H = 48;
  var NEEDLE_H = 14;

  function createStopbar() {
    var root = null;
    var cfg = null;
    var input = null;
    var destroyed = false;
    var running = false;
    var finished = false;
    var round = 0;
    var scores = { p1: 0, p2: 0 };
    var roundScore = { p1: null, p2: null };
    var bars = {
      p1: { pos: 0, dir: 1, speed: 180, stopped: false, zoneY: 0 },
      p2: { pos: 0, dir: 1, speed: 180, stopped: false, zoneY: 0 },
    };
    var last = 0;
    var raf = 0;
    var ai = null;
    var aiArmed = false;
    var timers = [];
    var els = {};

    function later(fn, ms) {
      var id = setTimeout(function () {
        if (!destroyed) fn();
      }, ms);
      timers.push(id);
    }

    function p2Label() {
      return cfg.mode === "ai" ? "AI" : "P2";
    }

    function sfx(name) {
      if (global.PartyApp && PartyApp.sfx) PartyApp.sfx(name);
    }

    function build() {
      root.innerHTML =
        '<div class="hud">' +
        '<div class="hud-player p1"><span class="tag">P1</span><span id="sb-s1">0</span></div>' +
        '<div class="hud-center"><div class="hud-timer" id="sb-round">라운드 1 / 3</div></div>' +
        '<div class="hud-player p2"><span class="tag">' +
        p2Label() +
        '</span><span id="sb-s2">0</span></div>' +
        "</div>" +
        '<div class="game-stage stopbar-arena" id="sb-arena">' +
        '<div class="stop-lane p1">' +
        '<div>P1 · A</div>' +
        '<div class="stop-track" id="track1">' +
        '<div class="stop-zone" id="zone1"></div>' +
        '<div class="stop-needle" id="needle1"></div>' +
        "</div>" +
        '<div class="stop-score" id="score1">-</div>' +
        "</div>" +
        '<div class="stop-lane p2">' +
        "<div>" +
        p2Label() +
        " · L</div>" +
        '<div class="stop-track" id="track2">' +
        '<div class="stop-zone" id="zone2"></div>' +
        '<div class="stop-needle" id="needle2"></div>' +
        "</div>" +
        '<div class="stop-score" id="score2">-</div>' +
        "</div>" +
        '<div class="overlay" id="sb-overlay"><div class="countdown-num">3</div></div>' +
        "</div>";
      els.overlay = root.querySelector("#sb-overlay");
      els.round = root.querySelector("#sb-round");
      els.s1 = root.querySelector("#sb-s1");
      els.s2 = root.querySelector("#sb-s2");
      els.n1 = root.querySelector("#needle1");
      els.n2 = root.querySelector("#needle2");
      els.z1 = root.querySelector("#zone1");
      els.z2 = root.querySelector("#zone2");
      els.sc1 = root.querySelector("#score1");
      els.sc2 = root.querySelector("#score2");
      els.arena = root.querySelector("#sb-arena");
    }

    function placeZones() {
      // 존 중앙 y (바늘 top 기준 좌표)
      var maxY = TRACK_H - ZONE_H;
      bars.p1.zoneY = 40 + Math.random() * (maxY - 80);
      bars.p2.zoneY = 40 + Math.random() * (maxY - 80);
      els.z1.style.top = bars.p1.zoneY + "px";
      els.z2.style.top = bars.p2.zoneY + "px";
      bars.p1.pos = Math.random() * (TRACK_H - NEEDLE_H);
      bars.p2.pos = Math.random() * (TRACK_H - NEEDLE_H);
      bars.p1.dir = Math.random() < 0.5 ? 1 : -1;
      bars.p2.dir = Math.random() < 0.5 ? 1 : -1;
      bars.p1.speed = 160 + Math.random() * 80;
      bars.p2.speed = 160 + Math.random() * 80;
      bars.p1.stopped = false;
      bars.p2.stopped = false;
      roundScore.p1 = null;
      roundScore.p2 = null;
      els.sc1.textContent = "-";
      els.sc2.textContent = "-";
      aiArmed = false;
      paint();
    }

    function paint() {
      els.n1.style.top = bars.p1.pos + "px";
      els.n2.style.top = bars.p2.pos + "px";
    }

    function scoreFor(who) {
      var b = bars[who];
      var needleMid = b.pos + NEEDLE_H / 2;
      var zoneMid = b.zoneY + ZONE_H / 2;
      var dist = Math.abs(needleMid - zoneMid);
      var half = ZONE_H / 2;
      if (dist > half + 8) return Math.max(0, Math.round(40 - dist));
      var t = 1 - dist / half;
      return Math.round(60 + 40 * t);
    }

    function stop(who) {
      if (!running || finished || bars[who].stopped) return;
      bars[who].stopped = true;
      var sc = scoreFor(who);
      roundScore[who] = sc;
      if (who === "p1") els.sc1.textContent = String(sc);
      else els.sc2.textContent = String(sc);
      sfx("tap");
      if (roundScore.p1 != null && roundScore.p2 != null) endRound();
    }

    function endRound() {
      scores.p1 += roundScore.p1;
      scores.p2 += roundScore.p2;
      els.s1.textContent = String(scores.p1);
      els.s2.textContent = String(scores.p2);
      running = false;
      if (ai) {
        ai.destroy();
        ai = null;
      }
      if (round >= ROUNDS) {
        setTimeout(function () {
          if (!destroyed) endMatch();
        }, 700);
      } else {
        setTimeout(function () {
          if (!destroyed) startRound();
        }, 900);
      }
    }

    function endMatch() {
      finished = true;
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
        '<div class="result-sub">합계 ' +
        scores.p1 +
        " : " +
        scores.p2 +
        "</div>" +
        '<div class="result-actions">' +
        '<button type="button" class="btn btn-primary" id="sb-again">다시하기</button>' +
        '<button type="button" class="btn" id="sb-lobby">로비</button>' +
        "</div>";
      els.overlay.classList.remove("hidden");
      sfx(winner === "draw" ? "draw" : "win");
      if (cfg.onFinish) cfg.onFinish({ winner: winner, pending: true });
      root.querySelector("#sb-again").onclick = function () {
        if (cfg.onFinish) cfg.onFinish({ winner: winner, replay: true });
      };
      root.querySelector("#sb-lobby").onclick = function () {
        if (cfg.onFinish) cfg.onFinish({ winner: winner, replay: false });
      };
    }

    function startRound() {
      round++;
      els.round.textContent = "라운드 " + round + " / " + ROUNDS;
      placeZones();
      running = true;
      last = performance.now();
      if (cfg.mode === "ai") setupAi();
    }

    function setupAi() {
      if (ai) ai.destroy();
      var targetOffset = PartyAI.timingOffset(cfg.difficulty || "normal", ZONE_H / 2);
      aiArmed = false;
      ai = PartyAI.createActor(
        cfg.difficulty || "normal",
        function () {
          if (bars.p2.stopped) return false;
          var needleMid = bars.p2.pos + NEEDLE_H / 2;
          var zoneMid = bars.p2.zoneY + ZONE_H / 2 + targetOffset;
          var half = ZONE_H / 2 + 6;
          var inZone = Math.abs(needleMid - zoneMid) < half;
          if (inZone) aiArmed = true;
          return aiArmed && Math.abs(needleMid - zoneMid) < 18;
        },
        function () {
          stop("p2");
        },
        { minGap: 80, canMistake: true }
      );
    }

    function loop(now) {
      if (destroyed) return;
      raf = requestAnimationFrame(loop);
      if (!running || finished) return;
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ["p1", "p2"].forEach(function (who) {
        var b = bars[who];
        if (b.stopped) return;
        b.pos += b.dir * b.speed * dt;
        if (b.pos <= 0) {
          b.pos = 0;
          b.dir = 1;
        } else if (b.pos >= TRACK_H - NEEDLE_H) {
          b.pos = TRACK_H - NEEDLE_H;
          b.dir = -1;
        }
      });
      paint();
    }

    function onInput(msg) {
      if (msg.type !== "down" || !running) return;
      if (msg.code === PartyInput.KEYS.P1_MAIN) stop("p1");
      if (cfg.mode === "pvp" && msg.code === PartyInput.KEYS.P2_MAIN) stop("p2");
    }

    function countdown(done) {
      els.overlay.classList.remove("hidden");
      els.overlay.innerHTML = '<div class="countdown-num" id="sb-cd">3</div>';
      var cd = root.querySelector("#sb-cd");
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
        finished = false;
        running = false;
        round = 0;
        scores = { p1: 0, p2: 0 };
        build();
        input = PartyInput.create({ ignoreP2: cfg.mode === "ai" });
        input.on(onInput);
      },
      start: function () {
        countdown(function () {
          if (destroyed) return;
          raf = requestAnimationFrame(loop);
          startRound();
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

  global.GameStopbar = { create: createStopbar };
})(window);
