"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { beginDocumentUpload, finishDocumentUpload, setDocumentRemoved, validShareTokenExpiry } from "@/lib/documents/server";
import type { UploadMetadata, UploadResult, DocumentResult } from "@/lib/documents/types";

// ── 폼 파서 ─────────────────────────────────────
const str = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};

async function customerByToken(token: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("customers")
    .select("*")
    .eq("share_token", token)
    .single();
  return data && validShareTokenExpiry(data.share_token_expires_at) ? data as { id: string } : null;
}

// ── 기본 정보 저장 (영업자) ──────────────────────
export async function savePublicInfo(token: string, formData: FormData) {
  const customer = await customerByToken(token);
  if (!customer) throw new Error("유효하지 않거나 만료된 링크입니다.");
  const db = createAdminClient();

  const patch = {
    hospital_name: str(formData, "hospital_name"),
    representative: str(formData, "representative"),
    phone: str(formData, "phone"),
    email: str(formData, "email"),
    hospital_type: str(formData, "hospital_type"),
    needed_funds: str(formData, "needed_funds"),
  };

  const { error } = await db
    .from("customers")
    .update(patch)
    .eq("id", customer.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/s/${token}`);
}

// Browser bytes go directly to private Storage; finalization verifies size,
// MIME/signature and the exact pending ID. Token access is rechecked each time.
export async function createDocUploadUrl(token: string, docKey: string, filename: string, metadata?: UploadMetadata): Promise<UploadResult> {
  const customer = await customerByToken(token);
  if (!customer) return { error: "유효하지 않거나 만료된 링크입니다." };
  return beginDocumentUpload(createAdminClient(), customer.id, docKey, filename, metadata, "public");
}

export async function recordDocUpload(token: string, docKey: string, category: string, path: string, attachmentId?: string): Promise<DocumentResult> {
  const customer = await customerByToken(token);
  if (!customer) return { error: "유효하지 않거나 만료된 링크입니다." };
  const result = await finishDocumentUpload(createAdminClient(), customer.id, docKey, category, path, attachmentId, "public");
  if ("ok" in result) revalidatePath(`/s/${token}`);
  return result;
}

// ── 기기 단위 등록 (영업자 · 여러 기계를 한 번에) ────
export async function addDevice(
  token: string,
): Promise<{ id: string } | { error: string }> {
  const customer = await customerByToken(token);
  if (!customer) return { error: "유효하지 않은 링크입니다." };
  const db = createAdminClient();
  const { data, error } = await db
    .from("customer_devices")
    .insert({ customer_id: customer.id })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "기기 추가 실패" };
  revalidatePath(`/s/${token}`);
  return { id: data.id };
}

export async function saveDevice(
  token: string,
  device_id: string,
  model_name: string | null,
  quantity: number | null,
): Promise<{ ok: true } | { error: string }> {
  const customer = await customerByToken(token);
  if (!customer) return { error: "유효하지 않은 링크입니다." };
  const db = createAdminClient();
  const { error } = await db
    .from("customer_devices")
    .update({ model_name, quantity })
    .eq("id", device_id)
    .eq("customer_id", customer.id);
  if (error) return { error: error.message };
  revalidatePath(`/s/${token}`);
  return { ok: true };
}

export async function deleteDevice(
  token: string,
  device_id: string,
): Promise<{ ok: true } | { error: string }> {
  const customer = await customerByToken(token);
  if (!customer) return { error: "유효하지 않은 링크입니다." };
  const db = createAdminClient();
  const { data: rows } = await db
    .from("customer_documents")
    .select("file_path")
    .eq("customer_id", customer.id)
    .eq("device_id", device_id);
  const paths = (rows ?? [])
    .map((r) => r.file_path)
    .filter((p): p is string => !!p);
  if (paths.length) {
    await db.storage.from("customer-docs").remove(paths);
  }
  const { error } = await db
    .from("customer_devices")
    .delete()
    .eq("id", device_id)
    .eq("customer_id", customer.id);
  if (error) return { error: error.message };
  revalidatePath(`/s/${token}`);
  return { ok: true };
}

export async function createDevicePhotoUrl(
  token: string,
  device_id: string,
  filename: string,
): Promise<{ path: string; token: string } | { error: string }> {
  const customer = await customerByToken(token);
  if (!customer) return { error: "유효하지 않은 링크입니다." };
  const ext = filename.includes(".") ? filename.split(".").pop() : "bin";
  const path = `${customer.id}/device_photo_${device_id}_${Date.now()}.${ext}`;
  const db = createAdminClient();
  const { data, error } = await db.storage
    .from("customer-docs")
    .createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message ?? "URL 발급 실패" };
  return { path: data.path, token: data.token };
}

export async function recordDevicePhoto(
  token: string,
  device_id: string,
  path: string,
): Promise<{ ok: true } | { error: string }> {
  const customer = await customerByToken(token);
  if (!customer) return { error: "유효하지 않은 링크입니다." };
  const db = createAdminClient();
  if (!/^[0-9a-f-]{36}$/i.test(device_id) || !path.startsWith(`${customer.id}/device_photo_${device_id}_`) || path.split("/").length !== 2) {
    return { error: "이 기기의 사진 업로드 경로가 아닙니다." };
  }
  const doc_key = `device_photo_${device_id}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
  const { error } = await db.from("customer_documents").insert({
    customer_id: customer.id,
    device_id,
    doc_key,
    category: "screening_3",
    checked: true,
    file_path: path,
    uploaded_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };
  revalidatePath(`/s/${token}`);
  return { ok: true };
}

export async function deleteDevicePhoto(
  token: string,
  doc_key: string,
): Promise<{ ok: true } | { error: string }> {
  if (!doc_key.startsWith("device_photo_")) return { error: "기기 사진만 삭제할 수 있습니다." };
  const customer = await customerByToken(token);
  if (!customer) return { error: "유효하지 않은 링크입니다." };
  const db = createAdminClient();
  const { data: row } = await db
    .from("customer_documents")
    .select("file_path")
    .eq("customer_id", customer.id)
    .eq("doc_key", doc_key)
    .not("device_id", "is", null)
    .maybeSingle();
  if (!row) return { error: "기기 사진을 찾을 수 없습니다." };
  if (row.file_path) {
    await db.storage.from("customer-docs").remove([row.file_path]);
  }
  const { error } = await db
    .from("customer_documents")
    .delete()
    .eq("customer_id", customer.id)
    .eq("doc_key", doc_key);
  if (error) return { error: error.message };
  revalidatePath(`/s/${token}`);
  return { ok: true };
}

// Checklist attachment removal is reversible and scoped to one exact ID.
export async function deleteDocByToken(token: string, docKey: string, attachmentId: string): Promise<DocumentResult> {
  const customer = await customerByToken(token);
  if (!customer) return { error: "유효하지 않거나 만료된 링크입니다." };
  const result = await setDocumentRemoved(createAdminClient(), customer.id, docKey, attachmentId, true, "public");
  if ("ok" in result) revalidatePath(`/s/${token}`);
  return result;
}

export async function restoreDocByToken(token: string, docKey: string, attachmentId: string): Promise<DocumentResult> {
  const customer = await customerByToken(token);
  if (!customer) return { error: "유효하지 않거나 만료된 링크입니다." };
  const result = await setDocumentRemoved(createAdminClient(), customer.id, docKey, attachmentId, false, "public");
  if ("ok" in result) revalidatePath(`/s/${token}`);
  return result;
}
