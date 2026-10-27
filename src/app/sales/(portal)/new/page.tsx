import Link from "next/link";
import { intakeProduct, intakeProductLabels } from "@/lib/sales/intake-product";
import { HOSPITAL_TYPES } from "@/lib/admin/pipeline";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { createSalesCustomer } from "../../actions";

export const metadata = { title: "고객 등록" };

const inputCls =
  "mt-1.5 w-full rounded-lg border border-navy-200 bg-white px-3 py-2.5 text-sm text-navy-900 placeholder:text-navy-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20";
const labelCls = "block text-sm font-medium text-navy-700";

export default async function SalesNewCustomerPage({ searchParams }: { searchParams: Promise<{ product?: string | string[] }> }) {
  const product = intakeProduct((await searchParams).product);
  if (!product) return <main className="mx-auto max-w-2xl space-y-5"><h1 className="text-2xl font-bold">고객 등록 · 상품 선택</h1><p>이미 등록한 고객은 고객 상세에서 상품별 안내를 선택하세요. 중복 등록하지 마세요.</p>
        <div className="grid gap-4 sm:grid-cols-2"><Link className="rounded-xl border bg-white p-6" href="/sales/new?product=standard"><h2 className="font-bold">일반렌탈</h2><p>고객 등록 후 일반렌탈 서류 제출 링크를 안내합니다.</p></Link><Link className="rounded-xl border bg-white p-6" href="/sales/new?product=short"><h2 className="font-bold">초단기렌탈</h2><p>고객 등록 후 7일 희망 이용 접수·자료 재사용 확인 링크를 안내합니다.</p></Link></div><Link className="underline" href="/sales">기존 고객 목록</Link></main>;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">{intakeProductLabels[product]} · 고객 등록</h1>
          <p className="mt-1 text-sm text-navy-500">
            내가 영업한 고객을 <span className="font-medium">인입</span> 단계로 등록합니다.
          </p>
        </div>
        <Link href="/sales" className="text-sm text-navy-500 hover:text-navy-800">
          ← 대시보드
        </Link>
      </div>

      <p className="text-sm text-navy-500">고객 등록 후 선택한 상품의 접수 안내 화면으로 이동합니다. <Link className="underline" href="/sales/new">상품 다시 선택</Link></p>
      <form
        action={createSalesCustomer}
        className="space-y-5 rounded-2xl border border-navy-100 bg-white p-6"
      >
        <input type="hidden" name="intake_product" value={product} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="hospital_name" className={labelCls}>
              상호(업체명)
            </label>
            <input id="hospital_name" name="hospital_name" className={inputCls} placeholder="○○의원 / ○○상사" />
          </div>
          <div>
            <label htmlFor="representative" className={labelCls}>
              대표자
            </label>
            <input id="representative" name="representative" className={inputCls} placeholder="홍길동" />
          </div>
          <div>
            <label htmlFor="phone" className={labelCls}>
              연락처
            </label>
            <input id="phone" name="phone" className={inputCls} placeholder="010-0000-0000" />
          </div>
          <div>
            <label htmlFor="email" className={labelCls}>
              이메일
            </label>
            <input id="email" name="email" type="email" className={inputCls} placeholder="name@example.com" />
          </div>
          <div>
            <label htmlFor="hospital_type" className={labelCls}>
              고객 유형
            </label>
            <select id="hospital_type" name="hospital_type" className={inputCls}>
              <option value="">선택</option>
              {HOSPITAL_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="needed_funds" className={labelCls}>
              필요자금
            </label>
            <input id="needed_funds" name="needed_funds" className={inputCls} placeholder="예: 3억" />
          </div>
          <div>
            <label htmlFor="intake_date" className={labelCls}>
              인입일자
            </label>
            <input id="intake_date" name="intake_date" type="date" className={inputCls} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/sales"
            className="rounded-lg px-4 py-2 text-sm font-medium text-navy-600 hover:bg-navy-50"
          >
            취소
          </Link>
          <SubmitButton
            pendingText="등록 중…"
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            등록
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
