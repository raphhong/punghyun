"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fmtWon } from "@/lib/admin/payments";

type RecordAction = (
  customerId: string,
  amount: number,
  total: number,
) => Promise<{ ok: true } | { error: string }>;
type RateAction = (
  customerId: string,
  rate: number | null,
) => Promise<{ ok: true } | { error: string }>;

export type RentalStatus = "fully_paid" | "overdue" | "in_progress" | "none";

export type CommissionDeal = {
  customerId: string;
  hospitalName: string;
  href: string;
  executionAmount: number | null;
  overrideRate: number | null; // 건별 override (null = 기본율 사용)
  appliedRate: number; // 실제 적용율(%)
  total: number;
  paid: number;
  rentalStatus: RentalStatus; // 회수 판단용 신호(게이트 아님)
  rentalDetail: string;
};

const rentalStyle: Record<RentalStatus, string> = {
  fully_paid: "bg-brand-500/15 text-brand-700",
  overdue: "bg-red-100 text-red-700",
  in_progress: "bg-navy-100 text-navy-500",
  none: "bg-amber-50 text-amber-700",
};

export function CommissionRow({
  deal,
  recordAction,
  rateAction,
}: {
  deal: CommissionDeal;
  recordAction: RecordAction;
  rateAction: RateAction;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");

  const remaining = Math.max(0, deal.total - deal.paid);

  function parseAmount(): number | null {
    const n = Number(amount.replace(/[,\s]/g, ""));
    if (!Number.isFinite(n) || n <= 0) {
      alert("금액을 입력하세요.");
      return null;
    }
    return n;
  }

  function run(delta: number) {
    startTransition(async () => {
      const res = await recordAction(deal.customerId, delta, deal.total);
      if ("error" in res) {
        alert(res.error);
        return;
      }
      setAmount("");
      router.refresh();
    });
  }

  function pay() {
    const n = parseAmount();
    if (n != null) run(n);
  }
  function recover() {
    const n = parseAmount();
    if (n != null) run(-n);
  }
  function payAll() {
    if (remaining > 0) run(remaining);
  }

  function saveRate(raw: string) {
    const trimmed = raw.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    if (next !== null && !Number.isFinite(next)) return; // 잘못된 입력은 무시
    if (next === (deal.overrideRate ?? null)) return;
    startTransition(async () => {
      const res = await rateAction(deal.customerId, next);
      if ("error" in res) {
        alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  const payLabel =
    remaining <= 0 ? "지급 완료" : deal.paid > 0 ? "일부 지급" : "미지급";
  const payStyle =
    remaining <= 0
      ? "bg-brand-50 text-brand-700"
      : deal.paid > 0
        ? "bg-amber-50 text-amber-700"
        : "bg-navy-100 text-navy-600";

  return (
    <div className="grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-12 sm:items-center">
      {/* 상호 + 렌탈 상태(회수 신호) */}
      <div className="sm:col-span-3">
        <Link
          href={deal.href}
          className="text-sm font-medium text-navy-900 hover:text-brand-600 hover:underline"
        >
          {deal.hospitalName}
        </Link>
        <div className="mt-1">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${rentalStyle[deal.rentalStatus]}`}
            title="렌탈 진행 상황 (회수 판단용)"
          >
            {deal.rentalDetail}
          </span>
        </div>
      </div>

      {/* 집행금액 · 율 */}
      <div className="sm:col-span-3 sm:text-right">
        <p className="text-sm text-navy-700">{fmtWon(deal.executionAmount)}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-navy-400 sm:justify-end">
          <span>율</span>
          <input
            type="text"
            inputMode="decimal"
            defaultValue={deal.overrideRate ?? ""}
            disabled={pending}
            onBlur={(e) => saveRate(e.target.value)}
            placeholder={String(deal.appliedRate)}
            title={deal.overrideRate == null ? "기본율 적용 중 (건별 조정 입력)" : "건별 조정율"}
            className="w-12 rounded border border-navy-200 bg-white px-1.5 py-0.5 text-right text-navy-700 focus:border-brand-400 focus:outline-none disabled:opacity-60"
          />
          <span>%{deal.overrideRate == null ? "(기본)" : ""}</span>
        </p>
      </div>

      {/* 수수료 총액 · 기지급 · 잔여 */}
      <div className="sm:col-span-3 sm:text-right">
        <p className="text-sm font-semibold text-navy-900">{fmtWon(deal.total)}</p>
        <p className="mt-1 text-xs text-navy-500">
          지급 {fmtWon(deal.paid)} · 잔여{" "}
          <span className={remaining > 0 ? "font-semibold text-navy-800" : "text-navy-400"}>
            {fmtWon(remaining)}
          </span>
        </p>
      </div>

      {/* 지급 / 회수 */}
      <div className="sm:col-span-3">
        {deal.total <= 0 ? (
          <span className="inline-block rounded-full bg-navy-100 px-2.5 py-1 text-xs font-medium text-navy-500">
            수수료 미산정
          </span>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${payStyle}`}>
                {payLabel}
              </span>
              {remaining > 0 && (
                <button
                  type="button"
                  onClick={payAll}
                  disabled={pending}
                  className="rounded-lg bg-brand-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
                >
                  전액 선지급
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                disabled={pending}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="금액"
                className="w-24 rounded-lg border border-navy-200 bg-white px-2 py-1.5 text-right text-sm text-navy-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={pay}
                disabled={pending}
                className="rounded-lg border border-brand-300 px-2 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-60"
              >
                지급
              </button>
              <button
                type="button"
                onClick={recover}
                disabled={pending}
                title="지급한 수수료를 회수(차감)"
                className="rounded-lg border border-red-200 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                회수
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
