import type { StageKey } from "./pipeline";

export type CustomerSource = "homepage" | "manual";
export type HospitalType = "individual" | "corporate";
export type MaturityResult = "acquire" | "return" | "re_rental";

export type Customer = {
  id: string;
  created_at: string;
  updated_at: string;
  source: CustomerSource;
  stage: StageKey;
  share_token: string;
  sales_agent_id: string | null;

  representative: string | null;
  phone: string | null;
  email: string | null;
  hospital_name: string | null;
  hospital_type: HospitalType | null;
  needed_funds: string | null;

  intake_date: string | null;
  contract_date: string | null;
  maturity_date: string | null;

  inspection_date: string | null;
  execution_amount: number | null;
  rental_price: number | null;
  internal_review_done: boolean;

  contract_sent: boolean;
  contract_done: boolean;

  funding_scheduled_date: string | null;
  funding_done: boolean;
  funding_done_date: string | null;

  // 회차별 렌탈료 입금 스케줄 (첫 입금일 + 총 회차 → 매월 예정, paid_count까지 완납)
  first_payment_date: string | null;
  rental_months: number | null;
  paid_count: number;

  // 영업 수수료 — 건별 수수료율 override(%)와 누적 지급액(원)
  commission_rate: number | null;
  commission_paid: number;

  // (구) 3회차 납부 플래그 — 신규 스케줄로 대체. DB 컬럼 보존, UI 미사용.
  payment_1: boolean;
  payment_2: boolean;
  payment_3: boolean;
  unpaid: boolean;

  maturity_result: MaturityResult | null;
  acquisition_price: number | null;
  non_recourse_confirmed: boolean;
  sale_proceeds: number | null;
  sale_date: string | null;

  internal_memo: string | null;
};

export type CustomerDocument = {
  id: string;
  customer_id: string;
  category: string;
  doc_key: string;
  checked: boolean;
  file_path: string | null;
  uploaded_at: string | null;
  device_id: string | null;
};

export type CustomerDevice = {
  id: string;
  customer_id: string;
  model_name: string | null;
  quantity: number | null;
  note: string | null;
  sort_order: number;
  created_at: string;
};
