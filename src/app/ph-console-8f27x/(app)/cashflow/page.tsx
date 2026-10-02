import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CashflowDashboard } from "@/components/admin/CashflowDashboard";
import { cashflowSourceFailure } from "@/lib/admin/cashflow-source";
import { cashflowPeriod, CASHFLOW_START_MONTH } from "@/lib/admin/cashflow-period";
import { koreaToday, projectCashflow, validMonth, type CashCustomer, type FundingProfile, type Movement } from "@/lib/admin/cashflow";

export default async function CashflowPage({ searchParams }: { searchParams: Promise<{ month?: string | string[]; basis?: string; range?: string; from?: string; to?: string }> }) {
  const params = await searchParams;
  const today = koreaToday();
  const requestedMonth = validMonth(params.month) ? params.month : today.slice(0, 7);
  const month = requestedMonth < CASHFLOW_START_MONTH ? CASHFLOW_START_MONTH : requestedMonth;
  const period = cashflowPeriod(month, params.range, params.from, params.to);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (!uid) redirect("/ph-console-8f27x/login");
  const admin = await supabase.from("admins").select("user_id").eq("user_id", uid).maybeSingle();
  // Fail closed here even though the legacy layout permits a missing admins table.
  if (admin.error || !admin.data) return <p role="alert">현금흐름을 조회할 관리자 권한을 확인할 수 없습니다.</p>;

  // Range pagination avoids silently truncating the portfolio at PostgREST's row limit.
  async function readAll<T>(table: string): Promise<{ rows: T[]; failed: boolean; diagnostic?: string }> {
    const result: T[] = [];
    try {
      for (let from = 0; ; from += 500) {
        const res = await supabase.from(table).select("*").order(table === "cashflow_profiles" ? "customer_id" : "id").range(from, from + 499);
        if (res.error || !res.data) return { rows: [], failed: true, diagnostic: cashflowSourceFailure(table, res.error) };
        result.push(...res.data as T[]);
        if (res.data.length < 500) return { rows: result, failed: false };
      }
    } catch {
      return { rows: [], failed: true, diagnostic: cashflowSourceFailure(table, null) };
    }
  }
  const [customers, profiles, movements] = await Promise.all([readAll<CashCustomer>("customers"), readAll<FundingProfile>("cashflow_profiles"), readAll<Movement>("cashflow_movements")]);
  if (customers.failed) return <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-6">{customers.diagnostic} 금액을 표시할 수 없습니다.</div>;
  const warnings: string[] = [];
  if (requestedMonth < CASHFLOW_START_MONTH) warnings.push("현금흐름은 2026년 9월부터 조회할 수 있습니다.");
  if (period.warning) warnings.push(period.warning);
  if (params.month !== undefined && !validMonth(params.month)) warnings.push("조회 월 형식이 잘못되어 현재 한국 기준 월로 표시합니다.");
  if (profiles.diagnostic) warnings.push(profiles.diagnostic);
  else if (!profiles.rows.length) warnings.push("자금구분 원장: 조회 가능한 기록이 없습니다. 자체자금·유동화 구분은 미입력 또는 조회 범위 확인이 필요합니다.");
  if (movements.diagnostic) warnings.push(movements.diagnostic);
  else if (!movements.rows.length) warnings.push("지급·유동화 원장: 조회 가능한 거래가 없습니다. 거래 없음·지급 완료·0원으로 확정하지 않습니다.");
  if (!movements.rows.some(m => m.kind === "rental_receipt") && customers.rows.length && customers.rows.every(c => !("receipt_ledger" in c))) warnings.push("실제 렌탈 수납: 날짜 있는 수납 기록이 없습니다 (기존 receipt_ledger 또는 현금 원장의 수납 연결 필요). 기존 paid_count는 입금일·실제 수납액을 제공하지 않습니다. 날짜 있는 수납원장 연동이 필요합니다.");
  else if (customers.rows.some(c => c.receipt_ledger == null && !movements.rows.some(m => m.customer_id === c.id && m.kind === "rental_receipt"))) warnings.push("실제 렌탈 수납: 수납원장이 미입력된 고객이 있습니다. 완납 회차를 실제 수납으로 추정하지 않습니다.");
  const report = projectCashflow(customers.rows, profiles.rows, movements.rows, month, today);
  if (report.actualNet.missing || report.plannedNet.missing) warnings.push("현재는 확인된 기록의 부분 집계입니다. 전체 월 순현금흐름은 확정할 수 없습니다. 기존 고객 원장의 렌탈 예정·집행 기록과 미준비 원장을 구분해서 확인하세요.");
  const chartMonths = period.months.map(m => ({ month: m, ...projectCashflow(customers.rows, profiles.rows, movements.rows, m, today) }));
  return <CashflowDashboard report={report} month={month} today={today} warnings={warnings} chartMonths={chartMonths} period={period} basis={params.basis === "actual" ? "actual" : "planned"} />;
}
