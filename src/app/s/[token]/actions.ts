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

// ── 서류 파일 업로드 (영업자) ────────────────────
export async function uploadPublicDoc(token: string, formData: FormData) {
  const doc_key = String(formData.get("doc_key"));
  const category = String(formData.get("category"));
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return;

  const customer = await customerByToken(token);
  if (!customer) return;

  const db = createAdminClient();
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const path = `${customer.id}/${doc_key}-${Date.now()}.${ext}`;

  const { error: upErr } = await db.storage
    .from("customer-docs")
    .upload(path, file, { upsert: true });
  if (upErr) throw new Error(upErr.message);

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
  if (error) throw new Error(error.message);
  revalidatePath(`/s/${token}`);
}
