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

  function paper(doc, opts) {
    opts = opts || {};
    var art = h("article", { class: "paper kind-" + doc.kind + (opts.compact ? " compact" : "") });
    art.appendChild(h("p", { class: "paper-kicker", text: kindLabel(doc.kind) }));
    art.appendChild(h("h3", { class: "paper-title", text: doc.title }));
    doc.fields.forEach(function (f) {
      var row = h("div", { class: "field" });
      row.appendChild(h("span", { class: "field-label", text: f.label }));
      row.appendChild(h("span", { class: "field-value", text: f.value }));
      art.appendChild(row);
    });
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
