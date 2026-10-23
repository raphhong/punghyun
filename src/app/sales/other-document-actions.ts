"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminPath } from "@/lib/admin/config";
import { OTHER_DOCUMENT_PREFIX, validateOtherDocument } from "@/lib/admin/other-documents";
import { otherDocumentPath, otherDocumentFilename, validOtherDocumentPath } from "@/lib/admin/other-document-path";

async function authorizedCustomer(id: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("로그인이 필요합니다.");
  const { data: agent, error: agentError } = await supabase.from("sales_agents")
    .select("id,status").eq("user_id", user.id).maybeSingle();
  if (agentError || !agent || agent.status !== "approved") throw new Error("승인된 영업자만 이용할 수 있습니다.");
  // Check both session RLS visibility and direct assignment before using the existing sales write client.
  const { data: customer, error } = await supabase.from("customers")
    .select("id,sales_agent_id").eq("id", id).maybeSingle();
  if (error || !customer || customer.sales_agent_id !== agent.id) throw new Error("본인 담당 고객에게만 첨부할 수 있습니다.");
  return createAdminClient();
}

export async function salesCreateOtherDocumentUpload(id: string, filename: string, size: number, mime: string) {
  const supabase = await authorizedCustomer(id);
  const invalid = validateOtherDocument(filename, size, mime);
  if (invalid) return { error: invalid };
  const key = `${OTHER_DOCUMENT_PREFIX}${randomUUID()}`;
  const path = otherDocumentPath(id, key, filename);
  const { data, error } = await supabase.storage.from("customer-docs").createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message ?? "업로드 URL 발급 실패" };
  return { key, path: data.path, token: data.token };
}

export async function salesRecordOtherDocumentUpload(id: string, key: string, path: string) {
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
  revalidatePath(`/sales/customers/${id}`);
  return { ok: true };
}
