(function (root, factory) {
  var data = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = data;
  root.SR = root.SR || {};
  root.SR.case01 = data;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  return {
    id: "case01",
    title: "야근 도시락",
    question: "박도윤의 3월 14일 야근은 사실인가.",
    difficulty: "입문",
    minutes: 6,
    briefing: "한빛물산 총무 대리 박도윤이 야근식대 8,500원을 청구했다. 진술과 출입기록은 문장으로 깔끔하다. 가맹점 대조 전표와 카드 사용분이 같은 밤을 가리키는지 보고 보고서를 쓰라. 횟집 메모는 아직 결론에 넣지 않아도 된다.",
    bridge: "남쪽 항만의 손글씨는 철에 남겨 두십시오. 이름이 되기 전에는 메모일 뿐입니다.",
    epilogue: "도시락 시각은 가맹점 번호가 배신했습니다. 휴게소 카드는 출입기록이 배신했고요. 횟집 메모의 '청람'은 아직 이름만 남기십시오.",
    people: [
      { id: "park", name: "박도윤", role: "한빛물산 총무 대리", suspect: true, bio: "야근식대 8,500원을 청구했다. 개인카드 끝자리는 3812." },
      { id: "jung", name: "정도현", role: "총무 주임", suspect: false, bio: "같은 밤 본사 근처 택시 영수증이 있다. 카드는 1190." }
    ],
    crimes: [
      { id: "false-ot", label: "허위 야근" },
      { id: "embezzle", label: "횡령" },
      { id: "slush", label: "비자금 수수" }
    ],
    accusation: { personId: "park", crimeId: "false-ot", requiredFindingIds: ["f-time", "f-route"], entityId: null },
    hints: [
      "별빛마트 단말기 번호와, 본사에 남아 있다던 시각의 카드 한 장을 나란히 보시오.",
      "시각변조, 그리고 동선모순입니다."
    ],
    docs: [
      {
        id: "stmt", kind: "statement", title: "박도윤 진술서", personId: "park",
        date: "2026-03-16", time: "", placeId: "hq",
        fields: [
          { label: "진술인", value: "박도윤" },
          { label: "일자", value: "2026-03-14 21:00 ~ 03-15 01:00" },
          { label: "장소", value: "한빛시 중구 본사" },
          { label: "내용", value: "혼자 야근했다. 22:14 본사 1층 별빛마트에서 도시락을 샀다." },
          { label: "동행", value: "없음" }
        ],
        marks: []
      },
      {
        id: "gate", kind: "log", title: "본사 출입기록", personId: "park",
        date: "2026-03-14", time: "21:05", placeId: "hq",
        fields: [
          { label: "장소", value: "한빛시 중구 본사 게이트" },
          { label: "대상", value: "박도윤" },
          { label: "IN", value: "2026-03-14 21:05" },
          { label: "OUT", value: "2026-03-15 01:12" },
          { label: "사이 기록", value: "없음" }
        ],
        marks: [
          { date: "2026-03-14", time: "21:05", label: "본사 IN" },
          { date: "2026-03-15", time: "01:12", label: "본사 OUT" }
        ]
      },
      {
        id: "exp", kind: "ledger", title: "지출내역서", personId: "park",
        date: "2026-03-14", time: "22:14", placeId: "hq",
        fields: [
          { label: "청구인", value: "박도윤" },
          { label: "일시", value: "2026-03-14 22:14" },
          { label: "계정", value: "야근식대" },
          { label: "상호", value: "별빛마트 본사점" },
          { label: "금액", value: "8,500원" },
          { label: "결제", value: "카드 끝자리 3812" },
          { label: "영수증번호", value: "4820" }
        ],
        marks: [{ date: "2026-03-14", time: "22:14", label: "식대 청구" }]
      },
      {
        id: "mart", kind: "receipt", title: "별빛마트 영수증", personId: "park",
        date: "2026-03-14", time: "22:14", placeId: "hq",
        fields: [
          { label: "상호", value: "별빛마트 본사점" },
          { label: "주소", value: "한빛시 중구 청사로 12" },
          { label: "사업자번호", value: "120-33-10021" },
          { label: "단말기", value: "T-04" },
          { label: "영수증번호", value: "4820" },
          { label: "일시", value: "2026-03-14 22:14" },
          { label: "품목", value: "도시락 1  8,500원" },
          { label: "결제", value: "카드 끝자리 3812" },
          { label: "합계", value: "8,500원" }
        ],
        marks: [{ date: "2026-03-14", time: "22:14", label: "별빛마트" }]
      },
      {
        id: "seq", kind: "log", title: "가맹점 대조 전표 T-04", personId: "park",
        date: "2026-03-14", time: "21:02", placeId: "hq",
        fields: [
          { label: "단말기", value: "T-04  별빛마트 본사점" },
          { label: "4819", value: "21:02  생수  1,200원" },
          { label: "4820", value: "시각 공란  8,500원  (가맹점 보관본)" },
          { label: "4821", value: "21:40  김밥  3,200원" },
          { label: "비고", value: "같은 단말기의 번호는 시간순으로만 증가한다." }
        ],
        marks: [
          { date: "2026-03-14", time: "21:02", label: "T-04 4819" },
          { date: "2026-03-14", time: "21:40", label: "T-04 4821" }
        ]
      },
      {
        id: "rest", kind: "receipt", title: "남해휴게소 영수증", personId: "park",
        date: "2026-03-14", time: "22:47", placeId: "rest",
        fields: [
          { label: "상호", value: "남해휴게소 상행" },
          { label: "주소", value: "남해휴게소" },
          { label: "단말기", value: "H-19" },
          { label: "일시", value: "2026-03-14 22:47" },
          { label: "품목", value: "아메리카노  4,500원" },
          { label: "결제", value: "카드 끝자리 3812" },
          { label: "합계", value: "4,500원" }
        ],
        marks: [{ date: "2026-03-14", time: "22:47", label: "남해휴게소" }]
      },
      {
        id: "fish", kind: "receipt", title: "부두횟집 영수증", personId: "park",
        date: "2026-03-14", time: "23:28", placeId: "port",
        fields: [
          { label: "상호", value: "부두횟집" },
          { label: "주소", value: "남해항 부두길 4" },
          { label: "일시", value: "2026-03-14 23:28" },
          { label: "품목", value: "모둠회 2인  86,000원" },
          { label: "결제", value: "카드 끝자리 3812" },
          { label: "합계", value: "86,000원" },
          { label: "메모", value: "청람 건" }
        ],
        marks: [{ date: "2026-03-14", time: "23:28", label: "부두횟집" }]
      },
      {
        id: "park", kind: "receipt", title: "남해항 주차장", personId: "park",
        date: "2026-03-14", time: "23:41", placeId: "port",
        fields: [
          { label: "상호", value: "남해항 공영주차장" },
          { label: "주소", value: "남해항" },
          { label: "일시", value: "2026-03-14 23:41" },
          { label: "품목", value: "주차  2,000원" },
          { label: "결제", value: "카드 끝자리 3812" },
          { label: "합계", value: "2,000원" }
        ],
        marks: [{ date: "2026-03-14", time: "23:41", label: "남해항 주차" }]
      },
      {
        id: "taxiOther", kind: "receipt", title: "정도현 택시", personId: "jung",
        date: "2026-03-14", time: "23:10", placeId: "hq",
        fields: [
          { label: "승객", value: "정도현" },
          { label: "상호", value: "한빛콜" },
          { label: "주소", value: "한빛시 중구 청사로" },
          { label: "일시", value: "2026-03-14 23:10" },
          { label: "품목", value: "택시  7,200원" },
          { label: "결제", value: "카드 끝자리 1190" },
          { label: "합계", value: "7,200원" }
        ],
        marks: [{ date: "2026-03-14", time: "23:10", label: "정도현 택시" }]
      }
    ],
    findings: [
      {
        id: "f-time", type: "시각변조", docIds: ["mart", "seq"], optional: false,
        why: "번호는 시간순입니다. 4820은 21:02와 21:40 사이여야 합니다. 22:14는 나중에 쓴 시각입니다."
      },
      {
        id: "f-route", type: "동선모순", docIds: ["gate", "rest"],
        alts: [["gate", "fish"], ["gate", "park"]], optional: false,
        why: "게이트는 21:05부터 01:12까지 그를 본사 안에 둡니다. 그 구간의 카드는 남쪽에 있습니다."
      },
      {
        id: "f-stmt", type: "허위인원", docIds: ["stmt", "fish"], optional: true,
        why: "진술은 본사에서 혼자였다고 합니다. 영수증은 남해항에서 2인입니다."
      }
    ]
  };
});
