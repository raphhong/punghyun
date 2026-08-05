export const site = {
  name: "주식회사 풍현",
  shortName: "풍현",
  // 배포 후 실제 도메인으로 교체하세요.
  url: "https://punghyun.co.kr",
  tagline: "정산은 기다리고, 자금은 지금.",
  description:
    "풍현은 사업자의 자산을 활용해 즉시 필요한 자금을 공급하는 자산 기반 렌탈·선정산 서비스(세일앤렌탈백)입니다. 자산은 계속 사용하면서 자금은 빠르게 확보하세요.",
  keywords: [
    "세일앤렌탈백",
    "선정산",
    "사업자 자금",
    "운영자금",
    "자산 렌탈",
    "B2B 자금",
    "정산 자금",
    "풍현",
    "사업자 렌탈",
    "자금 흐름 개선",
  ],
  // 상담 연락처 (실제 값으로 교체하세요)
  contact: {
    phone: "1600-0000",
    phoneHref: "tel:16000000",
    email: "contact@punghyun.co.kr",
    kakaoUrl: "", // 카카오 채널 URL이 있으면 입력
    address: "서울특별시",
    hours: "평일 09:00 – 18:00",
  },
  nav: [
    { label: "서비스", href: "/service" },
    { label: "한도 계산기", href: "/calculator" },
    { label: "회사 소개", href: "/about" },
    { label: "상담 신청", href: "/contact" },
  ],
} as const;

export type Site = typeof site;
