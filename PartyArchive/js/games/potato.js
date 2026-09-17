/* 폭탄 돌리기 — 슬램(보조키) + 긴장 곡선 AI */
(function (global) {
  "use strict";

  var COOLDOWN = 250;
  var SLAM_STUN = 450;

  function createPotato() {
    var root = null;
    var cfg = null;
    var input = null;
    var ai = null;
    var raf = 0;
    var destroyed = false;
    var running = false;
    var finished = false;
    var holder = "p1";
    var startAt = 0;
    var explodeAt = 0;
    var lastThrow = 0;
    var stunUntil = { p1: 0, p2: 0 };
    var lastTick = 0;
    var flying = false;
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
        '<div class="hud-player p1"><span class="tag">P1</span><span>A 던지기 · S 슬램</span></div>' +
        '<div class="hud-center"><div class="hud-timer" id="pot-timer">?</div></div>' +
        '<div class="hud-player p2"><span class="tag">' +
        p2Label() +
        "</span><span>L 던지기 · K 슬램</span></div>" +
        "</div>" +
        '<div class="game-stage potato-arena" id="pot-arena">' +
        '<div class="game-hint" style="position:absolute;top:0;left:0;right:0;color:var(--cream);background:rgba(0,0,0,.35)">슬램(S/K)=강하게 던져 상대를 잠깐 경직</div>' +
        '<div class="potato-holder" id="pot-p1"><div>P1</div><div class="bomb fuse" id="bomb1"></div></div>' +
        '<div class="bomb-flight" id="pot-flight" aria-hidden="true"></div>' +
        '<div class="potato-holder" id="pot-p2"><div>' +
        p2Label() +
        '</div><div class="bomb fuse" id="bomb2"></div></div>' +
        '<div class="potato-timer-bar"><div class="potato-timer-fill" id="pot-fill"></div></div>' +
        '<div class="overlay" id="pot-overlay"><div class="countdown-num">3</div></div>' +
        "</div>";
      els.p1 = root.querySelector("#pot-p1");
      els.p2 = root.querySelector("#pot-p2");
      els.fill = root.querySelector("#pot-fill");
      els.timer = root.querySelector("#pot-timer");
      els.overlay = root.querySelector("#pot-overlay");
      els.arena = root.querySelector("#pot-arena");
      els.flight = root.querySelector("#pot-flight");
    }

    function renderHolder() {
      els.p1.classList.toggle("active", holder === "p1" && !flying);
      els.p2.classList.toggle("active", holder === "p2" && !flying);
    }

    function playThrowArc(from, slam) {
      flying = true;
      renderHolder();
      els.flight.className =
        "bomb-flight fly-" + from + (slam ? " slam" : "");
      els.flight.classList.add("visible");
      setTimeout(function () {
        if (destroyed) return;
        flying = false;
        els.flight.classList.remove("visible");
        renderHolder();
      }, slam ? 220 : 160);
    }

    function throwBomb(from, slam) {
      if (!running || finished || flying) return;
      var now = performance.now();
      if (now < stunUntil[from]) return;
      if (!slam && now - lastThrow < COOLDOWN) return;
      if (holder !== from) return;
      lastThrow = now;
      var to = from === "p1" ? "p2" : "p1";
      holder = to;
      if (slam) {
        stunUntil[to] = now + SLAM_STUN;
        sfx("hiss");
      } else {
        sfx("tap");
      }
      playThrowArc(from, !!slam);
    }

    function onInput(msg) {
      if (msg.type !== "down" || !running) return;
      if (msg.code === PartyInput.KEYS.P1_MAIN) throwBomb("p1", false);
      if (msg.code === PartyInput.KEYS.P1_ALT) throwBomb("p1", true);
      if (cfg.mode === "pvp") {
        if (msg.code === PartyInput.KEYS.P2_MAIN) throwBomb("p2", false);
        if (msg.code === PartyInput.KEYS.P2_ALT) throwBomb("p2", true);
      }
    }

    function loop(now) {
      if (destroyed) return;
      raf = requestAnimationFrame(loop);
      if (!running || finished) return;
      var total = explodeAt - startAt;
      var left = Math.max(0, explodeAt - now);
      var ratio = left / total;
      els.fill.style.transform = "scaleX(" + ratio + ")";
      els.timer.textContent = left < 3000 ? "!!!" : "...";

      // fuse tick / hiss as urgency rises
      var urgency = 1 - left / total;
      var tickGap = Math.max(120, 700 - urgency * 580);
      if (now - lastTick > tickGap) {
        lastTick = now;
        sfx(urgency > 0.7 ? "hiss" : "tick");
      }

      if (left <= 0) explode();
    }

    function explode() {
      if (finished) return;
      finished = true;
      running = false;
      if (ai) {
        ai.destroy();
        ai = null;
      }
      sfx("boom");
      var winner = holder === "p1" ? "p2" : "p1";
      if (cfg.onFinish) cfg.onFinish({ winner: winner, pending: true });
      resultCtrl = PartyUI.showResult(els.overlay, {
        winner: winner,
        mode: cfg.mode,
        sub: (holder === "p1" ? "P1" : p2Label()) + "이(가) 폭탄을 들고 있었어요",
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
        flying = false;
        stunUntil = { p1: 0, p2: 0 };
        holder = Math.random() < 0.5 ? "p1" : "p2";
        build();
        renderHolder();
        input = PartyInput.create({ ignoreP2: cfg.mode === "ai" });
        input.on(onInput);
      },
      start: function () {
        cdCtrl = PartyUI.runCountdown(els.overlay, {
          done: function () {
            if (destroyed) return;
            running = true;
            startAt = performance.now();
            var life = 15000 + Math.random() * 15000;
            explodeAt = startAt + life;
            lastTick = startAt;
            raf = requestAnimationFrame(loop);

            if (cfg.mode === "ai") {
              var nextCheck = 0;
              ai = PartyAI.createActor(
                cfg.difficulty || "normal",
                function (now) {
                  if (holder !== "p2" || flying) return false;
                  if (now < stunUntil.p2) return false;
                  if (now < nextCheck) return false;
                  var left = explodeAt - now;
                  var total = explodeAt - startAt;
                  var urgency = 1 - left / total;
                  // tension curve: rare early, frequent late
                  var chance = 0.08 + Math.pow(urgency, 1.6) * 0.85;
                  nextCheck = now + 180 + (1 - urgency) * 420;
                  return Math.random() < chance;
                },
                function () {
                  var left = explodeAt - performance.now();
                  var slam = left < 4500 && Math.random() < 0.45;
                  throwBomb("p2", slam);
                },
                { minGap: COOLDOWN, mistakeScale: 0.35 }
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

  global.GamePotato = { create: createPotato };
})(window);
