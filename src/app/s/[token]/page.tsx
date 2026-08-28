import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { LogoMark } from "@/components/Logo";
import {
  HOSPITAL_TYPES,
  SCREENING_2_DOCS,
  SCREENING_3_DOCS,
  type DocItem,
} from "@/lib/admin/pipeline";
import type { CustomerDocument } from "@/lib/admin/types";
import { PublicDocUpload } from "@/components/PublicDocUpload";
import { savePublicInfo } from "./actions";

export const metadata: Metadata = {
  title: "스크리닝 정보 제출",
  robots: { index: false, follow: false },
};

const inputCls =
  "mt-1.5 w-full rounded-lg border border-navy-200 bg-white px-3 py-3 text-base text-navy-900 placeholder:text-navy-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20";
const labelCls = "block text-sm font-medium text-navy-700";

type Row = {
  id: string;
  hospital_name: string | null;
  representative: string | null;
  phone: string | null;
  email: string | null;
  hospital_type: string | null;
  needed_funds: string | null;
};

export default async function PublicSubmitPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = createAdminClient();

  const { data: customer } = await db
    .from("customers")
    .select(
      "id, hospital_name, representative, phone, email, hospital_type, needed_funds",
    )
    .eq("share_token", token)
    .single<Row>();

  if (!customer) notFound();

  const { data: docRows } = await db
    .from("customer_documents")
    .select("doc_key, checked, file_path")
    .eq("customer_id", customer.id);

  const docMap = new Map(
    (docRows ?? []).map((d) => [d.doc_key, d as Partial<CustomerDocument>]),
  );

  // 업로드된 파일 열람용 서명 URL (비공개 버킷 → 1시간 유효)
  const filePaths = (docRows ?? [])
    .map((d) => d.file_path)
    .filter((p): p is string => !!p);
  const signedMap = new Map<string, string>();
  if (filePaths.length) {
    const { data: signed } = await db.storage
      .from("customer-docs")
      .createSignedUrls(filePaths, 3600);
    for (const s of signed ?? []) {
      if (s.signedUrl && s.path) signedMap.set(s.path, s.signedUrl);
    }
  }

  const saveInfo = savePublicInfo.bind(null, token);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-xl px-4 py-8 sm:py-12">
      <div className="mb-8 flex items-center gap-2">
        <LogoMark size={36} className="h-9 w-9" />
        <div>
          <p className="text-lg font-bold text-navy-900">풍현</p>
          <p className="text-sm text-navy-500">스크리닝 정보 제출</p>
        </div>
      </div>

      <div className="mb-6 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
        아래 정보를 입력하고 서류를 업로드해 주세요. 담당자에게 자동으로
        전달됩니다.
      </div>

      {/* 기본 정보 */}
      <form
        action={saveInfo}
        className="space-y-4 rounded-2xl border border-navy-100 bg-white p-5"
      >
        <h2 className="text-base font-semibold text-navy-900">기본 정보</h2>
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
            <input name="phone" defaultValue={customer.phone ?? ""} className={inputCls} inputMode="tel" />
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
            <input name="needed_funds" defaultValue={customer.needed_funds ?? ""} className={inputCls} placeholder="예: 3억" />
          </div>
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-brand-500 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-600"
        >
          기본 정보 저장
        </button>
      </form>

      {/* 서류 업로드 */}
      <section className="mt-6 space-y-4 rounded-2xl border border-navy-100 bg-white p-5">
        <div>
          <h2 className="text-base font-semibold text-navy-900">필수 서류</h2>
          <p className="mt-0.5 text-sm text-navy-500">
            각 항목의 파일을 선택하고 업로드를 눌러 주세요.
          </p>
        </div>
        <DocUpload docs={SCREENING_2_DOCS} docMap={docMap} signedMap={signedMap} token={token} />
      </section>

      <section className="mt-6 space-y-4 rounded-2xl border border-navy-100 bg-white p-5">
        <div>
          <h2 className="text-base font-semibold text-navy-900">기기 사진·정보</h2>
          <p className="mt-0.5 text-sm text-navy-500">
            기기 사진 및 목록을 업로드해 주세요.
          </p>
        </div>
        <DocUpload docs={SCREENING_3_DOCS} docMap={docMap} signedMap={signedMap} token={token} />
      </section>

      <p className="mt-8 text-center text-xs text-navy-400">
        © 풍현 · 본 링크는 담당자 전용이며 외부에 공유하지 마세요.
      </p>
    </main>
  );
}

function DocUpload({
  docs,
  docMap,
  signedMap,
  token,
}: {
  docs: DocItem[];
  docMap: Map<string, Partial<CustomerDocument>>;
  signedMap: Map<string, string>;
  token: string;
}) {
  return (
    <ul className="space-y-3">
      {docs.map((doc) => {
        const row = docMap.get(doc.key);
        const fileUrl = row?.file_path
          ? signedMap.get(row.file_path)
          : undefined;
        return (
          <PublicDocUpload
            key={doc.key}
            token={token}
            docKey={doc.key}
            category={doc.category}
            label={doc.label}
            done={!!row?.file_path}
            fileUrl={fileUrl}
          />
        );
      })}
    </ul>
  );
}
