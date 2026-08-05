"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  assetOptions,
  calculate,
  formatKRW,
  calcConfig,
} from "@/lib/calculator";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

const cardPresets = [
  { label: "3천만원", value: 30_000_000 },
  { label: "6천만원", value: 60_000_000 },
  { label: "1억원", value: 100_000_000 },
  { label: "3억원", value: 300_000_000 },
];

export function Calculator({ className }: { className?: string }) {
  const [cardSales3m, setCardSales3m] = useState<number>(0);
  const [assetValue, setAssetValue] = useState<number>(0);

  const result = useMemo(
    () => calculate({ cardSales3m, assetValue }),
    [cardSales3m, assetValue],
  );

  const ready = cardSales3m > 0 && assetValue > 0;

  return (
    <div
      className={cn(
        "grid gap-6 rounded-3xl border border-navy-100 bg-white p-6 shadow-sm sm:p-8 lg:grid-cols-2 lg:gap-10",
        className,
      )}
    >
      {/* 입력 */}
      <div className="space-y-7">
        <div>
          <label
            htmlFor="cardSales"
            className="block text-sm font-semibold text-navy-900"
          >
            최근 3개월 카드매출 합계
          </label>
          <p className="mt-1 text-xs text-navy-500">
            카드 단말기·PG로 발생한 최근 3개월 매출을 합산해 입력하세요.
          </p>
          <div className="relative mt-3">
            <input
              id="cardSales"
              inputMode="numeric"
              placeholder="예: 90,000,000"
              value={cardSales3m > 0 ? cardSales3m.toLocaleString("ko-KR") : ""}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^0-9]/g, "");
                setCardSales3m(digits ? Number(digits) : 0);
              }}
              className="w-full rounded-xl border border-navy-200 bg-navy-50/40 px-4 py-3 pr-12 text-right text-lg font-semibold text-navy-900 outline-none transition-colors focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-navy-400">
              원
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {cardPresets.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setCardSales3m(p.value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  cardSales3m === p.value
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "border-navy-200 text-navy-600 hover:border-navy-300 hover:bg-navy-50",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {cardSales3m > 0 && (
            <p className="mt-2 text-xs text-navy-500">
              월평균 약{" "}
              <span className="font-semibold text-navy-700">
                {formatKRW(result.monthlyCardAvg)}
              </span>
            </p>
          )}
        </div>

        <div>
          <span className="block text-sm font-semibold text-navy-900">
            보유 자산 규모
          </span>
          <p className="mt-1 text-xs text-navy-500">
            매각 후 계속 사용하실 장비·설비 등 자산의 대략적 규모를 선택하세요.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {assetOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAssetValue(opt.value)}
                className={cn(
                  "rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors",
                  assetValue === opt.value
                    ? "border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-400"
                    : "border-navy-200 text-navy-700 hover:border-navy-300 hover:bg-navy-50",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 결과 */}
      <div className="flex flex-col rounded-2xl bg-gradient-to-br from-navy-800 to-navy-950 p-6 text-white sm:p-8">
        <p className="text-sm font-medium text-brand-200">예상 지급 가능 금액</p>

        {ready ? (
          <>
            <div className="mt-3">
              <p className="text-3xl font-bold tracking-tight sm:text-4xl">
                {formatKRW(result.estimateLow)}
                <span className="mx-1.5 text-navy-400">~</span>
                {formatKRW(result.estimateHigh)}
              </p>
            </div>
            <dl className="mt-6 space-y-3 border-t border-white/10 pt-6 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-navy-300">카드매출 기준 한도</dt>
                <dd className="font-semibold text-white">
                  {formatKRW(result.cardBasedLimit)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-navy-300">자산 기준 한도</dt>
                <dd className="font-semibold text-white">
                  {formatKRW(result.assetBasedLimit)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-navy-300">월 예상 이용료</dt>
                <dd className="font-semibold text-brand-300">
                  {formatKRW(result.monthlyFee)}
                </dd>
              </div>
            </dl>
            <Link
              href="/contact"
              className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand-500 px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
            >
              이 조건으로 상담 신청
              <Icon name="arrow" className="h-4 w-4" />
            </Link>
          </>
        ) : (
          <div className="mt-3 flex flex-1 flex-col justify-center">
            <p className="text-2xl font-bold text-navy-500 sm:text-3xl">
              _ _ _ 원
            </p>
            <p className="mt-3 text-sm text-navy-400">
              카드매출과 보유 자산을 입력하면 예상 금액이 계산됩니다.
            </p>
          </div>
        )}

        <p className="mt-6 text-[11px] leading-relaxed text-navy-400">
          ※ 안전계수 {Math.round(calcConfig.safetyFactor * 100)}% 적용, 두 한도 중
          낮은 값 기준의 참고 예상치입니다. 실제 지급 금액과 조건은 자산 심사·상담을
          통해 결정됩니다.
        </p>
      </div>
    </div>
  );
}
