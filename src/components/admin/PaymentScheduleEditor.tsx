"use client";

import { buildSchedule, dueLabel, fmtWon, type Installment, type ScheduleInput } from "@/lib/admin/payments";

const statusStyle: Record<Installment["status"], string> = {
  paid: "bg-brand-50 text-brand-700",
  overdue: "bg-red-50 text-red-600",
  due_today: "bg-amber-100 text-amber-700",
  upcoming: "bg-amber-50 text-amber-700",
  scheduled: "bg-navy-100 text-navy-500",
};

// Read-only schedule. A legacy paid_count is a status marker, never a cash receipt.
export function PaymentScheduleEditor({ schedule, hasLegacyLedger = false, receiptStatusUnavailable = false }: { schedule: ScheduleInput; hasLegacyLedger?: boolean; receiptStatusUnavailable?: boolean }) {
  const rows = buildSchedule(schedule);
  const statusUnavailable = hasLegacyLedger || receiptStatusUnavailable;
  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-navy-500">
        조회 전용 · 기존 납부 표시 {schedule.paid_count ?? 0}회차는 실제 입금일·수납액의 증빙이 아닙니다.
        실제 수납 및 일정 변경은 아래 현금흐름 편집에서 검토 후 저장하세요.
      </p>
      {hasLegacyLedger ? <p className="text-xs text-amber-800">기존 수납원장 대조가 필요해 수납 상태를 확인할 수 없습니다. 아래 날짜·금액은 계약 일정이며 납부·미납을 뜻하지 않습니다.</p> : receiptStatusUnavailable && <p role="alert" className="text-xs text-amber-800">실제 수납 원장을 불러오지 못해 수납 상태를 확인할 수 없습니다. 아래 날짜·금액은 계약 일정이며 납부·미납을 뜻하지 않습니다.</p>}
      <a href="#cashflow-editor" className="inline-block text-sm font-semibold text-brand-600 hover:underline">현금흐름 편집으로 이동 →</a>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-navy-200 px-3 py-4 text-sm text-navy-500">확인 가능한 납부 일정이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-navy-100 rounded-lg border border-navy-100">
          {rows.map((row) => (
            <li key={row.no} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
              <span className="w-12 shrink-0 font-medium text-navy-700">{row.no}회차</span>
              <span className="text-navy-600">{row.dueDate}</span>
              <span className="flex-1 text-navy-500">{fmtWon(row.amount)}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusUnavailable ? "bg-navy-100 text-navy-500" : statusStyle[row.status]}`}>
                {statusUnavailable ? "수납 상태 확인 불가" : row.paidEvidence === "receipt" ? "원장 수납 충족" : row.paid ? "기존 납부 표시" : row.status === "scheduled" ? "예정" : dueLabel(row.dueDate)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
