"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { site } from "@/lib/site";
import { Container } from "./Container";
import { ButtonLink } from "./Button";
import { Logo } from "./Logo";
import { cn } from "@/lib/cn";

export function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const menuButton = useRef<HTMLButtonElement>(null);

  return (
    <header onKeyDown={(event) => { if (event.key === "Escape" && open) { setOpen(false); menuButton.current?.focus(); } }} className="ph-public-header sticky top-0 z-50 border-b border-navy-100">
      <Container className="ph-header-inner flex items-center justify-between">
        <Link href="/" aria-label="풍현 홈" className="flex items-center">
          <Logo />
          <span className="ph-header-descriptor">자산 기반 렌탈</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="주요 메뉴">
          {site.nav.filter((item) => item.href !== "/contact").map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className="ph-header-link"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          <ButtonLink href="/contact" size="md">
            상담 신청
          </ButtonLink>
        </div>

        <button
          type="button"
          className="grid h-11 w-11 place-items-center rounded-lg text-navy-800 hover:bg-navy-50 md:hidden"
          ref={menuButton}
          aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
          aria-controls="public-navigation"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">메뉴</span>
          <div className="space-y-1.5">
            <span
              className={cn(
                "block h-0.5 w-6 bg-current transition-transform",
                open && "translate-y-2 rotate-45",
              )}
            />
            <span
              className={cn(
                "block h-0.5 w-6 bg-current transition-opacity",
                open && "opacity-0",
              )}
            />
            <span
              className={cn(
                "block h-0.5 w-6 bg-current transition-transform",
                open && "-translate-y-2 -rotate-45",
              )}
            />
          </div>
        </button>
      </Container>

      {open && (
        <nav id="public-navigation" aria-label="모바일 주요 메뉴" className="border-t border-navy-100 bg-white md:hidden">
          <Container className="flex flex-col gap-1 py-4">
            {site.nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-4 py-3 text-base font-medium text-navy-800 hover:bg-navy-50"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <ButtonLink href="/contact" className="mt-2 w-full" onClick={() => setOpen(false)}>
              상담 신청
            </ButtonLink>
          </Container>
        </nav>
      )}
    </header>
  );
}
