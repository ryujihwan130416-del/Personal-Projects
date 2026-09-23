(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.SR = root.SR || {};
  root.SR.logic = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var OPTIONAL_KEYS = [
    "case01:f-stmt",
    "case02:f-order",
    "case03:f-lot",
    "case04:f-ghost2",
    "case05:f-empty"
  ];

  function uniq(ids) {
    if (!ids || !ids.length) return [];
    var out = [];
    var i;
    for (i = 0; i < ids.length; i++) {
      var id = String(ids[i]);
      if (out.indexOf(id) === -1) out.push(id);
    }
    return out;
  }

  function sameSet(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    var sa = a.slice().sort();
    var sb = b.slice().sort();
    var i;
    for (i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return false;
    return true;
  }

  function matches(finding, ids, type) {
    if (finding.type !== type) return false;
    if (sameSet(finding.docIds, ids)) return true;
    var alts = finding.alts || [];
    var i;
    for (i = 0; i < alts.length; i++) if (sameSet(alts[i], ids)) return true;
    if (finding.anyOf) {
      var min = finding.min || 2;
      if (ids.length < min) return false;
      var allow = finding.anyOf;
      for (i = 0; i < ids.length; i++) if (allow.indexOf(ids[i]) === -1) return false;
      return true;
    }
    return false;
  }

  function submitFinding(caseData, docIds, type) {
    var ids = uniq(docIds);
    var list = caseData.findings || [];
    var i;
    for (i = 0; i < list.length; i++) {
      if (matches(list[i], ids, type)) {
        return {
          ok: true,
          findingId: list[i].id,
          why: list[i].why,
          optional: !!list[i].optional
        };
      }
    }
    return { ok: false, reason: "mismatch" };
  }

  function submitReport(caseData, report) {
    var acc = caseData.accusation;
    if (!acc) return { ok: false, reason: "findings" };
    var findingIds = uniq(report.findingIds || []);
    if (report.personId !== acc.personId) return { ok: false, reason: "person" };
    if (report.crimeId !== acc.crimeId) return { ok: false, reason: "crime" };
    if (acc.entityId != null && report.entityId !== acc.entityId) {
      return { ok: false, reason: "entity" };
    }
    var need = acc.requiredFindingIds || [];
    var i;
    for (i = 0; i < need.length; i++) {
      if (findingIds.indexOf(need[i]) === -1) return { ok: false, reason: "findings" };
    }
    return { ok: true };
  }

  function endingChoices(finale, foundIds, flags) {
    var have = uniq(foundIds || []);
    var special = flags && flags.special;
    return (finale.endings || []).map(function (ending) {
      var requires = ending.requires || [];
      var missing = [];
      var i;
      for (i = 0; i < requires.length; i++) {
        if (have.indexOf(requires[i]) === -1) missing.push(requires[i]);
      }
      var enabled = missing.length === 0;
      if (ending.special && !special) enabled = false;
      return {
        id: ending.id,
        enabled: enabled,
        missing: missing,
        needSpecial: !!ending.special && !special
      };
    });
  }

  function specialReady(progress) {
    var i;
    for (i = 0; i < OPTIONAL_KEYS.length; i++) {
      var bits = OPTIONAL_KEYS[i].split(":");
      var row = progress && progress[bits[0]];
      if (!row || !row.found || row.found.indexOf(bits[1]) === -1) return false;
    }
    return true;
  }

  function findingType(caseData, findingId) {
    var list = caseData.findings || [];
    var i;
    for (i = 0; i < list.length; i++) if (list[i].id === findingId) return list[i].type;
    return findingId;
  }

  return {
    submitFinding: submitFinding,
    submitReport: submitReport,
    endingChoices: endingChoices,
    specialReady: specialReady,
    findingType: findingType,
    OPTIONAL_KEYS: OPTIONAL_KEYS,
    sameSet: sameSet
  };
});
