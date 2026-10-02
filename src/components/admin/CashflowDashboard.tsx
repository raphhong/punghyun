import Link from "next/link";
import { adminPath } from "@/lib/admin/config";
import { amountText, flowKeys, flowLabels, net, shiftMonth, totalAmounts, type Amount, type projectCashflow } from "@/lib/admin/cashflow";
import { CashflowCharts, type CashflowChartMonth } from "./CashflowCharts";
import type { cashflowPeriod } from "@/lib/admin/cashflow-period";

function Value({ amount }: { amount: Amount }) {
  return <span className={amount.missing ? "text-amber-800" : ""}>{amountText(amount)}{amount.missing > 0 && <span className="mt-1 block text-xs font-normal">미확인 {amount.missing}항목 · 확정 합계 아님</span>}</span>;
}
export function CashflowDashboard({ report, month, today, warnings = [], basePath = adminPath("cashflow"), chartMonths = [], period, basis = "planned" }: {
  report: ReturnType<typeof projectCashflow>; month: string; today: string; warnings?: string[]; basePath?: string; chartMonths?: CashflowChartMonth[]; period?: ReturnType<typeof cashflowPeriod>; basis?: "planned" | "actual";
}) {
  const periodQuery = `&basis=${basis}${period ? `&range=${period.range}&from=${period.start}&to=${period.end}` : ""}`;
  const summaries = [
    { title: "누적 실제 집행액", amount: report.cumulative, help: `${today}까지 · 선택 월과 무관` },
    { title: "선택 월 받을 렌탈료", amount: report.totals.rentalPlan, help: "선택 월 약정 예정액 · 실제 수납과 별도" },
    { title: "선택 월 나갈 돈 · 예정", amount: totalAmounts([report.totals.creditorPlan, report.totals.fundingPlan]), help: "자금 집행 + 채권사 지급 · 미확인 조건 별도" },
    { title: "월 순현금흐름 · 실제", amount: report.actualNet, help: "기록된 현금 유입 − 유출 · 계좌 잔액 아님" },
  ];
  return <div className="min-w-0 space-y-6 text-navy-900">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-semibold tracking-widest text-brand-600">MONTHLY CASH FLOW</p><h1 className="mt-2 text-2xl font-bold">월별 현금흐름</h1><p className="mt-2 text-sm text-navy-500">예정과 실제를 나누어 확인하세요. 모든 금액은 원 단위입니다.</p></div>
      <form action={basePath} className="flex flex-wrap items-center gap-2"><input type="hidden" name="basis" value={basis} />{period && <><input type="hidden" name="range" value={period.range} /><input type="hidden" name="from" value={period.start} /><input type="hidden" name="to" value={period.end} /></>}
        <Link aria-label="이전 달" href={`${basePath}?month=${shiftMonth(month, -1)}${periodQuery}`} className="rounded-lg border border-navy-200 bg-white px-3 py-2">←</Link>
        <label htmlFor="cashflow-month" className="sr-only">조회 월</label><input id="cashflow-month" name="month" type="month" min="1900-01" max="2199-12" defaultValue={month} key={month} required className="rounded-lg border border-navy-200 bg-white px-3 py-2" />
        <button className="rounded-lg bg-brand-500 px-4 py-2 font-semibold text-white">조회</button>
        <Link aria-label="다음 달" href={`${basePath}?month=${shiftMonth(month, 1)}${periodQuery}`} className="rounded-lg border border-navy-200 bg-white px-3 py-2">→</Link>
      </form>
    </div>
    {warnings.length > 0 && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">데이터 확인 필요</p><ul className="mt-2 list-disc space-y-1 pl-5">{warnings.map(w => <li key={w}>{w}</li>)}</ul></div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{summaries.map(s => <section key={s.title} className="rounded-2xl border border-navy-100 bg-white p-5"><h2 className="text-sm text-navy-500">{s.title}</h2><p className="mt-3 text-xl font-bold tabular-nums"><Value amount={s.amount} /></p><p className="mt-3 text-xs leading-5 text-navy-500">{s.help}</p></section>)}</div>
    {period && <form action={basePath} className="flex flex-wrap items-end gap-3 rounded-xl border border-navy-100 bg-white p-4"><input type="hidden" name="month" value={month} /><input type="hidden" name="basis" value={basis} /><label className="text-sm">비교 기간<select name="range" defaultValue={period.range} className="mt-1 block rounded-lg border border-navy-200 p-2"><option value="3">3개월</option><option value="6">6개월</option><option value="12">12개월</option><option value="custom">직접 기간</option></select></label><label className="text-sm">시작 월<input name="from" type="month" defaultValue={period.start} className="mt-1 block rounded-lg border border-navy-200 p-2" /></label><label className="text-sm">종료 월<input name="to" type="month" defaultValue={period.end} className="mt-1 block rounded-lg border border-navy-200 p-2" /></label><button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white">기간 적용</button><p className="w-full text-xs text-navy-500">3·6·12개월은 선택 월까지 비교합니다. 시작·종료 월은 ‘직접 기간’에서 적용됩니다 (최대 36개월).</p></form>}
    {chartMonths.length > 0 && <CashflowCharts months={chartMonths} selectedMonth={month} basis={basis} basePath={basePath} />}
    <section id="cashflow-month-detail" className="overflow-hidden rounded-2xl border border-navy-100 bg-white">
      <div className="border-b border-navy-100 p-5"><h2 className="font-semibold">{month} 유입 · 유출</h2><p className="mt-1 text-xs text-navy-500">예정은 예정일, 실제는 현금 이동일 기준입니다. 예정과 실제를 더하지 않습니다.</p><p className="mt-2 text-xs text-navy-500 sm:hidden">표를 좌우로 밀면 예정과 실제 금액을 모두 볼 수 있습니다.</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[540px] text-left text-sm"><thead className="bg-navy-50 text-navy-500"><tr><th className="p-4" scope="col">구분</th><th scope="col" className="p-4 text-right">예정</th><th scope="col" className="p-4 text-right">실제</th></tr></thead><tbody className="divide-y divide-navy-100">
        {([ ["렌탈료 수납", "유입 +", "rental"], ["유동화 유입금", "유입 +", "inflow"], ["채권사 지급", "유출 −", "creditor"], ["자금 집행", "유출 −", "funding"] ] as const).map(([label, direction, prefix]) => <tr key={prefix}><th scope="row" className="p-4 font-medium">{label}<span className="ml-2 text-xs text-navy-500">{direction}</span></th><td className="p-4 text-right tabular-nums"><Value amount={report.totals[`${prefix}Plan`]} /></td><td className="p-4 text-right tabular-nums"><Value amount={report.totals[`${prefix}Actual`]} /></td></tr>)}
        <tr className="bg-navy-50 font-bold"><th scope="row" className="p-4">월 순현금흐름</th><td className="p-4 text-right"><Value amount={report.plannedNet} /></td><td className="p-4 text-right"><Value amount={report.actualNet} /></td></tr>
      </tbody></table></div>
      <p className="border-t border-navy-100 p-4 text-xs leading-6 text-navy-500">렌탈료 + 유동화 유입 − 채권사 지급 − 자금 집행. 누적 집행액은 월별 집행액과 중복 합산하지 않습니다. 미입력은 0원·완료가 아닙니다. 수수료·세금·운영비·만기 처분금 및 기초 잔액은 이 화면의 합산 범위에 포함되지 않습니다.</p>
    </section>
    <section><h2 className="font-semibold">건별 내역 <span className="text-navy-500">{report.rows.length}건</span></h2><p className="mt-1 text-xs text-navy-500">미입력 건을 포함한 계약 이후 건 및 일정·집행 기록이 있는 건입니다. 펼치면 날짜별 내역을 확인할 수 있습니다.</p>
      <div className="mt-3 space-y-3">{report.rows.map(row => <details key={row.id} className="rounded-xl border border-navy-100 bg-white p-4"><summary className="cursor-pointer"><span className="font-semibold">{row.name}</span><span className="ml-3 text-sm text-navy-500">{row.fundingType === "own" ? "자체자금" : row.fundingType === "securitized" ? `유동화 · ${row.creditor || "채권사 미입력"}` : "자금구분 미입력"}</span><span className="mt-2 block text-sm">실제 순현금흐름: <Value amount={net(row.flows, "Actual")} /></span></summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{flowKeys.map(k => <div key={k} className="rounded-lg bg-navy-50 p-3 text-sm"><p className="text-xs text-navy-500">{flowLabels[k]}</p><p className="mt-1 font-medium"><Value amount={row.flows[k]} /></p></div>)}</div>
        {row.issues.length > 0 && <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-amber-800">{row.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[360px] text-left text-xs"><caption className="sr-only">{row.name} 선택 월 거래 및 날짜 미입력 내역</caption><thead><tr><th className="py-2" scope="col">내역</th><th scope="col">예정 / 실제일</th><th scope="col" className="text-right">금액</th></tr></thead><tbody>{row.details.map((d, i) => <tr key={i} className="border-t border-navy-100"><td className="py-2">{d.label}</td><td>{d.date ?? "날짜 미입력"}</td><td className="text-right">{d.amount === null ? "금액 미입력" : `₩${d.amount.toLocaleString("ko-KR")}`}</td></tr>)}</tbody></table></div>
        <Link href={adminPath(`customers/${row.id}`)} className="mt-3 inline-block text-sm text-brand-600 underline">고객 상세 보기</Link>
      </details>)}{!report.rows.length && <p className="rounded-xl bg-white p-8 text-center text-sm text-navy-500">현금흐름 조회 대상이 없습니다.</p>}</div>
    </section>
    <p className="text-xs leading-6 text-navy-500">실제 수납은 날짜가 기록된 수납원장만 집계합니다. 기존 완납 회차 수는 실제 입금액이나 입금일로 변환하지 않습니다. 표시액은 입력된 기록 기준이며, 원장 완전성 및 은행 거래 대사는 별도 확인이 필요합니다.</p>
  </div>;
}
