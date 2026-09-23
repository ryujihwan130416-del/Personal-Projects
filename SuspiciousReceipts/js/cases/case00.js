(function (root, factory) {
  var data = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = data;
  root.SR = root.SR || {};
  root.SR.case00 = data;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  return {
    id: "case00",
    title: "연습 전표",
    question: "제출된 시각은 단말기 번호와 맞는가.",
    difficulty: "견습",
    minutes: 4,
    briefing: "이건 사건이 아닙니다. 책상 사용법을 익히는 연습 전표입니다. 연습 영수증과 단말기 대조표만 나란히 보고, 번호가 시간순인지 확인한 뒤 보고서를 제출하십시오. 커피 영수증은 시각이 맞습니다. 넣지 마십시오.",
    bridge: "다음 철부터는 안내 막대가 없습니다. 규칙은 매뉴얼에 있습니다.",
    epilogue: "100번은 101번보다 이를 수 없습니다. 18:40은 나중에 적은 시각입니다. 진짜 철은 다음 폴더입니다.",
    tutorial: [
      { until: "seen", doc: "slip", pulse: "doc:slip", text: "왼쪽에서 연습 영수증을 여십시오." },
      { until: "pin", doc: "slip", pulse: "pin", text: "대조에 올리기를 누르십시오. 서류는 최대 세 장입니다." },
      { until: "seen", doc: "seq", pulse: "doc:seq", text: "단말기 대조표를 여십시오. 번호는 시간순으로만 커집니다." },
      { until: "pin", doc: "seq", pulse: "pin", text: "대조표도 대조 칸에 올리십시오. 커피는 올리지 마십시오." },
      { until: "found", id: "f-drill", pulse: "file", text: "모순 유형을 시각변조로 바꾸고 지적 올리기를 누르십시오." },
      { until: "closed", pulse: "report", text: "보고서를 여십시오. 대상은 서도담, 위반은 연습 오독입니다." }
    ],
    people: [
      { id: "seo", name: "서도담", role: "견습 조사관", suspect: true, bio: "연습 영수증을 제출했다. 카드 끝자리는 0101." }
    ],
    crimes: [
      { id: "drill", label: "연습 오독" },
      { id: "false-ot", label: "허위 야근" }
    ],
    accusation: { personId: "seo", crimeId: "drill", requiredFindingIds: ["f-drill"], entityId: null },
    hints: [
      "연습 영수증의 번호와, 같은 단말기의 앞뒤 번호를 나란히 보시오.",
      "시각변조입니다. 커피는 빼십시오."
    ],
    docs: [
      {
        id: "slip", kind: "receipt", title: "연습마트", personId: "seo",
        date: "2026-03-02", time: "18:40", placeId: "hq",
        fields: [
          { label: "상호", value: "연습마트 교육점" },
          { label: "주소", value: "한빛시 중구 청사로 1" },
          { label: "사업자번호", value: "000-00-00000" },
          { label: "단말기", value: "T-00" },
          { label: "영수증번호", value: "100" },
          { label: "일시", value: "2026-03-02 18:40" },
          { label: "품목", value: "김밥 1" },
          { label: "금액", value: "3,000원" },
          { label: "결제", value: "카드 끝자리 0101" },
          { label: "합계", value: "3,000원" }
        ],
        marks: [{ date: "2026-03-02", time: "18:40", label: "연습 영수증" }]
      },
      {
        id: "seq", kind: "log", title: "단말기 대조표 T-00", personId: "seo",
        date: "2026-03-02", time: "18:10", placeId: "hq",
        fields: [
          { label: "단말기", value: "T-00  연습마트 교육점" },
          { label: "99", value: "18:10  생수  1,000원" },
          { label: "100", value: "시각 공란  3,000원  (교육용 보관본)" },
          { label: "101", value: "18:22  김밥  3,000원" },
          { label: "비고", value: "같은 단말기의 번호는 시간순으로만 증가한다." }
        ],
        marks: [
          { date: "2026-03-02", time: "18:10", label: "T-00 99" },
          { date: "2026-03-02", time: "18:22", label: "T-00 101" }
        ]
      },
      {
        id: "coffee", kind: "receipt", title: "청사 커피", personId: "seo",
        date: "2026-03-02", time: "18:05", placeId: "hq",
        fields: [
          { label: "상호", value: "청사 커피" },
          { label: "주소", value: "한빛시 중구 청사로 1" },
          { label: "영수증번호", value: "C-18" },
          { label: "일시", value: "2026-03-02 18:05" },
          { label: "품목", value: "아메리카노 1" },
          { label: "금액", value: "2,000원" },
          { label: "결제", value: "카드 끝자리 0101" },
          { label: "합계", value: "2,000원" }
        ],
        marks: [{ date: "2026-03-02", time: "18:05", label: "커피" }]
      }
    ],
    findings: [
      {
        id: "f-drill", type: "시각변조", optional: false,
        docIds: ["slip", "seq"],
        why: "번호는 시간순입니다. 100은 18:10과 18:22 사이여야 합니다. 18:40은 나중에 쓴 시각입니다."
      }
    ]
  };
});
