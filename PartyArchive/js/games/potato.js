/* 폭탄 돌리기 — 들고 있을 때 폭발하면 패배 */
(function (global) {
  "use strict";

  var COOLDOWN = 250;

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
        '<div class="hud-player p1"><span class="tag">P1</span><span>던지기 A</span></div>' +
        '<div class="hud-center"><div class="hud-timer" id="pot-timer">?</div></div>' +
        '<div class="hud-player p2"><span class="tag">' +
        p2Label() +
        "</span><span>던지기 L</span></div>" +
        "</div>" +
        '<div class="game-stage potato-arena" id="pot-arena">' +
        '<div class="game-hint" style="position:absolute;top:0;left:0;right:0;color:var(--cream);background:rgba(0,0,0,.35)">폭탄을 상대에게! 터질 때 들고 있으면 패배</div>' +
        '<div class="potato-holder" id="pot-p1"><div>P1</div><div class="bomb fuse" id="bomb1"></div></div>' +
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
    }

    function renderHolder() {
      els.p1.classList.toggle("active", holder === "p1");
      els.p2.classList.toggle("active", holder === "p2");
    }

    function throwBomb(from) {
      if (!running || finished) return;
      var now = performance.now();
      if (now - lastThrow < COOLDOWN) return;
      if (holder !== from) return;
      lastThrow = now;
      holder = from === "p1" ? "p2" : "p1";
      renderHolder();
      sfx("tap");
    }

    function onInput(msg) {
      if (msg.type !== "down" || !running) return;
      if (msg.code === PartyInput.KEYS.P1_MAIN) throwBomb("p1");
      if (cfg.mode === "pvp" && msg.code === PartyInput.KEYS.P2_MAIN) throwBomb("p2");
    }

    function loop(now) {
      if (destroyed) return;
      raf = requestAnimationFrame(loop);
      if (!running || finished) return;
      var total = explodeAt - startAt;
      var left = Math.max(0, explodeAt - now);
      var ratio = left / total;
      els.fill.style.transform = "scaleX(" + ratio + ")";
      // 긴장감: 숫자는 숨기고 느낌만
      els.timer.textContent = left < 3000 ? "!!!" : "...";
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
      els.arena.classList.add("shake");
      // 들고 있는 사람이 패배 → 상대 승
      var winner = holder === "p1" ? "p2" : "p1";
      showResult(winner);
    }

    function showResult(winner) {
      var title = winner === "p1" ? "P1 승리!" : p2Label() + " 승리!";
      var sub = (holder === "p1" ? "P1" : p2Label()) + "이(가) 폭탄을 들고 있었어요";
      els.overlay.innerHTML =
        '<div class="result-title">' +
        title +
        "</div>" +
        '<div class="result-sub">' +
        sub +
        "</div>" +
        '<div class="result-actions">' +
        '<button type="button" class="btn btn-primary" id="pot-again">다시하기</button>' +
        '<button type="button" class="btn" id="pot-lobby">로비</button>' +
        "</div>";
      els.overlay.classList.remove("hidden");
      sfx("win");
      if (cfg.onFinish) cfg.onFinish({ winner: winner, pending: true });
      root.querySelector("#pot-again").onclick = function () {
        if (cfg.onFinish) cfg.onFinish({ winner: winner, replay: true });
      };
      root.querySelector("#pot-lobby").onclick = function () {
        if (cfg.onFinish) cfg.onFinish({ winner: winner, replay: false });
      };
    }

    function countdown(done) {
      els.overlay.classList.remove("hidden");
      els.overlay.innerHTML = '<div class="countdown-num" id="pot-cd">3</div>';
      var cd = root.querySelector("#pot-cd");
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
        holder = Math.random() < 0.5 ? "p1" : "p2";
        build();
        renderHolder();
        input = PartyInput.create({ ignoreP2: cfg.mode === "ai" });
        input.on(onInput);
      },
      start: function () {
        countdown(function () {
          if (destroyed) return;
          running = true;
          startAt = performance.now();
          // 15~30초
          var life = 15000 + Math.random() * 15000;
          explodeAt = startAt + life;
          raf = requestAnimationFrame(loop);

          if (cfg.mode === "ai") {
            ai = PartyAI.createActor(
              cfg.difficulty || "normal",
              function (now) {
                if (holder !== "p2") return false;
                var left = explodeAt - now;
                var total = explodeAt - startAt;
                var urgency = 1 - left / total;
                // 남은 시간이 짧을수록 던질 확률↑
                return Math.random() < 0.02 + urgency * 0.12;
              },
              function () {
                throwBomb("p2");
              },
              { minGap: COOLDOWN, mistakeScale: 0.5 }
            );
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

  global.GamePotato = { create: createPotato };
})(window);
