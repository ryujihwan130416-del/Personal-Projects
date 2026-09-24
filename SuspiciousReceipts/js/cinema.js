(function (root) {
  "use strict";
  var SR = root.SR = root.SR || {};
  var NS = "http://www.w3.org/2000/svg";
  var names18 = [
    "윤가람", "김하늘", "배수아", "오태경", "남민준", "백서연",
    "정도현", "문하린", "서재원", "유가은", "장우석", "한소율",
    "표지훈", "노은별", "심태양", "배준호", "곽미래", "천시우"
  ];

  function el(tag, attrs, kids) {
    var n = document.createElementNS(NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (attrs[k] == null) return;
        n.setAttribute(k, String(attrs[k]));
      });
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  function tx(x, y, text, attrs) {
    var a = attrs || {};
    a.x = x;
    a.y = y;
    var n = el("text", a);
    n.textContent = text;
    return n;
  }

  function svg(salt, kids) {
    return el("svg", { viewBox: "0 0 960 540", role: "img" }, [defs(salt)].concat(kids));
  }

  function defs(salt) {
    return el("defs", {}, [
      grad(salt + "-night", ["#101820", "#2a1b12"]),
      grad(salt + "-dawn", ["#1c140f", "#8a5a3c"]),
      grad(salt + "-paper", ["#f7f1e4", "#e5d3b2"]),
      grad(salt + "-sea", ["#163844", "#0e242c"]),
      grad(salt + "-cork", ["#8d5b3a", "#6b4128"]),
      el("filter", { id: salt + "-shadow", x: "-30%", y: "-30%", width: "160%", height: "160%" }, [
        el("feDropShadow", { dx: "0", dy: "12", stdDeviation: "8", "flood-color": "#000", "flood-opacity": "0.38" })
      ])
    ]);
  }

  function grad(id, colors) {
    return el("linearGradient", { id: id, x1: "0", y1: "0", x2: "0", y2: "1" }, [
      el("stop", { offset: "0%", "stop-color": colors[0] }),
      el("stop", { offset: "100%", "stop-color": colors[1] })
    ]);
  }

  function paper(salt, x, y, w, h) {
    return el("g", { filter: "url(#" + salt + "-shadow)" }, [
      el("rect", { x: x, y: y, width: w, height: h, rx: "2", fill: "url(#" + salt + "-paper)" }),
      el("rect", { x: x, y: y, width: w, height: "8", fill: "#8f1d1d" })
    ]);
  }

  function seal(x, y, word, delay, cls) {
    var g = el("g", { class: cls || "anim-slam", style: delay ? "animation-delay:" + delay + "s" : null }, [
      el("circle", { cx: x, cy: y, r: "46", fill: "none", stroke: "#8f1d1d", "stroke-width": "4" }),
      el("circle", { cx: x, cy: y, r: "38", fill: "none", stroke: "#8f1d1d", "stroke-width": "1.5" }),
      tx(x, y + 6, word, { "text-anchor": "middle", fill: "#8f1d1d", "font-size": "18", "font-weight": "800" })
    ]);
    return g;
  }

  function sealOnPaper(x, y, word) {
    return el("g", { transform: "translate(" + x + " " + y + ")" }, [
      el("circle", { cx: "0", cy: "0", r: "42", fill: "rgba(143,29,29,0.1)", stroke: "#8f1d1d", "stroke-width": "4" }),
      el("circle", { cx: "0", cy: "0", r: "34", fill: "none", stroke: "#8f1d1d", "stroke-width": "1.5" }),
      tx(0, 6, word, { "text-anchor": "middle", fill: "#8f1d1d", "font-size": "18", "font-weight": "800" })
    ]);
  }

  var scenes = {
    leader: function (salt) {
      return svg(salt, [
        el("rect", { width: "960", height: "540", fill: "#090807" }),
        el("circle", { cx: "480", cy: "250", r: "92", fill: "none", stroke: "#f4ead9", "stroke-width": "3", class: "anim-draw" }),
        el("circle", { cx: "480", cy: "250", r: "8", fill: "#d7a441" }),
        el("path", { d: "M480 120 V180 M480 320 V380 M340 250 H400 M560 250 H620", stroke: "#f4ead9", "stroke-width": "2", class: "anim-draw" }),
        tx(480, 400, "한빛지방국세청", { "text-anchor": "middle", fill: "#f4ead9", "font-size": "28", "letter-spacing": "0.18em" }),
        tx(480, 434, "특별조사2계", { "text-anchor": "middle", fill: "#d7a441", "font-size": "18", class: "anim-fade-late" })
      ]);
    },
    office: function (salt) {
      var rain = [];
      var i;
      for (i = 0; i < 26; i++) {
        var x = 640 + (i * 19) % 210;
        var y = 80 + (i * 37) % 150;
        rain.push(el("line", {
          x1: x, y1: y, x2: x - 10, y2: y + 18,
          stroke: "rgba(220,230,240,0.45)", "stroke-width": "1", class: "rain",
          style: "animation-delay:" + (i % 7) * 0.12 + "s"
        }));
      }
      var windows = [];
      for (i = 0; i < 12; i++) {
        windows.push(el("rect", {
          x: 70 + (i % 6) * 28,
          y: 150 + Math.floor(i / 6) * 36,
          width: "16", height: "20",
          fill: i % 4 === 0 ? "#e7c27a" : "#1b2830",
          class: i % 4 === 0 ? "anim-flicker" : null
        }));
      }
      return svg(salt, [
        el("rect", { width: "960", height: "540", fill: "url(#" + salt + "-night)" }),
        el("rect", { x: "40", y: "120", width: "250", height: "210", fill: "#141a20" }),
        el("g", {}, windows),
        el("clipPath", { id: salt + "-win" }, [
          el("rect", { x: "620", y: "70", width: "260", height: "200" })
        ]),
        el("polygon", { points: "250,250 470,390 120,390", fill: "rgba(231,194,122,0.16)", class: "anim-flicker" }),
        el("rect", { x: "228", y: "168", width: "46", height: "28", rx: "4", fill: "#6b5428" }),
        el("rect", { x: "246", y: "196", width: "8", height: "70", fill: "#3a3124" }),
        el("rect", { x: "620", y: "70", width: "260", height: "200", fill: "#0c1218" }),
        el("g", { "clip-path": "url(#" + salt + "-win)" }, rain),
        tx(750, 168, "한빛", { "text-anchor": "middle", fill: "#e7c27a", "font-size": "20", class: "anim-flicker" }),
        el("rect", { x: "620", y: "70", width: "260", height: "200", fill: "none", stroke: "#d7b56a", "stroke-width": "4" }),
        el("rect", { x: "0", y: "400", width: "960", height: "140", fill: "#3a2a1c" }),
        el("g", { class: "anim-slide" }, [
          paper(salt, 250, 130, 460, 250),
          tx(480, 185, "특별조사2계", { "text-anchor": "middle", fill: "#1c1915", "font-size": "22" }),
          tx(480, 220, "야간 당직  ·  비", { "text-anchor": "middle", fill: "#5e564c", "font-size": "16" }),
          sealOnPaper(480, 300, "착수")
        ])
      ]);
    },
    receiptClock: function (salt) {
      return svg(salt, [
        el("rect", { width: "960", height: "540", fill: "#1a140f" }),
        paper(salt, 250, 70, 460, 400),
        tx(280, 120, "별빛마트 본사점", { fill: "#1c1915", "font-size": "22" }),
        tx(280, 148, "T-04", { fill: "#5e564c", "font-size": "14", "font-family": "ui-monospace, monospace" }),
        tx(280, 210, "4819   21:02", { fill: "#1c1915", "font-size": "20", "font-family": "ui-monospace, monospace" }),
        tx(280, 250, "4820   22:14", { fill: "#1c1915", "font-size": "26", "font-family": "ui-monospace, monospace" }),
        el("line", { x1: "430", y1: "242", x2: "560", y2: "242", stroke: "#8f1d1d", "stroke-width": "4", class: "anim-strike" }),
        tx(280, 292, "4821   21:40", { fill: "#1c1915", "font-size": "20", "font-family": "ui-monospace, monospace" }),
        tx(280, 340, "4820은 21:02와 21:40 사이", { fill: "#8f1d1d", "font-size": "20", class: "anim-fade-late" }),
        tx(280, 374, "22:14는 나중에 쓴 시각", { fill: "#8f1d1d", "font-size": "20", class: "anim-fade-later" }),
        tx(280, 420, "도시락  8,500  ·  카드 3812", { fill: "#5e564c", "font-size": "16" })
      ]);
    },
    coast: function (salt) {
      return svg(salt, [
        el("rect", { width: "960", height: "540", fill: "#14110e" }),
        el("path", { d: "M0 250 C 140 190, 220 300, 360 230 L 360 540 L 0 540 Z", fill: "#3e4a34" }),
        el("path", { d: "M360 230 C 520 160, 700 320, 960 210 L 960 540 L 360 540 Z", fill: "url(#" + salt + "-sea)" }),
        tx(120, 200, "한빛시 중구", { fill: "#f4ead9", "font-size": "20" }),
        tx(120, 228, "본사  IN 21:05", { fill: "#e7c27a", "font-size": "16" }),
        tx(690, 190, "남해휴게소", { fill: "#f4ead9", "font-size": "20" }),
        tx(690, 218, "카드  22:47", { fill: "#e7c27a", "font-size": "16" }),
        el("circle", { cx: "150", cy: "280", r: "8", fill: "#f4ead9", class: "anim-drop" }),
        el("circle", { cx: "760", cy: "270", r: "8", fill: "#8f1d1d", class: "anim-drop", style: "animation-delay:0.35s" }),
        el("path", { d: "M150 280 C 300 120, 560 120, 760 270", fill: "none", stroke: "#8f1d1d", "stroke-width": "3", "stroke-dasharray": "8 8", class: "anim-draw" }),
        el("rect", { x: "300", y: "400", width: "360", height: "70", rx: "2", fill: "#f4ead9" }),
        tx(480, 442, "출입 구간 안에 남쪽 카드", { "text-anchor": "middle", fill: "#8f1d1d", "font-size": "20" })
      ]);
    },
    three: function (salt) {
      var labels = ["영수증", "내역서", "출입기록"];
      return svg(salt, [
        el("rect", { width: "960", height: "540", fill: "#16130f" }),
        el("g", {}, labels.map(function (label, i) {
          return el("g", { class: "anim-slide", style: "animation-delay:" + (i * 0.18) + "s" }, [
            paper(salt, 90 + i * 280, 110, 230, 280),
            tx(205 + i * 280, 250, label, { "text-anchor": "middle", fill: "#1c1915", "font-size": "26" }),
            tx(205 + i * 280, 300, "대조", { "text-anchor": "middle", fill: "#5e564c", "font-size": "16" })
          ]);
        }))
      ]);
    },
    fish: function (salt) {
      return svg(salt, [
        el("rect", { width: "960", height: "540", fill: "#16130f" }),
        paper(salt, 280, 90, 400, 340),
        tx(310, 160, "부두횟집", { fill: "#1c1915", "font-size": "28" }),
        tx(310, 200, "2026-03-14   남해항", { fill: "#5e564c", "font-size": "16" }),
        tx(310, 260, "2인", { fill: "#1c1915", "font-size": "22" }),
        el("g", { class: "anim-fade-late" }, [
          el("ellipse", { cx: "560", cy: "330", rx: "70", ry: "36", fill: "none", stroke: "#8f1d1d", "stroke-width": "3", transform: "rotate(-8 560 330)" }),
          tx(560, 338, "청람", { "text-anchor": "middle", fill: "#8f1d1d", "font-size": "28" })
        ]),
        tx(480, 470, "아직 이름만 남습니다", { "text-anchor": "middle", fill: "#f4ead9", "font-size": "20", class: "anim-fade-later" })
      ]);
    },
    peel: function (salt) {
      return svg(salt, [
        el("rect", { width: "960", height: "540", fill: "#201812" }),
        paper(salt, 180, 110, 600, 300),
        tx(220, 180, "03-04   아펙스모터스   1,200,000", { fill: "#1c1915", "font-size": "22", "font-family": "ui-monospace, monospace" }),
        tx(220, 250, "얼라인먼트", { fill: "#1f4d3a", "font-size": "36" }),
        el("g", { class: "anim-peel" }, [
          el("rect", { x: "200", y: "210", width: "420", height: "70", fill: "#f4ead9" }),
          tx(220, 255, "토너 및 소모품", { fill: "#1c1915", "font-size": "32" })
        ]),
        tx(220, 340, "같은 돈입니다. 계정만 바뀌었습니다.", { fill: "#8f1d1d", "font-size": "20", class: "anim-fade-later" }),
        el("g", { transform: "translate(640 168)", class: "anim-fade-late" }, [
          el("circle", { cx: "0", cy: "40", r: "34", fill: "none", stroke: "#1c1915", "stroke-width": "6" }),
          el("rect", { x: "-8", y: "70", width: "16", height: "40", fill: "#1c1915" }),
          tx(0, 150, "부품", { "text-anchor": "middle", fill: "#1c1915", "font-size": "16" })
        ])
      ]);
    },
    bars: function (salt) {
      return svg(salt, [
        el("rect", { width: "960", height: "540", fill: "#181410" }),
        tx(80, 90, "3월", { fill: "#f4ead9", "font-size": "18" }),
        tx(80, 180, "급여  3,200,000", { fill: "#f4ead9", "font-size": "18" }),
        el("g", { class: "anim-grow" }, [
          el("rect", { x: "80", y: "198", width: "140", height: "28", fill: "#d7a441" })
        ]),
        tx(80, 280, "급여의 세 배", { fill: "#cbbfa8", "font-size": "16" }),
        el("g", { class: "anim-grow", style: "animation-delay:0.25s" }, [
          el("rect", { x: "80", y: "298", width: "420", height: "18", fill: "rgba(244,234,217,0.35)" })
        ]),
        tx(80, 370, "부품  17,600,000", { fill: "#f4ead9", "font-size": "18" }),
        el("g", { class: "anim-grow", style: "animation-delay:0.45s" }, [
          el("rect", { x: "80", y: "388", width: "760", height: "28", fill: "#8f1d1d" })
        ]),
        tx(80, 450, "입금의 이름은 청람유통", { fill: "#e7c27a", "font-size": "22", class: "anim-fade-late" })
      ]);
    },
    approval: function (salt, shot) {
      return svg(salt, [
        el("rect", { width: "960", height: "540", fill: "#1c1612" }),
        paper(salt, 160, 80, 640, 360),
        tx(200, 150, "지출내역서", { fill: "#5e564c", "font-size": "16" }),
        tx(200, 210, (shot && shot.lines && shot.lines[0]) || "품목은 바뀌었습니다", { fill: "#1c1915", "font-size": "22" }),
        tx(200, 270, (shot && shot.lines && shot.lines[1]) || "돈의 출처는 급여가 아닙니다", { fill: "#1c1915", "font-size": "22" }),
        tx(200, 340, "결재   윤가람", { fill: "#1c1915", "font-size": "32" }),
        el("line", { x1: "190", y1: "352", x2: "470", y2: "352", stroke: "#d7a441", "stroke-width": "4", class: "anim-strike" }),
        tx(200, 400, (shot && shot.line) || "결재란은 윤가람. 그의 밤은 아직입니다.", { fill: "#8f1d1d", "font-size": "18", class: "anim-fade-late" })
      ]);
    },
    clocks: function (salt) {
      return svg(salt, [
        el("rect", { width: "480", height: "540", fill: "url(#" + salt + "-dawn)" }),
        el("rect", { x: "480", width: "480", height: "540", fill: "#102028" }),
        tx(240, 150, "북원", { "text-anchor": "middle", fill: "#f4ead9", "font-size": "22" }),
        tx(240, 230, "08:20", { "text-anchor": "middle", fill: "#f4ead9", "font-size": "64", "font-family": "ui-monospace, monospace" }),
        tx(240, 280, "호텔 조식", { "text-anchor": "middle", fill: "#e7c27a", "font-size": "18" }),
        tx(720, 150, "강남", { "text-anchor": "middle", fill: "#f4ead9", "font-size": "22" }),
        tx(720, 230, "09:05", { "text-anchor": "middle", fill: "#f4ead9", "font-size": "64", "font-family": "ui-monospace, monospace" }),
        tx(720, 280, "루프44", { "text-anchor": "middle", fill: "#e7c27a", "font-size": "18" }),
        el("rect", { x: "300", y: "340", width: "360", height: "90", fill: "#f4ead9" }),
        tx(480, 395, "간격 45분  /  최소 150분", { "text-anchor": "middle", fill: "#8f1d1d", "font-size": "24" })
      ]);
    },
    duplicate: function (salt) {
      return svg(salt, [
        el("rect", { width: "960", height: "540", fill: "#201812" }),
        el("g", { transform: "rotate(-6 300 270)" }, [
          paper(salt, 120, 120, 300, 280),
          tx(150, 190, "B-220", { fill: "#1c1915", "font-size": "28", "font-family": "ui-monospace, monospace" }),
          tx(150, 240, "420,000", { fill: "#1c1915", "font-size": "22" })
        ]),
        el("g", { transform: "rotate(5 660 290)", class: "anim-fade-late" }, [
          paper(salt, 500, 140, 300, 280),
          tx(530, 210, "B-220", { fill: "#1c1915", "font-size": "28", "font-family": "ui-monospace, monospace" }),
          tx(530, 260, "같은 번호", { fill: "#8f1d1d", "font-size": "22" }),
          tx(530, 310, "폐업  2025-11-01", { fill: "#1c1915", "font-size": "18" })
        ]),
        seal(760, 160, "위조", 1.3)
      ]);
    },
    dinner: function (salt) {
      var chips = names18.map(function (name, i) {
        var col = i % 9;
        var row = Math.floor(i / 9);
        var ghost = name === "김하늘" || name === "남민준";
        return el("g", {}, [
          el("rect", { x: 48 + col * 96, y: 348 + row * 46, width: "88", height: "36", rx: "2", fill: ghost ? "#8f1d1d" : "#f4ead9" }),
          tx(92 + col * 96, 372 + row * 46, name, { "text-anchor": "middle", fill: ghost ? "#fff8f4" : "#1c1915", "font-size": "14" })
        ]);
      });
      var plates = [];
      var p;
      for (p = 0; p < 6; p++) {
        plates.push(el("ellipse", { cx: 280 + p * 70, cy: 230, rx: "26", ry: "14", fill: "#f7f1e6" }));
      }
      return svg(salt, [
        el("rect", { width: "960", height: "540", fill: "#24160f" }),
        el("ellipse", { cx: "470", cy: "230", rx: "250", ry: "70", fill: "#4a2c1c" }),
        el("g", {}, plates),
        tx(400, 110, "서명 18  /  스테이크 6", { "text-anchor": "middle", fill: "#f4ead9", "font-size": "28" }),
        el("path", { d: "M140 348 C 260 180, 520 120, 780 150", fill: "none", stroke: "#e7c27a", "stroke-width": "2", class: "anim-draw" }),
        el("path", { d: "M428 348 C 520 200, 640 150, 780 168", fill: "none", stroke: "#e7c27a", "stroke-width": "2", class: "anim-draw", style: "animation-delay:0.25s" }),
        el("g", {}, chips),
        el("g", { class: "anim-fade-late" }, [
          el("rect", { x: "760", y: "120", width: "160", height: "78", fill: "#f4ead9" }),
          tx(840, 152, "북원", { "text-anchor": "middle", fill: "#8f1d1d", "font-size": "16" }),
          tx(840, 176, "영화 · 주유", { "text-anchor": "middle", fill: "#1c1915", "font-size": "14" })
        ])
      ]);
    },
    signflip: function (salt) {
      return svg(salt, [
        el("rect", { width: "960", height: "540", fill: "#120e0c" }),
        el("rect", { x: "180", y: "140", width: "600", height: "180", fill: "#1a120e", stroke: "#d7a441", "stroke-width": "6" }),
        tx(480, 200, "금강루", { "text-anchor": "middle", fill: "#f4ead9", "font-size": "48", class: "anim-out", style: "animation-delay:0.7s" }),
        tx(480, 262, "청람유통", { "text-anchor": "middle", fill: "#f4ead9", "font-size": "42", class: "anim-fade-late", style: "animation-delay:0.85s" }),
        tx(480, 300, "도소매  ·  서구 창고길 9", { "text-anchor": "middle", fill: "#e7c27a", "font-size": "18", class: "anim-fade-late", style: "animation-delay:1s" }),
        tx(480, 400, "814-22-01937", { "text-anchor": "middle", fill: "#d7a441", "font-size": "28", "font-family": "ui-monospace, monospace", class: "anim-fade-late", style: "animation-delay:1s" })
      ]);
    },
    blank: function (salt) {
      var lines = [];
      var i;
      for (i = 0; i < 5; i++) {
        lines.push(el("line", { x1: "180", y1: 230 + i * 36, x2: "760", y2: 230 + i * 36, stroke: "rgba(28,25,21,0.35)", "stroke-width": "1" }));
        lines.push(tx(190, 222 + i * 36, i === 0 ? "자문 회의는 열리지 않았습니다" : "문장은 비어 있습니다", {
          fill: "#5e564c", "font-size": "16", class: "anim-out", style: "animation-delay:" + (0.4 + i * 0.12) + "s"
        }));
      }
      return svg(salt, [
        el("rect", { width: "960", height: "540", fill: "#1b1916" }),
        paper(salt, 140, 70, 680, 390),
        tx(180, 130, "3월 자문 보고서", { fill: "#1c1915", "font-size": "26" }),
        el("g", {}, lines)
      ]);
    },
    pipe: function (salt) {
      return svg(salt, [
        el("rect", { width: "960", height: "540", fill: "#14110e" }),
        slip(salt, 70, "계약", "6,000,000"),
        slip(salt, 360, "이체", "6,000,000"),
        slip(salt, 650, "입금", "6,000,000"),
        el("path", { d: "M250 270 H340", stroke: "#8f1d1d", "stroke-width": "3", class: "anim-draw" }),
        el("path", { d: "M540 270 H630", stroke: "#8f1d1d", "stroke-width": "3", class: "anim-draw", style: "animation-delay:0.4s" }),
        tx(480, 400, "예금주  청람유통", { "text-anchor": "middle", fill: "#f4ead9", "font-size": "26", class: "anim-fade-late" }),
        tx(480, 448, "도장  윤가람", { "text-anchor": "middle", fill: "#e7c27a", "font-size": "22", class: "anim-fade-later" })
      ]);
    },
    pile: function (salt) {
      var tabs = ["도시락", "토너", "두 도시", "저녁", "빈 보고"];
      var g = tabs.map(function (label, i) {
        return el("g", { class: "anim-slide", style: "animation-delay:" + (i * 0.16) + "s" }, [
          el("rect", { x: 150 + i * 18, y: 150 + i * 22, width: "520", height: "64", fill: i % 2 ? "#e7d3a4" : "#f4ead9" }),
          tx(180 + i * 18, 190 + i * 22, "0" + (i + 1) + "  " + label, { fill: "#1c1915", "font-size": "22" })
        ]);
      });
      return svg(salt, [
        el("rect", { width: "960", height: "540", fill: "#1a140f" }),
        el("g", {}, g),
        tx(480, 450, "사본이 한 책상으로 모입니다", { "text-anchor": "middle", fill: "#f4ead9", "font-size": "24", class: "anim-fade-late" })
      ]);
    },
    loose: function (salt) {
      var notes = [
        [120, 80, "도시락"],
        [360, 60, "부품"],
        [600, 90, "두 도시"],
        [240, 250, "저녁"],
        [520, 240, "자문"]
      ];
      return svg(salt, [
        el("rect", { width: "960", height: "540", fill: "url(#" + salt + "-cork)" }),
        el("path", { d: "M230 150 C 300 180, 340 120, 430 130", fill: "none", stroke: "#8f1d1d", "stroke-width": "2", class: "anim-draw-shy" }),
        el("path", { d: "M500 140 C 560 200, 560 220, 620 250", fill: "none", stroke: "#8f1d1d", "stroke-width": "2", class: "anim-draw-shy", style: "animation-delay:0.3s" }),
        el("g", {}, notes.map(function (n) {
          return el("g", {}, [
            el("rect", { x: n[0], y: n[1], width: "180", height: "90", fill: "#f7f1e4" }),
            el("circle", { cx: n[0] + 90, cy: n[1] + 12, r: "5", fill: "#8f1d1d" }),
            tx(n[0] + 16, n[1] + 55, n[2], { fill: "#1c1915", "font-size": "22" })
          ]);
        })),
        tx(480, 450, "실은 아직 묶지 않습니다", { "text-anchor": "middle", fill: "#f4ead9", "font-size": "24" })
      ]);
    },
    opinion: function (salt) {
      return svg(salt, [
        el("rect", { width: "960", height: "540", fill: "#12100e" }),
        paper(salt, 180, 70, 600, 390),
        tx(220, 140, "의견서", { fill: "#1c1915", "font-size": "28" }),
        tx(220, 210, "정점", { fill: "#5e564c", "font-size": "16" }),
        el("line", { x1: "300", y1: "210", x2: "700", y2: "210", stroke: "rgba(28,25,21,0.3)" }),
        tx(220, 270, "사업자", { fill: "#5e564c", "font-size": "16" }),
        el("line", { x1: "320", y1: "270", x2: "700", y2: "270", stroke: "rgba(28,25,21,0.3)" }),
        tx(220, 330, "이니셜", { fill: "#5e564c", "font-size": "16" }),
        el("line", { x1: "320", y1: "330", x2: "700", y2: "330", stroke: "rgba(28,25,21,0.3)" }),
        tx(480, 420, "어디까지 쓸지는 이 책상에서 고릅니다", { "text-anchor": "middle", fill: "#8f1d1d", "font-size": "18", class: "anim-fade-late" })
      ]);
    },
    endNarrow: function (salt) {
      return svg(salt, [
        el("rect", { width: "960", height: "540", fill: "#14110e" }),
        paper(salt, 170, 60, 620, 400),
        tx(210, 130, "의견서", { fill: "#5e564c", "font-size": "16" }),
        tx(210, 200, "결재", { fill: "#1c1915", "font-size": "18" }),
        tx(320, 200, "윤가람", { fill: "#1c1915", "font-size": "32" }),
        el("line", { x1: "300", y1: "212", x2: "520", y2: "212", stroke: "#d7a441", "stroke-width": "3", class: "anim-strike" }),
        tx(210, 270, "사업자", { fill: "#b7ab9a", "font-size": "18", class: "anim-out" }),
        tx(210, 320, "이니셜", { fill: "#b7ab9a", "font-size": "18", class: "anim-out" }),
        tx(210, 390, "나머지는 다음 철로 밀립니다", { fill: "#8f1d1d", "font-size": "20", class: "anim-fade-late" })
      ]);
    },
    endCompany: function (salt) {
      return svg(salt, [
        el("rect", { width: "960", height: "540", fill: "#12100e" }),
        el("rect", { x: "80", y: "250", width: "360", height: "160", fill: "#3a2a1c" }),
        el("polygon", { points: "70,250 260,160 450,250", fill: "#5c4030" }),
        tx(260, 340, "창고길 9", { "text-anchor": "middle", fill: "#f4ead9", "font-size": "20" }),
        tx(560, 180, "814-22-01937", { fill: "#f4ead9", "font-size": "32", "font-family": "ui-monospace, monospace" }),
        tx(560, 240, "청람유통", { fill: "#e7c27a", "font-size": "40", class: "anim-fade-late" }),
        tx(560, 300, "도소매", { fill: "#f4ead9", "font-size": "22", class: "anim-fade-later" }),
        tx(560, 360, "결재  윤가람", { fill: "#f4ead9", "font-size": "22", class: "anim-fade-later" })
      ]);
    },
    endFull: function (salt) {
      var cols = [
        [80, "결재", "윤가람"],
        [360, "번호", "청람유통"],
        [640, "이니셜", "ㅂㄷㅇ"]
      ];
      return svg(salt, [
        el("rect", { width: "960", height: "540", fill: "#0e1418" }),
        el("g", {}, cols.map(function (c, i) {
          return el("g", { class: "anim-fade-late", style: "animation-delay:" + (0.2 + i * 0.35) + "s" }, [
            el("rect", { x: c[0], y: "80", width: "240", height: "220", fill: "#f4ead9" }),
            tx(c[0] + 24, 140, c[1], { fill: "#5e564c", "font-size": "16" }),
            tx(c[0] + 24, 200, c[2], { fill: "#1c1915", "font-size": "32" })
          ]);
        })),
        el("rect", { x: "0", y: "360", width: "960", height: "180", fill: "#102830" }),
        el("rect", { x: "80", y: "430", width: "800", height: "16", fill: "#6b5434" }),
        el("circle", { cx: "300", cy: "400", r: "8", fill: "#e7c27a", class: "blink" }),
        el("circle", { cx: "680", cy: "390", r: "8", fill: "#e7c27a", class: "blink", style: "animation-delay:0.4s" }),
        tx(480, 455, "항만  03-14", { "text-anchor": "middle", fill: "#f4ead9", "font-size": "18" })
      ]);
    },
    endSpecial: function (salt) {
      var slips = ["횟집", "작업지시", "옥상로", "주유", "빈 보고"].map(function (label, i) {
        return el("g", { class: "anim-fall", style: "animation-delay:" + (0.2 + i * 0.12) + "s" }, [
          el("rect", { x: 80 + i * 150, y: 80 + (i % 2) * 24, width: "130", height: "70", fill: "#f7e7c4", transform: "rotate(" + (i % 2 ? -4 : 3) + " " + (140 + i * 150) + " 110)" }),
          tx(100 + i * 150, 122 + (i % 2) * 24, label, { fill: "#1c1915", "font-size": "16" })
        ]);
      });
      return svg(salt, [
        el("rect", { width: "960", height: "540", fill: "#1a140f" }),
        el("g", {}, slips),
        paper(salt, 230, 200, 500, 200),
        tx(480, 280, "각주가 본문만큼 깁니다", { "text-anchor": "middle", fill: "#1c1915", "font-size": "26" }),
        tx(480, 330, "특별조사", { "text-anchor": "middle", fill: "#8f1d1d", "font-size": "28", class: "anim-fade-late" })
      ]);
    },
    endHold: function (salt) {
      return svg(salt, [
        el("rect", { width: "960", height: "540", fill: "#16130f" }),
        el("rect", { x: "80", y: "80", width: "800", height: "300", fill: "#2a241c" }),
        el("g", { class: "anim-slide" }, [
          paper(salt, 250, 120, 420, 220),
          tx(460, 220, "의견서", { "text-anchor": "middle", fill: "#5e564c", "font-size": "18" }),
          tx(460, 270, "비어 있음", { "text-anchor": "middle", fill: "#1c1915", "font-size": "28" })
        ]),
        tx(480, 450, "철은 캐비닛으로 돌아갑니다", { "text-anchor": "middle", fill: "#f4ead9", "font-size": "22", class: "anim-fade-late" })
      ]);
    },
    endWrong: function (salt, shot, opts) {
      var who = (opts && opts.who) || "김하늘";
      var alibi = (opts && opts.alibi) || "";
      return svg(salt, [
        el("rect", { width: "960", height: "540", fill: "#140e0c" }),
        paper(salt, 150, 80, 660, 340),
        tx(480, 200, who, { "text-anchor": "middle", fill: "#1c1915", "font-size": "64" }),
        el("path", { d: "M260 150 L700 360", stroke: "#8f1d1d", "stroke-width": "8", class: "anim-draw" }),
        el("path", { d: "M700 150 L260 360", stroke: "#8f1d1d", "stroke-width": "8", class: "anim-draw", style: "animation-delay:0.2s" }),
        tx(480, 300, alibi, { "text-anchor": "middle", fill: "#5e564c", "font-size": "18", class: "anim-fade-late" }),
        seal(780, 130, "폐기", 0.9)
      ]);
    },
    drill: function (salt) {
      var holes = [];
      var i;
      for (i = 0; i < 18; i++) holes.push(el("circle", { cx: 250 + i * 26, cy: "78", r: "7", fill: "#1a140f" }));
      return svg(salt, [
        el("rect", { width: "960", height: "540", fill: "#1a140f" }),
        el("g", {}, holes),
        paper(salt, 250, 86, 460, 370),
        tx(280, 150, "연습마트 교육점", { fill: "#1c1915", "font-size": "22" }),
        tx(280, 186, "T-00", { fill: "#5e564c", "font-size": "14", "font-family": "ui-monospace, monospace" }),
        tx(280, 240, "99    18:10", { fill: "#1c1915", "font-size": "20", "font-family": "ui-monospace, monospace" }),
        tx(280, 286, "100   18:40", { fill: "#1c1915", "font-size": "28", "font-family": "ui-monospace, monospace" }),
        el("line", { x1: "430", y1: "276", x2: "620", y2: "276", stroke: "#8f1d1d", "stroke-width": "4", class: "anim-strike" }),
        tx(280, 332, "101   18:22", { fill: "#1c1915", "font-size": "20", "font-family": "ui-monospace, monospace" }),
        tx(280, 390, "100은 18:10과 18:22 사이", { fill: "#8f1d1d", "font-size": "20", class: "anim-fade-late" })
      ]);
    },
    closeup: function (salt, shot) {
      var head = (shot && shot.head) || "전표";
      var lines = (shot && shot.lines) || [];
      var holes = [];
      var i;
      for (i = 0; i < 16; i++) holes.push(el("circle", { cx: 230 + i * 32, cy: "64", r: "8", fill: "#16130f" }));
      var body = lines.map(function (line, n) {
        return tx(250, 180 + n * 42, line, { fill: n === lines.length - 1 ? "#8f1d1d" : "#1c1915", "font-size": "22", "font-family": "ui-monospace, monospace", class: n ? "anim-fade-late" : null, style: n ? "animation-delay:" + (0.2 + n * 0.18) + "s" : null });
      });
      var bars = [];
      for (i = 0; i < 28; i++) bars.push(el("rect", { x: 300 + i * 8, y: "400", width: i % 3 === 0 ? "3" : "1", height: "36", fill: "#1c1915" }));
      return svg(salt, [
        el("rect", { width: "960", height: "540", fill: "#16130f" }),
        el("g", {}, holes),
        paper(salt, 200, 72, 560, 390),
        tx(480, 130, head, { "text-anchor": "middle", fill: "#1c1915", "font-size": "28" }),
        el("g", {}, body),
        el("g", { class: "anim-fade-later" }, bars)
      ]);
    },
    fact: function (salt, shot, opts) {
      var lines = (opts && opts.lines) || (shot && shot.lines) || [];
      var head = (opts && opts.head) || (shot && shot.head) || "사실";
      var body = lines.slice(0, 4).map(function (line, n) {
        return tx(210, 180 + n * 44, line, {
          fill: "#1c1915",
          "font-size": "22",
          "font-family": "ui-monospace, monospace",
          class: n ? "anim-fade-late" : null,
          style: n ? "animation-delay:" + (0.15 * n) + "s" : null
        });
      });
      return svg(salt, [
        el("rect", { width: "960", height: "540", fill: "#14110e" }),
        paper(salt, 160, 70, 640, 380),
        tx(200, 125, head, { fill: "#8f1d1d", "font-size": "18" }),
        el("g", {}, body),
        sealOnPaper(730, 380, "정정")
      ]);
    },
    custody: function (salt, shot) {
      var name = (shot && shot.name) || "";
      var line = (shot && shot.line) || "";
      return svg(salt, [
        el("rect", { width: "960", height: "540", fill: "#100e0c" }),
        el("rect", { x: "70", y: "40", width: "90", height: "250", fill: "#1c1814" }),
        el("rect", { x: "78", y: "70", width: "36", height: "48", fill: "#cbb892" }),
        el("rect", { x: "0", y: "360", width: "960", height: "180", fill: "#2a2118" }),
        el("rect", { x: "250", y: "300", width: "460", height: "28", fill: "#4a3424" }),
        el("rect", { x: "180", y: "150", width: "16", height: "150", fill: "#3a2e24" }),
        el("rect", { x: "150", y: "150", width: "70", height: "14", rx: "3", fill: "#3a2e24" }),
        el("path", { d: "M168 150 C 210 120, 250 170, 230 210", fill: "#1f4d3a", opacity: "0.9" }),
        el("g", { transform: "translate(620 250)" }, [
          el("circle", { cx: "0", cy: "0", r: "16", fill: "none", stroke: "#cbb892", "stroke-width": "4" }),
          el("circle", { cx: "28", cy: "8", r: "16", fill: "none", stroke: "#cbb892", "stroke-width": "4" }),
          el("line", { x1: "12", y1: "6", x2: "16", y2: "4", stroke: "#cbb892", "stroke-width": "4" })
        ]),
        paper(salt, 280, 140, 400, 200),
        tx(310, 195, name, { fill: "#1c1915", "font-size": "28" }),
        tx(310, 230, line, { fill: "#5e564c", "font-size": "16" }),
        sealOnPaper(500, 270, "소환")
      ]);
    },
    stamp: function (salt, shot) {
      var word = (shot && shot.word) || "마감";
      return svg(salt, [
        el("rect", { width: "960", height: "540", fill: "#1a120e" }),
        el("rect", { x: "180", y: "80", width: "600", height: "380", fill: "url(#" + salt + "-paper)" }),
        el("g", { class: "anim-slam" }, [
          el("circle", { cx: "480", cy: "250", r: "110", fill: "none", stroke: "#8f1d1d", "stroke-width": "8" }),
          el("circle", { cx: "480", cy: "250", r: "92", fill: "none", stroke: "#8f1d1d", "stroke-width": "2" }),
          tx(480, 262, word, { "text-anchor": "middle", fill: "#8f1d1d", "font-size": "42", "font-weight": "800" })
        ])
      ]);
    }
  };

  function slip(salt, x, title, amount) {
    return el("g", { class: "anim-slide" }, [
      paper(salt, x, 140, 220, 200),
      tx(x + 20, 200, title, { fill: "#5e564c", "font-size": "16" }),
      tx(x + 20, 250, amount, { fill: "#1c1915", "font-size": "22", "font-family": "ui-monospace, monospace" })
    ]);
  }

  function card(kicker, title) {
    return {
      card: true,
      kicker: kicker,
      title: title,
      caption: "",
      hold: 2400,
      cue: "low"
    };
  }

  function shot(scene, caption, cue, extra) {
    var row = { scene: scene, caption: caption, cue: cue || "paper", hold: 5600 };
    if (extra) Object.keys(extra).forEach(function (k) { row[k] = extra[k]; });
    return row;
  }

  var SEQ = {
    open: {
      kicker: "특별조사2계",
      title: "책상 하나만",
      reel: "REEL 00",
      shots: [
        { scene: "leader", caption: "비가 한빛시의 창을 두드립니다.", hold: 3200, cue: "tick" },
        shot("office", "오세린이 불을 남긴 채, 철을 책상 가운데 내려놓습니다.", "paper"),
        shot("three", "같은 밤을 가리키는 종이가 세 장. 날짜가 서로 등을 돌립니다.", "tick"),
        shot("opinion", "의견서는 비어 있습니다. 이름은 아직 종이 뒤에 있습니다.", "low")
      ]
    },
    case00: {
      kicker: "견습 종결",
      title: "연습 전표",
      reel: "REEL 00",
      shots: [
        card("견습", "연습 전표"),
        shot("drill", "100번은 101번보다 이를 수 없습니다. 18:40은 나중에 쓴 시각입니다.", "tick"),
        shot("closeup", "커피는 그 시각, 그 자리에 있습니다.", "paper", {
          head: "연습마트",
          lines: ["99   18:10  생수", "100  18:40  제출본", "101  18:22  보관본"]
        }),
        shot("office", "연습의 불은 여기서 꺼집니다. 밖에는 아직 비가 옵니다.", "stamp")
      ]
    },
    case01: {
      kicker: "철 01 종결",
      title: "야근 도시락",
      reel: "REEL 01",
      shots: [
        card("철 01", "야근 도시락"),
        shot("receiptClock", "4820은 22:14일 수 없습니다. 번호가 시각을 고칩니다.", "tick"),
        shot("closeup", "제출본과 가맹점 보관본은 같은 번호인데 시각만 다릅니다.", "paper", {
          head: "별빛마트  T-04",
          lines: ["4819  21:02  생수", "4820  22:14  제출본", "4820  공란   보관본", "4821  21:40  김밥"]
        }),
        shot("coast", "게이트는 그를 본사 안에 두고, 카드는 남해에 둡니다.", "low"),
        shot("fish", "횟집 메모의 청람은 아직 이름만 남습니다.", "paper"),
        shot("custody", "빈 의자와 소환 도장만 남습니다. 사람은 이미 그 방을 나섰습니다.", "stamp", { name: "박도윤", line: "허위 야근" })
      ]
    },
    case02: {
      kicker: "철 02 종결",
      title: "토너의 가격",
      reel: "REEL 02",
      shots: [
        card("철 02", "토너의 가격"),
        shot("peel", "같은 상호, 같은 금액. 내역서는 토너이고 원장은 얼라인먼트입니다.", "paper"),
        shot("closeup", "한 줄의 적요가 벗겨지면 부품 이름이 남습니다.", "paper", {
          head: "아펙스모터스",
          lines: ["03-04  1,200,000", "내역서  토너", "원장    얼라인먼트", "결재    윤가람"]
        }),
        shot("bars", "한 달의 부품은 실수령의 세 배를 넘습니다. 입금은 청람유통입니다.", "low"),
        shot("approval", "결재란의 이름은 윤가람입니다. 그의 밤은 아직 열리지 않았습니다.", "tick"),
        shot("custody", "통장은 책상 위에 남고, 의자는 비어 있습니다.", "stamp", { name: "최민재", line: "비자금 수수" })
      ]
    },
    case03: {
      kicker: "철 03 종결",
      title: "같은 아침의 두 도시",
      reel: "REEL 03",
      shots: [
        card("철 03", "같은 아침의 두 도시"),
        shot("clocks", "북원 08:20과 강남 09:05. 마흔다섯 분은 두 도시 사이에 부족합니다.", "tick"),
        shot("duplicate", "B-220은 두 번 쓰였고, 그 상호는 이미 문을 닫았습니다.", "paper"),
        shot("closeup", "같은 번호가 두 장이고, 상호는 이미 폐업입니다.", "tick", {
          head: "루프44  B-220",
          lines: ["08:20  북원 호텔", "09:05  강남  42만", "폐업  2025-11-01", "결재  윤가람"]
        }),
        shot("approval", "42만 원의 결재란은 또 윤가람입니다. 구내식당까지는 진짜입니다.", "low", {
          lines: ["구내식당까지는 진짜입니다", "42만 원만 거짓입니다"],
          line: "결재는 윤가람입니다."
        }),
        shot("custody", "가짜 식대는 접히고, 그 이름의 자리는 비었습니다.", "stamp", { name: "한서준", line: "허위 경비" })
      ]
    },
    case04: {
      kicker: "철 04 종결",
      title: "열여덟 명의 저녁",
      reel: "REEL 04",
      shots: [
        card("철 04", "열여덟 명의 저녁"),
        shot("dinner", "서명은 열여덟이고, 스테이크는 여섯입니다. 두 이름은 북원에 있습니다.", "paper"),
        shot("closeup", "금강루 영수증의 수량은 서명 인원과 다릅니다.", "paper", {
          head: "금강루",
          lines: ["스테이크  6", "서명     18", "김하늘  북원 영화", "남민준  북원 주유"]
        }),
        shot("signflip", "간판은 금강루이고, 등록은 청람유통입니다. 주소는 창고입니다.", "low"),
        shot("custody", "서명부는 남고, 청구한 사람의 의자는 비었습니다.", "stamp", { name: "윤가람", line: "허위 회식" })
      ]
    },
    case05: {
      kicker: "철 05 종결",
      title: "빈 보고서",
      reel: "REEL 05",
      shots: [
        card("철 05", "빈 보고서"),
        shot("blank", "자문 보고서는 문장 없이 줄만 남습니다.", "paper"),
        shot("closeup", "빈 페이지와 같은 금액의 이체 세 장이 한 줄로 이어집니다.", "low", {
          head: "자문  6,000,000",
          lines: ["계약서  6,000,000", "이체    6,000,000", "입금    6,000,000", "예금주  청람유통"]
        }),
        shot("pipe", "같은 금액이 계약과 이체와 입금을 통과합니다. 도장은 윤가람입니다.", "low"),
        shot("custody", "빈 보고서가 접히고, 결재한 사람의 자리만 남습니다.", "stamp", { name: "윤가람", line: "허위 자문" })
      ]
    },
    case06: {
      kicker: "철 06",
      title: "청람의 꼬리",
      reel: "REEL 06",
      shots: [
        card("철 06", "청람의 꼬리"),
        shot("pile", "다섯 철의 사본이 한 책상으로 모입니다.", "paper"),
        shot("loose", "핀은 꽂혔습니다. 실은 아직 묶지 않습니다.", "tick"),
        shot("opinion", "의견서를 어디까지 쓸지는, 서류를 읽은 뒤에서 고릅니다.", "low")
      ]
    },
    "ending-narrow": {
      kicker: "의견서",
      title: "결재만 남다",
      reel: "END 01",
      shots: [
        card("의견서", "결재만 남다"),
        shot("endNarrow", "첫 문장만 남습니다. 사업자번호는 비어 있습니다.", "paper"),
        shot("custody", "결재란의 이름이 빈 의자 앞에 놓입니다.", "stamp", { name: "윤가람", line: "결재" }),
        shot("stamp", "도장은 반만 찍힙니다.", "stamp", { word: "결재" })
      ]
    },
    "ending-company": {
      kicker: "의견서",
      title: "창고의 번호",
      reel: "END 02",
      shots: [
        card("의견서", "창고의 번호"),
        shot("endCompany", "814-22-01937이 의견서 가운데로 들어옵니다.", "tick"),
        shot("custody", "창고 번호와 함께, 도장을 찍은 사람의 자리가 비었습니다.", "stamp", { name: "윤가람", line: "청람유통" }),
        shot("stamp", "창고의 번호까지 찍습니다.", "stamp", { word: "청람" })
      ]
    },
    "ending-full": {
      kicker: "의견서",
      title: "항만까지",
      reel: "END 03",
      shots: [
        card("의견서", "항만까지"),
        shot("endFull", "결재는 윤가람, 주머니는 청람유통, 그 밤의 이니셜은 ㅂㄷㅇ.", "low"),
        shot("custody", "의견서가 접히고, 결재한 사람의 의자만 남습니다.", "stamp", { name: "윤가람", line: "항만까지" }),
        shot("stamp", "오늘 보고서는 여기까지입니다.", "stamp", { word: "마감" })
      ]
    },
    "ending-special": {
      kicker: "의견서",
      title: "특별조사",
      reel: "END 04",
      shots: [
        card("의견서", "특별조사"),
        shot("endSpecial", "본철 밖의 쪽지까지 센 뒤, 철을 다른 칸으로 옮깁니다.", "paper"),
        shot("custody", "쪽지까지 센 철이 빈 의자 앞으로 옮겨집니다.", "stamp", { name: "윤가람", line: "특별조사" }),
        shot("stamp", "특별조사. 이 책상의 일은 여기서 넘깁니다.", "stamp", { word: "특별" })
      ]
    },
    "ending-hold": {
      kicker: "의견서",
      title: "보류",
      reel: "END 05",
      shots: [
        card("의견서", "보류"),
        shot("endHold", "범위를 정하지 않겠다는 선택입니다. 서류는 캐비닛으로 돌아갑니다.", "paper"),
        shot("stamp", "보류 도장만 남습니다.", "stamp", { word: "보류" })
      ]
    },
    miss: {
      kicker: "반려",
      title: "사실",
      reel: "FACT",
      shots: [
        card("사실", "보고서가 돌아왔습니다"),
        shot("fact", function (opts) { return opts.caption || "서류가 가리키는 사실을 읽으십시오."; }, "paper")
      ]
    },
    "ending-wrong": {
      kicker: "사실",
      title: "이름이 다릅니다",
      reel: "END 06",
      shots: [
        card("사실", "정점이 아닙니다"),
        shot("fact", function (opts) { return opts.alibi || "서류의 이름과 도장의 이름이 다릅니다."; }, "paper"),
        shot("stamp", "의견서는 그 사실 위에서 닫힙니다.", "stamp", { word: "정정" })
      ]
    }
  };

  function html(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (attrs[k] == null || attrs[k] === false) return;
        if (k === "class") n.className = attrs[k];
        else n.setAttribute(k, attrs[k] === true ? "" : String(attrs[k]));
      });
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  function captionOf(shot, opts) {
    if (typeof shot.caption === "function") return shot.caption(opts || {});
    return shot.caption || "";
  }

  function run(host, id, opts, done) {
    if (typeof opts === "function") { done = opts; opts = {}; }
    opts = opts || {};
    var seq = SEQ[id];
    if (!host || !seq) {
      if (done) done();
      return { skip: function () {}, advance: function () {}, stop: function () {} };
    }
    var reduce = false;
    try { reduce = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { reduce = false; }
    var index = 0;
    var timer = null;
    var typer = null;
    var stopped = false;
    var serial = 0;
    var prev = null;

    host.textContent = "";
    var shell = html("section", { class: "cinema" + (reduce ? " cinema-still" : ""), role: "region", "aria-label": seq.title });
    var top = html("div", { class: "cine-top" }, [
      html("div", {}, [
        html("p", { class: "kicker light" }),
        html("h1", {})
      ]),
      html("p", { class: "cine-reel" })
    ]);
    top.querySelector(".kicker").textContent = seq.kicker;
    top.querySelector("h1").textContent = opts.who ? seq.title + ", " + opts.who : seq.title;
    top.querySelector(".cine-reel").textContent = seq.reel;
    var frame = html("div", { class: "cine-frame" });
    var stage = html("div", { class: "cine-stage" });
    frame.appendChild(stage);
    frame.appendChild(html("div", { class: "letterbox top" }));
    frame.appendChild(html("div", { class: "letterbox bot" }));
    frame.appendChild(html("div", { class: "vignette" }));
    frame.appendChild(html("div", { class: "grain" }));
    frame.appendChild(html("div", { class: "scratch" }));
    ["tl", "tr", "bl", "br"].forEach(function (name) {
      frame.appendChild(html("span", { class: "corner " + name }));
    });
    var frameLabel = html("p", { class: "frame-label" });
    frame.appendChild(frameLabel);
    var sr = html("p", { class: "sr-only", "aria-live": "polite" });
    var caption = html("p", { class: "cine-caption", "aria-hidden": "true" });
    var pips = html("div", { class: "cine-pips" });
    var bottom = html("div", { class: "cine-bottom" }, [
      pips,
      html("div", { class: "cine-actions" }, [
        html("button", { class: "btn primary", type: "button", "data-cine": "next", text: null }),
        html("button", { class: "btn btn-on-dark", type: "button", "data-cine": "skip", text: null })
      ])
    ]);
    bottom.querySelector("[data-cine=next]").textContent = "다음 장면";
    bottom.querySelector("[data-cine=skip]").textContent = "건너뛰기";
    shell.appendChild(top);
    shell.appendChild(frame);
    shell.appendChild(sr);
    shell.appendChild(caption);
    shell.appendChild(bottom);
    host.appendChild(shell);

    function cue(name) {
      if (!name || !SR.audio || !SR.audio.cue) return;
      try { SR.audio.cue(name); } catch (e) { /* 소리 없음 */ }
    }

    function typeInto(text) {
      if (typer) clearInterval(typer);
      sr.textContent = text;
      if (!text || reduce) {
        caption.textContent = text;
        return;
      }
      caption.textContent = "";
      var i = 0;
      typer = setInterval(function () {
        i += 1;
        caption.textContent = text.slice(0, i);
        if (i >= text.length) clearInterval(typer);
      }, 26);
    }

    function paintPips() {
      pips.textContent = "";
      seq.shots.forEach(function (_, n) {
        var b = html("button", {
          class: "pip" + (n === index ? " on" : "") + (n < index ? " done" : ""),
          type: "button",
          "data-cine": "go",
          "data-index": String(n),
          "aria-label": (n + 1) + "번 장면"
        });
        pips.appendChild(b);
      });
    }

    function show(next) {
      if (stopped) return;
      index = next;
      if (timer) clearTimeout(timer);
      var row = seq.shots[index];
      var salt = "c" + index + "x" + (++serial);
      var node;
      if (row.card) {
        node = html("div", { class: "cine-card shot" }, [
          html("p", { class: "kicker light" }),
          html("h2", {}),
          html("span", { class: "cine-rule" })
        ]);
        node.querySelector(".kicker").textContent = row.kicker;
        node.querySelector("h2").textContent = row.title;
      } else if (!scenes[row.scene]) {
        node = html("div", { class: "cine-card shot" }, [html("h2", {})]);
        node.querySelector("h2").textContent = row.scene;
      } else {
        node = html("div", { class: "shot" });
        node.appendChild(scenes[row.scene](salt, row, opts));
      }
      stage.appendChild(node);
      if (root.requestAnimationFrame) {
        root.requestAnimationFrame(function () { node.classList.add("on"); });
      } else node.classList.add("on");
      if (prev) {
        prev.classList.remove("on");
        var old = prev;
        setTimeout(function () { if (old.parentNode) old.remove(); }, 700);
      }
      prev = node;
      var leak = frame.querySelector(".leak");
      if (leak) leak.remove();
      if (!reduce) frame.appendChild(html("div", { class: "leak" }));
      frameLabel.textContent = seq.reel + "  " + (index + 1) + "/" + seq.shots.length;
      var text = captionOf(row, opts);
      typeInto(text);
      paintPips();
      cue(row.cue);
      var hold = Math.max(row.hold || 5200, text.length * 28 + 1500);
      timer = setTimeout(advance, hold);
    }

    function advance() {
      if (stopped) return;
      if (index >= seq.shots.length - 1) stop(false);
      else show(index + 1);
    }

    function stop(silent) {
      if (stopped) return;
      stopped = true;
      if (timer) clearTimeout(timer);
      if (typer) clearInterval(typer);
      if (SR.audio && SR.audio.bedStop) {
        try { SR.audio.bedStop(); } catch (e) { /* 이미 꺼짐 */ }
      }
      if (!silent && done) done();
    }

    shell.addEventListener("click", function (e) {
      var b = e.target.closest("[data-cine]");
      if (b) {
        var kind = b.getAttribute("data-cine");
        if (kind === "skip") stop(false);
        else if (kind === "go") show(Number(b.getAttribute("data-index")));
        else advance();
        return;
      }
      advance();
    });

    if (SR.audio && SR.audio.bedStart) {
      try { SR.audio.bedStart(); } catch (e) { /* 소리 장치 없음 */ }
    }
    show(0);
    return { skip: function () { stop(false); }, advance: advance, stop: function () { stop(true); } };
  }

  function lint() {
    var errors = [];
    Object.keys(SEQ).forEach(function (id) {
      SEQ[id].shots.forEach(function (row, i) {
        if (row.card) return;
        if (!scenes[row.scene]) {
          errors.push(id + " missing " + row.scene);
          return;
        }
        try {
          var n = scenes[row.scene]("lint" + id + i, row, { who: "김하늘", alibi: "북원에 있었습니다." });
          if (!n || String(n.nodeName).toLowerCase() !== "svg") errors.push(id + " not-svg " + row.scene);
        } catch (e) {
          errors.push(id + " " + row.scene + " " + (e && e.message));
        }
      });
    });
    return errors;
  }

  function still(host, id, index, opts) {
    var seq = SEQ[id];
    if (!host || !seq || !seq.shots[index]) return null;
    host.textContent = "";
    var row = seq.shots[index];
    var node;
    if (row.card) {
      node = html("div", { class: "cine-card shot on" }, [
        html("p", { class: "kicker light" }),
        html("h2", {})
      ]);
      node.querySelector(".kicker").textContent = row.kicker;
      node.querySelector("h2").textContent = row.title;
    } else {
      node = html("div", { class: "shot on" });
      node.appendChild(scenes[row.scene]("still" + id + index, row, opts || {}));
    }
    host.appendChild(node);
    return { kicker: seq.kicker, title: seq.title, scene: row.scene || "card", caption: captionOf(row, opts || {}) };
  }

  SR.cinema = {
    has: function (id) { return !!SEQ[id]; },
    run: run,
    lint: lint,
    still: still,
    ids: function () { return Object.keys(SEQ); },
    length: function (id) { return SEQ[id] ? SEQ[id].shots.length : 0; }
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
