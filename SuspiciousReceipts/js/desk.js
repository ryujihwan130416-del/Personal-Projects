(function (root) {
  "use strict";
  var SR = root.SR = root.SR || {};
  var h = SR.dom.h;
  var paper = SR.dom.paper;

  function docById(data, id) {
    var i;
    for (i = 0; i < data.docs.length; i++) if (data.docs[i].id === id) return data.docs[i];
    return null;
  }

  function filtered(data, filters) {
    return data.docs.filter(function (doc) {
      if (filters.person) {
        var ids = [doc.personId].concat(doc.personIds || []);
        if (ids.indexOf(filters.person) === -1) return false;
      }
      if (filters.kind && SR.dom.kindGroup(doc.kind) !== filters.kind) return false;
      if (filters.date) {
        var dates = [doc.date].concat((doc.marks || []).map(function (m) { return m.date; }));
        if (dates.indexOf(filters.date) === -1) return false;
      }
      if (filters.q) {
        var blob = SR.dom.norm(doc.title + " " + doc.fields.map(function (f) {
          return f.label + " " + f.value;
        }).join(" "));
        if (blob.indexOf(SR.dom.norm(filters.q)) === -1) return false;
      }
      return true;
    });
  }

  function datesOf(data) {
    var out = [];
    data.docs.forEach(function (doc) {
      [doc.date].concat((doc.marks || []).map(function (m) { return m.date; })).forEach(function (d) {
        if (d && out.indexOf(d) === -1) out.push(d);
      });
    });
    out.sort();
    return out;
  }

  function marksOf(data) {
    var rows = [];
    data.docs.forEach(function (doc) {
      (doc.marks || []).forEach(function (m) {
        if (!m.time) return;
        rows.push({ date: m.date, time: m.time, label: m.label, docId: doc.id });
      });
    });
    rows.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.time < b.time ? -1 : 1;
    });
    return rows;
  }

  function paint(parent, ctx) {
    var data = ctx.data;
    var prog = ctx.progress;
    var ui = ctx.ui;
    var state = ctx.state;
    var closed = prog.status === "closed";
    var list = filtered(data, ui.filters);
    if (ui.cursor >= list.length) ui.cursor = Math.max(0, list.length - 1);

    var need = (data.accusation && data.accusation.requiredFindingIds) || [];
    var haveNeed = need.filter(function (id) { return prog.found.indexOf(id) !== -1; }).length;
    var open = ui.docId ? docById(data, ui.docId) : null;

    var step = tutorialStep(data, ui, prog, state);
    var desk = h("section", { class: "desk" });
    desk.appendChild(header(data, prog, haveNeed, need.length, closed, step));
    if (step) desk.appendChild(coach(step.text));

    var stage = h("div", { class: "desk-stage" });
    stage.appendChild(frame(ui, "list", "서류", listCol(data, list, ui, state, step)));
    stage.appendChild(frame(ui, "read", "열람", readCol(data, open, state, closed, ui, step)));
    stage.appendChild(frame(ui, "time", "시각", timeCol(data)));
    stage.appendChild(frame(ui, "found", "지적", foundCol(data, prog, closed)));
    stage.appendChild(frame(ui, "compare", "대조", compareCol(data, ui, closed, step)));
    stage.appendChild(dock(ui));
    desk.appendChild(stage);
    parent.appendChild(desk);
    bindWindows(stage, ui);
  }

  var WIN_IDS = ["list", "read", "time", "found", "compare"];

  function ensureWins(ui) {
    if (ui.wins) return;
    ui.winZ = 5;
    ui.wins = {
      list: { x: 16, y: 16, w: 300, h: 420, z: 2, open: true, max: false },
      read: { x: 330, y: 16, w: 640, h: 520, z: 3, open: true, max: false },
      time: { x: 16, y: 450, w: 460, h: 240, z: 2, open: true, max: false },
      found: { x: 490, y: 450, w: 480, h: 240, z: 2, open: true, max: false },
      compare: { x: 990, y: 16, w: 340, h: 520, z: 2, open: true, max: false }
    };
  }

  function frame(ui, id, title, body) {
    ensureWins(ui);
    var spec = ui.wins[id];
    var win = h("section", {
      class: "gwin" + (spec.open ? "" : " shut") + (spec.max ? " max" : ""),
      "data-win": id
    });
    win.appendChild(h("div", { class: "gwin-bar" }, [
      h("span", { class: "gwin-title", text: title }),
      h("span", { class: "gwin-tools" }, [
        h("button", {
          class: "gwin-tool",
          type: "button",
          "data-action": "win-max",
          "data-win": id,
          text: spec.max ? "접기" : "펼치기"
        }),
        h("button", {
          class: "gwin-tool gwin-x",
          type: "button",
          "data-action": "win-close",
          "data-win": id,
          text: "닫기"
        })
      ])
    ]));
    var hold = h("div", { class: "gwin-body" });
    hold.appendChild(body);
    win.appendChild(hold);
    win.appendChild(h("div", { class: "gwin-resize", title: "끌어서 크기 조절" }));
    return win;
  }

  function dock(ui) {
    ensureWins(ui);
    var names = { list: "서류", read: "열람", time: "시각", found: "지적", compare: "대조" };
    var bar = h("nav", { class: "gwin-dock", "aria-label": "창" });
    WIN_IDS.forEach(function (id) {
      var on = ui.wins[id].open;
      bar.appendChild(h("button", {
        class: "gwin-dock-btn" + (on ? " on" : ""),
        type: "button",
        "data-action": "win-open",
        "data-win": id,
        text: names[id]
      }));
    });
    return bar;
  }

  function applyGeom(win, spec) {
    win.style.left = spec.x + "px";
    win.style.top = spec.y + "px";
    win.style.width = spec.w + "px";
    win.style.height = spec.h + "px";
    win.style.zIndex = String(spec.z || 1);
  }

  function bindWindows(stage, ui) {
    ensureWins(ui);
    var rect = stage.getBoundingClientRect();
    if (rect.width > 200 && !ui.winsFit) {
      var w = rect.width;
      var hgt = rect.height;
      var dockH = 58;
      ui.wins.list = { x: 12, y: 12, w: Math.round(w * 0.22), h: Math.round(hgt - dockH - 16), z: 2, open: true, max: false };
      ui.wins.read = { x: Math.round(w * 0.24), y: 12, w: Math.round(w * 0.5), h: Math.round(hgt - dockH - 16), z: 2, open: true, max: false };
      ui.wins.compare = { x: Math.round(w * 0.75), y: 12, w: Math.round(w * 0.23), h: Math.round(hgt - dockH - 16), z: 2, open: true, max: false };
      ui.wins.time = { x: Math.round(w * 0.26), y: Math.round(hgt * 0.4), w: Math.round(w * 0.26), h: Math.max(200, Math.round(hgt * 0.4)), z: 6, open: true, max: false };
      ui.wins.found = { x: Math.round(w * 0.5), y: Math.round(hgt * 0.44), w: Math.round(w * 0.24), h: Math.max(200, Math.round(hgt * 0.36)), z: 7, open: true, max: false };
      ui.winsFit = true;
    }
    if (rect.width > 200) {
      WIN_IDS.forEach(function (id) {
        var spec = ui.wins[id];
        if (spec.max && spec.open) {
          spec.x = 10;
          spec.y = 10;
          spec.w = Math.max(280, Math.round(rect.width - 20));
          spec.h = Math.max(200, Math.round(rect.height - 72));
        }
      });
    }
    stage.querySelectorAll(".gwin").forEach(function (win) {
      var id = win.getAttribute("data-win");
      var spec = ui.wins[id];
      if (spec.open) applyGeom(win, spec);
      var bar = win.querySelector(".gwin-bar");
      var grip = win.querySelector(".gwin-resize");
      bar.addEventListener("pointerdown", function (e) {
        if (e.target.closest("button")) return;
        e.preventDefault();
        raiseWin(ui, id, stage);
        if (spec.max) spec.max = false;
        var sx = e.clientX;
        var sy = e.clientY;
        var ox = spec.x;
        var oy = spec.y;
        bar.setPointerCapture(e.pointerId);
        function move(ev) {
          spec.x = Math.max(0, Math.min(stage.clientWidth - 120, ox + ev.clientX - sx));
          spec.y = Math.max(0, Math.min(stage.clientHeight - 64, oy + ev.clientY - sy));
          applyGeom(win, spec);
        }
        function up() {
          bar.removeEventListener("pointermove", move);
          bar.removeEventListener("pointerup", up);
        }
        bar.addEventListener("pointermove", move);
        bar.addEventListener("pointerup", up);
      });
      grip.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        e.stopPropagation();
        raiseWin(ui, id, stage);
        spec.max = false;
        var sx = e.clientX;
        var sy = e.clientY;
        var ow = spec.w;
        var oh = spec.h;
        grip.setPointerCapture(e.pointerId);
        function move(ev) {
          spec.w = Math.max(240, Math.min(stage.clientWidth - spec.x, ow + ev.clientX - sx));
          spec.h = Math.max(180, Math.min(stage.clientHeight - spec.y - 8, oh + ev.clientY - sy));
          applyGeom(win, spec);
        }
        function up() {
          grip.removeEventListener("pointermove", move);
          grip.removeEventListener("pointerup", up);
        }
        grip.addEventListener("pointermove", move);
        grip.addEventListener("pointerup", up);
      });
    });
  }

  function raiseWin(ui, id, stage) {
    ui.winZ = (ui.winZ || 5) + 1;
    ui.wins[id].z = ui.winZ;
    var win = stage.querySelector('.gwin[data-win="' + id + '"]');
    if (win) win.style.zIndex = String(ui.winZ);
  }

  function tutorialDone(step, data, ui, prog, state) {
    if (step.until === "seen") return state.seen.indexOf(data.id + ":" + step.doc) !== -1;
    if (step.until === "pin") return ui.pins.indexOf(step.doc) !== -1;
    if (step.until === "found") return prog.found.indexOf(step.id) !== -1;
    if (step.until === "closed") return prog.status === "closed";
    return true;
  }

  function tutorialStep(data, ui, prog, state) {
    var steps = data.tutorial;
    if (!steps || prog.status === "closed") return null;
    var i;
    for (i = 0; i < steps.length; i++) {
      if (!tutorialDone(steps[i], data, ui, prog, state)) return steps[i];
    }
    return null;
  }

  function tutorClass(step, key) {
    return step && step.pulse === key ? " tutor" : "";
  }

  function header(data, prog, haveNeed, needCount, closed, step) {
    var chips = [
      h("span", { class: "chip", text: data.difficulty }),
      h("span", { class: "chip", id: "play-clock", text: "" })
    ];
    if (needCount) chips.push(h("span", { class: "chip" + (haveNeed === needCount ? " ready" : ""), text: "필수 " + haveNeed + "/" + needCount }));
    else chips.push(h("span", { class: "chip", text: closed ? "마감" : "의견서" }));
    chips.push(h("span", { class: "chip score-chip", text: "점수 " + SR.store.scoreOf(prog) }));
    return h("header", { class: "desk-bar" }, [
      h("div", { class: "bar-title" }, [
        h("p", { class: "kicker", text: "한빛지방국세청 · 특별조사2계" }),
        h("h1", { text: data.title }),
        h("p", { class: "question", text: data.question })
      ]),
      h("div", { class: "bar-actions" }, chips.concat([
        h("button", { class: "btn-hint" + tutorClass(step, "hint"), type: "button", "data-action": "hint" }, [
          h("span", { class: "hint-word", text: "힌트" }),
          h("span", { class: "hint-cost", text: "-" + SR.store.HINT_COST })
        ]),
        h("button", { class: "btn btn-on-dark", type: "button", "data-action": "manual", text: "매뉴얼" }),
        h("button", { class: "btn btn-on-dark", type: "button", "data-action": "people", text: "인물" }),
        h("button", { class: "btn btn-on-dark", type: "button", "data-action": "notebook", text: "수첩" }),
        h("button", { class: "btn btn-on-dark", type: "button", "data-action": "save", text: "저장" }),
        h("button", { class: "btn btn-on-dark" + (needCount && haveNeed === needCount ? " ready" : "") + tutorClass(step, "report"), type: "button", "data-action": "report", text: data.accusation ? "보고서" : "의견서" }),
        h("button", { class: "btn btn-on-dark", type: "button", "data-action": "folders", text: "철로" })
      ]))
    ]);
  }

  function coach(text) {
    return h("div", { class: "coach", role: "status" }, [
      h("p", { text: "견습  " + text })
    ]);
  }

  function listCol(data, list, ui, state, step) {
    var dates = datesOf(data);
    var col = h("aside", { class: "col list-col" });
    var tools = h("div", { class: "filters" });
    tools.appendChild(select("filter-person", "사람", [{ value: "", label: "전체" }].concat(data.people.map(function (p) {
      return { value: p.id, label: p.name };
    })), ui.filters.person));
    tools.appendChild(select("filter-kind", "종류", [
      { value: "", label: "전체" },
      { value: "영수증", label: "영수증" },
      { value: "내역서", label: "내역서" },
      { value: "기록", label: "기록" },
      { value: "등록", label: "등록" }
    ], ui.filters.kind));
    tools.appendChild(select("filter-date", "날짜", [{ value: "", label: "전체" }].concat(dates.map(function (d) {
      return { value: d, label: d.slice(5) };
    })), ui.filters.date));
    tools.appendChild(h("input", {
      id: "doc-search",
      class: "search",
      type: "search",
      placeholder: "상호, 금액, 번호",
      value: ui.filters.q,
      "aria-label": "서류 검색"
    }));
    col.appendChild(tools);
    var box = h("div", { class: "doc-list", "data-scroll": "list", role: "listbox", "aria-label": "서류 목록" });
    if (!list.length) box.appendChild(h("p", { class: "empty", text: "해당하는 서류가 없습니다." }));
    list.forEach(function (doc, i) {
      var seen = state.seen.indexOf(data.id + ":" + doc.id) !== -1;
      var btn = h("button", {
        class: "doc-item" + (ui.docId === doc.id ? " open" : "") + (i === ui.cursor ? " cursor" : "") + tutorClass(step, "doc:" + doc.id),
        type: "button",
        role: "option",
        "data-action": "open-doc",
        "data-doc": doc.id,
        "aria-selected": ui.docId === doc.id ? "true" : "false"
      }, [
        h("span", { class: "doc-kind", text: SR.dom.kindGroup(doc.kind) }),
        h("span", { class: "doc-name", text: doc.title }),
        h("span", { class: "doc-meta", text: (doc.date || "") + (seen ? "" : "  · 안 읽음") })
      ]);
      box.appendChild(btn);
    });
    col.appendChild(box);
    return col;
  }

  function select(id, label, options, value) {
    var wrap = h("label", { class: "filter" }, [h("span", { text: label })]);
    var sel = h("select", { id: id });
    options.forEach(function (o) {
      var opt = h("option", { value: o.value, text: o.label });
      if (o.value === value) opt.selected = true;
      sel.appendChild(opt);
    });
    wrap.appendChild(sel);
    return wrap;
  }

  function readCol(data, open, state, closed, ui, step) {
    var col = h("main", { class: "col read-col" });
    var brief = h("details", { class: "brief", open: ui.briefOpen === false ? null : "open" });
    brief.appendChild(h("summary", { text: "과장 지시" }));
    brief.appendChild(h("p", { text: data.briefing }));
    col.appendChild(brief);
    var stage = h("div", { class: "paper-stage", "data-scroll": "paper" });
    if (!open) {
      stage.appendChild(h("p", { class: "empty big", text: "왼쪽에서 서류를 고르십시오." }));
    } else {
      stage.appendChild(paper(open));
      var scrapped = state.scraps.some(function (s) { return s.caseId === data.id && s.docId === open.id; });
      stage.appendChild(h("div", { class: "paper-actions" }, [
        h("button", { class: "btn" + (step && step.pulse === "pin" && open && step.doc === open.id ? " tutor" : ""), type: "button", "data-action": "pin", "data-doc": open.id, text: "대조에 올리기" }),
        h("button", { class: "btn", type: "button", "data-action": "scrap", text: scrapped ? "수첩에 있음" : "수첩에 남기기" })
      ]));
      if (closed) stage.appendChild(h("p", { class: "closed-note", text: "이 철은 종결되었습니다. 서류는 다시 읽을 수 있고, 새 지적만 닫혀 있습니다." }));
    }
    col.appendChild(stage);
    var memo = h("label", { class: "memo" }, [
      h("span", { text: "사건 메모" }),
      h("textarea", { id: "case-memo", rows: "2", placeholder: "채점하지 않습니다. 이 브라우저에 남습니다." }, [state.memos[data.id] || ""])
    ]);
    col.appendChild(memo);
    return col;
  }

  function timeCol(data) {
    var col = h("aside", { class: "col time-col" });
    var time = h("div", { class: "timeline", "data-scroll": "time" });
    var rows = marksOf(data);
    var lastDate = "";
    if (!rows.length) time.appendChild(h("p", { class: "empty", text: "시각이 있는 서류가 없습니다." }));
    rows.forEach(function (row) {
      if (row.date !== lastDate) {
        lastDate = row.date;
        time.appendChild(h("p", { class: "time-date", text: row.date }));
      }
      time.appendChild(h("button", {
        class: "time-item",
        type: "button",
        "data-action": "open-doc",
        "data-doc": row.docId
      }, [
        h("span", { class: "time-hh", text: row.time }),
        h("span", { text: row.label })
      ]));
    });
    col.appendChild(time);
    return col;
  }

  function foundCol(data, prog, closed) {
    var col = h("aside", { class: "col found-col" });
    var found = h("div", { class: "found-list", "data-scroll": "found" });
    if (!prog.found.length) found.appendChild(h("p", { class: "empty", text: "아직 없습니다." }));
    prog.found.forEach(function (id) {
      var f = null;
      var i;
      for (i = 0; i < data.findings.length; i++) if (data.findings[i].id === id) f = data.findings[i];
      if (!f) return;
      var card = h("article", { class: "found-card" }, [
        h("p", { class: "found-type", text: f.type + (f.optional ? "  · 선택" : "  · 필수") }),
        h("p", { text: f.why })
      ]);
      if (prog.notes[id]) card.appendChild(h("p", { class: "found-note", text: prog.notes[id] }));
      found.appendChild(card);
    });
    var hintLevel = Math.max(prog.hintLevel || 0, prog.rejects >= 4 ? 2 : prog.rejects >= 2 ? 1 : 0);
    if (hintLevel && data.hints && data.hints.length) {
      var slip = h("article", { class: "hint-slip" }, [
        h("p", { class: "found-type", text: "과장 메모" })
      ]);
      data.hints.slice(0, hintLevel).forEach(function (text) {
        slip.appendChild(h("p", { text: text }));
      });
      found.appendChild(slip);
    }
    if (closed && data.epilogue) {
      found.appendChild(h("button", { class: "btn", type: "button", "data-action": "epilogue", text: "종결 메모" }));
    }
    col.appendChild(found);
    return col;
  }

  function compareCol(data, ui, closed, step) {
    var bar = h("footer", { class: "compare" });
    var slots = h("div", { class: "slots" });
    if (!ui.pins.length) slots.appendChild(h("p", { class: "empty", text: "최대 3장. 모순에 필요한 서류만 올리십시오." }));
    ui.pins.forEach(function (id) {
      var doc = docById(data, id);
      if (!doc) return;
      var slot = h("div", { class: "slot" });
      slot.appendChild(paper(doc, { compact: true }));
      slot.appendChild(h("button", { class: "btn tiny", type: "button", "data-action": "unpin", "data-doc": id, text: "빼기" }));
      slots.appendChild(slot);
    });
    bar.appendChild(slots);
    var form = h("form", { class: "file-form", action: "#" });
    var sel = h("select", { id: "filing-type", class: tutorClass(step, "file").trim(), "aria-label": "모순 유형", disabled: closed ? "disabled" : null });
    SR.manual.types.forEach(function (t) {
      var opt = h("option", { value: t, text: t });
      if (t === ui.filingType) opt.selected = true;
      sel.appendChild(opt);
    });
    form.appendChild(sel);
    form.appendChild(h("input", {
      id: "filing-note",
      type: "text",
      maxlength: "80",
      placeholder: "메모는 채점하지 않습니다",
      value: ui.filingNote,
      disabled: closed ? "disabled" : null,
      "aria-label": "지적 메모"
    }));
    form.appendChild(h("button", {
      class: "btn primary" + tutorClass(step, "file"),
      type: "button",
      "data-action": "file",
      disabled: closed ? "disabled" : null,
      text: "지적 올리기"
    }));
    bar.appendChild(form);
    return bar;
  }

  SR.desk = { paint: paint, filtered: filtered, docById: docById };
})(typeof globalThis !== "undefined" ? globalThis : this);
