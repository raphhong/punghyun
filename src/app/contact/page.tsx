import type { Metadata } from "next";
import { site } from "@/lib/site";
import { Container } from "@/components/Container";
import { PageHero } from "@/components/PageHero";
import { ContactForm } from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "상담 신청",
  description:
    "풍현 세일앤렌탈백 상담을 신청하세요. 회사 정보와 필요 자금을 남겨주시면 담당자가 연락드려 맞춤 상담을 진행합니다.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="상담 신청"
        title="부담 없이 문의하세요"
        description="간단한 정보만 남겨주시면 담당자가 연락드려 맞춤 상담을 진행합니다. 상담은 무료입니다."
      />

      <Container className="py-16 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-5">
          {/* 연락처 정보 */}
          <aside className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-navy-900">연락처</h2>
            <p className="mt-3 leading-relaxed text-navy-600">
              전화 또는 아래 양식으로 문의해 주세요. 빠르게 확인하고
              연락드리겠습니다.
            </p>

            <dl className="mt-8 space-y-6">
              <div>
                <dt className="text-sm font-semibold text-navy-500">전화</dt>
                <dd className="mt-1">
                  <a
                    href={site.contact.phoneHref}
                    className="text-lg font-bold text-navy-900 hover:text-brand-600"
                  >
                    {site.contact.phone}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-navy-500">이메일</dt>
                <dd className="mt-1">
                  <a
                    href={`mailto:${site.contact.email}`}
                    className="text-lg font-bold text-navy-900 hover:text-brand-600"
                  >
                    {site.contact.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-navy-500">운영시간</dt>
                <dd className="mt-1 text-lg font-bold text-navy-900">
                  {site.contact.hours}
                </dd>
              </div>
            </dl>

            <div className="mt-8 rounded-2xl border border-navy-100 bg-navy-50/60 p-6">
              <p className="text-sm leading-relaxed text-navy-600">
                입력하신 정보는 상담 목적으로만 활용되며, 실제 계약 조건은 상담
                과정에서 안내됩니다.
              </p>
            </div>
          </aside>

          {/* 폼 */}
          <div className="lg:col-span-3">
            <ContactForm />
          </div>
        </div>
      </Container>
    </>
  );
}
