// Optional internal attachments: deliberately excluded from pipeline required docs.
export const OTHER_DOCUMENT_PREFIX = "other_document_";
export const OTHER_DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;
export const OTHER_DOCUMENT_TYPES: Record<string, string[]> = {
  pdf: ["application/pdf"],
  jpg: ["image/jpeg"], jpeg: ["image/jpeg"], png: ["image/png"],
  gif: ["image/gif"], webp: ["image/webp"], bmp: ["image/bmp", "image/x-ms-bmp"],
  heic: ["image/heic"], heif: ["image/heif"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  zip: ["application/zip", "application/x-zip-compressed"],
};
export const OTHER_DOCUMENT_ACCEPT = Object.keys(OTHER_DOCUMENT_TYPES).map(ext => `.${ext}`).join(",");
export const OTHER_DOCUMENT_HINT = "PDF, 이미지(JPG·PNG·GIF·WebP·BMP·HEIC·HEIF), Word(DOC·DOCX), Excel(XLS·XLSX), ZIP · 파일당 최대 20MB. 저장소 제한이 더 낮으면 해당 제한이 적용됩니다.";

export function validateOtherDocument(name: string, size: number, mime: string): string | null {
  if (!name || name.length > 180 || /[\\/\x00-\x1f\x7f]/.test(name)) return "파일 이름을 확인해 주세요. (최대 180자)";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const allowed = OTHER_DOCUMENT_TYPES[ext];
  if (!allowed) return "지원하지 않는 파일 형식입니다.";
  if (!Number.isSafeInteger(size) || size <= 0 || size > OTHER_DOCUMENT_MAX_BYTES) return "빈 파일은 첨부할 수 없으며 파일당 최대 20MB입니다.";
  // Browsers may omit MIME for Office/ZIP files. Storage still enforces its own policy.
  if (mime && mime !== "application/octet-stream" && !allowed.includes(mime)) return "파일 확장자와 형식이 일치하지 않습니다.";
  return null;
}

export function isOtherDocument(key: string): boolean {
  return /^other_document_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(key);
}
