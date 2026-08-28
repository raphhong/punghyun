"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
export async function updateBasic(id: string, formData: FormData) {
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
  if (error) throw new Error(error.message);
  refresh(id);
}

// ── 진행 단계 필드 업데이트 (실사·계약·운영·만기·메모) ─
export async function updatePipeline(id: string, formData: FormData) {
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

    payment_1: bool(formData, "payment_1"),
    payment_2: bool(formData, "payment_2"),
    payment_3: bool(formData, "payment_3"),
    unpaid: bool(formData, "unpaid"),

    maturity_result: str(formData, "maturity_result"),
    internal_memo: str(formData, "internal_memo"),
  };

  const { error } = await supabase.from("customers").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  refresh(id);
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

// ── 고객 삭제 ───────────────────────────────────
export async function deleteCustomer(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = await createClient();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
  redirect(adminPath("customers"));
}
