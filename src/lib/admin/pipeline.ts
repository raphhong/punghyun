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
export type DocItem = { key: string; label: string; category: StageKey };

export const SCREENING_2_DOCS: DocItem[] = [
  { key: "business_registration", label: "사업자등록증", category: "screening_2" },
  { key: "medical_license", label: "의료기관 개설 신고 증명", category: "screening_2" },
  { key: "rep_id", label: "대표자 신분증", category: "screening_2" },
  { key: "card_sales_6m", label: "최근 6개월 카드매출(카드사 발급)", category: "screening_2" },
  { key: "tax_payment_cert", label: "국세 및 지방세 완납 증명서", category: "screening_2" },
  { key: "income_cert_2y", label: "최근 2년 소득금액증명원", category: "screening_2" },
];

export const SCREENING_3_DOCS: DocItem[] = [
  { key: "device_nameplate", label: "기기 명판 사진", category: "screening_3" },
  { key: "device_photos", label: "기기 상하좌우 사진", category: "screening_3" },
  { key: "damage_photos", label: "파손부위 사진", category: "screening_3" },
  { key: "device_list_excel", label: "기기정보 목록(엑셀)", category: "screening_3" },
];

export const ALL_DOCS: DocItem[] = [...SCREENING_2_DOCS, ...SCREENING_3_DOCS];
