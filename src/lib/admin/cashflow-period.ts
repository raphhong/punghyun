import { shiftMonth, validMonth } from "./cashflow";
export const CASHFLOW_START_MONTH = "2026-09";
export function cashflowPeriod(selectedMonth: string, range: unknown, from: unknown, to: unknown) {
  selectedMonth = selectedMonth < CASHFLOW_START_MONTH ? CASHFLOW_START_MONTH : selectedMonth;
  const size = range === "3" ? 3 : range === "12" ? 12 : 6;
  let start = shiftMonth(selectedMonth, 1 - size), end = selectedMonth, warning: string | undefined;
  if (range === "custom") {
    if (validMonth(from) && validMonth(to) && from <= to) {
      const count = (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5)) - Number(from.slice(5)) + 1;
      if (count <= 36) { start = from; end = to; }
      else warning = "직접 비교 기간은 최대 36개월입니다. 선택 월까지 6개월로 표시합니다.";
    } else warning = "직접 비교 기간의 시작·종료 월을 확인하세요. 선택 월까지 6개월로 표시합니다.";
  }
  if (start < CASHFLOW_START_MONTH) start = CASHFLOW_START_MONTH;
  if (end < CASHFLOW_START_MONTH) { end = CASHFLOW_START_MONTH; warning = "현금흐름은 2026년 9월부터 조회할 수 있습니다."; }
  const months: string[] = [];
  for (let m = start; m <= end; m = shiftMonth(m, 1)) months.push(m);
  return { months, start, end, range: range === "custom" && !warning ? "custom" : String(size), warning };
}
