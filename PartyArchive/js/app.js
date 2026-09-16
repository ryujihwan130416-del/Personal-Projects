/* 파티 아카이브 — 로비, 라우팅, 점수, 사운드 */
(function (global) {
  "use strict";

  var SCORE_KEY = "partyArchive.scores.v1";
  var MUTE_KEY = "partyArchive.muted";

  var GAMES = [
    {
      id: "tug",
      name: "줄다리기",
      rule: "주행동 키를 더 많이 연타해 깃발을 내 쪽으로!",
      time: "약 20초",
      keys: "P1 A · P2 L",
      factory: function () {
        return GameTug.create();
      },
    },
    {
      id: "draw",
      name: "눈치 대결",
      rule: "「지금!」이 뜨면 누구보다 빨리. 가짜 신호는 함정!",
      time: "3판 2선승",
      keys: "P1 A · P2 L",
      factory: function () {
        return GameDraw.create();
      },
    },
    {
      id: "potato",
      name: "폭탄 돌리기",
      rule: "폭탄을 상대에게 던져라. 터질 때 들고 있으면 패배.",
      time: "15~30초",
      keys: "P1 A · P2 L",
      factory: function () {
        return GamePotato.create();
      },
    },
    {
      id: "stopbar",
      name: "타이밍 스톱",
      rule: "목표 존에서 게이지를 멈춰 고득점! 3라운드 합산.",
      time: "3라운드",
      keys: "P1 A · P2 L",
      factory: function () {
        return GameStopbar.create();
      },
    },
    {
      id: "moles",
      name: "두더지 쟁탈",
      rule: "자기 열 두더지를 잡고, 가운데는 선착순 쟁탈!",
      time: "약 25초",
      keys: "P1 A · P2 L",
      factory: function () {
        return GameMoles.create();
      },
    },
  ];

  var state = {
    mode: "pvp",
    difficulty: "normal",
    scores: { p1: 0, p2: 0 },
    muted: false,
    currentGame: null,
    currentId: null,
    scoreApplied: false,
    audioCtx: null,
  };

  var els = {};

  function loadScores() {
    try {
      var raw = localStorage.getItem(SCORE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        state.scores.p1 = parsed.p1 | 0;
        state.scores.p2 = parsed.p2 | 0;
      }
    } catch (e) {}
  }

  function saveScores() {
    try {
      localStorage.setItem(
        SCORE_KEY,
        JSON.stringify({ p1: state.scores.p1, p2: state.scores.p2 })
      );
    } catch (e) {}
  }

  function loadMute() {
    try {
      state.muted = localStorage.getItem(MUTE_KEY) === "1";
    } catch (e) {}
  }

  function saveMute() {
    try {
      localStorage.setItem(MUTE_KEY, state.muted ? "1" : "0");
    } catch (e) {}
  }

  function ensureAudio() {
    if (!state.audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) state.audioCtx = new AC();
    }
    if (state.audioCtx && state.audioCtx.state === "suspended") {
      state.audioCtx.resume();
    }
    return state.audioCtx;
  }

  function sfx(kind) {
    if (state.muted) return;
    var ctx = ensureAudio();
    if (!ctx) return;
    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    var freq = 440;
    var dur = 0.08;
    var type = "square";
    if (kind === "cd") {
      freq = 330;
      dur = 0.1;
    } else if (kind === "go") {
      freq = 660;
      dur = 0.12;
      type = "triangle";
    } else if (kind === "fake") {
      freq = 220;
      dur = 0.15;
      type = "sawtooth";
    } else if (kind === "tap") {
      freq = 520;
      dur = 0.05;
    } else if (kind === "miss") {
      freq = 160;
      dur = 0.12;
      type = "sawtooth";
    } else if (kind === "boom") {
      freq = 80;
      dur = 0.35;
      type = "sawtooth";
    } else if (kind === "win") {
      freq = 523;
      dur = 0.2;
      type = "triangle";
    } else if (kind === "draw") {
      freq = 300;
      dur = 0.18;
    }

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (kind === "win") {
      osc.frequency.linearRampToValueAtTime(784, now + 0.15);
    }
    if (kind === "boom") {
      osc.frequency.exponentialRampToValueAtTime(40, now + dur);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  function p2Label() {
    return state.mode === "ai" ? "AI" : "P2";
  }

  function refreshLobby() {
    document.getElementById("score-p1").textContent = String(state.scores.p1);
    document.getElementById("score-p2").textContent = String(state.scores.p2);
    document.getElementById("score-p2-label").textContent = p2Label();

    var diffPanel = document.getElementById("difficulty-panel");
    if (state.mode === "ai") diffPanel.classList.remove("disabled");
    else diffPanel.classList.add("disabled");

    document.querySelectorAll("[data-mode]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-mode") === state.mode ? "true" : "false");
    });
    document.querySelectorAll("[data-diff]").forEach(function (btn) {
      btn.setAttribute(
        "aria-pressed",
        btn.getAttribute("data-diff") === state.difficulty ? "true" : "false"
      );
    });

    var muteBtn = document.getElementById("btn-mute");
    muteBtn.textContent = state.muted ? "소리 OFF" : "소리 ON";
    muteBtn.setAttribute("aria-pressed", state.muted ? "true" : "false");
  }

  function renderGameCards() {
    var grid = document.getElementById("game-grid");
    grid.innerHTML = "";
    GAMES.forEach(function (g) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "game-card";
      btn.setAttribute("role", "listitem");
      btn.setAttribute("data-game", g.id);
      btn.innerHTML =
        "<h3>" +
        g.name +
        "</h3>" +
        '<p class="rule">' +
        g.rule +
        "</p>" +
        '<div class="meta">' +
        '<span class="meta-chip">' +
        g.time +
        "</span>" +
        '<span class="meta-chip keys">' +
        g.keys +
        "</span>" +
        "</div>";
      btn.addEventListener("click", function () {
        ensureAudio();
        showPrep(g);
      });
      grid.appendChild(btn);
    });
  }

  function destroyCurrent() {
    if (state.currentGame && state.currentGame.destroy) {
      try {
        state.currentGame.destroy();
      } catch (e) {}
    }
    state.currentGame = null;
    state.currentId = null;
    els.gameRoot.innerHTML = "";
  }

  function showLobby() {
    destroyCurrent();
    els.lobby.classList.remove("hidden");
    els.gameScreen.classList.add("hidden");
    refreshLobby();
  }

  function applyWinner(winner) {
    if (state.scoreApplied) return;
    if (winner === "p1" || winner === "p2") {
      state.scores[winner]++;
      saveScores();
      state.scoreApplied = true;
      refreshLobby();
    }
  }

  function launchGame(gameMeta) {
    destroyCurrent();
    state.scoreApplied = false;
    els.lobby.classList.add("hidden");
    els.gameScreen.classList.remove("hidden");

    var game = gameMeta.factory();
    state.currentGame = game;
    state.currentId = gameMeta.id;

    game.init(els.gameRoot, {
      mode: state.mode,
      difficulty: state.difficulty,
      onFinish: function (result) {
        if (!result) return;
        if (result.pending) {
          applyWinner(result.winner);
          return;
        }
        applyWinner(result.winner);
        if (result.replay) {
          launchGame(gameMeta);
        } else {
          showLobby();
        }
      },
    });
    game.start();
  }

  function showPrep(gameMeta) {
    destroyCurrent();
    els.lobby.classList.add("hidden");
    els.gameScreen.classList.remove("hidden");
    state.currentId = gameMeta.id;

    els.gameRoot.innerHTML =
      '<div class="prep-panel">' +
      "<h2>" +
      gameMeta.name +
      "</h2>" +
      "<p>" +
      gameMeta.rule +
      "</p>" +
      '<div class="key-guide">' +
      '<div class="side p1">P1 · 주행동 <kbd>A</kbd></div>' +
      '<div class="side p2">' +
      p2Label() +
      " · 주행동 <kbd>L</kbd></div>" +
      "</div>" +
      "<p style=\"font-weight:800;opacity:.8\">예상 " +
      gameMeta.time +
      " · 모드: " +
      (state.mode === "ai" ? "사람 vs AI (" + (PartyAI.PROFILES[state.difficulty].label) + ")" : "사람 vs 사람") +
      "</p>" +
      '<div class="result-actions">' +
      '<button type="button" class="btn btn-primary" id="prep-start">Space 로 시작</button>' +
      '<button type="button" class="btn" id="prep-back">로비</button>' +
      "</div>" +
      "</div>";

    var started = false;
    function go() {
      if (started) return;
      started = true;
      if (prepInput) prepInput.destroy();
      launchGame(gameMeta);
    }

    document.getElementById("prep-start").onclick = go;
    document.getElementById("prep-back").onclick = function () {
      if (prepInput) prepInput.destroy();
      showLobby();
    };

    var prepInput = PartyInput.create({ ignoreP2: true });
    prepInput.on(function (msg) {
      if (msg.type === "down" && msg.code === PartyInput.KEYS.START) go();
    });
    // Esc는 전역 핸들러
    state.currentGame = {
      destroy: function () {
        if (prepInput) prepInput.destroy();
      },
    };
  }

  function onGlobalKey(e) {
    if (e.code === "Escape") {
      e.preventDefault();
      // 진행 중 나가면 점수 없음 (apply 전에 destroy)
      if (!els.gameScreen.classList.contains("hidden")) {
        // 이미 결과가 떠서 점수가 반영됐으면 유지
        showLobby();
      }
    }
  }

  function bindLobby() {
    document.querySelectorAll("[data-mode]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.mode = btn.getAttribute("data-mode");
        refreshLobby();
        sfx("tap");
      });
    });
    document.querySelectorAll("[data-diff]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.difficulty = btn.getAttribute("data-diff");
        refreshLobby();
        sfx("tap");
      });
    });
    document.getElementById("btn-reset-score").addEventListener("click", function () {
      state.scores = { p1: 0, p2: 0 };
      saveScores();
      refreshLobby();
      sfx("miss");
    });
    document.getElementById("btn-mute").addEventListener("click", function () {
      state.muted = !state.muted;
      saveMute();
      refreshLobby();
      if (!state.muted) {
        ensureAudio();
        sfx("tap");
      }
    });
  }

  function init() {
    els.lobby = document.getElementById("lobby");
    els.gameScreen = document.getElementById("game-screen");
    els.gameRoot = document.getElementById("game-root");

    loadScores();
    loadMute();
    renderGameCards();
    bindLobby();
    refreshLobby();
    window.addEventListener("keydown", onGlobalKey);
  }

  global.PartyApp = {
    sfx: sfx,
    getState: function () {
      return state;
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);
