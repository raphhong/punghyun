"use client";

import { useState } from "react";
import { Button } from "./Button";
import { Field } from "./ui/Field";

type Status = "idle" | "loading" | "success" | "error";

const fieldClass = "ph-input";
const labelClass = "ph-field-label";

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
      <div role="status" className="ph-surface ph-surface--padded text-center">
        <h3 className="text-xl font-bold text-navy-900">
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
      aria-busy={status === "loading"}
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
        <Field id="company" name="company" label="회사명" placeholder="주식회사 예시" />
        <Field id="name" name="name" label="담당자 성함" required placeholder="홍길동" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="phone" name="phone" label="연락처" required type="tel" inputMode="tel" placeholder="010-0000-0000" />
        <Field id="email" name="email" label="이메일" type="email" placeholder="name@company.com" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="industry" name="industry" label="업종" placeholder="유통 / 프랜차이즈 / 온라인 셀러 등" />
        <Field id="amount" name="amount" label="대략적 필요 자금" placeholder="예: 5,000만원" />
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
        <p role="alert" className="ph-feedback ph-status--danger">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <Button type="submit" size="lg" loading={status === "loading"} className="w-full">
          {status === "loading" ? "전송 중…" : "상담 신청하기"}
        </Button>
        <p className="text-center text-xs text-navy-500">
          제출하신 정보는 상담 목적으로만 사용됩니다.
        </p>
      </div>
    </form>
  );
}
