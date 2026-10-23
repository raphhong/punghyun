"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adminPath } from "@/lib/admin/config";
import { OTHER_DOCUMENT_PREFIX, validateOtherDocument } from "@/lib/admin/other-documents";
import { otherDocumentPath, otherDocumentFilename, validOtherDocumentPath } from "@/lib/admin/other-document-path";

async function authorizedCustomer(id: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("로그인이 필요합니다.");
  const { data: admin, error: adminError } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (adminError || !admin) throw new Error("관리자 권한을 확인할 수 없습니다.");
  const { data: customer, error } = await supabase.from("customers").select("id").eq("id", id).maybeSingle();
  if (error || !customer) throw new Error("고객 접근 권한을 확인할 수 없습니다.");
  return supabase;
}

export async function createOtherDocumentUpload(id: string, filename: string, size: number, mime: string) {
  const supabase = await authorizedCustomer(id);
  const invalid = validateOtherDocument(filename, size, mime);
  if (invalid) return { error: invalid };
  const key = `${OTHER_DOCUMENT_PREFIX}${randomUUID()}`;
  const path = otherDocumentPath(id, key, filename);
  const { data, error } = await supabase.storage.from("customer-docs").createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message ?? "업로드 URL 발급 실패" };
  return { key, path: data.path, token: data.token };
}

export async function recordOtherDocumentUpload(id: string, key: string, path: string) {
  const supabase = await authorizedCustomer(id);
  if (!validOtherDocumentPath(id, key, path)) return { error: "잘못된 첨부 경로입니다." };
  // Verify the object actually exists; never trust browser-reported size at save time.
  const { data: info, error: infoError } = await supabase.storage.from("customer-docs").info(path);
  if (infoError || !info) return { error: "업로드된 파일을 확인하지 못했습니다. 다시 시도해 주세요." };
  const invalid = validateOtherDocument(otherDocumentFilename(path), info.size ?? 0, info.contentType ?? "");
  if (invalid) return { error: invalid };
  // Stable key makes a save retry idempotent; cannot overwrite a required document.
  const { error } = await supabase.from("customer_documents").upsert({
    customer_id: id, doc_key: key, category: "screening_2_other", checked: false,
    file_path: path, uploaded_at: new Date().toISOString(),
  }, { onConflict: "customer_id,doc_key" });
  if (error) return { error: error.message };
  revalidatePath(adminPath(`customers/${id}`));
  return { ok: true };
}
