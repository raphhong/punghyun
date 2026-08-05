import type { Metadata } from "next";
import "./globals.css";
import { site } from "@/lib/site";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";

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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-white">
        <JsonLd data={organizationLd} />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
