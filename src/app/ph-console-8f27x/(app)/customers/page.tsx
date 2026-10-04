import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CustomerTable } from "@/components/admin/CustomerTable";
import { Feedback } from "@/components/ui/Feedback";
import { adminPath } from "@/lib/admin/config";
import {
  STAGE_MAP,
  stageLabel,
  type StageKey,
} from "@/lib/admin/pipeline";
import type { Customer } from "@/lib/admin/types";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  const { stage } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("customers")
    .select(
      "id, hospital_name, representative, phone, hospital_type, needed_funds, stage, source, intake_date, created_at, sales_agent_id",
    )
    .order("created_at", { ascending: false });

  if (stage && STAGE_MAP[stage as StageKey]) {
    query = query.eq("stage", stage);
  }

  const [{ data: customers, error }, agentRes] = await Promise.all([
    query,
    supabase.from("sales_agents").select("id, name"),
  ]);

  const agentName = new Map(
    ((agentRes.data as { id: string; name: string }[] | null) ?? []).map((a) => [
      a.id,
      a.name,
    ]),
  );

  const title = stage ? stageLabel(stage as StageKey) : "전체 고객";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">{title}</h1>
          <p className="mt-1 text-sm text-navy-500">
            {customers?.length ?? 0}건
          </p>
        </div>
        <Link
          href={adminPath("customers/new")}
          className="ph-button ph-button--primary"
        >
          + 고객 추가
        </Link>
      </div>

      {error && (
        <Feedback tone="warning" urgent>
          데이터를 불러오지 못했습니다. Supabase 설정을 확인하세요. ({error.message})
        </Feedback>
      )}

      <CustomerTable customers={(customers ?? []) as Partial<Customer>[]} agentName={agentName} failed={!!error} />
    </div>
  );
}
