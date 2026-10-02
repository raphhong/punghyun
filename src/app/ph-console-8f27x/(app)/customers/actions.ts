"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { beginDocumentUpload, finishDocumentUpload, setDocumentRemoved, assertNoRetainedAttachments } from "@/lib/documents/server";
import type { UploadMetadata, UploadResult, DocumentResult } from "@/lib/documents/types";
import { adminPath } from "@/lib/admin/config";
import { nextStage, prevStage, type StageKey } from "@/lib/admin/pipeline";
import type { CustomerSource } from "@/lib/admin/types";

// ── 폼 파서 헬퍼 ────────────────────────────────
const str = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};
const num = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").replace(/[,\s]/g, "");
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const bool = (fd: FormData, k: string) => fd.get(k) != null;

function refresh(id?: string) {
  revalidatePath(adminPath("customers"));
  revalidatePath(adminPath());
  if (id) revalidatePath(adminPath(`customers/${id}`));
}

// ── 신규 고객 추가 (인입 단계) ───────────────────
export async function createCustomer(formData: FormData) {
  const supabase = await createClient();

  const payload = {
    source: "manual" as CustomerSource,
    stage: "intake" as StageKey,
    representative: str(formData, "representative"),
    phone: str(formData, "phone"),
    email: str(formData, "email"),
    hospital_name: str(formData, "hospital_name"),
    hospital_type: str(formData, "hospital_type"),
    needed_funds: str(formData, "needed_funds"),
    intake_date: str(formData, "intake_date"),
    internal_memo: str(formData, "internal_memo"),
  };

  const { data, error } = await supabase
    .from("customers")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  refresh(data.id);
  redirect(adminPath(`customers/${data.id}`));
}

// ── 기본 정보 업데이트 ───────────────────────────
export async function updateBasic(
  id: string,
  formData: FormData,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();

  const patch = {
    representative: str(formData, "representative"),
    phone: str(formData, "phone"),
    email: str(formData, "email"),
    hospital_name: str(formData, "hospital_name"),
    hospital_type: str(formData, "hospital_type"),
    needed_funds: str(formData, "needed_funds"),

    intake_date: str(formData, "intake_date"),
    contract_date: str(formData, "contract_date"),
    maturity_date: str(formData, "maturity_date"),
  };

  const { error } = await supabase.from("customers").update(patch).eq("id", id);
  if (error) return { error: error.message };
  refresh(id);
  return { ok: true };
}

// ── 진행 단계 필드 업데이트 (실사·계약·운영·만기·메모) ─
export async function updatePipeline(
  id: string,
  formData: FormData,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();

  const patch = {
    inspection_date: str(formData, "inspection_date"),
    execution_amount: num(formData, "execution_amount"),
    rental_price: num(formData, "rental_price"),
    internal_review_done: bool(formData, "internal_review_done"),

    contract_sent: bool(formData, "contract_sent"),
    contract_done: bool(formData, "contract_done"),

    funding_scheduled_date: str(formData, "funding_scheduled_date"),
    funding_done: bool(formData, "funding_done"),
    funding_done_date: str(formData, "funding_done_date"),

    // 회차별 렌탈료 입금 스케줄 (완납 판정 = paid_count >= rental_months)
    first_payment_date: str(formData, "first_payment_date"),
    rental_months: num(formData, "rental_months"),

    maturity_result: str(formData, "maturity_result"),
    acquisition_price: num(formData, "acquisition_price"),
    non_recourse_confirmed: bool(formData, "non_recourse_confirmed"),
    sale_proceeds: num(formData, "sale_proceeds"),
    sale_date: str(formData, "sale_date"),
    internal_memo: str(formData, "internal_memo"),
  };

  const { error } = await supabase.from("customers").update(patch).eq("id", id);
  if (error) return { error: error.message };
  refresh(id);
  return { ok: true };
}

// ── 렌탈료 완납 회차 설정 (회차 목록 클릭 → 순차 완납/되돌리기) ─
export async function setPaidCount(
  id: string,
  count: number,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const c = Math.max(0, Math.floor(count));
  const { error } = await supabase
    .from("customers")
    .update({ paid_count: c })
    .eq("id", id);
  if (error) return { error: error.message };
  refresh(id);
  return { ok: true };
}

// ── 특정 단계로 직접 이동 (stepper 클라이언트 호출용) ─
export async function changeStage(
  id: string,
  stage: StageKey,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ stage })
    .eq("id", id);
  if (error) return { error: error.message };
  refresh(id);
  return { ok: true };
}

// ── 단계 이동 ───────────────────────────────────
export async function moveStage(formData: FormData) {
  const id = String(formData.get("id"));
  const direction = String(formData.get("direction"));
  const current = String(formData.get("current")) as StageKey;
  const source = String(formData.get("source")) as CustomerSource;

  const target =
    direction === "next" ? nextStage(current, source) : prevStage(current);
  if (!target) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ stage: target })
    .eq("id", id);
  if (error) throw new Error(error.message);
  refresh(id);
}

// ── 특정 단계로 직접 이동 ────────────────────────
export async function setStage(formData: FormData) {
  const id = String(formData.get("id"));
  const stage = String(formData.get("stage")) as StageKey;

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ stage })
    .eq("id", id);
  if (error) throw new Error(error.message);
  refresh(id);
}

// ── 서류 체크 토글 ──────────────────────────────
export async function toggleDocument(formData: FormData) {
  const customer_id = String(formData.get("customer_id"));
  const doc_key = String(formData.get("doc_key"));
  const category = String(formData.get("category"));
  const checked = formData.get("checked") != null;

  const supabase = await createClient();
  const { error } = await supabase.from("customer_documents").upsert(
    { customer_id, doc_key, category, checked },
    { onConflict: "customer_id,doc_key" },
  );
  if (error) throw new Error(error.message);
  refresh(customer_id);
}

// Every Server Action is an independently callable endpoint. Layout guards do
// not authorize signed URLs or service-role writes.
async function adminDocumentClient(customerId: string) {
  const session = await createClient();
  const { data: claimsData, error: authError } = await session.auth.getClaims();
  const uid = claimsData?.claims?.sub;
  if (authError || typeof uid !== "string") throw new Error("관리자 로그인이 필요합니다.");
  const { data: admin, error: adminError } = await session.from("admins").select("user_id").eq("user_id", uid).maybeSingle();
  if (adminError || !admin) throw new Error("관리자 권한이 필요합니다.");
  const { data: customer, error } = await session.from("customers").select("id").eq("id", customerId).maybeSingle();
  if (error || !customer) throw new Error("권한이 없거나 존재하지 않는 고객입니다.");
  return createAdminClient();
}

export async function createDocUploadUrl(customerId: string, docKey: string, filename: string, metadata?: UploadMetadata): Promise<UploadResult> {
  try {
    return await beginDocumentUpload(await adminDocumentClient(customerId), customerId, docKey, filename, metadata, "admin");
  } catch (e) { return { error: e instanceof Error ? e.message : "권한 오류" }; }
}

export async function recordDocUpload(customerId: string, docKey: string, category: string, path: string, attachmentId?: string): Promise<DocumentResult> {
  try {
    const result = await finishDocumentUpload(await adminDocumentClient(customerId), customerId, docKey, category, path, attachmentId, "admin");
    if ("ok" in result) refresh(customerId);
    return result;
  } catch (e) { return { error: e instanceof Error ? e.message : "권한 오류" }; }
}

export async function deleteDocument(formData: FormData) {
  const customerId = String(formData.get("customer_id") ?? "");
  const result = await setDocumentRemoved(await adminDocumentClient(customerId), customerId,
    String(formData.get("doc_key") ?? ""), String(formData.get("attachment_id") ?? ""), true, "admin");
  if ("error" in result) throw new Error(result.error);
  refresh(customerId);
}

export async function restoreDocument(formData: FormData) {
  const customerId = String(formData.get("customer_id") ?? "");
  const result = await setDocumentRemoved(await adminDocumentClient(customerId), customerId,
    String(formData.get("doc_key") ?? ""), String(formData.get("attachment_id") ?? ""), false, "admin");
  if ("error" in result) throw new Error(result.error);
  refresh(customerId);
}

// ── 기기 단위 등록 (여러 기계를 한 번에) ──────────
export async function addDevice(
  customer_id: string,
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_devices")
    .insert({ customer_id })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "기기 추가 실패" };
  refresh(customer_id);
  return { id: data.id };
}

export async function saveDevice(
  customer_id: string,
  device_id: string,
  model_name: string | null,
  quantity: number | null,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("customer_devices")
    .update({ model_name, quantity })
    .eq("id", device_id)
    .eq("customer_id", customer_id);
  if (error) return { error: error.message };
  refresh(customer_id);
  return { ok: true };
}

export async function deleteDevice(
  customer_id: string,
  device_id: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  // 연결된 사진 스토리지 파일 정리
  const { data: rows } = await supabase
    .from("customer_documents")
    .select("file_path")
    .eq("customer_id", customer_id)
    .eq("device_id", device_id);
  const paths = (rows ?? [])
    .map((r) => r.file_path)
    .filter((p): p is string => !!p);
  if (paths.length) {
    await supabase.storage.from("customer-docs").remove(paths);
  }
  // 기기 삭제 → customer_documents.device_id ON DELETE CASCADE로 사진 행 제거
  const { error } = await supabase
    .from("customer_devices")
    .delete()
    .eq("id", device_id)
    .eq("customer_id", customer_id);
  if (error) return { error: error.message };
  refresh(customer_id);
  return { ok: true };
}

export async function createDevicePhotoUrl(
  customer_id: string,
  device_id: string,
  filename: string,
): Promise<{ path: string; token: string } | { error: string }> {
  const supabase = await createClient();
  const ext = filename.includes(".") ? filename.split(".").pop() : "bin";
  const path = `${customer_id}/device_photo_${device_id}_${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage
    .from("customer-docs")
    .createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message ?? "URL 발급 실패" };
  return { path: data.path, token: data.token };
}

export async function recordDevicePhoto(
  customer_id: string,
  device_id: string,
  path: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  if (!/^[0-9a-f-]{36}$/i.test(device_id) || !path.startsWith(`${customer_id}/device_photo_${device_id}_`) || path.split("/").length !== 2) {
    return { error: "이 기기의 사진 업로드 경로가 아닙니다." };
  }
  const doc_key = `device_photo_${device_id}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
  const { error } = await supabase.from("customer_documents").insert({
    customer_id,
    device_id,
    doc_key,
    category: "screening_3",
    checked: true,
    file_path: path,
    uploaded_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };
  refresh(customer_id);
  return { ok: true };
}

export async function deleteDevicePhoto(
  customer_id: string,
  doc_key: string,
): Promise<{ ok: true } | { error: string }> {
  if (!doc_key.startsWith("device_photo_")) return { error: "기기 사진만 삭제할 수 있습니다." };
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("customer_documents")
    .select("file_path")
    .eq("customer_id", customer_id)
    .eq("doc_key", doc_key)
    .not("device_id", "is", null)
    .maybeSingle();
  if (!row) return { error: "기기 사진을 찾을 수 없습니다." };
  if (row.file_path) {
    await supabase.storage.from("customer-docs").remove([row.file_path]);
  }
  const { error } = await supabase
    .from("customer_documents")
    .delete()
    .eq("customer_id", customer_id)
    .eq("doc_key", doc_key);
  if (error) return { error: error.message };
  refresh(customer_id);
  return { ok: true };
}

// ── 고객 삭제 ───────────────────────────────────
export async function deleteCustomer(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = await adminDocumentClient(id);
  await assertNoRetainedAttachments(supabase, id);
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
  redirect(adminPath("customers"));
}
