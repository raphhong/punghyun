"use client";

import { useState } from "react";

export function ShareMessage({ message }: { message: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 미지원 시 무시 (사용자가 직접 선택 복사)
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        readOnly
        value={message}
        rows={8}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full resize-none rounded-lg border border-navy-200 bg-navy-50 px-3 py-2 text-xs leading-relaxed text-navy-700"
      />
      <button
        type="button"
        onClick={copy}
        className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800"
      >
        {copied ? "복사됨" : "안내문구 복사"}
      </button>
    </div>
  );
}
