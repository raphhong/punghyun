import { site } from "./site";
import { glossary } from "./content";

// 용어집 → DefinedTermSet JSON-LD (AI·검색엔진이 핵심 개념을 인용하도록)
export const glossaryLd: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "DefinedTermSet",
  name: "세일앤렌탈백(SRB) 용어집",
  url: `${site.url}/service`,
  hasDefinedTerm: glossary.map((g) => ({
    "@type": "DefinedTerm",
    name: g.term,
    description: g.desc,
  })),
};

// 페이지 경로 → BreadcrumbList JSON-LD
export function breadcrumbLd(
  items: { name: string; path: string }[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { name: "홈", path: "/" },
      ...items,
    ].map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${site.url}${item.path === "/" ? "" : item.path}`,
    })),
  };
}

// 서비스(세일앤렌탈백) Service JSON-LD
export const serviceLd: Record<string, unknown> = {
  "@context": "https://schema.org",
  "@type": "Service",
  serviceType: "세일앤렌탈백 (Sale and Rental-Back)",
  name: "자산 기반 렌탈·선정산 서비스",
  provider: {
    "@type": "FinancialService",
    name: site.name,
    url: site.url,
  },
  areaServed: { "@type": "Country", name: "대한민국" },
  audience: {
    "@type": "BusinessAudience",
    audienceType: "정산 주기가 긴 B2B 사업자",
  },
  description:
    "보유 자산을 매입해 즉시 자금을 지급하고, 사업자는 자산을 계속 사용하며 월 이용료를 납부하는 자산 기반 렌탈·선정산 서비스입니다.",
  offers: {
    "@type": "Offer",
    category: "자산 기반 자금 조달",
    availability: "https://schema.org/InStock",
    priceSpecification: {
      "@type": "PriceSpecification",
      description: "이용료는 자산 규모와 조건에 따라 상담 시 결정됩니다.",
    },
  },
};
