"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { LogoMark } from "@/components/Logo";
import { signIn } from "./actions";

export default function LoginPage() {
  const params = useSearchParams();
  const redirectTo = params.get("redirect") ?? "";
  const [state, formAction, pending] = useActionState(signIn, null);

  return (
    <div className="grid min-h-dvh place-items-center bg-navy-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <LogoMark size={48} tone="dark" className="mx-auto h-12 w-12" />
          <h1 className="mt-4 text-xl font-bold text-white">풍현 관리자</h1>
          <p className="mt-1 text-sm text-navy-400">
            승인된 담당자만 접근할 수 있습니다.
          </p>
        </div>

        <form
          action={formAction}
          className="space-y-4 rounded-2xl border border-navy-800 bg-navy-900 p-6"
        >
          <input type="hidden" name="redirect" value={redirectTo} />

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-navy-200">
              이메일
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              className="mt-1.5 w-full rounded-lg border border-navy-700 bg-navy-950 px-3 py-2.5 text-white placeholder:text-navy-500 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              placeholder="admin@punghyun.co.kr"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-navy-200">
              비밀번호
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1.5 w-full rounded-lg border border-navy-700 bg-navy-950 px-3 py-2.5 text-white placeholder:text-navy-500 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              placeholder="••••••••"
            />
          </div>

          {state?.error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-brand-500 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
          >
            {pending ? "로그인 중…" : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}
