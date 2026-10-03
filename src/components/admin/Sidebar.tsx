"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { STAGES } from "@/lib/admin/pipeline";
import { adminPath } from "@/lib/admin/config";

export function Sidebar({ counts, onNavigate, showCashflow = false }: { counts: Record<string, number>; onNavigate?: () => void; showCashflow?: boolean }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const activeStage = params.get("stage");
  const customersBase = adminPath("customers");
  const onList = pathname === customersBase;
  function item(href: string, label: string, active: boolean, count?: number) {
    return <Link key={href} href={href} onClick={onNavigate} aria-current={active ? "page" : undefined}><span>{label}</span>{count !== undefined && <span className="ph-sidebar-count">{count}</span>}</Link>;
  }
  return <nav className="ph-sidebar flex flex-col gap-1 p-4" aria-label="어드민 메뉴">
    {item(adminPath(), "대시보드", pathname === adminPath())}
    {showCashflow && item(adminPath("cashflow"), "월별 현금흐름", pathname === adminPath("cashflow"))}
    <p className="ph-sidebar-label">고객 관리</p>
    {item(customersBase, "전체 고객", onList && !activeStage, counts.__all__ ?? 0)}
    {STAGES.map(stage => item(`${customersBase}?stage=${stage.key}`, stage.label, onList && activeStage === stage.key, counts[stage.key] ?? 0))}
    <p className="ph-sidebar-label">영업 조직</p>
    {item(adminPath("agents"), "영업자 관리", pathname === adminPath("agents"))}
    {item(adminPath("commissions"), "수수료 정산", pathname === adminPath("commissions"))}
  </nav>;
}
