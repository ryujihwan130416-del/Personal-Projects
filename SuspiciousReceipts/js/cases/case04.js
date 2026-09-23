(function (root, factory) {
  var data = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = data;
  root.SR = root.SR || {};
  root.SR.case04 = data;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var names = [
    "윤가람", "김하늘", "배수아", "오태경", "남민준", "백서연",
    "정도현", "문하린", "서재원", "유가은", "장우석", "한소율",
    "표지훈", "노은별", "심태양", "배준호", "곽미래", "천시우"
  ];
  var signFields = [
    { label: "장소", value: "금강루" },
    { label: "재실", value: "2026-03-11 19:30–22:00" },
    { label: "주소", value: "한빛시 서구" },
    { label: "인원", value: "18명 서명" }
  ];
  var n;
  for (n = 0; n < names.length; n++) {
    signFields.push({ label: String(n + 1), value: names[n] + "  서명" });
  }
  return {
    id: "case04",
    title: "열여덟 명의 저녁",
    question: "금강루 회식 청구는 누가, 무엇을 부풀렸나.",
    difficulty: "어려움",
    minutes: 10,
    briefing: "2026-03-11 부장 윤가람이 회식비 4,200,000원을 청구했다. 서명부는 열여덟 명이다. 메인의 수량, 서명자 각자의 다른 영수증, 창고 주소의 등록 상호를 대조하라. 한 도시에 있던 사람은 모순이 아니다. 상한 초과만으로는 보고서를 닫지 못한다.",
    bridge: "간판과 등록이 다른 번호는 다음 철에서도 만납니다. 외워 두지 않아도 서류가 다시 올라옵니다.",
    epilogue: "열여덟 명은 서명으로만 존재합니다. 가게는 청람유통의 창고입니다. 청구한 사람은 윤가람입니다.",
    people: [
      { id: "yoon", name: "윤가람", role: "한빛물산 부장", suspect: true, bio: "회식을 법인카드로 결제하고 청구했다." },
      { id: "kim", name: "김하늘", role: "서명자", suspect: true, bio: "서명부에 있다. 같은 시각 다른 도시의 영수증도 있다." },
      { id: "bae", name: "배수아", role: "서명자", suspect: false, bio: "같은 밤 한빛시 서구 택시 영수증이 있다." },
      { id: "nam", name: "남민준", role: "서명자", suspect: false, bio: "서명부에 있다." },
      { id: "woo", name: "장우석", role: "서명자", suspect: false, bio: "저녁 전 중구 영수증이 있다." },
      { id: "ohk", name: "오태경", role: "서명자", suspect: false, bio: "서구 주차장 영수증이 있다." }
    ],
    crimes: [
      { id: "fake-dinner", label: "허위 회식" },
      { id: "false-ot", label: "허위 야근" },
      { id: "forgery", label: "영수증 위조" }
    ],
    accusation: { personId: "yoon", crimeId: "fake-dinner", requiredFindingIds: ["f-head", "f-ghost", "f-front"], entityId: null },
    hints: [
      "스테이크 수량, 김하늘의 저녁 일정, 창고 주소의 등록 상호.",
      "허위인원, 동선모순, 위장사업자입니다."
    ],
    docs: [
      {
        id: "stmt", kind: "statement", title: "윤가람 진술서", personId: "yoon",
        date: "2026-03-12", time: "", placeId: "seogu",
        fields: [
          { label: "진술인", value: "윤가람" },
          { label: "내용", value: "부서 회식 18명. 금강루. 내가 법인카드로 결제하고 청구했다." },
          { label: "일시", value: "2026-03-11 저녁" }
        ],
        marks: []
      },
      {
        id: "dinner", kind: "receipt", title: "금강루 영수증", personId: "yoon",
        date: "2026-03-11", time: "19:40", placeId: "seogu",
        fields: [
          { label: "상호", value: "금강루" },
          { label: "주소", value: "한빛시 서구 창고길 9 지하" },
          { label: "사업자번호", value: "814-22-01937" },
          { label: "일시", value: "2026-03-11 19:40" },
          { label: "인원", value: "18명" },
          { label: "품목", value: "한우 스테이크 6, 와인 4, 룸차지" },
          { label: "합계", value: "4,200,000원" },
          { label: "결제", value: "법인카드 2210" },
          { label: "결재", value: "윤가람" },
          { label: "봉사료", value: "현금 1,000,000원 (별도 기재)" }
        ],
        marks: [{ date: "2026-03-11", time: "19:40", label: "금강루" }]
      },
      {
        id: "sign", kind: "log", title: "회식 서명부", personId: "yoon",
        personIds: ["yoon", "kim", "bae", "nam", "woo", "ohk"],
        date: "2026-03-11", time: "19:30", placeId: "seogu",
        fields: signFields,
        marks: [{ date: "2026-03-11", time: "19:30", label: "서명 시작" }]
      },
      {
        id: "movie", kind: "receipt", title: "김하늘 영화", personId: "kim",
        date: "2026-03-11", time: "21:10", placeId: "bukwon",
        fields: [
          { label: "명의", value: "김하늘" },
          { label: "상호", value: "북원 시네마" },
          { label: "주소", value: "북원시 극장로 2" },
          { label: "일시", value: "2026-03-11 21:10" },
          { label: "품목", value: "영화  12,000원" },
          { label: "결제", value: "개인카드 5501" },
          { label: "합계", value: "12,000원" }
        ],
        marks: [{ date: "2026-03-11", time: "21:10", label: "김하늘 영화" }]
      },
      {
        id: "reg", kind: "registry", title: "사업자 등록 메모", personId: "yoon",
        date: "2026-01-08", time: "", placeId: "seogu",
        fields: [
          { label: "사업자번호", value: "814-22-01937" },
          { label: "상호", value: "청람유통" },
          { label: "업태", value: "도소매" },
          { label: "주소", value: "한빛시 서구 창고길 9" },
          { label: "업종 메모", value: "음식점이라는 단어 없음" }
        ],
        marks: []
      },
      {
        id: "baeTaxi", kind: "receipt", title: "배수아 택시", personId: "bae",
        date: "2026-03-11", time: "20:05", placeId: "seogu",
        fields: [
          { label: "명의", value: "배수아" },
          { label: "상호", value: "한빛콜" },
          { label: "하차", value: "한빛시 서구 창고길 인근" },
          { label: "일시", value: "2026-03-11 20:05" },
          { label: "합계", value: "8,400원" },
          { label: "결제", value: "개인카드 2208" }
        ],
        marks: [{ date: "2026-03-11", time: "20:05", label: "배수아 택시" }]
      },
      {
        id: "parkO", kind: "receipt", title: "오태경 주차", personId: "ohk",
        date: "2026-03-11", time: "19:22", placeId: "seogu",
        fields: [
          { label: "명의", value: "오태경" },
          { label: "상호", value: "서구공영주차장" },
          { label: "주소", value: "한빛시 서구" },
          { label: "일시", value: "2026-03-11 19:22" },
          { label: "합계", value: "3,000원" }
        ],
        marks: [{ date: "2026-03-11", time: "19:22", label: "오태경 주차" }]
      },
      {
        id: "woo", kind: "receipt", title: "장우석 간식", personId: "woo",
        date: "2026-03-11", time: "18:40", placeId: "hq",
        fields: [
          { label: "명의", value: "장우석" },
          { label: "상호", value: "별빛마트 중구점" },
          { label: "주소", value: "한빛시 중구" },
          { label: "일시", value: "2026-03-11 18:40" },
          { label: "품목", value: "김밥  4,500원" },
          { label: "합계", value: "4,500원" }
        ],
        marks: [{ date: "2026-03-11", time: "18:40", label: "장우석" }]
      },
      {
        id: "gas", kind: "receipt", title: "남민준 주유", personId: "nam",
        date: "2026-03-11", time: "20:50", placeId: "bukwon",
        fields: [
          { label: "명의", value: "남민준" },
          { label: "상호", value: "북원에너지" },
          { label: "주소", value: "북원시 국도로 88" },
          { label: "일시", value: "2026-03-11 20:50" },
          { label: "품목", value: "주유  62,000원" },
          { label: "결제", value: "개인카드 4402" },
          { label: "합계", value: "62,000원" }
        ],
        marks: [{ date: "2026-03-11", time: "20:50", label: "남민준 주유" }]
      }
    ],
    findings: [
      {
        id: "f-head", type: "허위인원", docIds: ["dinner"], optional: false,
        why: "메인이 여섯입니다. 열여덟 명이 한 상을 받은 영수증이 아닙니다."
      },
      {
        id: "f-ghost", type: "동선모순", docIds: ["sign", "movie"], optional: false,
        why: "서명부의 김하늘은 19:30부터 22:00까지 한빛시 서구입니다. 21:10 북원 영화관과 맞지 않습니다."
      },
      {
        id: "f-front", type: "위장사업자", docIds: ["dinner", "reg"], optional: false,
        why: "같은 번호 814-22-01937. 영수증 상호는 금강루, 등록 상호는 청람유통, 업태는 도소매, 주소는 창고입니다."
      },
      {
        id: "f-ghost2", type: "동선모순", docIds: ["sign", "gas"], optional: true,
        why: "남민준도 서명부의 재실 시간에 북원 주유소에 있습니다."
      }
    ]
  };
});
