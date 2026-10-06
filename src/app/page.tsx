import Link from "next/link";
import { site } from "@/lib/site";
import { Container } from "@/components/Container";
import { ButtonLink } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { JsonLd } from "@/components/JsonLd";
import { Calculator } from "@/components/Calculator";
import { AssetContinuity } from "@/components/AssetContinuity";

const homeSteps = [
  { title: "자산 매입", desc: "풍현이 보유 자산을 매입하고, 사업자에게 매입대금을 지급합니다." },
  { title: "렌탈 이용", desc: "매각한 자산을 계속 사용하면서 월 이용료(렌탈료)를 납부합니다." },
  { title: "계약 만기", desc: "계약할 때 정한 방식에 따라 자산을 반납하거나, 잔금을 완납하고 소유권을 취득합니다." },
] as const;

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
              <p className="ph-hero-description">보유한 장비·설비를 매각해 필요한 자금을 확보하고,<br className="ph-desktop-break" /> 렌탈로 계속 사용하세요.</p>
              <div className="ph-hero-actions">
                <ButtonLink href="/contact" size="lg">상담 신청하기<Icon name="arrow" className="h-4 w-4" /></ButtonLink>
                <Link href="#calculator" className="ph-text-link">예상 한도 계산하기<Icon name="arrow" className="h-4 w-4" /></Link>
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
            <h2 id="service-title">매입부터 렌탈까지,<br />이렇게 진행됩니다.</h2>
            <p>풍현이 보유 자산을 매입하고, 사업자는 렌탈로 계속 사용합니다.</p>
            <Link href="/service" className="ph-text-link">이용 절차 자세히 보기<Icon name="arrow" className="h-4 w-4" /></Link>
          </div>
          <ol className="ph-service-timeline">
            {homeSteps.map((step) => (
              <li key={step.title}>
                <div><h3>{step.title}</h3><p>{step.desc}</p></div>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section className="ph-contract-section" aria-labelledby="contract-title">
        <Container>
          <div className="ph-contract-heading"><p className="ph-eyebrow">렌탈형과 할부매입형</p><h2 id="contract-title">만기에 반납할지, 소유할지.<br className="ph-mobile-break" /> 계약할 때 정하세요.</h2></div>
          <div className="ph-contract-options">
            <div><span className="ph-contract-label">렌탈형</span><h3>만기에 반납합니다.</h3><p>계약 기간 동안 렌탈로 이용한 뒤,<br />만기에 자산을 반납합니다.</p><span className="ph-contract-end">만기 처리 <strong>자산 반납</strong></span></div>
            <div><span className="ph-contract-label">할부매입형</span><h3>잔금을 완납하고 소유합니다.</h3><p>계약 기간 동안 자산을 이용한 뒤,<br />만기에 잔금을 완납해 소유권을 취득합니다.</p><span className="ph-contract-end">만기 처리 <strong>잔금 완납 후 소유권 취득</strong></span></div>
          </div>
          <p className="ph-contract-footnote">세부 이용 조건은 상담 시 안내합니다.</p>
        </Container>
      </section>

      <section className="ph-home-section ph-calculator-section" id="calculator" aria-labelledby="calculator-title">
        <Container>
          <div className="ph-calculator-heading"><div><p className="ph-eyebrow">예상 한도 확인</p><h2 id="calculator-title">우리 사업의 예상 금액은<br className="ph-mobile-break" /> 얼마일까요?</h2></div><p>카드매출과 자산 금액을 입력하면<br className="ph-desktop-break" /> 참고용 예상 금액을 확인할 수 있습니다.</p></div>
          <Calculator className="ph-home-calculator" showDisclaimer={false} />
        </Container>
      </section>

      <section className="ph-home-contact" aria-labelledby="contact-title">
        <Container className="ph-contact-layout">
          <div><p className="ph-eyebrow">상담 안내</p><h2 id="contact-title">보유 자산으로 자금 마련이 가능한지,<br />상담으로 확인하세요.</h2><p>신청 내용을 남겨주시면 담당자가 연락해 자산과 사업 현황을 확인하고 이용 조건을 안내합니다.</p></div>
          <div className="ph-contact-actions"><ButtonLink href="/contact" size="lg">상담 신청하기<Icon name="arrow" className="h-4 w-4" /></ButtonLink><a href={site.contact.phoneHref}>{site.contact.phone}<span>{site.contact.hours}</span></a></div>
        </Container>
      </section>
    </div>
  );
}
