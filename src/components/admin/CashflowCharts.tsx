"use client";
import { useState } from "react";
import Link from "next/link";
import { amountText, totalAmounts, type Amount, type FlowKey } from "@/lib/admin/cashflow";
export type CashflowChartMonth = { month: string; totals: Record<FlowKey, Amount>; plannedNet: Amount; actualNet: Amount };
type Tip = { month: string; label: string; amount: Amount };
type ChartProps = { months: CashflowChartMonth[]; selectedMonth: string; basis: "planned" | "actual"; basePath: string };
export function CashflowCharts(props: ChartProps) {
  // Remount the interactive selection when its meaning or source values change.
  // A planned amount must never survive a switch to the actual-cash view.
  const context = JSON.stringify([props.basis, props.selectedMonth, props.months.map(m => [m.month, m.totals, m.plannedNet, m.actualNet])]);
  return <CashflowChartsContent key={context} {...props} />;
}
export function chartMoney(a: Amount) { return a.missing && !a.known ? "미확인" : `${a.missing ? "확인분 " : ""}${a.value.toLocaleString("ko-KR")}원${a.missing ? " · 전체 금액 미확정" : ""}`; }
function CashflowChartsContent({ months, selectedMonth, basis, basePath }: ChartProps) {
  const [tip, setTip] = useState<Tip | null>(null);
  const suffix = basis === "actual" ? "Actual" : "Plan";
  const query = `&range=custom&from=${months[0].month}&to=${months[months.length-1].month}`;
  const href = (month: string) => `${basePath}?month=${month}&basis=${basis}${query}#cashflow-month-detail`;
  const series = [
    { label:"렌탈료", prefix:"rental", color:"var(--ph-component-chart-rental)" },
    { label:"유동화 유입", prefix:"inflow", color:"var(--ph-component-chart-inflow)" },
    { label:"자금 집행", prefix:"funding", color:"var(--ph-component-chart-funding)" },
    { label:"채권사 지급", prefix:"creditor", color:"var(--ph-component-chart-creditor)" },
  ] as const;
  const nets = months.map(m => basis === "actual" ? m.actualNet : m.plannedNet);
  const incomplete = nets.filter(a=>a.missing).length;
  const width=Math.max(640,months.length*72+70), left=35, step=(width-60)/months.length, baseline=190;
  const max=Math.max(1,...months.flatMap(m=>series.map(s=>Math.abs(m.totals[`${s.prefix}${suffix}`].value))));
  const netMax=Math.max(1,...nets.filter(a=>!a.missing).map(a=>Math.abs(a.value)));
  const netY=(v:number)=>100-v/netMax*65;
  const incoming=(m:CashflowChartMonth)=>totalAmounts([m.totals[`rental${suffix}`],m.totals[`inflow${suffix}`]]);
  const outgoing=(m:CashflowChartMonth)=>totalAmounts([m.totals[`funding${suffix}`],m.totals[`creditor${suffix}`]]);
  const diff=(a:Amount,b:Amount)=>a.missing||b.missing?"미확정":`${a.value-b.value>0?"+":""}${(a.value-b.value).toLocaleString("ko-KR")}원`;
  const selectedIndex=months.findIndex(m=>m.month===selectedMonth);
  const changes=selectedIndex>0?[diff(incoming(months[selectedIndex]),incoming(months[selectedIndex-1])),diff(outgoing(months[selectedIndex]),outgoing(months[selectedIndex-1])),diff(nets[selectedIndex],nets[selectedIndex-1])]:["전월 자료 없음","전월 자료 없음","전월 자료 없음"];
  const handlers=(value:Tip)=>({onMouseEnter:()=>setTip(value),onFocus:()=>setTip(value),onClick:()=>setTip(value),onKeyDown:(e:React.KeyboardEvent)=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setTip(value)} if(e.key==="Escape")setTip(null)}});
  return <section className="ph-chart ph-surface p-4 sm:p-5" aria-labelledby="cashflow-chart-title">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="cashflow-chart-title" className="font-semibold">{months[0].month} ~ {months[months.length-1].month} 현금흐름</h2><p className="mt-1 text-sm text-navy-500">막대·점에 마우스를 올리거나, Tab으로 이동하거나, 터치하면 정확한 금액을 확인할 수 있습니다.</p></div><nav aria-label="그래프 예정 실제 선택" className="flex gap-2">{(["planned","actual"] as const).map(b=><Link key={b} href={`${basePath}?month=${selectedMonth}&basis=${b}${query}`} aria-current={basis===b?"page":undefined} className={`rounded-lg border px-4 py-2 text-sm font-semibold ${basis===b?"border-brand-500 bg-brand-500 text-white":"border-navy-200 text-navy-600"}`}>{b==="planned"?"예정 보기":"실제 보기"}</Link>)}</nav></div>
    <p className="mt-3 text-sm font-semibold">{basis==="actual"?"실제 현금 이동일 기준":"약정 예정일 기준"}</p>
    <p className="mt-2 text-xs text-navy-500">전월 대비 · 유입 {changes[0]} / 유출 {changes[1]} / 순흐름 {changes[2]}</p>
    {incomplete>0&&<p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{months.length}개월 중 {incomplete}개월 미완성 · 빗금은 확인분, ?는 미확인입니다. 미완성 월의 순현금흐름 선은 연결하지 않습니다.</p>}
    <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs">{series.map(s=><li key={s.prefix} className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-sm" style={{background:s.color}}/>{s.label}</li>)}</ul>
    <div id="cashflow-tooltip" role="status" aria-live="polite" aria-atomic="true" className="mt-3 min-h-14 rounded-lg bg-navy-50 p-3 text-sm">{tip?<div className="flex items-center justify-between gap-2"><p>{tip.month} · {tip.label}<strong className="ml-3">{chartMoney(tip.amount)}</strong></p><button type="button" aria-label="금액 안내 닫기" onClick={()=>setTip(null)} className="ph-button ph-button--ghost" >닫기</button></div>:<span className="text-navy-500">막대·점을 선택하면 금액 표시 · 아래 월을 누르면 상세 이동</span>}</div>
    <div className="mt-2 overflow-x-auto"><svg viewBox={`0 0 ${width} 240`} className="w-full" style={{minWidth:Math.max(600,months.length*60)}} role="group" aria-label="월별 유입과 유출 막대그래프">
      <defs>{series.map(s=><pattern key={s.prefix} id={`cash-hatch-${s.prefix}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="white"/><rect width="2" height="6" fill={s.color}/></pattern>)}</defs>
      {[0,.5,1].map(r=><line key={r} x1={left-10} x2={width-20} y1={baseline-r*145} y2={baseline-r*145} stroke="var(--ph-component-chart-grid)"/>)}
      {months.map((m,i)=><g key={m.month}>{m.month===selectedMonth&&<rect x={left+i*step-4} y="28" width="66" height="195" rx="5" fill="var(--ph-component-chart-selection)"/>}{series.map((s,j)=>{
        const a=m.totals[`${s.prefix}${suffix}`],x=left+i*step+j*15,h=Math.abs(a.value)/max*145;
        return <g key={s.prefix} role="button" tabIndex={0} aria-label={`${m.month} ${s.label} 금액 보기`} aria-describedby="cashflow-tooltip" style={{cursor:"pointer"}} {...handlers({month:m.month,label:s.label,amount:a})}><title>{`${m.month} ${s.label}: ${chartMoney(a)}`}</title><rect x={x-2} y="28" width="15" height="172" fill="transparent" pointerEvents="all"/>{a.missing&&!a.known?<text x={x+5} y={baseline-7} fill={s.color} fontSize="13" textAnchor="middle">?</text>:<rect x={x} y={baseline-h} width="11" height={Math.max(h,1)} fill={a.missing?`url(#cash-hatch-${s.prefix})`:s.color} stroke={s.color}/>}</g>
      })}<a href={href(m.month)} aria-label={`${m.month} 상세 보기`}><text x={left+i*step+26} y="220" textAnchor="middle" fontSize="12" fill="var(--ph-component-chart-label)" style={{textDecoration:"underline"}}>{m.month.slice(2)}</text></a></g>)}
    </svg></div>
    <h3 className="mt-3 text-sm font-semibold">월 순현금흐름 · {basis==="actual"?"실제":"예정"}</h3><p className="mt-1 text-xs text-navy-500">0선 위는 유입이 더 큼, 아래는 유출이 더 큼.</p>
    <div className="overflow-x-auto"><svg viewBox={`0 0 ${width} 205`} className="w-full" style={{minWidth:Math.max(600,months.length*60)}} role="group" aria-label="월 순현금흐름 선그래프">
      <line x1={left-10} x2={width-20} y1="100" y2="100" stroke="var(--ph-component-chart-grid)"/><text x="8" y="104" fontSize="11" fill="var(--ph-component-chart-label)">0</text>
      {months.map((m,i)=>{const a=nets[i],x=left+i*step+26,prev=nets[i-1];return <g key={m.month}>{!a.missing&&i>0&&!prev.missing&&<line x1={x-step} x2={x} y1={netY(prev.value)} y2={netY(a.value)} stroke="var(--ph-component-chart-net)" strokeWidth="2.5"/>}<g role="button" tabIndex={0} aria-describedby="cashflow-tooltip" aria-label={`${m.month} 순현금흐름 금액 보기`} {...handlers({month:m.month,label:"순현금흐름",amount:a.missing?{...a,known:0}:a})}><rect x={x-12} y="28" width="24" height="150" fill="transparent" pointerEvents="all"/>{a.missing?<text x={x} y="104" textAnchor="middle" fill="var(--ph-component-chart-warning)" fontSize="16">?</text>:<circle cx={x} cy={netY(a.value)} r="4" fill="var(--ph-component-chart-net)"/>}</g><a href={href(m.month)} aria-label={`${m.month} 순현금흐름 상세 보기`}><text x={x} y="195" textAnchor="middle" fontSize="12" fill="var(--ph-component-chart-label)" style={{textDecoration:"underline"}}>{m.month.slice(2)}</text></a></g>})}
    </svg></div>
    <details className="mt-2 text-sm"><summary className="cursor-pointer text-brand-600">월별 숫자 자세히 보기</summary><div className="mt-3 overflow-x-auto"><table className="ph-table ph-table--compact min-w-[650px]"><thead><tr><th scope="col" className="p-2 text-left">월</th><th scope="col">유입</th><th scope="col">유출</th><th scope="col">순흐름</th><th scope="col">전월 대비 유입 / 유출 / 순흐름</th></tr></thead><tbody>{months.map((m,i)=><tr key={m.month} className="border-t border-navy-100"><th scope="row" className="p-2 text-left"><Link href={href(m.month)} className="text-brand-600 underline">{m.month}</Link></th><td className="ph-number">{amountText(incoming(m))}</td><td className="ph-number">{amountText(outgoing(m))}</td><td className="ph-number">{nets[i].missing?"미확정":amountText(nets[i])}</td><td className="p-2">{i===0?"비교 기간의 첫 달":[diff(incoming(m),incoming(months[i-1])),diff(outgoing(m),outgoing(months[i-1])),diff(nets[i],nets[i-1])].join(" / ")}</td></tr>)}</tbody></table></div></details>
  </section>;
}
