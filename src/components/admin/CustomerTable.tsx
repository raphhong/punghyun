import Link from "next/link";
import { adminPath } from "@/lib/admin/config";
import { stageLabel, type StageKey } from "@/lib/admin/pipeline";
import type { Customer } from "@/lib/admin/types";
import { ClickableRow } from "./ClickableRow";
import { EmptyState, StatusBadge } from "@/components/ui/Feedback";

export function CustomerTable({ customers, agentName, failed = false }: { customers: Partial<Customer>[]; agentName: Map<string, string>; failed?: boolean }) {
  return <div className="ph-surface overflow-hidden">
    <p className="border-b border-navy-100 px-4 py-3 text-sm text-navy-500" id="customer-table-help">상호를 누르면 고객 상세를 확인할 수 있습니다. 좁은 화면에서는 표를 좌우로 이동하세요.</p>
    <div className="ph-table-scroll" tabIndex={0} role="region" aria-label="고객 목록" aria-describedby="customer-table-help">
      <table className="ph-table min-w-[1080px]">
        <caption className="sr-only">고객 목록 · 필요자금은 접수 당시 입력한 내용입니다</caption>
        <thead><tr>{["상호", "대표자", "연락처", "유형", "필요자금 (입력값)", "단계", "담당 영업자", "인입일", "경로"].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{customers.map(c => <ClickableRow key={c.id} href={adminPath(`customers/${c.id}`)}>
          <td className="min-w-44 max-w-64"><Link href={adminPath(`customers/${c.id}`)} className="font-semibold text-brand-700 underline decoration-navy-200 underline-offset-4">{c.hospital_name || "(미입력)"}</Link></td>
          <td className="ph-nowrap">{c.representative || "-"}</td>
          <td className="ph-nowrap ph-number">{c.phone || "-"}</td>
          <td className="ph-nowrap">{c.hospital_type === "individual" ? "개인" : c.hospital_type === "corporate" ? "법인" : "-"}</td>
          <td className="min-w-36 ph-number">{c.needed_funds || "-"}</td>
          <td className="min-w-44"><StatusBadge>{stageLabel(c.stage as StageKey)}</StatusBadge></td>
          <td className="ph-nowrap">{c.sales_agent_id ? agentName.get(c.sales_agent_id) ?? "-" : "-"}</td>
          <td className="ph-date">{c.intake_date ?? "-"}</td>
          <td className="ph-nowrap">{c.source === "homepage" ? "공홈" : "수동"}</td>
        </ClickableRow>)}</tbody>
      </table>
    </div>
    {!customers.length && !failed && <EmptyState title="해당 단계의 고객이 없습니다." />}
  </div>;
}
