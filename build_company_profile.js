// 풍현 회사 소개서 (Company Profile) — 회사 소개 중심 (미션·비전·가치·경쟁력)
// 출력: Downloads/풍현_회사소개서_260818.pptx
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
  slide.addShape(p.ShapeType.rect, { x: M, y: 0.52, w: 0.13, h: 0.72, fill: { color: GREEN }, line: { width: 0 } });
  slide.addText(txt, { x: M + 0.28, y: 0.42, w: W - 2 * M - 0.28, h: 0.8, fontFace: KF, fontSize: 30, bold: true, color: color || NAVY, align: "left", valign: "middle", margin: 0 });
}
function kicker(slide, txt) {
  slide.addText(txt, { x: M + 0.28, y: 1.25, w: W - 2 * M - 0.28, h: 0.4, fontFace: KF, fontSize: 13, bold: true, color: GREEN, charSpacing: 2, margin: 0 });
}
function pageFoot(slide, n) {
  slide.addText("주식회사 풍현  ·  Company Profile", { x: M, y: H - 0.42, w: 7, h: 0.3, fontFace: KF, fontSize: 9, color: "9AA3AE", margin: 0 });
  slide.addText(String(n).padStart(2, "0"), { x: W - M - 1, y: H - 0.42, w: 1, h: 0.3, align: "right", fontFace: KF, fontSize: 9, color: "9AA3AE", margin: 0 });
}

// ============ SLIDE 1 : COVER ============
let s = p.addSlide();
bg(s, NAVY);
s.addShape(p.ShapeType.ellipse, { x: 10.4, y: -1.6, w: 4.2, h: 4.2, fill: { color: NAVY2 }, line: { color: GREEN, width: 2 } });
s.addShape(p.ShapeType.ellipse, { x: 11.6, y: -0.5, w: 1.7, h: 1.7, fill: { color: GREEN }, line: { width: 0 } });
s.addText("COMPANY PROFILE", { x: M, y: 1.9, w: 10, h: 0.5, fontFace: KF, fontSize: 15, bold: true, color: MINT, charSpacing: 3, margin: 0 });
s.addText("주식회사 풍현", { x: M, y: 2.45, w: 11, h: 1.1, fontFace: KF, fontSize: 52, bold: true, color: WHITE, margin: 0 });
s.addText("자산이 멈추지 않고 일하게 합니다.", { x: M, y: 3.7, w: 11, h: 0.6, fontFace: KF, fontSize: 22, bold: true, color: "C7D0DA", margin: 0 });
s.addText("사업자의 자산을 활용해 필요한 자금을 즉시 공급하는\n자산 기반 렌탈·선정산 기업 (세일앤렌탈백, SRB)", { x: M, y: 4.55, w: 11, h: 1.0, fontFace: KF, fontSize: 15, color: "8FA0B4", lineSpacing: 24, margin: 0 });
s.addShape(p.ShapeType.line, { x: M, y: 6.2, w: W - 2 * M, h: 0, line: { color: "2A3A52", width: 1 } });
s.addText("2026", { x: M, y: 6.35, w: 4, h: 0.4, fontFace: KF, fontSize: 12, color: "8A94A0", margin: 0 });
s.addText("[ 로고 자리 ]", { x: W - M - 4, y: 6.35, w: 4, h: 0.4, align: "right", fontFace: KF, fontSize: 12, italic: true, color: "8A94A0", margin: 0 });

// ============ SLIDE 2 : 회사 개요 ============
s = p.addSlide();
bg(s, LIGHT);
title(s, "회사 개요");
const info = [
  ["회사명", "주식회사 풍현 (Punghyun Inc.)"],
  ["대표이사", "홍솔"],
  ["설립일", "2026년 8월 12일"],
  ["소재지", "서울특별시 강남구 선릉로 521, 3층"],
  ["사업영역", "자산 기반 렌탈·선정산 (세일앤렌탈백, SRB)"],
  ["대상 고객", "정산 주기가 긴 B2B 사업자 · 자산 보유 사업자"],
  ["핵심 가치", "신뢰 · 실행 · 투명 · 동행"],
];
const iy0 = 1.6, irh = 0.72;
card(s, M, iy0 - 0.15, W - 2 * M, irh * info.length + 0.3, CARD);
info.forEach((r, i) => {
  const y = iy0 + i * irh;
  s.addShape(p.ShapeType.rect, { x: M + 0.4, y: y + 0.12, w: 2.9, h: irh - 0.24, fill: { color: "EEF3F1" }, line: { width: 0 } });
  s.addText(r[0], { x: M + 0.4, y, w: 2.9, h: irh, align: "center", valign: "middle", fontFace: KF, fontSize: 15, bold: true, color: GREEN, margin: 0 });
  s.addText(r[1], { x: M + 3.6, y, w: W - 2 * M - 4.0, h: irh, valign: "middle", fontFace: KF, fontSize: 15.5, color: INK, margin: 0 });
  if (i < info.length - 1) s.addShape(p.ShapeType.line, { x: M + 0.4, y: y + irh, w: W - 2 * M - 0.8, h: 0, line: { color: LINE, width: 0.75 } });
});
pageFoot(s, 2);

// ============ SLIDE 3 : 연혁 ============
s = p.addSlide();
bg(s, LIGHT);
title(s, "연혁");
kicker(s, "HISTORY");
const hist = [
  ["2026. 08", "주식회사 풍현 설립", "자산 기반 렌탈·선정산(세일앤렌탈백) 사업을 시작했습니다."],
  ["2026. 08", "소풍벤처스 투자 유치", "임팩트 벤처캐피탈 소풍벤처스로부터 초기 투자를 유치했습니다."],
];
// 세로 타임라인
const lineX = M + 1.9, top = 2.1, rowGap = 1.75;
s.addShape(p.ShapeType.line, { x: lineX, y: top + 0.1, w: 0, h: rowGap * (hist.length - 1) + 0.5, line: { color: MINT, width: 2 } });
hist.forEach((h, i) => {
  const y = top + i * rowGap;
  s.addText(h[0], { x: M, y: y - 0.05, w: 1.55, h: 0.5, align: "right", valign: "middle", fontFace: KF, fontSize: 16, bold: true, color: GREEN, margin: 0 });
  s.addShape(p.ShapeType.ellipse, { x: lineX - 0.16, y: y + 0.02, w: 0.32, h: 0.32, fill: { color: GREEN }, line: { color: LIGHT, width: 3 } });
  card(s, lineX + 0.45, y - 0.25, W - M - (lineX + 0.45), 1.35, CARD);
  s.addText(h[1], { x: lineX + 0.75, y: y - 0.02, w: W - M - (lineX + 0.75) - 0.3, h: 0.5, fontFace: KF, fontSize: 18, bold: true, color: NAVY, margin: 0 });
  s.addText(h[2], { x: lineX + 0.75, y: y + 0.52, w: W - M - (lineX + 0.75) - 0.3, h: 0.55, fontFace: KF, fontSize: 13.5, color: INK, lineSpacing: 18, margin: 0 });
});
pageFoot(s, 3);

// ============ SLIDE 4 : 미션 & 비전 ============
s = p.addSlide();
bg(s, NAVY);
s.addShape(p.ShapeType.rect, { x: M, y: 0.52, w: 0.13, h: 0.72, fill: { color: GREEN }, line: { width: 0 } });
s.addText("미션 & 비전", { x: M + 0.28, y: 0.42, w: W - 2 * M - 0.28, h: 0.8, fontFace: KF, fontSize: 30, bold: true, color: WHITE, valign: "middle", margin: 0 });
// 미션
s.addText("MISSION", { x: M, y: 1.75, w: 5, h: 0.4, fontFace: KF, fontSize: 14, bold: true, color: MINT, charSpacing: 3, margin: 0 });
s.addText("자산이 멈추지 않고 일하게 합니다.", { x: M, y: 2.15, w: W - 2 * M, h: 0.8, fontFace: KF, fontSize: 30, bold: true, color: WHITE, margin: 0 });
s.addText("장비와 자산에 묶여 있던 가치를 자금으로 바꿔, 사업이 멈추지 않고 계속 성장하도록 돕습니다.", { x: M, y: 3.0, w: W - 2 * M, h: 0.6, fontFace: KF, fontSize: 15, color: "C7D0DA", lineSpacing: 22, margin: 0 });
s.addShape(p.ShapeType.line, { x: M, y: 3.85, w: W - 2 * M, h: 0, line: { color: "2A3A52", width: 1 } });
// 비전
s.addText("VISION", { x: M, y: 4.15, w: 5, h: 0.4, fontFace: KF, fontSize: 14, bold: true, color: MINT, charSpacing: 3, margin: 0 });
s.addText("자산 기반 금융의 새로운 기준.", { x: M, y: 4.55, w: W - 2 * M, h: 0.8, fontFace: KF, fontSize: 30, bold: true, color: WHITE, margin: 0 });
s.addText("빌리고 갚는 대출이 아니라, 자산을 사고 다시 빌려주는 구조로 사업자에게 가장 빠르고 투명한 자금 파트너가 됩니다.", { x: M, y: 5.4, w: W - 2 * M, h: 0.7, fontFace: KF, fontSize: 15, color: "C7D0DA", lineSpacing: 22, margin: 0 });
pageFoot(s, 4);

// ============ SLIDE 5 : 핵심 가치 ============
s = p.addSlide();
bg(s, LIGHT);
title(s, "핵심 가치");
kicker(s, "CORE VALUES");
const vals = [
  ["신뢰", "Trust", "법률 검토를 거친 원칙 위에서만 거래합니다. 소유권 이전·진정매매를 실질로 갖춥니다."],
  ["실행", "Speed", "자산 가치를 기준으로 빠르게 판단하고, 필요한 시점에 자금을 실행합니다."],
  ["투명", "Transparency", "매입가·렌탈료·되사기 금액 등 모든 조건을 시작 전에 명확히 안내합니다."],
  ["동행", "Partnership", "고객의 사업이 멈추지 않고 지속되는 것이 곧 풍현의 성공입니다."],
];
const vx0 = M, vy0 = 1.85, vbw = 2.95, vbh = 3.9, vgap = 0.28;
vals.forEach((v, i) => {
  const x = vx0 + i * (vbw + vgap);
  card(s, x, vy0, vbw, vbh, CARD);
  s.addShape(p.ShapeType.rect, { x, y: vy0, w: vbw, h: 0.14, fill: { color: GREEN }, line: { width: 0 } });
  s.addText(String(i + 1).padStart(2, "0"), { x: x + 0.3, y: vy0 + 0.4, w: vbw - 0.6, h: 0.5, fontFace: KF, fontSize: 20, bold: true, color: MINT, margin: 0 });
  s.addText(v[0], { x: x + 0.3, y: vy0 + 1.05, w: vbw - 0.6, h: 0.6, fontFace: KF, fontSize: 26, bold: true, color: NAVY, margin: 0 });
  s.addText(v[1], { x: x + 0.3, y: vy0 + 1.75, w: vbw - 0.6, h: 0.4, fontFace: KF, fontSize: 12.5, bold: true, color: GREEN, charSpacing: 1, margin: 0 });
  s.addShape(p.ShapeType.line, { x: x + 0.3, y: vy0 + 2.2, w: vbw - 0.6, h: 0, line: { color: LINE, width: 0.75 } });
  s.addText(v[2], { x: x + 0.3, y: vy0 + 2.35, w: vbw - 0.6, h: 1.4, fontFace: KF, fontSize: 12.5, color: INK, lineSpacing: 18, margin: 0 });
});
pageFoot(s, 5);

// ============ SLIDE 6 : 사업 영역 ============
s = p.addSlide();
bg(s, LIGHT);
title(s, "사업 영역");
kicker(s, "WHAT WE DO");
// 메인 카드 : SRB
card(s, M, 1.85, W - 2 * M, 2.35, NAVY);
s.addText("세일앤렌탈백 (Sale & Rental Back)", { x: M + 0.4, y: 2.08, w: W - 2 * M - 0.8, h: 0.55, fontFace: KF, fontSize: 22, bold: true, color: MINT, margin: 0 });
s.addText("보유 자산을 제값에 매입해 즉시 현금화하고, 그 자산을 그대로 렌탈해 계속 사용하게 하는 자산 기반 자금 조달 서비스. 대출이 아니라 자산 매매와 임대차로 설계했습니다.",
  { x: M + 0.4, y: 2.65, w: W - 2 * M - 0.8, h: 0.9, fontFace: KF, fontSize: 15, color: "EAF0F5", lineSpacing: 23, margin: 0 });
const tri = ["자산 매입 — 즉시 목돈 확보", "렌탈 이용 — 사업 중단 없음", "만기 선택 — 되사기 또는 반납"];
let tx = M + 0.4;
tri.forEach((t) => {
  const tw = 0.5 + t.length * 0.175;
  s.addShape(p.ShapeType.roundRect, { x: tx, y: 3.6, w: tw, h: 0.46, rectRadius: 0.23, fill: { color: NAVY2 }, line: { color: GREEN, width: 1 } });
  s.addText(t, { x: tx, y: 3.6, w: tw, h: 0.46, align: "center", valign: "middle", fontFace: KF, fontSize: 12, bold: true, color: MINT, margin: 0 });
  tx += tw + 0.2;
});
// 확장 영역 3
const ext = [
  ["자산 운용", "매입한 자산을 관리·재매각하며 대규모 자산을 안정적으로 운용합니다."],
  ["정산 관리", "전용계좌·정산 절차 기반의 대금 통제로 투명한 자금 흐름을 만듭니다."],
  ["취급 확대", "이동형 의료·미용 장비를 시작으로 취급 자산과 업종을 넓혀 갑니다."],
];
const ex0 = M, ey0 = 4.45, ebw = 3.9, ebh = 1.95, egap = 0.32;
ext.forEach((b, i) => {
  const x = ex0 + i * (ebw + egap);
  card(s, x, ey0, ebw, ebh, CARD);
  s.addShape(p.ShapeType.rect, { x: x + 0.3, y: ey0 + 0.32, w: 0.5, h: 0.14, fill: { color: GREEN }, line: { width: 0 } });
  s.addText(b[0], { x: x + 0.3, y: ey0 + 0.5, w: ebw - 0.6, h: 0.5, fontFace: KF, fontSize: 16.5, bold: true, color: NAVY, margin: 0 });
  s.addText(b[1], { x: x + 0.3, y: ey0 + 1.02, w: ebw - 0.6, h: 0.8, fontFace: KF, fontSize: 12.5, color: INK, lineSpacing: 17, margin: 0 });
});
pageFoot(s, 6);

// ============ SLIDE 7 : 경쟁력 (왜 풍현인가) ============
s = p.addSlide();
bg(s, LIGHT);
title(s, "왜 풍현인가");
kicker(s, "OUR STRENGTHS");
const str = [
  ["검증된 운영 기반", "렌탈·정산 사업에서 대규모 자산 운용과 정산 관리를 실전 운영한 경험을 보유합니다."],
  ["자산 기반 구조", "실물 자산을 근거로 하는 안정적인 구조로, 신용·담보 심사에 기대지 않습니다."],
  ["체계적인 정산 통제", "전용계좌·정산 절차 등 안정적인 대금 관리 체계로 자금 흐름을 투명하게 운영합니다."],
  ["법률에 기반한 설계", "매매와 임대차의 실질을 갖추도록 법률 검토를 거쳐 계약과 절차를 설계했습니다."],
];
const wx0 = M, wy0 = 1.9, wbw = 5.9, wbh = 2.15, wgap = 0.32;
str.forEach((b, i) => {
  const col = i % 2, row = Math.floor(i / 2);
  const x = wx0 + col * (wbw + wgap), y = wy0 + row * (wbh + wgap);
  card(s, x, y, wbw, wbh, CARD);
  numDot(s, x + 0.32, y + 0.32, 0.64, String(i + 1), GREEN);
  s.addText(b[0], { x: x + 1.15, y: y + 0.34, w: wbw - 1.4, h: 0.6, fontFace: KF, fontSize: 18, bold: true, color: NAVY, valign: "middle", margin: 0 });
  s.addText(b[1], { x: x + 0.35, y: y + 1.15, w: wbw - 0.7, h: 0.85, fontFace: KF, fontSize: 13.5, color: INK, lineSpacing: 19, margin: 0 });
});
pageFoot(s, 7);

// ============ SLIDE 8 : 운영 원칙 (신뢰·거버넌스) ============
s = p.addSlide();
bg(s, LIGHT);
title(s, "우리가 지키는 원칙");
kicker(s, "HOW WE OPERATE");
s.addText("풍현의 거래는 대출이 아니라, 자산을 실제로 사고(매매) 다시 빌려드리는(임대차) 구조입니다. 아래 원칙을 지켜 신뢰를 만듭니다.",
  { x: M, y: 1.75, w: W - 2 * M, h: 0.6, fontFace: KF, fontSize: 15, color: INK, lineSpacing: 22, margin: 0 });
const prin = [
  ["실제 소유권 이전", "자산 소유권이 실제로 풍현으로 이전됩니다. 서류상만이 아니라 실물 검수·기록으로 확인합니다."],
  ["진정매매 + 임대차", "매매 계약과 렌탈(임대차) 계약을 별개로 체결해 각 거래의 실질을 갖춥니다."],
  ["자유로운 반납", "만기에 부담 없이 반납할 수 있습니다. 반납이 실제로 가능한 자산만 취급합니다."],
  ["준법 우선", "여신·이자·연체 개념 없이 자산 반납으로 정리되는 비소구 구조. 법령 준수를 최우선에 둡니다."],
];
const rx0 = M, ry0 = 2.5, rbw = 5.9, rbh = 1.85, rgap = 0.3;
prin.forEach((b, i) => {
  const col = i % 2, row = Math.floor(i / 2);
  const x = rx0 + col * (rbw + rgap), y = ry0 + row * (rbh + rgap);
  card(s, x, y, rbw, rbh, CARD);
  s.addShape(p.ShapeType.ellipse, { x: x + 0.3, y: y + 0.32, w: 0.6, h: 0.6, fill: { color: GREEN }, line: { width: 0 } });
  s.addText("✓", { x: x + 0.3, y: y + 0.32, w: 0.6, h: 0.6, align: "center", valign: "middle", fontFace: KF, fontSize: 17, bold: true, color: WHITE, margin: 0 });
  s.addText(b[0], { x: x + 1.1, y: y + 0.34, w: rbw - 1.4, h: 0.55, fontFace: KF, fontSize: 16.5, bold: true, color: NAVY, valign: "middle", margin: 0 });
  s.addText(b[1], { x: x + 0.35, y: y + 1.05, w: rbw - 0.7, h: 0.7, fontFace: KF, fontSize: 12.5, color: INK, lineSpacing: 17, margin: 0 });
});
pageFoot(s, 8);

// ============ SLIDE 9 : 성장 방향 (로드맵) ============
s = p.addSlide();
bg(s, LIGHT);
title(s, "성장 방향");
kicker(s, "ROADMAP");
const road = [
  ["NOW", "기반 구축", "이동형 의료·미용 장비 중심의 세일앤렌탈백 운영, 검증된 정산·자산 운용 체계 확립."],
  ["NEXT", "영역 확대", "취급 자산과 업종을 넓히고, 재매각·정산 데이터를 축적해 심사·운용을 고도화."],
  ["BEYOND", "플랫폼 도약", "자산 기반 정산·자금 조달을 잇는 파트너 네트워크와 플랫폼으로 확장."],
];
const dw = 3.9, dh = 3.4, dy = 2.05, dgap = 0.32;
road.forEach((r, i) => {
  const x = M + i * (dw + dgap);
  card(s, x, dy, dw, dh, i === 0 ? NAVY : CARD);
  const dark = i === 0;
  s.addShape(p.ShapeType.roundRect, { x: x + 0.3, y: dy + 0.35, w: 1.9, h: 0.5, rectRadius: 0.25, fill: { color: dark ? GREEN : "E7F5EE" }, line: { width: 0 } });
  s.addText(r[0], { x: x + 0.3, y: dy + 0.35, w: 1.9, h: 0.5, align: "center", valign: "middle", fontFace: KF, fontSize: 13, bold: true, color: dark ? WHITE : GREEN, charSpacing: 1, margin: 0 });
  s.addText(r[1], { x: x + 0.3, y: dy + 1.1, w: dw - 0.6, h: 0.6, fontFace: KF, fontSize: 22, bold: true, color: dark ? WHITE : NAVY, margin: 0 });
  s.addText(r[2], { x: x + 0.3, y: dy + 1.85, w: dw - 0.6, h: 1.4, fontFace: KF, fontSize: 13.5, color: dark ? "C7D0DA" : INK, lineSpacing: 20, margin: 0 });
  if (i < 2) s.addText("▶", { x: x + dw + 0.0, y: dy + 1.5, w: 0.32, h: 0.5, align: "center", valign: "middle", fontFace: KF, fontSize: 16, bold: true, color: MINT, margin: 0 });
});
pageFoot(s, 9);

// ============ SLIDE 10 : CONTACT ============
s = p.addSlide();
bg(s, NAVY);
s.addShape(p.ShapeType.ellipse, { x: -1.3, y: 5.2, w: 3.6, h: 3.6, fill: { color: NAVY2 }, line: { color: GREEN, width: 2 } });
s.addShape(p.ShapeType.ellipse, { x: 11.4, y: -1.0, w: 2.6, h: 2.6, fill: { color: NAVY2 }, line: { color: GREEN, width: 1.5 } });
s.addText("함께 만들어 갑니다", { x: M, y: 1.2, w: 11, h: 0.9, fontFace: KF, fontSize: 36, bold: true, color: WHITE, margin: 0 });
s.addText("자산이 멈추지 않고 일하게 하는 파트너, 풍현입니다.", { x: M, y: 2.2, w: 11, h: 0.5, fontFace: KF, fontSize: 16, color: "C7D0DA", margin: 0 });
card(s, M, 3.1, W - 2 * M, 2.9, NAVY2);
const contact = [
  ["회사명", "주식회사 풍현"],
  ["대표이사", "홍솔"],
  ["주소", "서울특별시 강남구 선릉로 521, 3층"],
  ["전화", "[                    ]"],
  ["이메일", "[                    ]"],
  ["홈페이지", "punghyun.co.kr"],
];
contact.forEach((c, i) => {
  const col = i % 2, row = Math.floor(i / 2);
  const x = M + 0.5 + col * 6.0, y = 3.35 + row * 0.85;
  s.addText(c[0], { x, y, w: 2.0, h: 0.4, fontFace: KF, fontSize: 14, bold: true, color: MINT, valign: "middle", margin: 0 });
  s.addText(c[1], { x: x + 2.0, y, w: 3.8, h: 0.4, fontFace: KF, fontSize: 14, color: "EAF0F5", valign: "middle", margin: 0 });
});
s.addText("본 자료는 회사 소개용 참고 자료입니다. 매입가·렌탈료·되사기 금액 등 세부 조건은 자산 평가와 개별 협의·계약으로 확정되며, 수익이나 특정 결과를 보장하지 않습니다.",
  { x: M, y: 6.3, w: W - 2 * M, h: 0.8, fontFace: KF, fontSize: 10.5, color: "8A94A0", lineSpacing: 15, margin: 0 });

const OUT = "C:/Users/sol hong/Downloads/풍현_회사소개서_260818.pptx";
p.writeFile({ fileName: OUT }).then(() => console.log("saved", OUT));
