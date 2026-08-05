import type { Metadata } from "next";
import { Section, SectionHeader } from "@/components/Section";
import { PageHero } from "@/components/PageHero";
import { ButtonLink } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { Calculator } from "@/components/Calculator";
import { calcConfig } from "@/lib/calculator";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "예상 한도 계산기",
  description:
    "카드매출과 보유 자산만 입력하면 세일앤렌탈백으로 확보 가능한 예상 자금을 1분 만에 확인하세요. 참고용 예상치이며 실제 조건은 상담으로 결정됩니다.",
  keywords: [
    "선정산 한도",
    "카드매출 한도 계산",
    "세일앤렌탈백 계산기",
    "사업자 자금 계산",
    "예상 한도 조회",
  ],
  alternates: { canonical: "/calculator" },
};

const factors = [
  {
    title: "카드매출 기준",
    desc: "최근 3개월 카드매출을 근거로 월평균 매출 규모를 산정하여 한도를 계산합니다.",
    icon: "bolt" as const,
  },
  {
    title: "보유 자산 기준",
    desc: "매각 후에도 계속 사용하실 자산 규모에 선지급률을 적용해 한도를 계산합니다.",
    icon: "shield" as const,
  },
  {
    title: "안전성 반영",
    desc: `두 한도 중 낮은 값에 안전계수 ${Math.round(
      calcConfig.safetyFactor * 100,
    )}%를 적용해 보수적으로 산정합니다.`,
    icon: "check" as const,
  },
];

export default function CalculatorPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbLd([{ name: "예상 한도 계산기", path: "/calculator" }])}
      />
      <PageHero
        eyebrow="예상 한도 계산기"
        title="얼마나 받을 수 있을까요?"
        description="카드매출과 보유 자산만 입력하면, 세일앤렌탈백으로 확보 가능한 예상 자금을 바로 확인할 수 있습니다."
      />

      <Section className="bg-navy-50">
        <Calculator />

        <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-3">
          {factors.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-navy-100 bg-white p-6"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/10 text-brand-600">
                <Icon name={f.icon} className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-navy-900">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-navy-600">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="bg-white">
        <div className="mx-auto max-w-2xl text-center">
          <SectionHeader
            eyebrow="정확한 금액이 궁금하다면"
            title="상담으로 맞춤 한도를 확인하세요"
            description="계산기 결과는 참고용이며, 자산 심사를 거치면 실제 지급 가능 금액과 조건을 정확히 안내드립니다."
          />
          <div className="mt-8">
            <ButtonLink href="/contact" size="lg">
              무료 상담 신청하기
              <Icon name="arrow" className="h-5 w-5" />
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  );
}
