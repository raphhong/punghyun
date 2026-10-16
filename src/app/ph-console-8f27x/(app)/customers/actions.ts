"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminPath } from "@/lib/admin/config";
import { nextStage, prevStage, type StageKey } from "@/lib/admin/pipeline";
import type { CustomerSource } from "@/lib/admin/types";
import { plannedSchedule, validPlannedRows } from "@/lib/admin/payments";

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
  revalidatePath(adminPath("cashflow"));
  if (id) revalidatePath(adminPath(`customers/${id}`));
}

// Store one schedule on the existing contract/customer row. Never append another
// contract or write receipt fields. updated_at prevents overwriting concurrent edits.
export async function savePaymentSchedule(id: string, expectedUpdatedAt: string, input: unknown): Promise<{ ok: true } | { error: string }> {
  if (!validPlannedRows(input) || !input.length || input.some((r, i) => r.no !== i + 1 || r.amount === null))
    return { error: "1회차부터 순서대로 날짜와 원 단위 금액을 입력해 주세요. 중복 회차는 저장할 수 없습니다." };
  if (!expectedUpdatedAt) return { error: "페이지를 새로고침한 뒤 다시 저장해 주세요." };
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const uid = claims.data?.claims?.sub;
  if (!uid) return { error: "관리자 로그인이 필요합니다." };
  const access = await supabase.from("admins").select("user_id").eq("user_id", uid).maybeSingle();
  if (access.error || !access.data) return { error: "관리자 권한을 확인할 수 없습니다." };
  const current = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
  if (current.error || !current.data) return { error: "고객 정보를 읽을 수 없습니다." };
  const c = current.data;
  if (c.updated_at !== expectedUpdatedAt) return { error: "다른 변경이 저장되었습니다. 새로고침 후 확인해 주세요." };
  if (c.rental_months != null && c.rental_months !== input.length) return { error: "총 렌탈 회차와 입력한 일정 수가 다릅니다. 기존 회차를 확인해 주세요." };
  const previous = plannedSchedule(c);
  if (input.length < (c.paid_count ?? 0) || (c.paid_count > 0 && previous.error) || previous.rows.some(r => r.no <= c.paid_count && (input[r.no - 1]?.dueDate !== r.dueDate || input[r.no - 1]?.amount !== r.amount)))
    return { error: "납부 처리된 회차의 예정 내역은 여기서 변경할 수 없습니다." };
  const payment_schedule = input.map(({ no, dueDate, amount }) => ({ no, dueDate, amount }));
  const { data, error } = await supabase.from("customers")
    .update({ payment_schedule, ...(c.rental_months == null ? { rental_months: input.length } : {}) })
    .eq("id", id).eq("updated_at", expectedUpdatedAt).select("id").maybeSingle();
  if (error) return { error: "예정을 저장하지 못했습니다. 일정 컬럼과 기존 DB 권한을 확인해 주세요." };
  if (!data) return { error: "다른 변경이 저장되었습니다. 새로고침 후 확인해 주세요." };
  refresh(id);
  return { ok: true };
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

// ── 서류 파일 업로드 ────────────────────────────
export async function uploadDocument(formData: FormData) {
  const customer_id = String(formData.get("customer_id"));
  const doc_key = String(formData.get("doc_key"));
  const category = String(formData.get("category"));
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) return;

  const supabase = await createClient();
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const path = `${customer_id}/${doc_key}-${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("customer-docs")
    .upload(path, file, { upsert: true });
  if (upErr) throw new Error(upErr.message);

  const { error } = await supabase.from("customer_documents").upsert(
    {
      customer_id,
      doc_key,
      category,
      checked: true,
      file_path: path,
      uploaded_at: new Date().toISOString(),
    },
    { onConflict: "customer_id,doc_key" },
  );
  if (error) throw new Error(error.message);
  refresh(customer_id);
}

// ── 서명 업로드 URL 발급 (관리자 브라우저 직접 업로드) ─
export async function createDocUploadUrl(
  customer_id: string,
  doc_key: string,
  filename: string,
): Promise<{ path: string; token: string } | { error: string }> {
  const supabase = await createClient();
  const ext = filename.includes(".") ? filename.split(".").pop() : "bin";
  const path = `${customer_id}/${doc_key}-${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from("customer-docs")
    .createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message ?? "URL 발급 실패" };

  return { path: data.path, token: data.token };
}

// ── 업로드 완료 후 DB 기록 (관리자) ──────────────
export async function recordDocUpload(
  customer_id: string,
  doc_key: string,
  category: string,
  path: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("customer_documents").upsert(
    {
      customer_id,
      doc_key,
      category,
      checked: true,
      file_path: path,
      uploaded_at: new Date().toISOString(),
    },
    { onConflict: "customer_id,doc_key" },
  );
  if (error) return { error: error.message };

  refresh(customer_id);
  return { ok: true };
}

// ── 서류 파일 삭제 ──────────────────────────────
export async function deleteDocument(formData: FormData) {
  const customer_id = String(formData.get("customer_id"));
  const doc_key = String(formData.get("doc_key"));

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("customer_documents")
    .select("file_path")
    .eq("customer_id", customer_id)
    .eq("doc_key", doc_key)
    .maybeSingle();

  if (row?.file_path) {
    await supabase.storage.from("customer-docs").remove([row.file_path]);
  }

  const { error } = await supabase
    .from("customer_documents")
    .delete()
    .eq("customer_id", customer_id)
    .eq("doc_key", doc_key);
  if (error) throw new Error(error.message);
  refresh(customer_id);
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
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("customer_documents")
    .select("file_path")
    .eq("customer_id", customer_id)
    .eq("doc_key", doc_key)
    .maybeSingle();
  if (row?.file_path) {
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
  const supabase = await createClient();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
  redirect(adminPath("customers"));
}
