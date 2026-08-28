import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionAgent, type SalesAgent } from "@/lib/sales/agent";
import { stageLabel, type StageKey } from "@/lib/admin/pipeline";

type AgentRow = Pick<
  SalesAgent,
  "id" | "name" | "parent_id" | "status" | "created_at"
>;

type CustRow = {
  id: string;
  created_at: string;
  stage: StageKey;
  hospital_name: string | null;
  representative: string | null;
  sales_agent_id: string | null;
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  approved: { label: "활동중", cls: "bg-emerald-500/10 text-emerald-700" },
  pending: { label: "승인대기", cls: "bg-amber-500/10 text-amber-700" },
  rejected: { label: "거절", cls: "bg-red-500/10 text-red-600" },
};

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" });

export default async function SalesAgentsPage() {
  const { agent } = await getSessionAgent();
  if (!agent) return null;

  const supabase = await createClient();
  const [agentRes, custRes] = await Promise.all([
    supabase
      .from("sales_agents")
      .select("id, name, parent_id, status, created_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("customers")
      .select("id, created_at, stage, hospital_name, representative, sales_agent_id")
      .order("created_at", { ascending: false }),
  ]);

  const agents = (agentRes.data as AgentRow[] | null) ?? [];
  const customers = (custRes.data as CustRow[] | null) ?? [];

  const nameOf = new Map(agents.map((a) => [a.id, a.name]));

  // 영업자별 고객 그룹핑
  const byAgent = new Map<string, CustRow[]>();
  for (const c of customers) {
    const key = c.sales_agent_id ?? "__none__";
    (byAgent.get(key) ?? byAgent.set(key, []).get(key)!).push(c);
  }

  // 표시 순서: 나(본인) 먼저, 그다음 가입순
  const ordered = [
    ...agents.filter((a) => a.id === agent.id),
    ...agents.filter((a) => a.id !== agent.id),
  ];

  const subCount = agents.filter((a) => a.id !== agent.id).length;
  const activeOf = (list: CustRow[]) => list.filter((c) => c.stage !== "closed").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-navy-900">영업자별 진행 현황</h1>
          <p className="mt-0.5 text-xs text-navy-500">
            내 조직 {subCount}명 · 담당 고객 {customers.length}건
          </p>
        </div>
        <Link
          href="/sales"
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-navy-500 hover:bg-navy-50"
        >
          ← 대시보드
        </Link>
      </div>

      <div className="space-y-3">
        {ordered.map((a) => {
          const list = byAgent.get(a.id) ?? [];
          const active = activeOf(list);
          const st = STATUS_LABEL[a.status] ?? {
            label: a.status,
            cls: "bg-navy-100 text-navy-600",
          };
          const isMe = a.id === agent.id;
          return (
            <details
              key={a.id}
              open={active > 0}
              className="group rounded-2xl border border-navy-100 bg-white"
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3">
                <span className="text-navy-400 transition group-open:rotate-90">▶</span>
                <span className="font-medium text-navy-900">{a.name}</span>
                {isMe && (
                  <span className="rounded-full bg-navy-100 px-2 py-0.5 text-xs text-navy-600">
                    나
                  </span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-xs ${st.cls}`}>{st.label}</span>
                <span className="ml-auto flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-brand-500/10 px-2 py-0.5 font-medium text-brand-700">
                    진행중 {active}
                  </span>
                  <span className="text-navy-500">전체 {list.length}</span>
                </span>
              </summary>

              {list.length === 0 ? (
                <p className="border-t border-navy-50 px-5 py-6 text-center text-xs text-navy-400">
                  담당 고객이 없습니다.
                </p>
              ) : (
                <div className="overflow-x-auto border-t border-navy-50">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-navy-500">
                        <th className="px-5 py-2 font-medium">상호</th>
                        <th className="px-3 py-2 font-medium">대표자</th>
                        <th className="px-3 py-2 font-medium">단계</th>
                        <th className="px-5 py-2 font-medium">등록일</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((c) => (
                        <tr
                          key={c.id}
                          className="border-t border-navy-50 hover:bg-navy-50"
                        >
                          <td className="px-5 py-2.5">
                            <Link
                              href={`/sales/customers/${c.id}`}
                              className="font-medium text-navy-900 hover:text-brand-600"
                            >
                              {c.hospital_name ?? "(미입력)"}
                            </Link>
                          </td>
                          <td className="px-3 py-2.5 text-navy-600">{c.representative ?? "-"}</td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs ${
                                c.stage === "closed"
                                  ? "bg-navy-100 text-navy-500"
                                  : "bg-brand-500/10 text-brand-700"
                              }`}
                            >
                              {stageLabel(c.stage)}
                            </span>
                          </td>
                          <td className="px-5 py-2.5 text-navy-500">{fmtDate(c.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </details>
          );
        })}

        {/* 담당자 미지정 고객 */}
        {(byAgent.get("__none__") ?? []).length > 0 && (
          <details className="group rounded-2xl border border-dashed border-navy-200 bg-white">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3">
              <span className="text-navy-400 transition group-open:rotate-90">▶</span>
              <span className="font-medium text-navy-700">담당자 미지정</span>
              <span className="ml-auto text-xs text-navy-500">
                {(byAgent.get("__none__") ?? []).length}건
              </span>
            </summary>
            <div className="overflow-x-auto border-t border-navy-50">
              <table className="w-full text-sm">
                <tbody>
                  {(byAgent.get("__none__") ?? []).map((c) => (
                    <tr key={c.id} className="border-t border-navy-50 hover:bg-navy-50">
                      <td className="px-5 py-2.5">
                        <Link
                          href={`/sales/customers/${c.id}`}
                          className="font-medium text-navy-900 hover:text-brand-600"
                        >
                          {c.hospital_name ?? "(미입력)"}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-xs text-brand-700">
                          {stageLabel(c.stage)}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-navy-500">{fmtDate(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
