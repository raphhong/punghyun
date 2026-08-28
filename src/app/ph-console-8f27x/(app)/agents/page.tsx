import { createClient } from "@/lib/supabase/server";
import type { SalesAgent } from "@/lib/sales/agent";
import { approveAgent, rejectAgent, resetAgent } from "./actions";

export const metadata = { title: "영업자 관리" };

type AgentRow = Pick<
  SalesAgent,
  "id" | "name" | "email" | "phone" | "status" | "parent_id" | "created_at"
>;

const statusBadge: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-brand-500/15 text-brand-700",
  rejected: "bg-red-100 text-red-600",
};
const statusLabel: Record<string, string> = {
  pending: "대기",
  approved: "승인",
  rejected: "거절",
};

export default async function AgentsPage() {
  const supabase = await createClient();

  const [agentRes, custRes] = await Promise.all([
    supabase
      .from("sales_agents")
      .select("id, name, email, phone, status, parent_id, created_at")
      .order("created_at", { ascending: true }),
    supabase.from("customers").select("sales_agent_id"),
  ]);

  const agents = (agentRes.data as AgentRow[] | null) ?? [];
  const custRows = (custRes.data as { sales_agent_id: string | null }[] | null) ?? [];

  // 영업자별 고객 수
  const dealCount = new Map<string, number>();
  for (const r of custRows) {
    if (r.sales_agent_id)
      dealCount.set(r.sales_agent_id, (dealCount.get(r.sales_agent_id) ?? 0) + 1);
  }

  const pending = agents.filter((a) => a.status === "pending");

  // 트리 구성
  const childrenOf = new Map<string | null, AgentRow[]>();
  for (const a of agents) {
    const key = a.parent_id;
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key)!.push(a);
  }
  const roots = childrenOf.get(null) ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">영업자 관리</h1>
        <p className="mt-1 text-sm text-navy-500">
          가입 승인과 조직도를 관리합니다. 총 {agents.length}명 · 대기 {pending.length}명
        </p>
      </div>

      {/* 승인 대기 */}
      <section className="rounded-2xl border border-navy-100 bg-white">
        <div className="border-b border-navy-100 px-5 py-3">
          <h2 className="text-sm font-bold text-navy-900">승인 대기</h2>
        </div>
        {pending.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-navy-400">
            대기 중인 가입 신청이 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-navy-50">
            {pending.map((a) => {
              const parent = a.parent_id
                ? agents.find((x) => x.id === a.parent_id)?.name ?? "-"
                : "(최상위)";
              return (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-navy-900">{a.name}</p>
                    <p className="text-xs text-navy-500">
                      {a.email} {a.phone ? `· ${a.phone}` : ""} · 상위: {parent}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <form action={approveAgent.bind(null, a.id)}>
                      <button className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600">
                        승인
                      </button>
                    </form>
                    <form action={rejectAgent.bind(null, a.id)}>
                      <button className="rounded-lg border border-navy-200 px-3 py-1.5 text-xs font-medium text-navy-600 hover:bg-navy-50">
                        거절
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 조직도 */}
      <section className="rounded-2xl border border-navy-100 bg-white">
        <div className="border-b border-navy-100 px-5 py-3">
          <h2 className="text-sm font-bold text-navy-900">조직도</h2>
        </div>
        {roots.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-navy-400">
            등록된 영업자가 없습니다.
          </p>
        ) : (
          <ul className="p-3">
            {roots.map((a) => (
              <AgentNode
                key={a.id}
                agent={a}
                depth={0}
                childrenOf={childrenOf}
                dealCount={dealCount}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AgentNode({
  agent,
  depth,
  childrenOf,
  dealCount,
}: {
  agent: AgentRow;
  depth: number;
  childrenOf: Map<string | null, AgentRow[]>;
  dealCount: Map<string, number>;
}) {
  const kids = childrenOf.get(agent.id) ?? [];
  const deals = dealCount.get(agent.id) ?? 0;

  return (
    <li>
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 py-2 hover:bg-navy-50"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {depth > 0 && <span className="text-navy-300">└</span>}
        <span className="text-sm font-medium text-navy-900">{agent.name}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
            statusBadge[agent.status] ?? "bg-navy-100 text-navy-600"
          }`}
        >
          {statusLabel[agent.status] ?? agent.status}
        </span>
        <span className="text-xs text-navy-400">건수 {deals}</span>
        <span className="text-xs text-navy-400">{agent.email}</span>
        <span className="ml-auto flex gap-1.5">
          {agent.status !== "approved" && (
            <form action={approveAgent.bind(null, agent.id)}>
              <button className="rounded-md bg-brand-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-brand-600">
                승인
              </button>
            </form>
          )}
          {agent.status === "approved" && (
            <form action={resetAgent.bind(null, agent.id)}>
              <button className="rounded-md border border-navy-200 px-2 py-1 text-[11px] font-medium text-navy-500 hover:bg-navy-100">
                승인취소
              </button>
            </form>
          )}
        </span>
      </div>
      {kids.length > 0 && (
        <ul>
          {kids.map((k) => (
            <AgentNode
              key={k.id}
              agent={k}
              depth={depth + 1}
              childrenOf={childrenOf}
              dealCount={dealCount}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
