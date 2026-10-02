import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { adminPath } from "@/lib/admin/config";
import { STAGES, stageLabel, type StageKey } from "@/lib/admin/pipeline";
import { daysBetween, dueLabel, nextDue, todayISO } from "@/lib/admin/payments";
import { PaymentInbox, type PendingRow } from "@/components/admin/PaymentInbox";
import type { CashMovement } from "@/lib/admin/cashflow-write";
import type { Customer } from "@/lib/admin/types";

// 인박스에 노출할 임박 범위(일). 연체는 항상 포함.
const INBOX_WINDOW_DAYS = 14;

export default async function DashboardPage() {
  const supabase = await createClient();
  const claims = await supabase.auth.getClaims();
  const uid = claims.data?.claims?.sub;
  const access = uid ? await supabase.from("admins").select("user_id").eq("user_id", uid).maybeSingle() : null;
  const canViewCashflow = Boolean(access && !access.error && access.data);

  const { data: rows } = await supabase.from("customers").select("stage");
  const counts: Record<string, number> = {};
  for (const s of STAGES) counts[s.key] = 0;
  rows?.forEach((r) => {
    counts[r.stage as string] = (counts[r.stage as string] ?? 0) + 1;
  });
  const total = rows?.length ?? 0;

  // Finance sources are read only after explicit admin proof. Paginate to avoid
  // silently dropping receipts or customers beyond PostgREST's default limit.
  let schedRows: Customer[] = [];
  const receiptsByCustomer = new Map<string, CashMovement[]>();
  let inboxError: string | null = null;
  if (canViewCashflow) {
    try {
      for (let from = 0; ; from += 500) {
        const result = await supabase.from("customers").select("*")
          .not("first_payment_date", "is", null).order("id").range(from, from + 499);
        if (result.error || !result.data) { inboxError = "납부 일정을 확인하지 못해 입금 인박스를 표시할 수 없습니다."; break; }
        schedRows.push(...result.data as Customer[]);
        if (result.data.length < 500) break;
      }
      if (!inboxError) {
        for (let from = 0; ; from += 500) {
          const result = await supabase.from("cashflow_movements").select("*")
            .eq("kind", "rental_receipt").eq("basis", "actual").order("id").range(from, from + 499);
          if (result.error || !result.data) { inboxError = "실제 수납 원장을 확인하지 못해 미납 상태를 확정할 수 없습니다. 현금흐름에서 원장 준비 상태를 확인해 주세요."; break; }
          for (const receipt of result.data as CashMovement[]) {
            const existing = receiptsByCustomer.get(receipt.customer_id) ?? [];
            existing.push(receipt); receiptsByCustomer.set(receipt.customer_id, existing);
          }
          if (result.data.length < 500) break;
        }
      }
    } catch { inboxError = "납부 일정 또는 수납 원장 연결을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요."; }
  }
  if (inboxError) schedRows = [];

  const today = todayISO();
  const inbox: PendingRow[] = [];
  for (const c of schedRows) {
    // Legacy receipt-ledger allocations require reconciliation; neither a
    // movement nor paid_count can establish an authoritative inbox status.
    if (c.receipt_ledger != null) continue;
    const due = nextDue(
      {
        first_payment_date: c.first_payment_date ?? null,
        rental_months: c.rental_months ?? null,
        paid_count: c.paid_count ?? 0,
        rental_price: c.rental_price ?? null,
        payment_schedule: c.payment_schedule,
        rental_receipts: c.receipt_ledger != null ? [] : receiptsByCustomer.get(c.id) ?? [],
      },
      today,
    );
    if (!due) continue;
    const diff = daysBetween(today, due.dueDate);
    if (diff > INBOX_WINDOW_DAYS) continue; // 아직 먼 예정은 제외 (연체=음수는 포함)
    inbox.push({
      id: c.id as string,
      hospitalName: c.hospital_name || "(상호 미입력)",
      href: adminPath(`customers/${c.id}`),
      no: due.no,
      total: c.rental_months ?? due.no,
      dueDate: due.dueDate,
      amount: due.amount,
      status: due.status,
      label: dueLabel(due.dueDate, today),
    });
  }
  // 연체(예정일 이른) 순으로 정렬
  inbox.sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));

  const { data: recent } = await supabase
    .from("customers")
    .select("id, hospital_name, representative, stage, created_at, source")
    .order("created_at", { ascending: false })
    .limit(8);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">대시보드</h1>
          <p className="mt-1 text-sm text-navy-500">
            전체 고객 {total}명의 진행 현황
          </p>
        </div>
        <Link
          href={adminPath("customers/new")}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
        >
          + 고객 추가
        </Link>
      </div>

      {/* 렌탈료 입금 인박스 — 오늘/연체/임박 회차 */}
      {canViewCashflow && <Link href={adminPath("cashflow")} className="block rounded-xl border border-brand-200 bg-white p-5 text-brand-600 hover:bg-brand-50">
        <span className="font-semibold">월별 현금흐름 보기 →</span>
        <span className="mt-1 block text-sm">누적 집행액 · 렌탈료 수납 · 채권사 지급 · 유동화 유입</span>
      </Link>}
      {canViewCashflow && schedRows.some(customer => customer.receipt_ledger != null) && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">기존 수납원장이 있는 고객은 원장 대조가 필요합니다. 수납 상태를 확정할 수 없어 아래 인박스 대상에서 제외했습니다.</p>}
      {canViewCashflow && (inboxError ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{inboxError}</p> : <PaymentInbox items={inbox} />)}

      {/* 단계별 카드 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {STAGES.map((s) => (
          <Link
            key={s.key}
            href={`${adminPath("customers")}?stage=${s.key}`}
            className="rounded-xl border border-navy-100 bg-white p-4 transition-shadow hover:shadow-md"
          >
            <p className="text-sm text-navy-500">{s.label}</p>
            <p className="mt-2 text-2xl font-bold text-navy-900">
              {counts[s.key] ?? 0}
            </p>
          </Link>
        ))}
      </div>

      {/* 최근 인입 */}
      <div className="rounded-2xl border border-navy-100 bg-white">
        <div className="flex items-center justify-between border-b border-navy-100 px-5 py-4">
          <h2 className="font-semibold text-navy-900">최근 인입 고객</h2>
          <Link
            href={adminPath("customers")}
            className="text-sm font-medium text-brand-600 hover:underline"
          >
            전체 보기
          </Link>
        </div>
        {recent && recent.length > 0 ? (
          <ul className="divide-y divide-navy-100">
            {recent.map((c: Partial<Customer>) => (
              <li key={c.id}>
                <Link
                  href={adminPath(`customers/${c.id}`)}
                  className="flex items-center justify-between px-5 py-3 hover:bg-navy-50"
                >
                  <div>
                    <p className="font-medium text-navy-900">
                      {c.hospital_name || "(상호 미입력)"}
                    </p>
                    <p className="text-sm text-navy-500">
                      {c.representative || "-"} ·{" "}
                      {c.source === "homepage" ? "공홈" : "수동"}
                    </p>
                  </div>
                  <span className="rounded-full bg-navy-100 px-3 py-1 text-xs font-medium text-navy-700">
                    {stageLabel(c.stage as StageKey)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-10 text-center text-sm text-navy-400">
            아직 등록된 고객이 없습니다. 우측 상단의 &quot;고객 추가&quot;로
            시작하세요.
          </p>
        )}
      </div>
    </div>
  );
}
