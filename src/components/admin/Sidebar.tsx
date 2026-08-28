"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { STAGES } from "@/lib/admin/pipeline";
import { adminPath } from "@/lib/admin/config";
import { cn } from "@/lib/cn";

export function Sidebar({
  counts,
  onNavigate,
}: {
  counts: Record<string, number>;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const activeStage = params.get("stage");
  const customersBase = adminPath("customers");
  const onList = pathname === customersBase;

  return (
    <nav className="flex flex-col gap-1 p-4" aria-label="어드민 메뉴">
      <Link
        href={adminPath()}
        onClick={onNavigate}
        className={cn(
          "rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
          pathname === adminPath()
            ? "bg-brand-500 text-white"
            : "text-navy-200 hover:bg-navy-800",
        )}
      >
        대시보드
      </Link>

      <p className="mt-4 px-3 text-xs font-semibold uppercase tracking-wide text-navy-500">
        고객 관리
      </p>

      <Link
        href={customersBase}
        onClick={onNavigate}
        className={cn(
          "mt-1 flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
          onList && !activeStage
            ? "bg-navy-800 text-white"
            : "text-navy-300 hover:bg-navy-800",
        )}
      >
        <span>전체 고객</span>
        <span className="rounded-full bg-navy-700 px-2 py-0.5 text-xs text-navy-200">
          {counts.__all__ ?? 0}
        </span>
      </Link>

      {STAGES.map((s) => {
        const active = onList && activeStage === s.key;
        return (
          <Link
            key={s.key}
            href={`${customersBase}?stage=${s.key}`}
            onClick={onNavigate}
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
              active ? "bg-navy-800 text-white" : "text-navy-300 hover:bg-navy-800",
            )}
          >
            <span>{s.label}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                counts[s.key]
                  ? "bg-brand-500/20 text-brand-200"
                  : "bg-navy-800 text-navy-500",
              )}
            >
              {counts[s.key] ?? 0}
            </span>
          </Link>
        );
      })}

      <p className="mt-4 px-3 text-xs font-semibold uppercase tracking-wide text-navy-500">
        영업 조직
      </p>
      <Link
        href={adminPath("agents")}
        onClick={onNavigate}
        className={cn(
          "mt-1 rounded-lg px-3 py-2 text-sm transition-colors",
          pathname === adminPath("agents")
            ? "bg-navy-800 text-white"
            : "text-navy-300 hover:bg-navy-800",
        )}
      >
        영업자 관리
      </Link>
    </nav>
  );
}
