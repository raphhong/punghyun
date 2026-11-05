"use client";

import { useRef, useState } from "react";
import { changePassword, sendPasswordNonce } from "@/app/account/password-actions";
import { Field } from "@/components/ui/Field";
import type { PasswordResult } from "@/lib/account/password";

export function PasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [needsNonce, setNeedsNonce] = useState(false);
  const [result, setResult] = useState<PasswordResult>({ status: "idle", message: "" });
  async function run(sendCode: boolean) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const form = formRef.current!;
    try {
      const next = sendCode ? await sendPasswordNonce() : await changePassword(new FormData(form));
      setResult(next);
      if (next.status === "reauthentication") setNeedsNonce(true);
      if (next.status === "success") setNeedsNonce(false);
    } catch {
      setResult({ status: "error", message: "연결을 확인해 주세요. 변경 여부가 불확실하면 새 비밀번호로 로그인을 확인해 주세요." });
    } finally {
      // Passwords never enter URL, storage, action results, or React state.
      if (!sendCode) form.reset();
      busyRef.current = false;
      setBusy(false);
    }
  }
  return <section className="ph-scope mx-auto max-w-lg">
    <h1 className="text-2xl font-bold text-navy-900">비밀번호 변경</h1>
    <p className="mt-2 text-sm text-navy-600">본인 계정의 비밀번호를 변경합니다. 현재 비밀번호와 새 비밀번호를 직접 입력해 주세요.</p>
    <form ref={formRef} onSubmit={(event) => { event.preventDefault(); void run(false); }} className="mt-6 space-y-5 rounded-xl border border-navy-200 bg-white p-6" aria-busy={busy}>
      <fieldset disabled={busy} className="space-y-5">
        <Field id="current-password" name="currentPassword" label="현재 비밀번호" type="password" autoComplete="current-password" required maxLength={1024} />
        <Field id="new-password" name="password" label="새 비밀번호" type="password" autoComplete="new-password" required minLength={12} maxLength={128} hint="12~128자. 다른 곳에서 사용하지 않는 긴 비밀번호를 권장합니다." />
        <Field id="confirm-password" name="confirmation" label="새 비밀번호 확인" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
        {needsNonce && <div className="space-y-3">
          <button type="button" className="ph-button ph-button--secondary" onClick={() => void run(true)}>인증코드 요청 / 재전송</button>
          <Field id="password-nonce" name="nonce" label="인증코드" autoComplete="one-time-code" required maxLength={128} hint="인증코드와 비밀번호를 입력한 후 다시 변경해 주세요." />
        </div>}
        <button type="submit" className="ph-button ph-button--primary">{busy ? "처리 중…" : "비밀번호 변경"}</button>
      </fieldset>
      <p role={result.status === "error" ? "alert" : "status"} aria-live="polite" className="text-sm text-navy-700">{result.message}</p>
    </form>
  </section>;
}
