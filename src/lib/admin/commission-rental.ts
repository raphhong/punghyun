import { buildSchedule, dueLabel, type ScheduleInput } from "./payments";

export type RentalStatus = "fully_paid" | "overdue" | "in_progress" | "none" | "unknown";

// A read-only signal, never a commission calculation or permission to recover.
// The receipt source must be complete before absence can imply an unpaid row.
export function commissionRentalStatus(
  customer: ScheduleInput & { receipt_ledger?: unknown },
  today: string,
  receiptsAvailable: boolean,
): { status: RentalStatus; detail: string } {
  if (!receiptsAvailable) return { status: "unknown", detail: "렌탈 확인 필요 · 수납 원장 조회 불가" };
  if (customer.receipt_ledger != null) return { status: "unknown", detail: "렌탈 확인 필요 · 기존 수납원장 대조 필요" };
  if (customer.rental_months == null) return { status: "none", detail: "회차 미설정" };

  const schedule = buildSchedule(customer, today);
  if (!schedule.length) return { status: "unknown", detail: "렌탈 확인 필요 · 납부 일정 미확인" };
  const actualPaid = schedule.filter(row => row.paidEvidence === "receipt").length;
  const legacyPaid = schedule.filter(row => row.paidEvidence === "legacy").length;
  const paid = actualPaid + legacyPaid;
  const evidence = `수납 확인 ${actualPaid}회${legacyPaid ? ` · 과거 완납 표시 ${legacyPaid}회` : ""}`;

  if (schedule.every(row => row.paid)) {
    return { status: "fully_paid", detail: `렌탈 완납${legacyPaid ? " 표시" : ""} · ${evidence}` };
  }
  // Unknown due amounts cannot establish whether a receipt was sufficient.
  if (schedule.some(row => !row.paid && row.amount == null)) {
    return { status: "unknown", detail: `렌탈 확인 필요 · 납부 금액 미확인 · ${evidence}` };
  }
  const overdue = schedule.filter(row => row.status === "overdue")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  if (overdue) return { status: "overdue", detail: `렌탈 ${dueLabel(overdue.dueDate, today)} · ${evidence}` };
  return { status: "in_progress", detail: `렌탈 ${paid}/${schedule.length} · ${evidence}` };
}
