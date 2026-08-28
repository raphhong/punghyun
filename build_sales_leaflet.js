// 풍현 영업 파트너 안내 리플렛 (PPT)
// 출력: Downloads/풍현_영업안내_리플렛_260810.pptx
const pptxgen = require("pptxgenjs");
const p = new pptxgen();
p.layout = "LAYOUT_WIDE"; // 13.3 x 7.5

const NAVY = "0A1830", NAVY2 = "14243B", GREEN = "12A06D", MINT = "57D7A3";
const WHITE = "FFFFFF", LIGHT = "F4F7F6", CARD = "FFFFFF", INK = "1A2230";
const GREY = "5A6472", LINE = "DDE3E1";
const KF = "Malgun Gothic";

const W = 13.3, H = 7.5, M = 0.6;

function bg(slide, color) {
  slide.background = { color };
}
function card(slide, x, y, w, h, fill) {
  slide.addShape(p.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.09, fill: { color: fill || CARD },
    line: { color: LINE, width: 0.75 },
    shadow: { type: "outer", color: "AAB2BD", blur: 7, offset: 2, angle: 90, opacity: 0.28 },
  });
}
function numDot(slide, x, y, d, txt, fill, tcol) {
  slide.addShape(p.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color: fill || GREEN }, line: { width: 0 } });
  slide.addText(txt, { x, y, w: d, h: d, align: "center", valign: "middle", fontFace: KF, fontSize: 15, bold: true, color: tcol || WHITE, margin: 0 });
}
function title(slide, txt, color) {
  slide.addText(txt, { x: M, y: 0.42, w: W - 2 * M, h: 0.8, fontFace: KF, fontSize: 30, bold: true, color: color || NAVY, align: "left", margin: 0 });
}

// ============ SLIDE 1 : COVER ============
let s = p.addSlide();
bg(s, NAVY);
// motif: green ring top-right
s.addShape(p.ShapeType.ellipse, { x: 10.7, y: -1.4, w: 3.6, h: 3.6, fill: { color: NAVY2 }, line: { color: GREEN, width: 2 } });
s.addShape(p.ShapeType.ellipse, { x: 11.7, y: -0.4, w: 1.5, h: 1.5, fill: { color: GREEN }, line: { width: 0 } });
s.addText("영업 파트너 안내", { x: M, y: 2.15, w: 9, h: 0.5, fontFace: KF, fontSize: 18, bold: true, color: MINT, margin: 0 });
s.addText("풍현 자산 매입·렌탈(SRB)\n영업 파트너 모집 안내서", { x: M, y: 2.65, w: 10, h: 1.9, fontFace: KF, fontSize: 40, bold: true, color: WHITE, lineSpacing: 46, margin: 0 });
s.addText("사업자의 보유 장비를 매입·렌탈로 연결하고, 성사 건마다 수수료를 받는 영업 파트너 안내", { x: M, y: 4.7, w: 10.5, h: 0.6, fontFace: KF, fontSize: 15, color: "C7D0DA", margin: 0 });
s.addText("[ 회사명 · 로고 자리 ]", { x: M, y: 5.9, w: 6, h: 0.5, fontFace: KF, fontSize: 14, italic: true, color: "8A94A0", margin: 0 });
s.addText("2026 · 영업 파트너용 · 대외비", { x: M, y: 6.7, w: 8, h: 0.4, fontFace: KF, fontSize: 11, color: "6E7885", margin: 0 });

// ============ SLIDE 2 : 한 장 요약 ============
s = p.addSlide();
bg(s, LIGHT);
title(s, "한 장으로 이해하기");
s.addText("사업자(사장님)의 장비를 풍현이 제값에 사 주고, 그 장비를 그대로 3개월 빌려줍니다. 사장님은 필요한 현금을 즉시 확보하고, 3개월 뒤 장비를 되사가거나 반납합니다.",
  { x: M, y: 1.25, w: W - 2 * M, h: 0.9, fontFace: KF, fontSize: 15, color: INK, lineSpacing: 22, margin: 0 });

// 흐름 3단계
const fy = 2.35, fw = 3.55, fh = 1.35, gap = 0.55;
const flow = [
  ["① 장비 매입", "풍현이 사장님 장비를\n제값(시세)에 삽니다"],
  ["② 3개월 렌탈", "사장님은 장비를 그대로\n쓰며 사용료를 냅니다"],
  ["③ 되사기 / 반납", "만기에 되사가거나\n부담 없이 반납합니다"],
];
flow.forEach((f, i) => {
  const x = M + i * (fw + gap);
  card(s, x, fy, fw, fh, CARD);
  s.addText(f[0], { x: x + 0.25, y: fy + 0.18, w: fw - 0.5, h: 0.45, fontFace: KF, fontSize: 16, bold: true, color: GREEN, margin: 0 });
  s.addText(f[1], { x: x + 0.25, y: fy + 0.62, w: fw - 0.5, h: 0.6, fontFace: KF, fontSize: 12.5, color: INK, lineSpacing: 16, margin: 0 });
  if (i < 2) s.addText("▶", { x: x + fw + 0.06, y: fy + 0.45, w: 0.45, h: 0.5, align: "center", valign: "middle", fontFace: KF, fontSize: 16, bold: true, color: MINT, margin: 0 });
});

// 예시 박스
const ey = 4.15;
card(s, M, ey, W - 2 * M, 2.55, NAVY);
s.addText("예를 들면 (아주 쉽게)", { x: M + 0.35, y: ey + 0.25, w: 6, h: 0.45, fontFace: KF, fontSize: 16, bold: true, color: MINT, margin: 0 });
s.addText([
  { text: "식당 사장님이 3,000만 원짜리 주방설비를 갖고 있는데 당장 현금이 급합니다. 풍현이 이 설비를 제값에 사 줍니다.\n", options: { breakLine: true } },
  { text: "사장님은 설비를 그대로 쓰면서 3개월간 사용료를 냅니다. 3개월 뒤 되사가거나(대부분 되사감), 필요 없으면 반납합니다.\n", options: { breakLine: true } },
  { text: "→ 사장님은 현금을 얻고, 풍현은 되팔 수 있는 설비를 손에 쥔 채 사용료를 벌고, 영업 파트너는 성사 수수료를 받습니다.", options: {} },
], { x: M + 0.35, y: ey + 0.75, w: W - 2 * M - 0.7, h: 1.6, fontFace: KF, fontSize: 14, color: "EAF0F5", lineSpacing: 22, margin: 0 });

// ============ SLIDE 3 : 고객에게 좋은 점 (왜 팔리나) ============
s = p.addSlide();
bg(s, LIGHT);
title(s, "고객에게 이렇게 좋습니다 — 그래서 팔립니다");
const ben = [
  ["즉시 현금화", "보유 장비를 팔아 필요한 자금을 그 자리에서 확보합니다."],
  ["그대로 계속 사용", "팔아도 장비를 그대로 쓰므로 영업이 멈추지 않습니다."],
  ["반납이 자유", "만기에 반납하면 추가 부담 없이 깔끔하게 종료됩니다."],
  ["심플한 진행", "복잡한 금융 심사 대신, 보유 자산의 가치를 기준으로 빠르게 진행합니다."],
];
const bx0 = M, by0 = 1.5, bw = 5.9, bh = 2.35, bgap = 0.35;
ben.forEach((b, i) => {
  const col = i % 2, row = Math.floor(i / 2);
  const x = bx0 + col * (bw + bgap), y = by0 + row * (bh + bgap);
  card(s, x, y, bw, bh, CARD);
  numDot(s, x + 0.3, y + 0.3, 0.62, String(i + 1), GREEN);
  s.addText(b[0], { x: x + 1.1, y: y + 0.33, w: bw - 1.4, h: 0.55, fontFace: KF, fontSize: 19, bold: true, color: NAVY, valign: "middle", margin: 0 });
  s.addText(b[1], { x: x + 0.35, y: y + 1.1, w: bw - 0.7, h: 1.0, fontFace: KF, fontSize: 14, color: INK, lineSpacing: 21, margin: 0 });
});

// ============ SLIDE 4 : 수수료 구조 ============
s = p.addSlide();
bg(s, LIGHT);
title(s, "영업 수수료 구조");
s.addText("성사된 거래의 매입액(취급액)에 요율을 곱해 지급합니다. 많이 성사할수록 요율도 올라갑니다.",
  { x: M, y: 1.22, w: W - 2 * M, h: 0.5, fontFace: KF, fontSize: 14, color: INK, margin: 0 });

// 요율 테이블 (왼쪽)
s.addText("실적 구간별 수수료율", { x: M, y: 1.95, w: 6, h: 0.4, fontFace: KF, fontSize: 16, bold: true, color: GREEN, margin: 0 });
s.addTable([
  [{ text: "월 취급 실적 (매입액 합계)", options: { fill: NAVY, color: WHITE, bold: true, fontSize: 13 } },
   { text: "영업 수수료율", options: { fill: NAVY, color: WHITE, bold: true, fontSize: 13, align: "center" } }],
  [{ text: "30억 원 이하", options: { fontSize: 14, color: INK } }, { text: "2.0%", options: { fontSize: 15, bold: true, color: GREEN, align: "center" } }],
  [{ text: "30억 원 초과", options: { fontSize: 14, color: INK } }, { text: "2.5%", options: { fontSize: 15, bold: true, color: GREEN, align: "center" } }],
], { x: M, y: 2.4, w: 6.1, colW: [4.1, 2.0], rowH: [0.5, 0.7, 0.7], fontFace: KF, border: { type: "solid", color: LINE, pt: 1 }, valign: "middle", align: "left" });
s.addText("※ 요율·구간은 예시이며, 회사 수익구조 내에서 협의로 조정됩니다.",
  { x: M, y: 4.55, w: 6.1, h: 0.5, fontFace: KF, fontSize: 11, italic: true, color: GREY, margin: 0 });

// 지급방식 (오른쪽)
const rx = 7.1, rw = W - M - rx;
card(s, rx, 1.95, rw, 4.4, NAVY);
s.addText("지급 방식 — 선지급 + 만기 정산", { x: rx + 0.35, y: 2.2, w: rw - 0.7, h: 0.5, fontFace: KF, fontSize: 16, bold: true, color: MINT, margin: 0 });
numDot(s, rx + 0.4, 2.95, 0.6, "1", GREEN);
s.addText([{ text: "성사 시 30% 선지급\n", options: { bold: true, fontSize: 16, breakLine: true } },
  { text: "매입대금 지급(거래 성사) 시점에 수수료의 30%를 먼저 지급", options: { fontSize: 12.5 } }],
  { x: rx + 1.2, y: 2.9, w: rw - 1.55, h: 1.1, fontFace: KF, color: "EAF0F5", lineSpacing: 18, margin: 0 });
numDot(s, rx + 0.4, 4.25, 0.6, "2", GREEN);
s.addText([{ text: "3개월 만기 정산 시 70% 지급\n", options: { bold: true, fontSize: 16, breakLine: true } },
  { text: "고객이 되사기(인수)·반납으로 거래가 마무리되면 나머지 70% 지급", options: { fontSize: 12.5 } }],
  { x: rx + 1.2, y: 4.2, w: rw - 1.55, h: 1.1, fontFace: KF, color: "EAF0F5", lineSpacing: 18, margin: 0 });
s.addText("예) 15억 성사 → 3,000만 원 중 900만 원 즉시, 2,100만 원은 만기 정산 시",
  { x: rx + 0.35, y: 5.55, w: rw - 0.7, h: 0.6, fontFace: KF, fontSize: 12, italic: true, color: MINT, margin: 0 });

// ============ SLIDE 5 : 얼마 버나 ============
s = p.addSlide();
bg(s, NAVY);
s.addText("얼마나 벌 수 있나", { x: M, y: 0.42, w: 9, h: 0.8, fontFace: KF, fontSize: 30, bold: true, color: WHITE, margin: 0 });
// 스탯 콜아웃
const stat = [["월 3,000만 원 +", "월 15억 원 성사 시"], ["월 4,000만 원 +", "월 20억 원 성사 시"], ["월 1억 원 +", "최상위 파트너 (월 50억)"]];
const sw = 3.9, sgap = 0.35, sy = 1.4;
stat.forEach((st, i) => {
  const x = M + i * (sw + sgap);
  card(s, x, sy, sw, 1.7, NAVY2);
  s.addText(st[0], { x: x + 0.2, y: sy + 0.28, w: sw - 0.4, h: 0.75, align: "center", valign: "middle", fontFace: KF, fontSize: 26, bold: true, color: MINT, margin: 0 });
  s.addText(st[1], { x: x + 0.2, y: sy + 1.05, w: sw - 0.4, h: 0.5, align: "center", fontFace: KF, fontSize: 13, color: "C7D0DA", margin: 0 });
});
// 표
s.addTable([
  ["월 취급액 (매입액 합계)", "영업 수수료 (월)", "비고"].map(t => ({ text: t, options: { fill: GREEN, color: WHITE, bold: true, fontSize: 13, align: "center" } })),
  ...[["5억 원", "1,000만 원", ""], ["10억 원", "2,000만 원", ""], ["15억 원", "3,000만 원", "월 3천만 원"],
      ["20억 원", "4,000만 원", "월 4천만 원"], ["30억 원", "6,000만 원", ""], ["50억 원", "1억 2,500만 원", "2.5% 적용"]]
    .map(r => r.map((c, j) => ({ text: c, options: { fontSize: 13.5, color: "F4F7F6", align: j === 0 ? "left" : (j === 1 ? "right" : "center"), bold: j === 1 } }))),
], { x: M, y: 3.45, w: W - 2 * M, colW: [4.9, 4.0, 3.2], rowH: 0.44, fontFace: KF, border: { type: "solid", color: "2A3A52", pt: 1 }, valign: "middle", fill: { color: NAVY2 } });
s.addText("※ 예시이며 확정 수익이 아닙니다. 실제 취급 규모·성사율에 따라 달라지며, 팀·하위 영업 구성 시 취급액은 더 커질 수 있습니다.",
  { x: M, y: 6.55, w: W - 2 * M, h: 0.5, fontFace: KF, fontSize: 11, italic: true, color: "8A94A0", margin: 0 });

// ============ SLIDE 6 : 절차 · 기간 · 방식 ============
s = p.addSlide();
bg(s, LIGHT);
title(s, "신청 절차 · 기간 · 방식");
const steps = [
  ["상담·자산 접수", "영업 파트너가 고객의\n장비 정보를 전달"],
  ["자산 평가·매입가 산정", "시세 기준으로\n공정 매입가 산정"],
  ["계약 체결", "매매 계약 +\n렌탈 계약"],
  ["매입대금 지급", "고객이 즉시\n현금 확보"],
  ["3개월 렌탈 → 만기", "되사기 / 반납 /\n재계약 선택"],
];
const stw = 2.28, stgap = 0.14, sty = 1.7, sth = 2.5;
steps.forEach((st, i) => {
  const x = M + i * (stw + stgap);
  card(s, x, sty, stw, sth, CARD);
  numDot(s, x + stw / 2 - 0.32, sty + 0.28, 0.64, String(i + 1), GREEN);
  s.addText(st[0], { x: x + 0.12, y: sty + 1.05, w: stw - 0.24, h: 0.7, align: "center", valign: "middle", fontFace: KF, fontSize: 13.5, bold: true, color: NAVY, margin: 0 });
  s.addText(st[1], { x: x + 0.12, y: sty + 1.72, w: stw - 0.24, h: 0.65, align: "center", fontFace: KF, fontSize: 11.5, color: INK, lineSpacing: 15, margin: 0 });
  if (i < 4) s.addText("▶", { x: x + stw - 0.05, y: sty + 0.95, w: 0.24, h: 0.5, align: "center", valign: "middle", fontFace: KF, fontSize: 13, bold: true, color: MINT, margin: 0 });
});
// 기간/방식 카드
card(s, M, 4.75, 6.0, 1.75, CARD);
s.addText("소요 기간", { x: M + 0.3, y: 4.95, w: 5.4, h: 0.4, fontFace: KF, fontSize: 15, bold: true, color: GREEN, margin: 0 });
s.addText("자산 확인 완료 시, 접수 → 매입대금 지급까지\n평균 2~5 영업일", { x: M + 0.3, y: 5.4, w: 5.4, h: 0.95, fontFace: KF, fontSize: 14, color: INK, lineSpacing: 20, margin: 0 });
card(s, 6.9, 4.75, W - M - 6.9, 1.75, CARD);
s.addText("진행 방식", { x: 7.2, y: 4.95, w: 5.4, h: 0.4, fontFace: KF, fontSize: 15, bold: true, color: GREEN, margin: 0 });
s.addText("서류는 비대면 접수 가능\n고가·대량 자산은 현장 실사를 함께 진행", { x: 7.2, y: 5.4, w: W - M - 7.2, h: 0.95, fontFace: KF, fontSize: 14, color: INK, lineSpacing: 20, margin: 0 });

// ============ SLIDE 7 : 렌탈 조건 ============
s = p.addSlide();
bg(s, LIGHT);
title(s, "렌탈 조건 (렌탈료 · 되사기 · 반납)");
const rc = [
  ["렌탈 기간", "3개월", "만기 시점에 고객이 다음 중 하나를 자유롭게 선택합니다."],
  ["렌탈료", "개별 산정", "자산 종류·매입가·상태를 기준으로 산정하며, 계약 시 확정합니다."],
  ["만기 선택", "3가지", "① 반납(추가 부담 없음)  ② 되사기(계약 시 확정된 금액)  ③ 재계약"],
];
const rcw = 3.9, rcgap = 0.35, rcy = 1.55;
rc.forEach((r, i) => {
  const x = M + i * (rcw + rcgap);
  card(s, x, rcy, rcw, 3.4, CARD);
  s.addText(r[0], { x: x + 0.3, y: rcy + 0.28, w: rcw - 0.6, h: 0.45, fontFace: KF, fontSize: 15, bold: true, color: GREY, margin: 0 });
  s.addText(r[1], { x: x + 0.3, y: rcy + 0.8, w: rcw - 0.6, h: 0.85, fontFace: KF, fontSize: 30, bold: true, color: GREEN, margin: 0 });
  s.addText(r[2], { x: x + 0.3, y: rcy + 1.85, w: rcw - 0.6, h: 1.3, fontFace: KF, fontSize: 13.5, color: INK, lineSpacing: 20, margin: 0 });
});
card(s, M, 5.35, W - 2 * M, 1.1, NAVY);
s.addText("핵심: 고객은 '팔되 계속 쓰고', 만기엔 되사거나 반납. 미납 시에도 이자·연체가 아니라 장비 반납으로 정리됩니다.",
  { x: M + 0.35, y: 5.55, w: W - 2 * M - 0.7, h: 0.7, fontFace: KF, fontSize: 14, bold: true, color: "EAF0F5", valign: "middle", lineSpacing: 19, margin: 0 });

// ============ SLIDE 8 : 필요서류 ============
s = p.addSlide();
bg(s, LIGHT);
title(s, "신청 시 필요 서류");
const docs = [
  ["사업자등록증 사본", "고객(사업자) 확인"],
  ["대표자 신분증 사본", "본인 확인"],
  ["자산 매입 증빙", "세금계산서·영수증 원본 (소유 확인)"],
  ["자산 명세·사진", "모델명 / 제조번호(시리얼) 포함"],
  ["대금 입금용 통장 사본", "매입대금 지급 계좌"],
  ["카드 가맹·정산 정보", "카드매출 정산이 있는 경우"],
];
const dx0 = M, dy0 = 1.55, dw = 5.9, dh = 1.15, dgap = 0.25;
docs.forEach((d, i) => {
  const col = i % 2, row = Math.floor(i / 2);
  const x = dx0 + col * (dw + dgap), y = dy0 + row * (dh + dgap);
  card(s, x, y, dw, dh, CARD);
  s.addShape(p.ShapeType.ellipse, { x: x + 0.28, y: y + dh / 2 - 0.24, w: 0.48, h: 0.48, fill: { color: GREEN }, line: { width: 0 } });
  s.addText("✓", { x: x + 0.28, y: y + dh / 2 - 0.24, w: 0.48, h: 0.48, align: "center", valign: "middle", fontFace: KF, fontSize: 15, bold: true, color: WHITE, margin: 0 });
  s.addText(d[0], { x: x + 0.95, y: y + 0.2, w: dw - 1.2, h: 0.45, fontFace: KF, fontSize: 15.5, bold: true, color: NAVY, margin: 0 });
  s.addText(d[1], { x: x + 0.95, y: y + 0.62, w: dw - 1.2, h: 0.4, fontFace: KF, fontSize: 12.5, color: GREY, margin: 0 });
});
s.addText("※ 대리 진행 시 위임장·인감증명서가 추가로 필요할 수 있습니다. 자산 종류에 따라 등록원부 등 서류가 요청될 수 있습니다.",
  { x: M, y: 6.4, w: W - 2 * M, h: 0.5, fontFace: KF, fontSize: 11.5, italic: true, color: GREY, margin: 0 });

// ============ SLIDE 9 : 문의 ============
s = p.addSlide();
bg(s, NAVY);
s.addShape(p.ShapeType.ellipse, { x: -1.2, y: 5.4, w: 3.4, h: 3.4, fill: { color: NAVY2 }, line: { color: GREEN, width: 2 } });
s.addText("문의 및 신청", { x: M, y: 0.9, w: 9, h: 0.9, fontFace: KF, fontSize: 34, bold: true, color: WHITE, margin: 0 });
s.addText("아래로 연락 주시면 상담 후 바로 진행해 드립니다.", { x: M, y: 1.85, w: 10, h: 0.5, fontFace: KF, fontSize: 15, color: "C7D0DA", margin: 0 });
card(s, M, 2.7, W - 2 * M, 3.2, NAVY2);
const contact = [["회사명", "[                                   ]"], ["담당 직책", "[                                   ]"], ["담당자 (전화 받을 사람)", "[                                   ]"], ["연락처 (전화)", "[                                   ]"], ["이메일", "[                                   ]"]];
contact.forEach((c, i) => {
  const y = 2.95 + i * 0.56;
  s.addText(c[0], { x: M + 0.4, y, w: 4.2, h: 0.45, fontFace: KF, fontSize: 15, bold: true, color: MINT, valign: "middle", margin: 0 });
  s.addText(c[1], { x: M + 4.7, y, w: W - 2 * M - 5.1, h: 0.45, fontFace: KF, fontSize: 15, color: "EAF0F5", valign: "middle", margin: 0 });
});
s.addText("본 자료는 영업 파트너 안내용 참고 자료입니다. 수수료·요율·조건은 예시이며 회사와의 협의·계약으로 확정됩니다. 수익을 보장하지 않으며, 관련 법령 준수를 위해 세부 조건은 변경될 수 있습니다. 대외비 · 무단 배포 금지.",
  { x: M, y: 6.25, w: W - 2 * M, h: 0.9, fontFace: KF, fontSize: 10.5, color: "8A94A0", lineSpacing: 15, margin: 0 });

const OUT = "C:/Users/sol hong/Downloads/풍현_영업안내_리플렛_260810.pptx";
p.writeFile({ fileName: OUT }).then(() => console.log("saved", OUT));
