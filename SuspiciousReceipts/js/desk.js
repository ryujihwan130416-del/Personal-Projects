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
    var plane = h("div", { class: "desk-plane" });
    plane.appendChild(props(state));
    plane.appendChild(notebook());
    plane.appendChild(laptop());
    plane.appendChild(drawer(data, list, ui, step));
    var shown = {};
    list.forEach(function (doc) { shown[doc.id] = true; });
    data.docs.forEach(function (doc) {
      if (!ui.out[doc.id]) return;
      plane.appendChild(slip(doc, data, ui, state, closed, step, !!shown[doc.id]));
    });
    world.appendChild(plane);
    view.appendChild(world);
    desk.appendChild(pcPop(data, ui, prog, closed, step));
    desk.appendChild(notePop(ui, state, data));
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
    ui.out = {};
    ui.slipZ = 4;
    ui.drawerOpen = false;
  }

  function pullOut(ui, id) {
    if (!ui.out) ui.out = {};
    if (!ui.papers) ui.papers = {};
    ui.out[id] = true;
    if (!ui.papers[id]) {
      ui.slipZ = (ui.slipZ || 4) + 1;
      ui.papers[id] = {
        x: 640 + Math.round(Math.random() * 260),
        y: 360 + Math.round(Math.random() * 160),
        rot: Math.round((Math.random() * 30 - 15) * 10) / 10,
        z: ui.slipZ
      };
    }
  }

  function props(state) {
    var bits = [];
    if (!state.coffeeGone) {
      bits.push(h("button", { type: "button", class: "mug-set", "data-action": "egg", "data-egg": "coffee", "aria-label": "커피" }, [
        h("div", { class: "saucer" }),
        h("div", { class: "cup" }, [h("div", { class: "coffee" })])
      ]));
    }
    bits.push(h("div", { class: "pen", "aria-hidden": "true" }));
    bits.push(h("button", {
      type: "button",
      class: "pencil" + (state.pencilBroken ? " broken" : ""),
      "data-action": "egg",
      "data-egg": "pencil",
      "aria-label": "노란 연필"
    }));
    if (state.pencilBroken) bits.push(h("span", { class: "pencil-bit", "aria-hidden": "true" }));
    bits.push(h("div", { class: "pencil spare", "aria-hidden": "true" }));
    bits.push(h("button", { type: "button", class: "eraser", "data-action": "egg", "data-egg": "eraser", "aria-label": "지우개" }));
    return h("div", { class: "scenery" }, bits);
  }

  function notebook() {
    return h("button", { type: "button", class: "nb", "data-action": "notebook", "aria-label": "수첩" }, [
      h("span", { class: "nb-band" }),
      h("span", { class: "nb-label", text: "수첩" })
    ]);
  }

  function keyRow(widths) {
    return h("div", { class: "key-row" }, widths.map(function (w) {
      if (!w) return h("i", { class: "key-gap" });
      return h("i", { class: "key" + (w > 1.5 ? " wide" : ""), style: "flex:" + w + " 1 0" });
    }));
  }

  function keyboard() {
    return h("div", { class: "pc-board", "aria-hidden": "true" }, [
      h("div", { class: "pc-main" }, [
        keyRow([1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1]),
        keyRow([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2]),
        keyRow([1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5]),
        keyRow([1.7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.9]),
        keyRow([2.2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.2]),
        keyRow([1.3, 1.2, 1.2, 6, 1.3, 1.3, 1.2, 1.3])
      ]),
      h("div", { class: "pc-side" }, [
        keyRow([1, 1, 1]),
        keyRow([1, 1, 1]),
        keyRow([1, 1, 1]),
        keyRow([1, 1, 1])
      ]),
      h("div", { class: "pc-num" }, [
        keyRow([1, 1, 1, 1]),
        keyRow([1, 1, 1, 1]),
        keyRow([1, 1, 1, 1]),
        keyRow([1, 1, 1, 1]),
        keyRow([2, 1])
      ])
    ]);
  }

  function laptop() {
    return h("button", { type: "button", class: "laptop", "data-pc": "open", "aria-label": "컴퓨터 열기" }, [
      h("div", { class: "pc-monitor" }, [
        h("div", { class: "pc-glass" })
      ]),
      h("div", { class: "pc-neck" }),
      h("div", { class: "pc-desk" }, [
        keyboard(),
        h("div", { class: "pc-mouse" })
      ])
    ]);
  }

  function drawer(data, list, ui, step) {
    var waiting = step && step.pulse && step.pulse.indexOf("doc:") === 0 && !ui.out[step.pulse.slice(4)];
    var face = h("button", {
      type: "button",
      class: "drawer-face" + (waiting ? " tutor" : ""),
      "data-action": "draw-toggle",
      text: "서랍"
    });
    var bin = h("div", { class: "drawer-bin" });
    bin.appendChild(h("p", { class: "drawer-title", text: "꺼낼 서류" }));
    var any = false;
    list.forEach(function (doc) {
      if (ui.out[doc.id]) return;
      any = true;
      bin.appendChild(h("button", {
        type: "button",
        class: "drawer-doc" + tutorClass(step, "doc:" + doc.id),
        "data-action": "draw-out",
        "data-doc": doc.id
      }, [
        h("span", { class: "doc-kind", text: SR.dom.kindGroup(doc.kind) }),
        h("span", { text: doc.title })
      ]));
    });
    if (!any) bin.appendChild(h("p", { class: "empty", text: "서랍이 비었습니다. 책상 위의 서류를 여기로 끌어 넣으십시오." }));
    return h("aside", { class: "drawer" + (ui.drawerOpen ? " open" : "") }, [face, bin]);
  }

  function notePop(ui, state, data) {
    return h("div", { class: "note-pop" + (ui.noteOpen ? "" : " shut") }, [
      h("div", { class: "note-card" }, [
        h("div", { class: "pc-top" }, [
          h("span", { text: "공책" }),
          h("button", { type: "button", class: "pc-x", "data-action": "note-close", text: "닫기" })
        ]),
        h("label", { class: "memo" }, [
          h("span", { text: "이 철의 메모. 채점하지 않습니다." }),
          h("textarea", { id: "case-memo", rows: "8", placeholder: "이 브라우저에 남습니다." }, [state.memos[data.id] || ""])
        ])
      ])
    ]);
  }

  function pcPop(data, ui, prog, closed, step) {
    ui.pcTab = ui.pcTab || "files";
    ui.pcDoc = ui.pcDoc || data.docs[0].id;
    var screen = h("div", { class: "screen" });
    var nav = h("nav", { class: "pc-nav", "aria-label": "노트북 메뉴" }, [
      h("p", { class: "pc-user", text: "특별조사2계" }),
      pcTabButton("files", "사건 파일", ui.pcTab),
      pcTabButton("time", "시간 기록", ui.pcTab),
      pcTabButton("report", "대조·의견", ui.pcTab, true)
    ]);
    var work = h("div", { class: "pc-work" });
    work.appendChild(pcFiles(data, ui));
    var timePane = h("section", {
      class: "pc-pane" + (ui.pcTab === "time" ? " active" : ""),
      "data-pc-pane": "time"
    }, [
      h("div", { class: "pc-path", text: "내 컴퓨터  >  사건 기록  >  시간 기록" })
    ]);
    timePane.appendChild(sideCol(data, prog, closed));
    work.appendChild(timePane);
    var reportPane = h("section", {
      class: "pc-pane" + (ui.pcTab === "report" ? " active" : ""),
      "data-pc-pane": "report"
    }, [
      h("div", { class: "pc-path", text: "내 컴퓨터  >  조사 도구  >  대조·의견" }),
      h("article", { class: "pc-brief" }, [
        h("strong", { text: data.title }),
        h("p", { text: data.question }),
        h("p", { text: data.briefing })
      ])
    ]);
    reportPane.appendChild(compareCol(data, ui, closed, step));
    work.appendChild(reportPane);
    screen.appendChild(nav);
    screen.appendChild(work);
    return h("div", { class: "pc-pop" + (ui.pcOpen ? "" : " shut") }, [
      h("div", { class: "pc-frame" }, [
        h("div", { class: "pc-top" }, [
          h("span", { text: "한빛 업무용 노트북  ·  파일 탐색기" }),
          h("button", { type: "button", class: "pc-x", "data-pc": "close", text: "닫기" })
        ]),
        screen
      ])
    ]);
  }

  function pcTabButton(id, label, active, drop) {
    return h("button", {
      type: "button",
      class: "pc-nav-btn" + (active === id ? " active" : ""),
      "data-pc-tab": id,
      "data-drop": drop ? "pin" : null,
      "data-drop-tab": drop ? id : null
    }, [
      h("span", { class: "pc-folder", "aria-hidden": "true" }),
      h("span", { text: label })
    ]);
  }

  function pcFiles(data, ui) {
    var pane = h("section", {
      class: "pc-pane pc-files" + (ui.pcTab === "files" ? " active" : ""),
      "data-pc-pane": "files"
    });
    pane.appendChild(h("div", { class: "pc-path", text: "내 컴퓨터  >  조사철  >  " + data.title }));
    var browser = h("div", { class: "pc-browser" });
    var list = h("div", { class: "pc-file-list" });
    data.docs.forEach(function (doc) {
      list.appendChild(h("button", {
        type: "button",
        class: "pc-file" + (ui.pcDoc === doc.id ? " active" : ""),
        draggable: "true",
        "data-pc-doc": doc.id,
        "data-drag-doc": doc.id
      }, [
        h("span", { class: "pc-file-icon", text: SR.dom.kindGroup(doc.kind).slice(0, 1) }),
        h("span", { class: "pc-file-name", text: doc.title }),
        h("span", { class: "pc-file-date", text: doc.date || "날짜 없음" })
      ]));
    });
    var previews = h("div", { class: "pc-previews" });
    data.docs.forEach(function (doc) {
      previews.appendChild(h("div", {
        class: "pc-preview" + (ui.pcDoc === doc.id ? " active" : ""),
        "data-pc-preview": doc.id
      }, [paper(doc)]));
    });
    browser.appendChild(list);
    browser.appendChild(previews);
    pane.appendChild(browser);
    pane.appendChild(pinTray(data, ui));
    return pane;
  }

  function pinTray(data, ui) {
    var tray = h("div", { class: "pc-tray", "data-drop": "pin" });
    tray.appendChild(h("p", { class: "pc-tray-label", text: "대조" }));
    var row = h("div", { class: "pc-tray-row" });
    if (!ui.pins.length) row.appendChild(h("p", { class: "pc-tray-hint", text: "파일을 여기로 끌어 놓으십시오." }));
    ui.pins.forEach(function (id) {
      var doc = docById(data, id);
      if (!doc) return;
      row.appendChild(h("span", { class: "pc-chip", text: doc.title }));
    });
    var left = 3 - ui.pins.length;
    var i;
    for (i = 0; i < left; i++) row.appendChild(h("span", { class: "pc-slot", text: "빈 칸" }));
    tray.appendChild(row);
    return tray;
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
    var angle = ((spec.rot % 360) + 360) % 360;
    var side = (angle > 45 && angle < 135) || (angle > 225 && angle < 315);
    var sheet = h("div", { class: "slip-sheet" });
    sheet.style.transform = "rotate(" + spec.rot + "deg)";
    sheet.appendChild(paper(doc));
    node.appendChild(sheet);
    if (side) node.classList.add("side");
    if (ui.docId === doc.id) {
      var scrapped = state.scraps.some(function (s) { return s.caseId === data.id && s.docId === doc.id; });
      var actions = h("div", { class: "slip-actions" }, [
        h("button", { class: "btn tiny", type: "button", "data-action": "turn", "data-doc": doc.id, text: "돌리기" }),
        h("button", { class: "btn tiny" + tutorClass(step, "pin"), type: "button", "data-action": "pin", "data-doc": doc.id, text: "대조에 올리기" }),
        h("button", { class: "btn tiny", type: "button", "data-action": "scrap", text: scrapped ? "수첩에 있음" : "수첩에 남기기" }),
        h("button", { class: "btn tiny", type: "button", "data-action": "draw-in", "data-doc": doc.id, text: "서랍에 넣기" })
      ]);
      if (closed) actions.appendChild(h("p", { class: "closed-note", text: "종결된 철입니다." }));
      node.appendChild(actions);
    }
    return node;
  }

  function placeSlipNotes(world, ui) {
    var scale = (ui.view && ui.view.scale) || 1;
    world.querySelectorAll(".slip.side").forEach(function (slip) {
      var sheet = slip.querySelector(".slip-sheet");
      var actions = slip.querySelector(".slip-actions");
      if (!sheet || !actions) return;
      var sr = sheet.getBoundingClientRect();
      var pr = slip.getBoundingClientRect();
      actions.style.position = "absolute";
      actions.style.left = ((sr.right - pr.left) / scale + 12) + "px";
      actions.style.top = Math.max(0, (sr.top - pr.top) / scale) + "px";
      actions.style.margin = "0";
    });
  }

  function bindFileDrag(desk, ui) {
    var dragId = "";
    var ghost = null;
    function clearGhost() {
      if (ghost) ghost.remove();
      ghost = null;
      desk.querySelectorAll(".hot").forEach(function (el) { el.classList.remove("hot"); });
    }
    desk.querySelectorAll("[data-drag-doc]").forEach(function (el) {
      el.addEventListener("dragstart", function (e) {
        dragId = el.getAttribute("data-drag-doc");
        if (e.dataTransfer) {
          e.dataTransfer.setData("text/plain", dragId);
          e.dataTransfer.effectAllowed = "copy";
        }
        var name = el.querySelector(".pc-file-name");
        ghost = h("div", { class: "pc-ghost", text: name ? name.textContent : "서류" });
        document.body.appendChild(ghost);
        el.classList.add("dragging");
      });
      el.addEventListener("dragend", function () {
        el.classList.remove("dragging");
        clearGhost();
        dragId = "";
      });
    });
    desk.addEventListener("dragover", function (e) {
      if (!ghost) return;
      ghost.style.left = (e.clientX + 14) + "px";
      ghost.style.top = (e.clientY + 16) + "px";
    });
    desk.querySelectorAll("[data-drop='pin']").forEach(function (el) {
      el.addEventListener("dragover", function (e) {
        if (!dragId) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
        el.classList.add("hot");
      });
      el.addEventListener("dragleave", function (e) {
        if (e.target !== el) return;
        el.classList.remove("hot");
      });
      el.addEventListener("drop", function (e) {
        e.preventDefault();
        var id = dragId || (e.dataTransfer && e.dataTransfer.getData("text/plain"));
        var tab = el.getAttribute("data-drop-tab") || "";
        clearGhost();
        dragId = "";
        if (!id) return;
        desk.dispatchEvent(new CustomEvent("sr-pin", { bubbles: true, detail: { id: id, tab: tab } }));
      });
    });
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
    placeSlipNotes(world, ui);
    desk.querySelectorAll("[data-pc]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.stopPropagation();
        ui.pcOpen = el.getAttribute("data-pc") === "open";
        var pop = desk.querySelector(".pc-pop");
        if (ui.pcOpen) pop.classList.remove("shut");
        else pop.classList.add("shut");
      });
    });
    desk.querySelectorAll("[data-pc-tab]").forEach(function (el) {
      el.addEventListener("click", function () {
        var id = el.getAttribute("data-pc-tab");
        ui.pcTab = id;
        desk.querySelectorAll("[data-pc-tab]").forEach(function (b) {
          b.classList.toggle("active", b.getAttribute("data-pc-tab") === id);
        });
        desk.querySelectorAll("[data-pc-pane]").forEach(function (pane) {
          pane.classList.toggle("active", pane.getAttribute("data-pc-pane") === id);
        });
      });
    });
    desk.querySelectorAll("[data-pc-doc]").forEach(function (el) {
      el.addEventListener("click", function () {
        var id = el.getAttribute("data-pc-doc");
        ui.pcDoc = id;
        desk.querySelectorAll("[data-pc-doc]").forEach(function (b) {
          b.classList.toggle("active", b.getAttribute("data-pc-doc") === id);
        });
        desk.querySelectorAll("[data-pc-preview]").forEach(function (preview) {
          preview.classList.toggle("active", preview.getAttribute("data-pc-preview") === id);
        });
      });
    });
    bindFileDrag(desk, ui);
    var pop = desk.querySelector(".pc-pop");
    pop.addEventListener("click", function (e) {
      if (e.target !== pop) return;
      ui.pcOpen = false;
      pop.classList.add("shut");
    });
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
            var face = document.querySelector(".drawer");
            if (face) {
              var a = node.getBoundingClientRect();
              var b = face.getBoundingClientRect();
              if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) {
                delete ui.out[id];
                if (ui.docId === id) ui.docId = null;
                node.remove();
              }
            }
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
    var bar = h("footer", { class: "compare", "data-drop": "pin", "data-drop-tab": "report" });
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

  SR.desk = { paint: paint, filtered: filtered, docById: docById, pullOut: pullOut };
})(typeof globalThis !== "undefined" ? globalThis : this);
