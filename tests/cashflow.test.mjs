import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource, customer, profile, movement } from './cashflow-loader.mjs';
const { projectCashflow: project, amountText, validMonth, koreaToday } = loadSource('src/lib/admin/cashflow.ts');
const run = (c = customer(), p = profile(), ms = [], month = '2026-02') => project([c], p ? [p] : [], ms, month, '2026-10-02');
test('month end remains Jan31 Feb28 Mar31', () => {
  const r = run(); assert.equal(r.totals.rentalPlan.value, 1100000); assert.equal(r.rows[0].details[0].date, '2026-02-28');
  assert.equal(run(customer(), profile(), [], '2026-03').rows[0].details[0].date, '2026-03-31');
});
test('custom dates crossing months and null amounts preserved', () => {
  const c = customer({ payment_schedule: [{ no: 2, dueDate: '2026-03-05', amount: 700000 }, { no: 3, dueDate: '2026-03-31', amount: null }] });
  assert.equal(run(c).totals.rentalPlan.value, 0);
  const r = run(c, profile(), [], '2026-03'); assert.equal(r.totals.rentalPlan.value, 700000); assert.equal(r.totals.rentalPlan.missing, 1);
});
test('invalid custom schedule does not fall back', () => { const r = run(customer({ payment_schedule: [{ no: 1, dueDate: '2026-02-30', amount: 1 }] })); assert.equal(r.totals.rentalPlan.known, 0); assert.ok(r.totals.rentalPlan.missing); });
test('paid_count never generates actual cash', () => { const r = run(customer({ paid_count: 12 })); assert.equal(r.totals.rentalActual.known, 0); assert.match(amountText(r.totals.rentalActual), /미입력/); });
test('partial, advance and correction receipts use cash date', () => {
  const c = customer({ receipt_ledger: { legacyPaidCount: 0, entries: [{ id: 'a', no: 5, amount: 300000, receivedDate: '2026-02-01' }, { id: 'b', no: 1, amount: 200000, receivedDate: '2026-02-02' }, { id: 'c', no: 1, amount: -100000, receivedDate: '2026-03-01', reverses: 'b' }] } });
  assert.equal(run(c).totals.rentalActual.value, 500000); assert.equal(run(c, profile(), [], '2026-03').totals.rentalActual.value, -100000);
});
test('legacy paid and empty ledger never imply certainty', () => {
  assert.ok(run(customer({ receipt_ledger: { legacyPaidCount: 2, entries: [] } })).totals.rentalActual.missing);
  assert.ok(run(customer({ receipt_ledger: { legacyPaidCount: 0, entries: [] } })).totals.rentalActual.missing);
});
test('own funding not applicable; unknown funding missing', () => {
  const own = run(customer(), profile({ funding_type: 'own', creditor_name: null })); assert.equal(own.rows[0].flows.creditorActual.na, true); assert.equal(own.totals.creditorActual.missing, 0);
  assert.ok(run(customer(), null).totals.creditorActual.missing);
});
test('no double counting plan actual inflow and disbursement', () => {
  const c = customer({ funding_done_date: '2026-02-03', receipt_ledger: { legacyPaidCount: 0, entries: [{ id: 'a', no: 1, amount: 1000000, receivedDate: '2026-02-04' }] } });
  const r = run(c, profile(), [movement(), movement({ id: 'm2', basis: 'actual', amount: 700000 }), movement({ id: 'm3', kind: 'securitization_inflow', basis: 'actual', amount: 8000000 })]);
  assert.equal(r.actualNet.value, -1700000); assert.equal(r.cumulative.value, 10000000); assert.equal(r.totals.creditorPlan.value, 800000);
});
test('missing disbursement date blocks certainty', () => { const r = run(customer({ funding_done_date: null })); assert.ok(r.cumulative.missing); assert.ok(r.totals.fundingActual.missing); assert.equal(r.cumulative.known, 0); });
test('future actual excluded from money spent', () => { const r = run(customer({ funding_done_date: '2026-12-01' }), profile(), [], '2026-12'); assert.equal(r.cumulative.value, 0); assert.ok(r.cumulative.missing); assert.equal(r.totals.fundingActual.value, 0); });
test('undated movements appear as missing across months', () => { const r = run(customer(), profile(), [movement({ cash_date: null })]); assert.ok(r.totals.creditorPlan.missing); assert.ok(r.totals.creditorActual.missing); });
test('duplicate receipt excluded and flagged', () => { const e = { id: 'a', no: 1, amount: 12, receivedDate: '2026-02-03' }; const r = run(customer({ receipt_ledger: { legacyPaidCount: 0, entries: [e, e] } })); assert.equal(r.totals.rentalActual.value, 12); assert.ok(r.totals.rentalActual.missing); });
test('Korean boundary and malformed period', () => { assert.equal(koreaToday(new Date('2026-09-30T16:00:00Z')), '2026-10-01'); assert.equal(validMonth('2026-13'), false); assert.throws(() => run(customer(), profile(), [], 'bad')); });
test('entered zero remains known zero', () => { const r = run(customer({ rental_price: 0 })); assert.equal(r.totals.rentalPlan.known, 1); assert.equal(amountText(r.totals.rentalPlan), '₩0'); });
test('records in another month cannot imply zero payment conditions', () => { const r = run(customer(), profile(), [movement({ cash_date: '2026-01-31' })]); assert.ok(r.totals.creditorPlan.missing); });
test('movements on early pipeline customers remain in scope', () => { const r = run(customer({ stage: 'intake', first_payment_date: null, funding_done: false, funding_scheduled_date: null }), profile(), [movement()]); assert.equal(r.rows.length, 1); });
