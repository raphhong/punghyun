import type { CustomerDocument } from "@/lib/admin/types";

export type AttachmentView = {
  id: string;
  attachmentId?: string;
  filename: string;
  size?: number | null;
  contentType?: string | null;
  source?: CustomerDocument["source"];
  uploadedAt?: string | null;
  deletedAt?: string | null;
  url?: string;
};

export function documentFilename(row: CustomerDocument): string {
  if (row.original_name) return row.original_name;
  const basename = row.file_path?.split("/").pop();
  if (!basename) return "기존 파일";
  try { return decodeURIComponent(basename); } catch { return basename; }
}

export function documentViews(rows: CustomerDocument[], signedMap: Map<string, string>): AttachmentView[] {
  return rows.filter((row) => !!row.file_path).map((row) => ({
    id: row.attachment_id ?? row.id ?? `legacy:${row.doc_key}`,
    attachmentId: row.attachment_id,
    filename: documentFilename(row),
    size: row.size_bytes,
    contentType: row.content_type,
    source: row.source ?? "legacy",
    uploadedAt: row.uploaded_at ?? row.created_at,
    deletedAt: row.deleted_at,
    url: !row.deleted_at && row.file_path ? signedMap.get(row.file_path) : undefined,
  }));
}

export function groupDocuments(rows: CustomerDocument[]): Map<string, CustomerDocument[]> {
  const groups = new Map<string, CustomerDocument[]>();
  for (const row of rows) groups.set(row.doc_key, [...(groups.get(row.doc_key) ?? []), row]);
  return groups;
}
