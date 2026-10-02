"use client";

import Link from "next/link";
import { fmtWon, type PaymentStatus } from "@/lib/admin/payments";

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

// The inbox only links to explicit, reviewed receipt entry; it never writes paid_count.
export function PaymentInbox({ items }: { items: PendingRow[] }) {
  const overdue = items.filter((r) => r.status === "overdue").length;
  const today = items.filter((r) => r.status === "due_today").length;
  const sumDue = items.reduce((s, r) => s + (r.amount ?? 0), 0);

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
            대상 회차 예정액 {fmtWon(sumDue)}
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
              <Link
                href={`${row.href}#cashflow-editor`}
                className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
              >
                수납 원장 확인·등록
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
