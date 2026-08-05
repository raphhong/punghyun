import Link from "next/link";
import { site } from "@/lib/site";
import { steps, benefits, trustPoints } from "@/lib/content";
import { Container } from "@/components/Container";
import { Section, SectionHeader } from "@/components/Section";
import { ButtonLink } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { JsonLd } from "@/components/JsonLd";
import { Calculator } from "@/components/Calculator";

const webPageLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: site.name,
  url: site.url,
  inLanguage: "ko-KR",
  description: site.description,
};

export default function Home() {
  return (
    <>
      <JsonLd data={webPageLd} />

      {/* 히어로 */}
      <section className="bg-hero-grid text-white">
        <Container className="py-24 sm:py-32 lg:py-36">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-medium text-brand-200">
              자산 기반 렌탈·선정산 서비스
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              정산은 기다리고,
              <br />
              <span className="text-brand-300">자금은 지금.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-balance text-lg leading-relaxed text-navy-200">
              기존 보유 자산을 활용해 필요한 운영 자금을 확보하세요. 기존 자산
              사용은 계속, 자금은 즉시 입금. 풍현이 사업자의 자금 흐름을 든든하게
              뒷받침 하겠습니다.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <ButtonLink href="/contact" size="lg">
                상담 신청하기
                <Icon name="arrow" className="h-5 w-5" />
              </ButtonLink>
              <ButtonLink href="/service" size="lg" variant="secondary">
                서비스 자세히 보기
              </ButtonLink>
            </div>
            <p className="mt-6 text-sm text-navy-300">
              전화 상담{" "}
              <a
                href={site.contact.phoneHref}
                className="font-semibold text-white hover:underline"
              >
                {site.contact.phone}
              </a>{" "}
              · {site.contact.hours}
            </p>
          </div>
        </Container>
      </section>

      {/* 문제 제기 */}
      <Section className="bg-white">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
            이런 고민, 있으신가요?
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
            정산은 아직인데,
            <br className="sm:hidden" /> 자금은 지금 필요하신가요?
          </h2>
          <p className="mt-5 text-balance text-lg leading-relaxed text-navy-600">
            매출은 지속 발생하지만, 당장 필요 운영자금을 확보하기에는 기존 금융
            프로그램의 절차는 문턱이 높고 복잡합니다. 풍현은 보유하신 자산을
            활용하여 더 빠르고, 적합한 대안을 제시합니다.
          </p>
        </div>
      </Section>

      {/* 서비스 3단계 프로세스 */}
      <Section className="bg-navy-50">
        <SectionHeader
          title="3단계로 끝나는 자금 확보"
          description="매입 → 렌탈 → 만기 후 방안 선택"
        />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.step}
              className="relative rounded-2xl border border-navy-100 bg-white p-8 shadow-sm"
            >
              <span className="text-4xl font-bold text-brand-200">
                {s.step}
              </span>
              <h3 className="mt-4 text-xl font-bold text-navy-900">
                {s.title}
              </h3>
              <p className="mt-3 leading-relaxed text-navy-600">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <ButtonLink href="/service" variant="ghost">
            이용 절차 자세히 보기
            <Icon name="arrow" className="h-4 w-4" />
          </ButtonLink>
        </div>
      </Section>

      {/* 예상 한도 계산기 */}
      <Section className="bg-white" id="calculator">
        <SectionHeader
          eyebrow="1분 예상 조회"
          title="얼마나 받을 수 있을까요?"
          description="카드매출과 보유 자산만 입력하면 예상 지급 가능 금액을 바로 확인할 수 있습니다."
        />
        <div className="mt-12">
          <Calculator />
        </div>
        <div className="mt-8 text-center">
          <ButtonLink href="/calculator" variant="ghost">
            계산기 자세히 보기
            <Icon name="arrow" className="h-4 w-4" />
          </ButtonLink>
        </div>
      </Section>

      {/* 강점 */}
      <Section className="bg-navy-50">
        <SectionHeader
          eyebrow="왜 풍현인가"
          title="사업자 편에 서는 든든한 파트너"
          description="빠르고, 유연하고, 투명하게. 사업의 지속을 최우선으로 생각합니다."
        />
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((b) => (
            <div
              key={b.title}
              className="rounded-2xl border border-navy-100 bg-white p-7"
            >
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-500/10 text-brand-600">
                <Icon name={b.icon} />
              </div>
              <h3 className="mt-5 text-lg font-bold text-navy-900">
                {b.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-navy-600">
                {b.desc}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* 신뢰 */}
      <Section className="bg-navy-900 text-white">
        <SectionHeader
          eyebrow="신뢰와 안정"
          title="실전에서 검증된 운영 역량으로"
          description="안전하고 투명하게. 실물 자산 기반의 체계적인 서비스입니다."
          invert
        />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {trustPoints.map((t) => (
            <div
              key={t.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-7"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/20 text-brand-300">
                <Icon name="check" className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-white">{t.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-navy-300">
                {t.desc}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <Section className="bg-white">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-navy-800 to-navy-950 px-8 py-14 text-center sm:px-16 sm:py-20">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            우리 사업에 맞는지 확인해보세요
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-navy-200">
            간단한 정보만 남겨주시면 담당자가 연락드려 맞춤 상담을 진행합니다.
            상담은 무료이며, 부담 없이 문의하세요.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/contact" size="lg">
              지금 상담 신청하기
              <Icon name="arrow" className="h-5 w-5" />
            </ButtonLink>
            <Link
              href={site.contact.phoneHref}
              className="text-sm font-semibold text-navy-200 hover:text-white"
            >
              전화로 문의: {site.contact.phone}
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
