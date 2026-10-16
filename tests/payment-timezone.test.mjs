import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { loadSource } from './cashflow-loader.mjs';

const { todayISO, dueLabel } = loadSource('src/lib/admin/payments.ts');
const { koreaToday } = loadSource('src/lib/admin/cashflow.ts');

test('rental and cashflow dates change at Korean midnight, including year boundary', () => {
  for (const [instant, expected, label] of [
    ['2026-10-15T14:59:59Z', '2026-10-15', 'D-5'],
    ['2026-10-15T15:00:00Z', '2026-10-16', 'D-4'],
    ['2026-10-19T15:00:00Z', '2026-10-20', '오늘'],
    ['2026-10-20T15:00:00Z', '2026-10-21', '연체 1일'],
    ['2026-12-31T15:00:00Z', '2027-01-01', null],
  ]) {
    assert.equal(todayISO(new Date(instant)), expected);
    assert.equal(koreaToday(new Date(instant)), expected);
    if (label) assert.equal(dueLabel('2026-10-20', todayISO(new Date(instant))), label);
  }
});

test('default customer-detail and inbox calculations agree in UTC, Seoul and Los Angeles', () => {
  const script = `
    import { loadSource } from './tests/cashflow-loader.mjs';
    const RealDate = Date;
    globalThis.Date = class extends RealDate {
      constructor(...args) { super(...(args.length ? args : ['2026-10-15T16:00:00Z'])); }
    };
    const p = loadSource('src/lib/admin/payments.ts');
    const f = loadSource('src/lib/admin/cashflow.ts');
    const c = { first_payment_date: null, rental_months: 3, rental_price: null, paid_count: 0,
      payment_schedule: [
        { no: 1, dueDate: '2026-10-20', amount: 4583333 },
        { no: 2, dueDate: '2026-11-20', amount: 4583333 },
        { no: 3, dueDate: '2026-12-21', amount: 4583334 }
      ] };
    console.log(JSON.stringify({ today:p.todayISO(), cashflowToday:f.koreaToday(),
      detailLabel:p.dueLabel(p.buildSchedule(c)[0].dueDate),
      inboxLabel:p.dueLabel(p.nextDue(c).dueDate, p.todayISO()),
      rows:p.buildSchedule(c) }));
  `;
  const results = ['UTC', 'Asia/Seoul', 'America/Los_Angeles'].map(TZ => JSON.parse(execFileSync(
    process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', env: { ...process.env, TZ } }
  )));
  for (const result of results) {
    assert.equal(result.today, '2026-10-16');
    assert.equal(result.cashflowToday, result.today);
    assert.equal(result.detailLabel, 'D-4');
    assert.equal(result.inboxLabel, 'D-4');
    assert.equal(result.rows.reduce((sum, r) => sum + r.amount, 0), 13750000);
    assert.ok(result.rows.every(r => r.paid === false));
  }
  assert.deepEqual(results[0], results[1]);
  assert.deepEqual(results[1], results[2]);
});
