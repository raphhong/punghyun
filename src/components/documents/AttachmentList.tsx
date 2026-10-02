"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AttachmentView } from "@/lib/documents/presentation";

export type AttachmentAction = (formData: FormData) => Promise<unknown>;

const sources = { admin: "관리자", sales: "영업자", public: "고객 제출", legacy: "기존 자료" };

export function AttachmentList({ files, customerId, docKey, deleteAction, restoreAction }: {
  files: AttachmentView[];
  customerId?: string;
  docKey: string;
  deleteAction: AttachmentAction;
  restoreAction: AttachmentAction;
}) {
  const router = useRouter();
  const lock = useRef(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const current = files.filter((file) => !file.deletedAt);
  const removed = files.filter((file) => !!file.deletedAt);

  async function mutate(file: AttachmentView, restore: boolean) {
    if (lock.current || !file.attachmentId) return;
    if (!restore && !window.confirm(`다음 파일만 목록에서 제거할까요?\n${file.filename}\n파일 ID: ${file.attachmentId}\n제거 후 다시 복원할 수 있습니다.`)) return;
    lock.current = true;
    setPending(file.id);
    setError("");
    try {
      const data = new FormData();
      if (customerId) data.set("customer_id", customerId);
      data.set("doc_key", docKey);
      data.set("attachment_id", file.attachmentId);
      const result = await (restore ? restoreAction : deleteAction)(data);
      if (result && typeof result === "object" && "error" in result) throw new Error(String(result.error));
      router.refresh();
    } catch (caught) {
      setError(`${file.filename}: ${caught instanceof Error ? caught.message : "처리하지 못했습니다. 다시 시도해 주세요."}`);
    } finally {
      lock.current = false;
      setPending(null);
    }
  }

  function fileRow(file: AttachmentView, removed = false) {
    const time = file.uploadedAt ? new Date(file.uploadedAt) : null;
    return (
      <li key={file.id} className="rounded-lg border border-navy-100 bg-white p-2.5">
        <div className="flex flex-wrap items-start gap-2">
          <span className="min-w-0 flex-1 break-all text-sm font-medium text-navy-800">{file.filename}</span>
          <div className="flex shrink-0 items-center gap-3 text-xs">
            {!removed && file.url && <>
              <a href={file.url} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-600 hover:underline">보기</a>
              <a href={`${file.url}${file.url.includes("?") ? "&" : "?"}download`} className="text-navy-500 hover:underline">다운로드</a>
            </>}
            {file.attachmentId ? (
              <button type="button" disabled={pending !== null} onClick={() => mutate(file, removed)} aria-label={`${file.filename} (${file.attachmentId}) ${removed ? "복원" : "목록에서 제거"}`} className={`${removed ? "text-brand-600" : "text-red-500"} disabled:opacity-40 hover:underline`}>
                {pending === file.id ? "처리 중…" : removed ? "복원" : "목록에서 제거"}
              </button>
            ) : <span className="text-navy-400" title="기존 파일 보존을 위해 데이터 업데이트 이후 제거할 수 있습니다.">기존 자료 · 제거 준비 중</span>}
          </div>
        </div>
        <p className="mt-1 break-all text-xs text-navy-400">
          {file.size != null ? `${new Intl.NumberFormat("ko-KR").format(file.size)}바이트` : "크기 정보 없음"}
          {" · "}{file.contentType || "형식 정보 없음"}{" · "}{sources[file.source ?? "legacy"]}
          {" · "}{time && !Number.isNaN(time.getTime()) ? time.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false }) + " (한국시간)" : "업로드 시각 정보 없음"}
        </p>
        <p className="mt-0.5 break-all text-[10px] text-navy-400">파일 ID: {file.attachmentId ?? file.id}</p>
        {!removed && !file.url && <p className="mt-1 text-xs text-amber-700">파일 열기 링크를 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요.</p>}
      </li>
    );
  }

  return <div className="space-y-2">
    {current.length > 0 ? <ul className="space-y-2">{current.map((file) => fileRow(file))}</ul> : <p className="text-xs text-navy-400">첨부 파일 없음</p>}
    {removed.length > 0 && <details className="rounded-lg bg-navy-50 p-2">
      <summary className="cursor-pointer text-xs text-navy-500">제거한 파일 {removed.length}개 · 복원 가능</summary>
      <ul className="mt-2 space-y-2">{removed.map((file) => fileRow(file, true))}</ul>
    </details>}
    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
  </div>;
}
