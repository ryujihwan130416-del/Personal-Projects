/* 공통 카운트다운 / 결과 오버레이 / 타이머 유틸 */
(function (global) {
  "use strict";

  function sfx(name, opts) {
    if (global.PartyApp && PartyApp.sfx) PartyApp.sfx(name, opts);
  }

  function p2Label(mode) {
    return mode === "ai" ? "AI" : "P2";
  }

  function winnerTitle(winner, mode) {
    if (winner === "draw") return "무승부!";
    if (winner === "p1") return "P1 승리!";
    return p2Label(mode) + " 승리!";
  }

  /**
   * 3-2-1 → "시작!" → done()
   * returns { cancel() }
   */
  function runCountdown(overlay, options) {
    var opts = options || {};
    var destroyed = false;
    var raf = 0;
    var goMs = opts.goMs != null ? opts.goMs : 420;

    overlay.classList.remove("hidden");
    overlay.innerHTML = '<div class="countdown-num">3</div>';
    var cd = overlay.querySelector(".countdown-num");
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
        cd.style.animation = "none";
        void cd.offsetWidth;
        cd.style.animation = "";
        sfx("cd");
      }
      if (elapsed >= 3) {
        cd.textContent = "시작!";
        cd.classList.add("countdown-go");
        sfx("go");
        var goAt = performance.now();
        function goTick(t) {
          if (destroyed) return;
          if (t - goAt >= goMs) {
            overlay.classList.add("hidden");
            if (opts.done) opts.done();
            return;
          }
          raf = requestAnimationFrame(goTick);
        }
        raf = requestAnimationFrame(goTick);
        return;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return {
      cancel: function () {
        destroyed = true;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      },
    };
  }

  /**
   * 결과 오버레이 + Space 다시하기
   * options: { winner, mode, sub, onReplay, onLobby, arenaEl, punch }
   * returns { destroy() } for Space listener cleanup
   */
  function showResult(overlay, options) {
    var opts = options || {};
    var winner = opts.winner;
    var mode = opts.mode;
    var title = winnerTitle(winner, mode);
    overlay.innerHTML =
      '<div class="result-title">' +
      title +
      "</div>" +
      (opts.sub
        ? '<div class="result-sub">' + opts.sub + "</div>"
        : "") +
      '<div class="result-actions">' +
      '<button type="button" class="btn btn-primary" data-ui-again>다시하기 (Space)</button>' +
      '<button type="button" class="btn" data-ui-lobby>로비</button>' +
      "</div>";
    overlay.classList.remove("hidden");

    if (opts.arenaEl) {
      opts.arenaEl.classList.remove("shake", "shake-hard");
      void opts.arenaEl.offsetWidth;
      opts.arenaEl.classList.add(opts.punch && winner !== "draw" ? "shake-hard" : "shake");
    }

    sfx(winner === "draw" ? "draw" : "win");

    var againBtn = overlay.querySelector("[data-ui-again]");
    var lobbyBtn = overlay.querySelector("[data-ui-lobby]");
    var alive = true;
    var input = PartyInput.create({ ignoreP2: true });

    function replay() {
      if (!alive) return;
      alive = false;
      cleanup();
      if (opts.onReplay) opts.onReplay();
    }
    function lobby() {
      if (!alive) return;
      alive = false;
      cleanup();
      if (opts.onLobby) opts.onLobby();
    }
    function cleanup() {
      if (input) {
        input.destroy();
        input = null;
      }
    }

    againBtn.onclick = replay;
    lobbyBtn.onclick = lobby;
    input.on(function (msg) {
      if (msg.type === "down" && msg.code === PartyInput.KEYS.START) replay();
    });

    return { destroy: cleanup };
  }

  /** 추적 가능한 setTimeout 묶음 */
  function createTimerBag() {
    var ids = [];
    return {
      later: function (fn, ms) {
        var id = setTimeout(function () {
          ids = ids.filter(function (x) {
            return x !== id;
          });
          fn();
        }, ms);
        ids.push(id);
        return id;
      },
      clear: function () {
        for (var i = 0; i < ids.length; i++) clearTimeout(ids[i]);
        ids = [];
      },
    };
  }

  function spawnPopup(parent, text, x, y, cls) {
    if (!parent) return;
    var el = document.createElement("div");
    el.className = "score-popup" + (cls ? " " + cls : "");
    el.textContent = text;
    el.style.left = (x != null ? x : 50) + "%";
    el.style.top = (y != null ? y : 40) + "%";
    parent.appendChild(el);
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 700);
  }

  global.PartyUI = {
    p2Label: p2Label,
    winnerTitle: winnerTitle,
    runCountdown: runCountdown,
    showResult: showResult,
    createTimerBag: createTimerBag,
    spawnPopup: spawnPopup,
  };
})(window);
