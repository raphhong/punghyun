import { addMonths, resolvePaymentSchedule, validDate } from "./payments";
import type { Customer } from "./types";
export { validDate } from "./payments";

// Read-only projection. paid_count is never evidence of a dated cash receipt.
export type CashCustomer = Pick<Customer, "id" | "hospital_name" | "stage" | "first_payment_date" | "rental_months" | "rental_price" | "paid_count" | "execution_amount" | "funding_scheduled_date" | "funding_done" | "funding_done_date"> & {
  payment_schedule?: unknown;
  receipt_ledger?: unknown;
};
export type FundingProfile = { customer_id: string; funding_type: "own" | "securitized" | null; creditor_name: string | null };
export type Movement = {
  id: string; customer_id: string; kind: "creditor_payment" | "securitization_inflow" | "funding_disbursement" | "rental_receipt";
  basis: "planned" | "actual"; cash_date: string | null; amount: number | null;
  cash_month?: string | null; installment_no?: number | null;
};
export type Amount = { value: number; known: number; missing: number; na?: boolean };
export type FlowKey = "rentalPlan" | "rentalActual" | "creditorPlan" | "creditorActual" | "fundingPlan" | "fundingActual" | "inflowPlan" | "inflowActual";
export const flowLabels: Record<FlowKey, string> = {
  rentalPlan: "렌탈료 예정", rentalActual: "렌탈료 실제 수납", creditorPlan: "채권사 지급 예정", creditorActual: "채권사 실제 지급",
  fundingPlan: "자금 집행 예정", fundingActual: "자금 실제 집행", inflowPlan: "유동화 유입 예정", inflowActual: "유동화 실제 유입",
};
export const flowKeys = Object.keys(flowLabels) as FlowKey[];
export type CashRow = { id: string; name: string; fundingType: FundingProfile["funding_type"]; creditor: string | null; flows: Record<FlowKey, Amount>; cumulative: Amount; issues: string[]; details: { label: string; date: string | null; amount: number | null }[] };
const empty = (): Amount => ({ value: 0, known: 0, missing: 0 });
const missing = (): Amount => ({ value: 0, known: 0, missing: 1 });
const money = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export function koreaToday(now = new Date()): string { return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(now); }
export function validMonth(v: unknown): v is string { return typeof v === "string" && /^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(v); }
export function shiftMonth(month: string, offset: number) { return addMonths(month + "-01", offset).slice(0, 7); }
export function amountText(a: Amount): string {
  if (a.na) return "해당 없음";
  if (!a.known && a.missing) return "미입력 / 확인 필요";
  return `${a.missing ? "확인분 " : ""}₩${a.value.toLocaleString("ko-KR")}`;
}
export function totalAmounts(values: Amount[]): Amount { return values.reduce((a, b) => ({ value: a.value + b.value, known: a.known + b.known, missing: a.missing + b.missing }), empty()); }
export function net(flows: Record<FlowKey, Amount>, basis: "Plan" | "Actual"): Amount {
  const incoming = totalAmounts([flows[`rental${basis}`], flows[`inflow${basis}`]]);
  const outgoing = totalAmounts([flows[`creditor${basis}`], flows[`funding${basis}`]]);
  return { value: incoming.value - outgoing.value, known: incoming.known + outgoing.known, missing: incoming.missing + outgoing.missing };
}

export function cashflowCustomers(customers: CashCustomer[], movements: Movement[], movementsAvailable = true) {
  const recorded = new Set(movements.map(m => m.customer_id));
  return customers.filter(c => {
    const ledger = c.receipt_ledger;
    // Preserve even incomplete historical evidence; this is scope, not proof of cash.
    const receiptHistory = Number(c.paid_count) > 0 || (ledger != null && (
      !object(ledger) || !Array.isArray(ledger.entries) || ledger.entries.length > 0 || Number(ledger.legacyPaidCount) > 0
    ));
    const history = recorded.has(c.id) || Boolean(c.funding_done) || Boolean(c.funding_done_date) || receiptHistory;
    // Dates/amounts in an unexecuted proposal must not revive a cancelled contract.
    if (c.stage === "closed") return history || !movementsAvailable;
    return recorded.has(c.id) || Boolean(c.funding_done) || ["contract", "funding", "operation", "maturity"].includes(c.stage) || Boolean(c.first_payment_date) || Boolean(c.funding_scheduled_date);
  });
}

export function projectCashflow(customers: CashCustomer[], profiles: FundingProfile[], movements: Movement[], month: string, today = koreaToday(), movementsAvailable = true) {
  if (!validMonth(month) || !validDate(today)) throw new Error("Invalid cashflow period");
  const rows: CashRow[] = cashflowCustomers(customers, movements, movementsAvailable).map(c => {
    const profile = profiles.find(p => p.customer_id === c.id);
    const flows = Object.fromEntries(flowKeys.map(k => [k, empty()])) as Record<FlowKey, Amount>;
    const row: CashRow = { id: c.id, name: c.hospital_name || "상호 미입력", fundingType: profile?.funding_type ?? null, creditor: profile?.creditor_name ?? null, flows, cumulative: empty(), issues: [], details: [] };
    const add = (key: FlowKey, date: unknown, amount: unknown, label: string, cashMonth?: string | null) => {
      if (!validDate(date) && validMonth(cashMonth)) {
        row.issues.push(`${label}: ${cashMonth} 월만 확인 · 정확한 일자 미확인`);
        if (key.endsWith("Actual") && cashMonth > today.slice(0, 7)) { flows[key].missing++; return; }
        if (cashMonth !== month) return;
        if (money(amount)) { flows[key].value += amount; flows[key].known++; } else flows[key].missing++;
        row.details.push({ label, date: `${cashMonth} (월만 확인)`, amount: money(amount) ? amount : null });
        return;
      }
      if (!validDate(date)) { flows[key].missing++; row.issues.push(`${label}: 날짜 미입력 또는 오류`); row.details.push({ label, date: null, amount: money(amount) ? amount : null }); return; }
      if (!date.startsWith(month)) return;
      // Actual future-dated entries cannot describe cash already moved.
      if (key.endsWith("Actual") && date > today) { flows[key].missing++; row.issues.push(`${label}: 미래 실제일 확인 필요`); return; }
      if (!money(amount)) { flows[key].missing++; row.issues.push(`${label}: 금액 미입력 또는 오류`); }
      else { flows[key].value += amount; flows[key].known++; }
      row.details.push({ label, date, amount: money(amount) ? amount : null });
    };
    const schedule = resolvePaymentSchedule(c);
    if (!schedule.ok) {
      flows.rentalPlan = missing();
      row.issues.push(schedule.error === "invalid_basis"
        ? "렌탈 일정 기준(첫 납부일·총 회차) 미입력 또는 오류"
        : "개별 납부 일정 오류: 기본 일정으로 대체하지 않음");
    } else {
      for (const installment of schedule.installments) {
        add("rentalPlan", installment.dueDate, installment.amount, `렌탈 예정 ${installment.no}회차`);
      }
    }
    // Compatibility adapter for the independently maintained 2026-09-27 ledger.
    // Do not install, populate, or modify that ledger here.
    const ledger = c.receipt_ledger;
    const cashReceipts = movements.filter(m => m.customer_id === c.id && m.kind === "rental_receipt" && m.basis === "actual");
    if (ledger == null && cashReceipts.length) {
      for (const r of cashReceipts) add("rentalActual", r.cash_date, r.amount, `실제 수납 ${r.installment_no ?? "미지정"}회차`, r.cash_month);
      if (!flows.rentalActual.known && !flows.rentalActual.missing) flows.rentalActual.missing++;
    } else if (!object(ledger) || !Array.isArray(ledger.entries) || !Number.isInteger(ledger.legacyPaidCount) || Number(ledger.legacyPaidCount) < 0) {
      flows.rentalActual = missing(); row.issues.push("실제 수납원장 미입력: 완납 회차 수로 실제 수납을 추정하지 않음");
    } else {
      if (cashReceipts.length) row.issues.push("기존 수납원장과 현금 원장이 함께 있음: 기존 수납원장만 집계하여 중복 방지 · 원천 대조 필요");
      if (Number(ledger.legacyPaidCount) > 0) { flows.rentalActual.missing++; row.issues.push("과거 완납분의 실제 수납일·금액 확인 필요"); }
      const ids = new Set<string>();
      for (const entry of ledger.entries) {
        if (!object(entry) || typeof entry.id !== "string" || ids.has(entry.id) || typeof entry.amount !== "number" || !Number.isSafeInteger(entry.amount) || !validDate(entry.receivedDate)) {
          flows.rentalActual.missing++; row.issues.push("수납원장 오류 또는 중복: 해당 항목 제외"); continue;
        }
        ids.add(entry.id);
        // Negative correction entries are cash dated, not allocated to the original due month.
        if (entry.receivedDate.startsWith(month)) {
          if (entry.receivedDate > today) { flows.rentalActual.missing++; row.issues.push("미래 수납일 확인 필요"); continue; }
          flows.rentalActual.value += entry.amount; flows.rentalActual.known++;
          row.details.push({ label: `실제 수납 ${entry.no ?? "?"}회차${entry.amount < 0 ? " (정정)" : ""}`, date: entry.receivedDate, amount: entry.amount });
        }
      }
      // An empty ledger is not a confirmation that no cash moved this month.
      if (!flows.rentalActual.known) { flows.rentalActual.missing++; row.issues.push("선택 월 실제 수납 기록 없음: 미수납 확정 아님"); }
    }
    // Contract purchase price / legacy completed flags do not prove tranche cash.
    // Use one authoritative source for initial and residual disbursements.
    for (const basis of ["planned", "actual"] as const) {
      const key = basis === "planned" ? "fundingPlan" : "fundingActual";
      const entries = movements.filter(m => m.customer_id === c.id && m.kind === "funding_disbursement" && m.basis === basis);
      if (!entries.length) flows[key] = missing();
      for (const m of entries) add(key, m.cash_date, m.amount, basis === "planned" ? "개별 집행 예정" : "개별 실제 집행", m.cash_month);
    }
    const actualFunding = movements.filter(m => m.customer_id === c.id && m.kind === "funding_disbursement" && m.basis === "actual");
    if (!actualFunding.length) row.cumulative = missing();
    for (const m of actualFunding) {
      if (!money(m.amount) || (validDate(m.cash_date) && m.cash_date > today) || (validMonth(m.cash_month) && m.cash_month > today.slice(0, 7))) { row.cumulative.missing++; continue; }
      if (!validDate(m.cash_date)) row.issues.push(validMonth(m.cash_month) ? "실제 집행 월만 확인: 누적·해당 월 합산, 정확한 일자 미확인" : "실제 지급 확인·날짜 미확인: 누적만 합산, 월별 배분 제외");
      row.cumulative.value += m.amount; row.cumulative.known++;
    }
    if (!actualFunding.length || row.cumulative.missing) row.issues.push("최초 집행·잔금의 실제일/이체금액 확인 필요: 기존 매입총액·완료표시는 실제 집행 합산에서 제외");
    if (c.execution_amount != null) row.details.push({ label: "기존 집행 설정 금액 (참고·현금흐름 합산 제외)", date: validDate(c.funding_done_date) ? c.funding_done_date : null, amount: money(c.execution_amount) ? c.execution_amount : null });
    const own = row.fundingType === "own";
    for (const kind of ["creditor_payment", "securitization_inflow"] as const) for (const basis of ["planned", "actual"] as const) {
      const key: FlowKey = `${kind === "creditor_payment" ? "creditor" : "inflow"}${basis === "planned" ? "Plan" : "Actual"}`;
      const entries = movements.filter(m => m.customer_id === c.id && m.kind === kind && m.basis === basis);
      if (own) { flows[key].na = true; if (entries.length) { flows[key].missing++; row.issues.push("자체자금 건에 유동화 원장 존재: 불일치 확인 필요"); } continue; }
      if (!row.fundingType || !entries.length) { flows[key] = missing(); }
      for (const m of entries) add(key, m.cash_date, m.amount, flowLabels[key], m.cash_month);
      // Other months' entries do not confirm a zero obligation or zero cash this month.
      if (!flows[key].known && !flows[key].missing) flows[key].missing++;
    }
    if (!row.fundingType) row.issues.push("자금 구분 미입력: 자체자금으로 간주하지 않음");
    if (row.fundingType === "securitized" && !row.creditor) row.issues.push("채권사 미입력");
    if (!own && flowKeys.some(k => (k.startsWith("creditor") || k.startsWith("inflow")) && flows[k].missing)) row.issues.push("채권사 지급·유동화 유입 조건/거래 미입력 또는 확인 필요");
    row.issues = [...new Set(row.issues)];
    return row;
  });
  const totals = Object.fromEntries(flowKeys.map(k => [k, totalAmounts(rows.map(r => r.flows[k]))])) as Record<FlowKey, Amount>;
  return { rows, totals, cumulative: totalAmounts(rows.map(r => r.cumulative)), plannedNet: net(totals, "Plan"), actualNet: net(totals, "Actual") };
}
