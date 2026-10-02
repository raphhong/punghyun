"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { addMonths, buildSchedule, fmtWon } from "@/lib/admin/payments";
import { koreaToday } from "@/lib/admin/cashflow";
import { cashDate, validateCashflowRequest, type CashflowChange, type CashflowResult, type CashflowSaveRequest, type CashflowState, type CashMovement, type ScheduleLine } from "@/lib/admin/cashflow-write";

const inputCls = "mt-1 w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-navy-50";
const buttonCls = "rounded-lg border border-navy-200 px-3 py-2 text-sm font-semibold text-navy-700 hover:bg-navy-50 disabled:opacity-50";
const primaryCls = "rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50";
const kinds: Record<CashMovement["kind"], string> = {
  funding_disbursement: "자금 집행",
  rental_receipt: "실제 렌탈 수납",
  creditor_payment: "채권사 지급",
  securitization_inflow: "유동화 유입",
};
const conclusiveErrors = new Set(["FORBIDDEN", "INVALID", "NOT_READY", "CASHFLOW_CONFLICT", "CASHFLOW_DUPLICATE", "CASHFLOW_LEGACY_LEDGER", "CASHFLOW_REQUEST_REUSED", "CASHFLOW_INVALID", "CASHFLOW_PROFILE_CONFLICT", "CASHFLOW_NOT_FOUND", "CASHFLOW_FORBIDDEN"]);
const fundingLabel = (value: string | null | undefined) => value === "own" ? "자체자금" : value === "securitized" ? "유동화" : "미분류";
type Props = {
  customerId: string;
  initialResult: CashflowResult;
  saveAction: (request: CashflowSaveRequest) => Promise<CashflowResult>;
  loadAction: (customerId: string) => Promise<CashflowResult>;
};
type MovementDraft = {
  id: string | null; kind: CashMovement["kind"] | ""; basis: CashMovement["basis"] | "";
  cash_date: string; installment_no: string; amount: string; source_reference: string; note: string;
};
const newMovement = (): MovementDraft => ({ id: null, kind: "", basis: "", cash_date: "", installment_no: "", amount: "", source_reference: "", note: "" });

export function CashflowEditor(props: Props) {
  if ("error" in props.initialResult) {
    return <section id="cashflow-editor" className="scroll-mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <h2 className="font-semibold text-navy-900">현금흐름 편집</h2>
      <p role="alert" className="mt-2 text-sm text-amber-900">{props.initialResult.error}</p>
      <p className="mt-2 text-xs text-navy-600">원장과 저장 권한을 확인하기 전에는 편집할 수 없습니다.</p>
    </section>;
  }
  return <LoadedCashflowEditor {...props} initialState={props.initialResult.state} />;
}

function LoadedCashflowEditor({ customerId, initialState, saveAction, loadAction }: Props & { initialState: CashflowState }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [state, setState] = useState(initialState);
  const [operation, setOperation] = useState<CashflowChange["operation"] | null>(null);
  const [movement, setMovement] = useState<MovementDraft | null>(null);
  const [firstDate, setFirstDate] = useState("");
  const [months, setMonths] = useState("");
  const [price, setPrice] = useState("");
  const [expectedTotal, setExpectedTotal] = useState("");
  const [schedule, setSchedule] = useState<ScheduleLine[]>([]);
  const [funding, setFunding] = useState<"" | "own" | "securitized">("");
  const [creditor, setCreditor] = useState("");
  const [reason, setReason] = useState("");
  const [review, setReview] = useState<CashflowSaveRequest | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  // Ref locks take effect synchronously, before React rerenders on a double click.
  const busy = useRef(false);
  const pendingRequest = useRef<CashflowSaveRequest | null>(null);
  const attempt = useRef(0);
  const activeAttempts = useRef(new Set<number>());
  const unknownOutcome = useRef(false);

  useEffect(() => {
    if (!sent) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [sent]);

  const hasLegacyLedger = state.snapshot.customer.receipt_ledger != null;
  const rows = buildSchedule({ ...state.snapshot.customer, rental_receipts: hasLegacyLedger ? [] : state.snapshot.movements.filter(row => row.kind === "rental_receipt" && row.basis === "actual") });
  const sum = schedule.reduce((total, row) => total + row.amount, 0);
  const locked = pending || sent || conflict;

  function begin(next: CashflowChange["operation"], existing?: CashMovement) {
    if (busy.current || pendingRequest.current) return;
    setOperation(next); setReview(null); setError(""); setMessage(""); setReason(""); setUncertain(false);
    if (next === "schedule") {
      const customer = state.snapshot.customer;
      setFirstDate(customer.first_payment_date ?? ""); setMonths(String(customer.rental_months ?? "")); setPrice(String(customer.rental_price ?? ""));
      setSchedule(rows.map(row => ({ no: row.no, dueDate: row.dueDate, amount: row.amount ?? 0 })));
      // Contract total must be entered deliberately; a generated sum is not evidence of the contract total.
      setExpectedTotal("");
    }
    if (next === "profile") { setFunding(state.snapshot.profile?.funding_type ?? ""); setCreditor(state.snapshot.profile?.creditor_name ?? ""); }
    if (next === "movement") setMovement(existing ? {
      id: existing.id, kind: existing.kind, basis: existing.basis, cash_date: existing.cash_date ?? "",
      installment_no: String(existing.installment_no ?? ""), amount: String(existing.amount ?? ""), source_reference: existing.source_reference, note: existing.note ?? "",
    } : newMovement());
  }

  function generateSchedule() {
    const count = Number(months), amount = Number(price);
    if (!cashDate(firstDate) || !Number.isSafeInteger(count) || count < 1 || count > 600 || !Number.isSafeInteger(amount) || amount < 1) {
      setError("첫 납부일, 1~600회차, 월 기준 렌탈료(정수 원)를 입력해 주세요."); return;
    }
    setSchedule(Array.from({ length: count }, (_, i) => ({ no: i + 1, dueDate: addMonths(firstDate, i), amount })));
    setError("");
  }

  function prepareReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || pendingRequest.current || !operation) return;
    let change: CashflowChange;
    if (operation === "schedule") change = { operation, first_payment_date: firstDate, rental_months: Number(months), rental_price: Number(price), payment_schedule: schedule.map(row => ({ ...row })), expected_total: Number(expectedTotal), reason: reason.trim() };
    else if (operation === "profile") change = { operation, funding_type: funding || null, creditor_name: funding === "securitized" ? creditor.trim() || null : null, reason: reason.trim() };
    else {
      if (!movement?.kind || !movement.basis) { setError("거래 종류와 실제·예정 구분을 직접 선택해 주세요."); return; }
      change = { operation, id: movement.id, kind: movement.kind, basis: movement.basis, cash_date: movement.cash_date, installment_no: movement.kind === "rental_receipt" ? Number(movement.installment_no) : null, amount: Number(movement.amount), source_reference: movement.id ? movement.source_reference : movement.source_reference.trim(), note: movement.note.trim(), reason: reason.trim() };
    }
    const request = { customerId, requestId: crypto.randomUUID(), expectedVersion: state.version, change };
    const invalid = validateCashflowRequest(request, koreaToday());
    if (invalid) { setError(invalid); return; }
    setError(""); setReview(request);
  }

  function cancelReview() {
    if (busy.current || pendingRequest.current) return;
    setReview(null); setError("");
  }
  function cancelEdit() {
    if (busy.current || pendingRequest.current) return;
    setOperation(null); setMovement(null); setReview(null); setError("");
  }

  function acceptResult(result: CashflowResult, request: CashflowSaveRequest, attemptId: number) {
    if (pendingRequest.current !== request) return;
    if ("ok" in result) {
      pendingRequest.current = null; busy.current = false; unknownOutcome.current = false; activeAttempts.current.clear();
      setState(result.state); setPending(false); setSent(false); setUncertain(false); setConflict(false);
      setOperation(null); setReview(null); setMovement(null); setError("");
      setMessage(result.replayed ? "이 요청은 이미 저장되었습니다. 중복 거래는 추가되지 않았습니다." : "검토한 변경을 저장했습니다.");
      router.refresh();
      return;
    }
    activeAttempts.current.delete(attemptId);
    if (!conclusiveErrors.has(result.code ?? "")) unknownOutcome.current = true;
    if (attemptId === attempt.current) {
      busy.current = false; setPending(false); setError(result.error);
    }
    // A known rejection resolves only its own attempt. An older request may
    // still be running after a local timeout, or its network result may be lost.
    if (activeAttempts.current.size > 0 || unknownOutcome.current) { setUncertain(true); return; }
    // All attempts are conclusively rejected: late conflicts can safely unlock
    // reload. A network/UNCONFIRMED outcome instead stays frozen until replay.
    pendingRequest.current = null; busy.current = false;
    setPending(false); setSent(false); setUncertain(false); setError(result.error);
    if (["CASHFLOW_CONFLICT", "CASHFLOW_PROFILE_CONFLICT", "CASHFLOW_REQUEST_REUSED"].includes(result.code ?? "")) setConflict(true);
  }

  function saveReviewed() {
    if (busy.current || !review || conflict) return;
    const request = pendingRequest.current ?? review;
    // Never replace the id or payload after an uncertain response.
    pendingRequest.current = request; busy.current = true;
    const attemptId = ++attempt.current;
    activeAttempts.current.add(attemptId);
    setPending(true); setSent(true); setError("");
    startTransition(async () => {
      const timer = window.setTimeout(() => {
        if (pendingRequest.current !== request || attempt.current !== attemptId) return;
        busy.current = false; setPending(false); setUncertain(true);
        setError("응답 확인이 지연되고 있습니다. 저장됐을 수 있으므로 새 거래를 만들지 말고 같은 요청으로 확인·재시도하세요.");
      }, 20000);
      try { acceptResult(await saveAction(request), request, attemptId); }
      catch { acceptResult({ error: "저장 결과를 확인하지 못했습니다. 같은 요청으로 확인·재시도해 주세요.", code: "UNCONFIRMED" }, request, attemptId); }
      finally { window.clearTimeout(timer); }
    });
  }

  function reload() {
    if (busy.current || pendingRequest.current) return;
    busy.current = true; setPending(true); setError("");
    startTransition(async () => {
      try {
        const result = await loadAction(customerId);
        if ("error" in result) { setError(result.error); return; }
        setState(result.state); setConflict(false); setReview(null); setOperation(null); setMovement(null);
        setMessage("최신 원장을 불러왔습니다. 변경 내용을 다시 입력하고 검토해 주세요.");
        router.refresh();
      } catch { setError("최신 원장을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."); }
      finally { busy.current = false; setPending(false); }
    });
  }

  return <section id="cashflow-editor" className="scroll-mt-6 space-y-5 rounded-2xl border border-brand-200 bg-white p-4 sm:p-6">
    <div>
      <h2 className="text-lg font-semibold text-navy-900">현금흐름 편집</h2>
      <p className="mt-1 text-sm leading-relaxed text-navy-500">자동저장되지 않습니다. 변경 사유와 전후 내용을 검토한 다음 최종 저장해야 반영됩니다. 단계·계약일·만기일은 자동 변경하지 않습니다.</p>
    </div>
    <p className="text-sm text-navy-700">자금 구분: <strong>{fundingLabel(state.snapshot.profile?.funding_type)}</strong>{state.snapshot.profile?.creditor_name ? ` · ${state.snapshot.profile.creditor_name}` : ""}</p>
    {hasLegacyLedger && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">기존 수납원장이 있습니다. 일정 변경과 현금 원장의 수납 등록·수정은 기존 원장 대조 전 차단됩니다. 수납 상태는 원장 대조 전 확인할 수 없으며 두 원장을 합산하지 않습니다.</p>}
    {message && <p role="status" className="rounded-lg bg-brand-50 p-3 text-sm text-brand-700">{message}</p>}
    {error && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
    {conflict && <div className="space-y-2"><p className="text-sm text-amber-900">다른 변경이 반영되었습니다. 기존 입력은 저장하지 않고 최신 원장을 불러온 뒤 다시 검토하세요.</p><button type="button" className={buttonCls} onClick={reload} disabled={pending}>최신 원장 다시 불러오기</button></div>}

    {!operation && <div className="flex flex-wrap gap-2">
      <button type="button" className={buttonCls} onClick={() => begin("schedule")} disabled={locked || hasLegacyLedger}>납부 일정·총액 편집</button>
      <button type="button" className={buttonCls} onClick={() => begin("movement")} disabled={locked}>새 거래 등록</button>
      <button type="button" className={buttonCls} onClick={() => begin("profile")} disabled={locked}>자금 구분 편집</button>
    </div>}

    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-navy-800">기존 거래 ({state.snapshot.movements.length}건)</h3>
      <p className="text-xs text-navy-500">동일 거래의 정정은 해당 행의 ‘기존 거래 수정’을 사용하세요. 거래 ID와 증빙 식별번호는 유지됩니다.</p>
      {state.snapshot.movements.length === 0 ? <p className="text-sm text-navy-500">등록된 거래가 없습니다. 거래가 없다는 사실만으로 실제 입금·집행액을 0원으로 확정하지 않습니다.</p> :
        <div className="overflow-x-auto rounded-lg border border-navy-100"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-navy-50 text-navy-600"><tr>{["거래 ID / 증빙 식별번호", "구분", "실제·예정", "일자 / 회차", "금액", "수정"].map(label => <th key={label} className="px-3 py-2 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-navy-100">
          {state.snapshot.movements.map(row => <tr key={row.id}><td className="max-w-64 break-all px-3 py-3"><p>{row.id}</p><p className="mt-1 text-navy-500">{row.source_reference || "증빙 미입력"}</p></td><td className="px-3 py-3">{kinds[row.kind]}</td><td className="px-3 py-3">{row.basis === "actual" ? "실제" : "예정"}</td><td className="whitespace-nowrap px-3 py-3">{row.cash_date ?? (row.cash_month ? `${row.cash_month} (일자 미입력)` : "일자 미입력")}{row.installment_no != null && <p>{row.installment_no}회차</p>}</td><td className="whitespace-nowrap px-3 py-3">{fmtWon(row.amount)}</td><td className="px-3 py-3"><button type="button" className={buttonCls} disabled={locked || operation !== null || (hasLegacyLedger && row.kind === "rental_receipt")} onClick={() => begin("movement", row)}>기존 거래 수정</button></td></tr>)}
        </tbody></table></div>}
    </div>

    {operation && !review && <form onSubmit={prepareReview} className="space-y-4 border-t border-navy-100 pt-5">
      <fieldset disabled={locked} className="space-y-4 disabled:opacity-60">
        <legend className="mb-3 font-semibold text-navy-900">{operation === "schedule" ? "납부 일정 전체 편집" : operation === "profile" ? "자금 구분 편집" : movement?.id ? "기존 거래 정정" : "새 거래 등록"}</legend>
        {operation === "schedule" && <>
          <p className="text-sm text-navy-500">모든 금액은 부가세 포함 계약 금액(원)입니다. 기본 일정 생성 후 각 회차를 조정할 수 있습니다. 마지막 회차의 1원 차이도 직접 반영하세요.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">첫 납부 예정일<input type="date" className={inputCls} value={firstDate} onChange={event => setFirstDate(event.target.value)} required /></label>
            <label className="text-sm">총 회차 (1~600)<input type="number" min="1" max="600" step="1" className={inputCls} value={months} onChange={event => setMonths(event.target.value)} required /></label>
            <label className="text-sm">월 기준 렌탈료 (부가세 포함, 원)<input type="number" min="1" step="1" className={inputCls} value={price} onChange={event => setPrice(event.target.value)} required /></label>
            <label className="text-sm">계약 총액 직접 확인 (부가세 포함, 원)<input type="number" min="1" step="1" className={inputCls} value={expectedTotal} onChange={event => setExpectedTotal(event.target.value)} required /></label>
          </div>
          <button type="button" className={buttonCls} onClick={generateSchedule}>기본 일정 생성·재생성 (입력한 회차별 내용 대체)</button>
          <div className="max-h-[28rem] overflow-auto rounded-lg border border-navy-100"><table className="w-full min-w-[360px] text-sm"><thead className="sticky top-0 bg-navy-50"><tr><th className="p-2 text-left">회차</th><th className="p-2 text-left">납부 예정일</th><th className="p-2 text-left">부가세 포함 금액 (원)</th></tr></thead><tbody>{schedule.map((row, index) => <tr key={row.no}><td className="p-2">{row.no}</td><td className="p-2"><input aria-label={`${row.no}회차 납부 예정일`} type="date" required value={row.dueDate} onChange={event => setSchedule(current => current.map((line, i) => i === index ? { ...line, dueDate: event.target.value } : line))} className={inputCls} /></td><td className="p-2"><input aria-label={`${row.no}회차 금액`} type="number" min="1" step="1" required value={row.amount || ""} onChange={event => setSchedule(current => current.map((line, i) => i === index ? { ...line, amount: Number(event.target.value) } : line))} className={inputCls} /></td></tr>)}</tbody></table></div>
          <p className="text-sm font-semibold text-navy-700">회차별 합계 {fmtWon(sum)} · 계약 총액 {expectedTotal ? fmtWon(Number(expectedTotal)) : "직접 입력 필요"}{expectedTotal && ` · 차이 ${fmtWon(sum - Number(expectedTotal))}`}</p>
        </>}
        {operation === "profile" && <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">자금 구분<select className={inputCls} value={funding} onChange={event => setFunding(event.target.value as typeof funding)}><option value="">미분류 (null)</option><option value="own">자체자금</option><option value="securitized">유동화</option></select></label>
          {funding === "securitized" && <label className="text-sm">채권사명<input className={inputCls} maxLength={200} value={creditor} onChange={event => setCreditor(event.target.value)} required /></label>}
        </div>}
        {operation === "movement" && movement && <>
          {movement.id && <p className="break-all rounded-lg bg-navy-50 p-3 text-xs">수정 대상 거래 ID: {movement.id}<br />기존 거래를 정정하며 거래 종류·실제/예정·증빙 식별번호는 유지합니다. 예정 거래가 실제 실행된 경우 별도의 실제 거래를 신규 등록하세요.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">거래 종류<select className={inputCls} value={movement.kind} required disabled={Boolean(movement.id)} onChange={event => { const kind = event.target.value as MovementDraft["kind"]; setMovement({ ...movement, kind, basis: kind === "rental_receipt" ? "actual" : movement.basis, installment_no: kind === "rental_receipt" ? movement.installment_no : "" }); }}><option value="">직접 선택</option>{Object.entries(kinds).map(([value, label]) => <option key={value} value={value} disabled={hasLegacyLedger && value === "rental_receipt"}>{label}</option>)}</select></label>
            <label className="text-sm">실제·예정 구분<select className={inputCls} value={movement.basis} required disabled={Boolean(movement.id) || movement.kind === "rental_receipt"} onChange={event => setMovement({ ...movement, basis: event.target.value as MovementDraft["basis"] })}><option value="">직접 선택</option><option value="actual">실제 거래 (증빙 확인)</option>{movement.kind !== "rental_receipt" && <option value="planned">예정 거래</option>}</select></label>
            <label className="text-sm">{movement.basis === "actual" ? "실제 거래일" : "거래 예정일"}<input type="date" className={inputCls} value={movement.cash_date} required max={movement.basis === "actual" ? koreaToday() : undefined} onChange={event => setMovement({ ...movement, cash_date: event.target.value })} /></label>
            <label className="text-sm">금액 (원)<input type="number" min="1" step="1" className={inputCls} value={movement.amount} required onChange={event => setMovement({ ...movement, amount: event.target.value })} /></label>
            {movement.kind === "rental_receipt" && <label className="text-sm">수납 대상 회차<input type="number" min="1" max="600" step="1" className={inputCls} value={movement.installment_no} required onChange={event => setMovement({ ...movement, installment_no: event.target.value })} /></label>}
            <label className="text-sm">증빙 식별번호 {movement.id ? "(변경 불가)" : "(중복 방지, 3자 이상)"}<input className={inputCls} value={movement.source_reference} minLength={3} maxLength={200} required readOnly={Boolean(movement.id)} onChange={event => setMovement({ ...movement, source_reference: event.target.value })} /></label>
          </div>
          <label className="block text-sm">거래 메모<textarea className={inputCls} rows={2} maxLength={500} value={movement.note} onChange={event => setMovement({ ...movement, note: event.target.value })} /></label>
        </>}
        <label className="block text-sm">등록·수정 사유 (4~500자)<textarea className={inputCls} rows={2} minLength={4} maxLength={500} required value={reason} onChange={event => setReason(event.target.value)} /></label>
        <div className="flex flex-wrap gap-2"><button type="submit" className={primaryCls}>변경 내용 검토</button><button type="button" className={buttonCls} onClick={cancelEdit}>취소 (저장 안 함)</button></div>
      </fieldset>
    </form>}

    {review && <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
      <h3 className="font-semibold text-navy-900">최종 저장 전 검토</h3>
      <ReviewSummary request={review} state={state} />
      <p className="whitespace-pre-wrap break-words text-sm">사유: {review.change.reason}</p>
      <p className="break-all text-xs text-navy-500">저장 요청 ID: {review.requestId}</p>
      {uncertain && <p className="text-sm font-semibold text-amber-900">결과가 확인될 때까지 이 요청의 ID와 내용을 유지합니다. 재시도는 같은 요청만 전송합니다. 이 화면을 벗어난 경우 재등록 전에 기존 거래를 확인하세요.</p>}
      <div className="flex flex-wrap gap-2"><button type="button" className={primaryCls} disabled={pending || conflict} onClick={saveReviewed}>{pending ? "저장 결과 확인 중…" : uncertain ? "같은 요청으로 확인·재시도" : "검토한 변경 최종 저장"}</button><button type="button" className={buttonCls} disabled={locked} onClick={cancelReview}>돌아가서 수정 (저장 안 함)</button><button type="button" className={buttonCls} disabled={locked} onClick={cancelEdit}>취소 (저장 안 함)</button></div>
    </div>}
  </section>;
}

function ReviewSummary({ request, state }: { request: CashflowSaveRequest; state: CashflowState }) {
  const change = request.change;
  if (change.operation === "profile") return <dl className="space-y-2 text-sm"><div><dt className="font-medium">자금 구분</dt><dd>{fundingLabel(state.snapshot.profile?.funding_type)} → {fundingLabel(change.funding_type)}</dd></div><div><dt className="font-medium">채권사</dt><dd>{state.snapshot.profile?.creditor_name ?? "미입력"} → {change.creditor_name ?? "미입력"}</dd></div></dl>;
  if (change.operation === "schedule") {
    const previous = buildSchedule(state.snapshot.customer);
    return <div className="space-y-3 text-sm">
      <p>첫 납부일: {state.snapshot.customer.first_payment_date ?? "미입력"} → {change.first_payment_date}</p>
      <p>총 회차: {state.snapshot.customer.rental_months ?? "미입력"} → {change.rental_months} · 월 기준 금액: {fmtWon(state.snapshot.customer.rental_price)} → {fmtWon(change.rental_price)}</p>
      <p className="font-semibold">부가세 포함 계약 총액 {fmtWon(change.expected_total)} · {change.payment_schedule.length}개 회차 전체를 아래 일정으로 저장</p>
      <div className="max-h-80 overflow-auto"><table className="w-full min-w-[440px] text-left text-xs"><thead><tr><th className="p-2">회차</th><th className="p-2">기존 날짜 / 금액</th><th className="p-2">저장할 날짜 / 금액</th></tr></thead><tbody>{change.payment_schedule.map(row => { const before = previous.find(item => item.no === row.no); return <tr key={row.no} className="border-t border-amber-100"><td className="p-2">{row.no}</td><td className="p-2">{before ? `${before.dueDate} / ${fmtWon(before.amount)}` : "없음"}</td><td className="p-2">{row.dueDate} / {fmtWon(row.amount)}</td></tr>; })}</tbody></table></div>
      {previous.length > change.payment_schedule.length && <p className="font-semibold text-amber-900">기존 {change.payment_schedule.length + 1}~{previous.length}회차는 새 일정에서 제외됩니다.</p>}
    </div>;
  }
  const previous = state.snapshot.movements.find(row => row.id === change.id);
  const details = (row: Pick<CashMovement, "kind" | "basis" | "cash_date" | "installment_no" | "amount" | "note">) => `${kinds[row.kind]} · ${row.basis === "actual" ? "실제" : "예정"} · ${row.cash_date ?? "일자 미입력"}${row.installment_no == null ? "" : ` · ${row.installment_no}회차`} · ${fmtWon(row.amount)} · 메모: ${row.note || "없음"}`;
  return <div className="space-y-2 break-words text-sm"><p className="font-semibold">{change.id ? "기존 거래 정정 (동일 ID 유지)" : "새 거래 추가"}</p>{change.id && <p className="break-all">거래 ID: {change.id}</p>}<p className="break-all">증빙 식별번호: {change.source_reference}</p><p>변경 전: {previous ? details(previous) : "기존 거래 없음"}</p><p>저장할 내용: {details(change)}</p></div>;
}
