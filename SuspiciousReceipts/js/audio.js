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

  var bed = [];

  function bedStop() {
    bed.forEach(function (node) {
      try { node.stop(); } catch (e) { /* 이미 멈춘 음 */ }
      try { node.disconnect(); } catch (e2) { /* 연결 없음 */ }
    });
    bed = [];
  }

  function bedStart() {
    var c = ac();
    bedStop();
    if (!c) return;
    var drone = c.createOscillator();
    var droneGain = c.createGain();
    drone.type = "sine";
    drone.frequency.value = 55;
    droneGain.gain.setValueAtTime(0.0001, c.currentTime);
    droneGain.gain.exponentialRampToValueAtTime(0.02, c.currentTime + 1.1);
    drone.connect(droneGain);
    droneGain.connect(c.destination);
    drone.start();
    bed.push(drone);

    var fifth = c.createOscillator();
    var fifthGain = c.createGain();
    fifth.type = "triangle";
    fifth.frequency.value = 82;
    fifthGain.gain.setValueAtTime(0.0001, c.currentTime);
    fifthGain.gain.exponentialRampToValueAtTime(0.008, c.currentTime + 1.4);
    fifth.connect(fifthGain);
    fifthGain.connect(c.destination);
    fifth.start();
    bed.push(fifth);

    var dur = 1.4;
    var n = Math.floor(c.sampleRate * dur);
    var buf = c.createBuffer(1, n, c.sampleRate);
    var data = buf.getChannelData(0);
    var i;
    for (i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    var src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    var filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 380;
    var room = c.createGain();
    room.gain.value = 0.012;
    src.connect(filter);
    filter.connect(room);
    room.connect(c.destination);
    src.start();
    bed.push(src);
  }

  SR.audio = {
    paper: function () { noise(0.07, 0.05); },
    stamp: function () { tone(120, 0.18, "sine", 0.12); tone(70, 0.22, "triangle", 0.06); },
    reject: function () { tone(90, 0.12, "square", 0.04); },
    unlock: function () { ac(); },
    bedStart: bedStart,
    bedStop: bedStop,
    cue: function (name) {
      if (name === "paper") this.paper();
      else if (name === "stamp") this.stamp();
      else if (name === "tick") tone(720, 0.045, "square", 0.025);
      else if (name === "low") tone(98, 0.4, "sine", 0.045);
      else if (name === "reject") this.reject();
    },
    setMuted: function (v) {
      muted = !!v;
      if (muted) bedStop();
    }
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
