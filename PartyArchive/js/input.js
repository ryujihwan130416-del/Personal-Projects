/* 키보드 입력: 홀드 반복 차단, P1/P2 매핑 */
(function (global) {
  "use strict";

  var KEYS = {
    P1_MAIN: "KeyA",
    P1_ALT: "KeyS",
    P2_MAIN: "KeyL",
    P2_ALT: "KeyK",
    START: "Space",
    ESC: "Escape",
  };

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
      if (
        code === KEYS.P1_MAIN ||
        code === KEYS.P1_ALT ||
        code === KEYS.P2_MAIN ||
        code === KEYS.P2_ALT ||
        code === KEYS.START
      ) {
        e.preventDefault();
      }
      // 홀드 반복 무시
      if (held[code]) return;
      held[code] = true;

      if (ignoreP2 && (code === KEYS.P2_MAIN || code === KEYS.P2_ALT)) return;

      for (var i = 0; i < listeners.length; i++) {
        listeners[i]({ type: "down", code: code, event: e });
      }
    }

    function onKeyUp(e) {
      if (!active) return;
      var code = codeOf(e);
      held[code] = false;
      if (ignoreP2 && (code === KEYS.P2_MAIN || code === KEYS.P2_ALT)) return;
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
  };
})(window);
