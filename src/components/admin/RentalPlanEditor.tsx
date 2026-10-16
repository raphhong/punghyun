"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { plannedSchedule, fmtWon, type ScheduleInput } from "@/lib/admin/payments";

type SavePlan = (id: string, updatedAt: string, rows: unknown) => Promise<{ ok: true } | { error: string }>;

// Separate from paid_count controls and AutosaveForm: this button saves plans only.
export function RentalPlanEditor({ id, updatedAt, schedule, action }: {
  id: string; updatedAt: string; schedule: ScheduleInput; action: SavePlan;
}) {
  const router = useRouter();
  const resolved = plannedSchedule(schedule);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState(() => resolved.rows.length
    ? resolved.rows.map(r => ({ no: r.no, dueDate: r.dueDate, amount: r.amount == null ? "" : String(r.amount) }))
    : Array.from({ length: Math.min(Math.max(schedule.rental_months ?? 3, 1), 600) }, (_, i) => ({ no: i + 1, dueDate: "", amount: "" })));
  const hasInvalidExisting = schedule.payment_schedule != null && Boolean(resolved.error);

  return <div className="space-y-3">
    <p className="text-sm text-navy-500">회차마다 예정일과 VAT 포함 금액을 입력합니다. 예정 저장은 입금 완료 처리를 하지 않습니다.</p>
    {resolved.rows.length > 0 && <p className="text-sm font-semibold">총 {resolved.rows.length}회 · {resolved.rows.every(r => r.amount !== null) ? fmtWon(resolved.rows.reduce((sum, r) => sum + (r.amount ?? 0), 0)) : "금액 확인 필요"} (VAT 포함)</p>}
    {hasInvalidExisting && <p role="alert">기존 일정에 오류가 있습니다. 기존 데이터 확인 후 수정해 주세요.</p>}
    {!editing ? <button type="button" disabled={hasInvalidExisting} onClick={() => { setMessage(""); setEditing(true); }} className="rounded-lg border border-navy-200 px-3 py-2 text-sm disabled:opacity-50">회차별 예정 입력·수정</button> :
      <form onSubmit={event => {
        event.preventDefault();
        const values = rows.map(r => ({ no: r.no, dueDate: r.dueDate, amount: r.amount.trim() === "" ? null : Number(r.amount) }));
        startTransition(async () => {
          try {
            const result = await action(id, updatedAt, values);
            if ("error" in result) { setMessage(result.error); return; }
            setEditing(false);
            setMessage("예정을 저장했습니다. 수납 상태는 변경하지 않았습니다.");
            router.refresh();
          } catch { setMessage("저장 결과를 확인하지 못했습니다. 새로고침 후 확인해 주세요."); }
        });
      }} className="space-y-3">
        <fieldset disabled={pending} className="space-y-2">
          {rows.map((r, index) => <div key={r.no} className="grid gap-2 sm:grid-cols-[4rem_1fr_1fr]">
            <span className="py-2 text-sm">{r.no}회차</span>
            <input aria-label={`${r.no}회차 예정일`} type="date" required value={r.dueDate} onChange={e => setRows(rows.map((row, i) => i === index ? { ...row, dueDate: e.target.value } : row))} className="rounded-lg border border-navy-200 px-3 py-2 text-sm" />
            <input aria-label={`${r.no}회차 예정 금액 (VAT 포함 원)`} type="number" min="0" max="9007199254740991" step="1" required value={r.amount} onChange={e => setRows(rows.map((row, i) => i === index ? { ...row, amount: e.target.value } : row))} className="rounded-lg border border-navy-200 px-3 py-2 text-sm" />
          </div>)}
          {schedule.rental_months == null && <button type="button" disabled={rows.length >= 600} onClick={() => setRows([...rows, { no: rows.length + 1, dueDate: "", amount: "" }])} className="text-sm text-brand-600">회차 추가</button>}
          <p className="text-sm">총 {rows.length}회 · {rows.every(r => r.amount !== "" && Number.isSafeInteger(Number(r.amount))) ? fmtWon(rows.reduce((sum, r) => sum + Number(r.amount), 0)) : "금액 입력 필요"} (VAT 포함)</p>
          <div className="flex gap-2">
            <button type="submit" className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white">{pending ? "저장 중…" : "렌탈 예정만 저장"}</button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-navy-200 px-3 py-2 text-sm">취소</button>
          </div>
        </fieldset>
      </form>}
    {message && <p role="status" className="text-sm text-navy-600">{message}</p>}
  </div>;
}
