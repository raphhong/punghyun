import { isOtherDocument, OTHER_DOCUMENT_TYPES } from "./other-documents";

export function otherDocumentPath(customerId: string, key: string, filename: string): string {
  const ext = filename.split(".").pop()!.toLowerCase();
  return `${customerId}/${key}/${Buffer.from(filename, "utf8").toString("base64url")}.${ext}`;
}

export function otherDocumentFilename(path: string): string {
  const encoded = path.split("/").pop()?.split(".")[0] ?? "";
  return Buffer.from(encoded, "base64url").toString("utf8");
}

export function validOtherDocumentPath(customerId: string, key: string, path: string): boolean {
  if (!isOtherDocument(key) || !path.startsWith(`${customerId}/${key}/`)) return false;
  const name = otherDocumentFilename(path);
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return !!OTHER_DOCUMENT_TYPES[ext] && path === otherDocumentPath(customerId, key, name);
}
