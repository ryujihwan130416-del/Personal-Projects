(function (root, factory) {
  var data = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = data;
  root.SR = root.SR || {};
  root.SR.case03 = data;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  return {
    id: "case03",
    title: "같은 아침의 두 도시",
    question: "한서준의 북원 워크숍 경비 중 거짓은 어느 장인가.",
    difficulty: "보통",
    minutes: 8,
    briefing: "팀장 한서준이 3월 20일 북원 워크숍 경비를 법인카드로 청구했다. 카드사 로그가 종이보다 하루 늦게 도착했다. 구내식당까지는 먼저 믿어도 됩니다. 같은 번호가 두 도시에 있으면 그 종이를 의심하십시오.",
    bridge: "42만 원의 결재란을 기억해 두십시오. 워크숍 자체는 구내식당까지 진짜입니다.",
    epilogue: "워크숍은 구내식당까지는 진짜입니다. 42만 원짜리가 가짜고, 결재는 또 윤가람입니다.",
    people: [
      { id: "han", name: "한서준", role: "한빛물산 팀장", suspect: true, bio: "법인카드 끝자리 9090의 명의자. 북원 워크숍 경비를 청구했다." },
      { id: "bae", name: "배수아", role: "한빛물산 사원", suspect: true, bio: "출석부에 이름이 있다. 보고서의 오답으로 남아 있다." },
      { id: "ohk", name: "오태경", role: "사원", suspect: false, bio: "출석부와 북원 문구 영수증에 나온다." }
    ],
    crimes: [
      { id: "fake-exp", label: "허위 경비" },
      { id: "false-ot", label: "허위 야근" },
      { id: "slush", label: "비자금 수수" }
    ],
    accusation: { personId: "han", crimeId: "fake-exp", requiredFindingIds: ["f-route", "f-fake"], entityId: null },
    hints: [
      "북원 아침 영수증과 강남 영수증의 번호, 그리고 카드사 로그의 빈 시각을 보시오.",
      "동선모순과 위조영수증입니다."
    ],
    docs: [
      {
        id: "stmt", kind: "statement", title: "한서준 진술서", personId: "han",
        date: "2026-03-22", time: "", placeId: "bukwon",
        fields: [
          { label: "진술인", value: "한서준" },
          { label: "일자", value: "2026-03-20 09:00–18:00" },
          { label: "장소", value: "북원 워크숍" },
          { label: "내용", value: "아침은 호텔, 점심은 구내식당. 법인카드 9090으로 결제했다." }
        ],
        marks: []
      },
      {
        id: "hotel", kind: "receipt", title: "북원 호텔 조식", personId: "han",
        date: "2026-03-20", time: "08:20", placeId: "bukwon",
        fields: [
          { label: "상호", value: "북원 비즈니스호텔" },
          { label: "주소", value: "북원시 회의로 1" },
          { label: "사업자번호", value: "310-70-44110" },
          { label: "영수증번호", value: "B-220" },
          { label: "일시", value: "2026-03-20 08:20" },
          { label: "품목", value: "조식 1인  19,000원" },
          { label: "결제", value: "법인카드 9090  실시간" },
          { label: "합계", value: "19,000원" }
        ],
        marks: [{ date: "2026-03-20", time: "08:20", label: "북원 조식" }]
      },
      {
        id: "cafeteria", kind: "receipt", title: "북원 구내식당", personId: "han",
        date: "2026-03-20", time: "12:30", placeId: "bukwon",
        fields: [
          { label: "상호", value: "북원 구내식당" },
          { label: "주소", value: "북원시 회의로 1" },
          { label: "영수증번호", value: "N-088" },
          { label: "일시", value: "2026-03-20 12:30" },
          { label: "품목", value: "점심  12,000원" },
          { label: "결제", value: "법인카드 9090  실시간" },
          { label: "합계", value: "12,000원" }
        ],
        marks: [{ date: "2026-03-20", time: "12:30", label: "구내식당" }]
      },
      {
        id: "roof", kind: "receipt", title: "루프44 영수증", personId: "han",
        date: "2026-03-20", time: "09:05", placeId: "gangnam",
        fields: [
          { label: "상호", value: "루프44" },
          { label: "주소", value: "한빛시 강남구 옥상로 44" },
          { label: "사업자번호", value: "505-10-22008" },
          { label: "영수증번호", value: "B-220" },
          { label: "일시", value: "2026-03-20 09:05" },
          { label: "품목", value: "코스  420,000원" },
          { label: "적요", value: "북원 워크숍 식대" },
          { label: "결제", value: "법인카드 9090" },
          { label: "결재", value: "윤가람" },
          { label: "합계", value: "420,000원" }
        ],
        marks: [{ date: "2026-03-20", time: "09:05", label: "루프44" }]
      },
      {
        id: "approvals", kind: "log", title: "카드사 승인로그", personId: "han",
        date: "2026-03-20", time: "08:20", placeId: "bukwon",
        fields: [
          { label: "카드", value: "법인 9090" },
          { label: "03-20 08:20", value: "북원 비즈니스호텔  19,000원  실시간 AP-8811" },
          { label: "03-20 09:05", value: "승인 없음" },
          { label: "03-20 12:30", value: "북원 구내식당  12,000원  실시간 AP-8842" },
          { label: "03-21 11:40", value: "수기승인 AP-8890  420,000원  루프44  메모 전일 소급" }
        ],
        marks: [
          { date: "2026-03-20", time: "08:20", label: "승인 호텔" },
          { date: "2026-03-20", time: "12:30", label: "승인 구내" },
          { date: "2026-03-21", time: "11:40", label: "수기승인" }
        ]
      },
      {
        id: "closed", kind: "registry", title: "루프44 사업자 메모", personId: "han",
        date: "2025-11-01", time: "", placeId: "gangnam",
        fields: [
          { label: "상호", value: "루프44" },
          { label: "사업자번호", value: "505-10-22008" },
          { label: "상태", value: "폐업" },
          { label: "폐업일", value: "2025-11-01" }
        ],
        marks: []
      },
      {
        id: "sheet", kind: "log", title: "북원 출석부", personId: "han",
        personIds: ["han", "bae", "ohk"],
        date: "2026-03-20", time: "09:00", placeId: "bukwon",
        fields: [
          { label: "장소", value: "북원 워크숍" },
          { label: "시각", value: "2026-03-20 09:00" },
          { label: "1", value: "한서준  서명" },
          { label: "2", value: "배수아  서명" },
          { label: "3", value: "오태경  서명" }
        ],
        marks: [{ date: "2026-03-20", time: "09:00", label: "출석" }]
      },
      {
        id: "baeLunch", kind: "receipt", title: "배수아 북원 분식", personId: "bae",
        date: "2026-03-20", time: "12:10", placeId: "bukwon",
        fields: [
          { label: "명의", value: "배수아" },
          { label: "상호", value: "북원분식" },
          { label: "주소", value: "북원시 회의로 8" },
          { label: "일시", value: "2026-03-20 12:10" },
          { label: "품목", value: "김치찌개  9,000원" },
          { label: "결제", value: "개인카드 2208" },
          { label: "합계", value: "9,000원" }
        ],
        marks: [{ date: "2026-03-20", time: "12:10", label: "배수아 점심" }]
      },
      {
        id: "lot", kind: "registry", title: "옥상로 44 현황", personId: "han",
        date: "2025-12-02", time: "", placeId: "gangnam",
        fields: [
          { label: "주소", value: "한빛시 강남구 옥상로 44" },
          { label: "현황", value: "철거 공터" },
          { label: "철거일", value: "2025-12-02" },
          { label: "건물", value: "없음" }
        ],
        marks: []
      }
    ],
    findings: [
      {
        id: "f-route", type: "동선모순", docIds: ["hotel", "roof"], optional: false,
        why: "북원 08:20과 한빛 강남 09:05입니다. 최소 150분인데 간격은 45분입니다."
      },
      {
        id: "f-fake", type: "위조영수증", docIds: ["roof", "approvals", "closed"],
        alts: [["roof", "approvals"], ["roof", "closed"], ["hotel", "roof"]],
        optional: false,
        why: "420,000원은 다음 날 수기로 들어갔습니다. 번호 B-220은 호텔과 같고, 사업자는 이미 폐업입니다."
      },
      {
        id: "f-lot", type: "위조영수증", docIds: ["roof", "lot"], optional: true,
        why: "옥상로 44는 지난해 12월에 철거된 공터입니다. 그 주소의 코스 요리는 건물이 없습니다."
      }
    ]
  };
});
