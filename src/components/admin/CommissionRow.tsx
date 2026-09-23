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

export type CommissionDeal = {
  customerId: string;
  hospitalName: string;
  href: string;
  executionAmount: number | null;
  overrideRate: number | null; // 건별 override (null = 기본율 사용)
  appliedRate: number; // 실제 적용율(%)
  total: number;
  paid: number;
  fullyPaid: boolean;
  rentalMonths: number | null;
  paidCount: number;
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
  const payableNow = deal.fullyPaid ? remaining : 0;

  function record() {
    const n = Number(amount.replace(/[,\s]/g, ""));
    if (!Number.isFinite(n) || n <= 0) {
      alert("지급 금액을 입력하세요.");
      return;
    }
    startTransition(async () => {
      const res = await recordAction(deal.customerId, n, deal.total);
      if ("error" in res) {
        alert(res.error);
        return;
      }
      setAmount("");
      router.refresh();
    });
  }

  function payAll() {
    if (payableNow <= 0) return;
    startTransition(async () => {
      const res = await recordAction(deal.customerId, payableNow, deal.total);
      if ("error" in res) {
        alert(res.error);
        return;
      }
      router.refresh();
    });
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

  return (
    <div className="grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-12 sm:items-center">
      {/* 상호 + 완납 상태 */}
      <div className="sm:col-span-3">
        <Link
          href={deal.href}
          className="text-sm font-medium text-navy-900 hover:text-brand-600 hover:underline"
        >
          {deal.hospitalName}
        </Link>
        <div className="mt-1">
          {deal.fullyPaid ? (
            <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
              렌탈료 완납
            </span>
          ) : deal.rentalMonths ? (
            <span className="rounded-full bg-navy-100 px-2 py-0.5 text-[11px] font-medium text-navy-500">
              렌탈 진행중 {deal.paidCount}/{deal.rentalMonths}
            </span>
          ) : (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              회차 미설정
            </span>
          )}
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

      {/* 지급 기록 */}
      <div className="sm:col-span-3">
        {deal.total <= 0 ? (
          <span className="inline-block rounded-full bg-navy-100 px-2.5 py-1 text-xs font-medium text-navy-500">
            수수료 미산정
          </span>
        ) : remaining <= 0 ? (
          <span className="inline-block rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
            지급 완료
          </span>
        ) : !deal.fullyPaid ? (
          <span className="inline-block rounded-full bg-navy-100 px-2.5 py-1 text-xs font-medium text-navy-500">
            지급 대기 (완납 전)
          </span>
        ) : (
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
              onClick={record}
              disabled={pending}
              className="rounded-lg bg-brand-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
            >
              기록
            </button>
            <button
              type="button"
              onClick={payAll}
              disabled={pending}
              title="잔여 전액 지급 처리"
              className="rounded-lg border border-navy-200 px-2 py-1.5 text-xs font-medium text-navy-600 hover:bg-navy-50 disabled:opacity-60"
            >
              전액
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
