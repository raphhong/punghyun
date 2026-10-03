"use client";

import { useEffect, useRef, useState } from "react";
import { Sidebar } from "./Sidebar";
import { LogoMark } from "@/components/Logo";
import { signOut } from "@/app/ph-console-8f27x/login/actions";

export function AdminShell({
  email,
  counts,
  children,
  canViewCashflow = false,
}: {
  email?: string;
  counts: Record<string, number>;
  children: React.ReactNode;
  canViewCashflow?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = drawer.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) { dialog.close(); setOpen(false); } };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, [open]);

  return (
    <div className="ph-scope ph-admin min-h-dvh bg-navy-50 lg:grid lg:grid-cols-[16rem_1fr]">
      <a href="#admin-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:p-3">본문으로 이동</a>
      {/* 데스크톱 사이드바 */}
      <aside className="hidden bg-navy-900 lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-2 border-b border-navy-800 px-5">
          <LogoMark size={32} tone="dark" className="h-8 w-8" />
          <span className="font-bold text-white">풍현 관리자</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <Sidebar counts={counts} showCashflow={canViewCashflow} />
        </div>
      </aside>

      {/* Native dialog provides Escape, focus containment, and focus restoration. */}
      <dialog ref={drawer} id="admin-navigation" aria-label="관리자 메뉴" onClose={() => setOpen(false)} onCancel={() => setOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }} className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-black/50">
        <aside className="ph-sidebar flex h-full w-72 max-w-[85vw] flex-col">
          <div className="flex min-h-16 items-center gap-2 border-b border-navy-700 px-5">
            <LogoMark size={32} tone="dark" className="h-8 w-8" />
            <span className="font-bold text-white">풍현 관리자</span>
            <button type="button" onClick={() => setOpen(false)} className="ml-auto min-h-11 px-2 text-sm text-white" autoFocus>닫기</button>
          </div>
          <div className="flex-1 overflow-y-auto"><Sidebar counts={counts} showCashflow={canViewCashflow} onNavigate={() => setOpen(false)} /></div>
        </aside>
      </dialog>

      {/* 본문 영역 */}
      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-navy-200 bg-white px-4 sm:px-6">
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-lg text-navy-700 hover:bg-navy-50 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="메뉴 열기"
            aria-expanded={open}
            aria-controls="admin-navigation"
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
                className="ph-button ph-button--secondary"
              >
                로그아웃
              </button>
            </form>
          </div>
        </header>

        <main id="admin-main" className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
