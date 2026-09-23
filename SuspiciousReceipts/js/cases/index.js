(function (root) {
  root.SR = root.SR || {};
  root.SR.caseList = [
    root.SR.case00,
    root.SR.case01,
    root.SR.case02,
    root.SR.case03,
    root.SR.case04,
    root.SR.case05,
    root.SR.case06
  ];
  root.SR.caseById = function (id) {
    var list = root.SR.caseList;
    var i;
    for (i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
