// 회차별 렌탈료 입금 스케줄 계산 — 서버(대시보드/상세)·클라이언트 공용 순수 함수.
// 모델: 첫 입금일(first_payment_date) + 총 회차(rental_months) → 매월 같은 날짜로 N회차 예정.
// 완납은 순차(paid_count): n <= paid_count 이면 납부 완료.

export type PaymentStatus =
  | "paid"
  | "overdue"
  | "due_today"
  | "upcoming"
  | "scheduled";

export type Installment = {
  no: number;
  dueDate: string; // YYYY-MM-DD
  amount: number | null;
  paid: boolean;
  status: PaymentStatus;
};

export type ScheduleInput = {
  first_payment_date: string | null;
  rental_months: number | null;
  paid_count: number | null;
  rental_price: number | null;
  payment_schedule?: unknown;
};

export type PlannedInstallment = { no: number; dueDate: string; amount: number | null };

export function validPaymentDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validPlannedRows(value: unknown): value is PlannedInstallment[] {
  return Array.isArray(value) && value.length <= 600 && value.every(r =>
    r && typeof r === "object" && Number.isInteger(r.no) && r.no >= 1 && r.no <= 600 &&
    validPaymentDate(r.dueDate) && (r.amount === null || (Number.isSafeInteger(r.amount) && r.amount >= 0))
  ) && new Set(value.map(r => r.no)).size === value.length;
}

// A complete custom schedule works without monthly defaults. Legacy partial
// overrides still use those defaults; invalid data never silently falls back.
export function plannedSchedule(c: ScheduleInput): { rows: PlannedInstallment[]; error?: string } {
  const custom = c.payment_schedule;
  if (custom != null && !validPlannedRows(custom)) return { rows: [], error: "개별 납부 일정 오류: 기본 일정으로 대체하지 않음" };
  const overrides = (custom ?? []) as PlannedInstallment[];
  const months = c.rental_months;
  const total = months ?? overrides.length;
  if (!Number.isInteger(total) || total < 1 || total > 600 || overrides.some(r => r.no > total))
    return { rows: [], error: "렌탈 일정 기준(총 회차) 미입력 또는 오류" };
  const rows: PlannedInstallment[] = [];
  for (let no = 1; no <= total; no++) {
    const override = overrides.find(r => r.no === no);
    if (override) rows.push({ ...override });
    else if (validPaymentDate(c.first_payment_date)) rows.push({ no, dueDate: addMonths(c.first_payment_date, no - 1), amount: c.rental_price });
    else return { rows: [], error: "렌탈 일정 기준(첫 납부일·총 회차) 미입력 또는 오류" };
  }
  return { rows };
}

const pad = (n: number) => String(n).padStart(2, "0");

// 서버와 브라우저의 시간대에 관계없이 한국 기준 오늘 날짜(YYYY-MM-DD).
export function todayISO(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(now);
}

// iso 날짜에 m개월 더하기 — 같은 '일'을 유지하되 월말은 해당 월 마지막 날로 보정.
export function addMonths(iso: string, m: number): string {
  const [y, mo, d] = iso.split("-").map(Number);
  const base = new Date(y, mo - 1 + m, 1);
  const year = base.getFullYear();
  const month = base.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(d, lastDay);
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

// from → to 사이 일수(양수=미래).
export function daysBetween(fromISO: string, toISO: string): number {
  const [y1, m1, d1] = fromISO.split("-").map(Number);
  const [y2, m2, d2] = toISO.split("-").map(Number);
  return Math.round(
    (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000,
  );
}

function statusFor(
  dueISO: string,
  paid: boolean,
  today: string,
): PaymentStatus {
  if (paid) return "paid";
  if (dueISO < today) return "overdue";
  if (dueISO === today) return "due_today";
  return daysBetween(today, dueISO) <= 7 ? "upcoming" : "scheduled";
}

export function buildSchedule(
  c: ScheduleInput,
  today = todayISO(),
): Installment[] {
  const paidCount = c.paid_count ?? 0;
  return plannedSchedule(c).rows.map(row => ({ ...row, paid: row.no <= paidCount, status: statusFor(row.dueDate, row.no <= paidCount, today) }));
}

// 다음 미납 회차 1건(없으면 null) — 대시보드 인박스·상세 요약 공용.
export function nextDue(c: ScheduleInput, today = todayISO()): Installment | null {
  return buildSchedule(c, today).find(row => !row.paid) ?? null;
}

export function fmtWon(n: number | null | undefined): string {
  if (n == null) return "-";
  return "₩" + n.toLocaleString("ko-KR");
}

// 예정일 배지용 라벨 — 연체 n일 / 오늘 / D-n.
export function dueLabel(dueISO: string, today = todayISO()): string {
  const diff = daysBetween(today, dueISO);
  if (diff < 0) return `연체 ${-diff}일`;
  if (diff === 0) return "오늘";
  return `D-${diff}`;
}
