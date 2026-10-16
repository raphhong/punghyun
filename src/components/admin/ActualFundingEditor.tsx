"use client";

import { startTransition, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fundingEvidence, type ActualFundingState } from "@/lib/admin/actual-funding";
import { fmtWon, todayISO } from "@/lib/admin/payments";

type Register = (id: string, value: unknown) => Promise<{ ok: true; alreadyRecorded: boolean } | { error: string }>;

export function ActualFundingEditor({ id, state, action }: { id: string; state: ActualFundingState; action: Register }) {
  const router = useRouter();
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  if (state.error) return <p role="alert">{state.error}</p>;
  const inputClass = "w-full rounded-lg border border-navy-200 px-3 py-2";
  return <div className="space-y-3">
    <p className="text-sm">자금 출처: {state.fundingType === "own" ? "자체 자금" : state.fundingType === "securitized" ? `유동화 / ${state.creditorName ?? "채권사 미확정"}` : "미확정"}</p>
    <p className="text-sm text-navy-500">실제 이체를 확인한 날짜·금액·근거를 등록합니다. 자금 출처와 렌탈료 수납 상태는 변경하지 않습니다.</p>
    {state.rows.length ? <>
      <ul className="space-y-2">{state.rows.map(row => <li key={row.id} className="rounded-lg border p-3">
        <p>{row.cash_date ?? "날짜 미입력"} · {row.amount == null ? "금액 미입력" : fmtWon(row.amount)}</p>
        <p className="whitespace-pre-wrap break-words text-sm">근거: {fundingEvidence(row.note) ?? row.note ?? row.source_reference}</p>
      </li>)}</ul>
      <p className="text-sm">기존 실제 집행 기록이 있어 추가 등록을 차단했습니다. 분할·추가·잔금 집행은 이 입력에서 지원하지 않습니다.</p>
    </> : <form className="space-y-3" onSubmit={event => {
      event.preventDefault();
      if (lock.current || saved) return;
      const values = new FormData(event.currentTarget);
      lock.current = true;
      setPending(true);
      setMessage("");
      startTransition(async () => { try {
        const result = await action(id, { cashDate: String(values.get("cashDate") ?? ""), amount: Number(values.get("amount")), evidence: String(values.get("evidence") ?? ""), confirmed: values.get("confirmed") === "on" });
        if ("error" in result) setMessage(result.error);
        else { setSaved(true); setMessage(result.alreadyRecorded ? "이미 등록된 동일 기록을 확인했습니다." : "실제 집행원장에 등록했습니다."); }
        router.refresh();
      } catch { setMessage("저장 결과를 확인하지 못했습니다. 다시 등록하지 말고 새로고침하여 기존 기록을 확인해 주세요."); }
      finally { lock.current = false; setPending(false); } });
    }}>
      <p className="text-sm">기존 실제 집행이 없는 고객의 최초 1건만 등록할 수 있습니다.</p>
      <label className="block">실제 집행일<input name="cashDate" type="date" min="1900-01-01" max={todayISO()} required className={inputClass} /></label>
      <label className="block">실제 집행금액 (원)<input name="amount" type="number" min="1" max={Number.MAX_SAFE_INTEGER} step="1" required className={inputClass} /></label>
      <label className="block">집행 근거<textarea name="evidence" maxLength={1000} required rows={3} placeholder="이체 내역 또는 확인 근거를 입력하세요." className={inputClass} /></label>
      <label className="block text-sm"><input name="confirmed" type="checkbox" required /> 실제 집행 증거를 확인했으며 최초 집행 기록으로 등록합니다.</label>
      <button disabled={pending || saved} className="rounded-lg border px-4 py-2 disabled:opacity-50">{pending ? "등록 중…" : "실제 집행원장 등록"}</button>
    </form>}
    {message && <p role="status">{message}</p>}
  </div>;
}
