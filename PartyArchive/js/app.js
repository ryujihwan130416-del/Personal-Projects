/* 파티 아카이브 — 로비, 라우팅, 점수, 사운드, 메타 루프 */
(function (global) {
  "use strict";

  var SCORE_KEY = "partyArchive.scores.v1";
  var MUTE_KEY = "partyArchive.muted";
  var PREFS_KEY = "partyArchive.prefs.v1";

  var GAMES = [
    {
      id: "tug",
      name: "줄다리기",
      rule: "A/L로 끌고, S/K로 버티며 깃발을 내 쪽으로!",
      time: "약 20초",
      keys: "P1 A/S · P2 L/K",
      usesAlt: true,
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
      rule: "폭탄을 던져라. 위기엔 보조키로 슬램! 터질 때 들고 있으면 패배.",
      time: "15~30초",
      keys: "P1 A/S · P2 L/K",
      usesAlt: true,
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
      rule: "보조키로 열을 고르고 주키로 타격! 가운데는 쟁탈.",
      time: "약 25초",
      keys: "P1 A/S · P2 L/K",
      usesAlt: true,
      factory: function () {
        return GameMoles.create();
      },
    },
    {
      id: "balloon",
      name: "풍선 펌프",
      rule: "부풀리다 랜덤 지점에서 펑! 조심 펌프(Q/O)로 위험을 줄여라.",
      time: "약 22초",
      keys: "P1 A/Q · P2 L/O",
      usesExtra: true,
      factory: function () {
        return GameBalloon.create();
      },
    },
    {
      id: "color",
      name: "색 신호",
      rule: "내 색·노랑만! 회색은 금지. Q/O는 「패스」(금지 라운드 전용).",
      time: "3판 2선승",
      keys: "P1 A/Q · P2 L/O",
      usesExtra: true,
      factory: function () {
        return GameColor.create();
      },
    },
    {
      id: "rhythm",
      name: "비트 탭",
      rule: "박자에 맞춰 탭! 빗나가면 감점, 합산 점수 승.",
      time: "약 20초",
      keys: "P1 A · P2 L",
      factory: function () {
        return GameRhythm.create();
      },
    },
    {
      id: "ladder",
      name: "사다리 오르기",
      rule: "주키·보조키를 번갈아 눌러 더 높이 올라가라!",
      time: "약 18초",
      keys: "P1 A/S · P2 L/K",
      usesAlt: true,
      factory: function () {
        return GameLadder.create();
      },
    },
    {
      id: "arena",
      name: "링 아웃",
      rule: "WASD vs 화살표로 밀고 밀어 링 밖으로! 2라이프.",
      time: "약 30초",
      keys: "P1 WASD · P2 ↑←↓→",
      usesMove: true,
      factory: function () {
        return GameArena.create();
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
    lastPlayed: null,
    tournament: null,
    mashPitch: 0,
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

  function loadPrefs() {
    try {
      var raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return;
      var p = JSON.parse(raw);
      if (p.mode === "pvp" || p.mode === "ai") state.mode = p.mode;
      if (p.difficulty === "easy" || p.difficulty === "normal" || p.difficulty === "hard") {
        state.difficulty = p.difficulty;
      }
      if (typeof p.lastPlayed === "string") state.lastPlayed = p.lastPlayed;
    } catch (e) {}
  }

  function savePrefs() {
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({
          mode: state.mode,
          difficulty: state.difficulty,
          lastPlayed: state.lastPlayed,
        })
      );
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

  function beep(freq, dur, type, vol, slideTo) {
    var ctx = ensureAudio();
    if (!ctx || state.muted) return;
    var now = ctx.currentTime;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo != null) {
      try {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + dur);
      } catch (e) {
        osc.frequency.linearRampToValueAtTime(slideTo, now + dur);
      }
    }
    var v = vol != null ? vol : 0.12;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(v, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  function sfx(kind, opts) {
    if (state.muted) return;
    opts = opts || {};
    if (kind === "cd") beep(330, 0.1, "square", 0.11);
    else if (kind === "go") beep(660, 0.14, "triangle", 0.13);
    else if (kind === "fake") beep(220, 0.16, "sawtooth", 0.1);
    else if (kind === "tap") {
      var base = opts.pitch != null ? opts.pitch : 520;
      beep(base, 0.05, "square", 0.1);
    } else if (kind === "mash") {
      state.mashPitch = Math.min(18, state.mashPitch + 1);
      beep(420 + state.mashPitch * 18, 0.045, "square", 0.09);
    } else if (kind === "mashReset") {
      state.mashPitch = 0;
    } else if (kind === "miss") beep(160, 0.14, "sawtooth", 0.1);
    else if (kind === "thud") beep(90, 0.18, "triangle", 0.14, 50);
    else if (kind === "pop") beep(780, 0.08, "triangle", 0.12);
    else if (kind === "tick") beep(900, 0.03, "square", 0.06);
    else if (kind === "hiss") beep(180, 0.08, "sawtooth", 0.05, 120);
    else if (kind === "boom") beep(80, 0.4, "sawtooth", 0.18, 35);
    else if (kind === "score") {
      var sc = opts.score != null ? opts.score : 50;
      beep(280 + sc * 4, 0.1, "triangle", 0.12);
    } else if (kind === "win") {
      beep(523, 0.12, "triangle", 0.12);
      setTimeout(function () {
        if (!state.muted) beep(784, 0.18, "triangle", 0.12);
      }, 90);
    } else if (kind === "draw") beep(300, 0.18, "square", 0.1);
    else if (kind === "signal") beep(540, 0.12, "triangle", 0.12);
    else beep(440, 0.08, "square", 0.1);
  }

  function findGame(id) {
    for (var i = 0; i < GAMES.length; i++) {
      if (GAMES[i].id === id) return GAMES[i];
    }
    return null;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0;
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
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

    document.querySelectorAll(".game-card").forEach(function (card) {
      var id = card.getAttribute("data-game");
      card.classList.toggle("recent", id && id === state.lastPlayed);
    });
  }

  function renderGameCards() {
    var grid = document.getElementById("game-grid");
    grid.innerHTML = "";

    // 메타 진입: 랜덤 / 토너먼트
    var meta = [
      {
        id: "_random",
        name: "랜덤 한 판",
        rule: "전체 미니게임 중 무작위로 한 판!",
        time: "즉시",
        keys: "운에 맡기기",
        special: "random",
      },
      {
        id: "_tournament",
        name: "파티 토너먼트",
        rule: "전 게임을 섞어 연속 플레이. 최종 승수를 겨룬다!",
        time: GAMES.length + "연속",
        keys: "Esc=중단",
        special: "tournament",
      },
    ];

    meta.forEach(function (g) {
      grid.appendChild(makeCard(g, true));
    });

    GAMES.forEach(function (g) {
      grid.appendChild(makeCard(g, false));
    });
  }

  function makeCard(g, isMeta) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "game-card" + (isMeta ? " meta-card" : "");
    if (!isMeta && g.id === state.lastPlayed) btn.className += " recent";
    btn.setAttribute("role", "listitem");
    btn.setAttribute("data-game", g.id);
    var recentBadge =
      !isMeta && g.id === state.lastPlayed
        ? '<span class="recent-badge">최근</span>'
        : "";
    btn.innerHTML =
      recentBadge +
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
      if (g.special === "random") startRandom();
      else if (g.special === "tournament") startTournament();
      else {
        clearTournament(false);
        showPrep(g);
      }
    });
    return btn;
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

  function clearTournament(keepScores) {
    state.tournament = null;
    if (!keepScores) {
      /* tournament mid-quit: no score already applied per Esc rule */
    }
  }

  function showLobby() {
    // Esc mid-match: abandon tournament without applying unfinished game score
    // (finished games already applied via pending)
    if (state.tournament && !state.scoreApplied) {
      // leaving mid-game: discard only current unfinished match; tournament scores already in session stay
    }
    destroyCurrent();
    state.tournament = null;
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

  function afterMatchChoice(gameMeta, result) {
    if (state.tournament) {
      // tournament: ignore replay/lobby buttons — auto advance
      advanceTournament(result);
      return;
    }
    if (result.replay) launchGame(gameMeta);
    else showLobby();
  }

  function launchGame(gameMeta) {
    destroyCurrent();
    state.scoreApplied = false;
    state.mashPitch = 0;
    state.lastPlayed = gameMeta.id;
    savePrefs();
    els.lobby.classList.add("hidden");
    els.gameScreen.classList.remove("hidden");

    var game = gameMeta.factory();
    state.currentGame = game;
    state.currentId = gameMeta.id;

    game.init(els.gameRoot, {
      mode: state.mode,
      difficulty: state.difficulty,
      tournament: !!state.tournament,
      onFinish: function (result) {
        if (!result) return;
        if (result.pending) {
          applyWinner(result.winner);
          return;
        }
        applyWinner(result.winner);
        afterMatchChoice(gameMeta, result);
      },
    });
    game.start();
  }

  function showPrep(gameMeta, tournamentInfo) {
    destroyCurrent();
    els.lobby.classList.add("hidden");
    els.gameScreen.classList.remove("hidden");
    state.currentId = gameMeta.id;

    var tourLine = "";
    if (tournamentInfo) {
      tourLine =
        '<p class="prep-tour">토너먼트 ' +
        tournamentInfo.index +
        " / " +
        tournamentInfo.total +
        " · 현재 승수 P1 " +
        state.scores.p1 +
        " : " +
        p2Label() +
        " " +
        state.scores.p2 +
        "</p>";
    }

    var keyP1;
    var keyP2;
    if (gameMeta.usesMove) {
      keyP1 = "P1 · 이동 <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>";
      keyP2 = p2Label() + " · 이동 <kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd>";
    } else {
      keyP1 =
        "P1 · 주행동 <kbd>A</kbd>" +
        (gameMeta.usesAlt ? " · 보조 <kbd>S</kbd>" : "") +
        (gameMeta.usesExtra ? " · 특수 <kbd>Q</kbd>" : "");
      keyP2 =
        p2Label() +
        " · 주행동 <kbd>L</kbd>" +
        (gameMeta.usesAlt ? " · 보조 <kbd>K</kbd>" : "") +
        (gameMeta.usesExtra ? " · 특수 <kbd>O</kbd>" : "");
    }

    els.gameRoot.innerHTML =
      '<div class="prep-panel">' +
      "<h2>" +
      gameMeta.name +
      "</h2>" +
      "<p>" +
      gameMeta.rule +
      "</p>" +
      tourLine +
      '<div class="key-guide">' +
      '<div class="side p1">' +
      keyP1 +
      "</div>" +
      '<div class="side p2">' +
      keyP2 +
      "</div>" +
      "</div>" +
      '<p style="font-weight:800;opacity:.8">예상 ' +
      gameMeta.time +
      " · 모드: " +
      (state.mode === "ai"
        ? "사람 vs AI (" + PartyAI.PROFILES[state.difficulty].label + ")"
        : "사람 vs 사람") +
      "</p>" +
      '<div class="result-actions">' +
      '<button type="button" class="btn btn-primary" id="prep-start">Space 로 시작</button>' +
      '<button type="button" class="btn" id="prep-back">' +
      (state.tournament ? "토너먼트 포기" : "로비") +
      "</button>" +
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
    state.currentGame = {
      destroy: function () {
        if (prepInput) prepInput.destroy();
      },
    };
  }

  function startRandom() {
    clearTournament(false);
    var g = GAMES[(Math.random() * GAMES.length) | 0];
    showPrep(g);
  }

  function startTournament() {
    var order = shuffle(GAMES.map(function (g) {
      return g.id;
    }));
    state.tournament = {
      order: order,
      index: 0,
    };
    var first = findGame(order[0]);
    showPrep(first, { index: 1, total: order.length });
  }

  function advanceTournament(result) {
    if (!state.tournament) {
      showLobby();
      return;
    }
    state.tournament.index++;
    if (state.tournament.index >= state.tournament.order.length) {
      // final summary
      showTournamentFinale();
      return;
    }
    var next = findGame(state.tournament.order[state.tournament.index]);
    showPrep(next, {
      index: state.tournament.index + 1,
      total: state.tournament.order.length,
    });
  }

  function showTournamentFinale() {
    destroyCurrent();
    els.lobby.classList.add("hidden");
    els.gameScreen.classList.remove("hidden");
    var winner = "draw";
    if (state.scores.p1 > state.scores.p2) winner = "p1";
    else if (state.scores.p2 > state.scores.p1) winner = "p2";
    var title =
      winner === "draw"
        ? "토너먼트 무승부!"
        : winner === "p1"
          ? "토너먼트 우승: P1!"
          : "토너먼트 우승: " + p2Label() + "!";

    els.gameRoot.innerHTML =
      '<div class="prep-panel finale">' +
      "<h2>" +
      title +
      "</h2>" +
      "<p>최종 승수 " +
      state.scores.p1 +
      " : " +
      state.scores.p2 +
      "</p>" +
      '<div class="result-actions">' +
      '<button type="button" class="btn btn-primary" id="fin-again">토너먼트 다시</button>' +
      '<button type="button" class="btn" id="fin-lobby">로비</button>' +
      "</div>" +
      "</div>";

    state.tournament = null;
    sfx(winner === "draw" ? "draw" : "win");

    var finInput = PartyInput.create({ ignoreP2: true });
    function again() {
      finInput.destroy();
      startTournament();
    }
    document.getElementById("fin-again").onclick = again;
    document.getElementById("fin-lobby").onclick = function () {
      finInput.destroy();
      showLobby();
    };
    finInput.on(function (msg) {
      if (msg.type === "down" && msg.code === PartyInput.KEYS.START) again();
    });
    state.currentGame = {
      destroy: function () {
        finInput.destroy();
      },
    };
  }

  function onGlobalKey(e) {
    if (e.code === "Escape") {
      e.preventDefault();
      if (!els.gameScreen.classList.contains("hidden")) {
        // Esc: abandon current (and tournament). Finished pending scores already applied.
        showLobby();
      }
    }
  }

  function bindLobby() {
    document.querySelectorAll("[data-mode]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.mode = btn.getAttribute("data-mode");
        savePrefs();
        refreshLobby();
        sfx("tap");
      });
    });
    document.querySelectorAll("[data-diff]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.difficulty = btn.getAttribute("data-diff");
        savePrefs();
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

    var legendToggle = document.getElementById("legend-toggle");
    var legendBody = document.getElementById("legend-body");
    if (legendToggle && legendBody) {
      legendToggle.addEventListener("click", function () {
        var open = legendBody.classList.toggle("open");
        legendToggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }
  }

  function init() {
    els.lobby = document.getElementById("lobby");
    els.gameScreen = document.getElementById("game-screen");
    els.gameRoot = document.getElementById("game-root");

    loadScores();
    loadMute();
    loadPrefs();
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
    GAMES: GAMES,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);
