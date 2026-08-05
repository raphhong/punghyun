import type { Metadata } from "next";
import { site } from "@/lib/site";
import { steps, processDetail, faqs } from "@/lib/content";
import { Section, SectionHeader } from "@/components/Section";
import { PageHero } from "@/components/PageHero";
import { ButtonLink } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { Faq } from "@/components/Faq";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "서비스 안내 — 세일앤렌탈백(SRB)",
  description:
    "세일앤렌탈백(SRB)은 보유 자산을 매각해 즉시 자금을 확보하고, 자산은 계속 사용하는 서비스입니다. 렌탈형과 할부매입형을 비교하고 이용 절차를 확인하세요.",
  alternates: { canonical: "/service" },
};

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

const compareRows = [
  { label: "만기 처리", rental: "자산 반납", purchase: "잔금 완납 후 소유권 취득" },
  { label: "소유권", rental: "풍현 보유", purchase: "만기 시 사업자 이전" },
  { label: "적합한 경우", rental: "일시적 자금 필요, 자산 교체 예정", purchase: "자산을 계속 보유하고 싶은 경우" },
  { label: "선택 시점", rental: "계약 시점에 선택", purchase: "계약 시점에 선택" },
];

export default function ServicePage() {
  return (
    <>
      <JsonLd data={faqLd} />
      <PageHero
        eyebrow="서비스 안내"
        title="세일앤렌탈백 (SRB)"
        description="보유하신 자산을 매각해 즉시 자금을 확보하고, 그 자산을 계속 사용하는 자산 기반 렌탈 서비스입니다."
      />

      {/* 개념 설명 */}
      <Section className="bg-white">
        <div className="mx-auto max-w-3xl">
          <SectionHeader
            align="left"
            eyebrow="한눈에 보기"
            title="자산은 그대로, 자금은 즉시"
          />
          <p className="mt-6 text-lg leading-relaxed text-navy-600">
            세일앤렌탈백은 사업자가 보유한 자산을 풍현이 매입하여 목돈을
            지급하고, 사업자는 그 자산을 계속 사용하면서 월 이용료(렌탈료)를
            납부하는 구조입니다. 자산을 매각해도 사용에는 변화가 없어 사업을
            중단 없이 이어갈 수 있습니다. 만기에는 반납 또는 매입을 선택할 수
            있습니다.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.step}
              className="rounded-2xl border border-navy-100 bg-navy-50/50 p-8"
            >
              <span className="text-4xl font-bold text-brand-300">
                {s.step}
              </span>
              <h3 className="mt-4 text-xl font-bold text-navy-900">
                {s.title}
              </h3>
              <p className="mt-3 leading-relaxed text-navy-600">{s.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 비교표 */}
      <Section className="bg-navy-50">
        <SectionHeader
          eyebrow="만기 선택"
          title="렌탈형 vs 할부매입형"
          description="계약 시점에 상황에 맞게 선택할 수 있습니다."
        />
        <div className="mx-auto mt-12 max-w-3xl overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-sm">
          <table className="w-full text-left text-sm sm:text-base">
            <thead>
              <tr className="bg-navy-900 text-white">
                <th className="px-5 py-4 font-semibold">구분</th>
                <th className="px-5 py-4 font-semibold">렌탈형 (기본)</th>
                <th className="px-5 py-4 font-semibold text-brand-200">
                  할부매입형 (선택)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {compareRows.map((row) => (
                <tr key={row.label} className="align-top">
                  <th className="bg-navy-50/60 px-5 py-4 text-left font-semibold text-navy-800">
                    {row.label}
                  </th>
                  <td className="px-5 py-4 text-navy-600">{row.rental}</td>
                  <td className="px-5 py-4 text-navy-600">{row.purchase}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 이용 절차 */}
      <Section className="bg-white">
        <SectionHeader
          eyebrow="이용 절차"
          title="신청부터 만기까지"
          description="상담 신청 한 번으로 시작합니다."
        />
        <ol className="mx-auto mt-12 max-w-3xl space-y-4">
          {processDetail.map((p, i) => (
            <li
              key={p.title}
              className="flex gap-5 rounded-2xl border border-navy-100 bg-white p-6 shadow-sm"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-500 text-base font-bold text-white">
                {i + 1}
              </span>
              <div>
                <h3 className="text-lg font-bold text-navy-900">{p.title}</h3>
                <p className="mt-1 leading-relaxed text-navy-600">{p.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* FAQ */}
      <Section className="bg-navy-50">
        <SectionHeader eyebrow="자주 묻는 질문" title="궁금한 점을 확인하세요" />
        <div className="mt-12">
          <Faq />
        </div>
      </Section>

      {/* CTA */}
      <Section className="bg-white">
        <div className="rounded-3xl bg-gradient-to-br from-navy-800 to-navy-950 px-8 py-14 text-center sm:py-16">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            우리 자산으로 얼마나 가능할까요?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-navy-200">
            상담을 통해 사업 상황에 맞는 조건을 안내해 드립니다.
          </p>
          <div className="mt-8">
            <ButtonLink href="/contact" size="lg">
              상담 신청하기
              <Icon name="arrow" className="h-5 w-5" />
            </ButtonLink>
          </div>
          <p className="mt-5 text-sm text-navy-300">
            전화 상담 {site.contact.phone} · {site.contact.hours}
          </p>
        </div>
      </Section>
    </>
  );
}
