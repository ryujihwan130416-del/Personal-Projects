/* 키보드 입력: 홀드 반복 차단, P1/P2 매핑, 이동키 */
(function (global) {
  "use strict";

  var KEYS = {
    // 액션 (왼손 / 오른손)
    P1_MAIN: "KeyA",
    P1_ALT: "KeyS",
    P1_EXTRA: "KeyQ",
    P2_MAIN: "KeyL",
    P2_ALT: "KeyK",
    P2_EXTRA: "KeyO",
    // 피지컬 이동 — P1 WASD / P2 화살표
    P1_UP: "KeyW",
    P1_DOWN: "KeyS",
    P1_LEFT: "KeyA",
    P1_RIGHT: "KeyD",
    P2_UP: "ArrowUp",
    P2_DOWN: "ArrowDown",
    P2_LEFT: "ArrowLeft",
    P2_RIGHT: "ArrowRight",
    START: "Space",
    ESC: "Escape",
  };

  var ALL_GAME_CODES = [
    KEYS.P1_MAIN,
    KEYS.P1_ALT,
    KEYS.P1_EXTRA,
    KEYS.P2_MAIN,
    KEYS.P2_ALT,
    KEYS.P2_EXTRA,
    KEYS.P1_UP,
    KEYS.P1_DOWN,
    KEYS.P1_LEFT,
    KEYS.P1_RIGHT,
    KEYS.P2_UP,
    KEYS.P2_DOWN,
    KEYS.P2_LEFT,
    KEYS.P2_RIGHT,
    KEYS.START,
  ];

  function isP2Code(code) {
    return (
      code === KEYS.P2_MAIN ||
      code === KEYS.P2_ALT ||
      code === KEYS.P2_EXTRA ||
      code === KEYS.P2_UP ||
      code === KEYS.P2_DOWN ||
      code === KEYS.P2_LEFT ||
      code === KEYS.P2_RIGHT
    );
  }

  function createInput(options) {
    var opts = options || {};
    var ignoreP2 = !!opts.ignoreP2;
    var held = Object.create(null);
    var listeners = [];
    var active = true;

    function codeOf(e) {
      return e.code || e.key;
    }

    function onKeyDown(e) {
      if (!active) return;
      var code = codeOf(e);
      if (ALL_GAME_CODES.indexOf(code) !== -1) {
        e.preventDefault();
      }
      // 홀드 반복 무시 (첫 down만)
      if (held[code]) return;
      held[code] = true;

      if (ignoreP2 && isP2Code(code)) return;

      for (var i = 0; i < listeners.length; i++) {
        listeners[i]({ type: "down", code: code, event: e });
      }
    }

    function onKeyUp(e) {
      if (!active) return;
      var code = codeOf(e);
      held[code] = false;
      if (ignoreP2 && isP2Code(code)) return;
      for (var i = 0; i < listeners.length; i++) {
        listeners[i]({ type: "up", code: code, event: e });
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return {
      KEYS: KEYS,
      on: function (fn) {
        listeners.push(fn);
      },
      off: function (fn) {
        listeners = listeners.filter(function (f) {
          return f !== fn;
        });
      },
      isHeld: function (code) {
        return !!held[code];
      },
      /** 이동 벡터 {x,y} — P1 WASD / P2 화살표. 대각선은 정규화 */
      moveVector: function (who) {
        var x = 0;
        var y = 0;
        if (who === "p1") {
          if (held[KEYS.P1_LEFT]) x -= 1;
          if (held[KEYS.P1_RIGHT]) x += 1;
          if (held[KEYS.P1_UP]) y -= 1;
          if (held[KEYS.P1_DOWN]) y += 1;
        } else {
          if (ignoreP2) return { x: 0, y: 0 };
          if (held[KEYS.P2_LEFT]) x -= 1;
          if (held[KEYS.P2_RIGHT]) x += 1;
          if (held[KEYS.P2_UP]) y -= 1;
          if (held[KEYS.P2_DOWN]) y += 1;
        }
        if (x !== 0 && y !== 0) {
          var inv = 1 / Math.sqrt(2);
          x *= inv;
          y *= inv;
        }
        return { x: x, y: y };
      },
      setIgnoreP2: function (v) {
        ignoreP2 = !!v;
      },
      destroy: function () {
        active = false;
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        listeners = [];
        held = Object.create(null);
      },
    };
  }

  global.PartyInput = {
    KEYS: KEYS,
    create: createInput,
    isP2Code: isP2Code,
  };
})(window);
