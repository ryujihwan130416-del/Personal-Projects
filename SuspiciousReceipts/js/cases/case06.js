(function (root, factory) {
  var data = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = data;
  root.SR = root.SR || {};
  root.SR.case06 = data;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  return {
    id: "case06",
    title: "청람의 꼬리",
    question: "네 사건 너머로, 의견서를 어디까지 쓸 것인가.",
    difficulty: "최종",
    minutes: 12,
    briefing: "새 심문은 없습니다. 이미 본 서류와 오늘 도착한 출금 메모만 다시 펴십시오. 조직연결은 같은 번호가 찍힌 종이 두 장 이상, 결재연결은 결재란이 윤가람인 종이 두 장 이상이면 성립합니다. 항만은 횟집 메모와 출금 메모를 짝으로 올리십시오. 의견서는 근거가 닿는 범위에서 고릅니다. 넘치면 사건이 깨집니다.",
    bridge: "",
    epilogue: "",
    people: [
      { id: "yoon", name: "윤가람", role: "부장", suspect: true, bio: "토너 줄, 루프44, 금강루, 자문 계약의 결재란에 반복된다." },
      { id: "park", name: "박도윤", role: "총무 대리", suspect: true, bio: "3월 14일 밤의 카드와 이니셜이 이 책상에 다시 있다." },
      { id: "choi", name: "최민재", role: "영업 대리", suspect: true, bio: "상담료를 받았다. 결재자란의 이름은 아니다." },
      { id: "han", name: "한서준", role: "팀장", suspect: true, bio: "위조된 워크숍 식대의 사용자." },
      { id: "kim", name: "김하늘", role: "서명자", suspect: true, bio: "회식 서명부에 있고, 같은 시각 북원 영화관에 있다." },
      { id: "bae", name: "배수아", role: "사원", suspect: true, bio: "북원 워크숍과 서구 택시에 이름이 있다." }
    ],
    crimes: [
      { id: "org", label: "조직 비자금" },
      { id: "false-ot", label: "허위 야근" },
      { id: "fake-exp", label: "허위 경비" }
    ],
    accusation: null,
    hints: [
      "같은 등록번호가 찍힌 종이, 그리고 결재란에 반복되는 이름.",
      "조직연결, 결재연결, 그리고 항만은 조직연결 한 번 더입니다."
    ],
    docs: [
      {
        id: "p2-exp", kind: "ledger", title: "최민재 지출내역서 사본", personId: "choi",
        date: "2026-03-04", time: "11:00", placeId: "hq",
        fields: [
          { label: "03-04", value: "사무용품 / 아펙스모터스 / 1,200,000원 / 토너 및 소모품 / 결재 윤가람" },
          { label: "03-11", value: "접대비 / 금강루 / 640,000원 / 결재 윤가람" }
        ],
        marks: [{ date: "2026-03-04", time: "11:00", label: "토너 결재" }]
      },
      {
        id: "p2-ins", kind: "ledger", title: "최민재 입금전표 사본", personId: "choi",
        date: "2026-03-01", time: "10:00", placeId: "hq",
        fields: [
          { label: "지급인", value: "청람유통" },
          { label: "사업자번호", value: "814-22-01937" },
          { label: "수취", value: "최민재" },
          { label: "03-01", value: "상담료 6,000,000원" },
          { label: "03-08", value: "상담료 6,000,000원" },
          { label: "03-15", value: "상담료 6,000,000원" }
        ],
        marks: [{ date: "2026-03-01", time: "10:00", label: "상담료 사본" }]
      },
      {
        id: "p3-roof", kind: "receipt", title: "루프44 사본", personId: "han",
        date: "2026-03-20", time: "09:05", placeId: "gangnam",
        fields: [
          { label: "상호", value: "루프44" },
          { label: "금액", value: "420,000원" },
          { label: "적요", value: "북원 워크숍 식대" },
          { label: "결재", value: "윤가람" },
          { label: "일시", value: "2026-03-20 09:05" }
        ],
        marks: [{ date: "2026-03-20", time: "09:05", label: "루프44 사본" }]
      },
      {
        id: "p4-dinner", kind: "receipt", title: "금강루 사본", personId: "yoon",
        date: "2026-03-11", time: "19:40", placeId: "seogu",
        fields: [
          { label: "상호", value: "금강루" },
          { label: "사업자번호", value: "814-22-01937" },
          { label: "주소", value: "한빛시 서구 창고길 9 지하" },
          { label: "합계", value: "4,200,000원" },
          { label: "결재", value: "윤가람" },
          { label: "일시", value: "2026-03-11 19:40" }
        ],
        marks: [{ date: "2026-03-11", time: "19:40", label: "금강루 사본" }]
      },
      {
        id: "p4-reg", kind: "registry", title: "청람유통 등록 사본", personId: "yoon",
        date: "2026-01-08", time: "", placeId: "seogu",
        fields: [
          { label: "사업자번호", value: "814-22-01937" },
          { label: "상호", value: "청람유통" },
          { label: "업태", value: "도소매" },
          { label: "주소", value: "한빛시 서구 창고길 9" }
        ],
        marks: []
      },
      {
        id: "p5-contract", kind: "statement", title: "블루컨설팅 계약 사본", personId: "yoon",
        date: "2026-02-01", time: "10:00", placeId: "seogu",
        fields: [
          { label: "을", value: "블루컨설팅" },
          { label: "사업자번호", value: "814-22-01937" },
          { label: "주소", value: "한빛시 서구 창고길 9" },
          { label: "월액", value: "6,000,000원" },
          { label: "결재", value: "윤가람" }
        ],
        marks: [{ date: "2026-02-01", time: "10:00", label: "계약 사본" }]
      },
      {
        id: "p5-bank", kind: "log", title: "3월 1일 이체 사본", personId: "yoon",
        date: "2026-03-01", time: "11:05", placeId: "hq",
        fields: [
          { label: "금액", value: "6,000,000원" },
          { label: "적요", value: "블루컨설팅 3월" },
          { label: "예금주", value: "청람유통" },
          { label: "사업자번호", value: "814-22-01937" }
        ],
        marks: [{ date: "2026-03-01", time: "11:05", label: "이체 사본" }]
      },
      {
        id: "p1-fish", kind: "receipt", title: "부두횟집 사본", personId: "park",
        date: "2026-03-14", time: "23:28", placeId: "port",
        fields: [
          { label: "상호", value: "부두횟집" },
          { label: "주소", value: "남해항 부두길 4" },
          { label: "일시", value: "2026-03-14 23:28" },
          { label: "품목", value: "모둠회 2인  86,000원" },
          { label: "결제", value: "카드 끝자리 3812" },
          { label: "메모", value: "청람 건" }
        ],
        marks: [{ date: "2026-03-14", time: "23:28", label: "부두횟집 사본" }]
      },
      {
        id: "flow", kind: "flow", title: "청람유통 출금 메모", personId: "yoon",
        date: "2026-03-01", time: "09:00", placeId: "seogu",
        fields: [
          { label: "사업자", value: "청람유통  814-22-01937" },
          { label: "03-01", value: "최민재 상담료  6,000,000원" },
          { label: "03-08", value: "최민재 상담료  6,000,000원" },
          { label: "03-15", value: "최민재 상담료  6,000,000원" },
          { label: "03-11", value: "가맹 매출  4,200,000원  적요 금강루 (같은 번호의 자기 거래)" },
          { label: "03-14", value: "현금  2,000,000원  적요 항만 상담  수령 이니셜 ㅂㄷㅇ" }
        ],
        marks: [
          { date: "2026-03-01", time: "09:00", label: "출금 메모" },
          { date: "2026-03-14", time: "18:00", label: "항만 현금" }
        ]
      }
    ],
    findings: [
      {
        id: "f-org", type: "조직연결", optional: false,
        docIds: ["p2-ins", "p4-reg", "flow"],
        anyOf: ["p2-ins", "p4-reg", "flow", "p4-dinner", "p5-contract", "p5-bank"],
        min: 2,
        why: "상담료와 회식 간판과 출금과 계약이 한 번호, 814-22-01937입니다."
      },
      {
        id: "f-sign", type: "결재연결", optional: false,
        docIds: ["p2-exp", "p3-roof", "p4-dinner"],
        anyOf: ["p2-exp", "p3-roof", "p4-dinner", "p5-contract"],
        min: 2,
        why: "쓰는 사람은 달라도 결재란은 윤가람입니다."
      },
      {
        id: "f-port", type: "조직연결", optional: false,
        docIds: ["p1-fish", "flow"],
        why: "야근이 아니던 밤과 청람의 항만 현금이 같은 날짜입니다. 이니셜은 박도윤으로 남기되, 정점으로 올리지는 마십시오."
      }
    ],
    endings: [
      {
        id: "narrow",
        achievement: "ending-narrow",
        title: "결재만 남다",
        lead: "윤가람의 도장만 의견서에 남긴다.",
        requires: ["f-sign"],
        paragraphs: [
          "오세린이 의견서의 첫 문장만 읽는다. 결재자는 윤가람. 그 아래 사업자번호는 비어 있다.",
          "창고 상호와 항만 현금은 정황으로 밀린다. 과장은 도장을 반만 찍고, 나머지를 다음 철로 미룬다.",
          "사건은 사람 하나로 닫힌다. 주머니의 이름은 아직 서류철 밖에 있다."
        ]
      },
      {
        id: "company",
        achievement: "ending-company",
        title: "창고의 번호",
        lead: "윤가람과 청람유통을 함께 적는다.",
        requires: ["f-sign", "f-org"],
        paragraphs: [
          "번호 814-22-01937이 의견서 가운데에 들어간다. 금강루와 블루컨설팅과 상담료가 한 등록이다.",
          "윤가람은 그 번호에 도장을 찍은 사람이다. 창고 주소는 서구 창고길 9.",
          "3월 14일의 현금과 이니셜은 별건으로 남는다. 과장은 항만 쪽을 아직 열지 않는다."
        ]
      },
      {
        id: "full",
        achievement: "ending-full",
        title: "항만까지",
        lead: "결재, 사업자, ㅂㄷㅇ을 한 장에 적는다.",
        requires: ["f-sign", "f-org", "f-port"],
        paragraphs: [
          "이니셜 ㅂㄷㅇ가 박도윤으로 적힌다. 야근 도시락의 밤과 출금 메모의 항만 상담이 같은 문장이 된다.",
          "윤가람은 결재, 청람유통은 주머니, 박도윤은 그 밤의 카드다. 최민재의 부품은 돈이 새어 나간 자국으로 각주에 남는다.",
          "오세린이 도장을 끝까지 찍는다. 오늘 보고서는 여기까지다."
        ]
      },
      {
        id: "special",
        achievement: "ending-special",
        title: "특별조사",
        lead: "선택 서류까지 모은 전모.",
        requires: ["f-sign", "f-org", "f-port"],
        special: true,
        paragraphs: [
          "오세린이 본철 밖의 쪽지까지 센다. 2인 횟집, 품목을 바꾸라는 작업지시, 철거된 옥상로, 남민준의 주유, 빈 자문 보고서.",
          "결재는 윤가람, 번호는 청람유통, 이니셜은 박도윤. 각주가 본문만큼 길다.",
          "과장이 철을 다른 칸으로 옮긴다. 특별조사. 이 책상의 일은 여기서 넘긴다."
        ]
      },
      {
        id: "hold",
        achievement: "ending-hold",
        title: "보류",
        lead: "의견서를 쓰지 않고 철을 닫는다.",
        requires: [],
        hold: true,
        paragraphs: [
          "오세린이 빈 의견서를 돌려준다. 근거가 모자란 것이 아니라, 범위를 정하지 않겠다는 선택이다.",
          "서류는 캐비닛으로 돌아간다. 번호와 결재란과 이니셜은 그대로 밤에 남는다.",
          "보류 도장만 찍힌다. 다음 사람이 이 철을 다시 열 수 있다."
        ]
      },
      {
        id: "wrong-kim",
        achievement: "ending-wrong",
        title: "오판, 김하늘",
        lead: "김하늘을 정점으로 적는다.",
        requires: [],
        wrong: true,
        personId: "kim",
        paragraphs: [
          "의견서의 첫 줄이 김하늘이다. 오세린이 영화 영수증을 의견서 위에 겹친다.",
          "그는 회식 시각에 북원 시네마에 있었다. 결재란의 이름은 어디에도 그의 것이 아니다.",
          "의견서는 반려되지 않고 폐기된다. 조사가 다른 국으로 넘어가고, 이 철은 오판으로 닫힌다."
        ]
      },
      {
        id: "wrong-bae",
        achievement: "ending-wrong",
        title: "오판, 배수아",
        lead: "배수아를 정점으로 적는다.",
        requires: [],
        wrong: true,
        personId: "bae",
        paragraphs: [
          "배수아의 이름이 정점에 올라간다. 북원 분식과 서구 택시는 그 시각에 그가 그 도시에 있었음을 보여줄 뿐이다.",
          "워크숍의 가짜 식대도, 창고의 번호도, 그의 결재가 아니다.",
          "과장이 의견서를 접는다. 철은 오판으로 닫힌다."
        ]
      },
      {
        id: "wrong-choi",
        achievement: "ending-wrong",
        title: "오판, 최민재",
        lead: "최민재를 조직의 정점으로 적는다.",
        requires: [],
        wrong: true,
        personId: "choi",
        paragraphs: [
          "통장만 보면 최민재가 우두머리다. 상담료가 그의 이름으로 들어갔고, 부품이 그의 카드로 나갔다.",
          "계약의 도장, 회식의 도장, 가짜 식대의 도장은 윤가람이다. 돈을 받은 사람과 창구는 다르다.",
          "오세린이 의견서의 정점을 지운다. 철은 그 실수로 닫힌다."
        ]
      }
    ]
  };
});
