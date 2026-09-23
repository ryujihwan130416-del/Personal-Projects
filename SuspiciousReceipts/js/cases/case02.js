(function (root, factory) {
  var data = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = data;
  root.SR = root.SR || {};
  root.SR.case02 = data;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  return {
    id: "case02",
    title: "토너의 가격",
    question: "최민재의 3월 소비는 급여로 설명이 되는가.",
    difficulty: "보통",
    minutes: 8,
    briefing: "영업 대리 최민재. 회사가 받은 지출내역서는 단출하다. 개인 카드 원장과 입금 전표가 따로 왔다. 부품 이름은 취미로 두십시오. 보고서에는 돈의 출처와, 계정과목이 바뀐 줄을 적으십시오. 합계는 적혀 있지 않습니다. 더하십시오.",
    bridge: "결재란의 이름은 밑줄만 치십시오. 아직 그의 사건이 아닙니다.",
    epilogue: "부품 이름은 취미로 두십시오. 돈은 청람유통에서 나와 계정과목만 갈아타고 있습니다. 결재란의 윤가람은 밑줄만 치십시오.",
    people: [
      { id: "choi", name: "최민재", role: "한빛물산 영업 대리", suspect: true, bio: "3월 실수령 3,200,000원. 개인카드 끝자리는 7741. 다른 소득은 없다고 적혀 있다." },
      { id: "yoon", name: "윤가람", role: "한빛물산 부장", suspect: false, bio: "지출내역서 결재란에 이름이 있다. 이 사건의 청구인은 아니다." }
    ],
    crimes: [
      { id: "slush", label: "비자금 수수" },
      { id: "false-ot", label: "허위 야근" },
      { id: "forgery", label: "영수증 위조" }
    ],
    accusation: { personId: "choi", crimeId: "slush", requiredFindingIds: ["f-cat", "f-gap", "f-src"], entityId: null },
    hints: [
      "토너라고 적힌 줄과 같은 금액의 카드 줄을 보시오. 그다음 입금 전표의 지급인입니다.",
      "계정위장 하나, 자금출처 둘입니다."
    ],
    docs: [
      {
        id: "pay", kind: "statement", title: "3월 급여명세서", personId: "choi",
        date: "2026-03-25", time: "", placeId: "hq",
        fields: [
          { label: "성명", value: "최민재" },
          { label: "귀속", value: "2026년 3월" },
          { label: "실수령", value: "3,200,000원" },
          { label: "신고", value: "신고된 다른 소득 없음" }
        ],
        marks: []
      },
      {
        id: "exp", kind: "ledger", title: "지출내역서", personId: "choi",
        date: "2026-03-04", time: "", placeId: "hq",
        fields: [
          { label: "03-04", value: "사무용품 / 아펙스모터스 / 1,200,000원 / 토너 및 소모품 / 결재 윤가람" },
          { label: "03-11", value: "접대비 / 금강루 / 640,000원 / 결재 윤가람" },
          { label: "03-18", value: "교통비 / 한빛콜 택시 / 18,000원 / 결재 팀장" }
        ],
        marks: [
          { date: "2026-03-04", time: "11:00", label: "내역서 토너" },
          { date: "2026-03-11", time: "20:00", label: "내역서 금강루" },
          { date: "2026-03-18", time: "09:00", label: "내역서 택시" }
        ]
      },
      {
        id: "card", kind: "ledger", title: "개인카드 7741 원장", personId: "choi",
        date: "2026-03-02", time: "", placeId: "hq",
        fields: [
          { label: "카드", value: "끝자리 7741  명의 최민재" },
          { label: "03-02", value: "아펙스모터스 / 프론트 캘리퍼 / 6,400,000원" },
          { label: "03-04", value: "아펙스모터스 / 얼라인먼트 / 1,200,000원" },
          { label: "03-09", value: "아펙스모터스 / 카본 스포일러 / 7,800,000원" },
          { label: "03-11", value: "금강루 / 식사 / 640,000원" },
          { label: "03-21", value: "아펙스모터스 / 휠 너트 / 2,200,000원" }
        ],
        marks: [
          { date: "2026-03-02", time: "15:10", label: "캘리퍼" },
          { date: "2026-03-04", time: "16:40", label: "얼라인먼트" },
          { date: "2026-03-09", time: "14:05", label: "스포일러" },
          { date: "2026-03-11", time: "20:12", label: "금강루 개인" },
          { date: "2026-03-21", time: "13:20", label: "휠 너트" }
        ]
      },
      {
        id: "ins", kind: "ledger", title: "입금전표", personId: "choi",
        date: "2026-03-01", time: "", placeId: "hq",
        fields: [
          { label: "수취", value: "최민재" },
          { label: "지급인", value: "청람유통" },
          { label: "사업자번호", value: "814-22-01937" },
          { label: "03-01", value: "상담료  6,000,000원" },
          { label: "03-08", value: "상담료  6,000,000원" },
          { label: "03-15", value: "상담료  6,000,000원" }
        ],
        marks: [
          { date: "2026-03-01", time: "10:00", label: "상담료" },
          { date: "2026-03-08", time: "10:00", label: "상담료" },
          { date: "2026-03-15", time: "10:00", label: "상담료" }
        ]
      },
      {
        id: "workorder", kind: "log", title: "아펙스 작업지시서", personId: "choi",
        date: "2026-03-04", time: "16:20", placeId: "hq",
        fields: [
          { label: "상호", value: "아펙스모터스" },
          { label: "일시", value: "2026-03-04 16:20" },
          { label: "고객", value: "최민재" },
          { label: "작업", value: "얼라인먼트  1,200,000원" },
          { label: "메모", value: "세금계산서 품목은 토너/소모품. 결재는 윤가람 선으로." }
        ],
        marks: [{ date: "2026-03-04", time: "16:20", label: "작업지시" }]
      },
      {
        id: "tonerReal", kind: "receipt", title: "오피스한빛 영수증", personId: "choi",
        date: "2026-03-04", time: "09:12", placeId: "hq",
        fields: [
          { label: "상호", value: "오피스한빛" },
          { label: "주소", value: "한빛시 중구 문구로 3" },
          { label: "사업자번호", value: "140-22-88001" },
          { label: "일시", value: "2026-03-04 09:12" },
          { label: "품목", value: "토너 카트리지  48,000원" },
          { label: "결제", value: "카드 끝자리 7741" },
          { label: "합계", value: "48,000원" }
        ],
        marks: [{ date: "2026-03-04", time: "09:12", label: "진짜 토너" }]
      },
      {
        id: "phone", kind: "receipt", title: "통신요금", personId: "choi",
        date: "2026-03-07", time: "08:01", placeId: "hq",
        fields: [
          { label: "상호", value: "한빛통신" },
          { label: "일시", value: "2026-03-07" },
          { label: "품목", value: "3월 요금  89,000원" },
          { label: "결제", value: "카드 끝자리 7741" },
          { label: "합계", value: "89,000원" }
        ],
        marks: [{ date: "2026-03-07", time: "08:01", label: "통신요금" }]
      },
      {
        id: "taxi", kind: "receipt", title: "택시 영수증", personId: "choi",
        date: "2026-03-18", time: "08:40", placeId: "hq",
        fields: [
          { label: "상호", value: "한빛콜" },
          { label: "주소", value: "한빛시 중구" },
          { label: "일시", value: "2026-03-18 08:40" },
          { label: "품목", value: "택시  18,000원" },
          { label: "결제", value: "카드 끝자리 7741" },
          { label: "합계", value: "18,000원" }
        ],
        marks: [{ date: "2026-03-18", time: "08:40", label: "택시" }]
      },
      {
        id: "gym", kind: "receipt", title: "체육관 회비", personId: "choi",
        date: "2026-03-22", time: "07:30", placeId: "hq",
        fields: [
          { label: "상호", value: "중구체육관" },
          { label: "일시", value: "2026-03-22" },
          { label: "품목", value: "월 회비  45,000원" },
          { label: "결제", value: "카드 끝자리 7741" },
          { label: "합계", value: "45,000원" }
        ],
        marks: [{ date: "2026-03-22", time: "07:30", label: "회비" }]
      }
    ],
    findings: [
      {
        id: "f-cat", type: "계정위장", docIds: ["exp", "card"], optional: false,
        why: "같은 돈입니다. 03-04 1,200,000원이 내역서에는 토너, 원장에는 얼라인먼트입니다."
      },
      {
        id: "f-gap", type: "자금출처", docIds: ["pay", "card"], optional: false,
        why: "부품만 17,600,000원입니다. 실수령 3,200,000원의 3배를 넘습니다."
      },
      {
        id: "f-src", type: "자금출처", docIds: ["pay", "ins"], optional: false,
        why: "다른 소득이 없다던 명세서와 달리, 출처는 청람유통 상담료입니다."
      },
      {
        id: "f-order", type: "계정위장", docIds: ["exp", "workorder"], optional: true,
        why: "작업지시서에 품목을 토너로 바꾸라고 적혀 있습니다. 결재 이름은 윤가람입니다."
      }
    ]
  };
});
