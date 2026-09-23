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

    var desk = h("section", { class: "desk" });
    desk.appendChild(header(data, haveNeed, need.length, closed));
    if (!state.coachSeen && data.id === "case01") desk.appendChild(coach());

    var body = h("div", { class: "desk-body" });
    body.appendChild(listCol(data, list, ui, state));
    body.appendChild(readCol(data, open, state, closed, ui));
    body.appendChild(sideCol(data, prog, closed));
    desk.appendChild(body);
    desk.appendChild(compareCol(data, ui, closed));
    parent.appendChild(desk);
  }

  function header(data, haveNeed, needCount, closed) {
    var chips = [
      h("span", { class: "chip", text: data.difficulty }),
      h("span", { class: "chip", id: "play-clock", text: "" })
    ];
    if (needCount) chips.push(h("span", { class: "chip" + (haveNeed === needCount ? " ready" : ""), text: "필수 " + haveNeed + "/" + needCount }));
    else chips.push(h("span", { class: "chip", text: closed ? "마감" : "의견서" }));
    return h("header", { class: "desk-bar" }, [
      h("div", { class: "bar-title" }, [
        h("p", { class: "kicker", text: "한빛지방국세청 · 특별조사2계" }),
        h("h1", { text: data.title }),
        h("p", { class: "question", text: data.question })
      ]),
      h("div", { class: "bar-actions" }, chips.concat([
        h("button", { class: "btn btn-on-dark", type: "button", "data-action": "manual", text: "매뉴얼" }),
        h("button", { class: "btn btn-on-dark", type: "button", "data-action": "people", text: "인물" }),
        h("button", { class: "btn btn-on-dark", type: "button", "data-action": "notebook", text: "수첩" }),
        h("button", { class: "btn btn-on-dark", type: "button", "data-action": "save", text: "저장" }),
        h("button", { class: "btn btn-on-dark" + (needCount && haveNeed === needCount ? " ready" : ""), type: "button", "data-action": "report", text: data.accusation ? "보고서" : "의견서" }),
        h("button", { class: "btn btn-on-dark", type: "button", "data-action": "folders", text: "철로" })
      ]))
    ]);
  }

  function coach() {
    return h("div", { class: "coach" }, [
      h("p", { text: "서류를 열고, 대조에 올린 뒤, 모순 유형을 골라 지적하십시오. 필요한 장만 올려야 합니다." }),
      h("button", { class: "btn", type: "button", "data-action": "dismiss-coach", text: "알겠습니다" })
    ]);
  }

  function listCol(data, list, ui, state) {
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
        class: "doc-item" + (ui.docId === doc.id ? " open" : "") + (i === ui.cursor ? " cursor" : ""),
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

  function readCol(data, open, state, closed, ui) {
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
        h("button", { class: "btn", type: "button", "data-action": "pin", "data-doc": open.id, text: "대조에 올리기" }),
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
    if (prog.rejects >= 2 && data.hints && data.hints.length) {
      found.appendChild(h("article", { class: "hint-slip" }, [
        h("p", { class: "found-type", text: "과장 메모" }),
        h("p", { text: data.hints[0] }),
        prog.rejects >= 4 && data.hints[1] ? h("p", { text: data.hints[1] }) : null
      ]));
    }
    if (closed && data.epilogue) {
      found.appendChild(h("button", { class: "btn", type: "button", "data-action": "epilogue", text: "종결 메모" }));
    }
    col.appendChild(found);
    return col;
  }

  function compareCol(data, ui, closed) {
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
    var sel = h("select", { id: "filing-type", "aria-label": "모순 유형", disabled: closed ? "disabled" : null });
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
      class: "btn primary",
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
