import Link from "next/link";
import { site } from "@/lib/site";
import { Container } from "./Container";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-navy-100 bg-navy-950 text-navy-200">
      <Container className="grid gap-10 py-14 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy-800 text-sm font-bold text-brand-300">
              豊
            </span>
            <span className="text-lg font-bold text-white">주식회사 풍현</span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-navy-300">
            사업자의 자금 흐름을 풍요롭게. 자산 기반 렌탈·선정산 서비스로 필요한
            자금을 빠르고 투명하게 지원합니다.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">바로가기</h3>
          <ul className="mt-4 space-y-3 text-sm">
            {site.nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-navy-300 transition-colors hover:text-white"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">문의</h3>
          <ul className="mt-4 space-y-3 text-sm text-navy-300">
            <li>
              전화{" "}
              <a
                href={site.contact.phoneHref}
                className="text-white hover:underline"
              >
                {site.contact.phone}
              </a>
            </li>
            <li>
              이메일{" "}
              <a
                href={`mailto:${site.contact.email}`}
                className="text-white hover:underline"
              >
                {site.contact.email}
              </a>
            </li>
            <li>운영시간 {site.contact.hours}</li>
          </ul>
        </div>
      </Container>

      <div className="border-t border-navy-800">
        <Container className="flex flex-col items-start justify-between gap-2 py-6 text-xs text-navy-400 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} 주식회사 풍현. All rights reserved.</p>
          <p>
            본 사이트의 내용은 상품 안내를 위한 것이며, 실제 계약 조건은 상담 시
            안내됩니다.
          </p>
        </Container>
      </div>
    </footer>
  );
}
