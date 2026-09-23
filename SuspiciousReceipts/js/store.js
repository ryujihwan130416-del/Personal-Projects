(function (root) {
  "use strict";
  var SR = root.SR = root.SR || {};
  var KEY = "suspiciousReceipts.v1";
  var SLOTS = "suspiciousReceipts.slots.v1";
  var META = "suspiciousReceipts.achievements.v1";
  var ORDER = ["case01", "case02", "case03", "case04", "case05", "case06"];

  function blankProgress() {
    var progress = {};
    ORDER.forEach(function (id, i) {
      progress[id] = {
        status: i === 0 ? "new" : "locked",
        found: [],
        rejects: 0,
        wrongFindings: 0,
        notes: {}
      };
    });
    return progress;
  }

  function blank() {
    return {
      v: 2,
      mute: false,
      playMs: 0,
      introSeen: false,
      coachSeen: false,
      seen: [],
      scraps: [],
      memos: {},
      endingId: null,
      earned: [],
      updatedAt: null,
      place: { screen: "title", caseId: null },
      progress: blankProgress()
    };
  }

  function syncLocks(state) {
    var i;
    for (i = 1; i < ORDER.length; i++) {
      var prev = state.progress[ORDER[i - 1]];
      var cur = state.progress[ORDER[i]];
      if (!prev || !cur) continue;
      if (prev.status !== "closed") {
        if (cur.status !== "closed") cur.status = "locked";
      } else if (cur.status === "locked") {
        cur.status = "new";
      }
    }
    if (state.endingId && state.progress.case06) state.progress.case06.status = "closed";
  }

  function sanitize(raw) {
    var base = blank();
    if (!raw || raw.v !== 2 || !raw.progress) return base;
    base.mute = !!raw.mute;
    base.playMs = Number(raw.playMs) || 0;
    base.introSeen = !!raw.introSeen;
    base.coachSeen = !!raw.coachSeen;
    base.seen = Array.isArray(raw.seen) ? raw.seen.slice() : [];
    base.scraps = Array.isArray(raw.scraps) ? raw.scraps.slice() : [];
    base.memos = raw.memos || {};
    base.endingId = raw.endingId || null;
    base.earned = Array.isArray(raw.earned) ? raw.earned.slice() : [];
    base.updatedAt = raw.updatedAt || null;
    base.place = raw.place && raw.place.screen ? raw.place : base.place;
    ORDER.forEach(function (id) {
      var row = raw.progress[id] || {};
      base.progress[id] = {
        status: row.status || base.progress[id].status,
        found: Array.isArray(row.found) ? row.found.slice() : [],
        rejects: Number(row.rejects) || 0,
        wrongFindings: Number(row.wrongFindings) || 0,
        notes: row.notes || {}
      };
    });
    syncLocks(base);
    return base;
  }

  function load() {
    try {
      return sanitize(JSON.parse(localStorage.getItem(KEY) || "null"));
    } catch (e) {
      return blank();
    }
  }

  function save(state) {
    state.updatedAt = new Date().toISOString();
    syncLocks(state);
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function meta() {
    try {
      var m = JSON.parse(localStorage.getItem(META) || "{}");
      if (!m.earned) m.earned = {};
      return m;
    } catch (e) {
      return { earned: {} };
    }
  }

  function saveMeta(m) {
    localStorage.setItem(META, JSON.stringify(m));
  }

  function earn(state, id) {
    var m = meta();
    var fresh = !m.earned[id];
    if (fresh) m.earned[id] = new Date().toISOString();
    saveMeta(m);
    if (state.earned.indexOf(id) === -1) state.earned.push(id);
    return fresh;
  }

  function slots() {
    try {
      var list = JSON.parse(localStorage.getItem(SLOTS) || "null");
      if (!Array.isArray(list) || list.length !== 3) return [null, null, null];
      return list;
    } catch (e) {
      return [null, null, null];
    }
  }

  function writeSlots(list) {
    localStorage.setItem(SLOTS, JSON.stringify(list));
  }

  function saveSlot(index, state) {
    var list = slots();
    list[index] = {
      savedAt: new Date().toISOString(),
      playMs: state.playMs,
      endingId: state.endingId,
      caseId: state.place.caseId,
      label: slotLabel(state),
      state: JSON.parse(JSON.stringify(state))
    };
    writeSlots(list);
    return list[index];
  }

  function loadSlot(index) {
    var slot = slots()[index];
    if (!slot || !slot.state) return null;
    return sanitize(slot.state);
  }

  function clearSlot(index) {
    var list = slots();
    list[index] = null;
    writeSlots(list);
  }

  function slotLabel(state) {
    if (state.endingId) return "의견서 마감";
    var place = state.place || {};
    if (place.caseId && SR.caseById) {
      var c = SR.caseById(place.caseId);
      if (c) return c.title;
    }
    var open = ORDER.filter(function (id) {
      var st = state.progress[id].status;
      return st === "open" || st === "closed";
    });
    if (!open.length) return "조사 시작 전";
    return "진행 중";
  }

  function dirty(state) {
    if (state.endingId) return true;
    if (state.playMs > 4000) return true;
    return ORDER.some(function (id) {
      var p = state.progress[id];
      return p.status === "open" || p.status === "closed" || (p.found && p.found.length);
    });
  }

  function resetKeepMeta() {
    var next = blank();
    save(next);
    return next;
  }

  function clearAchievements() {
    saveMeta({ earned: {} });
  }

  SR.store = {
    KEY: KEY,
    ORDER: ORDER,
    blank: blank,
    load: load,
    save: save,
    syncLocks: syncLocks,
    sanitize: sanitize,
    meta: meta,
    earn: earn,
    slots: slots,
    saveSlot: saveSlot,
    loadSlot: loadSlot,
    clearSlot: clearSlot,
    dirty: dirty,
    resetKeepMeta: resetKeepMeta,
    clearAchievements: clearAchievements,
    slotLabel: slotLabel
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
