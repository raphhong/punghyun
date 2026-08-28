import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { site } from "@/lib/site";
import { ShareLink } from "@/components/admin/ShareLink";
import { AdminDocUpload } from "@/components/admin/AdminDocUpload";
import { adminPath } from "@/lib/admin/config";
import {
  HOSPITAL_TYPES,
  MATURITY_RESULTS,
  SCREENING_2_DOCS,
  SCREENING_3_DOCS,
  STAGES,
  nextStage,
  prevStage,
  stageLabel,
  type DocItem,
  type StageKey,
} from "@/lib/admin/pipeline";
import type { Customer, CustomerDocument } from "@/lib/admin/types";
import {
  deleteCustomer,
  moveStage,
  setStage,
  toggleDocument,
  updateBasic,
  updatePipeline,
} from "../actions";

export const metadata = { title: "고객 상세" };

const inputCls =
  "mt-1.5 w-full rounded-lg border border-navy-200 bg-white px-3 py-2.5 text-sm text-navy-900 placeholder:text-navy-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20";
const labelCls = "block text-sm font-medium text-navy-700";

function Card({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-navy-100 bg-white p-6">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-navy-900">{title}</h2>
        {desc && <p className="mt-0.5 text-sm text-navy-500">{desc}</p>}
      </div>
      {children}
    </section>
  );
}

function Check({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-2.5 text-sm text-navy-700">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-navy-300 text-brand-500 focus:ring-brand-500/30"
      />
      {label}
    </label>
  );
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single<Customer>();

  if (!customer) notFound();

  const { data: docRows } = await supabase
    .from("customer_documents")
    .select("*")
    .eq("customer_id", id);

  const docs = (docRows ?? []) as CustomerDocument[];
  const docMap = new Map(docs.map((d) => [d.doc_key, d]));

  const stage = customer.stage as StageKey;
  const next = nextStage(stage, customer.source);
  const prev = prevStage(stage);

  const updateBasicAction = updateBasic.bind(null, id);
  const updatePipelineAction = updatePipeline.bind(null, id);

  // 실제 접속 도메인 기준으로 공유 링크 생성 (site.url 미연결 도메인 회피)
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const baseUrl = host ? `${proto}://${host}` : site.url;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={adminPath("customers")}
            className="text-sm text-navy-500 hover:text-navy-800"
          >
            ← 목록
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-navy-900">
            {customer.hospital_name || "(상호 미입력)"}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-navy-500">
            <span className="rounded-full bg-navy-100 px-2.5 py-1 text-xs font-medium text-navy-700">
              {stageLabel(stage)}
            </span>
            <span>{customer.source === "homepage" ? "공홈 인입" : "수동 등록"}</span>
          </p>
        </div>

        {/* 단계 이동 */}
        <div className="flex items-center gap-2">
          {prev && (
            <form action={moveStage}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="direction" value="prev" />
              <input type="hidden" name="current" value={stage} />
              <input type="hidden" name="source" value={customer.source} />
              <button className="rounded-lg border border-navy-200 px-3 py-2 text-sm font-medium text-navy-600 hover:bg-navy-50">
                ← {stageLabel(prev)}
              </button>
            </form>
          )}
          {next && (
            <form action={moveStage}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="direction" value="next" />
              <input type="hidden" name="current" value={stage} />
              <input type="hidden" name="source" value={customer.source} />
              <button className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600">
                {stageLabel(next)} →
              </button>
            </form>
          )}
        </div>
      </div>

      {/* 단계 직접 이동 */}
      <form
        action={setStage}
        className="flex flex-wrap items-center gap-2 rounded-xl border border-navy-100 bg-white px-4 py-3"
      >
        <input type="hidden" name="id" value={id} />
        <span className="text-sm text-navy-500">단계 직접 변경</span>
        <select name="stage" defaultValue={stage} className="rounded-lg border border-navy-200 px-3 py-1.5 text-sm">
          {STAGES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <button className="rounded-lg border border-navy-200 px-3 py-1.5 text-sm font-medium text-navy-600 hover:bg-navy-50">
          적용
        </button>
      </form>

      {/* 영업자 제출 링크 */}
      <Card
        title="영업자 제출 링크"
        desc="이 링크를 영업자에게 전달하면, 로그인 없이 기본정보·서류를 올릴 수 있습니다."
      >
        <ShareLink url={`${baseUrl}/s/${customer.share_token}`} />
      </Card>

      {/* 기본 정보 */}
      <form action={updateBasicAction} className="space-y-6">
        <Card title="기본 정보" desc="인입 · 스크리닝 1차">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>상호(업체명)</label>
              <input name="hospital_name" defaultValue={customer.hospital_name ?? ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>대표자</label>
              <input name="representative" defaultValue={customer.representative ?? ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>연락처</label>
              <input name="phone" defaultValue={customer.phone ?? ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>이메일</label>
              <input name="email" type="email" defaultValue={customer.email ?? ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>고객 유형</label>
              <select name="hospital_type" defaultValue={customer.hospital_type ?? ""} className={inputCls}>
                <option value="">선택</option>
                {HOSPITAL_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>필요자금</label>
              <input name="needed_funds" defaultValue={customer.needed_funds ?? ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>인입일자</label>
              <input name="intake_date" type="date" defaultValue={customer.intake_date ?? ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>계약일자</label>
              <input name="contract_date" type="date" defaultValue={customer.contract_date ?? ""} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>만기일자</label>
              <input name="maturity_date" type="date" defaultValue={customer.maturity_date ?? ""} className={inputCls} />
            </div>
          </div>
        </Card>

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-brand-600"
          >
            기본 정보 저장
          </button>
        </div>
      </form>

      {/* 서류 체크리스트 (기본정보 다음) */}
      <Card title="2차 서류 (스크리닝 2)" desc="필수 서류 수집">
        <DocList docs={SCREENING_2_DOCS} customerId={id} docMap={docMap} />
      </Card>

      <Card title="3차 서류 (스크리닝 3)" desc="기기 사진 · 정보 수집">
        <DocList docs={SCREENING_3_DOCS} customerId={id} docMap={docMap} />
      </Card>

      {/* 진행 단계 */}
      <form action={updatePipelineAction} className="space-y-6">
        <Card title="실사 및 구조설계" desc="실사 일정 · 집행/렌탈가 · 내부 심의">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>실사 일정</label>
              <input name="inspection_date" type="date" defaultValue={customer.inspection_date ?? ""} className={inputCls} />
            </div>
            <div className="hidden sm:block" />
            <div>
              <label className={labelCls}>집행금액 (원)</label>
              <input name="execution_amount" inputMode="numeric" defaultValue={customer.execution_amount ?? ""} className={inputCls} placeholder="예: 300000000" />
            </div>
            <div>
              <label className={labelCls}>렌탈가 (원)</label>
              <input name="rental_price" inputMode="numeric" defaultValue={customer.rental_price ?? ""} className={inputCls} placeholder="예: 5000000" />
            </div>
          </div>
          <div className="mt-4">
            <Check name="internal_review_done" label="내부 심의 완료" defaultChecked={customer.internal_review_done} />
          </div>
        </Card>

        <Card title="계약 · 자금집행">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <p className="text-sm font-medium text-navy-700">계약</p>
              <Check name="contract_sent" label="계약서 전송 완료" defaultChecked={customer.contract_sent} />
              <Check name="contract_done" label="계약 완료" defaultChecked={customer.contract_done} />
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium text-navy-700">자금집행</p>
              <div>
                <label className={labelCls}>집행 예정 일자</label>
                <input name="funding_scheduled_date" type="date" defaultValue={customer.funding_scheduled_date ?? ""} className={inputCls} />
              </div>
              <Check name="funding_done" label="집행 완료" defaultChecked={customer.funding_done} />
              <div>
                <label className={labelCls}>집행 완료 일자</label>
                <input name="funding_done_date" type="date" defaultValue={customer.funding_done_date ?? ""} className={inputCls} />
              </div>
            </div>
          </div>
        </Card>

        <Card title="운영관리 · 만기처리">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <p className="text-sm font-medium text-navy-700">회차 납부</p>
              <Check name="payment_1" label="1회차 납부" defaultChecked={customer.payment_1} />
              <Check name="payment_2" label="2회차 납부" defaultChecked={customer.payment_2} />
              <Check name="payment_3" label="3회차 납부" defaultChecked={customer.payment_3} />
              <Check name="unpaid" label="미납" defaultChecked={customer.unpaid} />
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium text-navy-700">만기 결과</p>
              <select name="maturity_result" defaultValue={customer.maturity_result ?? ""} className={inputCls}>
                <option value="">선택</option>
                {MATURITY_RESULTS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        <Card title="내부메모">
          <textarea name="internal_memo" rows={4} defaultValue={customer.internal_memo ?? ""} className={inputCls} />
        </Card>

        <div className="sticky bottom-4 flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-brand-600"
          >
            진행 단계 저장
          </button>
        </div>
      </form>

      {/* 위험 구역 */}
      <Card title="고객 삭제" desc="이 작업은 되돌릴 수 없습니다.">
        <form action={deleteCustomer}>
          <input type="hidden" name="id" value={id} />
          <button className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100">
            고객 삭제
          </button>
        </form>
      </Card>
    </div>
  );
}

function DocList({
  docs,
  customerId,
  docMap,
}: {
  docs: DocItem[];
  customerId: string;
  docMap: Map<string, CustomerDocument>;
}) {
  return (
    <ul className="divide-y divide-navy-100">
      {docs.map((doc) => {
        const row = docMap.get(doc.key);
        const checked = row?.checked ?? false;
        return (
          <li key={doc.key} className="flex flex-wrap items-center gap-3 py-3">
            <form action={toggleDocument} className="flex items-center">
              <input type="hidden" name="customer_id" value={customerId} />
              <input type="hidden" name="doc_key" value={doc.key} />
              <input type="hidden" name="category" value={doc.category} />
              {/* 현재 상태의 반대로 토글: 체크돼있으면 checked 미전송 → false */}
              {!checked && <input type="hidden" name="checked" value="1" />}
              <button
                className={`flex h-5 w-5 items-center justify-center rounded border ${
                  checked
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "border-navy-300 bg-white text-transparent"
                }`}
                aria-label="토글"
              >
                ✓
              </button>
            </form>

            <span className={`flex-1 text-sm ${checked ? "text-navy-800" : "text-navy-500"}`}>
              {doc.label}
              {row?.file_path && (
                <span className="ml-2 text-xs text-brand-600">· 파일 업로드됨</span>
              )}
            </span>

            <AdminDocUpload
              customerId={customerId}
              docKey={doc.key}
              category={doc.category}
            />
          </li>
        );
      })}
    </ul>
  );
}
