"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

// ── 폼 파서 ─────────────────────────────────────
const str = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};

async function customerByToken(token: string) {
  const db = createAdminClient();
  const { data } = await db
    .from("customers")
    .select("id")
    .eq("share_token", token)
    .single();
  return data as { id: string } | null;
}

// ── 기본 정보 저장 (영업자) ──────────────────────
export async function savePublicInfo(token: string, formData: FormData) {
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
    .eq("share_token", token);
  if (error) throw new Error(error.message);
  revalidatePath(`/s/${token}`);
}

// ── 서명 업로드 URL 발급 (브라우저 직접 업로드용) ──
// 대용량 파일이 서버(Vercel 4.5MB 본문 제한)를 거치지 않도록,
// 클라이언트가 Supabase Storage로 직접 올릴 수 있는 서명 URL을 발급.
export async function createDocUploadUrl(
  token: string,
  doc_key: string,
  filename: string,
): Promise<{ path: string; token: string } | { error: string }> {
  const customer = await customerByToken(token);
  if (!customer) return { error: "유효하지 않은 링크입니다." };

  const ext = filename.includes(".") ? filename.split(".").pop() : "bin";
  const path = `${customer.id}/${doc_key}-${Date.now()}.${ext}`;

  const db = createAdminClient();
  const { data, error } = await db.storage
    .from("customer-docs")
    .createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message ?? "URL 발급 실패" };

  return { path: data.path, token: data.token };
}

// ── 업로드 완료 후 DB 기록 ───────────────────────
export async function recordDocUpload(
  token: string,
  doc_key: string,
  category: string,
  path: string,
): Promise<{ ok: true } | { error: string }> {
  const customer = await customerByToken(token);
  if (!customer) return { error: "유효하지 않은 링크입니다." };

  const db = createAdminClient();
  const { error } = await db.from("customer_documents").upsert(
    {
      customer_id: customer.id,
      doc_key,
      category,
      checked: true,
      file_path: path,
      uploaded_at: new Date().toISOString(),
    },
    { onConflict: "customer_id,doc_key" },
  );
  if (error) return { error: error.message };

  revalidatePath(`/s/${token}`);
  return { ok: true };
}

// ── 서류 파일 삭제 (영업자) ──────────────────────
export async function deleteDocByToken(
  token: string,
  doc_key: string,
): Promise<{ ok: true } | { error: string }> {
  const customer = await customerByToken(token);
  if (!customer) return { error: "유효하지 않은 링크입니다." };

  const db = createAdminClient();
  const { data: row } = await db
    .from("customer_documents")
    .select("file_path")
    .eq("customer_id", customer.id)
    .eq("doc_key", doc_key)
    .maybeSingle();

  if (row?.file_path) {
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
