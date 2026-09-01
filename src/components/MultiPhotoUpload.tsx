"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

type CreateUrl = (
  id: string,
  docKey: string,
  filename: string,
) => Promise<{ path: string; token: string } | { error: string }>;

type Record = (
  id: string,
  docKey: string,
  category: string,
  path: string,
) => Promise<{ ok: true } | { error: string }>;

// 한 회사에 여러 기계 사진을 한 번에 올리기 위한 다중 업로드 컴포넌트.
// 각 사진은 customer_documents의 개별 행(고유 doc_key)으로 저장된다.
export function MultiPhotoUpload({
  id,
  category,
  createUrl,
  record,
  variant = "public",
}: {
  id: string;
  category: string;
  createUrl: CreateUrl;
  record: Record;
  variant?: "public" | "admin";
}) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [msg, setMsg] = useState("");

  const dark = variant === "admin";

  async function handleUpload() {
    if (files.length === 0) return;
    setBusy(true);
    setDone(0);
    setMsg("");

    const supabase = createBrowserClient();
    let ok = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const docKey = `device_photo_${Date.now()}_${i}_${Math.random()
        .toString(36)
        .slice(2, 7)}`;

      try {
        const signed = await createUrl(id, docKey, file.name);
        if ("error" in signed) {
          setMsg(`${file.name}: ${signed.error}`);
          continue;
        }

        const { error: upErr } = await supabase.storage
          .from("customer-docs")
          .uploadToSignedUrl(signed.path, signed.token, file);
        if (upErr) {
          setMsg(`${file.name}: 업로드 실패 (${upErr.message})`);
          continue;
        }

        const rec = await record(id, docKey, category, signed.path);
        if ("error" in rec) {
          setMsg(`${file.name}: ${rec.error}`);
          continue;
        }

        ok += 1;
        setDone(ok);
      } catch (e) {
        setMsg(`${file.name}: ${e instanceof Error ? e.message : "오류"}`);
      }
    }

    setBusy(false);
    setFiles([]);
    if (ok > 0) {
      setMsg(`${ok}장 업로드 완료`);
      router.refresh();
    }
  }

  return (
    <div
      className={
        dark
          ? "rounded-xl border border-neutral-200 bg-neutral-50 p-3"
          : "rounded-xl border border-navy-100 p-3"
      }
    >
      <p
        className={`mb-2 text-sm font-semibold ${
          dark ? "text-neutral-800" : "text-navy-800"
        }`}
      >
        기기 사진 여러 장 올리기
      </p>
      <p
        className={`mb-2 text-xs leading-relaxed ${
          dark ? "text-neutral-500" : "text-navy-500"
        }`}
      >
        여러 기계를 한 번에 촬영해 올릴 수 있습니다. 파일을 여러 개 선택한 뒤
        업로드를 누르세요.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          disabled={busy}
          className={
            dark
              ? "min-w-0 flex-1 text-xs text-neutral-600 file:mr-2 file:rounded-md file:border-0 file:bg-neutral-200 file:px-2 file:py-1.5 file:text-neutral-700"
              : "min-w-0 flex-1 text-xs text-navy-500 file:mr-2 file:rounded-md file:border-0 file:bg-navy-100 file:px-2 file:py-1.5 file:text-navy-700"
          }
        />
        <button
          type="button"
          onClick={handleUpload}
          disabled={files.length === 0 || busy}
          className={
            dark
              ? "rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-40"
              : "rounded-md bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-800 disabled:opacity-40"
          }
        >
          {busy
            ? `업로드 중… (${done}/${files.length})`
            : files.length > 0
              ? `${files.length}장 업로드`
              : "업로드"}
        </button>
      </div>
      {files.length > 0 && !busy && (
        <p
          className={`mt-1.5 text-xs ${
            dark ? "text-neutral-500" : "text-navy-500"
          }`}
        >
          선택됨: {files.length}장
        </p>
      )}
      {msg && (
        <p
          className={`mt-1.5 text-xs ${
            msg.includes("완료") ? "text-brand-600" : "text-red-600"
          }`}
        >
          {msg}
        </p>
      )}
    </div>
  );
}
