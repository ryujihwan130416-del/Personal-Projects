(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.SR = root.SR || {};
  root.SR.achievements = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  return [
    { id: "first-find", name: "첫 도장", hint: "지적을 한 번 인정받으면 찍힌다.", text: "처음 인정된 지적에 도장이 찍혔다." },
    { id: "case01", name: "도시락의 시각", hint: "첫 철을 종결하면 찍힌다.", text: "야근 도시락을 종결했다." },
    { id: "case02", name: "토너가 아닌 것", hint: "두 번째 철을 종결하면 찍힌다.", text: "토너의 가격을 종결했다." },
    { id: "case03", name: "같은 번호", hint: "세 번째 철을 종결하면 찍힌다.", text: "같은 아침의 두 도시를 종결했다." },
    { id: "case04", name: "열여덟", hint: "네 번째 철을 종결하면 찍힌다.", text: "열여덟 명의 저녁을 종결했다." },
    { id: "case05", name: "빈 페이지", hint: "다섯 번째 철을 종결하면 찍힌다.", text: "빈 보고서를 종결했다." },
    { id: "ending-narrow", name: "결재란", hint: "의견서를 결재자만으로 닫으면 찍힌다.", text: "윤가람의 결재만으로 의견서를 닫았다." },
    { id: "ending-company", name: "창고 번호", hint: "사업자까지 올려 의견을 닫으면 찍힌다.", text: "청람유통을 의견서에 올렸다." },
    { id: "ending-full", name: "이니셜", hint: "항만의 이니셜까지 올리면 찍힌다.", text: "ㅂㄷㅇ까지 의견서에 적었다." },
    { id: "ending-special", name: "특별조사", hint: "선택 지적까지 모은 뒤 가장 넓은 의견을 고르면 찍힌다.", text: "선택 서류까지 모아 전모를 적었다." },
    { id: "ending-hold", name: "보류 도장", hint: "의견서를 보류하면 찍힌다.", text: "마지막 의견서를 보류했다." },
    { id: "ending-wrong", name: "오판", hint: "정점이 아닌 이름으로 의견을 닫으면 찍힌다.", text: "정점이 아닌 이름을 의견서에 올렸다." },
    { id: "clean", name: "무결", hint: "반려 없이 사건 하나를 종결하면 찍힌다.", text: "반려 없이 사건 하나를 종결했다." },
    { id: "cabinet", name: "캐비닛", hint: "슬롯에 직접 저장하면 찍힌다.", text: "조사를 캐비닛 슬롯에 넣었다." },
    { id: "resume", name: "이어쓰기", hint: "슬롯을 불러오면 찍힌다.", text: "저장한 조사를 다시 펼쳤다." },
    { id: "notebook", name: "수첩", hint: "서류를 수첩에 다섯 장 남기면 찍힌다.", text: "수첩에 서류 다섯 장이 모였다." },
    { id: "omnibus", name: "전권", hint: "모든 철의 서류를 한 번씩 펼치면 찍힌다.", text: "올라온 서류를 모두 한 번씩 읽었다." },
    { id: "night", name: "철야", hint: "조사 시간이 40분을 넘기면 찍힌다.", text: "조사가 마흔 분을 넘겼다." }
  ];
});
