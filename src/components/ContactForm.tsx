"use client";

import { useState } from "react";
import { Button } from "./Button";

type Status = "idle" | "loading" | "success" | "error";

const fieldClass =
  "w-full rounded-xl border border-navy-200 bg-white px-4 py-3 text-navy-900 placeholder:text-navy-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30";
const labelClass = "block text-sm font-semibold text-navy-800";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setError("");

    const form = e.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "전송에 실패했습니다.");
      setStatus("success");
      form.reset();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "전송에 실패했습니다.");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-2xl border border-brand-200 bg-brand-50 p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-500 text-white">
          <svg
            className="h-7 w-7"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m5 12 5 5L20 7" />
          </svg>
        </div>
        <h3 className="mt-5 text-xl font-bold text-navy-900">
          상담 신청이 접수되었습니다
        </h3>
        <p className="mt-2 text-navy-600">
          담당자가 확인 후 남겨주신 연락처로 연락드리겠습니다. 감사합니다.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-6 text-sm font-semibold text-brand-600 hover:underline"
        >
          다시 신청하기
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border border-navy-100 bg-white p-6 shadow-sm sm:p-8"
    >
      {/* 허니팟 (봇 필터) — 화면에 보이지 않음 */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="company" className={labelClass}>
            회사명
          </label>
          <input id="company" name="company" className={`mt-2 ${fieldClass}`} placeholder="주식회사 예시" />
        </div>
        <div>
          <label htmlFor="name" className={labelClass}>
            담당자 성함 <span className="text-brand-600">*</span>
          </label>
          <input id="name" name="name" required className={`mt-2 ${fieldClass}`} placeholder="홍길동" />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="phone" className={labelClass}>
            연락처 <span className="text-brand-600">*</span>
          </label>
          <input
            id="phone"
            name="phone"
            required
            type="tel"
            inputMode="tel"
            className={`mt-2 ${fieldClass}`}
            placeholder="010-0000-0000"
          />
        </div>
        <div>
          <label htmlFor="email" className={labelClass}>
            이메일
          </label>
          <input id="email" name="email" type="email" className={`mt-2 ${fieldClass}`} placeholder="name@company.com" />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="industry" className={labelClass}>
            업종
          </label>
          <input id="industry" name="industry" className={`mt-2 ${fieldClass}`} placeholder="유통 / 프랜차이즈 / 온라인 셀러 등" />
        </div>
        <div>
          <label htmlFor="amount" className={labelClass}>
            대략적 필요 자금
          </label>
          <input id="amount" name="amount" className={`mt-2 ${fieldClass}`} placeholder="예: 5,000만원" />
        </div>
      </div>

      <div>
        <label htmlFor="message" className={labelClass}>
          문의 내용
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          className={`mt-2 ${fieldClass} resize-none`}
          placeholder="보유 자산이나 궁금한 점을 자유롭게 남겨주세요."
        />
      </div>

      {status === "error" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <Button type="submit" size="lg" disabled={status === "loading"} className="w-full">
          {status === "loading" ? "전송 중…" : "상담 신청하기"}
        </Button>
        <p className="text-center text-xs text-navy-400">
          제출하신 정보는 상담 목적으로만 사용됩니다.
        </p>
      </div>
    </form>
  );
}
