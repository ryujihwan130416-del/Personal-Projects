(function (root) {
  "use strict";
  var SR = root.SR = root.SR || {};
  var ctx = null;
  var muted = false;

  function ac() {
    if (muted) return null;
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, gain) {
    var c = ac();
    if (!c) return;
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = type || "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain || 0.08, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur);
  }

  function noise(dur, gain) {
    var c = ac();
    if (!c) return;
    var n = Math.floor(c.sampleRate * dur);
    var buf = c.createBuffer(1, n, c.sampleRate);
    var data = buf.getChannelData(0);
    var i;
    for (i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = c.createBufferSource();
    var g = c.createGain();
    var f = c.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1800;
    src.buffer = buf;
    g.gain.value = gain || 0.04;
    src.connect(f);
    f.connect(g);
    g.connect(c.destination);
    src.start();
  }

  SR.audio = {
    paper: function () { noise(0.07, 0.05); },
    stamp: function () { tone(120, 0.18, "sine", 0.12); tone(70, 0.22, "triangle", 0.06); },
    reject: function () { tone(90, 0.12, "square", 0.04); },
    unlock: function () { ac(); },
    setMuted: function (v) { muted = !!v; }
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
