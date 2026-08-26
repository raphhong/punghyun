import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { adminPath } from "@/lib/admin/config";
import {
  STAGE_MAP,
  stageLabel,
  type StageKey,
} from "@/lib/admin/pipeline";
import type { Customer } from "@/lib/admin/types";

function fmtDate(v: string | null) {
  return v ?? "-";
}

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
      "id, hospital_name, representative, phone, hospital_type, needed_funds, stage, source, intake_date, created_at",
    )
    .order("created_at", { ascending: false });

  if (stage && STAGE_MAP[stage as StageKey]) {
    query = query.eq("stage", stage);
  }

  const { data: customers, error } = await query;

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
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
        >
          + 고객 추가
        </Link>
      </div>

      {error && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          데이터를 불러오지 못했습니다. Supabase 설정을 확인하세요. ({error.message})
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-navy-100 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-navy-50 text-navy-500">
              <tr>
                <th className="px-4 py-3 font-medium">병원명</th>
                <th className="px-4 py-3 font-medium">대표자</th>
                <th className="px-4 py-3 font-medium">연락처</th>
                <th className="px-4 py-3 font-medium">유형</th>
                <th className="px-4 py-3 font-medium">필요자금</th>
                <th className="px-4 py-3 font-medium">단계</th>
                <th className="px-4 py-3 font-medium">인입일</th>
                <th className="px-4 py-3 font-medium">경로</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {customers?.map((c: Partial<Customer>) => (
                <tr key={c.id} className="hover:bg-navy-50">
                  <td className="px-4 py-3">
                    <Link
                      href={adminPath(`customers/${c.id}`)}
                      className="font-medium text-navy-900 hover:text-brand-600"
                    >
                      {c.hospital_name || "(미입력)"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-navy-600">
                    {c.representative || "-"}
                  </td>
                  <td className="px-4 py-3 text-navy-600">{c.phone || "-"}</td>
                  <td className="px-4 py-3 text-navy-600">
                    {c.hospital_type === "individual"
                      ? "개인"
                      : c.hospital_type === "corporate"
                        ? "법인"
                        : "-"}
                  </td>
                  <td className="px-4 py-3 text-navy-600">
                    {c.needed_funds || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-navy-100 px-2.5 py-1 text-xs font-medium text-navy-700">
                      {stageLabel(c.stage as StageKey)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-navy-600">
                    {fmtDate(c.intake_date ?? null)}
                  </td>
                  <td className="px-4 py-3 text-navy-500">
                    {c.source === "homepage" ? "공홈" : "수동"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(!customers || customers.length === 0) && !error && (
          <p className="px-4 py-12 text-center text-sm text-navy-400">
            해당 단계의 고객이 없습니다.
          </p>
        )}
      </div>
    </div>
  );
}
