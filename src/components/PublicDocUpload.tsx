"use client";

import { MultiDocUpload } from "@/components/documents/MultiDocUpload";
import { AttachmentList } from "@/components/documents/AttachmentList";
import type { AttachmentView } from "@/lib/documents/presentation";
import { createDocUploadUrl, recordDocUpload, deleteDocByToken, restoreDocByToken } from "@/app/s/[token]/actions";

export function PublicDocUpload({ token, docKey, category, label, hint, files }: {
  token: string;
  docKey: string;
  category: string;
  label: string;
  hint?: string;
  files: AttachmentView[];
}) {
  const count = files.filter((file) => !file.deletedAt).length;
  return (
    <li className="space-y-3 rounded-xl border border-navy-100 p-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-navy-800">{label}</span>
          <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs text-navy-500">첨부 {count}개</span>
        </div>
        {hint && <p className="mt-1 text-xs leading-relaxed text-navy-500">{hint}</p>}
        {docKey === "tax_payment_cert" && <p className="mt-1 text-xs text-amber-700">국세와 지방세 증명서를 모두 첨부해 주세요. 파일 수만으로 서류가 모두 갖춰졌는지 판단하지 않습니다.</p>}
      </div>
      <AttachmentList files={files} docKey={docKey} deleteAction={(data) => deleteDocByToken(token, docKey, String(data.get("attachment_id")))} restoreAction={(data) => restoreDocByToken(token, docKey, String(data.get("attachment_id")))} />
      <MultiDocUpload label={label} signAction={(filename, metadata) => createDocUploadUrl(token, docKey, filename, metadata)} recordAction={(path, id) => recordDocUpload(token, docKey, category, path, id)} />
    </li>
  );
}
