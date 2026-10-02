"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminPath } from "@/lib/admin/config";
import { koreaToday } from "@/lib/admin/cashflow";
import { isUuid, validateCashflowRequest, type CashflowResult, type CashflowSaveRequest, type CashflowState } from "@/lib/admin/cashflow-write";

// Never reuse the legacy layout's permissive admins lookup. Both reads and writes
// check the authenticated identity before constructing the privileged client.
async function actor(): Promise<string | null> {
  try {
    const session = await createClient();
    const claims = await session.auth.getClaims();
    const uid = claims.data?.claims?.sub;
    if (claims.error || !isUuid(uid)) return null;
    const membership = await session.from("admins").select("user_id").eq("user_id", uid).maybeSingle();
    return !membership.error && membership.data?.user_id === uid ? uid : null;
  } catch { return null; }
}
function failure(error: { code?: string; message?: string } | null): CashflowResult {
  // Message values are exact allowlisted constants raised by our RPC, never raw SQL.
  const messages: Record<string, string> = {
    CASHFLOW_CONFLICT: "다른 저장으로 기록이 바뀌었습니다. 현재 기록을 다시 불러와 대조한 뒤 저장해 주세요.",
    CASHFLOW_DUPLICATE: "같은 증빙 또는 같은 일자·금액·회차의 거래가 이미 있습니다. 기존 기록을 확인하고 정정해 주세요.",
    CASHFLOW_LEGACY_LEDGER: "기존 수납원장이 있어 이중 기록을 차단했습니다. 기존 수납원장과 먼저 대조해야 합니다.",
    CASHFLOW_REQUEST_REUSED: "이 저장 식별번호로 다른 내용이 이미 처리되었습니다. 현재 기록을 다시 불러와 주세요.",
    CASHFLOW_INVALID: "일자·정수 원 금액·회차·합계·증빙과 수정 사유를 확인해 주세요.",
    CASHFLOW_PROFILE_CONFLICT: "기존 채권사·유동화 거래와 자금 구분이 충돌합니다. 먼저 원장을 대조해 주세요.",
    CASHFLOW_NOT_FOUND: "대상 고객 또는 정정할 거래를 찾을 수 없습니다.",
    CASHFLOW_FORBIDDEN: "원장을 저장할 관리자 권한을 확인할 수 없습니다.",
  };
  const code = error?.message ?? "";
  if (Object.hasOwn(messages, code)) return { error: messages[code], code };
  if (["42883", "PGRST202", "42703", "42P01"].includes(error?.code ?? "")) return { error: "클라우드 원장 저장 기능의 DB 준비가 완료되지 않았습니다. 기존 기록은 변경하지 않았습니다.", code: "NOT_READY" };
  return { error: "저장 결과를 확인하지 못했습니다. 같은 저장 요청으로 재시도하거나 현재 기록을 다시 확인해 주세요.", code: "UNCONFIRMED" };
}
function stateResult(value: unknown): CashflowResult {
  const state = value as CashflowState | null;
  if (!state || typeof state.version !== "string" || !state.snapshot?.customer || !Array.isArray(state.snapshot.movements)) return failure(null);
  return { ok: true, state };
}
function configured() { return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY); }

export async function loadCustomerCashflow(customerId: string): Promise<CashflowResult> {
  const uid = await actor();
  if (!uid) return { error: "원장을 조회할 관리자 권한을 확인할 수 없습니다.", code: "FORBIDDEN" };
  if (!isUuid(customerId)) return { error: "잘못된 고객 식별번호입니다.", code: "INVALID" };
  if (!configured()) return { error: "클라우드 원장 저장을 위한 서버 설정이 준비되지 않았습니다.", code: "NOT_READY" };
  try {
    const result = await createAdminClient().rpc("read_customer_cashflow", { p_actor: uid, p_customer: customerId });
    return result.error ? failure(result.error) : stateResult(result.data);
  } catch { return failure(null); }
}

export async function saveCustomerCashflow(request: CashflowSaveRequest): Promise<CashflowResult> {
  const uid = await actor();
  if (!uid) return { error: "원장을 저장할 관리자 권한을 확인할 수 없습니다.", code: "FORBIDDEN" };
  const invalid = validateCashflowRequest(request, koreaToday());
  if (invalid) return { error: invalid, code: "INVALID" };
  if (!configured()) return { error: "클라우드 원장 저장을 위한 서버 설정이 준비되지 않았습니다.", code: "NOT_READY" };
  try {
    // One PostgreSQL transaction, including conflict/idempotency checks and audit.
    const result = await createAdminClient().rpc("save_customer_cashflow", {
      p_actor: uid, p_customer: request.customerId, p_request: request.requestId,
      p_expected_version: request.expectedVersion, p_change: request.change,
    });
    if (result.error) return failure(result.error);
    const saved = stateResult(result.data);
    if ("error" in saved) return saved;
    for (const path of [adminPath(), adminPath("customers"), adminPath(`customers/${request.customerId}`), adminPath("cashflow")]) revalidatePath(path);
    return saved;
  } catch { return failure(null); }
}
