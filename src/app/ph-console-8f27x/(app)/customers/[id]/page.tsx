import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { site } from "@/lib/site";
import { ShareLink } from "@/components/admin/ShareLink";
import { ShareMessage } from "@/components/admin/ShareMessage";
import { AdminDocUpload } from "@/components/admin/AdminDocUpload";
import { DocGallery, type GalleryItem } from "@/components/admin/DocGallery";
import { MultiPhotoUpload } from "@/components/MultiPhotoUpload";
import { adminPath } from "@/lib/admin/config";
import { CONTRACT_TYPES } from "@/lib/admin/contracts";
import {
  ALL_DOCS,
  CONTRACT_DOCS,
  DELIVERY_DOCS,
  HOSPITAL_TYPES,
  MATURITY_DOCS,
  MATURITY_RESULTS,
  SCREENING_2_DOCS,
  SCREENING_3_DOCS,
  STAGES,
  docsForType,
  nextStage,
  prevStage,
  stageLabel,
  type DocItem,
  type StageKey,
} from "@/lib/admin/pipeline";
import type { Customer, CustomerDocument } from "@/lib/admin/types";
import {
  createDocUploadUrl,
  deleteCustomer,
  deleteDocument,
  moveStage,
  recordDocUpload,
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

  // 두 쿼리 모두 route param(id)에만 의존 → 병렬 실행으로 왕복 1회 절감.
  const [customerRes, docsRes] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).single<Customer>(),
    supabase.from("customer_documents").select("*").eq("customer_id", id),
  ]);

  const customer = customerRes.data;
  if (!customer) notFound();

  // 담당 영업자 이름
  let agentName: string | null = null;
  if (customer.sales_agent_id) {
    const { data: ag } = await supabase
      .from("sales_agents")
      .select("name")
      .eq("id", customer.sales_agent_id)
      .maybeSingle();
    agentName = (ag as { name: string } | null)?.name ?? null;
  }

  const docRows = docsRes.data;

  const docs = (docRows ?? []) as CustomerDocument[];
  const docMap = new Map(docs.map((d) => [d.doc_key, d]));

  // 업로드된 파일들의 서명 URL 생성 (비공개 버킷 → 1시간 유효 링크)
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

  // 업로드된 서류 모아보기 (썸네일 갤러리 + ZIP 다운로드)
  // 정의된 서류 + 동적으로 추가된 기기 사진(device_photo_*)을 모두 포함.
  const IMG_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "bmp"]);
  const docLabelMap = new Map(
    [
      ...SCREENING_2_DOCS,
      ...SCREENING_3_DOCS,
      ...CONTRACT_DOCS,
      ...DELIVERY_DOCS,
      ...MATURITY_DOCS,
    ].map((d) => [d.key, d.label]),
  );
  let photoNo = 0;
  const galleryItems: GalleryItem[] = docs
    .map((row) => {
      const url = row.file_path ? signedMap.get(row.file_path) : undefined;
      if (!row.file_path || !url) return null;
      const ext = (row.file_path.split(".").pop() ?? "").toLowerCase();
      const label = row.doc_key.startsWith("device_photo_")
        ? `기기 사진 ${(photoNo += 1)}`
        : (docLabelMap.get(row.doc_key) ?? row.doc_key);
      return { key: row.doc_key, label, url, isImage: IMG_EXT.has(ext) };
    })
    .filter((x): x is GalleryItem => x !== null);

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

  const shareUrl = `${baseUrl}/s/${customer.share_token}`;
  const screening2 = docsForType(SCREENING_2_DOCS, customer.hospital_type);
  // 영업자가 고객에게 그대로 보낼 수 있는 안내문구
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
            {agentName && (
              <span className="rounded-full bg-brand-500/10 px-2.5 py-1 text-xs font-medium text-brand-700">
                담당 {agentName}
              </span>
            )}
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
        <DocList docs={screening2} customerId={id} docMap={docMap} signedMap={signedMap} />
      </Card>

      <Card title="3차 서류 (스크리닝 3)" desc="기기 사진 · 정보 수집">
        <div className="mb-4">
          <MultiPhotoUpload
            id={id}
            category="screening_3"
            createUrl={createDocUploadUrl}
            record={recordDocUpload}
            variant="admin"
          />
        </div>
        <DocList docs={SCREENING_3_DOCS} customerId={id} docMap={docMap} signedMap={signedMap} />
      </Card>

      {/* 업로드 서류 모아보기 — 썸네일 · 라이트박스 · 선택 ZIP 다운로드 */}
      <Card
        title="서류 모아보기"
        desc="업로드된 서류를 한눈에 확인하고, 선택해서 ZIP으로 내려받을 수 있습니다."
      >
        <DocGallery customerId={id} items={galleryItems} deleteAction={deleteDocument} />
      </Card>

      {/* 거래 진정성 증빙 서류 — 진정한 매매+임대차 입증 (내부 관리) */}
      <div className="rounded-2xl border border-brand-200 bg-brand-50/40 p-4">
        <h2 className="px-2 text-sm font-bold text-brand-800">
          거래 진정성 증빙 서류
        </h2>
        <p className="mt-0.5 px-2 text-xs text-brand-700/80">
          진정한 매매·임대차임을 입증하기 위한 내부 서류입니다. 생성·서명 후 보관본을 업로드하세요.
        </p>
        <div className="mt-3 space-y-4">
          <Card title="① 계약 체결" desc="매매·임대차 분리 · 잔존가치 근거">
            <div className="mb-3 rounded-lg border border-brand-200 bg-white p-3">
              <p className="mb-2 text-xs text-brand-700/80">
                고객 정보로 초안을 생성합니다. 새 탭에서 인쇄/PDF 저장 후 서명본을 아래에 업로드하세요.
              </p>
              <div className="flex flex-wrap gap-2">
                {CONTRACT_TYPES.map((ct) => (
                  <a
                    key={ct.type}
                    href={adminPath(`contracts/${id}/${ct.type}`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={
                      ct.core
                        ? "rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
                        : "rounded-lg border border-brand-300 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
                    }
                  >
                    {ct.short} 생성
                  </a>
                ))}
              </div>
            </div>
            <DocList docs={CONTRACT_DOCS} customerId={id} docMap={docMap} signedMap={signedMap} />
          </Card>
          <Card title="② 자산 인도 · 소유권 이전" desc="인도확인·검수·소유표시">
            <DocList docs={DELIVERY_DOCS} customerId={id} docMap={docMap} signedMap={signedMap} />
          </Card>
          <Card title="③ 만기 · 정산/재렌탈" desc="선택권·반납·비소구 입증">
            <DocList docs={MATURITY_DOCS} customerId={id} docMap={docMap} signedMap={signedMap} />
          </Card>
        </div>
      </div>

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
              <div>
                <label className={labelCls}>인수가 (원)</label>
                <input name="acquisition_price" inputMode="numeric" defaultValue={customer.acquisition_price ?? ""} className={inputCls} placeholder="예: 50000000" />
              </div>
            </div>
          </div>
          <div className="mt-4 border-t border-navy-100 pt-4">
            <p className="text-sm font-medium text-navy-700">정산 (반납·회수 후 처분)</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>매각(처분) 대금 (원)</label>
                <input name="sale_proceeds" inputMode="numeric" defaultValue={customer.sale_proceeds ?? ""} className={inputCls} placeholder="예: 40000000" />
              </div>
              <div>
                <label className={labelCls}>매각(처분) 일자</label>
                <input name="sale_date" type="date" defaultValue={customer.sale_date ?? ""} className={inputCls} />
              </div>
            </div>
            <div className="mt-3">
              <Check name="non_recourse_confirmed" label="완전 비소구 확인 (차액 미청구 · 거래 종료)" defaultChecked={customer.non_recourse_confirmed} />
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
  signedMap,
}: {
  docs: DocItem[];
  customerId: string;
  docMap: Map<string, CustomerDocument>;
  signedMap: Map<string, string>;
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
              {row?.file_path && signedMap.get(row.file_path) && (
                <span className="ml-2 inline-flex gap-2 align-middle">
                  <a
                    href={signedMap.get(row.file_path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-brand-600 hover:underline"
                  >
                    보기
                  </a>
                  <a
                    href={`${signedMap.get(row.file_path)}&download`}
                    className="text-xs font-medium text-navy-500 hover:underline"
                  >
                    다운로드
                  </a>
                </span>
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
