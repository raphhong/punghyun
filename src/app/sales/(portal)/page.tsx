import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getSessionAgent, type SalesAgent } from "@/lib/sales/agent";
import { stageLabel } from "@/lib/admin/pipeline";
import type { StageKey } from "@/lib/admin/pipeline";
import { ShareLink } from "@/components/admin/ShareLink";

type Row = {
  id: string;
  created_at: string;
  stage: StageKey;
  hospital_name: string | null;
  representative: string | null;
  phone: string | null;
  sales_agent_id: string | null;
};

export default async function SalesDashboard() {
  const { agent } = await getSessionAgent();
  if (!agent) return null; // 레이아웃 가드가 처리

  const supabase = await createClient();

  // RLS 로 내 서브트리만 반환됨
  const [custRes, agentRes] = await Promise.all([
    supabase
      .from("customers")
      .select("id, created_at, stage, hospital_name, representative, phone, sales_agent_id")
      .order("created_at", { ascending: false }),
    supabase
      .from("sales_agents")
      .select("id, name, parent_id, status")
      .order("created_at", { ascending: true }),
  ]);

  const customers = (custRes.data as Row[] | null) ?? [];
  const agents = (agentRes.data as Pick<
    SalesAgent,
    "id" | "name" | "parent_id" | "status"
  >[] | null) ?? [];

  const agentName = new Map(agents.map((a) => [a.id, a.name]));
  // 나(본인) 제외한 하위 영업자 수
  const subAgents = agents.filter((a) => a.id !== agent.id);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const baseUrl = host ? `${proto}://${host}` : "";
  const inviteUrl = `${baseUrl}/sales/register?invite=${agent.invite_token}`;

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString("ko-KR", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    });

  return (
    <div className="space-y-6">
      {/* 요약 */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="총 건수(내 조직)" value={customers.length} />
        <Stat label="하위 영업자" value={subAgents.length} />
        <Stat
          label="진행중"
          value={customers.filter((c) => c.stage !== "closed").length}
        />
      </div>

      {/* 하위 초대 + 새 고객 */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-navy-100 bg-white p-5">
          <h2 className="text-sm font-bold text-navy-900">하위 영업자 초대</h2>
          <p className="mb-3 mt-1 text-xs text-navy-500">
            이 링크로 가입하면 내 조직 하위로 편입됩니다. (본사 승인 후 활동)
          </p>
          <ShareLink url={inviteUrl} />
        </div>

        <div className="flex flex-col rounded-2xl border border-navy-100 bg-white p-5">
          <h2 className="text-sm font-bold text-navy-900">새 고객 등록</h2>
          <p className="mb-3 mt-1 text-xs text-navy-500">
            내가 영업한 고객을 등록하고 서류 제출 링크를 전달하세요.
          </p>
          <Link
            href="/sales/new"
            className="mt-auto inline-flex w-fit rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            + 고객 등록
          </Link>
        </div>
      </div>

      {/* 고객 리스트 */}
      <div className="rounded-2xl border border-navy-100 bg-white">
        <div className="border-b border-navy-100 px-5 py-3">
          <h2 className="text-sm font-bold text-navy-900">내 조직 고객</h2>
        </div>
        {customers.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-navy-400">
            아직 등록된 고객이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-100 text-left text-xs text-navy-500">
                  <th className="px-5 py-2 font-medium">상호</th>
                  <th className="px-3 py-2 font-medium">대표자</th>
                  <th className="px-3 py-2 font-medium">연락처</th>
                  <th className="px-3 py-2 font-medium">담당 영업자</th>
                  <th className="px-3 py-2 font-medium">단계</th>
                  <th className="px-5 py-2 font-medium">등록일</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-navy-50 last:border-0 hover:bg-navy-50"
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
                    <td className="px-3 py-2.5 text-navy-600">{c.phone ?? "-"}</td>
                    <td className="px-3 py-2.5 text-navy-600">
                      {c.sales_agent_id
                        ? agentName.get(c.sales_agent_id) ?? "-"
                        : "-"}
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
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-navy-100 bg-white p-5">
      <p className="text-xs text-navy-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-navy-900">{value}</p>
    </div>
  );
}
