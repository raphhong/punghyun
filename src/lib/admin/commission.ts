// 영업 수수료 계산 — 서버/클라 공용 순수 함수.
// 정책: 수수료 = 집행금액 × 수수료율(%). 율 = 건별 override ?? 최상위(root) 영업자 기본율.
// 지급은 렌탈료 완납 이후에만 대상(게이팅). 최상위 영업자에게만 귀속.

export type AgentNode = {
  id: string;
  parent_id: string | null;
  commission_rate: number | null;
};

// parent_id 체인을 따라 최상위(root) 영업자 id를 찾는다.
// ancestor_ids는 코드상 채워지지 않으므로 parent_id로 직접 상향 탐색.
export function rootAgentId(
  agentId: string,
  byId: Map<string, AgentNode>,
): string {
  let cur = byId.get(agentId);
  if (!cur) return agentId;
  const seen = new Set<string>([cur.id]); // 순환 방지
  while (cur.parent_id) {
    const parent = byId.get(cur.parent_id);
    if (!parent || seen.has(parent.id)) break;
    seen.add(parent.id);
    cur = parent;
  }
  return cur.id;
}

// 건별 수수료 총액. rate는 % 단위. base(집행금액) 없으면 0.
export function dealCommission(
  deal: { execution_amount: number | null; commission_rate: number | null },
  rootRate: number | null,
): { rate: number; total: number } {
  const rate = deal.commission_rate ?? rootRate ?? 0;
  const base = deal.execution_amount ?? 0;
  const total = Math.round((base * rate) / 100);
  return { rate, total };
}

// 렌탈료 완납 여부 — 수수료 지급 조건.
export function isRentalFullyPaid(c: {
  rental_months: number | null;
  paid_count: number | null;
}): boolean {
  return (
    c.rental_months != null &&
    c.rental_months > 0 &&
    (c.paid_count ?? 0) >= c.rental_months
  );
}
