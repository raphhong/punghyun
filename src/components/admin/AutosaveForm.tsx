"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type SaveAction = (
  fd: FormData,
) => Promise<{ ok: true } | { error: string }>;

type Status = "idle" | "saving" | "saved" | "error";

// 폼 내 값 변경 시 자동저장 + "저장 중…/저장됨 ✓" 상태 표시.
// 진행 단계 폼처럼 여러 카드를 감싸도, 닫힌 <details> 안 input까지 FormData에 포함됨.
export function AutosaveForm({
  action,
  children,
  className,
}: {
  action: SaveAction;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errMsg, setErrMsg] = useState("");
  const [, startTransition] = useTransition();

  function save() {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    setStatus("saving");
    startTransition(async () => {
      const res = await action(fd);
      if ("error" in res) {
        setErrMsg(res.error);
        setStatus("error");
        return;
      }
      setStatus("saved");
      router.refresh();
      window.setTimeout(() => setStatus("idle"), 1500);
    });
  }

  function scheduleSave() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 500);
  }

  function flushSave() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    save();
  }

  return (
    <form
      ref={formRef}
      onChange={scheduleSave}
      onBlur={flushSave}
      className={className}
    >
      <div className="mb-3 flex items-center justify-end">
        <StatusBadge status={status} errMsg={errMsg} />
      </div>
      {children}
    </form>
  );
}

function StatusBadge({ status, errMsg }: { status: Status; errMsg: string }) {
  if (status === "idle")
    return <span className="text-xs text-navy-300">자동 저장됨</span>;
  if (status === "saving")
    return <span className="text-xs text-navy-500">저장 중…</span>;
  if (status === "saved")
    return (
      <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
        저장됨 ✓
      </span>
    );
  return (
    <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">
      저장 실패{errMsg ? `: ${errMsg}` : ""}
    </span>
  );
}
