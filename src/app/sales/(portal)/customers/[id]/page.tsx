import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  ALL_DOCS,
  SCREENING_2_DOCS,
  SCREENING_3_DOCS,
  stageLabel,
  type DocItem,
} from "@/lib/admin/pipeline";
import type { Customer, CustomerDocument } from "@/lib/admin/types";
import { ShareLink } from "@/components/admin/ShareLink";
import { ShareMessage } from "@/components/admin/ShareMessage";

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

  const docLines = ALL_DOCS.map(
    (d) => `· ${d.label}${d.hint ? ` (${d.hint})` : ""}`,
  ).join("\n");
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

      {/* 기본 정보 */}
      <Card title="기본 정보">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Field label="대표자" value={customer.representative} />
          <Field label="연락처" value={customer.phone} />
          <Field label="이메일" value={customer.email} />
          <Field
            label="고객 유형"
            value={
              customer.hospital_type === "individual"
                ? "개인"
                : customer.hospital_type === "corporate"
                  ? "법인"
                  : null
            }
          />
          <Field label="필요자금" value={customer.needed_funds} />
          <Field label="인입일자" value={customer.intake_date} />
        </dl>
      </Card>

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
        <DocList docs={SCREENING_2_DOCS} docMap={docMap} signedMap={signedMap} />
      </Card>
      <Card title="3차 스크리닝 서류">
        <DocList docs={SCREENING_3_DOCS} docMap={docMap} signedMap={signedMap} />
      </Card>
    </div>
  );
}

function DocList({
  docs,
  docMap,
  signedMap,
}: {
  docs: DocItem[];
  docMap: Map<string, CustomerDocument>;
  signedMap: Map<string, string>;
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
            className="flex items-center gap-2 rounded-xl border border-navy-100 px-3 py-2.5"
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                done ? "bg-brand-500 text-white" : "bg-navy-100 text-transparent"
              }`}
            >
              ✓
            </span>
            <span className="text-sm text-navy-800">{doc.label}</span>
            {url && (
              <span className="ml-auto inline-flex gap-2">
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
              </span>
            )}
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

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-navy-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-navy-900">{value ?? "-"}</dd>
    </div>
  );
}
