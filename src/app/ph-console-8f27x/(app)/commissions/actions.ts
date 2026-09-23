"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adminPath } from "@/lib/admin/config";

function refresh(customerId?: string) {
  revalidatePath(adminPath("commissions"));
  if (customerId) revalidatePath(adminPath(`customers/${customerId}`));
}

// ── 영업자 기본 수수료율(%) 설정 ─ (최상위 영업자에 설정)
export async function updateAgentCommissionRate(
  agentId: string,
  rate: number | null,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const value =
    rate == null || Number.isNaN(rate) ? null : Math.max(0, rate);
  const { error } = await supabase
    .from("sales_agents")
    .update({ commission_rate: value })
    .eq("id", agentId);
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

// ── 건별 수수료율 override(%) 설정 ─ (비우면 기본율 사용)
export async function setDealRate(
  customerId: string,
  rate: number | null,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const value =
    rate == null || Number.isNaN(rate) ? null : Math.max(0, rate);
  const { error } = await supabase
    .from("customers")
    .update({ commission_rate: value })
    .eq("id", customerId);
  if (error) return { error: error.message };
  refresh(customerId);
  return { ok: true };
}

// ── 수수료 지급 기록 (부분 지급 누적) ─
// 총액을 넘겨받아 0~총액 범위로 클램프. amount>0 이면 가산, <0 이면 차감(정정).
export async function recordCommissionPayment(
  customerId: string,
  amount: number,
  total: number,
): Promise<{ ok: true } | { error: string }> {
  if (!Number.isFinite(amount) || amount === 0)
    return { error: "지급 금액을 입력하세요." };

  const supabase = await createClient();
  const { data, error: readErr } = await supabase
    .from("customers")
    .select("commission_paid")
    .eq("id", customerId)
    .single<{ commission_paid: number | null }>();
  if (readErr || !data) return { error: readErr?.message ?? "건 조회 실패" };

  const cap = Math.max(0, Math.round(total));
  const cur = data.commission_paid ?? 0;
  const next = Math.min(cap, Math.max(0, cur + Math.round(amount)));

  const { error } = await supabase
    .from("customers")
    .update({ commission_paid: next })
    .eq("id", customerId);
  if (error) return { error: error.message };
  refresh(customerId);
  return { ok: true };
}
