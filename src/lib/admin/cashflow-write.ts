// Pure boundary types/validation. No credentials or database client in this module.
export type ScheduleLine = { no: number; dueDate: string; amount: number };
export type CashMovement = {
  id: string; customer_id: string;
  kind: "funding_disbursement" | "rental_receipt" | "creditor_payment" | "securitization_inflow";
  basis: "planned" | "actual"; cash_date: string | null; cash_month: string | null;
  installment_no: number | null; amount: number | null; source_reference: string; note: string | null;
};
export type CashflowSnapshot = {
  customer: { first_payment_date: string | null; rental_months: number | null; rental_price: number | null; payment_schedule: unknown; paid_count: number | null; receipt_ledger: unknown };
  profile: { customer_id: string; funding_type: "own" | "securitized" | null; creditor_name: string | null } | null;
  movements: CashMovement[];
};
export type CashflowState = { version: string; snapshot: CashflowSnapshot };
export type CashflowChange =
  | { operation: "schedule"; first_payment_date: string; rental_months: number; rental_price: number; payment_schedule: ScheduleLine[]; expected_total: number; reason: string }
  | { operation: "movement"; id: string | null; kind: CashMovement["kind"]; basis: CashMovement["basis"]; cash_date: string; installment_no: number | null; amount: number; source_reference: string; note: string; reason: string }
  | { operation: "profile"; funding_type: "own" | "securitized" | null; creditor_name: string | null; reason: string };
export type CashflowSaveRequest = { customerId: string; requestId: string; expectedVersion: string; change: CashflowChange };
export type CashflowResult = { ok: true; state: CashflowState; replayed?: boolean } | { error: string; code?: string };
export const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max;
export function cashDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^(19|20|21)\d{2}-\d{2}-\d{2}$/.test(v)) return false;
  const date = new Date(`${v}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === v;
}
export function validateCashflowRequest(value: unknown, today: string): string | null {
  if (!object(value) || !isUuid(value.customerId) || !isUuid(value.requestId) || typeof value.expectedVersion !== "string" || !/^[0-9a-f]{32}$/.test(value.expectedVersion)) return "잘못된 저장 요청입니다. 새로고침해 주세요.";
  const c = value.change;
  if (!object(c) || typeof c.reason !== "string" || c.reason.trim().length < 4 || c.reason.length > 500) return "등록·수정 사유를 4~500자로 입력해 주세요.";
  if (c.operation === "schedule") {
    if (!cashDate(c.first_payment_date) || !integer(c.rental_months, 1, 600) || !integer(c.rental_price, 1) || !integer(c.expected_total, 1) || !Array.isArray(c.payment_schedule) || c.payment_schedule.length !== c.rental_months) return "첫 납부일·회차·정수 원 금액·전체 일정을 확인해 주세요.";
    let sum = 0; const seen = new Set<number>(); let previous = "";
    for (let index = 0; index < c.payment_schedule.length; index++) {
      const row = c.payment_schedule[index];
      if (!object(row) || !integer(row.no, 1, c.rental_months) || row.no !== index + 1 || seen.has(row.no) || !cashDate(row.dueDate) || !integer(row.amount, 1) || row.dueDate < previous) return "회차는 1부터 순서대로, 납부일은 날짜순으로, 금액은 정수 원으로 입력해 주세요.";
      seen.add(row.no); previous = row.dueDate; sum += row.amount;
      if (!Number.isSafeInteger(sum)) return "렌탈 총액이 허용 범위를 초과했습니다.";
    }
    if ((c.payment_schedule[0] as ScheduleLine).dueDate !== c.first_payment_date || sum !== c.expected_total) return "첫 납부일 또는 회차별 합계가 입력한 계약 총액과 다릅니다.";
    return null;
  }
  if (c.operation === "movement") {
    if (!(c.id === null || isUuid(c.id)) || !["funding_disbursement", "rental_receipt", "creditor_payment", "securitization_inflow"].includes(String(c.kind)) || !["planned", "actual"].includes(String(c.basis)) || !cashDate(c.cash_date) || !integer(c.amount, 1) || typeof c.source_reference !== "string" || (c.id === null ? c.source_reference.trim().length < 3 || c.source_reference.length > 200 : c.source_reference.trim().length < 1) || typeof c.note !== "string" || c.note.length > 500 || !(c.installment_no === null || integer(c.installment_no, 1, 600))) return "거래 종류·일자·금액·증빙 식별번호를 확인해 주세요.";
    if (c.basis === "actual" && c.cash_date > today) return "실제 거래일은 미래일 수 없습니다.";
    if (c.kind === "rental_receipt" && (c.basis !== "actual" || !integer(c.installment_no, 1, 600))) return "실제 수납은 회차와 실제 입금일을 입력해야 합니다.";
    if (c.kind !== "rental_receipt" && c.installment_no !== null) return "렌탈 수납 외 거래에는 회차를 지정하지 않습니다.";
    return null;
  }
  if (c.operation === "profile") {
    if (![null, "own", "securitized"].includes(c.funding_type as null | string) || !(c.creditor_name === null || (typeof c.creditor_name === "string" && c.creditor_name.trim().length > 0 && c.creditor_name.length <= 200))) return "자금 구분과 채권사를 확인해 주세요.";
    if (c.funding_type !== "securitized" && c.creditor_name !== null) return "유동화 건에만 채권사를 지정할 수 있습니다.";
    if (c.funding_type === "securitized" && c.creditor_name === null) return "유동화 건의 채권사를 입력해 주세요.";
    return null;
  }
  return "지원하지 않는 저장 요청입니다.";
}
