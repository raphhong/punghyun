import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CustomerDocument } from "@/lib/admin/types";
import { ALL_DOCS, PURCHASE_INTENT_DOCS, TRANSACTION_DOCS } from "@/lib/admin/pipeline";
import { documentFileType, MAX_DOCUMENT_BYTES, type UploadMetadata, type UploadResult, type DocumentResult, type UploadSource } from "./types";

const TABLE = "customer_document_attachments";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SETUP_ERROR = "여러 파일 업로드 준비가 필요합니다. 기존 파일은 그대로 보관됩니다. 관리자에게 문의해 주세요.";
type Attachment = {
  id: string; customer_id: string; doc_key: string; category: string;
  file_path: string; original_name: string; size_bytes: number | null;
  content_type: string | null; source: UploadSource; state: "pending" | "ready";
  created_at: string; updated_at: string; uploaded_at: string | null; deleted_at: string | null;
};

function missingTable(error: { code?: string } | null) {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

export function validShareTokenExpiry(expiresAt: unknown, now = Date.now()) {
  if (expiresAt == null) return true; // Preserve existing non-expiring links.
  return typeof expiresAt === "string" && Number.isFinite(Date.parse(expiresAt)) && Date.parse(expiresAt) > now;
}

export function documentDefinition(docKey: string, source: UploadSource) {
  const allowed = source === "admin" ? [...ALL_DOCS, ...PURCHASE_INTENT_DOCS, ...TRANSACTION_DOCS] : ALL_DOCS;
  return allowed.find((doc) => doc.key === docKey);
}

async function allDocumentRows(db: SupabaseClient, table: string, customerId: string) {
  const rows: Record<string, unknown>[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const result = await db.from(table).select("*").eq("customer_id", customerId).order("id", { ascending: true }).range(offset, offset + pageSize - 1);
    if (result.error) return { data: [], error: result.error };
    rows.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < pageSize) return { data: rows, error: null };
  }
}

// Expand-only rollout: legacy rows/paths are never overwritten. Tombstones in
// the new table suppress a matching legacy file, including after app rollback.
// Missing table is the only safe read fallback; other DB errors stay visible.
export async function listCustomerDocuments(db: SupabaseClient, customerId: string): Promise<CustomerDocument[]> {
  const [legacyResult, attachmentsResult] = await Promise.all([
    allDocumentRows(db, "customer_documents", customerId),
    allDocumentRows(db, TABLE, customerId),
  ]);
  if (legacyResult.error) throw new Error("기존 서류를 불러오지 못했습니다.");
  if (attachmentsResult.error && !missingTable(attachmentsResult.error)) throw new Error("첨부 목록을 불러오지 못했습니다.");
  const legacy = (legacyResult.data ?? []) as CustomerDocument[];
  const attachments = (attachmentsResult.data ?? []) as Attachment[];
  attachments.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  const represented = new Set(attachments.map((row) => `${row.doc_key}\0${row.file_path}`));
  const checklist = new Map(legacy.map((row) => [row.doc_key, row]));
  return [
    ...legacy.filter((row) => !row.file_path || !represented.has(`${row.doc_key}\0${row.file_path}`)),
    ...attachments.filter((row) => row.state === "ready").map((row): CustomerDocument => ({
      ...row, attachment_id: row.id, checked: checklist.get(row.doc_key)?.checked ?? false, device_id: null,
    })),
  ];
}

export async function beginDocumentUpload(
  db: SupabaseClient, customerId: string, docKey: string, filename: string,
  metadata: UploadMetadata | undefined, source: Exclude<UploadSource, "legacy">,
): Promise<UploadResult> {
  const doc = documentDefinition(docKey, source);
  if (!doc || !UUID.test(customerId) || !metadata || !UUID.test(metadata.id)) return { error: "업로드 요청을 확인해 주세요." };
  const file = documentFileType(filename, metadata.size, metadata.type);
  if ("error" in file) return { error: file.error };
  const path = `${customerId}/attachments/${metadata.id}.${file.extension}`;
  // Ignore only a duplicate ID, then compare every bound property before signing.
  const { error } = await db.from(TABLE).upsert({
    id: metadata.id, customer_id: customerId, doc_key: docKey, category: doc.category,
    file_path: path, original_name: filename, size_bytes: metadata.size,
    content_type: file.contentType, source, state: "pending",
  }, { onConflict: "id", ignoreDuplicates: true });
  if (error) return { error: missingTable(error) ? SETUP_ERROR : "업로드 준비를 저장하지 못했습니다. 다시 시도해 주세요." };
  const { data: row, error: readError } = await db.from(TABLE).select("*").eq("id", metadata.id).eq("customer_id", customerId).eq("doc_key", docKey).maybeSingle<Attachment>();
  if (readError || !row || row.file_path !== path || row.original_name !== filename || row.size_bytes !== metadata.size || row.content_type !== file.contentType || row.source !== source || row.deleted_at) {
    return { error: "이미 사용 중인 업로드 번호입니다. 파일을 다시 선택해 주세요." };
  }
  const signed = await db.storage.from("customer-docs").createSignedUploadUrl(path, { upsert: false });
  if (signed.error || !signed.data) return { error: "업로드 주소를 만들지 못했습니다. 다시 시도해 주세요." };
  return { id: row.id, path: signed.data.path, token: signed.data.token };
}

export function validDocumentSignature(extension: string, bytes: Uint8Array) {
  const prefix = Buffer.from(bytes.subarray(0, 16));
  const ascii = prefix.toString("ascii");
  const hex = prefix.toString("hex");
  if (extension === "pdf") return ascii.startsWith("%PDF-");
  if (["jpg", "jpeg"].includes(extension)) return hex.startsWith("ffd8ff");
  if (extension === "png") return hex.startsWith("89504e470d0a1a0a");
  if (extension === "gif") return ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a");
  if (extension === "webp") return ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP";
  if (["heic", "heif"].includes(extension)) return ascii.slice(4, 8) === "ftyp" && /^(heic|heix|hevc|hevx|mif1|msf1)/.test(ascii.slice(8));
  if (["doc", "xls", "hwp"].includes(extension)) return hex.startsWith("d0cf11e0a1b11ae1");
  if (["zip", "docx", "xlsx", "hwpx"].includes(extension)) return hex.startsWith("504b0304") || (extension === "zip" && hex.startsWith("504b0506"));
  if (["txt", "csv"].includes(extension)) return !bytes.includes(0);
  return false;
}

export async function finishDocumentUpload(
  db: SupabaseClient, customerId: string, docKey: string, category: string, path: string,
  attachmentId: string | undefined, source: Exclude<UploadSource, "legacy">,
): Promise<DocumentResult> {
  const doc = documentDefinition(docKey, source);
  if (!doc || doc.category !== category || !attachmentId || !UUID.test(attachmentId)) return { error: "업로드 요청을 확인해 주세요." };
  const { data: row, error } = await db.from(TABLE).select("*").eq("customer_id", customerId).eq("doc_key", docKey).eq("id", attachmentId).maybeSingle<Attachment>();
  if (error || !row || row.file_path !== path || row.source !== source || row.deleted_at) return { error: "이 고객의 업로드 요청을 찾을 수 없습니다." };
  if (row.state === "ready") return { ok: true }; // A lost response must not append twice.
  const bucket = db.storage.from("customer-docs");
  const { data: info, error: infoError } = await bucket.info(row.file_path);
  if (infoError || !info) return { error: "파일 전송을 확인하지 못했습니다. 같은 파일에서 재시도해 주세요." };
  const actualSize = info.size ?? info.metadata?.size;
  const actualType = info.contentType ?? info.metadata?.mimetype;
  if (typeof actualSize !== "number" || actualSize !== row.size_bytes || actualSize <= 0 || actualSize > MAX_DOCUMENT_BYTES || typeof actualType !== "string") {
    return { error: "서버의 파일 크기 또는 형식이 요청과 다릅니다. 파일을 다시 선택해 주세요." };
  }
  const verifiedType = documentFileType(row.original_name, actualSize, actualType);
  if ("error" in verifiedType) return { error: verifiedType.error };
  const { data: blob, error: downloadError } = await bucket.download(row.file_path);
  if (downloadError || !blob) return { error: "파일 검증에 실패했습니다. 재시도해 주세요." };
  if (blob.size !== actualSize) return { error: "파일 크기가 달라 저장을 중단했습니다." };
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (!validDocumentSignature(verifiedType.extension, bytes)) return { error: "파일 내용과 확장자가 다릅니다. 올바른 파일을 다시 선택해 주세요." };
  const now = new Date().toISOString();
  const { data: saved, error: writeError } = await db.from(TABLE).update({
    state: "ready", uploaded_at: now, updated_at: now,
    size_bytes: actualSize, content_type: verifiedType.contentType,
    storage_etag: info.etag ?? null, storage_version: info.version ?? null,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  }).eq("id", row.id).eq("customer_id", customerId).eq("doc_key", docKey).eq("state", "pending").is("deleted_at", null).select("id");
  if (writeError) return { error: "전송된 파일은 보관 중입니다. 기록만 다시 시도해 주세요." };
  if (!saved?.length) {
    const { data: ready } = await db.from(TABLE).select("id").eq("id", row.id).eq("customer_id", customerId).eq("state", "ready").is("deleted_at", null).maybeSingle();
    if (!ready) return { error: "파일 상태가 변경되었습니다. 목록을 새로고침해 주세요." };
  }
  return { ok: true };
}

// No Storage.remove and no legacy mutation: exact attachment only, reversible.
export async function setDocumentRemoved(
  db: SupabaseClient, customerId: string, docKey: string, attachmentId: string,
  removed: boolean, source: Exclude<UploadSource, "legacy">,
): Promise<DocumentResult> {
  if (!documentDefinition(docKey, source) || !UUID.test(attachmentId)) return { error: "정확한 파일을 선택해 주세요." };
  const { data, error } = await db.from(TABLE).update({ deleted_at: removed ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq("id", attachmentId).eq("customer_id", customerId).eq("doc_key", docKey).eq("state", "ready").select("id");
  if (error || !data?.length) return { error: "파일 상태를 변경하지 못했습니다. 목록을 새로고침해 주세요." };
  return { ok: true };
}

// A retained attachment (including pending/removed) blocks customer deletion.
// Check BEFORE a legacy flow cleans Storage; the FK alone is too late.
export async function assertNoRetainedAttachments(db: SupabaseClient, customerId: string) {
  const { data, error } = await db.from(TABLE).select("id").eq("customer_id", customerId).limit(1);
  if (error && !missingTable(error)) throw new Error("첨부 보존 상태를 확인하지 못해 고객 삭제를 중단했습니다.");
  if (data?.length) throw new Error("보존 중인 첨부가 있어 고객을 삭제할 수 없습니다. 관리자에게 문의해 주세요.");
}
