"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { DOCUMENT_ACCEPT } from "@/lib/documents/types";
import { queueFiles, submitUploadQueue, type QueuedUpload, type UploadOperations } from "@/lib/documents/upload-queue";

const phaseLabels = {
  queued: "대기 중",
  signing: "1/3 · 업로드 준비 중",
  uploading: "2/3 · 파일 전송 중",
  recording: "3/3 · 제출 기록 저장 중",
  done: "업로드 완료",
  error: "업로드 실패",
};

/** Shared by admin, sales and token submission. Selection alone never writes. */
export function MultiDocUpload({
  label,
  signAction,
  recordAction,
}: {
  label: string;
  signAction: UploadOperations["sign"];
  recordAction: UploadOperations["record"];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const queueRef = useRef<QueuedUpload[]>([]);
  const runningRef = useRef(false);
  const stopRef = useRef(false);
  const [queue, setQueue] = useState<QueuedUpload[]>([]);
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [notice, setNotice] = useState("");

  function update() {
    setQueue(queueRef.current.map((entry) => ({ ...entry })));
  }

  function removePending(id?: string) {
    if (runningRef.current) return;
    queueRef.current = queueRef.current.filter((entry) => entry.phase === "done" || (id !== undefined && entry.id !== id));
    update();
    if (inputRef.current) inputRef.current.value = "";
  }

  async function start(onlyId?: string) {
    // Ref guard closes the interval before React renders disabled buttons.
    if (runningRef.current) return;
    const batch = queueRef.current.filter((entry) => (!onlyId || entry.id === onlyId) && (entry.phase === "queued" || entry.phase === "error"));
    if (!batch.length) return;
    runningRef.current = true;
    stopRef.current = false;
    setRunning(true);
    setStopping(false);
    setNotice("");
    try {
      const storage = createBrowserClient().storage.from("customer-docs");
      await submitUploadQueue(batch, {
        sign: signAction,
        upload: (path, token, file, contentType) => storage.uploadToSignedUrl(path, token, new File([file], file.name, { type: contentType, lastModified: file.lastModified }), { contentType }),
        record: recordAction,
      }, update, () => stopRef.current);
      setNotice(stopRef.current ? "중지했습니다. 완료된 파일은 유지되며 남은 파일은 이어서 올릴 수 있습니다." : "처리 결과를 파일별로 확인해 주세요.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "업로드를 시작하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      runningRef.current = false;
      setRunning(false);
      setStopping(false);
      update();
      if (batch.some((entry) => entry.phase === "done")) router.refresh();
    }
  }

  const pendingCount = queue.filter((entry) => entry.phase === "queued" || entry.phase === "error").length;
  const doneCount = queue.filter((entry) => entry.phase === "done").length;

  return (
    <div className="min-w-0 space-y-2" onChange={(event) => event.stopPropagation()} onBlur={(event) => event.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={DOCUMENT_ACCEPT}
          disabled={running}
          aria-label={`${label} 첨부 파일 선택 (여러 개 가능)`}
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            // Closing the native chooser preserves an existing queued batch.
            if (!files.length || runningRef.current) return;
            queueRef.current = [...queueRef.current, ...queueFiles(files)];
            update();
            setNotice("");
            event.currentTarget.value = "";
          }}
          className="min-w-0 flex-1 text-xs text-navy-500 file:mr-2 file:rounded-md file:border-0 file:bg-navy-100 file:px-2 file:py-1.5 file:text-navy-700 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => start()}
          disabled={running || !pendingCount}
          className="rounded-md bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-800 disabled:opacity-40"
        >
          {running ? "업로드 중…" : `파일 추가 업로드${pendingCount ? ` (${pendingCount})` : ""}`}
        </button>
        {running ? (
          <button type="button" disabled={stopping} onClick={() => { stopRef.current = true; setStopping(true); }} className="rounded-md border border-navy-200 px-2.5 py-1.5 text-xs text-navy-600 disabled:opacity-40">
            {stopping ? "현재 파일 완료 후 중지 중…" : "현재 파일 완료 후 중지"}
          </button>
        ) : pendingCount > 0 ? (
          <button type="button" onClick={() => removePending()} className="text-xs text-navy-500 hover:underline">선택 취소</button>
        ) : null}
      </div>
      <p className="text-xs text-navy-400">여러 파일을 선택할 수 있습니다. 추가 업로드해도 기존 파일은 유지됩니다. 파일당 최대 20MB.</p>
      {queue.length > 0 && (
        <div className="rounded-lg bg-navy-50 p-2">
          <p className="mb-1 text-xs text-navy-600" aria-live="polite">이번 선택: {queue.length}개 · 완료 {doneCount}개 · 대기/재시도 {pendingCount}개</p>
          <ul className="space-y-2">
            {queue.map((entry) => {
              const active = ["signing", "uploading", "recording"].includes(entry.phase);
              return (
                <li key={entry.id} className="rounded-md bg-white p-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 break-all text-navy-800">{entry.file.name}</span>
                    <span className={entry.phase === "error" ? "text-red-600" : "text-navy-500"}>{phaseLabels[entry.phase]}</span>
                    {entry.phase === "error" && <button type="button" disabled={running} onClick={() => start(entry.id)} className="font-semibold text-brand-600 disabled:opacity-40">이 파일 재시도</button>}
                    {(entry.phase === "queued" || entry.phase === "error") && <button type="button" disabled={running} onClick={() => removePending(entry.id)} aria-label={`${entry.file.name} 선택 취소`} className="text-navy-400 disabled:opacity-40">취소</button>}
                  </div>
                  {active && <progress aria-label={`${entry.file.name}: ${phaseLabels[entry.phase]}`} className="mt-1 h-1 w-full" />}
                  {entry.error && <p role="alert" className="mt-1 break-words text-red-600">{entry.error}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {notice && <p role="status" className="text-xs text-navy-600">{notice}</p>}
    </div>
  );
}
