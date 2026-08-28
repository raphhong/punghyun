// 풍현 고객 안내 리플렛 (영업자가 고객에게 제시하는 세일즈 자료)
// 출력: Downloads/풍현_고객안내_리플렛_260818.pptx
const pptxgen = require("pptxgenjs");
const p = new pptxgen();
p.layout = "LAYOUT_WIDE"; // 13.3 x 7.5

const NAVY = "0A1830", NAVY2 = "14243B", GREEN = "12A06D", MINT = "57D7A3";
const WHITE = "FFFFFF", LIGHT = "F4F7F6", CARD = "FFFFFF", INK = "1A2230";
const GREY = "5A6472", LINE = "DDE3E1";
const KF = "Malgun Gothic";

const W = 13.3, H = 7.5, M = 0.6;

function bg(slide, color) { slide.background = { color }; }
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
s.addShape(p.ShapeType.ellipse, { x: 10.7, y: -1.4, w: 3.6, h: 3.6, fill: { color: NAVY2 }, line: { color: GREEN, width: 2 } });
s.addShape(p.ShapeType.ellipse, { x: 11.7, y: -0.4, w: 1.5, h: 1.5, fill: { color: GREEN }, line: { width: 0 } });
s.addText("자산 매입 · 렌탈 (Sale & Rental Back)", { x: M, y: 2.05, w: 10, h: 0.5, fontFace: KF, fontSize: 18, bold: true, color: MINT, margin: 0 });
s.addText("장비는 그대로 쓰고,\n필요한 자금은 지금.", { x: M, y: 2.55, w: 11, h: 1.9, fontFace: KF, fontSize: 42, bold: true, color: WHITE, lineSpacing: 50, margin: 0 });
s.addText("보유 장비를 풍현이 제값에 매입하고, 그 장비를 그대로 렌탈로 계속 사용하세요.", { x: M, y: 4.7, w: 11, h: 0.5, fontFace: KF, fontSize: 15, color: "C7D0DA", margin: 0 });
// 후킹 배지
const pill = ["팔아도 장비 그대로 사용", "렌탈료 전액 비용처리", "부가세 매입세액 공제"];
let px = M;
pill.forEach((t) => {
  const pw = 0.42 + t.length * 0.205;
  s.addShape(p.ShapeType.roundRect, { x: px, y: 5.45, w: pw, h: 0.52, rectRadius: 0.26, fill: { color: NAVY2 }, line: { color: GREEN, width: 1 } });
  s.addText("✓ " + t, { x: px, y: 5.45, w: pw, h: 0.52, align: "center", valign: "middle", fontFace: KF, fontSize: 12.5, bold: true, color: MINT, margin: 0 });
  px += pw + 0.25;
});
s.addText("[ 회사명 · 로고 자리 ]", { x: M, y: 6.25, w: 6, h: 0.5, fontFace: KF, fontSize: 14, italic: true, color: "8A94A0", margin: 0 });
s.addText("2026 · 고객 안내용", { x: M, y: 6.85, w: 8, h: 0.4, fontFace: KF, fontSize: 11, color: "6E7885", margin: 0 });

// ============ SLIDE 2 : 한 장으로 이해하기 ============
s = p.addSlide();
bg(s, LIGHT);
title(s, "한 장으로 이해하기");
s.addText("보유하신 장비를 풍현이 제값에 사 드립니다. 장비는 그대로 쓰시면서 3개월간 사용료만 내시고, 만기에 되사가거나 부담 없이 반납하시면 됩니다.",
  { x: M, y: 1.25, w: W - 2 * M, h: 0.9, fontFace: KF, fontSize: 15, color: INK, lineSpacing: 22, margin: 0 });

const fy = 2.35, fw = 3.55, fh = 1.35, gap = 0.55;
const flow = [
  ["① 장비 매입", "보유 장비를\n제값(시세)에 매입"],
  ["② 3개월 렌탈", "장비를 그대로 쓰며\n사용료만 납부"],
  ["③ 되사기 / 반납", "만기에 되사거나\n부담 없이 반납"],
];
flow.forEach((f, i) => {
  const x = M + i * (fw + gap);
  card(s, x, fy, fw, fh, CARD);
  s.addText(f[0], { x: x + 0.25, y: fy + 0.18, w: fw - 0.5, h: 0.45, fontFace: KF, fontSize: 16, bold: true, color: GREEN, margin: 0 });
  s.addText(f[1], { x: x + 0.25, y: fy + 0.62, w: fw - 0.5, h: 0.6, fontFace: KF, fontSize: 12.5, color: INK, lineSpacing: 16, margin: 0 });
  if (i < 2) s.addText("▶", { x: x + fw + 0.06, y: fy + 0.45, w: 0.45, h: 0.5, align: "center", valign: "middle", fontFace: KF, fontSize: 16, bold: true, color: MINT, margin: 0 });
});

const ey = 4.15;
card(s, M, ey, W - 2 * M, 2.55, NAVY);
s.addText("예를 들면", { x: M + 0.35, y: ey + 0.25, w: 6, h: 0.45, fontFace: KF, fontSize: 16, bold: true, color: MINT, margin: 0 });
s.addText([
  { text: "피부과 원장님이 5,000만 원짜리 레이저 장비를 갖고 있는데 당장 운영자금이 필요합니다. 풍현이 이 장비를 제값에 매입해 드립니다.\n", options: { breakLine: true } },
  { text: "원장님은 장비를 그대로 진료에 쓰면서 3개월간 사용료를 냅니다. 만기에 되사가거나(대부분 되사감), 필요 없으면 반납합니다.\n", options: { breakLine: true } },
  { text: "→ 원장님은 자금을 확보하고 진료도 멈추지 않으며, 만기엔 되사거나 깔끔하게 반납으로 정리합니다.", options: {} },
], { x: M + 0.35, y: ey + 0.75, w: W - 2 * M - 0.7, h: 1.6, fontFace: KF, fontSize: 14, color: "EAF0F5", lineSpacing: 22, margin: 0 });

// ============ SLIDE 2.5 : 만기 현금흐름 예시 (렌탈료·인수금액) ============
s = p.addSlide();
bg(s, LIGHT);
title(s, "반납·되사기 — 현금흐름 예시");
s.addText("매입가 5,000만 원 · 3개월 기준 예시입니다. (렌탈료는 매입가의 7.5%)",
  { x: M, y: 1.22, w: W - 2 * M, h: 0.5, fontFace: KF, fontSize: 14, color: INK, margin: 0 });

const hdr = ["구분", "반납을 선택하면", "되사가기(인수)를 선택하면"];
const cfrows = [
  ["지금 · 장비 매각 (매입대금)", "+ 5,000만 원", "+ 5,000만 원"],
  ["3개월 렌탈료 (매입가의 7.5%)", "− 375만 원", "− 375만 원"],
  ["만기", "장비 반납 · 추가 지출 없음", "되사기 − 5,000만 원 후 소유권 회복"],
  ["결과", "3개월간 자금 활용 후 종료", "장비를 계속 보유·사용"],
];
const cfTbl = [
  hdr.map((h, j) => ({ text: h, options: { fill: j === 2 ? GREEN : NAVY, color: WHITE, bold: true, fontSize: 13.5, align: j === 0 ? "left" : "center" } })),
  ...cfrows.map((r, ri) => r.map((c, j) => ({
    text: c,
    options: {
      fontSize: 13.5, bold: j === 0 || (j >= 1 && ri <= 1),
      color: j === 2 ? NAVY : INK,
      align: j === 0 ? "left" : "center",
      fill: j === 2 ? "E7F5EE" : (ri % 2 === 1 ? "F7F9FB" : WHITE),
    },
  }))),
];
s.addTable(cfTbl, { x: M, y: 1.95, w: W - 2 * M, colW: [4.3, 3.9, 3.9], rowH: 0.62, fontFace: KF, border: { type: "solid", color: LINE, pt: 1 }, valign: "middle" });

card(s, M, 5.35, W - 2 * M, 0.95, NAVY);
s.addText([
  { text: "핵심 — ", options: { bold: true, color: MINT } },
  { text: "어느 쪽이든 지금 5,000만 원을 확보합니다. 반납하면 추가 지출 없이 끝나고, 되사가면 계약 때 정한 금액으로 소유권을 되찾습니다.", options: { color: "EAF0F5" } },
], { x: M + 0.35, y: 5.35, w: W - 2 * M - 0.7, h: 0.95, fontFace: KF, fontSize: 13.5, valign: "middle", lineSpacing: 18, margin: 0 });
s.addText("* 렌탈료는 매입가의 7.5%(3개월) 예시입니다. 되사기 금액은 만기 잔존가치를 기준으로 계약 시 확정되며 시장 상황에 따라 달라질 수 있습니다. 실제 금액은 자산 평가·개별 협의로 정합니다.",
  { x: M, y: 6.45, w: W - 2 * M, h: 0.6, fontFace: KF, fontSize: 10.5, italic: true, color: GREY, margin: 0 });

// ============ SLIDE 3 : 이런 분께 딱 맞습니다 ============
s = p.addSlide();
bg(s, LIGHT);
title(s, "이런 분께 딱 맞습니다");
const fit = [
  ["보유 장비는 있는데 현금이 묶여 있다", "값나가는 장비에 묶인 자금을 다시 운영에 씁니다."],
  ["장비는 계속 써야 한다", "팔아도 장비를 그대로 쓰므로 영업·진료가 멈추지 않습니다."],
  ["당장 운영·확장 자금이 필요하다", "자산 가치를 기준으로 빠르게 자금을 확보합니다."],
  ["부담 없이 끝내고 싶다", "만기에 반납하면 추가 부담 없이 깔끔하게 종료됩니다."],
];
const fx0 = M, fy0 = 1.5, fbw = 5.9, fbh = 2.35, fbgap = 0.35;
fit.forEach((b, i) => {
  const col = i % 2, row = Math.floor(i / 2);
  const x = fx0 + col * (fbw + fbgap), y = fy0 + row * (fbh + fbgap);
  card(s, x, y, fbw, fbh, CARD);
  numDot(s, x + 0.3, y + 0.3, 0.62, String(i + 1), GREEN);
  s.addText(b[0], { x: x + 1.1, y: y + 0.3, w: fbw - 1.4, h: 0.6, fontFace: KF, fontSize: 17, bold: true, color: NAVY, valign: "middle", lineSpacing: 20, margin: 0 });
  s.addText(b[1], { x: x + 0.35, y: y + 1.15, w: fbw - 0.7, h: 1.0, fontFace: KF, fontSize: 14, color: INK, lineSpacing: 21, margin: 0 });
});
s.addText("* 이동형 초음파·레이저·내시경·검안기 등 시세가 형성되고 옮길 수 있는 장비에 특히 적합합니다.",
  { x: M, y: 6.35, w: W - 2 * M, h: 0.5, fontFace: KF, fontSize: 11.5, italic: true, color: GREY, margin: 0 });

// ============ SLIDE 4 : 이런 점이 좋습니다 ============
s = p.addSlide();
bg(s, LIGHT);
title(s, "이런 점이 좋습니다");
const ben = [
  ["즉시 현금화", "보유 장비를 매각해 필요한 자금을 그 자리에서 확보합니다."],
  ["그대로 계속 사용", "매각 후에도 장비를 그대로 쓰므로 영업이 멈추지 않습니다."],
  ["반납이 자유", "만기에 반납하면 추가 부담이 없습니다. 되사기와 반납 중 선택하세요."],
  ["이자·연체 개념이 없음", "매매와 렌탈이라, 미납 시에도 연체가 아니라 장비 반납으로 정리됩니다."],
  ["빠르고 심플", "복잡한 금융 심사 대신 자산 가치를 기준으로 빠르게 진행합니다."],
  ["소유·사용 그대로", "장비는 원장님·사장님 사업장에 그대로, 일상은 달라지지 않습니다."],
];
const bx0 = M, by0 = 1.45, bw = 3.9, bh = 2.4, bgap = 0.32;
ben.forEach((b, i) => {
  const col = i % 3, row = Math.floor(i / 3);
  const x = bx0 + col * (bw + bgap), y = by0 + row * (bh + bgap);
  card(s, x, y, bw, bh, CARD);
  numDot(s, x + 0.3, y + 0.3, 0.6, String(i + 1), GREEN);
  s.addText(b[0], { x: x + 0.3, y: y + 1.02, w: bw - 0.6, h: 0.5, fontFace: KF, fontSize: 17, bold: true, color: NAVY, margin: 0 });
  s.addText(b[1], { x: x + 0.3, y: y + 1.5, w: bw - 0.6, h: 0.8, fontFace: KF, fontSize: 13, color: INK, lineSpacing: 18, margin: 0 });
});

// ============ SLIDE 5 : 세금·재무 이점 ============
s = p.addSlide();
bg(s, LIGHT);
title(s, "세금까지 유리합니다");
s.addText("사는 것보다 빌려 쓰는 게 유리한 이유 — 렌탈료는 비용으로 인정되고, 부가세는 공제받습니다.",
  { x: M, y: 1.22, w: W - 2 * M, h: 0.5, fontFace: KF, fontSize: 14, color: INK, margin: 0 });
const tax = [
  ["부가세 매입세액 공제", "매기 납부하는 렌탈료의 부가가치세(10%)는 매입세액으로 공제받을 수 있습니다."],
  ["렌탈료 전액 비용처리", "렌탈료는 전액 비용(손금)으로 인정되어 과세소득이 줄고, 세부담이 낮아집니다."],
  ["자산·감가상각 부담 감소", "장비를 매각해 장부에서 덜어내므로, 감가상각·자산관리 부담이 줄어듭니다."],
  ["현금흐름 개선", "묶여 있던 장비 가치를 현금으로 돌려 운영·확장에 바로 쓸 수 있습니다."],
];
const tx0 = M, ty0 = 1.9, tbw = 5.9, tbh = 1.8, tbgap = 0.3;
tax.forEach((b, i) => {
  const col = i % 2, row = Math.floor(i / 2);
  const x = tx0 + col * (tbw + tbgap), y = ty0 + row * (tbh + tbgap);
  card(s, x, y, tbw, tbh, CARD);
  s.addShape(p.ShapeType.roundRect, { x: x + 0.3, y: y + 0.3, w: 0.62, h: 0.62, rectRadius: 0.12, fill: { color: "E7F5EE" }, line: { width: 0 } });
  s.addText("₩", { x: x + 0.3, y: y + 0.3, w: 0.62, h: 0.62, align: "center", valign: "middle", fontFace: KF, fontSize: 20, bold: true, color: GREEN, margin: 0 });
  s.addText(b[0], { x: x + 1.1, y: y + 0.32, w: tbw - 1.4, h: 0.6, fontFace: KF, fontSize: 17, bold: true, color: NAVY, valign: "middle", margin: 0 });
  s.addText(b[1], { x: x + 0.35, y: y + 1.05, w: tbw - 0.7, h: 0.65, fontFace: KF, fontSize: 13, color: INK, lineSpacing: 18, margin: 0 });
});
card(s, M, 5.65, W - 2 * M, 0.85, NAVY);
s.addText("정리하면 — 현금은 지금 확보하고, 내는 렌탈료는 비용처리 + 부가세 공제로 세금까지 줄입니다.",
  { x: M + 0.35, y: 5.65, w: W - 2 * M - 0.7, h: 0.85, fontFace: KF, fontSize: 14, bold: true, color: "EAF0F5", valign: "middle", margin: 0 });
s.addText("* 부가세 공제·비용처리 등 세무 효과는 사업자 유형(과세/면세)·거래 형태에 따라 달라질 수 있으니, 세무 전문가와 상담하시기 바랍니다.",
  { x: M, y: 6.6, w: W - 2 * M, h: 0.5, fontFace: KF, fontSize: 10.5, italic: true, color: GREY, margin: 0 });

// ============ SLIDE 6 : 대출·리스와 무엇이 다른가 ============
s = p.addSlide();
bg(s, LIGHT);
title(s, "무엇이 다른가요");
s.addText("풍현은 대출이 아니라 자산을 실제로 사고(매매), 그 자산을 다시 빌려드리는(렌탈) 구조입니다.",
  { x: M, y: 1.22, w: W - 2 * M, h: 0.5, fontFace: KF, fontSize: 14, color: INK, margin: 0 });
s.addTable([
  [{ text: "항목", options: { fill: NAVY, color: WHITE, bold: true, fontSize: 13.5 } },
   { text: "일반적인 방식", options: { fill: NAVY, color: WHITE, bold: true, fontSize: 13.5, align: "center" } },
   { text: "풍현 자산 매입·렌탈", options: { fill: GREEN, color: WHITE, bold: true, fontSize: 13.5, align: "center" } }],
  ...[
    ["구조", "빌리고 갚기", "장비를 팔고, 다시 빌려 쓰기"],
    ["자금 확보", "심사·한도에 좌우", "보유 자산의 가치를 기준으로"],
    ["장비 사용", "-", "매각 후에도 그대로 사용"],
    ["만기", "정해진 상환", "되사기 또는 반납 중 선택"],
    ["미납 시", "연체·독촉", "장비 반납으로 정리(연체 개념 없음)"],
  ].map((r, ri) => r.map((c, j) => ({
    text: c,
    options: {
      fontSize: 13.5, color: j === 2 ? NAVY : INK, bold: j === 0 || j === 2,
      align: j === 0 ? "left" : "center",
      fill: j === 2 ? "E7F5EE" : (ri % 2 === 1 ? "F7F9FB" : WHITE),
    },
  }))),
], { x: M, y: 1.95, w: W - 2 * M, colW: [2.6, 4.75, 4.75], rowH: 0.66, fontFace: KF, border: { type: "solid", color: LINE, pt: 1 }, valign: "middle" });
s.addText("* 소유권은 실제로 풍현으로 이전되며, 되사기 금액은 계약 시점에 확정됩니다. 자산 매매·임대차 계약으로 진행됩니다.",
  { x: M, y: 6.35, w: W - 2 * M, h: 0.5, fontFace: KF, fontSize: 11.5, italic: true, color: GREY, margin: 0 });

// ============ SLIDE 6 : 이렇게 진행됩니다 ============
s = p.addSlide();
bg(s, LIGHT);
title(s, "이렇게 진행됩니다");
const steps = [
  ["상담·자산 접수", "장비 정보를\n간단히 전달"],
  ["자산 평가·매입가 산정", "시세 기준\n공정 매입가 산정"],
  ["계약 체결", "매매 계약 +\n렌탈 계약"],
  ["매입대금 지급", "필요한 자금\n즉시 확보"],
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
card(s, M, 4.75, 6.0, 1.75, CARD);
s.addText("소요 기간", { x: M + 0.3, y: 4.95, w: 5.4, h: 0.4, fontFace: KF, fontSize: 15, bold: true, color: GREEN, margin: 0 });
s.addText("자산 확인 완료 시, 접수 → 매입대금 지급까지\n평균 2~5 영업일", { x: M + 0.3, y: 5.4, w: 5.4, h: 0.95, fontFace: KF, fontSize: 14, color: INK, lineSpacing: 20, margin: 0 });
card(s, 6.9, 4.75, W - M - 6.9, 1.75, CARD);
s.addText("진행 방식", { x: 7.2, y: 4.95, w: 5.4, h: 0.4, fontFace: KF, fontSize: 15, bold: true, color: GREEN, margin: 0 });
s.addText("서류는 비대면 접수 가능\n고가·대량 자산은 현장 실사를 함께 진행", { x: 7.2, y: 5.4, w: W - M - 7.2, h: 0.95, fontFace: KF, fontSize: 14, color: INK, lineSpacing: 20, margin: 0 });

// ============ SLIDE 7 : 필요 서류 ============
s = p.addSlide();
bg(s, LIGHT);
title(s, "준비하실 서류");
const docs = [
  ["사업자등록증 사본", "사업자 확인"],
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
s.addText("* 대리 진행 시 위임장·인감증명서가, 자산 종류에 따라 등록원부 등이 추가로 요청될 수 있습니다.",
  { x: M, y: 6.4, w: W - 2 * M, h: 0.5, fontFace: KF, fontSize: 11.5, italic: true, color: GREY, margin: 0 });

// ============ SLIDE 8 : 문의 ============
s = p.addSlide();
bg(s, NAVY);
s.addShape(p.ShapeType.ellipse, { x: -1.2, y: 5.4, w: 3.4, h: 3.4, fill: { color: NAVY2 }, line: { color: GREEN, width: 2 } });
s.addText("상담 문의", { x: M, y: 0.9, w: 9, h: 0.9, fontFace: KF, fontSize: 34, bold: true, color: WHITE, margin: 0 });
s.addText("보유 장비와 필요 자금 규모만 알려주시면, 상담 후 바로 진행해 드립니다.", { x: M, y: 1.85, w: 11, h: 0.5, fontFace: KF, fontSize: 15, color: "C7D0DA", margin: 0 });
card(s, M, 2.7, W - 2 * M, 3.2, NAVY2);
const contact = [["회사명", "[                                   ]"], ["담당자", "[                                   ]"], ["연락처 (전화)", "[                                   ]"], ["이메일", "[                                   ]"], ["카카오·홈페이지", "[                                   ]"]];
contact.forEach((c, i) => {
  const y = 2.95 + i * 0.56;
  s.addText(c[0], { x: M + 0.4, y, w: 4.2, h: 0.45, fontFace: KF, fontSize: 15, bold: true, color: MINT, valign: "middle", margin: 0 });
  s.addText(c[1], { x: M + 4.7, y, w: W - 2 * M - 5.1, h: 0.45, fontFace: KF, fontSize: 15, color: "EAF0F5", valign: "middle", margin: 0 });
});
s.addText("본 자료는 서비스 안내용 참고 자료입니다. 매입가·렌탈료·되사기 금액 등 세부 조건은 자산 평가와 개별 협의·계약으로 확정되며, 수익이나 특정 결과를 보장하지 않습니다. 관련 법령 준수를 위해 조건은 변경될 수 있습니다.",
  { x: M, y: 6.25, w: W - 2 * M, h: 0.9, fontFace: KF, fontSize: 10.5, color: "8A94A0", lineSpacing: 15, margin: 0 });

const OUT = "C:/Users/sol hong/Downloads/풍현_고객안내_리플렛_260818.pptx";
p.writeFile({ fileName: OUT }).then(() => console.log("saved", OUT));
