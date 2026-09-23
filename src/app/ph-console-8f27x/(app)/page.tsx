import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { adminPath } from "@/lib/admin/config";
import { STAGES, stageLabel, type StageKey } from "@/lib/admin/pipeline";
import { daysBetween, dueLabel, nextDue, todayISO } from "@/lib/admin/payments";
import { PaymentInbox, type PendingRow } from "@/components/admin/PaymentInbox";
import { setPaidCount } from "./customers/actions";
import type { Customer } from "@/lib/admin/types";

// 인박스에 노출할 임박 범위(일). 연체는 항상 포함.
const INBOX_WINDOW_DAYS = 14;

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase.from("customers").select("stage");
  const counts: Record<string, number> = {};
  for (const s of STAGES) counts[s.key] = 0;
  rows?.forEach((r) => {
    counts[r.stage as string] = (counts[r.stage as string] ?? 0) + 1;
  });
  const total = rows?.length ?? 0;

  // 렌탈료 입금 인박스 — 첫 입금일이 설정된 건의 다음 미납 회차 중 연체·임박만.
  const { data: schedRows } = await supabase
    .from("customers")
    .select(
      "id, hospital_name, first_payment_date, rental_months, paid_count, rental_price",
    )
    .not("first_payment_date", "is", null);

  const today = todayISO();
  const inbox: PendingRow[] = [];
  for (const c of (schedRows as Partial<Customer>[] | null) ?? []) {
    const due = nextDue(
      {
        first_payment_date: c.first_payment_date ?? null,
        rental_months: c.rental_months ?? null,
        paid_count: c.paid_count ?? 0,
        rental_price: c.rental_price ?? null,
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
      <PaymentInbox items={inbox} action={setPaidCount} />

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
