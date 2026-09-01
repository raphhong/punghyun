import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Customer } from "@/lib/admin/types";
import { EditableContract } from "@/components/admin/EditableContract";
import {
  buildContractView,
  clausesFor,
  isContractType,
  partiesFor,
  type Party,
} from "@/lib/admin/contracts";

export default async function ContractPrintPage({
  params,
}: {
  params: Promise<{ id: string; type: string }>;
}) {
  const { id, type } = await params;
  if (!isContractType(type)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();

  const customer = data as Customer;
  const v = buildContractView(type, customer);
  const clauses = clausesFor(type, v);
  const [partyA, partyB] = partiesFor(type, v);
  const isDoc = type === "delivery" || type === "inspection"; // 확인서 성격

  return (
    <>
      {/* 인쇄 여백 · 화면/인쇄 표시 제어 */}
      <style>{`
        @page { size: A4; margin: 18mm; }
        @media print {
          .no-print { display: none !important; }
          .sheet { box-shadow: none !important; margin: 0 !important; padding: 0 !important; }
        }
      `}</style>

      <EditableContract
        subtitle={`${v.meta.title} · ${customer.hospital_name ?? "(미입력)"}`}
        fileName={`${v.meta.title}_${customer.hospital_name ?? "고객"}`}
      >
        <h1 className="mb-1 text-center text-2xl font-bold tracking-wide">{v.meta.title}</h1>
        <p className="mb-8 text-center text-xs text-neutral-500">
          {isDoc
            ? "본 확인서는 진정한 매매 및 임대차의 이행을 확인하기 위한 문서입니다."
            : "본 계약은 매매계약과 임대차계약을 형식·내용상 독립하여 체결하는 세일앤렌탈백 거래의 일부입니다."}
        </p>

        {/* 당사자 표시 */}
        <div className="mb-8 grid grid-cols-2 gap-4 text-sm">
          <PartyBox p={partyA} />
          <PartyBox p={partyB} />
        </div>

        {/* 조항 */}
        <div className="space-y-4 text-[13px] leading-relaxed">
          {clauses.map((cl) => (
            <section key={cl.title}>
              <h2 className="mb-1 font-bold">{cl.title}</h2>
              <p className="whitespace-pre-line text-neutral-800">{cl.body}</p>
            </section>
          ))}
        </div>

        {/* 체결일 */}
        <p className="mt-10 text-center text-sm">{v.today}</p>

        {/* 서명란 */}
        <div className="mt-6 grid grid-cols-2 gap-8 text-sm">
          <SignBox p={partyA} />
          <SignBox p={partyB} />
        </div>

        {/* 연대보증 서명 (렌탈만) */}
        {type === "rental" && (
          <div className="mt-8 border-t border-neutral-200 pt-4 text-sm">
            <p className="mb-2 font-bold">연대보증인</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-neutral-700">
              <p>성명: {v.blank} (서명 또는 인)</p>
              <p>생년월일: {v.blank}</p>
              <p>주소: {v.blank}</p>
              <p>연락처: {v.blank}</p>
            </div>
          </div>
        )}

        {/* 검수 안내 */}
        <p className="mt-10 border-t border-dashed border-neutral-300 pt-3 text-center text-[11px] text-neutral-400">
          ⚠️ 본 문서는 실무 초안이며, 실제 사용 전 반드시 변호사 검수를 받으시기 바랍니다.
        </p>
      </EditableContract>
    </>
  );
}

function PartyBox({ p }: { p: Party }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-3">
      <p className="mb-1 text-xs font-bold text-neutral-500">{p.role}</p>
      <dl className="space-y-0.5 text-[13px]">
        <Row k="상호" v={p.name} />
        <Row k="대표자" v={p.ceo} />
        <Row k="주소" v={p.address} />
        <Row k="연락처" v={p.contact} />
      </dl>
    </div>
  );
}

function SignBox({ p }: { p: Party }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold text-neutral-500">{p.role}</p>
      <p className="text-[13px]">상호: {p.name}</p>
      <p className="mt-1 text-[13px]">대표자: {p.ceo} (서명 또는 인)</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-14 shrink-0 text-neutral-400">{k}</dt>
      <dd className="flex-1 text-neutral-800">{v}</dd>
    </div>
  );
}
