import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  ALL_DOCS,
  HOSPITAL_TYPES,
  SCREENING_2_DOCS,
  SCREENING_3_DOCS,
  docsForType,
  stageLabel,
  type DocItem,
} from "@/lib/admin/pipeline";
import type { Customer, CustomerDocument } from "@/lib/admin/types";
import { ShareLink } from "@/components/admin/ShareLink";
import { ShareMessage } from "@/components/admin/ShareMessage";
import { SalesDocUpload } from "@/components/sales/SalesDocUpload";
import {
  deleteSalesCustomer,
  salesDeleteDocument,
  updateSalesCustomer,
} from "@/app/sales/actions";

const inputCls =
  "w-full rounded-lg border border-navy-200 px-3 py-2 text-sm outline-none focus:border-brand-400";
const labelCls = "text-xs text-navy-500";

export default async function SalesCustomerDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // RLS: 내 서브트리 고객만 조회 가능
  const [customerRes, docsRes] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).maybeSingle<Customer>(),
    supabase.from("customer_documents").select("*").eq("customer_id", id),
  ]);

  const customer = customerRes.data;
  if (!customer) notFound();

  const docs = (docsRes.data as CustomerDocument[] | null) ?? [];
  const docMap = new Map(docs.map((d) => [d.doc_key, d]));

  // 서명 다운로드 URL
  const filePaths = docs
    .map((d) => d.file_path)
    .filter((p): p is string => !!p);
  const signedMap = new Map<string, string>();
  if (filePaths.length) {
    const { data: signed } = await supabase.storage
      .from("customer-docs")
      .createSignedUrls(filePaths, 3600);
    for (const s of signed ?? []) {
      if (s.signedUrl && s.path) signedMap.set(s.path, s.signedUrl);
    }
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const baseUrl = host ? `${proto}://${host}` : "";
  const shareUrl = `${baseUrl}/s/${customer.share_token}`;

  const screening2 = docsForType(SCREENING_2_DOCS, customer.hospital_type);
  const docLines = docsForType(ALL_DOCS, customer.hospital_type)
    .map((d) => `· ${d.label}${d.hint ? ` (${d.hint})` : ""}`)
    .join("\n");
  const shareMessage = `[풍현] 서류 제출 안내

안녕하세요, 풍현입니다.
아래 링크에서 기본정보 입력과 필수 서류 업로드를 부탁드립니다.
휴대폰에서도 사진 촬영·업로드가 가능합니다.

${shareUrl}

[필요 서류]
${docLines}

문의사항은 담당자에게 연락 주세요. 감사합니다.`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">
            {customer.hospital_name ?? "(상호 미입력)"}
          </h1>
          <p className="mt-1 text-sm text-navy-500">
            현재 단계:{" "}
            <span className="font-medium text-brand-600">
              {stageLabel(customer.stage)}
            </span>
          </p>
        </div>
        <Link href="/sales" className="text-sm text-navy-500 hover:text-navy-800">
          ← 대시보드
        </Link>
      </div>

      {/* 기본 정보 (수정 가능) */}
      <form action={updateSalesCustomer.bind(null, customer.id)}>
        <Card title="기본 정보" desc="내용을 수정한 뒤 저장하세요.">
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
              <input name="email" defaultValue={customer.email ?? ""} className={inputCls} />
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
          </div>
          <div className="mt-4 flex justify-end">
            <button className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600">
              저장
            </button>
          </div>
        </Card>
      </form>

      {/* 서류 제출 링크 */}
      <Card
        title="고객 서류 제출 링크"
        desc="고객에게 이 링크를 전달하면 로그인 없이 서류를 업로드할 수 있습니다."
      >
        <div className="space-y-4">
          <ShareLink url={shareUrl} />
          <div>
            <p className="mb-2 text-xs font-semibold text-navy-600">
              고객 안내 문구 (필요 서류 · 링크 포함)
            </p>
            <ShareMessage message={shareMessage} />
          </div>
        </div>
      </Card>

      {/* 서류 현황 */}
      <Card title="2차 스크리닝 서류">
        <DocList
          docs={screening2}
          docMap={docMap}
          signedMap={signedMap}
          customerId={customer.id}
        />
      </Card>
      <Card title="3차 스크리닝 서류">
        <DocList
          docs={SCREENING_3_DOCS}
          docMap={docMap}
          signedMap={signedMap}
          customerId={customer.id}
        />
      </Card>

      {/* 고객 삭제 (인입 단계에서만) */}
      {customer.stage === "intake" && (
        <Card
          title="고객 삭제"
          desc="본사 처리가 시작되기 전(인입 단계)에만 삭제할 수 있습니다. 업로드된 서류도 함께 삭제됩니다."
        >
          <form action={deleteSalesCustomer}>
            <input type="hidden" name="id" value={customer.id} />
            <button className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100">
              이 고객 삭제
            </button>
          </form>
        </Card>
      )}
    </div>
  );
}

function DocList({
  docs,
  docMap,
  signedMap,
  customerId,
}: {
  docs: DocItem[];
  docMap: Map<string, CustomerDocument>;
  signedMap: Map<string, string>;
  customerId: string;
}) {
  return (
    <ul className="space-y-2">
      {docs.map((doc) => {
        const row = docMap.get(doc.key);
        const done = !!row?.file_path;
        const url = row?.file_path ? signedMap.get(row.file_path) : undefined;
        return (
          <li
            key={doc.key}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-navy-100 px-3 py-2.5"
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                done ? "bg-brand-500 text-white" : "bg-navy-100 text-transparent"
              }`}
            >
              ✓
            </span>
            <span className="text-sm text-navy-800">{doc.label}</span>
            <div className="ml-auto flex items-center gap-2">
              {url && (
                <span className="inline-flex gap-2">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-brand-600 hover:underline"
                  >
                    보기
                  </a>
                  <a
                    href={`${url}&download`}
                    className="text-xs font-medium text-navy-500 hover:underline"
                  >
                    다운로드
                  </a>
                  <form action={salesDeleteDocument}>
                    <input type="hidden" name="customer_id" value={customerId} />
                    <input type="hidden" name="doc_key" value={doc.key} />
                    <button className="text-xs font-medium text-red-500 hover:underline">
                      삭제
                    </button>
                  </form>
                </span>
              )}
              <SalesDocUpload
                customerId={customerId}
                docKey={doc.key}
                category={doc.category}
                hasFile={done}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

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
      <h2 className="text-sm font-bold text-navy-900">{title}</h2>
      {desc && <p className="mb-4 mt-1 text-xs text-navy-500">{desc}</p>}
      <div className={desc ? "" : "mt-4"}>{children}</div>
    </section>
  );
}
