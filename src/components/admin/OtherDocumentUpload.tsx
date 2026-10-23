"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { OTHER_DOCUMENT_ACCEPT, OTHER_DOCUMENT_HINT, validateOtherDocument } from "@/lib/admin/other-documents";
import { createOtherDocumentUpload, recordOtherDocumentUpload } from "@/app/ph-console-8f27x/(app)/customers/other-document-actions";

type PendingFile = { file: File; signed?: { key: string; path: string; token: string }; uploaded?: boolean };

// Same sequential signed-upload flow as DeviceManager, retaining failed saves for retry.
export function OtherDocumentUpload({ customerId }: { customerId: string }) {
  const router = useRouter();
  const busy = useRef(false);
  const pending = useRef<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [retryCount, setRetryCount] = useState(0);

  async function upload(items: PendingFile[]) {
    if (busy.current || !items.length) return;
    busy.current = true;
    setUploading(true);
    setErrors([]);
    const failures: PendingFile[] = [];
    const messages: string[] = [];
    let saved = 0;
    try {
      const supabase = createBrowserClient();
      for (const [index, item] of items.entries()) {
        setProgress(`업로드 중… (${index + 1}/${items.length})`);
        try {
          const invalid = validateOtherDocument(item.file.name, item.file.size, item.file.type);
          if (invalid) throw new Error(invalid);
          if (!item.signed) {
            const result = await createOtherDocumentUpload(customerId, item.file.name, item.file.size, item.file.type);
            if ("error" in result) throw new Error(result.error);
            item.signed = result;
          }
          if (!item.uploaded) {
            const { error } = await supabase.storage.from("customer-docs").uploadToSignedUrl(item.signed.path, item.signed.token, item.file);
            if (error) { item.signed = undefined; throw new Error(error.message); }
            item.uploaded = true;
          }
          const result = await recordOtherDocumentUpload(customerId, item.signed.key, item.signed.path);
          if ("error" in result) throw new Error(result.error);
          saved++;
        } catch (error) {
          failures.push(item);
          messages.push(`${item.file.name}: ${error instanceof Error ? error.message : "업로드 실패"}`);
        }
      }
    } finally {
      pending.current = failures;
      setRetryCount(failures.length);
      setErrors(messages);
      setProgress(`${saved}개 저장 완료${failures.length ? ` · ${failures.length}개 실패` : ""}`);
      setUploading(false);
      busy.current = false;
      if (saved) router.refresh();
    }
  }

  return <div className="space-y-2">
    <p className="text-xs text-navy-500">{OTHER_DOCUMENT_HINT}</p>
    <label className="inline-flex cursor-pointer rounded-md bg-navy-900 px-3 py-2 text-xs font-semibold text-white">
      기타 서류 추가 (여러 파일 선택)
      <input type="file" aria-label="기타 서류 첨부" accept={OTHER_DOCUMENT_ACCEPT} multiple disabled={uploading}
        className="sr-only" onChange={event => {
          const items = Array.from(event.target.files ?? []).map(file => ({ file }));
          event.target.value = "";
          void upload([...pending.current, ...items]);
        }} />
    </label>
    {retryCount > 0 && <button type="button" disabled={uploading} onClick={() => void upload(pending.current)} className="ml-2 text-xs text-brand-700 disabled:opacity-50">실패한 {retryCount}개 재시도</button>}
    <p role="status" className="text-xs text-navy-600">{progress}</p>
    {errors.length > 0 && <ul role="alert" className="text-xs text-red-600">{errors.map((message, i) => <li key={i}>{message}</li>)}</ul>}
  </div>;
}
