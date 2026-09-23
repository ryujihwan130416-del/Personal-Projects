(function (root, factory) {
  var data = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = data;
  root.SR = root.SR || {};
  root.SR.case05 = data;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  return {
    id: "case05",
    title: "빈 보고서",
    question: "블루컨설팅 자문료 청구는 사실인가.",
    difficulty: "어려움",
    minutes: 8,
    briefing: "2월에 한빛물산이 블루컨설팅과 자문 계약을 맺었습니다. 3월 청구가 들어왔습니다. 보고서에는 청구서에 결재한 사람을 적으십시오. 돈을 받은 사람의 이름만으로는 이 철이 닫히지 않습니다. 자금 경로는 청구서, 이체확인의 예금주, 개인 입금전표 세 장이 모일 때 성립합니다.",
    bridge: "자문 계약의 주소와 번호를 의견서 책상으로 가져가겠습니다. 다시 찾지 않아도 됩니다.",
    epilogue: "자문은 한 장짜리 문장입니다. 계좌의 이름은 청람유통이고, 같은 금액이 최민재에게 닿습니다. 도장은 윤가람입니다.",
    people: [
      { id: "yoon", name: "윤가람", role: "한빛물산 부장", suspect: true, bio: "블루컨설팅 계약과 3월 청구에 결재했다." },
      { id: "choi", name: "최민재", role: "영업 대리", suspect: true, bio: "같은 날 같은 금액을 상담료로 받았다. 이 철의 정답 인물은 아니다." },
      { id: "ohk", name: "오태경", role: "총무팀장", suspect: false, bio: "한결법률 청구의 결재자." }
    ],
    crimes: [
      { id: "fake-exp", label: "허위 자문" },
      { id: "slush", label: "비자금 수수" },
      { id: "false-ot", label: "허위 야근" }
    ],
    accusation: { personId: "yoon", crimeId: "fake-exp", requiredFindingIds: ["f-shell", "f-pipe"], entityId: null },
    hints: [
      "계약 상호와 등록 상호, 그리고 같은 날 6,000,000원이 오간 종이 세 장.",
      "위장사업자와 자금출처입니다."
    ],
    docs: [
      {
        id: "contract", kind: "statement", title: "자문 계약서", personId: "yoon",
        date: "2026-02-01", time: "", placeId: "seogu",
        fields: [
          { label: "일자", value: "2026-02-01" },
          { label: "갑", value: "한빛물산" },
          { label: "을", value: "블루컨설팅" },
          { label: "주소", value: "한빛시 서구 창고길 9" },
          { label: "사업자번호", value: "814-22-01937" },
          { label: "월액", value: "6,000,000원" },
          { label: "결재", value: "윤가람" }
        ],
        marks: [{ date: "2026-02-01", time: "10:00", label: "계약" }]
      },
      {
        id: "reg", kind: "registry", title: "청람유통 등록", personId: "yoon",
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
        id: "invoice", kind: "ledger", title: "3월 자문 청구서", personId: "yoon",
        date: "2026-03-01", time: "09:30", placeId: "seogu",
        fields: [
          { label: "일자", value: "2026-03-01" },
          { label: "청구", value: "블루컨설팅" },
          { label: "사업자번호", value: "814-22-01937" },
          { label: "적요", value: "3월 자문료 및 회의" },
          { label: "금액", value: "6,000,000원" },
          { label: "결재", value: "윤가람" }
        ],
        marks: [{ date: "2026-03-01", time: "09:30", label: "자문 청구" }]
      },
      {
        id: "bank", kind: "log", title: "이체확인", personId: "yoon",
        date: "2026-03-01", time: "11:05", placeId: "hq",
        fields: [
          { label: "일시", value: "2026-03-01 11:05" },
          { label: "출금", value: "한빛물산 운영계좌" },
          { label: "금액", value: "6,000,000원" },
          { label: "적요", value: "블루컨설팅 3월" },
          { label: "예금주", value: "청람유통" },
          { label: "상대 사업자", value: "814-22-01937" }
        ],
        marks: [{ date: "2026-03-01", time: "11:05", label: "이체" }]
      },
      {
        id: "deposit", kind: "ledger", title: "최민재 입금전표", personId: "choi",
        date: "2026-03-01", time: "15:40", placeId: "hq",
        fields: [
          { label: "일시", value: "2026-03-01 15:40" },
          { label: "수취", value: "최민재" },
          { label: "지급", value: "청람유통" },
          { label: "사업자번호", value: "814-22-01937" },
          { label: "적요", value: "상담료" },
          { label: "금액", value: "6,000,000원" }
        ],
        marks: [{ date: "2026-03-01", time: "15:40", label: "최민재 입금" }]
      },
      {
        id: "deliver", kind: "statement", title: "3월 자문 보고서", personId: "yoon",
        date: "2026-03-31", time: "", placeId: "seogu",
        fields: [
          { label: "작성", value: "블루컨설팅" },
          { label: "일자", value: "2026-03-31" },
          { label: "제목", value: "3월 자문" },
          { label: "참석", value: "윤가람 부장, 회의 1회 (3월)" },
          { label: "본문", value: "회의 참석 1회" },
          { label: "쪽수", value: "1" }
        ],
        marks: [{ date: "2026-03-31", time: "18:00", label: "보고서" }]
      },
      {
        id: "calendar", kind: "log", title: "윤가람 3월 일정표", personId: "yoon",
        date: "2026-03-31", time: "", placeId: "hq",
        fields: [
          { label: "대상", value: "윤가람" },
          { label: "기간", value: "2026년 3월" },
          { label: "외부 회의", value: "0건" },
          { label: "외부 출장", value: "0건" },
          { label: "본사 외 근무", value: "0건" }
        ],
        marks: []
      },
      {
        id: "lawyer", kind: "receipt", title: "한결법률 청구", personId: "ohk",
        date: "2026-03-12", time: "14:00", placeId: "hq",
        fields: [
          { label: "상호", value: "한결법률" },
          { label: "주소", value: "한빛시 중구 법조로 2" },
          { label: "사업자번호", value: "220-11-33001" },
          { label: "일시", value: "2026-03-12" },
          { label: "품목", value: "근로계약 검토  3쪽" },
          { label: "금액", value: "200,000원" },
          { label: "결재", value: "오태경" }
        ],
        marks: [{ date: "2026-03-12", time: "14:00", label: "한결법률" }]
      }
    ],
    findings: [
      {
        id: "f-shell", type: "위장사업자", docIds: ["contract", "reg"],
        alts: [["invoice", "reg"]], optional: false,
        why: "블루컨설팅과 청람유통이 같은 번호, 같은 창고입니다. 업태는 도소매입니다."
      },
      {
        id: "f-pipe", type: "자금출처", docIds: ["invoice", "bank", "deposit"], optional: false,
        why: "청구는 블루컨설팅, 예금주는 청람유통, 같은 날 같은 금액이 최민재 상담료로 들어갑니다."
      },
      {
        id: "f-empty", type: "위조영수증", docIds: ["deliver", "calendar"], optional: true,
        why: "보고서는 윤가람의 3월 회의를 한 번 적습니다. 일정표의 외부 회의는 영입니다."
      }
    ]
  };
});
