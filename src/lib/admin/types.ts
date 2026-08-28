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

  payment_1: boolean;
  payment_2: boolean;
  payment_3: boolean;
  unpaid: boolean;

  maturity_result: MaturityResult | null;

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
};
