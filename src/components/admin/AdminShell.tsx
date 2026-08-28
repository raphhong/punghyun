"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { LogoMark } from "@/components/Logo";
import { signOut } from "@/app/ph-console-8f27x/login/actions";
import { cn } from "@/lib/cn";

export function AdminShell({
  email,
  counts,
  children,
}: {
  email?: string;
  counts: Record<string, number>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-navy-50 lg:grid lg:grid-cols-[16rem_1fr]">
      {/* 데스크톱 사이드바 */}
      <aside className="hidden bg-navy-900 lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-2 border-b border-navy-800 px-5">
          <LogoMark size={32} tone="dark" className="h-8 w-8" />
          <span className="font-bold text-white">풍현 관리자</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Sidebar counts={counts} />
        </div>
      </aside>

      {/* 모바일 드로어 */}
      <div
        className={cn(
          "fixed inset-0 z-40 lg:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/50 transition-opacity",
            open ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setOpen(false)}
        />
        <aside
          className={cn(
            "absolute left-0 top-0 flex h-full w-64 flex-col bg-navy-900 transition-transform",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex h-16 items-center gap-2 border-b border-navy-800 px-5">
            <LogoMark size={32} tone="dark" className="h-8 w-8" />
            <span className="font-bold text-white">풍현 관리자</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <Sidebar counts={counts} onNavigate={() => setOpen(false)} />
          </div>
        </aside>
      </div>

      {/* 본문 영역 */}
      <div className="flex min-h-dvh flex-col">
        <header className="flex h-16 items-center justify-between border-b border-navy-200 bg-white px-4 sm:px-6">
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-lg text-navy-700 hover:bg-navy-50 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="메뉴 열기"
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-navy-500 sm:inline">{email}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg border border-navy-200 px-3 py-1.5 text-sm font-medium text-navy-700 hover:bg-navy-50"
              >
                로그아웃
              </button>
            </form>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
