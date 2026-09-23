import { createClient } from "@/lib/supabase/server";
import { adminPath } from "@/lib/admin/config";
import { fmtWon } from "@/lib/admin/payments";
import {
  dealCommission,
  isRentalFullyPaid,
  rootAgentId,
  type AgentNode,
} from "@/lib/admin/commission";
import { AgentRateInput } from "@/components/admin/AgentRateInput";
import { CommissionRow, type CommissionDeal } from "@/components/admin/CommissionRow";
import {
  recordCommissionPayment,
  setDealRate,
  updateAgentCommissionRate,
} from "./actions";

export const metadata = { title: "수수료 정산" };
// 값 변경(지급 기록·율)이 잦아 항상 최신 반영.
export const dynamic = "force-dynamic";

type DealRow = {
  id: string;
  hospital_name: string | null;
  sales_agent_id: string | null;
  execution_amount: number | null;
  commission_rate: number | null;
  commission_paid: number | null;
  rental_months: number | null;
  paid_count: number | null;
};
type AgentRow = AgentNode & { name: string };

type Group = {
  rootId: string | null; // null = 담당 영업자 미배정
  rootName: string;
  rootRate: number | null;
  deals: CommissionDeal[];
  totalSum: number;
  paidSum: number;
  remainingSum: number;
  payableNowSum: number;
};

export default async function CommissionsPage() {
  const supabase = await createClient();

  const [custRes, agentRes] = await Promise.all([
    supabase
      .from("customers")
      .select(
        "id, hospital_name, sales_agent_id, execution_amount, commission_rate, commission_paid, rental_months, paid_count",
      )
      .eq("contract_done", true),
    supabase
      .from("sales_agents")
      .select("id, name, parent_id, commission_rate"),
  ]);

  const deals = (custRes.data as DealRow[] | null) ?? [];
  const agents = (agentRes.data as AgentRow[] | null) ?? [];

  const byId = new Map<string, AgentNode>(
    agents.map((a) => [a.id, { id: a.id, parent_id: a.parent_id, commission_rate: a.commission_rate }]),
  );
  const nameById = new Map(agents.map((a) => [a.id, a.name]));

  // root 영업자별 그룹 구성
  const groups = new Map<string, Group>();
  const UNASSIGNED = "__unassigned__";

  for (const d of deals) {
    const rootId = d.sales_agent_id
      ? rootAgentId(d.sales_agent_id, byId)
      : null;
    const key = rootId ?? UNASSIGNED;
    const rootNode = rootId ? byId.get(rootId) : undefined;
    const rootRate = rootNode?.commission_rate ?? null;

    if (!groups.has(key)) {
      groups.set(key, {
        rootId,
        rootName: rootId ? nameById.get(rootId) ?? "(이름 없음)" : "담당 영업자 미배정",
        rootRate,
        deals: [],
        totalSum: 0,
        paidSum: 0,
        remainingSum: 0,
        payableNowSum: 0,
      });
    }
    const g = groups.get(key)!;

    const { rate, total } = dealCommission(d, rootRate);
    const paid = d.commission_paid ?? 0;
    const fullyPaid = isRentalFullyPaid(d);
    const remaining = Math.max(0, total - paid);
    const payableNow = fullyPaid ? remaining : 0;

    g.deals.push({
      customerId: d.id,
      hospitalName: d.hospital_name || "(상호 미입력)",
      href: adminPath(`customers/${d.id}`),
      executionAmount: d.execution_amount,
      overrideRate: d.commission_rate,
      appliedRate: rate,
      total,
      paid,
      fullyPaid,
      rentalMonths: d.rental_months,
      paidCount: d.paid_count ?? 0,
    });
    g.totalSum += total;
    g.paidSum += paid;
    g.remainingSum += remaining;
    g.payableNowSum += payableNow;
  }

  // 지급 시급한(지금 지급가능액 큰) 순 → 잔여 순
  const groupList = [...groups.values()].sort(
    (a, b) => b.payableNowSum - a.payableNowSum || b.remainingSum - a.remainingSum,
  );
  for (const g of groupList) {
    g.deals.sort((a, b) => {
      const pa = a.fullyPaid && a.total - a.paid > 0 ? 1 : 0;
      const pb = b.fullyPaid && b.total - b.paid > 0 ? 1 : 0;
      return pb - pa || b.total - a.total;
    });
  }

  const grandPayable = groupList.reduce((s, g) => s + g.payableNowSum, 0);
  const grandRemaining = groupList.reduce((s, g) => s + g.remainingSum, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">수수료 정산</h1>
        <p className="mt-1 text-sm text-navy-500">
          계약완료 건을 최상위 영업자별로 집계합니다. 수수료 = 집행금액 × 수수료율,
          렌탈료 완납 후 지급 대상.
        </p>
      </div>

      {/* 전체 요약 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <SummaryTile label="계약완료 건" value={`${deals.length}건`} />
        <SummaryTile
          label="지금 지급가능 (완납)"
          value={fmtWon(grandPayable)}
          highlight
        />
        <SummaryTile label="총 잔여 수수료" value={fmtWon(grandRemaining)} />
      </div>

      {groupList.length === 0 ? (
        <p className="rounded-2xl border border-navy-100 bg-white px-5 py-12 text-center text-sm text-navy-400">
          계약완료된 건이 없습니다. 고객 진행 단계에서 &quot;계약 완료&quot;를 체크하면
          여기에 집계됩니다.
        </p>
      ) : (
        <div className="space-y-5">
          {groupList.map((g) => (
            <section
              key={g.rootId ?? UNASSIGNED}
              className="overflow-hidden rounded-2xl border border-navy-100 bg-white"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-100 bg-navy-50/60 px-4 py-3">
                <div className="flex items-center gap-3">
                  <h2 className="font-semibold text-navy-900">{g.rootName}</h2>
                  {g.rootId ? (
                    <AgentRateInput
                      agentId={g.rootId}
                      rate={g.rootRate}
                      action={updateAgentCommissionRate}
                    />
                  ) : (
                    <span className="text-xs text-amber-600">
                      담당 영업자를 지정하면 수수료가 귀속됩니다.
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-navy-500">
                  <span>총 {fmtWon(g.totalSum)}</span>
                  <span>지급 {fmtWon(g.paidSum)}</span>
                  <span>잔여 {fmtWon(g.remainingSum)}</span>
                  <span className="font-semibold text-brand-700">
                    지급가능 {fmtWon(g.payableNowSum)}
                  </span>
                </div>
              </div>
              <div className="divide-y divide-navy-100">
                {g.deals.map((deal) => (
                  <CommissionRow
                    key={deal.customerId}
                    deal={deal}
                    recordAction={recordCommissionPayment}
                    rateAction={setDealRate}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight ? "border-brand-200 bg-brand-50/50" : "border-navy-100 bg-white"
      }`}
    >
      <p className="text-xs text-navy-500">{label}</p>
      <p
        className={`mt-1.5 text-xl font-bold ${
          highlight ? "text-brand-700" : "text-navy-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
