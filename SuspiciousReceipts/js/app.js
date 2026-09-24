(function () {
  "use strict";
  var h = SR.dom.h;
  var root = document.getElementById("app");
  var state = SR.store.load();
  var ui = {
    screen: "title",
    caseId: null,
    docId: null,
    pins: [],
    filters: { person: "", kind: "", date: "", q: "" },
    cursor: 0,
    overlay: null,
    confirm: null,
    toasts: [],
    filingType: "동선모순",
    filingNote: "",
    briefOpen: true,
    reportMsg: "",
    reportChecks: [],
    personId: "",
    crimeId: "",
    wrongPerson: "kim",
    introPage: 0
  };
  var scrolls = {};
  var lastTick = Date.now();
  var playing = false;
  var cine = null;
  var WRONG_CINE = {
    "wrong-kim": {
      who: "김하늘",
      head: "김하늘",
      alibi: "김하늘은 회식 시각에 북원 시네마에 있었습니다. 결재란은 윤가람입니다.",
      lines: ["21:10  북원 시네마", "회식 서명과 같은 시각", "결재란  윤가람", "번호  청람유통"]
    },
    "wrong-bae": {
      who: "배수아",
      head: "배수아",
      alibi: "배수아의 분식과 택시는 그 시각의 자리일 뿐입니다. 도장은 윤가람입니다.",
      lines: ["북원 분식  배수아", "서구 택시  배수아", "결재란  윤가람", "창구와 도장은 다릅니다"]
    },
    "wrong-choi": {
      who: "최민재",
      head: "최민재",
      alibi: "최민재는 돈을 받은 사람입니다. 도장과 계좌 이름은 윤가람, 청람유통입니다.",
      lines: ["입금  최민재  상담료", "도장  윤가람", "예금주  청람유통", "받은 사람과 정점은 다릅니다"]
    }
  };
  var MISS = {
    case00: {
      person: ["연습 전표의 이름은 서도담입니다."],
      crime: ["위반 이름은 연습 오독입니다.", "허위 야근이 아닙니다."],
      findings: ["100번은 18:10과 18:22 사이", "18:40은 나중에 쓴 시각", "커피 영수증은 시각이 맞음"]
    },
    case01: {
      person: ["이 철의 이름은 박도윤입니다.", "정도현의 택시는 다른 사람입니다."],
      crime: ["위반은 허위 야근입니다.", "횡령이나 비자금이 아닙니다."],
      findings: ["4820은 21:02와 21:40 사이", "22:14는 나중에 쓴 시각", "남해 카드는 본사 출입 안"]
    },
    case02: {
      person: ["청구와 카드의 이름은 최민재입니다.", "윤가람은 결재란만입니다."],
      crime: ["위반은 비자금 수수입니다.", "허위 야근이나 위조가 아닙니다."],
      findings: ["토너 줄과 얼라인먼트", "부품이 급여의 세 배", "지급인  청람유통"]
    },
    case03: {
      person: ["42만 원의 사용자는 한서준입니다.", "배수아는 오답으로 남아 있습니다."],
      crime: ["위반은 허위 경비입니다.", "야근이나 비자금이 아닙니다."],
      findings: ["북원 08:20  강남 09:05", "간격 45분, 최소 150분", "B-220은 폐업 상호"]
    },
    case04: {
      person: ["청구하고 결재한 이름은 윤가람입니다.", "김하늘은 그 시각 북원에 있습니다."],
      crime: ["위반은 허위 회식입니다.", "야근이나 위조만은 아닙니다."],
      findings: ["서명 18, 스테이크 6", "김하늘  북원 영화", "간판 금강루, 등록 청람유통"]
    },
    case05: {
      person: ["계약과 결재의 이름은 윤가람입니다.", "최민재는 돈을 받은 사람입니다."],
      crime: ["위반은 허위 자문입니다.", "비자금 수수나 야근이 아닙니다."],
      findings: ["블루컨설팅 번호는 청람유통", "같은 날 6,000,000 세 장", "예금주  청람유통"]
    }
  };
  var NEED_LABEL = { "f-sign": "결재연결", "f-org": "조직연결", "f-port": "항만의 조직연결" };

  SR.audio.setMuted(state.mute);

  function formatMs(ms) {
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    var hr = Math.floor(m / 60);
    m = m % 60;
    s = s % 60;
    function z(n) { return (n < 10 ? "0" : "") + n; }
    if (hr > 0) return hr + "시간 " + z(m) + "분";
    return z(m) + ":" + z(s);
  }

  function ach(id) {
    var i;
    for (i = 0; i < SR.achievements.length; i++) if (SR.achievements[i].id === id) return SR.achievements[i];
    return { id: id, name: id, hint: "", text: "" };
  }

  function pushToast(text) {
    var item = { id: Math.random().toString(36).slice(2), text: text };
    ui.toasts.push(item);
    setTimeout(function () {
      ui.toasts = ui.toasts.filter(function (t) { return t.id !== item.id; });
      var node = document.querySelector('[data-toast="' + item.id + '"]');
      if (node) node.remove();
    }, 4200);
  }

  function persist() {
    if (ui.screen !== "cinema") {
      state.place = { screen: ui.screen === "title" ? state.place.screen : ui.screen, caseId: ui.caseId };
      if (ui.screen === "intro") state.place = { screen: "folders", caseId: null };
    }
    SR.store.save(state);
  }

  function endingCinema(id) {
    if (!id) return "";
    if (id.indexOf("wrong-") === 0) return "ending-wrong";
    return "ending-" + id;
  }

  function playCinema(id, opts, done) {
    if (typeof opts === "function") { done = opts; opts = {}; }
    opts = opts || {};
    if (!SR.cinema || !SR.cinema.has(id)) {
      if (done) done();
      return;
    }
    ui.screen = "cinema";
    ui.overlay = null;
    ui.confirm = null;
    paint();
    var host = document.getElementById("cinema-host");
    try {
      cine = SR.cinema.run(host, id, opts, function () {
        cine = null;
        if (done) done();
      });
    } catch (err) {
      cine = null;
      if (done) done();
    }
  }

  function grant(id) {
    var fresh = SR.store.earn(state, id);
    if (!fresh) return false;
    pushToast("업적 · " + ach(id).name);
    persist();
    return true;
  }

  function allDocKeys() {
    var keys = [];
    SR.caseList.forEach(function (c) {
      c.docs.forEach(function (d) { keys.push(c.id + ":" + d.id); });
    });
    return keys;
  }

  function checkMeta() {
    if (state.scraps.length >= 5) grant("notebook");
    if (state.playMs >= 40 * 60 * 1000) grant("night");
    var seen = {};
    state.seen.forEach(function (k) { seen[k] = true; });
    if (allDocKeys().every(function (k) { return seen[k]; })) grant("omnibus");
  }

  function captureScroll() {
    document.querySelectorAll("[data-scroll]").forEach(function (n) {
      scrolls[n.getAttribute("data-scroll")] = n.scrollTop;
    });
  }

  function restoreScroll() {
    document.querySelectorAll("[data-scroll]").forEach(function (n) {
      var k = n.getAttribute("data-scroll");
      if (scrolls[k]) n.scrollTop = scrolls[k];
    });
    var clock = document.getElementById("play-clock");
    if (clock) clock.textContent = formatMs(state.playMs);
  }

  function paint() {
    if (cine) {
      cine.stop(true);
      cine = null;
    }
    var active = document.activeElement;
    var focusId = active && active.id;
    var sel = active && typeof active.selectionStart === "number" ? active.selectionStart : null;
    captureScroll();
    root.textContent = "";
    if (ui.screen === "title") paintTitle();
    else if (ui.screen === "intro") paintIntro();
    else if (ui.screen === "folders") paintFolders();
    else if (ui.screen === "desk") paintDesk();
    else if (ui.screen === "epilogue") paintEpilogue();
    else if (ui.screen === "cinema") root.appendChild(h("div", { id: "cinema-host" }));
    if (ui.overlay) root.appendChild(paintOverlay());
    if (ui.confirm) root.appendChild(paintConfirm());
    if (ui.toasts.length) {
      var wrap = h("div", { class: "toast-wrap", "aria-live": "polite" });
      ui.toasts.forEach(function (t) {
        wrap.appendChild(h("p", { class: "toast", "data-toast": t.id, text: t.text }));
      });
      root.appendChild(wrap);
    }
    restoreScroll();
    if (focusId) {
      var n = document.getElementById(focusId);
      if (n) {
        n.focus();
        if (sel != null && n.setSelectionRange) {
          try { n.setSelectionRange(sel, sel); } catch (e) { /* select 요소 */ }
        }
      }
    }
  }

  function paintTitle() {
    var view = h("section", { class: "title-screen" });
    var copy = h("div", { class: "title-copy" });
    copy.appendChild(h("p", { class: "kicker light", text: "한빛지방국세청  특별조사2계" }));
    copy.appendChild(h("h1", { class: "game-title", text: "수상한 영수증" }));
    copy.appendChild(h("p", { class: "subtitle", text: "서류만 보고 쓰는 조사" }));
    copy.appendChild(h("p", { class: "lede", text: "알리바이는 문장으로 완벽합니다. 날짜, 장소, 금액, 번호가 서로 싸웁니다. 한 조사를 끝까지 읽으면 마흔 분에서 한 시간입니다." }));
    var actions = h("div", { class: "title-actions" });
    actions.appendChild(h("button", { class: "btn primary", type: "button", "data-action": "new-game", text: "새 조사" }));
    var cont = h("button", { class: "btn", type: "button", "data-action": "continue", text: "이어하기" });
    if (!SR.store.dirty(state)) cont.disabled = true;
    actions.appendChild(cont);
    actions.appendChild(h("button", { class: "btn", type: "button", "data-action": "save", text: "불러오기" }));
    actions.appendChild(h("button", { class: "btn", type: "button", "data-action": "achievements", text: "업적" }));
    actions.appendChild(h("button", { class: "btn", type: "button", "data-action": "manual", text: "매뉴얼" }));
    actions.appendChild(h("button", { class: "btn", type: "button", "data-action": "mute", text: state.mute ? "소리 켜기" : "소리 끄기" }));
    copy.appendChild(actions);
    actions.appendChild(h("button", { class: "btn", type: "button", "data-action": "replay-open", text: "착수 컷" }));
    copy.appendChild(h("p", { class: "footnote", text: "진행은 이 브라우저에 자동으로 남습니다. 철 사이와 결말에는 컷이 있고, Esc로 건너뜁니다." }));
    view.appendChild(copy);
    view.appendChild(sampleReceipt());
    root.appendChild(view);
  }

  function sampleReceipt() {
    var doc = {
      id: "title-slip",
      kind: "receipt",
      title: "골목등대",
      fields: [
        { label: "상호", value: "골목등대 분식" },
        { label: "주소", value: "한빛시 중구 당직길 3" },
        { label: "사업자번호", value: "305-19-44018" },
        { label: "단말기", value: "G-02" },
        { label: "영수증번호", value: "1184" },
        { label: "일시", value: "2026-03-02 02:16" },
        { label: "품목", value: "김밥 1  우동 1" },
        { label: "결제", value: "현금" },
        { label: "합계", value: "7,000원" }
      ]
    };
    var slip = h("aside", { class: "sample-receipt", "aria-hidden": "true" });
    slip.appendChild(SR.dom.paper(doc));
    return slip;
  }

  function paintIntro() {
    var pages = [
      "오세린 과장이 철을 책상 왼쪽에 내려놓습니다. 특별조사2계. 현장은 나가지 않습니다. 보는 것은 영수증, 지출내역서, 출입기록, 승인로그, 등록 메모뿐입니다.",
      "규칙은 매뉴얼에 전부 있습니다. 현실의 세무 지식이 필요 없습니다. 저장은 자동이고, 캐비닛 슬롯과 파일로도 남길 수 있습니다. 마지막 의견서는 하나만 고르며, 고른 결말마다 업적이 남습니다."
    ];
    var view = h("section", { class: "intro" }, [
      h("p", { class: "kicker", text: "착수" }),
      h("h1", { text: ui.introPage === 0 ? "책상 하나만 씁니다" : "마흔 분에서 한 시간" }),
      h("p", { class: "lede", text: pages[ui.introPage] }),
      h("div", { class: "title-actions" }, [
        ui.introPage === 0
          ? h("button", { class: "btn primary", type: "button", "data-action": "intro-next", text: "다음" })
          : h("button", { class: "btn primary", type: "button", "data-action": "intro-done", text: "철을 연다" }),
        h("button", { class: "btn", type: "button", "data-action": "intro-done", text: "건너뛰기" })
      ])
    ]);
    root.appendChild(view);
  }

  function paintFolders() {
    var view = h("section", { class: "folders" });
    view.appendChild(h("header", { class: "desk-bar" }, [
      h("div", { class: "bar-title" }, [
        h("p", { class: "kicker", text: "사건 철" }),
        h("h1", { text: "수상한 영수증" }),
        h("p", { class: "question", text: "연습 전표부터 순서대로 열립니다. 철을 닫을 때마다 컷이 나옵니다." })
      ]),
      h("div", { class: "bar-actions" }, [
        h("span", { class: "chip", id: "play-clock", text: formatMs(state.playMs) }),
        h("button", { class: "btn btn-on-dark", type: "button", "data-action": "save", text: "저장" }),
        h("button", { class: "btn btn-on-dark", type: "button", "data-action": "achievements", text: "업적" }),
        h("button", { class: "btn btn-on-dark", type: "button", "data-action": "manual", text: "매뉴얼" }),
        h("button", { class: "btn btn-on-dark", type: "button", "data-action": "mute", text: state.mute ? "소리 켜기" : "소리 끄기" }),
        h("button", { class: "btn btn-on-dark", type: "button", "data-action": "title", text: "표지" })
      ])
    ]));
    var grid = h("div", { class: "folder-grid" });
    SR.caseList.forEach(function (c, i) {
      var st = state.progress[c.id].status;
      var locked = st === "locked";
      var card = h("button", {
        class: "folder" + (locked ? " locked" : ""),
        type: "button",
        "data-action": locked ? "noop" : "open-case",
        "data-case": c.id,
        disabled: locked ? "disabled" : null
      }, [
        h("span", { class: "folder-index", text: (i < 10 ? "0" : "") + i }),
        h("span", { class: "stamp " + st, text: stampText(c.id) }),
        h("strong", { text: c.title }),
        h("em", { text: c.question }),
        h("span", { class: "folder-meta", text: c.difficulty + " · 약 " + c.minutes + "분 · 서류 " + c.docs.length + "장" })
      ]);
      grid.appendChild(card);
    });
    view.appendChild(grid);
    if (state.endingId) {
      view.appendChild(h("p", { class: "folder-foot" }, [
        "마지막 의견서는 「" + endingById(state.endingId).title + "」입니다. ",
        h("button", { class: "btn tiny", type: "button", "data-action": "epilogue", text: "결말 다시 읽기" })
      ]));
    }
    root.appendChild(view);
  }

  function stampText(id) {
    var st = state.progress[id].status;
    if (id === "case06" && state.endingId && st === "closed") return endingById(state.endingId).title;
    if (st === "locked") return "잠김";
    if (st === "closed") return "종결";
    if (st === "open") return "조사중";
    return "미착수";
  }

  function endingById(id) {
    var list = SR.case06.endings;
    var i;
    for (i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0];
  }

  function paintDesk() {
    var data = SR.caseById(ui.caseId);
    if (!data || state.progress[data.id].status === "locked") {
      ui.screen = "folders";
      paintFolders();
      return;
    }
    SR.desk.paint(root, { data: data, progress: state.progress[data.id], ui: ui, state: state });
  }

  function paintEpilogue() {
    var ending = state.endingId ? endingById(state.endingId) : null;
    var data = SR.caseById(ui.caseId) || SR.case06;
    var paras = ending ? ending.paragraphs : [data.epilogue, data.bridge].filter(Boolean);
    var view = h("section", { class: "epilogue" });
    view.appendChild(h("p", { class: "kicker", text: ending ? "의견서 마감" : "종결 메모" }));
    view.appendChild(h("h1", { text: ending ? ending.title : data.title }));
    var stamp = h("p", { class: "big-stamp", text: ending ? "마감" : "종결" });
    view.appendChild(stamp);
    paras.forEach(function (p) { view.appendChild(h("p", { class: "lede", text: p })); });
    var actions = h("div", { class: "title-actions" });
    if (!ending) {
      var idx = SR.store.ORDER.indexOf(data.id);
      var next = SR.store.ORDER[idx + 1];
      if (next && state.progress[next].status !== "locked") {
        actions.appendChild(h("button", { class: "btn primary", type: "button", "data-action": "open-case", "data-case": next, text: "다음 철" }));
      }
    } else {
      actions.appendChild(h("button", { class: "btn", type: "button", "data-action": "rewrite", text: "의견서 다시 쓰기" }));
      actions.appendChild(h("button", { class: "btn", type: "button", "data-action": "achievements", text: "업적" }));
    }
    var cineId = ending ? endingCinema(ending.id) : data.id;
    var cineExtra = ending ? WRONG_CINE[ending.id] : null;
    if (SR.cinema && SR.cinema.has(cineId)) {
      actions.appendChild(h("button", {
        class: "btn",
        type: "button",
        "data-action": "replay-cine",
        "data-cine-id": cineId,
        "data-who": cineExtra ? cineExtra.who : "",
        "data-alibi": cineExtra ? cineExtra.alibi : "",
        text: "컷 다시 보기"
      }));
    }
    actions.appendChild(h("button", { class: "btn", type: "button", "data-action": "save", text: "저장" }));
    actions.appendChild(h("button", { class: "btn primary", type: "button", "data-action": "folders", text: "철로" }));
    view.appendChild(actions);
    view.appendChild(h("p", { class: "chip", id: "play-clock", text: formatMs(state.playMs) }));
    root.appendChild(view);
  }

  function paintOverlay() {
    var card = h("div", { class: "overlay-card", role: "dialog", "aria-modal": "true" });
    if (ui.overlay === "notebook") card.classList.add("notebook-card");
    if (ui.overlay === "manual") fillManual(card);
    else if (ui.overlay === "save") fillSave(card);
    else if (ui.overlay === "achievements") fillAchievements(card);
    else if (ui.overlay === "people") fillPeople(card);
    else if (ui.overlay === "notebook") fillNotebook(card);
    else if (ui.overlay === "report") fillReport(card);
    else if (ui.overlay === "hint") fillHint(card);
    var back = h("div", { class: "overlay" }, [card]);
    return back;
  }

  function hintRank(prog) {
    return Math.max(prog.hintLevel || 0, prog.rejects >= 4 ? 2 : prog.rejects >= 2 ? 1 : 0);
  }

  function fillHint(card) {
    var data = SR.caseById(ui.caseId);
    var prog = data && state.progress[data.id];
    card.appendChild(h("h2", { text: "과장 메모" }));
    if (!data || !prog || !data.hints) {
      card.appendChild(h("p", { text: "이 철에는 메모가 없습니다." }));
    } else if (prog.status === "closed") {
      card.appendChild(h("p", { text: "이미 닫힌 철입니다. 종결 메모를 읽으십시오." }));
    } else {
      var rank = hintRank(prog);
      var score = SR.store.scoreOf(prog);
      card.appendChild(h("p", { text: "메모는 볼 서류의 윤곽과 모순의 이름만 말합니다. 정답 이름은 적지 않습니다." }));
      card.appendChild(h("p", { class: "mono", text: "이 철의 점수 " + score + "  ·  메모 한 장마다 -" + SR.store.HINT_COST }));
      if (!rank) card.appendChild(h("p", { class: "hint-slip", text: "아직 꺼낸 메모가 없습니다." }));
      data.hints.slice(0, rank).forEach(function (text, i) {
        card.appendChild(h("p", { class: "hint-slip", text: (i + 1) + ". " + text }));
      });
      if (rank < data.hints.length) {
        card.appendChild(h("button", { class: "btn-hint", type: "button", "data-action": "hint-more" }, [
          h("span", { class: "hint-word", text: rank ? "다음 메모" : "메모를 받는다" }),
          h("span", { class: "hint-cost", text: "-" + SR.store.HINT_COST })
        ]));
      }
    }
    card.appendChild(h("button", { class: "btn", type: "button", "data-action": "close-overlay", text: "닫기" }));
  }

  function fillManual(card) {
    card.appendChild(h("h2", { text: "조사 매뉴얼" }));
    var table = h("table");
    table.appendChild(h("tr", {}, [h("th", { text: "구간" }), h("th", { text: "최소" })]));
    SR.manual.travel.forEach(function (row) {
      table.appendChild(h("tr", {}, [h("td", { text: row[0] + " ↔ " + row[1] }), h("td", { class: "mono", text: row[2] })]));
    });
    card.appendChild(table);
    SR.manual.rules.forEach(function (rule) { card.appendChild(h("p", { text: rule })); });
    card.appendChild(h("p", { text: "단축키: J K 목록, Enter 열기, C 대조, F 지적, B 수첩, N 수첩 보기, M 매뉴얼, R 보고서, Esc 닫기. 힌트 메모를 한 장 꺼내면 그 철의 점수가 15 깎입니다. 컷이 나올 때 Esc는 건너뛰기, Enter는 다음 장면입니다." }));
    card.appendChild(h("button", { class: "btn", type: "button", "data-action": "close-overlay", text: "닫기" }));
  }

  function fillSave(card) {
    card.appendChild(h("h2", { text: "캐비닛" }));
    card.appendChild(h("p", { text: "자동 저장은 이미 되고 있습니다. 슬롯은 세 칸입니다. 파일로 내보내면 다른 브라우저에서도 이어갈 수 있습니다." }));
    card.appendChild(h("p", { class: "mono", text: "조사 시간 " + formatMs(state.playMs) }));
    SR.store.slots().forEach(function (slot, i) {
      var row = h("div", { class: "slot-row" });
      row.appendChild(h("p", { text: slot ? (slot.label + " · " + formatMs(slot.playMs || 0) + " · " + slot.savedAt.slice(0, 16).replace("T", " ")) : "빈 칸 " + (i + 1) }));
      row.appendChild(h("button", { class: "btn tiny", type: "button", "data-action": "save-slot", "data-slot": String(i), text: "이 칸에 저장" }));
      if (slot) {
        row.appendChild(h("button", { class: "btn tiny", type: "button", "data-action": "load-slot", "data-slot": String(i), text: "불러오기" }));
        row.appendChild(h("button", { class: "btn tiny", type: "button", "data-action": "clear-slot", "data-slot": String(i), text: "비우기" }));
      }
      card.appendChild(row);
    });
    var fileRow = h("div", { class: "slot-row" });
    fileRow.appendChild(h("button", { class: "btn", type: "button", "data-action": "export-save", text: "파일로 내보내기" }));
    fileRow.appendChild(h("label", { class: "btn file-btn" }, [
      "파일 불러오기",
      h("input", { id: "import-file", type: "file", accept: "application/json" })
    ]));
    card.appendChild(fileRow);
    card.appendChild(h("button", { class: "btn", type: "button", "data-action": "close-overlay", text: "닫기" }));
  }

  function fillAchievements(card) {
    card.appendChild(h("h2", { text: "업적" }));
    var owned = SR.store.meta().earned;
    var grid = h("div", { class: "ach-grid" });
    SR.achievements.forEach(function (a) {
      var on = !!owned[a.id];
      var cardBits = [];
      if (on) cardBits.push(h("p", { class: "stamp mini open", text: "달성" }));
      cardBits.push(h("strong", { text: on ? a.name : "아직 없음" }));
      cardBits.push(h("p", { text: on ? a.text : a.hint }));
      grid.appendChild(h("article", { class: "ach" + (on ? " on" : " locked") }, cardBits));
    });
    card.appendChild(grid);
    card.appendChild(h("button", { class: "btn tiny", type: "button", "data-action": "clear-ach", text: "업적만 지우기" }));
    card.appendChild(h("button", { class: "btn", type: "button", "data-action": "close-overlay", text: "닫기" }));
  }

  function fillPeople(card) {
    var data = SR.caseById(ui.caseId);
    card.appendChild(h("h2", { text: "인물" }));
    if (!data) {
      card.appendChild(h("p", { text: "열린 사건이 없습니다." }));
    } else {
      data.people.forEach(function (p) {
        card.appendChild(h("article", { class: "found-card" }, [
          h("p", { class: "found-type", text: p.name + " · " + p.role }),
          h("p", { text: p.bio })
        ]));
      });
    }
    card.appendChild(h("button", { class: "btn", type: "button", "data-action": "close-overlay", text: "닫기" }));
  }

  function fillNotebook(card) {
    var spiral = h("div", { class: "nb-spiral", "aria-hidden": "true" });
    var i;
    for (i = 0; i < 12; i++) spiral.appendChild(h("i"));
    var page = h("div", { class: "nb-page" });
    page.appendChild(h("h2", { text: "조사 수첩" }));
    page.appendChild(h("p", { class: "nb-kicker", text: "한빛지방국세청  ·  특별조사2계" }));
    if (!state.scraps.length) page.appendChild(h("p", { text: "아직 베껴 둔 줄이 없습니다. 서류를 연 뒤 수첩에 남기기를 누르십시오." }));
    state.scraps.forEach(function (s) {
      var note = h("article", { class: "nb-note" });
      note.appendChild(h("p", { class: "tape", text: s.caseTitle }));
      note.appendChild(h("h3", { text: s.title }));
      (s.fields || []).slice(0, 5).forEach(function (f) {
        note.appendChild(h("p", { text: f.label + "   " + f.value }));
      });
      page.appendChild(note);
    });
    page.appendChild(h("button", { class: "btn nb-close", type: "button", "data-action": "close-overlay", text: "수첩 덮기" }));
    card.appendChild(h("div", { class: "notebook" }, [spiral, page]));
  }

  function fillReport(card) {
    var data = SR.caseById(ui.caseId);
    var prog = state.progress[ui.caseId];
    if (!data) return;
    if (!data.accusation) {
      fillOpinion(card, data, prog);
      return;
    }
    if (prog.status === "closed") {
      card.appendChild(h("h2", { text: data.title }));
      card.appendChild(h("p", { text: data.epilogue }));
      if (data.bridge) card.appendChild(h("p", { text: data.bridge }));
      card.appendChild(h("button", { class: "btn", type: "button", "data-action": "close-overlay", text: "닫기" }));
      return;
    }
    card.appendChild(h("h2", { text: "보고서" }));
    card.appendChild(h("p", { text: "인정된 지적만 첨부됩니다. 필수 지적이 빠지면 과장이 돌려보냅니다." }));
    if (!prog.found.length) card.appendChild(h("p", { text: "아직 인정된 지적이 없습니다." }));
    prog.found.forEach(function (id) {
      var f = data.findings.filter(function (x) { return x.id === id; })[0];
      if (!f) return;
      var label = h("label", { class: "check" }, [
        h("input", { type: "checkbox", class: "finding-check", "data-finding": id }),
        h("span", { text: f.type + (f.optional ? " (선택)" : " (필수)") + " — " + f.why })
      ]);
      var input = label.querySelector("input");
      input.checked = ui.reportChecks.indexOf(id) !== -1;
      card.appendChild(label);
    });
    card.appendChild(personSelect(data));
    card.appendChild(crimeSelect(data));
    if (prog.rejects >= 2) card.appendChild(h("p", { class: "hint-slip", text: data.hints[0] }));
    if (prog.rejects >= 4) card.appendChild(h("p", { class: "hint-slip", text: data.hints[1] }));
    if (ui.reportMsg) card.appendChild(h("p", { class: "report-msg", text: ui.reportMsg }));
    card.appendChild(h("button", { class: "btn primary", type: "button", "data-action": "submit-report", text: "과장에게 제출" }));
    card.appendChild(h("button", { class: "btn", type: "button", "data-action": "close-overlay", text: "닫기" }));
  }

  function personSelect(data) {
    var wrap = h("label", { class: "filter" }, [h("span", { text: "대상" })]);
    var sel = h("select", { id: "person-select" });
    data.people.filter(function (p) { return p.suspect; }).forEach(function (p) {
      var opt = h("option", { value: p.id, text: p.name });
      if (p.id === ui.personId) opt.selected = true;
      sel.appendChild(opt);
    });
    wrap.appendChild(sel);
    return wrap;
  }

  function crimeSelect(data) {
    var wrap = h("label", { class: "filter" }, [h("span", { text: "위반" })]);
    var sel = h("select", { id: "crime-select" });
    data.crimes.forEach(function (c) {
      var opt = h("option", { value: c.id, text: c.label });
      if (c.id === ui.crimeId) opt.selected = true;
      sel.appendChild(opt);
    });
    wrap.appendChild(sel);
    return wrap;
  }

  function fillOpinion(card, data, prog) {
    card.appendChild(h("h2", { text: "의견서" }));
    card.appendChild(h("p", { text: "근거가 닿는 범위만 밝게 켜집니다. 한 번 고르면 결말이 남고, 업적은 지워지지 않습니다. 에필로그에서 의견서만 다시 쓸 수 있습니다." }));
    if (prog.status === "closed" && state.endingId) {
      card.appendChild(h("p", { text: "이미 「" + endingById(state.endingId).title + "」로 마감했습니다." }));
      card.appendChild(h("button", { class: "btn", type: "button", "data-action": "epilogue", text: "결말 읽기" }));
      card.appendChild(h("button", { class: "btn", type: "button", "data-action": "close-overlay", text: "닫기" }));
      return;
    }
    var choices = SR.logic.endingChoices(data, prog.found, { special: SR.logic.specialReady(state.progress) });
    var byId = {};
    choices.forEach(function (c) { byId[c.id] = c; });
    var list = h("div", { class: "ending-list" });
    data.endings.filter(function (e) { return !e.wrong; }).forEach(function (e) {
      var choice = byId[e.id];
      var on = choice && choice.enabled;
      var reason = "";
      if (!on && choice && choice.needSpecial) reason = "선택 지적을 다섯 철에서 모두 모아야 합니다.";
      else if (!on && choice) reason = choice.missing.map(function (id) { return NEED_LABEL[id] || id; }).join(", ") + "이 필요합니다.";
      var node = h("button", {
        class: "ending-card" + (on ? "" : " off"),
        type: "button",
        "data-action": on ? "commit-ending" : "noop",
        "data-ending": e.id,
        disabled: on ? null : "disabled"
      }, [
        h("strong", { text: e.title }),
        h("span", { text: on ? e.lead : reason })
      ]);
      list.appendChild(node);
    });
    card.appendChild(list);
    var danger = h("div", { class: "danger-box" });
    danger.appendChild(h("p", { text: "정점을 다른 사람으로 적으면 그 이름으로 조사가 닫힙니다." }));
    var sel = h("select", { id: "wrong-select", "aria-label": "다른 정점" });
    [["kim", "김하늘"], ["bae", "배수아"], ["choi", "최민재"]].forEach(function (pair) {
      var opt = h("option", { value: pair[0], text: pair[1] });
      if (pair[0] === ui.wrongPerson) opt.selected = true;
      sel.appendChild(opt);
    });
    danger.appendChild(sel);
    danger.appendChild(h("button", { class: "btn danger", type: "button", "data-action": "commit-wrong", text: "이 이름을 정점으로" }));
    card.appendChild(danger);
    if (prog.rejects >= 2) card.appendChild(h("p", { class: "hint-slip", text: data.hints[0] }));
    if (prog.rejects >= 4) card.appendChild(h("p", { class: "hint-slip", text: data.hints[1] }));
    card.appendChild(h("button", { class: "btn", type: "button", "data-action": "close-overlay", text: "닫기" }));
  }

  function paintConfirm() {
    var c = ui.confirm;
    return h("div", { class: "overlay" }, [
      h("div", { class: "overlay-card confirm-card", role: "dialog" }, [
        h("p", { text: c.text }),
        h("div", { class: "title-actions" }, [
          h("button", { class: "btn primary", type: "button", "data-action": "confirm-ok", text: c.okLabel || "확인" }),
          c.altLabel ? h("button", { class: "btn", type: "button", "data-action": "confirm-alt", text: c.altLabel }) : null,
          h("button", { class: "btn", type: "button", "data-action": "confirm-no", text: c.cancelLabel || "취소" })
        ])
      ])
    ]);
  }

  function openCase(id) {
    var row = state.progress[id];
    if (!row || row.status === "locked") return;
    if (id === "case06" && (state.seenCinema || []).indexOf("case06") < 0) {
      state.seenCinema = state.seenCinema || [];
      state.seenCinema.push("case06");
      if (row.status === "new") row.status = "open";
      ui.caseId = id;
      ui.screen = "desk";
      playing = true;
      persist();
      playCinema("case06", function () { openCase(id); });
      return;
    }
    if (row.status === "new") row.status = "open";
    ui.caseId = id;
    ui.docId = null;
    ui.pins = [];
    ui.cursor = 0;
    ui.filters = { person: "", kind: "", date: "", q: "" };
    ui.screen = "desk";
    ui.overlay = null;
    ui.reportMsg = "";
    playing = true;
    persist();
    paint();
  }

  function openDoc(id) {
    ui.docId = id;
    var key = ui.caseId + ":" + id;
    if (state.seen.indexOf(key) === -1) {
      state.seen.push(key);
      checkMeta();
      persist();
    }
    var list = SR.desk.filtered(SR.caseById(ui.caseId), ui.filters);
    var i;
    for (i = 0; i < list.length; i++) if (list[i].id === id) ui.cursor = i;
    SR.audio.paper();
    paint();
  }

  function fileFinding() {
    var data = SR.caseById(ui.caseId);
    var prog = state.progress[ui.caseId];
    if (!data || prog.status === "closed") {
      pushToast("이 사건은 종결되었습니다.");
      paint();
      return;
    }
    if (!ui.pins.length) {
      pushToast("대조 칸에 서류를 올리십시오.");
      paint();
      return;
    }
    var res = SR.logic.submitFinding(data, ui.pins, ui.filingType);
    if (!res.ok) {
      prog.wrongFindings += 1;
      var msg = "이 조합은 모순으로 성립하지 않습니다.";
      if (prog.wrongFindings >= 8) msg += " 조합을 찍지 말고 숫자를 읽으십시오.";
      pushToast(msg);
      SR.audio.reject();
      persist();
      paint();
      return;
    }
    if (prog.found.indexOf(res.findingId) !== -1) {
      pushToast("이미 보고서에 있습니다.");
      paint();
      return;
    }
    prog.found.push(res.findingId);
    if (ui.filingNote) prog.notes[res.findingId] = ui.filingNote;
    ui.filingNote = "";
    grant("first-find");
    pushToast(res.why);
    SR.audio.stamp();
    persist();
    paint();
  }

  function openReport() {
    var data = SR.caseById(ui.caseId);
    if (!data) return;
    var prog = state.progress[ui.caseId];
    ui.reportChecks = prog.found.slice();
    var suspects = data.people.filter(function (p) { return p.suspect; });
    var suspectIds = suspects.map(function (p) { return p.id; });
    if (suspectIds.indexOf(ui.personId) === -1) ui.personId = suspectIds[0] || "";
    var crimeIds = data.crimes.map(function (c) { return c.id; });
    if (crimeIds.indexOf(ui.crimeId) === -1) ui.crimeId = crimeIds[0] || "";
    ui.reportMsg = "";
    ui.overlay = "report";
    paint();
  }

  function submitReport() {
    var data = SR.caseById(ui.caseId);
    var prog = state.progress[ui.caseId];
    var res = SR.logic.submitReport(data, {
      personId: ui.personId,
      crimeId: ui.crimeId,
      findingIds: ui.reportChecks,
      entityId: null
    });
    if (!res.ok) {
      prog.rejects += 1;
      var msg = {
        person: "사람부터 다시 보십시오.",
        crime: "위반 이름을 서류에 맞게 고르십시오.",
        entity: "사업자부터 다시 보십시오.",
        findings: "근거가 모자랍니다."
      };
      ui.reportMsg = msg[res.reason] || "근거가 모자랍니다.";
      SR.audio.reject();
      ui.overlay = null;
      persist();
      var pack = (MISS[data.id] && MISS[data.id][res.reason]) || MISS[data.id] && MISS[data.id].findings || ["서류를 다시 읽으십시오."];
      playCinema("miss", {
        head: "사실",
        lines: pack,
        caption: pack[0]
      }, function () {
        ui.caseId = data.id;
        ui.screen = "desk";
        ui.overlay = "report";
        playing = true;
        paint();
      });
      return;
    }
    prog.status = "closed";
    if (prog.rejects === 0 && prog.wrongFindings === 0) grant("clean");
    grant(data.id);
    ui.overlay = null;
    ui.caseId = data.id;
    ui.screen = "epilogue";
    playing = true;
    persist();
    playCinema(data.id, function () {
      ui.caseId = data.id;
      ui.screen = "epilogue";
      playing = true;
      paint();
    });
  }

  function commitEnding(id) {
    var ending = endingById(id);
    ui.confirm = {
      text: "「" + ending.title + "」로 조사를 마감합니다. 업적은 남고, 나중에 의견서만 다시 쓸 수 있습니다.",
      okLabel: "마감",
      onOk: function () { finishEnding(ending); }
    };
    paint();
  }

  function finishEnding(ending) {
    var prog = state.progress.case06;
    state.endingId = ending.id;
    prog.status = "closed";
    if (ending.id === "special") {
      grant("ending-full");
      grant("ending-special");
    } else {
      grant(ending.achievement);
    }
    if (prog.rejects === 0 && prog.wrongFindings === 0 && ending.id.indexOf("wrong") !== 0) grant("clean");
    ui.caseId = "case06";
    ui.screen = "epilogue";
    ui.overlay = null;
    ui.confirm = null;
    playing = true;
    persist();
    playCinema(endingCinema(ending.id), WRONG_CINE[ending.id] || {}, function () {
      ui.caseId = "case06";
      ui.screen = "epilogue";
      playing = true;
      paint();
    });
  }

  function beginNew() {
    state = SR.store.blank();
    state.place = { screen: "folders", caseId: null };
    SR.store.save(state);
    ui.caseId = null;
    ui.docId = null;
    ui.pins = [];
    ui.overlay = null;
    ui.confirm = null;
    ui.introPage = 0;
    playing = true;
    playCinema("open", function () {
      state.introSeen = true;
      ui.screen = "folders";
      playing = true;
      persist();
      paint();
    });
  }

  function resume() {
    if (!SR.store.dirty(state)) return;
    playing = true;
    if (!state.introSeen) {
      playCinema("open", function () {
        state.introSeen = true;
        ui.screen = "folders";
        playing = true;
        persist();
        paint();
      });
      return;
    }
    var place = state.place || {};
    if (state.endingId) {
      ui.caseId = "case06";
      ui.screen = "epilogue";
    } else if (place.screen === "desk" && place.caseId && state.progress[place.caseId] && state.progress[place.caseId].status !== "locked") {
      ui.caseId = place.caseId;
      if (place.caseId === "case06" && (state.seenCinema || []).indexOf("case06") < 0) {
        state.seenCinema = state.seenCinema || [];
        state.seenCinema.push("case06");
        ui.screen = "desk";
        persist();
        playCinema("case06", function () {
          ui.caseId = "case06";
          ui.screen = "desk";
          playing = true;
          paint();
        });
        return;
      }
      ui.screen = "desk";
    } else if (place.screen === "epilogue" && place.caseId) {
      ui.caseId = place.caseId;
      ui.screen = "epilogue";
    } else {
      ui.screen = "folders";
    }
    paint();
  }

  function act(name, el) {
    if (name === "noop") return;
    if (name === "close-overlay") { ui.overlay = null; paint(); return; }
    if (name === "confirm-no") { ui.confirm = null; paint(); return; }
    if (name === "confirm-ok") {
      var fn = ui.confirm && ui.confirm.onOk;
      ui.confirm = null;
      if (fn) fn();
      else paint();
      return;
    }
    if (name === "confirm-alt") {
      var alt = ui.confirm && ui.confirm.onAlt;
      ui.confirm = null;
      if (alt) alt();
      else paint();
      return;
    }
    if (name === "mute") {
      state.mute = !state.mute;
      SR.audio.setMuted(state.mute);
      persist();
      paint();
      return;
    }
    if (name === "hint") { ui.overlay = "hint"; paint(); return; }
    if (name === "hint-more") {
      var hintCase = SR.caseById(ui.caseId);
      var hintProg = hintCase && state.progress[hintCase.id];
      if (hintProg && hintCase.hints && hintRank(hintProg) < hintCase.hints.length) {
        hintProg.hintLevel = hintRank(hintProg) + 1;
        hintProg.score = Math.max(0, SR.store.scoreOf(hintProg) - SR.store.HINT_COST);
        persist();
      }
      ui.overlay = "hint";
      paint();
      return;
    }
    if (name === "manual") { ui.overlay = "manual"; paint(); return; }
    if (name === "achievements") { ui.overlay = "achievements"; paint(); return; }
    if (name === "people") { ui.overlay = "people"; paint(); return; }
    if (name === "notebook") { ui.overlay = "notebook"; paint(); return; }
    if (name === "save") { ui.overlay = "save"; paint(); return; }
    if (name === "title") { ui.screen = "title"; ui.overlay = null; playing = false; paint(); return; }
    if (name === "folders") { ui.screen = "folders"; ui.overlay = null; playing = true; persist(); paint(); return; }
    if (name === "new-game") {
      if (SR.store.dirty(state)) {
        ui.confirm = {
          text: "새 조사는 자동 저장을 덮습니다. 슬롯 1에 남긴 뒤 시작할 수 있습니다.",
          okLabel: "저장 후 시작",
          altLabel: "그냥 시작",
          onOk: function () { SR.store.saveSlot(0, state); grant("cabinet"); beginNew(); },
          onAlt: function () { beginNew(); }
        };
        paint();
      } else beginNew();
      return;
    }
    if (name === "continue") { resume(); return; }
    if (name === "intro-next") { ui.introPage = 1; paint(); return; }
    if (name === "replay-open") {
      playCinema("open", function () {
        ui.screen = "title";
        playing = false;
        paint();
      });
      return;
    }
    if (name === "replay-cine") {
      var cineKey = el.getAttribute("data-cine-id");
      playCinema(cineKey, WRONG_CINE[cineKey] || WRONG_CINE[state.endingId] || {}, function () {
        ui.screen = "epilogue";
        playing = true;
        paint();
      });
      return;
    }
    if (name === "intro-done") {
      state.introSeen = true;
      ui.screen = "folders";
      playing = true;
      persist();
      paint();
      return;
    }
    if (name === "open-case") { openCase(el.getAttribute("data-case")); return; }
    if (name === "draw-toggle") { ui.drawerOpen = !ui.drawerOpen; paint(); return; }
    if (name === "draw-out") {
      SR.desk.pullOut(ui, el.getAttribute("data-doc"));
      ui.drawerOpen = true;
      openDoc(el.getAttribute("data-doc"));
      return;
    }
    if (name === "draw-in") {
      var backId = el.getAttribute("data-doc") || ui.docId;
      if (ui.out) delete ui.out[backId];
      if (ui.docId === backId) ui.docId = null;
      ui.drawerOpen = true;
      paint();
      return;
    }
    if (name === "note-open") { ui.noteOpen = true; paint(); return; }
    if (name === "note-close") { ui.noteOpen = false; paint(); return; }
    if (name === "open-doc") { openDoc(el.getAttribute("data-doc")); return; }
    if (name === "pin") {
      var id = el.getAttribute("data-doc") || ui.docId;
      if (!id) return;
      if (ui.pins.indexOf(id) !== -1) return;
      if (ui.pins.length >= 3) { pushToast("대조는 3장까지입니다."); paint(); return; }
      ui.pins.push(id);
      paint();
      return;
    }
    if (name === "unpin") {
      ui.pins = ui.pins.filter(function (x) { return x !== el.getAttribute("data-doc"); });
      paint();
      return;
    }
    if (name === "file") { fileFinding(); return; }
    if (name === "scrap") {
      var data = SR.caseById(ui.caseId);
      var doc = ui.docId && SR.desk.docById(data, ui.docId);
      if (!doc) return;
      if (state.scraps.some(function (s) { return s.caseId === data.id && s.docId === doc.id; })) {
        pushToast("이미 수첩에 있습니다.");
        paint();
        return;
      }
      state.scraps.push({ caseId: data.id, docId: doc.id, title: doc.title, caseTitle: data.title, fields: doc.fields });
      checkMeta();
      pushToast("수첩에 남겼습니다.");
      persist();
      paint();
      return;
    }
    if (name === "dismiss-coach") { state.coachSeen = true; persist(); paint(); return; }
    if (name === "report") { openReport(); return; }
    if (name === "epilogue") {
      ui.overlay = null;
      ui.caseId = ui.caseId || "case06";
      ui.screen = "epilogue";
      paint();
      return;
    }
    if (name === "submit-report") { submitReport(); return; }
    if (name === "commit-ending") { commitEnding(el.getAttribute("data-ending")); return; }
    if (name === "commit-wrong") {
      var map = { kim: "wrong-kim", bae: "wrong-bae", choi: "wrong-choi" };
      commitEnding(map[ui.wrongPerson] || "wrong-kim");
      return;
    }
    if (name === "rewrite") {
      state.endingId = null;
      state.progress.case06.status = "open";
      ui.caseId = "case06";
      ui.screen = "desk";
      persist();
      paint();
      return;
    }
    if (name === "save-slot") {
      var idx = Number(el.getAttribute("data-slot"));
      SR.store.saveSlot(idx, state);
      grant("cabinet");
      pushToast("슬롯 " + (idx + 1) + "에 저장했습니다.");
      persist();
      paint();
      return;
    }
    if (name === "load-slot") {
      var loaded = SR.store.loadSlot(Number(el.getAttribute("data-slot")));
      if (!loaded) return;
      state = loaded;
      SR.audio.setMuted(state.mute);
      grant("resume");
      pushToast("저장한 조사를 펼쳤습니다.");
      ui.overlay = null;
      ui.confirm = null;
      ui.docId = null;
      ui.pins = [];
      playing = true;
      resume();
      return;
    }
    if (name === "clear-slot") {
      SR.store.clearSlot(Number(el.getAttribute("data-slot")));
      paint();
      return;
    }
    if (name === "export-save") {
      var blob = new Blob([JSON.stringify(state)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "suspicious-receipts-save.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    if (name === "clear-ach") {
      ui.confirm = {
        text: "업적만 지웁니다. 조사 기록과 슬롯은 남습니다.",
        okLabel: "업적 지우기",
        onOk: function () {
          SR.store.clearAchievements();
          state.earned = [];
          persist();
          ui.confirm = null;
          paint();
        }
      };
      paint();
    }
  }

  root.addEventListener("click", function (e) {
    var t = e.target.closest("[data-action]");
    if (!t || !root.contains(t)) return;
    SR.audio.unlock();
    act(t.getAttribute("data-action"), t);
  });

  root.addEventListener("submit", function (e) {
    e.preventDefault();
    fileFinding();
  });

  root.addEventListener("toggle", function (e) {
    if (e.target.classList && e.target.classList.contains("brief")) ui.briefOpen = e.target.open;
  }, true);

  root.addEventListener("change", function (e) {
    var t = e.target;
    if (t.id === "filter-person") { ui.filters.person = t.value; ui.cursor = 0; paint(); }
    if (t.id === "filter-kind") { ui.filters.kind = t.value; ui.cursor = 0; paint(); }
    if (t.id === "filter-date") { ui.filters.date = t.value; ui.cursor = 0; paint(); }
    if (t.id === "filing-type") ui.filingType = t.value;
    if (t.id === "person-select") ui.personId = t.value;
    if (t.id === "crime-select") ui.crimeId = t.value;
    if (t.id === "wrong-select") ui.wrongPerson = t.value;
    if (t.classList && t.classList.contains("finding-check")) {
      var id = t.getAttribute("data-finding");
      if (t.checked && ui.reportChecks.indexOf(id) === -1) ui.reportChecks.push(id);
      if (!t.checked) ui.reportChecks = ui.reportChecks.filter(function (x) { return x !== id; });
    }
    if (t.id === "import-file" && t.files && t.files[0]) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var raw = JSON.parse(reader.result);
          if (!raw || raw.v !== 2 || !raw.progress || !raw.progress.case01) throw new Error("bad");
          var next = SR.store.sanitize(raw);
          state = next;
          SR.store.save(state);
          SR.audio.setMuted(state.mute);
          ui.overlay = null;
          playing = true;
          pushToast("파일에서 조사를 불러왔습니다.");
          resume();
        } catch (err) {
          pushToast("이 파일은 조사 기록이 아닙니다.");
          paint();
        }
      };
      reader.readAsText(t.files[0]);
    }
  });

  var composing = false;
  document.addEventListener("compositionstart", function () { composing = true; });
  document.addEventListener("compositionend", function (e) {
    composing = false;
    if (e.target && e.target.id === "doc-search") {
      ui.filters.q = e.target.value;
      ui.cursor = 0;
      paint();
    }
  });

  root.addEventListener("input", function (e) {
    if (composing) return;
    var t = e.target;
    if (t.id === "doc-search") { ui.filters.q = t.value; ui.cursor = 0; paint(); }
    if (t.id === "case-memo" && ui.caseId) state.memos[ui.caseId] = t.value;
    if (t.id === "filing-note") ui.filingNote = t.value;
  });

  document.addEventListener("keydown", function (e) {
    if (ui.screen === "cinema" && cine) {
      if (e.key === "Escape") { e.preventDefault(); cine.skip(); return; }
      if (e.target && e.target.closest && e.target.closest("[data-cine='skip']")) return;
      if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight") { e.preventDefault(); cine.advance(); return; }
      return;
    }
    var tag = e.target && e.target.tagName;
    var typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    if (e.key === "Escape") {
      if (ui.confirm) { ui.confirm = null; paint(); return; }
      if (ui.overlay) { ui.overlay = null; paint(); return; }
      if (ui.screen === "desk" && ui.docId) { ui.docId = null; paint(); return; }
      if (ui.screen === "desk" || ui.screen === "epilogue") { ui.screen = "folders"; playing = true; persist(); paint(); }
      return;
    }
    if (typing) return;
    if (e.key === "m" || e.key === "M") { ui.overlay = ui.overlay === "manual" ? null : "manual"; paint(); return; }
    if (ui.screen !== "desk" || ui.overlay) return;
    var data = SR.caseById(ui.caseId);
    if (!data) return;
    var list = SR.desk.filtered(data, ui.filters);
    if ((e.key === "j" || e.key === "J") && list.length) {
      ui.cursor = Math.min(list.length - 1, ui.cursor + 1);
      paint();
    } else if ((e.key === "k" || e.key === "K") && list.length) {
      ui.cursor = Math.max(0, ui.cursor - 1);
      paint();
    } else if (e.key === "Enter" && list[ui.cursor]) {
      openDoc(list[ui.cursor].id);
    } else if (e.key === "c" || e.key === "C") {
      if (ui.docId) act("pin", { getAttribute: function () { return ui.docId; } });
    } else if (e.key === "f" || e.key === "F") {
      fileFinding();
    } else if (e.key === "r" || e.key === "R") {
      openReport();
    } else if (e.key === "b" || e.key === "B") {
      act("scrap", null);
    } else if (e.key === "n" || e.key === "N") {
      ui.overlay = "notebook";
      paint();
    }
  });

  setInterval(function () {
    var now = Date.now();
    var delta = now - lastTick;
    lastTick = now;
    if (document.hidden || !playing) return;
    if (delta > 0 && delta < 20000) {
      state.playMs += delta;
      var clock = document.getElementById("play-clock");
      if (clock) clock.textContent = formatMs(state.playMs);
      if (state.playMs >= 40 * 60 * 1000 && grant("night") && ui.screen !== "cinema") paint();
    }
  }, 1000);

  setInterval(function () { if (playing) persist(); }, 20000);

  document.addEventListener("visibilitychange", function () { lastTick = Date.now(); });

  paint();
})();
