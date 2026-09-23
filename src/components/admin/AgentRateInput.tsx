"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Action = (
  agentId: string,
  rate: number | null,
) => Promise<{ ok: true } | { error: string }>;

// 최상위 영업자 기본 수수료율(%) — onBlur 저장.
export function AgentRateInput({
  agentId,
  rate,
  action,
}: {
  agentId: string;
  rate: number | null;
  action: Action;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save(raw: string) {
    const trimmed = raw.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    const cur = rate ?? null;
    if (next === cur) return;
    startTransition(async () => {
      const res = await action(agentId, next);
      if ("error" in res) {
        alert(res.error);
        return;
      }
      setSaved(true);
      router.refresh();
      window.setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-xs text-navy-500">기본 수수료율</span>
      <input
        type="text"
        inputMode="decimal"
        defaultValue={rate ?? ""}
        disabled={pending}
        onBlur={(e) => save(e.target.value)}
        placeholder="0"
        className="w-16 rounded-lg border border-navy-200 bg-white px-2 py-1 text-right text-sm text-navy-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60"
      />
      <span className="text-xs text-navy-500">%</span>
      {saved && <span className="text-xs font-semibold text-brand-600">✓</span>}
    </span>
  );
}
