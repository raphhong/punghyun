"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  createDocUploadUrl,
  recordDocUpload,
} from "@/app/ph-console-8f27x/(app)/customers/actions";

type Status = "idle" | "uploading" | "error";

export function AdminDocUpload({
  customerId,
  docKey,
  category,
}: {
  customerId: string;
  docKey: string;
  category: string;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [msg, setMsg] = useState("");

  async function handleUpload() {
    if (!file) return;
    setStatus("uploading");
    setMsg("");

    try {
      const signed = await createDocUploadUrl(customerId, docKey, file.name);
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
        setMsg(upErr.message);
        return;
      }

      const rec = await recordDocUpload(
        customerId,
        docKey,
        category,
        signed.path,
      );
      if ("error" in rec) {
        setStatus("error");
        setMsg(rec.error);
        return;
      }

      setStatus("idle");
      setFile(null);
      router.refresh();
    } catch (e) {
      setStatus("error");
      setMsg(e instanceof Error ? e.message : "알 수 없는 오류");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="max-w-[180px] text-xs text-navy-500 file:mr-2 file:rounded-md file:border-0 file:bg-navy-100 file:px-2 file:py-1 file:text-navy-700"
        />
        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || status === "uploading"}
          className="rounded-md border border-navy-200 px-2.5 py-1 text-xs font-medium text-navy-600 hover:bg-navy-50 disabled:opacity-40"
        >
          {status === "uploading" ? "업로드 중…" : "업로드"}
        </button>
      </div>
      {status === "error" && <p className="text-xs text-red-600">{msg}</p>}
    </div>
  );
}
