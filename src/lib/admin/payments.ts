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
};

const pad = (n: number) => String(n).padStart(2, "0");

// 로컬 기준 오늘 날짜(YYYY-MM-DD).
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
  if (!c.first_payment_date || !c.rental_months || c.rental_months <= 0)
    return [];
  const total = Math.min(c.rental_months, 600);
  const paidCount = c.paid_count ?? 0;
  const out: Installment[] = [];
  for (let n = 1; n <= total; n++) {
    const dueDate = addMonths(c.first_payment_date, n - 1);
    const paid = n <= paidCount;
    out.push({
      no: n,
      dueDate,
      amount: c.rental_price ?? null,
      paid,
      status: statusFor(dueDate, paid, today),
    });
  }
  return out;
}

// 다음 미납 회차 1건(없으면 null) — 대시보드 인박스·상세 요약 공용.
export function nextDue(c: ScheduleInput, today = todayISO()): Installment | null {
  if (!c.first_payment_date || !c.rental_months || c.rental_months <= 0)
    return null;
  const n = (c.paid_count ?? 0) + 1;
  if (n > c.rental_months) return null;
  const dueDate = addMonths(c.first_payment_date, n - 1);
  return {
    no: n,
    dueDate,
    amount: c.rental_price ?? null,
    paid: false,
    status: statusFor(dueDate, false, today),
  };
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
