"use client";

import Link from "next/link";
import { useState } from "react";
import { site } from "@/lib/site";
import { Container } from "./Container";
import { ButtonLink } from "./Button";
import { cn } from "@/lib/cn";

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-navy-100 bg-white/90 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2" aria-label="풍현 홈">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy-900 text-sm font-bold text-brand-300">
            豊
          </span>
          <span className="text-lg font-bold tracking-tight text-navy-900">
            풍현
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="주요 메뉴">
          {site.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-navy-700 transition-colors hover:bg-navy-50 hover:text-navy-900"
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
          className="grid h-10 w-10 place-items-center rounded-lg text-navy-800 hover:bg-navy-50 md:hidden"
          aria-label="메뉴 열기"
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
        <div className="border-t border-navy-100 bg-white md:hidden">
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
            <ButtonLink href="/contact" className="mt-2 w-full">
              상담 신청
            </ButtonLink>
          </Container>
        </div>
      )}
    </header>
  );
}
