import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource, customer, profile, movement } from './cashflow-loader.mjs';

const { resolvePaymentSchedule, buildSchedule, nextDue, addMonths, daysBetween, validDate } = loadSource('src/lib/admin/payments.ts');
const { projectCashflow } = loadSource('src/lib/admin/cashflow.ts');
const today = '2026-10-02';
const base = extra => customer({ rental_months: 3, rental_price: 1000, paid_count: 0, ...extra });
const receipt = extra => movement({ kind: 'rental_receipt', basis: 'actual', installment_no: 1, cash_date: '2026-02-28', amount: 1000, ...extra });
const project = (c, month = '2026-03') => projectCashflow([c], [profile()], [], month, today);

test('one resolved plan drives monthly projections, display and next due', () => {
  const c = base({ paid_count: 1, payment_schedule: [{ no: 2, dueDate: '2026-03-05', amount: 700 }, { no: 3, dueDate: '2026-03-31', amount: null }] });
  const resolved = resolvePaymentSchedule(c);
  assert.deepEqual(resolved, { ok: true, installments: [
    { no: 1, dueDate: '2026-01-31', amount: 1000 },
    { no: 2, dueDate: '2026-03-05', amount: 700 },
    { no: 3, dueDate: '2026-03-31', amount: null },
  ] });
  const rows = buildSchedule(c, today);
  assert.deepEqual(rows.map(({ no, dueDate, amount }) => ({ no, dueDate, amount })), resolved.installments);
  assert.deepEqual(nextDue(c, today), rows[1]);
  assert.equal(project(c, '2026-02').totals.rentalPlan.value, 0);
  assert.deepEqual(project(c).totals.rentalPlan, { value: 700, known: 1, missing: 1 });
  assert.deepEqual(project(c).rows[0].details.filter(d => d.label.startsWith('렌탈 예정')).map(d => ({ dueDate: d.date, amount: d.amount })),
    resolved.installments.slice(1).map(({ dueDate, amount }) => ({ dueDate, amount })));
});

test('absent, null and empty overrides preserve month-end defaults without mutation', () => {
  for (const payment_schedule of [undefined, null, []]) {
    const c = Object.freeze(base({ payment_schedule }));
    assert.deepEqual(buildSchedule(c, today).map(r => r.dueDate), ['2026-01-31', '2026-02-28', '2026-03-31']);
  }
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(addMonths('0099-01-31', 1), '0099-02-28');
  assert.equal(daysBetween('0099-12-31', '0100-01-01'), 1);
  assert.equal(validDate('2026-02-30'), false);
});

test('overrides may be unordered and preserve explicit zero and unknown amount', () => {
  const payment_schedule = Object.freeze([
    Object.freeze({ no: 3, dueDate: '2026-03-30', amount: 0 }),
    Object.freeze({ no: 1, dueDate: '2026-02-01', amount: null }),
  ]);
  const c = base({ payment_schedule });
  assert.deepEqual(resolvePaymentSchedule(c).installments.map(r => r.amount), [null, 1000, 0]);
  assert.deepEqual(project(c).totals.rentalPlan, { value: 0, known: 1, missing: 0 });
  assert.equal(buildSchedule(c, today)[0].paid, false);
});

test('all malformed overrides fail closed in every consumer', () => {
  const entry = { no: 1, dueDate: '2026-03-03', amount: 1000 };
  for (const payment_schedule of [
    {}, '[]', 0, false, [null], [entry, entry], new Array(1),
    [{ ...entry, no: 0 }], [{ ...entry, no: 4 }], [{ ...entry, no: 1.5 }], [{ ...entry, no: '1' }],
    [{ ...entry, dueDate: '2026-02-30' }], [{ ...entry, dueDate: '2026-3-03' }], [{ ...entry, dueDate: '2026-03-03T00:00:00Z' }],
    [{ ...entry, amount: -1 }], [{ ...entry, amount: 1.5 }], [{ ...entry, amount: '1000' }],
    [{ ...entry, amount: Number.MAX_SAFE_INTEGER + 1 }], [{ ...entry, amount: NaN }], [{ ...entry, amount: Infinity }],
    [{ no: 1, dueDate: entry.dueDate }],
  ]) {
    const c = base({ payment_schedule });
    assert.deepEqual(resolvePaymentSchedule(c), { ok: false, error: 'invalid_override' });
    assert.deepEqual(buildSchedule(c, today), []);
    assert.equal(nextDue(c, today), null);
    const flow = project(c).totals.rentalPlan;
    assert.deepEqual(flow, { value: 0, known: 0, missing: 1 });
    assert.ok(project(c).rows[0].issues.some(issue => issue.includes('기본 일정으로 대체하지 않음')));
  }
});

test('invalid basis fails consistently instead of clamping or rounding installment counts', () => {
  for (const extra of [
    { first_payment_date: null }, { first_payment_date: '2026-02-30' },
    { rental_months: null }, { rental_months: 0 }, { rental_months: -1 }, { rental_months: 1.1 },
    { rental_months: 601 }, { rental_months: '3' }, { rental_months: NaN }, { rental_months: Infinity },
    { first_payment_date: '9999-12-31', rental_months: 2 },
  ]) {
    const c = base(extra);
    assert.deepEqual(resolvePaymentSchedule(c), { ok: false, error: 'invalid_basis' });
    assert.deepEqual(buildSchedule(c, today), []);
    assert.equal(nextDue(c, today), null);
    assert.deepEqual(project(c).totals.rentalPlan, { value: 0, known: 0, missing: 1 });
  }
  assert.equal(buildSchedule(base({ rental_months: 600 }), today).length, 600);
});

test('missing or invalid default amounts remain unknown in schedule and projection', () => {
  for (const rental_price of [null, undefined, -1, 0.1, '1000', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const c = base({ rental_price });
    assert.equal(resolvePaymentSchedule(c).installments[0].amount, null);
    assert.equal(buildSchedule(c, today)[0].amount, null);
    assert.deepEqual(project(c).totals.rentalPlan, { value: 0, known: 0, missing: 1 });
  }
  assert.equal(resolvePaymentSchedule(base({ rental_price: Number.MAX_SAFE_INTEGER })).installments[0].amount, Number.MAX_SAFE_INTEGER);
});

test('schedule status follows the override date including today and upcoming windows', () => {
  const c = base({ payment_schedule: [{ no: 1, dueDate: today, amount: 1000 }, { no: 2, dueDate: '2026-10-09', amount: 1000 }, { no: 3, dueDate: '2026-10-10', amount: 1000 }] });
  assert.deepEqual(buildSchedule(c, today).map(r => r.status), ['due_today', 'upcoming', 'scheduled']);
  assert.equal(nextDue(base(), today).status, 'overdue');
});

test('legacy paid_count remains a completion label, even with an empty receipt array', () => {
  for (const rental_receipts of [undefined, []]) {
    const c = base({ paid_count: 2, rental_receipts });
    const rows = buildSchedule(c, today);
    assert.deepEqual(rows.map(r => r.paidEvidence), ['legacy', 'legacy', null]);
    assert.equal(nextDue(c, today).no, 3);
    assert.equal(project(c).totals.rentalActual.value, 0);
    assert.equal(project(c).totals.rentalActual.known, 0);
  }
  assert.equal(nextDue(base({ paid_count: 3 }), today), null);
});

test('invalid paid counts never manufacture completion labels', () => {
  for (const paid_count of [-1, 1.5, '2', NaN, Infinity]) {
    assert.equal(nextDue(base({ paid_count }), today).no, 1);
  }
});

test('partial actual receipts accumulate only for their explicit installment', () => {
  const c = base({ rental_receipts: [receipt({ id: 'r1', amount: 400 }), receipt({ id: 'r2', amount: 600 }), receipt({ id: 'r3', installment_no: 3 })] });
  const rows = buildSchedule(c, today);
  assert.deepEqual(rows.map(r => r.paidEvidence), ['receipt', null, 'receipt']);
  assert.equal(nextDue(c, today).no, 2);
  assert.equal(buildSchedule(base({ rental_receipts: [receipt({ amount: 999 })] }), today)[0].paid, false);
});

test('receipt completion uses overridden amount and keeps null amount unknown', () => {
  const c = base({ payment_schedule: [{ no: 1, dueDate: '2026-03-03', amount: 1500 }], rental_receipts: [receipt()] });
  assert.equal(buildSchedule(c, today)[0].paid, false);
  c.rental_receipts.push(receipt({ id: 'r2', amount: 500 }));
  assert.equal(buildSchedule(c, today)[0].paidEvidence, 'receipt');
  c.payment_schedule[0].amount = null;
  assert.equal(buildSchedule(c, today)[0].paid, false);
});

test('legacy and receipt evidence can coexist without adding legacy counts to receipt amounts', () => {
  const c = base({ paid_count: 1, rental_receipts: [receipt({ installment_no: 2, amount: 500 })] });
  assert.deepEqual(buildSchedule(c, today).map(r => r.paidEvidence), ['legacy', null, null]);
  c.rental_receipts.push(receipt({ id: 'r2', installment_no: 2, amount: 500 }));
  assert.deepEqual(buildSchedule(c, today).map(r => r.paidEvidence), ['legacy', 'receipt', null]);
});

test('unverified, undated, future or non-rental movements cannot complete installments', () => {
  for (const entry of [
    null, {}, receipt({ id: '' }), receipt({ kind: 'funding_disbursement' }), receipt({ basis: 'planned' }),
    receipt({ cash_date: null, cash_month: '2026-02' }), receipt({ cash_date: '2026-02-30' }), receipt({ cash_date: '2026-10-03' }),
    receipt({ amount: null }), receipt({ amount: -1000 }), receipt({ amount: 1000.1 }), receipt({ amount: '1000' }),
    receipt({ amount: Number.MAX_SAFE_INTEGER + 1 }), receipt({ installment_no: null }), receipt({ installment_no: 0 }),
    receipt({ installment_no: 4 }), receipt({ installment_no: 1.5 }), receipt({ installment_no: '1' }),
  ]) {
    assert.equal(buildSchedule(base({ rental_receipts: [entry] }), today)[0].paid, false);
  }
});

test('duplicate movement IDs and unsafe aggregate totals cannot establish completion', () => {
  assert.equal(buildSchedule(base({ rental_receipts: [receipt(), receipt()] }), today)[0].paid, false);
  assert.equal(buildSchedule(base({ rental_receipts: [receipt({ amount: Number.MAX_SAFE_INTEGER }), receipt({ id: 'r2', amount: 1 })] }), today)[0].paid, false);
});

test('known zero requires an actual zero receipt or an existing legacy completion label', () => {
  assert.equal(buildSchedule(base({ rental_price: 0 }), today)[0].paid, false);
  assert.equal(buildSchedule(base({ rental_price: 0, rental_receipts: [receipt({ amount: 0 })] }), today)[0].paidEvidence, 'receipt');
});

test('actual receipt dates stay in their cash month despite overridden due date and paid_count', () => {
  const c = base({ paid_count: 3, payment_schedule: [{ no: 1, dueDate: '2026-03-03', amount: 1000 }] });
  const movements = [receipt()];
  const feb = projectCashflow([c], [profile()], movements, '2026-02', today);
  const mar = projectCashflow([c], [profile()], movements, '2026-03', today);
  assert.equal(feb.totals.rentalActual.value, 1000);
  assert.equal(mar.totals.rentalActual.value, 0);
  assert.equal(mar.totals.rentalPlan.value, 2000);
});
