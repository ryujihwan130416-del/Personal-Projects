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

    ensureLay(ui, data);
    var view = h("div", { class: "desk-view" });
    var world = h("div", { class: "desk-world" });
    world.appendChild(scenery());
    world.appendChild(computer(data, list, ui, state, prog, closed, step));
    var shown = {};
    list.forEach(function (doc) { shown[doc.id] = true; });
    data.docs.forEach(function (doc) {
      world.appendChild(slip(doc, data, ui, state, closed, step, !!shown[doc.id]));
    });
    view.appendChild(world);
    view.appendChild(h("div", { class: "zoom-bar" }, [
      h("button", { type: "button", class: "zoom-btn", "data-zoom": "in", text: "확대" }),
      h("button", { type: "button", class: "zoom-btn", "data-zoom": "out", text: "축소" }),
      h("button", { type: "button", class: "zoom-btn", "data-zoom": "fit", text: "책상 전체" })
    ]));
    desk.appendChild(view);
    parent.appendChild(desk);
    bindDesk(view, world, ui);
  }

  var DESK_W = 1760;
  var DESK_H = 1080;

  function ensureLay(ui, data) {
    if (!ui.view) ui.view = { scale: 0.45, x: 20, y: 12, ready: false };
    if (ui.paperCase === data.id && ui.papers) return;
    ui.paperCase = data.id;
    ui.papers = {};
    ui.slipZ = 4;
    data.docs.forEach(function (doc, i) {
      var col = i % 4;
      var row = Math.floor(i / 4);
      ui.papers[doc.id] = {
        x: 640 + col * 260 + (i % 2) * 18,
        y: 70 + row * 250,
        rot: Math.round((Math.random() * 30 - 15) * 10) / 10,
        z: i + 2
      };
    });
  }

  function scenery() {
    var now = new Date();
    var hour = (now.getHours() % 12) * 30 + now.getMinutes() * 0.5;
    var minute = now.getMinutes() * 6;
    return h("div", { class: "scenery", "aria-hidden": "true" }, [
      h("div", { class: "lamp" }),
      h("div", { class: "clock" }, [
        h("span", { class: "clock-face" }),
        h("i", { class: "hand hour", style: "transform:rotate(" + hour + "deg)" }),
        h("i", { class: "hand min", style: "transform:rotate(" + minute + "deg)" })
      ]),
      h("div", { class: "pencil a" }),
      h("div", { class: "pencil b" }),
      h("div", { class: "pencil c" }),
      h("div", { class: "mug" }),
      h("div", { class: "stamp-pad" }, [h("span", { text: "착수" })])
    ]);
  }

  function computer(data, list, ui, state, prog, closed, step) {
    var screen = h("div", { class: "screen" });
    screen.appendChild(h("p", { class: "screen-kicker", text: "단말기  ·  특별조사2계" }));
    screen.appendChild(h("p", { class: "screen-brief", text: data.briefing }));
    screen.appendChild(listCol(data, list, ui, state, step));
    screen.appendChild(sideCol(data, prog, closed));
    screen.appendChild(compareCol(data, ui, closed, step));
    screen.appendChild(h("label", { class: "memo" }, [
      h("span", { text: "사건 메모" }),
      h("textarea", { id: "case-memo", rows: "2", placeholder: "채점하지 않습니다. 이 브라우저에 남습니다." }, [state.memos[data.id] || ""])
    ]));
    return h("section", { class: "monitor" }, [
      h("div", { class: "bezel" }, [screen]),
      h("div", { class: "stand" }),
      h("div", { class: "keyboard" }),
      h("div", { class: "mouse" })
    ]);
  }

  function slip(doc, data, ui, state, closed, step, shown) {
    var spec = ui.papers[doc.id];
    var node = h("article", {
      class: "slip" + (ui.docId === doc.id ? " picked" : "") + (shown ? "" : " dim") + tutorClass(step, "doc:" + doc.id),
      "data-slip": doc.id,
      "data-action": "open-doc",
      "data-doc": doc.id
    });
    node.style.left = spec.x + "px";
    node.style.top = spec.y + "px";
    node.style.zIndex = String(spec.z);
    node.style.transform = "rotate(" + spec.rot + "deg)";
    node.appendChild(paper(doc));
    if (ui.docId === doc.id) {
      var scrapped = state.scraps.some(function (s) { return s.caseId === data.id && s.docId === doc.id; });
      node.appendChild(h("div", { class: "slip-actions" }, [
        h("button", { class: "btn tiny" + tutorClass(step, "pin"), type: "button", "data-action": "pin", "data-doc": doc.id, text: "대조에 올리기" }),
        h("button", { class: "btn tiny", type: "button", "data-action": "scrap", text: scrapped ? "수첩에 있음" : "수첩에 남기기" })
      ]));
      if (closed) node.appendChild(h("p", { class: "closed-note", text: "종결된 철입니다." }));
    }
    return node;
  }

  function applyView(world, ui) {
    var v = ui.view;
    world.style.transform = "translate(" + v.x + "px," + v.y + "px) scale(" + v.scale + ")";
  }

  function fitDesk(view, ui) {
    var rect = view.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 40) return;
    var scale = Math.min(rect.width / DESK_W, rect.height / DESK_H);
    ui.view.min = scale;
    ui.view.scale = scale;
    ui.view.x = (rect.width - DESK_W * scale) / 2;
    ui.view.y = (rect.height - DESK_H * scale) / 2;
  }

  function zoomAt(view, ui, next, clientX, clientY) {
    var rect = view.getBoundingClientRect();
    var min = ui.view.min || 0.2;
    next = Math.max(min, Math.min(1.7, next));
    var wx = (clientX - rect.left - ui.view.x) / ui.view.scale;
    var wy = (clientY - rect.top - ui.view.y) / ui.view.scale;
    ui.view.scale = next;
    ui.view.x = clientX - rect.left - wx * next;
    ui.view.y = clientY - rect.top - wy * next;
  }

  function bindDesk(view, world, ui) {
    if (!ui.view.ready) {
      fitDesk(view, ui);
      ui.view.ready = true;
    }
    applyView(world, ui);
    view.querySelectorAll("[data-zoom]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var kind = btn.getAttribute("data-zoom");
        var rect = view.getBoundingClientRect();
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        if (kind === "fit") fitDesk(view, ui);
        else zoomAt(view, ui, ui.view.scale * (kind === "in" ? 1.2 : 1 / 1.2), cx, cy);
        applyView(world, ui);
      });
    });
    view.addEventListener("wheel", function (e) {
      if (e.target.closest(".screen")) return;
      e.preventDefault();
      var factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      zoomAt(view, ui, ui.view.scale * factor, e.clientX, e.clientY);
      applyView(world, ui);
    }, { passive: false });
    view.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".slip") || e.target.closest(".monitor") || e.target.closest(".zoom-bar") || e.target.closest("button, input, select, textarea, a")) return;
      var sx = e.clientX;
      var sy = e.clientY;
      var ox = ui.view.x;
      var oy = ui.view.y;
      view.setPointerCapture(e.pointerId);
      function move(ev) {
        ui.view.x = ox + ev.clientX - sx;
        ui.view.y = oy + ev.clientY - sy;
        applyView(world, ui);
      }
      function up() {
        view.removeEventListener("pointermove", move);
        view.removeEventListener("pointerup", up);
      }
      view.addEventListener("pointermove", move);
      view.addEventListener("pointerup", up);
    });
    world.querySelectorAll(".slip").forEach(function (node) {
      var id = node.getAttribute("data-slip");
      var spec = ui.papers[id];
      node.addEventListener("pointerdown", function (e) {
        if (e.target.closest("button")) return;
        e.stopPropagation();
        ui.slipZ = (ui.slipZ || 4) + 1;
        spec.z = ui.slipZ;
        node.style.zIndex = String(spec.z);
        var sx = e.clientX;
        var sy = e.clientY;
        var ox = spec.x;
        var oy = spec.y;
        var dragged = false;
        node.setPointerCapture(e.pointerId);
        function move(ev) {
          var dx = ev.clientX - sx;
          var dy = ev.clientY - sy;
          if (dx * dx + dy * dy > 16) dragged = true;
          spec.x = Math.max(20, Math.min(DESK_W - 220, ox + dx / ui.view.scale));
          spec.y = Math.max(16, Math.min(DESK_H - 80, oy + dy / ui.view.scale));
          node.style.left = spec.x + "px";
          node.style.top = spec.y + "px";
        }
        function up(ev) {
          node.removeEventListener("pointermove", move);
          node.removeEventListener("pointerup", up);
          if (dragged) {
            node.dataset.dragged = "1";
            ev.preventDefault();
            ev.stopPropagation();
          }
        }
        node.addEventListener("pointermove", move);
        node.addEventListener("pointerup", up);
      });
      node.addEventListener("click", function (e) {
        if (node.dataset.dragged === "1") {
          e.preventDefault();
          e.stopPropagation();
          node.dataset.dragged = "";
        }
      });
    });
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
    col.appendChild(h("h2", { text: "서류" }));
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

  function sideCol(data, prog, closed) {
    var col = h("aside", { class: "col side-col" });
    col.appendChild(h("h2", { text: "타임라인" }));
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
    col.appendChild(h("h2", { text: "인정된 지적" }));
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
    bar.appendChild(h("h2", { text: "대조" }));
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
