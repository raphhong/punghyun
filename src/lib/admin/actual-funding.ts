import { validPaymentDate, todayISO } from "./payments";

export type ActualFundingInput = { cashDate: string; amount: number; evidence: string; confirmed: boolean };
export type ActualFundingRecord = { id: string; customer_id: string; cash_date: string | null; amount: number | null; source_reference: string; note: string | null };
export type ActualFundingState = { rows: ActualFundingRecord[]; fundingType: string | null; creditorName: string | null; error?: string };

export function parseActualFunding(value: unknown, today = todayISO()): ActualFundingInput | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<ActualFundingInput>;
  if (!validPaymentDate(v.cashDate) || v.cashDate < "1900-01-01" || v.cashDate > today ||
    typeof v.amount !== "number" || !Number.isSafeInteger(v.amount) || v.amount <= 0 ||
    typeof v.evidence !== "string" || !v.evidence.trim() || v.evidence.trim().length > 1000 || v.confirmed !== true) return null;
  return { cashDate: v.cashDate, amount: v.amount, evidence: v.evidence.trim(), confirmed: true };
}

// This deliberately supports only the first actual funding entry per customer.
// A stable registration reference + the existing UNIQUE(source_reference)
// prevents concurrent/retried requests, even with changed amounts, from appending.
export function initialFundingReference(customerId: string): string {
  return `admin-initial-funding:v1:${customerId}`;
}

export function fundingEvidence(note: string | null): string | null {
  try {
    const value = JSON.parse(note ?? "null");
    return value?.type === "admin_initial_funding_v1" && typeof value.evidence === "string" ? value.evidence : null;
  } catch { return null; }
}

export function matchesInitialFunding(row: ActualFundingRecord, customerId: string, input: ActualFundingInput): boolean {
  return row.customer_id === customerId && row.source_reference === initialFundingReference(customerId) &&
    row.cash_date === input.cashDate && row.amount === input.amount && fundingEvidence(row.note) === input.evidence;
}
