import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionAgent, type SalesAgent } from "@/lib/sales/agent";
import { STAGES, stageLabel, type StageKey } from "@/lib/admin/pipeline";

type Row = {
  id: string;
  created_at: string;
  stage: StageKey;
  hospital_name: string | null;
  representative: string | null;
  phone: string | null;
  sales_agent_id: string | null;
};

type Search = { q?: string; stage?: string; status?: string };

export default async function SalesCustomerList({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { agent } = await getSessionAgent();
  if (!agent) return null;

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const stage = sp.stage ?? "";
  const activeOnly = sp.status === "active";

  const supabase = await createClient();
  const [custRes, agentRes] = await Promise.all([
    supabase
      .from("customers")
      .select("id, created_at, stage, hospital_name, representative, phone, sales_agent_id")
      .order("created_at", { ascending: false }),
    supabase.from("sales_agents").select("id, name"),
  ]);

  const all = (custRes.data as Row[] | null) ?? [];
  const agents = (agentRes.data as Pick<SalesAgent, "id" | "name">[] | null) ?? [];
  const agentName = new Map(agents.map((a) => [a.id, a.name]));

  // 필터 적용
  const qLower = q.toLowerCase();
  const rows = all.filter((c) => {
    if (activeOnly && c.stage === "closed") return false;
    if (stage && c.stage !== stage) return false;
    if (q) {
      const hay = `${c.hospital_name ?? ""} ${c.representative ?? ""} ${c.phone ?? ""}`.toLowerCase();
      if (!hay.includes(qLower)) return false;
    }
    return true;
  });

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" });

  // 단계 칩 링크 (검색어·status 유지)
  const chipHref = (key: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (activeOnly) p.set("status", "active");
    if (key) p.set("stage", key);
    const qs = p.toString();
    return qs ? `/sales/customers?${qs}` : "/sales/customers";
  };
  const chipCls = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium transition ${
      active ? "bg-brand-500 text-white" : "bg-navy-50 text-navy-600 hover:bg-navy-100"
    }`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-navy-900">내 조직 고객</h1>
          <p className="mt-0.5 text-xs text-navy-500">
            총 {all.length}건 · 표시 {rows.length}건
            {activeOnly && " (진행중만)"}
          </p>
        </div>
        <Link
          href="/sales"
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-navy-500 hover:bg-navy-50"
        >
          ← 대시보드
        </Link>
      </div>

      {/* 검색 */}
      <form method="get" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="상호·대표자·연락처 검색"
          className="w-full rounded-lg border border-navy-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
        />
        {activeOnly && <input type="hidden" name="status" value="active" />}
        {stage && <input type="hidden" name="stage" value={stage} />}
        <button className="shrink-0 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
          검색
        </button>
      </form>

      {/* 단계 필터 칩 */}
      <div className="flex flex-wrap gap-2">
        <Link href={chipHref("")} className={chipCls(!stage)}>
          전체
        </Link>
        {STAGES.map((s) => (
          <Link key={s.key} href={chipHref(s.key)} className={chipCls(stage === s.key)}>
            {s.short}
          </Link>
        ))}
      </div>

      {/* 리스트 */}
      <div className="rounded-2xl border border-navy-100 bg-white">
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-navy-400">
            조건에 맞는 고객이 없습니다.
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
                {rows.map((c) => (
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
                      {c.sales_agent_id ? agentName.get(c.sales_agent_id) ?? "-" : "-"}
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
