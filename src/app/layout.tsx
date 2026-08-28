import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { site } from "@/lib/site";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { ADMIN_BASE } from "@/lib/admin/config";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} | 자산 기반 렌탈·선정산 서비스`,
    template: `%s | ${site.shortName}`,
  },
  description: site.description,
  keywords: [...site.keywords],
  applicationName: site.name,
  authors: [{ name: site.name }],
  creator: site.name,
  publisher: site.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: site.url,
    siteName: site.name,
    title: `${site.name} | 정산은 기다리고, 자금은 지금.`,
    description: site.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} | 정산은 기다리고, 자금은 지금.`,
    description: site.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    ...(site.verification.google
      ? { google: site.verification.google }
      : {}),
    ...(site.verification.naver
      ? { other: { "naver-site-verification": site.verification.naver } }
      : {}),
  },
};

const organizationLd = {
  "@context": "https://schema.org",
  "@type": "FinancialService",
  name: site.name,
  alternateName: site.shortName,
  url: site.url,
  description: site.description,
  areaServed: "KR",
  serviceType: "자산 기반 렌탈·선정산 서비스 (세일앤렌탈백)",
  slogan: site.tagline,
  address: {
    "@type": "PostalAddress",
    addressCountry: "KR",
    addressLocality: site.contact.address,
  },
  contactPoint: {
    "@type": "ContactPoint",
    telephone: site.contact.phone,
    email: site.contact.email,
    contactType: "customer support",
    availableLanguage: ["Korean"],
  },
};

// Pretendard 폰트: 초기 HTML에서 즉시 병렬 로드 (CSS @import 대비 렌더 블로킹 제거)
function FontLinks() {
  return (
    <>
      <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
      />
    </>
  );
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  const isAdmin = pathname.startsWith(ADMIN_BASE);

  if (isAdmin) {
    // 어드민: 마케팅 헤더/푸터·구조화데이터 없이 렌더링
    return (
      <html lang="ko" className="h-full antialiased">
        <head>
          <FontLinks />
        </head>
        <body className="min-h-full bg-navy-50">{children}</body>
      </html>
    );
  }

  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <FontLinks />
      </head>
      <body className="flex min-h-full flex-col bg-white">
        <JsonLd data={organizationLd} />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
