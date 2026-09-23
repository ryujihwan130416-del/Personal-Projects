(function (root) {
  "use strict";
  var SR = root.SR = root.SR || {};

  function h(tag, props, kids) {
    var n = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v == null || v === false) return;
        if (k === "class") n.className = v;
        else if (k === "text") n.textContent = v;
        else n.setAttribute(k, v === true ? "" : String(v));
      });
    }
    (kids || []).forEach(function (c) {
      if (c == null || c === false) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }

  function kindGroup(kind) {
    if (kind === "receipt") return "영수증";
    if (kind === "ledger") return "내역서";
    if (kind === "registry") return "등록";
    return "기록";
  }

  function kindLabel(kind) {
    if (kind === "receipt") return "영수증";
    if (kind === "ledger") return "내역서";
    if (kind === "registry") return "등록";
    if (kind === "statement") return "진술";
    if (kind === "flow") return "출금";
    return "기록";
  }

  function barcode(seed) {
    var wrap = h("div", { class: "barcode", "aria-hidden": "true" });
    var n = 17;
    var s = String(seed || "0");
    var i;
    for (i = 0; i < s.length; i++) n = (n * 33 + s.charCodeAt(i)) % 997;
    for (i = 0; i < 46; i++) {
      n = (n * 17 + 11) % 1000;
      var bar = h("i");
      bar.style.width = (n % 4 === 0 ? 3 : 1) + "px";
      bar.style.height = (n % 5 === 0 ? 70 : 100) + "%";
      wrap.appendChild(bar);
    }
    return wrap;
  }

  function strongField(label) {
    return label === "합계" || label === "금액" || label === "결제";
  }

  function receiptPaper(doc, art) {
    art.appendChild(h("span", { class: "rip", "aria-hidden": "true" }));
    art.appendChild(h("p", { class: "rcpt-store", text: doc.title }));
    art.appendChild(h("p", { class: "rcpt-sub", text: "영수증  ·  고객용" }));
    art.appendChild(h("div", { class: "rcpt-dash" }));
    doc.fields.forEach(function (f) {
      var line = h("p", { class: "rcpt-line" + (strongField(f.label) ? " strong" : "") });
      line.appendChild(h("span", { text: f.label }));
      line.appendChild(h("span", { text: f.value }));
      art.appendChild(line);
    });
    art.appendChild(h("div", { class: "rcpt-dash" }));
    art.appendChild(barcode(doc.id + doc.title));
    art.appendChild(h("p", { class: "rcpt-foot", text: "감사합니다" }));
    art.appendChild(h("span", { class: "rip bot", "aria-hidden": "true" }));
  }

  function ledgerPaper(doc, art) {
    art.appendChild(h("div", { class: "ledger-head" }, [
      h("span", { text: kindLabel(doc.kind) }),
      h("span", { text: doc.title })
    ]));
    var table = h("table", { class: "ledger-table" });
    doc.fields.forEach(function (f) {
      table.appendChild(h("tr", {}, [
        h("td", { text: f.label }),
        h("td", { text: f.value })
      ]));
    });
    art.appendChild(table);
  }

  function statementPaper(doc, art) {
    art.appendChild(h("div", { class: "form-head" }, [
      h("strong", { text: doc.title }),
      h("span", { text: "진술" })
    ]));
    doc.fields.forEach(function (f) {
      var row = h("div", { class: "field" });
      row.appendChild(h("span", { class: "field-label", text: f.label }));
      row.appendChild(h("span", { class: "field-value", text: f.value }));
      art.appendChild(row);
    });
    art.appendChild(h("p", { class: "sign-line", text: "서명 ________" }));
  }

  function registryPaper(doc, art) {
    art.appendChild(h("p", { class: "reg-band", text: "등록 메모" }));
    art.appendChild(h("h3", { class: "paper-title", text: doc.title }));
    doc.fields.forEach(function (f) {
      var row = h("div", { class: "field" });
      row.appendChild(h("span", { class: "field-label", text: f.label }));
      row.appendChild(h("span", { class: "field-value", text: f.value }));
      art.appendChild(row);
    });
  }

  function plainPaper(doc, art) {
    art.appendChild(h("p", { class: "paper-kicker", text: kindLabel(doc.kind) }));
    art.appendChild(h("h3", { class: "paper-title", text: doc.title }));
    doc.fields.forEach(function (f) {
      var row = h("div", { class: "field" });
      row.appendChild(h("span", { class: "field-label", text: f.label }));
      row.appendChild(h("span", { class: "field-value", text: f.value }));
      art.appendChild(row);
    });
    if (doc.kind === "flow") art.appendChild(h("p", { class: "micr", text: "8142201937  ·  출금" }));
  }

  function paper(doc, opts) {
    opts = opts || {};
    var art = h("article", { class: "paper kind-" + doc.kind + (opts.compact ? " compact" : "") });
    if (doc.kind === "receipt") receiptPaper(doc, art);
    else if (doc.kind === "ledger") ledgerPaper(doc, art);
    else if (doc.kind === "statement") statementPaper(doc, art);
    else if (doc.kind === "registry") registryPaper(doc, art);
    else plainPaper(doc, art);
    return art;
  }

  function norm(s) {
    return String(s || "").toLowerCase().replace(/,/g, "").replace(/\s+/g, "");
  }

  SR.dom = {
    h: h,
    paper: paper,
    kindGroup: kindGroup,
    kindLabel: kindLabel,
    norm: norm
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
