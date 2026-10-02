// 회차별 렌탈료 입금 스케줄 계산 — 서버(대시보드/상세)·클라이언트 공용 순수 함수.
// 모델: 첫 입금일(first_payment_date) + 총 회차(rental_months) → 매월 같은 날짜로 N회차 예정.
// 과거 순차 완납(paid_count)은 상태 표시일 뿐 실제 현금 수납의 증거가 아님.

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
  paidEvidence?: "legacy" | "receipt" | null;
};

export type PaymentScheduleEntry = {
  no: number;
  dueDate: string;
  amount: number | null;
};

// Callers must supply only this customer's movements. Dates and amounts are
// checked again here; month-only or planned rows never prove receipt completion.
export type RentalReceiptMovement = {
  id: string;
  kind: string;
  basis: string;
  cash_date: string | null;
  amount: number | null;
  installment_no?: number | null;
};

export type ScheduleInput = {
  first_payment_date: string | null;
  rental_months: number | null;
  paid_count: number | null;
  rental_price: number | null;
  payment_schedule?: unknown;
  rental_receipts?: readonly RentalReceiptMovement[];
};

const pad = (n: number) => String(n).padStart(2, "0");
const money = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

export function validDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T00:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export type PaymentScheduleResolution =
  | { ok: true; installments: PaymentScheduleEntry[] }
  | { ok: false; error: "invalid_basis" | "invalid_override" };

// A partial override replaces only the specified installments. A malformed
// override invalidates the entire plan; silently using defaults could hide edits.
export function resolvePaymentSchedule(
  c: Pick<ScheduleInput, "first_payment_date" | "rental_months" | "rental_price" | "payment_schedule">,
): PaymentScheduleResolution {
  const total = c.rental_months;
  if (!validDate(c.first_payment_date) || total == null ||
      !Number.isSafeInteger(total) || total < 1 || total > 600) {
    return { ok: false, error: "invalid_basis" };
  }

  const overrides = new Map<number, PaymentScheduleEntry>();
  if (c.payment_schedule != null) {
    if (!Array.isArray(c.payment_schedule) || c.payment_schedule.length > total) {
      return { ok: false, error: "invalid_override" };
    }
    for (const entry of c.payment_schedule) {
      if (!object(entry) || typeof entry.no !== "number" ||
          !Number.isSafeInteger(entry.no) || entry.no < 1 || entry.no > total ||
          overrides.has(entry.no) || !validDate(entry.dueDate) ||
          (entry.amount !== null && !money(entry.amount))) {
        return { ok: false, error: "invalid_override" };
      }
      overrides.set(entry.no, { no: entry.no, dueDate: entry.dueDate, amount: entry.amount });
    }
  }

  const installments: PaymentScheduleEntry[] = [];
  for (let no = 1; no <= total; no++) {
    const override = overrides.get(no);
    const dueDate = override?.dueDate ?? addMonths(c.first_payment_date, no - 1);
    if (!validDate(dueDate)) return { ok: false, error: "invalid_basis" };
    installments.push({
      no,
      dueDate,
      amount: override ? override.amount : money(c.rental_price) ? c.rental_price : null,
    });
  }
  return { ok: true, installments };
}

// 로컬 기준 오늘 날짜(YYYY-MM-DD).
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// iso 날짜에 m개월 더하기 — 같은 '일'을 유지하되 월말은 해당 월 마지막 날로 보정.
export function addMonths(iso: string, m: number): string {
  const [y, mo, d] = iso.split("-").map(Number);
  // Use UTC and setFullYear to avoid local timezone/DST and the 1900 offset for
  // years 00–99 in Date's multi-argument constructor.
  const base = new Date(0);
  base.setUTCFullYear(y, mo - 1 + m, 1);
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();
  const end = new Date(base);
  end.setUTCMonth(month + 1, 0);
  const lastDay = end.getUTCDate();
  const day = Math.min(d, lastDay);
  return `${String(year).padStart(4, "0")}-${pad(month + 1)}-${pad(day)}`;
}

// from → to 사이 일수(양수=미래).
export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round(
    (Date.parse(toISO + "T00:00:00Z") - Date.parse(fromISO + "T00:00:00Z")) / 86400000,
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
  const resolved = resolvePaymentSchedule(c);
  if (!resolved.ok || !validDate(today)) return [];
  const paidCount = typeof c.paid_count === "number" && Number.isSafeInteger(c.paid_count) && c.paid_count > 0
    ? c.paid_count : 0;
  const receipts = receiptTotals(c.rental_receipts, resolved.installments.length, today);
  return resolved.installments.map(entry => {
    const received = receipts.get(entry.no);
    const receiptPaid = entry.amount != null && received != null && received >= entry.amount;
    const legacyPaid = entry.no <= paidCount;
    const paid = legacyPaid || receiptPaid;
    return {
      ...entry,
      paid,
      paidEvidence: receiptPaid ? "receipt" : legacyPaid ? "legacy" : null,
      status: statusFor(entry.dueDate, paid, today),
    };
  });
}

function receiptTotals(
  receipts: ScheduleInput["rental_receipts"],
  total: number,
  today: string,
): Map<number, number> {
  const sums = new Map<number, number>();
  if (!Array.isArray(receipts)) return sums;
  const ids = new Map<string, number>();
  for (const receipt of receipts) {
    if (object(receipt) && typeof receipt.id === "string") {
      ids.set(receipt.id, (ids.get(receipt.id) ?? 0) + 1);
    }
  }
  const overflow = new Set<number>();
  for (const receipt of receipts) {
    if (!object(receipt) || typeof receipt.id !== "string" || !receipt.id.trim() ||
        ids.get(receipt.id) !== 1 || receipt.kind !== "rental_receipt" || receipt.basis !== "actual" ||
        !validDate(receipt.cash_date) || receipt.cash_date > today || !money(receipt.amount) ||
        typeof receipt.installment_no !== "number" || !Number.isSafeInteger(receipt.installment_no) ||
        receipt.installment_no < 1 || receipt.installment_no > total) continue;
    const no = receipt.installment_no;
    const sum = (sums.get(no) ?? 0) + receipt.amount;
    if (!Number.isSafeInteger(sum)) overflow.add(no);
    sums.set(no, sum);
  }
  // Do not prove completion with an imprecise aggregate, even if each input was safe.
  for (const no of overflow) sums.delete(no);
  return sums;
}

// 다음 미납 회차 1건(없으면 null) — 대시보드 인박스·상세 요약 공용.
export function nextDue(c: ScheduleInput, today = todayISO()): Installment | null {
  return buildSchedule(c, today).find(entry => !entry.paid) ?? null;
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
