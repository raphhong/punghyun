import { shiftMonth, validMonth } from "./cashflow";
export function cashflowPeriod(selectedMonth: string, range: unknown, from: unknown, to: unknown) {
  const size = range === "3" ? 3 : range === "12" ? 12 : 6;
  let start = shiftMonth(selectedMonth, 1 - size), end = selectedMonth, warning: string | undefined;
  if (range === "custom") {
    if (validMonth(from) && validMonth(to) && from <= to) {
      const count = (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5)) - Number(from.slice(5)) + 1;
      if (count <= 36) { start = from; end = to; }
      else warning = "직접 비교 기간은 최대 36개월입니다. 선택 월까지 6개월로 표시합니다.";
    } else warning = "직접 비교 기간의 시작·종료 월을 확인하세요. 선택 월까지 6개월로 표시합니다.";
  }
  if (start < "1900-01") start = "1900-01";
  const months: string[] = [];
  for (let m = start; m <= end; m = shiftMonth(m, 1)) months.push(m);
  return { months, start, end, range: range === "custom" && !warning ? "custom" : String(size), warning };
}
