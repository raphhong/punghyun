"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { registerAgent } from "../actions";

export default function SalesRegisterPage() {
  const params = useSearchParams();
  const invite = params.get("invite") ?? "";
  const [state, formAction, pending] = useActionState(registerAgent, null);

  const inputCls =
    "mt-1.5 w-full rounded-lg border border-navy-700 bg-navy-950 px-3 py-2.5 text-white placeholder:text-navy-500 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30";
  const labelCls = "block text-sm font-medium text-navy-200";

  return (
    <div className="grid min-h-dvh place-items-center bg-navy-950 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-navy-800 text-lg font-bold text-brand-300">
            豊
          </div>
          <h1 className="mt-4 text-xl font-bold text-white">영업자 회원가입</h1>
          <p className="mt-1 text-sm text-navy-400">
            {invite
              ? "초대받은 조직으로 가입합니다. 본사 승인 후 이용 가능합니다."
              : "가입 후 본사 승인을 받으면 이용할 수 있습니다."}
          </p>
        </div>

        <form
          action={formAction}
          className="space-y-4 rounded-2xl border border-navy-800 bg-navy-900 p-6"
        >
          <input type="hidden" name="invite" value={invite} />

          <div>
            <label htmlFor="name" className={labelCls}>
              이름
            </label>
            <input id="name" name="name" required className={inputCls} placeholder="홍길동" />
          </div>

          <div>
            <label htmlFor="phone" className={labelCls}>
              연락처
            </label>
            <input id="phone" name="phone" className={inputCls} placeholder="010-0000-0000" />
          </div>

          <div>
            <label htmlFor="email" className={labelCls}>
              이메일 (로그인 아이디)
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              className={inputCls}
              placeholder="name@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className={labelCls}>
              비밀번호 (6자 이상)
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              className={inputCls}
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
            {pending ? "가입 중…" : "가입 신청"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-navy-400">
          이미 계정이 있나요?{" "}
          <Link href="/sales/login" className="font-medium text-brand-300 hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
