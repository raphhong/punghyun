export type UploadMetadata = { id: string; size: number; type: string };
export type UploadSource = "admin" | "sales" | "public" | "legacy";
export type UploadResult = { id: string; path: string; token: string } | { error: string };
export type DocumentResult = { ok: true } | { error: string };

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
export const DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.doc,.docx,.xls,.xlsx,.hwp,.hwpx,.txt,.csv,.zip";

// Browser MIME hints can be empty for office/Hangul files. The server supplies
// a canonical type, then checks Storage's actual byte count and file signature.
export const DOCUMENT_MIMES: Record<string, string[]> = {
  pdf: ["application/pdf"], jpg: ["image/jpeg"], jpeg: ["image/jpeg"],
  png: ["image/png"], webp: ["image/webp"], gif: ["image/gif"],
  heic: ["image/heic", "image/heif"], heif: ["image/heif", "image/heic"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  hwp: ["application/x-hwp", "application/haansofthwp"],
  hwpx: ["application/hwp+zip", "application/vnd.hancom.hwpx"],
  txt: ["text/plain"], csv: ["text/csv", "application/vnd.ms-excel"],
  zip: ["application/zip", "application/x-zip-compressed"],
};

export function documentFileType(filename: string, size: number, type: string): { extension: string; contentType: string } | { error: string } {
  if (typeof filename !== "string" || typeof type !== "string") return { error: "파일 정보를 확인해 주세요." };
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  const allowed = DOCUMENT_MIMES[extension];
  if (!filename.trim() || filename.length > 255 || /[\\/\x00-\x1f]/.test(filename)) {
    return { error: "파일 이름을 확인해 주세요." };
  }
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_DOCUMENT_BYTES) {
    return { error: "파일은 0바이트 초과, 20MB 이하여야 합니다." };
  }
  if (!allowed) return { error: "지원하지 않는 파일 형식입니다." };
  const mime = type.toLowerCase().split(";")[0].trim();
  if (mime && mime !== "application/octet-stream" && !allowed.includes(mime)) {
    return { error: "파일 확장자와 형식이 일치하지 않습니다." };
  }
  return { extension, contentType: allowed[0] };
}
