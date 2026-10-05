import Link from "next/link";
import { site } from "@/lib/site";
import { steps } from "@/lib/content";
import { Container } from "@/components/Container";
import { ButtonLink } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { JsonLd } from "@/components/JsonLd";
import { Calculator } from "@/components/Calculator";
import { AssetContinuity } from "@/components/AssetContinuity";

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
    <div className="ph-home">
      <JsonLd data={webPageLd} />
      <section className="ph-home-hero" aria-labelledby="home-title">
        <Container>
          <div className="ph-hero-layout">
            <div className="ph-hero-copy">
              <p className="ph-eyebrow">기업 자산 활용 · 세일앤렌탈백</p>
              <h1 id="home-title">장비는 계속 쓰고,<br /><span>운영자금은 새롭게.</span></h1>
              <p className="ph-hero-description">보유한 장비·설비를 매각해 필요한 자금을 확보하고,<br className="ph-desktop-break" /> 렌탈로 계속 사용하세요. 사업의 흐름은 이어집니다.</p>
              <div className="ph-hero-actions">
                <ButtonLink href="/contact" size="lg">우리 사업 상담하기<Icon name="arrow" className="h-4 w-4" /></ButtonLink>
                <Link href="#calculator" className="ph-text-link">예상 한도 확인<Icon name="arrow" className="h-4 w-4" /></Link>
              </div>
              <p className="ph-hero-disclaimer">실제 지급 금액과 조건은 자산 심사·상담 후 결정됩니다.</p>
            </div>
            <AssetContinuity />
          </div>
          <dl className="ph-service-at-a-glance">
            <div><dt>자금 확보</dt><dd>보유 자산의 매입대금으로</dd></div>
            <div><dt>사업 운영</dt><dd>기존 장비를 계속 사용하며</dd></div>
            <div><dt>만기 처리</dt><dd>계약 시 선택한 방식으로</dd></div>
          </dl>
        </Container>
      </section>

      <section className="ph-home-section" aria-labelledby="service-title">
        <Container className="ph-service-layout">
          <div className="ph-section-intro">
            <p className="ph-eyebrow">풍현의 서비스</p>
            <h2 id="service-title">자산의 가치를<br />사업의 다음 자금으로.</h2>
            <p>세일앤렌탈백은 보유 자산의 매입과 렌탈이 이어지는 구조입니다. 자산을 활용하면서 운영을 지속할 수 있습니다.</p>
            <Link href="/service" className="ph-text-link">서비스 전체 안내<Icon name="arrow" className="h-4 w-4" /></Link>
          </div>
          <ol className="ph-service-timeline">
            {steps.map((step) => (
              <li key={step.step}>
                <div><h3>{step.title}</h3><p>{step.desc}</p></div>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section className="ph-contract-section" aria-labelledby="contract-title">
        <Container>
          <div className="ph-contract-heading"><p className="ph-eyebrow">계약 시 선택하는 두 가지 방식</p><h2 id="contract-title">만기에 어떻게 할지,<br className="ph-mobile-break" /> 처음부터 명확하게.</h2></div>
          <div className="ph-contract-options">
            <div><span className="ph-contract-label">렌탈형</span><h3>사용하고, 반납합니다.</h3><p>계약 기간 동안 자산을 렌탈로 이용하고,<br />만기에 자산을 반납하는 방식입니다.</p><span className="ph-contract-end">만기 처리 <strong>자산 반납</strong></span></div>
            <div><span className="ph-contract-label">할부매입형</span><h3>사용하고, 소유합니다.</h3><p>계약 기간 동안 자산을 이용하고,<br />만기에 잔금을 완납해 소유권을 취득합니다.</p><span className="ph-contract-end">만기 처리 <strong>잔금 완납 후 소유권 취득</strong></span></div>
          </div>
          <p className="ph-contract-footnote">두 방식 모두 계약 시점에 선택합니다. 세부 조건은 상담 시 안내합니다.</p>
        </Container>
      </section>

      <section className="ph-home-section ph-calculator-section" id="calculator" aria-labelledby="calculator-title">
        <Container>
          <div className="ph-calculator-heading"><div><p className="ph-eyebrow">예상 한도 확인</p><h2 id="calculator-title">우리 사업은 얼마나<br className="ph-mobile-break" /> 활용할 수 있을까요?</h2></div><p>최근 3개월 카드매출과 보유 자산 규모를 입력하면<br className="ph-desktop-break" /> 참고용 예상 금액을 확인할 수 있습니다.</p></div>
          <Calculator className="ph-home-calculator" showDisclaimer={false} />
        </Container>
      </section>

      <section className="ph-home-contact" aria-labelledby="contact-title">
        <Container className="ph-contact-layout">
          <div><p className="ph-eyebrow">사업에 맞는 방법을 함께 찾습니다</p><h2 id="contact-title">보유 자산과 필요한 자금,<br />풍현에 이야기해주세요.</h2><p>담당자가 자산과 사업 현황을 확인하고 적합한 이용 조건을 안내합니다.</p></div>
          <div className="ph-contact-actions"><ButtonLink href="/contact" size="lg">상담 신청하기<Icon name="arrow" className="h-4 w-4" /></ButtonLink><a href={site.contact.phoneHref}>{site.contact.phone}<span>{site.contact.hours}</span></a></div>
        </Container>
      </section>
    </div>
  );
}
