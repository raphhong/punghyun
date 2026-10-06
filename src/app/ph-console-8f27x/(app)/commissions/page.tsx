import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminPath } from "@/lib/admin/config";
import { STAGES, type StageKey } from "@/lib/admin/pipeline";
import {
  fmtWon,
  todayISO,
  type RentalReceiptMovement,
} from "@/lib/admin/payments";
import { commissionRentalStatus } from "@/lib/admin/commission-rental";
import {
  dealCommission,
  rootAgentId,
  type AgentNode,
} from "@/lib/admin/commission";
import { AgentRateInput } from "@/components/admin/AgentRateInput";
import {
  CommissionRow,
  type CommissionDeal,
} from "@/components/admin/CommissionRow";
import {
  recordCommissionPayment,
  setDealRate,
  updateAgentCommissionRate,
} from "./actions";

export const metadata = { title: "수수료 정산" };
export const dynamic = "force-dynamic";

// 계약 단계 이상 = 수수료 대상 (계약 완료 체크와 무관하게 단계로 판정)
const CONTRACT_IDX = STAGES.findIndex((s) => s.key === "contract");
const COMPLETED_STAGES = STAGES.slice(CONTRACT_IDX).map((s) => s.key);

type DealRow = {
  id: string;
  hospital_name: string | null;
  stage: StageKey;
  sales_agent_id: string | null;
  execution_amount: number | null;
  commission_rate: number | null;
  commission_paid: number | null;
  first_payment_date: string | null;
  rental_months: number | null;
  paid_count: number | null;
  rental_price: number | null;
  payment_schedule?: unknown;
  receipt_ledger?: unknown;
};
type AgentRow = AgentNode & { name: string };
type ReceiptRow = RentalReceiptMovement & { customer_id: string };

type Group = {
  rootId: string | null;
  rootName: string;
  rootRate: number | null;
  deals: CommissionDeal[];
  totalSum: number;
  paidSum: number;
  remainingSum: number;
};

export default async function CommissionsPage() {
  const supabase = await createClient();
  let uid: string | undefined;
  let authenticationFailed = false;
  try {
    const claims = await supabase.auth.getClaims();
    authenticationFailed = Boolean(claims.error);
    uid = claims.data?.claims?.sub;
  } catch {
    authenticationFailed = true;
  }
  if (authenticationFailed) return <p role="alert">수수료 정산을 조회할 관리자 권한을 확인할 수 없습니다.</p>;
  if (!uid) redirect(adminPath("login"));
  let isAdmin = false;
  try {
    const admin = await supabase.from("admins").select("user_id").eq("user_id", uid).maybeSingle();
    // The layout's compatibility fallback is not proof of finance access.
    isAdmin = !admin.error && Boolean(admin.data);
  } catch {
    isAdmin = false;
  }
  if (!isAdmin) return <p role="alert">수수료 정산을 조회할 관리자 권한을 확인할 수 없습니다.</p>;

  async function readAll<T>(table: "customers" | "sales_agents" | "cashflow_movements"): Promise<{ rows: T[]; failed: boolean }> {
    const rows: T[] = [];
    try {
      for (let from = 0; ; from += 500) {
        let query = supabase.from(table).select(table === "sales_agents" ? "id, name, parent_id, commission_rate" : "*");
        if (table === "customers") query = query.in("stage", COMPLETED_STAGES);
        if (table === "cashflow_movements") query = query.eq("kind", "rental_receipt").eq("basis", "actual");
        const result = await query.order("id").range(from, from + 499);
        // Discard partial results: a later failed page cannot prove non-payment.
        if (result.error || !result.data) return { rows: [], failed: true };
        rows.push(...result.data as T[]);
        if (result.data.length < 500) return { rows, failed: false };
      }
    } catch {
      return { rows: [], failed: true };
    }
  }
  const [custRes, agentRes, receiptRes] = await Promise.all([
    readAll<DealRow>("customers"),
    readAll<AgentRow>("sales_agents"),
    readAll<ReceiptRow>("cashflow_movements"),
  ]);
  if (custRes.failed || agentRes.failed) return <p role="alert">수수료 정산 자료를 조회하지 못했습니다. 잠시 후 다시 시도해 주세요.</p>;

  const deals = custRes.rows;
  const agents = agentRes.rows;
  const receiptsByCustomer = new Map<string, ReceiptRow[]>();
  for (const receipt of receiptRes.rows) {
    const receipts = receiptsByCustomer.get(receipt.customer_id) ?? [];
    receipts.push(receipt);
    receiptsByCustomer.set(receipt.customer_id, receipts);
  }
  const today = todayISO();

  const byId = new Map<string, AgentNode>(
    agents.map((a) => [a.id, { id: a.id, parent_id: a.parent_id, commission_rate: a.commission_rate }]),
  );
  const nameById = new Map(agents.map((a) => [a.id, a.name]));

  const groups = new Map<string, Group>();
  const UNASSIGNED = "__unassigned__";

  for (const d of deals) {
    const rootId = d.sales_agent_id ? rootAgentId(d.sales_agent_id, byId) : null;
    const key = rootId ?? UNASSIGNED;
    const rootRate = (rootId ? byId.get(rootId)?.commission_rate : null) ?? null;

    if (!groups.has(key)) {
      groups.set(key, {
        rootId,
        rootName: rootId ? nameById.get(rootId) ?? "(이름 없음)" : "담당 영업자 미배정",
        rootRate,
        deals: [],
        totalSum: 0,
        paidSum: 0,
        remainingSum: 0,
      });
    }
    const g = groups.get(key)!;

    const { rate, total } = dealCommission(d, rootRate);
    const paid = d.commission_paid ?? 0;
    const remaining = Math.max(0, total - paid);
    const rental = commissionRentalStatus({ ...d, rental_receipts: receiptsByCustomer.get(d.id) ?? [] }, today, !receiptRes.failed);

    g.deals.push({
      customerId: d.id,
      hospitalName: d.hospital_name || "(상호 미입력)",
      href: adminPath(`customers/${d.id}`),
      executionAmount: d.execution_amount,
      overrideRate: d.commission_rate,
      appliedRate: rate,
      total,
      paid,
      rentalStatus: rental.status,
      rentalDetail: rental.detail,
    });
    g.totalSum += total;
    g.paidSum += paid;
    g.remainingSum += remaining;
  }

  // 미지급 잔여 큰 순 (지급할 게 많은 영업자 먼저)
  const groupList = [...groups.values()].sort(
    (a, b) => b.remainingSum - a.remainingSum || b.totalSum - a.totalSum,
  );
  for (const g of groupList) {
    // 미지급(잔여>0) 먼저, 그다음 총액 큰 순
    g.deals.sort((a, b) => {
      const ra = a.total - a.paid > 0 ? 1 : 0;
      const rb = b.total - b.paid > 0 ? 1 : 0;
      return rb - ra || b.total - a.total;
    });
  }

  const grandTotal = groupList.reduce((s, g) => s + g.totalSum, 0);
  const grandPaid = groupList.reduce((s, g) => s + g.paidSum, 0);
  const grandRemaining = groupList.reduce((s, g) => s + g.remainingSum, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">수수료 정산</h1>
        <p className="mt-1 text-sm text-navy-500">
          계약 단계 이상 건을 최상위 영업자별로 집계합니다. 수수료 = 집행금액 × 수수료율,
          계약 시 선지급 · 문제 발생 시 회수.
        </p>
      </div>

      {/* 전체 요약 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile label="대상 건" value={`${deals.length}건`} />
        <SummaryTile label="총 수수료" value={fmtWon(grandTotal)} />
        <SummaryTile label="기지급" value={fmtWon(grandPaid)} />
        <SummaryTile label="미지급 잔여" value={fmtWon(grandRemaining)} highlight />
      </div>

      {groupList.length === 0 ? (
        <p className="rounded-2xl border border-navy-100 bg-white px-5 py-12 text-center text-sm text-navy-400">
          계약 단계 이상으로 진행된 건이 없습니다. 고객을 &quot;계약&quot; 단계로 넘기면
          여기에 자동으로 집계됩니다.
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
                  <span className="font-semibold text-navy-800">
                    잔여 {fmtWon(g.remainingSum)}
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
        className={`mt-1.5 text-lg font-bold ${
          highlight ? "text-brand-700" : "text-navy-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
