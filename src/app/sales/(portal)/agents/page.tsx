import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionAgent, type SalesAgent } from "@/lib/sales/agent";

type AgentRow = Pick<
  SalesAgent,
  "id" | "name" | "parent_id" | "status" | "created_at"
>;

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  approved: { label: "활동중", cls: "bg-emerald-500/10 text-emerald-700" },
  pending: { label: "승인대기", cls: "bg-amber-500/10 text-amber-700" },
  rejected: { label: "거절", cls: "bg-red-500/10 text-red-600" },
};

export default async function SalesAgentsPage() {
  const { agent } = await getSessionAgent();
  if (!agent) return null;

  const supabase = await createClient();
  const [agentRes, custRes] = await Promise.all([
    supabase
      .from("sales_agents")
      .select("id, name, parent_id, status, created_at")
      .order("created_at", { ascending: true }),
    supabase.from("customers").select("sales_agent_id"),
  ]);

  const agents = (agentRes.data as AgentRow[] | null) ?? [];
  const custAgentIds = ((custRes.data as { sales_agent_id: string | null }[] | null) ?? [])
    .map((c) => c.sales_agent_id)
    .filter((x): x is string => !!x);

  const nameOf = new Map(agents.map((a) => [a.id, a.name]));
  const custCount = new Map<string, number>();
  for (const id of custAgentIds) custCount.set(id, (custCount.get(id) ?? 0) + 1);

  // 나 자신 제외한 하위 영업자
  const subAgents = agents.filter((a) => a.id !== agent.id);

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-navy-900">하위 영업자</h1>
          <p className="mt-0.5 text-xs text-navy-500">내 조직 {subAgents.length}명</p>
        </div>
        <Link
          href="/sales"
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-navy-500 hover:bg-navy-50"
        >
          ← 대시보드
        </Link>
      </div>

      <div className="rounded-2xl border border-navy-100 bg-white">
        {subAgents.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-navy-400">
            아직 하위 영업자가 없습니다. 대시보드에서 초대 링크를 공유하세요.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-100 text-left text-xs text-navy-500">
                  <th className="px-5 py-2 font-medium">이름</th>
                  <th className="px-3 py-2 font-medium">상위</th>
                  <th className="px-3 py-2 font-medium">상태</th>
                  <th className="px-3 py-2 font-medium">담당 고객</th>
                  <th className="px-5 py-2 font-medium">가입일</th>
                </tr>
              </thead>
              <tbody>
                {subAgents.map((a) => {
                  const st = STATUS_LABEL[a.status] ?? {
                    label: a.status,
                    cls: "bg-navy-100 text-navy-600",
                  };
                  return (
                    <tr key={a.id} className="border-b border-navy-50 last:border-0 hover:bg-navy-50">
                      <td className="px-5 py-2.5 font-medium text-navy-900">{a.name}</td>
                      <td className="px-3 py-2.5 text-navy-600">
                        {a.parent_id ? nameOf.get(a.parent_id) ?? "-" : "-"}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-navy-600">{custCount.get(a.id) ?? 0}건</td>
                      <td className="px-5 py-2.5 text-navy-500">{fmtDate(a.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
