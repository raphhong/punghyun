"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { createDocUploadUrl, recordDocUpload } from "@/app/s/[token]/actions";

type Status = "idle" | "uploading" | "done" | "error";

export function PublicDocUpload({
  token,
  docKey,
  category,
  label,
  done: initialDone,
}: {
  token: string;
  docKey: string;
  category: string;
  label: string;
  done: boolean;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>(initialDone ? "done" : "idle");
  const [msg, setMsg] = useState<string>("");

  async function handleUpload() {
    if (!file) return;
    setStatus("uploading");
    setMsg("");

    try {
      const signed = await createDocUploadUrl(token, docKey, file.name);
      if ("error" in signed) {
        setStatus("error");
        setMsg(signed.error);
        return;
      }

      const supabase = createBrowserClient();
      const { error: upErr } = await supabase.storage
        .from("customer-docs")
        .uploadToSignedUrl(signed.path, signed.token, file);
      if (upErr) {
        setStatus("error");
        setMsg("업로드 실패: " + upErr.message);
        return;
      }

      const rec = await recordDocUpload(token, docKey, category, signed.path);
      if ("error" in rec) {
        setStatus("error");
        setMsg(rec.error);
        return;
      }

      setStatus("done");
      setFile(null);
      router.refresh();
    } catch (e) {
      setStatus("error");
      setMsg(e instanceof Error ? e.message : "알 수 없는 오류");
    }
  }

  const done = status === "done";

  return (
    <li className="rounded-xl border border-navy-100 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
            done ? "bg-brand-500 text-white" : "bg-navy-100 text-transparent"
          }`}
        >
          ✓
        </span>
        <span className="text-sm font-medium text-navy-800">{label}</span>
        {done && <span className="text-xs text-brand-600">업로드됨</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="min-w-0 flex-1 text-xs text-navy-500 file:mr-2 file:rounded-md file:border-0 file:bg-navy-100 file:px-2 file:py-1.5 file:text-navy-700"
        />
        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || status === "uploading"}
          className="rounded-md bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-800 disabled:opacity-40"
        >
          {status === "uploading" ? "업로드 중…" : "업로드"}
        </button>
      </div>
      {status === "error" && (
        <p className="mt-1.5 text-xs text-red-600">{msg}</p>
      )}
    </li>
  );
}
