"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { STAGES, type StageKey } from "@/lib/admin/pipeline";

type ChangeStage = (
  id: string,
  stage: StageKey,
) => Promise<{ ok: true } | { error: string }>;

// 진행 단계를 하나의 진행바로 통합 — 기존 prev/next 버튼 + 직접변경 드롭다운을 대체.
export function StageStepper({
  id,
  stage,
  prevKey,
  nextKey,
  action,
}: {
  id: string;
  stage: StageKey;
  prevKey: StageKey | null;
  nextKey: StageKey | null;
  action: ChangeStage;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const currentIdx = STAGES.findIndex((s) => s.key === stage);

  function go(target: StageKey) {
    if (target === stage) return;
    startTransition(async () => {
      const res = await action(id, target);
      if ("error" in res) {
        alert(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-navy-100 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => prevKey && go(prevKey)}
          disabled={!prevKey || pending}
          className="rounded-lg border border-navy-200 px-3 py-1.5 text-sm font-medium text-navy-600 hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← 이전
        </button>
        <span className="text-xs text-navy-400">
          {pending ? "이동 중…" : "단계를 눌러 이동"}
        </span>
        <button
          type="button"
          onClick={() => nextKey && go(nextKey)}
          disabled={!nextKey || pending}
          className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          다음 →
        </button>
      </div>

      <ol className="flex items-center gap-1 overflow-x-auto pb-1">
        {STAGES.map((s, i) => {
          const done = i < currentIdx;
          const current = i === currentIdx;
          return (
            <li key={s.key} className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => go(s.key)}
                disabled={pending}
                title={s.label}
                aria-current={current ? "step" : undefined}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed ${
                  current
                    ? "bg-brand-500 text-white shadow-sm"
                    : done
                      ? "bg-brand-50 text-brand-700 hover:bg-brand-100"
                      : "bg-navy-50 text-navy-400 hover:bg-navy-100"
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                    current
                      ? "bg-white/25 text-white"
                      : done
                        ? "bg-brand-500 text-white"
                        : "bg-navy-200 text-white"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </span>
                {s.short}
              </button>
              {i < STAGES.length - 1 && (
                <span
                  className={`mx-0.5 h-px w-3 ${
                    done ? "bg-brand-300" : "bg-navy-200"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
