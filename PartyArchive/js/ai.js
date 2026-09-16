/* 공통 AI: 난이도 프로파일 + 콜백 기반 행동 */
(function (global) {
  "use strict";

  var PROFILES = {
    easy: {
      label: "쉬움",
      reactMin: 220,
      reactMax: 420,
      mistakeRate: 0.35,
      timingError: 0.22,
      mashMin: 180,
      mashMax: 320,
    },
    normal: {
      label: "보통",
      reactMin: 140,
      reactMax: 260,
      mistakeRate: 0.18,
      timingError: 0.12,
      mashMin: 110,
      mashMax: 200,
    },
    hard: {
      label: "어려움",
      reactMin: 70,
      reactMax: 140,
      mistakeRate: 0.07,
      timingError: 0.05,
      mashMin: 70,
      mashMax: 120,
    },
  };

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pickProfile(difficulty) {
    return PROFILES[difficulty] || PROFILES.normal;
  }

  /**
   * shouldAct(now) → true면 행동 시도
   * onAct() → 실제 키 입력 시뮬레이션
   * options.canMistake — 실수 허용 여부 (기본 true)
   */
  function createActor(difficulty, shouldAct, onAct, options) {
    var profile = pickProfile(difficulty);
    var opts = options || {};
    var canMistake = opts.canMistake !== false;
    var pendingAt = null;
    var lastAct = 0;
    var alive = true;
    var raf = 0;

    function tick(now) {
      if (!alive) return;
      raf = requestAnimationFrame(tick);

      if (pendingAt !== null) {
        if (now >= pendingAt) {
          pendingAt = null;
          lastAct = now;
          onAct();
        }
        return;
      }

      var want = false;
      try {
        want = !!shouldAct(now);
      } catch (err) {
        want = false;
      }
      if (!want) return;

      // 너무 자주 누르지 않도록 최소 간격
      var gap = opts.minGap != null ? opts.minGap : 40;
      if (now - lastAct < gap) return;

      if (canMistake && Math.random() < profile.mistakeRate * (opts.mistakeScale || 1)) {
        // 실수: 가끔 그냥 스킵하거나 지연만 늘림
        if (Math.random() < 0.55) return;
      }

      var delay = rand(profile.reactMin, profile.reactMax);
      if (opts.extraDelay) delay += opts.extraDelay(now) || 0;
      pendingAt = now + delay;
    }

    raf = requestAnimationFrame(tick);

    return {
      profile: profile,
      destroy: function () {
        alive = false;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        pendingAt = null;
      },
      // 즉시 예약 취소 (라운드 전환 등)
      cancelPending: function () {
        pendingAt = null;
      },
    };
  }

  /** 연타형: 난이도별 주기로 onAct 호출 */
  function createMasher(difficulty, onAct, options) {
    var profile = pickProfile(difficulty);
    var opts = options || {};
    var nextAt = 0;
    var alive = true;
    var raf = 0;
    var enabled = true;

    function tick(now) {
      if (!alive) return;
      raf = requestAnimationFrame(tick);
      if (!enabled) return;
      if (now < nextAt) return;

      if (Math.random() < profile.mistakeRate * 0.4) {
        // 가끔 한 박자 쉼
        nextAt = now + rand(profile.mashMin, profile.mashMax) * 1.6;
        return;
      }
      onAct();
      nextAt = now + rand(profile.mashMin, profile.mashMax);
      if (opts.paceScale) {
        nextAt = now + rand(profile.mashMin, profile.mashMax) * opts.paceScale();
      }
    }

    raf = requestAnimationFrame(tick);

    return {
      profile: profile,
      setEnabled: function (v) {
        enabled = !!v;
      },
      destroy: function () {
        alive = false;
        if (raf) cancelAnimationFrame(raf);
      },
    };
  }

  function reactionDelay(difficulty) {
    var p = pickProfile(difficulty);
    return rand(p.reactMin, p.reactMax);
  }

  function timingOffset(difficulty, zoneHalf) {
    var p = pickProfile(difficulty);
    // 가끔 거의 완벽
    if (p.mistakeRate < 0.1 && Math.random() < 0.25) {
      return (Math.random() - 0.5) * zoneHalf * 0.08;
    }
    return (Math.random() - 0.5) * 2 * zoneHalf * p.timingError * 3;
  }

  function shouldFalseStart(difficulty) {
    return Math.random() < pickProfile(difficulty).mistakeRate;
  }

  global.PartyAI = {
    PROFILES: PROFILES,
    pickProfile: pickProfile,
    createActor: createActor,
    createMasher: createMasher,
    reactionDelay: reactionDelay,
    timingOffset: timingOffset,
    shouldFalseStart: shouldFalseStart,
    rand: rand,
  };
})(window);
