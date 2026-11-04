import { isOtherDocument, OTHER_DOCUMENT_TYPES } from "./other-documents";

export function otherDocumentPath(customerId: string, key: string, filename: string): string {
  const ext = filename.split(".").pop()!.toLowerCase();
  return `${customerId}/${key}/${Buffer.from(filename, "utf8").toString("base64url")}.${ext}`;
}

export function otherDocumentFilename(path: string): string {
  const parts = path.split('/');
  const basename = parts.at(-1) ?? '';
  // Ordinary uploads use docKey-timestamp.ext, never base64. Decode only our encoded layout.
  if (!isOtherDocument(parts.at(-2) ?? '')) return basename || '파일 이름 확인 필요';
  const encoded = basename.split('.')[0];
  const decoded = Buffer.from(encoded, 'base64url').toString('utf8');
  if (!decoded || /[\u0000-\u001f\u007f\ufffd]/.test(decoded) || Buffer.from(decoded, 'utf8').toString('base64url') !== encoded) return '파일 이름 확인 필요';
  return decoded;
}

export function validOtherDocumentPath(customerId: string, key: string, path: string): boolean {
  if (!isOtherDocument(key) || !path.startsWith(`${customerId}/${key}/`)) return false;
  const name = otherDocumentFilename(path);
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return !!OTHER_DOCUMENT_TYPES[ext] && path === otherDocumentPath(customerId, key, name);
}
