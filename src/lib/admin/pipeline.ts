// 풍현 계약 파이프라인 단계 정의 및 단계별 메타데이터

export type StageKey =
  | "intake"
  | "screening_1"
  | "screening_2"
  | "screening_3"
  | "inspection"
  | "contract"
  | "funding"
  | "operation"
  | "maturity"
  | "closed";

export type Stage = {
  key: StageKey;
  label: string;
  short: string;
  desc: string;
};

// 화면 표시 및 진행 순서
export const STAGES: Stage[] = [
  { key: "intake", label: "고객 인입", short: "인입", desc: "신규 고객 접수 · 기본 정보 확인" },
  { key: "screening_1", label: "1차 안내(스크리닝)", short: "1차", desc: "별도 채널 인입 고객 기본 정보 확인" },
  { key: "screening_2", label: "2차 안내(스크리닝)", short: "2차", desc: "필수 서류 수집" },
  { key: "screening_3", label: "3차 안내(스크리닝)", short: "3차", desc: "기기 사진 · 정보 수집" },
  { key: "inspection", label: "실사 및 구조설계", short: "실사", desc: "실사 일정 · 집행/렌탈가 · 내부 심의" },
  { key: "contract", label: "계약", short: "계약", desc: "계약서 전송 · 계약 완료" },
  { key: "funding", label: "자금집행", short: "집행", desc: "집행 예정 · 완료" },
  { key: "operation", label: "운영관리", short: "운영", desc: "회차별 납부 관리" },
  { key: "maturity", label: "만기처리", short: "만기", desc: "인수 · 반납 · 재렌탈" },
  { key: "closed", label: "종료(보관)", short: "종료", desc: "완료된 건 보관" },
];

export const STAGE_MAP: Record<StageKey, Stage> = Object.fromEntries(
  STAGES.map((s) => [s.key, s]),
) as Record<StageKey, Stage>;

export const stageLabel = (key: StageKey) => STAGE_MAP[key]?.label ?? key;

// 다음 단계 계산. 공홈 인입(homepage) 고객은 인입 → 2차로 (1차 생략).
export function nextStage(current: StageKey, source: "homepage" | "manual"): StageKey | null {
  if (current === "intake") {
    return source === "homepage" ? "screening_2" : "screening_1";
  }
  const order = STAGES.map((s) => s.key);
  const idx = order.indexOf(current);
  if (idx < 0 || idx >= order.length - 1) return null;
  return order[idx + 1];
}

export function prevStage(current: StageKey): StageKey | null {
  const order = STAGES.map((s) => s.key);
  const idx = order.indexOf(current);
  if (idx <= 0) return null;
  return order[idx - 1];
}

// 병원 유형
export const HOSPITAL_TYPES = [
  { value: "individual", label: "개인" },
  { value: "corporate", label: "법인" },
] as const;

// 만기 처리 결과
export const MATURITY_RESULTS = [
  { value: "acquire", label: "인수" },
  { value: "return", label: "반납" },
  { value: "re_rental", label: "재렌탈" },
] as const;

// 단계별 서류 체크리스트 (2차 / 3차)
// hint: 고객 안내용 발급처·촬영 방법 설명
export type DocItem = {
  key: string;
  label: string;
  category: StageKey;
  hint?: string;
};

export const SCREENING_2_DOCS: DocItem[] = [
  {
    key: "business_registration",
    label: "사업자등록증",
    category: "screening_2",
    hint: "홈택스(hometax.go.kr) 또는 관할 세무서에서 발급",
  },
  {
    key: "medical_license",
    label: "의료기관 개설 신고 증명",
    category: "screening_2",
    hint: "관할 보건소에서 발급 (해당 시)",
  },
  {
    key: "rep_id",
    label: "대표자 신분증",
    category: "screening_2",
    hint: "주민등록증 또는 운전면허증 사본",
  },
  {
    key: "card_sales_6m",
    label: "최근 6개월 카드매출",
    category: "screening_2",
    hint: "카드사 또는 여신금융협회에서 카드매출 내역 발급",
  },
  {
    key: "tax_payment_cert",
    label: "국세 및 지방세 완납 증명서",
    category: "screening_2",
    hint: "국세: 홈택스 / 지방세: 위택스(wetax.go.kr)에서 발급",
  },
  {
    key: "income_cert_2y",
    label: "최근 2년 소득금액증명원",
    category: "screening_2",
    hint: "홈택스(민원증명)에서 발급",
  },
];

export const SCREENING_3_DOCS: DocItem[] = [
  {
    key: "device_nameplate",
    label: "기기 명판 사진",
    category: "screening_3",
    hint: "기기에 부착된 모델명·시리얼 명판을 선명하게 촬영",
  },
  {
    key: "device_photos",
    label: "기기 상하좌우 사진",
    category: "screening_3",
    hint: "기기 전체가 보이도록 상·하·좌·우 각 방향 촬영",
  },
  {
    key: "damage_photos",
    label: "파손부위 사진",
    category: "screening_3",
    hint: "파손·흠집 부위 근접 촬영 (없으면 생략 가능)",
  },
  {
    key: "device_list_excel",
    label: "기기정보 목록(엑셀)",
    category: "screening_3",
    hint: "모델명·수량·구매시기 등을 정리한 목록 파일",
  },
];

// ── 거래 진정성 증빙 서류 (풍현이 생성·체결·보관) ──────────
// 목적: "위장 대부(양도담보)"가 아니라 "진정한 매매 + 진정한 임대차"임을
// 객관적 문서로 입증하기 위한 내부 서류. 고객에게 받는 심사서류와 별개.

// ① 계약 체결 — 매매/임대차를 형식·내용상 분리
export const CONTRACT_DOCS: DocItem[] = [
  {
    key: "sale_contract",
    label: "매매계약서 (독립)",
    category: "contract",
    hint: "소유권 이전 명시 · 대출/원금/이자/한도/승인 등 금융용어 금지",
  },
  {
    key: "rental_contract",
    label: "임대차(렌탈)계약서 (독립)",
    category: "contract",
    hint: "정액 렌탈료 · 기간 · 반납/인수 선택권 · 자동연장 불가 · 반납 시 불이익 없음",
  },
  {
    key: "residual_value_basis",
    label: "잔존가치·인수가 산정 근거서",
    category: "contract",
    hint: "감가상각표 + 중고시세 캡처 (고액 건은 딜러 견적 첨부)",
  },
];

// ② 자산 인도 · 소유권 이전 — 점유개정 구조에서 이전의 실질성 확보
export const DELIVERY_DOCS: DocItem[] = [
  {
    key: "delivery_sale",
    label: "인도확인서 (매매: 고객→풍현)",
    category: "funding",
    hint: "풍현이 소유권을 취득했음을 확인",
  },
  {
    key: "delivery_rental",
    label: "인도확인서 (임대차: 풍현→고객)",
    category: "funding",
    hint: "고객이 임차인으로서 점유를 개시함을 확인",
  },
  {
    key: "inspection_report",
    label: "현장 검수확인서",
    category: "funding",
    hint: "제조번호(S/N) 대조 · 외관/작동 사진 · 검수자·고객 서명",
  },
  {
    key: "owner_label_photo",
    label: "소유자 표시(라벨) 사진",
    category: "funding",
    hint: "자산에 부착된 소유자 라벨 촬영 (유지의무는 계약서 조항으로)",
  },
  {
    key: "insurance_cert",
    label: "동산보험 증권 (해당 시)",
    category: "funding",
    hint: "풍현을 피보험자로 지정 · 포트폴리오 일괄부보로 갈음 가능",
  },
  {
    key: "title_transfer",
    label: "명의이전 증빙 (등록대상 자산만)",
    category: "funding",
    hint: "자동차·건설기계·선박 등 등록원부상 풍현 명의 이전 (의료기기는 해당 없음)",
  },
];

// ③ 만기 · 정산/재렌탈 — 선택권 실재 · 반납 실질 · 완전 비소구 입증
export const MATURITY_DOCS: DocItem[] = [
  {
    key: "maturity_notice",
    label: "만기 선택 통지서",
    category: "maturity",
    hint: "만기 전, 반납·인수·재렌탈 중 선택 통지 (자동연장 아님)",
  },
  {
    key: "customer_choice",
    label: "고객 의사확인서",
    category: "maturity",
    hint: "고객이 선택한 옵션의 서면/전자 회신 (선택권 실재성 입증)",
  },
  {
    key: "return_confirm",
    label: "반납·회수확인서 (반납 시)",
    category: "maturity",
    hint: "회수 운송장 · 상태 점검표 · 반납 확인 서명",
  },
  {
    key: "rerental_contract",
    label: "재렌탈 신규 계약서 (재렌탈 시)",
    category: "maturity",
    hint: "기간연장이 아닌 신규 독립 임대차 (신규 자금 교부 없음 명시)",
  },
  {
    key: "residual_recalc",
    label: "인수가 재산정서 (재렌탈 시)",
    category: "maturity",
    hint: "감가상각 반영 · 회차별로 인수가가 낮아져야 함",
  },
  {
    key: "nonrecourse_confirm",
    label: "완전 비소구(Non-recourse) 확인서",
    category: "maturity",
    hint: "매각대금이 인수가에 미달해도 차액 미청구 · 거래 종료 확인",
  },
];

// 고객에게 안내하는 필수 서류(공유 문구)는 심사서류만. 거래 서류는 내부 관리.
export const ALL_DOCS: DocItem[] = [...SCREENING_2_DOCS, ...SCREENING_3_DOCS];

// 거래 진정성 서류 전체 (내부 참고용)
export const TRANSACTION_DOCS: DocItem[] = [
  ...CONTRACT_DOCS,
  ...DELIVERY_DOCS,
  ...MATURITY_DOCS,
];
