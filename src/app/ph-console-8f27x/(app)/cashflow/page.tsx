import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CashflowDashboard } from "@/components/admin/CashflowDashboard";
import { koreaToday, projectCashflow, validMonth, type CashCustomer, type FundingProfile, type Movement } from "@/lib/admin/cashflow";

export default async function CashflowPage({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> }) {
  const params = await searchParams;
  const today = koreaToday();
  const month = validMonth(params.month) ? params.month : today.slice(0, 7);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (!uid) redirect("/ph-console-8f27x/login");
  const admin = await supabase.from("admins").select("user_id").eq("user_id", uid).maybeSingle();
  // Fail closed here even though the legacy layout permits a missing admins table.
  if (admin.error || !admin.data) return <p role="alert">현금흐름을 조회할 관리자 권한을 확인할 수 없습니다.</p>;

  // Range pagination avoids silently truncating the portfolio at PostgREST's row limit.
  async function readAll<T>(table: string): Promise<{ rows: T[]; failed: boolean }> {
    const result: T[] = [];
    for (let from = 0; ; from += 500) {
      const res = await supabase.from(table).select("*").order(table === "cashflow_profiles" ? "customer_id" : "id").range(from, from + 499);
      if (res.error || !res.data) return { rows: [], failed: true };
      result.push(...res.data as T[]);
      if (res.data.length < 500) return { rows: result, failed: false };
    }
  }
  const [customers, profiles, movements] = await Promise.all([readAll<CashCustomer>("customers"), readAll<FundingProfile>("cashflow_profiles"), readAll<Movement>("cashflow_movements")]);
  if (customers.failed) return <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-6">고객 데이터를 불러오지 못했습니다. 금액을 표시할 수 없습니다. 잠시 후 새로고침해 주세요.</div>;
  const warnings: string[] = [];
  if (params.month !== undefined && !validMonth(params.month)) warnings.push("조회 월 형식이 잘못되어 현재 한국 기준 월로 표시합니다.");
  if (profiles.failed || movements.failed) warnings.push("자금구분 또는 현금흐름 원장을 조회할 수 없습니다. 모델 미적용·권한·연결 상태를 확인하세요. 해당 금액은 미확인으로 표시합니다.");
  const report = projectCashflow(customers.rows, profiles.rows, movements.rows, month, today);
  return <CashflowDashboard report={report} month={month} today={today} warnings={warnings} />;
}
