import type { Metadata } from "next";
import { trustPoints } from "@/lib/content";
import { Section, SectionHeader } from "@/components/Section";
import { PageHero } from "@/components/PageHero";
import { ButtonLink } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "회사 소개",
  description:
    "주식회사 풍현은 사업자의 자금 흐름을 풍요롭게 한다는 미션 아래, 실물 자산 기반의 안정적인 렌탈·선정산 서비스를 제공합니다.",
  alternates: { canonical: "/about" },
};

const values = [
  {
    title: "신속",
    desc: "필요한 시점에 자금이 닿도록, 절차를 간결하게 설계했습니다.",
  },
  {
    title: "안정",
    desc: "실물 자산을 기반으로 하는 견고한 서비스 구조를 지향합니다.",
  },
  {
    title: "투명",
    desc: "숨은 비용 없이 명확한 조건을 안내합니다.",
  },
  {
    title: "사업자 친화",
    desc: "사업자 편에 서서 사업의 지속을 최우선으로 생각합니다.",
  },
];

export default function AboutPage() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "회사 소개", path: "/about" }])} />
      <PageHero
        eyebrow="회사 소개"
        title="사업자의 자금 흐름을 풍요롭게"
        description="풍현(豊現)은 고객 사업의 자금 흐름을 풍요롭게 한다는 의미를 담고 있습니다."
      />

      {/* 미션 */}
      <Section className="bg-white">
        <div className="mx-auto max-w-3xl text-center">
          <SectionHeader eyebrow="우리의 미션" title="든든한 자금 파트너" />
          <p className="mt-6 text-lg leading-relaxed text-navy-600">
            매출은 있지만 정산 주기가 길어 자금 공백을 겪는 사업자가 많습니다.
            풍현은 사업자가 보유한 자산을 활용해, 사업을 멈추지 않으면서도 필요한
            자금을 빠르게 확보할 수 있는 길을 만듭니다. 딱딱한 절차 대신, 사업자
            편에 서는 든든한 파트너가 되겠습니다.
          </p>
        </div>
      </Section>

      {/* 가치 */}
      <Section className="bg-navy-50">
        <SectionHeader
          eyebrow="우리가 지키는 것"
          title="풍현의 4가지 약속"
        />
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((v) => (
            <div
              key={v.title}
              className="rounded-2xl border border-navy-100 bg-white p-7 shadow-sm"
            >
              <h3 className="text-xl font-bold text-brand-600">{v.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-navy-600">
                {v.desc}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* 운영 역량 */}
      <Section className="bg-white">
        <SectionHeader
          eyebrow="운영 역량"
          title="실전에서 검증된 기반"
          description="렌탈·정산 사업에서 쌓은 실전 운영 경험을 바탕으로 안정적인 서비스를 제공합니다."
        />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {trustPoints.map((t) => (
            <div
              key={t.title}
              className="rounded-2xl border border-navy-100 bg-navy-50/50 p-7"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/10 text-brand-600">
                <Icon name="check" className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-navy-900">
                {t.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-navy-600">
                {t.desc}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <Section className="bg-navy-900">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            함께 이야기 나눠요
          </h2>
          <p className="mt-4 text-navy-300">
            풍현이 사업에 어떤 도움이 될 수 있는지 상담을 통해 확인해보세요.
          </p>
          <div className="mt-8">
            <ButtonLink href="/contact" size="lg">
              상담 신청하기
              <Icon name="arrow" className="h-5 w-5" />
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  );
}
