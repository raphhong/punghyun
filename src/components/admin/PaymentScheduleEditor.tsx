"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  buildSchedule,
  dueLabel,
  fmtWon,
  type Installment,
  type ScheduleInput,
} from "@/lib/admin/payments";

type SetPaidCount = (
  id: string,
  count: number,
) => Promise<{ ok: true } | { error: string }>;

const statusStyle: Record<Installment["status"], string> = {
  paid: "bg-brand-50 text-brand-700",
  overdue: "bg-red-50 text-red-600",
  due_today: "bg-amber-100 text-amber-700",
  upcoming: "bg-amber-50 text-amber-700",
  scheduled: "bg-navy-100 text-navy-500",
};
const statusLabel: Record<Installment["status"], string> = {
  paid: "납부",
  overdue: "연체",
  due_today: "오늘",
  upcoming: "임박",
  scheduled: "예정",
};

// 회차별 렌탈료 납부 현황 — 행 클릭으로 순차 완납/되돌리기(paid_count 설정).
// AutosaveForm 밖에 두어 폼 중첩·FormData 오염을 피한다.
export function PaymentScheduleEditor({
  id,
  schedule,
  action,
}: {
  id: string;
  schedule: ScheduleInput;
  action: SetPaidCount;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const rows = buildSchedule(schedule);
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-navy-200 bg-navy-50/50 px-3 py-4 text-center text-sm text-navy-400">
        먼저 첫 입금일과 총 회차를 입력하면 회차별 예정일이 표시됩니다.
      </p>
    );
  }

  const paidCount = schedule.paid_count ?? 0;
  const total = rows.length;
  const fullyPaid = paidCount >= total;

  function setPaid(n: number) {
    // 이미 납부된 마지막 회차를 누르면 그 직전까지 되돌리고, 아니면 그 회차까지 완납.
    const target = n <= paidCount ? n - 1 : n;
    startTransition(async () => {
      const res = await action(id, target);
      if ("error" in res) {
        alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            fullyPaid ? "bg-brand-500 text-white" : "bg-navy-100 text-navy-700"
          }`}
        >
          {fullyPaid ? "렌탈료 완납" : `납부 ${paidCount} / ${total}회차`}
        </span>
        <span className="text-xs text-navy-400">
          회차를 누르면 그 회차까지 완납 처리됩니다.
        </span>
      </div>

      <ul className="divide-y divide-navy-100 overflow-hidden rounded-lg border border-navy-100">
        {rows.map((r) => (
          <li key={r.no}>
            <button
              type="button"
              disabled={pending}
              onClick={() => setPaid(r.no)}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-navy-50 disabled:opacity-60"
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[11px] ${
                  r.paid
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "border-navy-300 bg-white text-transparent"
                }`}
              >
                ✓
              </span>
              <span className="w-12 shrink-0 text-sm font-medium text-navy-700">
                {r.no}회차
              </span>
              <span className="w-24 shrink-0 text-sm text-navy-600">
                {r.dueDate}
              </span>
              <span className="flex-1 text-sm text-navy-500">
                {fmtWon(r.amount)}
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusStyle[r.status]}`}
              >
                {r.paid
                  ? statusLabel.paid
                  : r.status === "scheduled"
                    ? statusLabel.scheduled
                    : dueLabel(r.dueDate)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
