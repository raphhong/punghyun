import Link from "next/link";
import { amountText, totalAmounts, type Amount, type FlowKey } from "@/lib/admin/cashflow";

export type CashflowChartMonth = { month: string; totals: Record<FlowKey, Amount>; plannedNet: Amount; actualNet: Amount };
export function CashflowCharts({ months, selectedMonth, basis, basePath }: { months: CashflowChartMonth[]; selectedMonth: string; basis: "planned" | "actual"; basePath: string }) {
  const query = `&range=custom&from=${months[0].month}&to=${months[months.length - 1].month}`;
  const monthHref = (m: string) => `${basePath}?month=${m}&basis=${basis}${query}#cashflow-month-detail`;
  const actual = basis === "actual";
  const suffix = actual ? "Actual" : "Plan";
  const series = [
    { label: "렌탈료 유입", prefix: "rental", color: "#1b4680" },
    { label: "유동화 유입", prefix: "inflow", color: "#0891b2" },
    { label: "자금 집행", prefix: "funding", color: "#d65a31" },
    { label: "채권사 지급", prefix: "creditor", color: "#7c3aed" },
  ] as const;
  const incomplete = months.filter(m => series.some(s => m.totals[`${s.prefix}${suffix}`].missing > 0)).length;
  const max = Math.max(10000, ...months.flatMap(m => series.map(s => Math.abs(m.totals[`${s.prefix}${suffix}`].value))));
  const width = Math.max(760, months.length * 70 + 110), left = 76, step = (width - 106) / months.length, baseline = 215, height = 170;
  const nets = months.map(m => actual ? m.actualNet : m.plannedNet);
  const netMax = Math.max(10000, ...nets.filter(a => !a.missing).map(a => Math.abs(a.value)));
  const netY = (v: number) => 125 - v / netMax * 85;
  const units = (v: number) => `${(v / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}만`;
  const selectedIndex = months.findIndex(m => m.month === selectedMonth);
  const selected = months[selectedIndex], previous = months[selectedIndex - 1];
  const delta = (prefixes: ("rental" | "inflow" | "funding" | "creditor")[]) => {
    if (!selected || !previous) return "비교할 전월을 기간에 포함해 주세요";
    const current = totalAmounts(prefixes.map(p => selected.totals[`${p}${suffix}`]));
    const before = totalAmounts(prefixes.map(p => previous.totals[`${p}${suffix}`]));
    if (current.missing || before.missing) return "미확정 · 데이터 확인 필요";
    const change = current.value - before.value;
    return `${change > 0 ? "+" : ""}${change.toLocaleString("ko-KR")}원`;
  };
  return <section className="rounded-2xl border border-navy-100 bg-white p-4 sm:p-5" aria-labelledby="cashflow-chart-title">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="cashflow-chart-title" className="font-semibold">{months[0].month} ~ {months[months.length - 1].month} 돈의 흐름</h2><p className="mt-1 text-sm text-navy-500">막대는 들어오는 돈과 나가는 돈의 크기, 선은 그 차이입니다.</p></div><nav aria-label="그래프 예정 실제 선택" className="flex gap-2">{(["planned", "actual"] as const).map(b => <Link key={b} href={`${basePath}?month=${selectedMonth}&basis=${b}${query}`} aria-current={basis === b ? "page" : undefined} className={`rounded-lg border px-4 py-2 text-sm font-semibold ${basis === b ? "border-brand-500 bg-brand-500 text-white" : "border-navy-200 text-navy-600"}`}>{b === "planned" ? "예정 보기" : "실제 보기"}</Link>)}</nav></div>
    <p className="mt-3 text-sm font-semibold">{actual ? "실제 현금 이동일 기준" : "약정 예정일 기준"} · 단위: 만원</p>
    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3"><p className="rounded-lg bg-navy-50 p-3">선택 월 유입 · 전월 대비<br /><strong>{delta(["rental", "inflow"])}</strong></p><p className="rounded-lg bg-navy-50 p-3">선택 월 유출 · 전월 대비<br /><strong>{delta(["funding", "creditor"])}</strong></p><p className="rounded-lg bg-navy-50 p-3">선택 월 순흐름 · 전월 대비<br /><strong>{!selected || !previous ? "전월 비교 자료 없음" : nets[selectedIndex].missing || nets[selectedIndex - 1].missing ? "미확정 · 데이터 확인 필요" : `${nets[selectedIndex].value - nets[selectedIndex - 1].value > 0 ? "+" : ""}${(nets[selectedIndex].value - nets[selectedIndex - 1].value).toLocaleString("ko-KR")}원`}</strong></p></div>
    {incomplete > 0 && <p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{months.length}개월 중 {incomplete}개월의 데이터가 미완성입니다. 빗금 막대는 확인된 금액만 표시하며 전체 금액이 아닙니다. ?는 미확인입니다. 미완성 월의 순현금흐름 선은 연결하지 않습니다.</p>}
    <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs">{series.map(s => <li key={s.prefix} className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: s.color }} />{s.label} ({s.prefix === "rental" || s.prefix === "inflow" ? "들어옴" : "나감"})</li>)}</ul>
    <p className="mt-3 text-xs text-navy-500 sm:hidden">그래프를 좌우로 밀면 선택 기간을 볼 수 있습니다. 월을 누르면 해당 월 상세로 이동합니다.</p>
    <div className="mt-2 overflow-x-auto"><svg viewBox={`0 0 ${width} 280`} className="w-full" style={{ minWidth: Math.max(760, months.length * 60) }} role="img" aria-label={`${actual ? "실제" : "예정"} 월별 렌탈료·유동화 유입과 집행·채권사 지급 막대그래프`}>
      <defs>{series.map(s => <pattern key={s.prefix} id={`cash-hatch-${s.prefix}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="white" /><rect width="2" height="6" fill={s.color} /></pattern>)}</defs>
      {[0, 0.5, 1].map(r => <g key={r}><line x1={left - 10} x2={width - 25} y1={baseline - r * height} y2={baseline - r * height} stroke="#d6dfea" /><text x={left - 18} y={baseline - r * height + 4} textAnchor="end" fontSize="11" fill="#2f4a72">{units(max * r)}</text></g>)}
      {months.map((m, i) => <a key={m.month} href={monthHref(m.month)} aria-label={`${m.month} 상세 보기`}><rect x={left + i * step - 4} y="28" width={step - 4} height="225" fill="transparent" pointerEvents="all" />{m.month === selectedMonth && <rect x={left + i * step - 4} y="28" width="65" height="225" rx="5" fill="#1b4680" opacity="0.05" />}{series.map((s, j) => {
        const a = m.totals[`${s.prefix}${suffix}`], x = left + i * step + j * 14, h = Math.abs(a.value) / max * height;
        return <g key={s.prefix}><title>{`${m.month} ${s.label}: ${amountText(a)}${a.missing ? " · 전체 금액 미확정" : ""}`}</title>{a.missing && !a.known ? <text x={x + 5} y={baseline - 7} fill={s.color} fontSize="13" textAnchor="middle">?</text> : <><rect x={x} y={baseline - h} width="10" height={Math.max(h, 1)} fill={a.missing ? `url(#cash-hatch-${s.prefix})` : s.color} stroke={s.color} />{a.value < 0 && <text x={x + 5} y={baseline - h - 6} fontSize="10" textAnchor="middle" fill={s.color}>−</text>}</>}</g>;
      })}<text x={left + i * step + 25} y="245" textAnchor="middle" fontSize="12" fill="#14284a">{m.month.slice(2)}</text></a>)}
    </svg></div>
    <h3 className="mt-3 text-sm font-semibold">월 순현금흐름 · {actual ? "실제" : "예정"}</h3><p className="mt-1 text-xs text-navy-500">0선 위는 유입이 더 큼, 아래는 유출이 더 큼. ?는 계산에 필요한 데이터가 부족한 월입니다.</p>
    <div className="overflow-x-auto"><svg viewBox={`0 0 ${width} 260`} className="w-full" style={{ minWidth: Math.max(760, months.length * 60) }} role="img" aria-label={`${actual ? "실제" : "예정"} 월 순현금흐름 선그래프; 미완성 월은 연결하지 않음`}>
      {[-1, 0, 1].map(r => <g key={r}><line x1={left - 10} x2={width - 25} y1={netY(netMax * r)} y2={netY(netMax * r)} stroke="#adbfd5" strokeDasharray={r ? "4 4" : undefined} /><text x={left - 18} y={netY(netMax * r) + 4} textAnchor="end" fontSize="11" fill="#2f4a72">{units(netMax * r)}</text></g>)}
      {months.map((m, i) => { const a = nets[i], x = left + i * step + 25, prev = nets[i - 1]; return <a key={m.month} href={monthHref(m.month)} aria-label={`${m.month} 순현금흐름 상세 보기`}><rect x={left + i * step - 4} y="28" width={step - 4} height="215" fill="transparent" pointerEvents="all" /><title>{`${m.month} 순현금흐름: ${a.missing ? "전체 금액 미확정" : amountText(a)}`}</title>{a.missing ? <text x={x} y="129" textAnchor="middle" fill="#92400e" fontSize="16">?</text> : <>{i > 0 && !prev.missing && <line x1={x - step} x2={x} y1={netY(prev.value)} y2={netY(a.value)} stroke="#1b4680" strokeWidth="2.5" />}<circle cx={x} cy={netY(a.value)} r="4" fill="#1b4680" /></>}<text x={x} y="240" textAnchor="middle" fontSize="12" fill="#14284a">{m.month.slice(2)}</text></a>; })}
    </svg></div>
    <details className="mt-2 text-sm"><summary className="cursor-pointer text-brand-600">월별 총유입·총유출·전월 대비 숫자 확인</summary><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[720px] text-right text-xs"><thead><tr><th scope="col" className="p-2 text-left">월</th><th scope="col">총유입</th><th scope="col">총유출</th><th scope="col">순현금흐름</th><th scope="col">전월 대비 유입 / 유출 / 순흐름</th></tr></thead><tbody>{months.map((m, i) => {
      const incoming = (point: CashflowChartMonth) => totalAmounts([point.totals[`rental${suffix}`], point.totals[`inflow${suffix}`]]);
      const outgoing = (point: CashflowChartMonth) => totalAmounts([point.totals[`funding${suffix}`], point.totals[`creditor${suffix}`]]);
      const change = (a: Amount, b: Amount) => a.missing || b.missing ? "미확정" : `${a.value - b.value > 0 ? "+" : ""}${(a.value - b.value).toLocaleString("ko-KR")}원`;
      return <tr key={m.month} className="border-t border-navy-100"><th scope="row" className="p-2 text-left"><Link href={monthHref(m.month)} className="text-brand-600 underline">{m.month}</Link></th><td className="p-2">{amountText(incoming(m))}</td><td className="p-2">{amountText(outgoing(m))}</td><td className="p-2">{nets[i].missing ? "미확정" : amountText(nets[i])}</td><td className="p-2">{i === 0 ? "비교 기간의 첫 달" : [change(incoming(m), incoming(months[i - 1])), change(outgoing(m), outgoing(months[i - 1])), change(nets[i], nets[i - 1])].join(" / ")}</td></tr>;
    })}</tbody></table></div></details>
  </section>;
}
