"use strict";

var assert = require("assert");
var logic = require("./logic.js");
var cases = [
  require("./cases/case01.js"),
  require("./cases/case02.js"),
  require("./cases/case03.js"),
  require("./cases/case04.js"),
  require("./cases/case05.js"),
  require("./cases/case06.js")
];

function fail(res) {
  assert.strictEqual(res.ok, false, JSON.stringify(res));
}

cases.forEach(function (c) {
  c.findings.forEach(function (f) {
    var ok = logic.submitFinding(c, f.docIds.slice().reverse(), f.type);
    assert.strictEqual(ok.ok, true, c.id + " " + f.id);
    assert.strictEqual(ok.findingId, f.id);
    fail(logic.submitFinding(c, f.docIds.concat(["없는서류"]), f.type));
    if (f.anyOf) fail(logic.submitFinding(c, f.docIds.slice(0, 1), f.type));
    else if (f.docIds.length > 1) fail(logic.submitFinding(c, f.docIds.slice(1), f.type));
    else fail(logic.submitFinding(c, [], f.type));
    var other = f.type === "동선모순" ? "시각변조" : "동선모순";
    fail(logic.submitFinding(c, f.docIds, other));
    (f.alts || []).forEach(function (alt) {
      var altRes = logic.submitFinding(c, alt, f.type);
      assert.strictEqual(altRes.findingId, f.id, c.id + " alt " + f.id);
    });
  });

  if (!c.accusation) return;
  var acc = c.accusation;
  var good = {
    personId: acc.personId,
    crimeId: acc.crimeId,
    findingIds: acc.requiredFindingIds.slice(),
    entityId: acc.entityId
  };
  assert.strictEqual(logic.submitReport(c, good).ok, true, c.id + " report");
  assert.strictEqual(logic.submitReport(c, Object.assign({}, good, { personId: "없는사람" })).reason, "person");
  var wrongCrime = c.crimes.filter(function (x) { return x.id !== acc.crimeId; })[0].id;
  assert.strictEqual(logic.submitReport(c, Object.assign({}, good, { crimeId: wrongCrime })).reason, "crime");
  assert.strictEqual(
    logic.submitReport(c, Object.assign({}, good, { findingIds: acc.requiredFindingIds.slice(1) })).reason,
    "findings"
  );
});

var c1 = cases[0];
var c2 = cases[1];
fail(logic.submitFinding(c1, ["rest", "fish"], "동선모순"));
fail(logic.submitFinding(c1, ["stmt", "fish"], "동선모순"));
assert.strictEqual(logic.submitFinding(c1, ["stmt", "fish"], "허위인원").findingId, "f-stmt");
assert.strictEqual(logic.submitFinding(c1, ["gate", "fish"], "동선모순").findingId, "f-route");

fail(logic.submitFinding(c2, ["exp", "card"], "동선모순"));
assert.strictEqual(logic.submitFinding(c2, ["exp", "card"], "계정위장").findingId, "f-cat");
fail(logic.submitFinding(c2, ["exp", "tonerReal"], "계정위장"));

var card = c2.docs.filter(function (d) { return d.id === "card"; })[0];
var apex = 0;
card.fields.forEach(function (f) {
  if (f.value.indexOf("아펙스") === -1) return;
  var m = f.value.match(/[\d,]+원/);
  apex += Number(m[0].replace(/[,원]/g, ""));
});
assert.strictEqual(apex, 17600000);
assert.strictEqual(JSON.stringify(card.fields).indexOf("17,600,000"), -1);

var ins = c2.docs.filter(function (d) { return d.id === "ins"; })[0];
assert.strictEqual(JSON.stringify(ins.fields).indexOf("18,000,000"), -1);

var sign = cases[3].docs.filter(function (d) { return d.id === "sign"; })[0];
var signed = sign.fields.filter(function (f) { return /^\d+$/.test(f.label); });
assert.strictEqual(signed.length, 18);

var finale = cases[5];
assert.strictEqual(logic.submitFinding(finale, ["p4-reg", "flow"], "조직연결").findingId, "f-org");
fail(logic.submitFinding(finale, ["flow"], "조직연결"));
fail(logic.submitFinding(finale, ["p4-reg", "flow", "p1-fish"], "조직연결"));
assert.strictEqual(logic.submitFinding(finale, ["p1-fish", "flow"], "조직연결").findingId, "f-port");
assert.strictEqual(logic.submitFinding(finale, ["p2-exp", "p3-roof"], "결재연결").findingId, "f-sign");

function ids(list) {
  return list.filter(function (e) { return e.enabled; }).map(function (e) { return e.id; });
}

assert.deepStrictEqual(ids(logic.endingChoices(finale, ["f-sign"], { special: false })), ["narrow", "hold", "wrong-kim", "wrong-bae", "wrong-choi"]);
var mid = logic.endingChoices(finale, ["f-sign", "f-org"], { special: false });
assert.ok(ids(mid).indexOf("company") !== -1);
assert.ok(ids(mid).indexOf("full") === -1);
var wide = logic.endingChoices(finale, ["f-sign", "f-org", "f-port"], { special: false });
assert.ok(ids(wide).indexOf("full") !== -1);
assert.ok(ids(wide).indexOf("special") === -1);
var spec = logic.endingChoices(finale, ["f-sign", "f-org", "f-port"], { special: true });
assert.ok(ids(spec).indexOf("special") !== -1);

assert.strictEqual(logic.specialReady({}), false);
var progress = {};
logic.OPTIONAL_KEYS.forEach(function (key) {
  var bits = key.split(":");
  progress[bits[0]] = progress[bits[0]] || { found: [] };
  progress[bits[0]].found.push(bits[1]);
});
assert.strictEqual(logic.specialReady(progress), true);

console.log("logic.test.js ok");
