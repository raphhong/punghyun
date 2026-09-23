"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fmtWon, type PaymentStatus } from "@/lib/admin/payments";

type SetPaidCount = (
  id: string,
  count: number,
) => Promise<{ ok: true } | { error: string }>;

export type PendingRow = {
  id: string;
  hospitalName: string;
  href: string;
  no: number;
  total: number;
  dueDate: string;
  amount: number | null;
  status: PaymentStatus;
  label: string; // 연체 N일 / 오늘 / D-n
};

const badgeStyle: Record<PaymentStatus, string> = {
  paid: "bg-brand-50 text-brand-700",
  overdue: "bg-red-100 text-red-700",
  due_today: "bg-amber-100 text-amber-800",
  upcoming: "bg-amber-50 text-amber-700",
  scheduled: "bg-navy-100 text-navy-500",
};

// 대시보드 렌탈료 입금 인박스 — 오늘/연체/임박 회차를 모아 보여주고,
// [입금 확인] 한 번으로 해당 회차를 완납 처리(paid_count 증가)해 목록에서 정리한다.
export function PaymentInbox({
  items,
  action,
}: {
  items: PendingRow[];
  action: SetPaidCount;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const overdue = items.filter((r) => r.status === "overdue").length;
  const today = items.filter((r) => r.status === "due_today").length;
  const sumDue = items.reduce((s, r) => s + (r.amount ?? 0), 0);

  function confirm(row: PendingRow) {
    startTransition(async () => {
      const res = await action(row.id, row.no); // 해당 회차까지 완납
      if ("error" in res) {
        alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-navy-100 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-navy-100 px-5 py-4">
        <h2 className="font-semibold text-navy-900">렌탈료 입금 인박스</h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {overdue > 0 && (
            <span className="rounded-full bg-red-100 px-2.5 py-1 font-semibold text-red-700">
              연체 {overdue}건
            </span>
          )}
          {today > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800">
              오늘 {today}건
            </span>
          )}
          <span className="text-navy-500">
            예상 입금 {fmtWon(sumDue)}
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-navy-400">
          이번 2주 내 예정된 렌탈료 입금이 없습니다.
        </p>
      ) : (
        <ul className="divide-y divide-navy-100">
          {items.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3"
            >
              <span
                className={`w-20 shrink-0 rounded-full px-2 py-1 text-center text-[11px] font-semibold ${badgeStyle[row.status]}`}
              >
                {row.label}
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={row.href}
                  className="text-sm font-medium text-navy-900 hover:text-brand-600 hover:underline"
                >
                  {row.hospitalName}
                </Link>
                <p className="text-xs text-navy-500">
                  {row.no}/{row.total}회차 · {row.dueDate}
                </p>
              </div>
              <span className="text-sm font-semibold text-navy-800">
                {fmtWon(row.amount)}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => confirm(row)}
                className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
              >
                입금 확인
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
