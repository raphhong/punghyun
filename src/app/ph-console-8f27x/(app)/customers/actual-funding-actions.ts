"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminPath } from "@/lib/admin/config";
import { initialFundingReference, matchesInitialFunding, parseActualFunding, type ActualFundingRecord, type ActualFundingState } from "@/lib/admin/actual-funding";

const validId = (id: string) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const blocked = (error: string): ActualFundingState => ({ rows: [], fundingType: null, creditorName: null, error });

async function authorize(id: string) {
  if (!validId(id)) return { error: "고객 식별자를 확인할 수 없습니다." } as const;
  const session = await createClient();
  const claims = await session.auth.getClaims();
  const uid = claims.data?.claims?.sub;
  if (!uid) return { error: "관리자 로그인이 필요합니다." } as const;
  const access = await session.from("admins").select("user_id").eq("user_id", uid).maybeSingle();
  if (access.error || !access.data) return { error: "관리자 권한을 확인할 수 없습니다." } as const;
  const customer = await session.from("customers").select("id").eq("id", id).maybeSingle();
  if (customer.error || !customer.data) return { error: "고객 조회 권한을 확인할 수 없습니다." } as const;
  // Never create/use the privileged client before both checks succeed.
  return { uid, db: createAdminClient() } as const;
}

async function readState(db: ReturnType<typeof createAdminClient>, id: string): Promise<ActualFundingState> {
  const profile = await db.from("cashflow_profiles").select("customer_id,funding_type,creditor_name").eq("customer_id", id).maybeSingle();
  if (profile.error) return blocked("자금구분 원장을 읽지 못했습니다. 기존 스키마와 서버 연결을 확인해 주세요.");
  const rows: ActualFundingRecord[] = [];
  for (let from = 0; ; from += 500) {
    const result = await db.from("cashflow_movements")
      .select("id,customer_id,cash_date,amount,source_reference,note")
      .eq("customer_id", id).eq("kind", "funding_disbursement").eq("basis", "actual")
      .order("id").range(from, from + 499);
    if (result.error || !result.data) return blocked("실제 집행원장을 읽지 못했습니다. 기존 스키마와 서버 연결을 확인해 주세요.");
    rows.push(...result.data as ActualFundingRecord[]);
    if (result.data.length < 500) break;
  }
  return { rows, fundingType: profile.data?.funding_type ?? null, creditorName: profile.data?.creditor_name ?? null };
}

export async function readActualFunding(id: string): Promise<ActualFundingState> {
  try {
    const access = await authorize(id);
    if (access.error !== undefined) return blocked(access.error);
    return await readState(access.db, id);
  } catch { return blocked("실제 집행원장 연결을 확인할 수 없습니다. 기존 서버 설정을 확인해 주세요."); }
}

export async function registerInitialFunding(id: string, value: unknown): Promise<{ ok: true; alreadyRecorded: boolean } | { error: string }> {
  const input = parseActualFunding(value);
  if (!input) return { error: "오늘까지의 실제 집행일, 양의 정수 원 금액, 1~1000자의 근거와 실제 집행 확인을 입력해 주세요." };
  try {
    const access = await authorize(id);
    if (access.error !== undefined) return { error: access.error };
    const { db, uid } = access;
    const before = await readState(db, id);
    if (before.error) return { error: before.error };
    if (before.rows.length) {
      if (before.rows.length === 1 && matchesInitialFunding(before.rows[0], id, input)) return { ok: true, alreadyRecorded: true };
      return { error: "이미 실제 집행 기록이 있습니다. 기존 기록을 대조해 주세요. 추가·분할·잔금 집행은 이 입력에서 등록하지 않습니다." };
    }
    // FK parent only: never overwrite an existing funding type or creditor.
    const profile = await db.from("cashflow_profiles").upsert(
      { customer_id: id, funding_type: null, creditor_name: null },
      { onConflict: "customer_id", ignoreDuplicates: true },
    );
    if (profile.error) return { error: "기존 자금구분 원장을 준비하지 못했습니다. 권한이나 스키마를 변경하지 않았습니다." };
    const saved = await db.from("cashflow_movements").upsert({
      customer_id: id, kind: "funding_disbursement", basis: "actual",
      cash_date: input.cashDate, cash_month: null, amount: input.amount, installment_no: null,
      source_reference: initialFundingReference(id),
      note: JSON.stringify({ type: "admin_initial_funding_v1", evidence: input.evidence, recorded_by: uid }),
    }, { onConflict: "source_reference", ignoreDuplicates: true }).select("id");
    if (saved.error) return { error: "실제 집행 기록을 저장하지 못했습니다. 기존 원장의 고유 등록키·스키마·서버 연결을 확인해 주세요. 자금구분은 변경하지 않았습니다." };
    const after = await readState(db, id);
    if (after.error || after.rows.length !== 1 || !matchesInitialFunding(after.rows[0], id, input))
      return { error: "저장 후 원장 일치를 확인하지 못했습니다. 다시 등록하지 말고 새로고침해 기존 기록을 확인해 주세요." };
    revalidatePath(adminPath(`customers/${id}`));
    revalidatePath(adminPath("cashflow"));
    revalidatePath(adminPath());
    return { ok: true, alreadyRecorded: !saved.data?.length };
  } catch { return { error: "저장 결과를 확인하지 못했습니다. 다시 등록하지 말고 새로고침해 기존 기록을 확인해 주세요." }; }
}
