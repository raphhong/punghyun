import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadSource, customer } from './cashflow-loader.mjs';

const { buildSchedule, nextDue, plannedSchedule } = loadSource('src/lib/admin/payments.ts');
const { projectCashflow } = loadSource('src/lib/admin/cashflow.ts');
const schedule = [
  { no: 1, dueDate: '2026-10-20', amount: 4583333 },
  { no: 2, dueDate: '2026-11-20', amount: 4583333 },
  { no: 3, dueDate: '2026-12-21', amount: 4583334 },
];
const contract = () => customer({ updated_at: '2026-10-16T00:00:00Z', first_payment_date: null, rental_price: null, rental_months: 3, paid_count: 0, payment_schedule: schedule });

test('exact VAT-inclusive 3 installments agree in detail, inbox and cashflow without monthly defaults', () => {
  const c = contract();
  const rows = buildSchedule(c, '2026-10-16');
  assert.equal(rows.reduce((sum, r) => sum + r.amount, 0), 13750000);
  assert.ok(rows.every(r => !r.paid));
  for (let i = 0; i < 3; i++) {
    assert.deepEqual(nextDue({ ...c, paid_count: i }, '2026-10-16'), rows[i]);
    const report = projectCashflow([c], [], [], schedule[i].dueDate.slice(0, 7), '2026-10-16');
    assert.equal(report.totals.rentalPlan.value, schedule[i].amount);
    assert.equal(report.totals.rentalPlan.known, 1);
    assert.equal(report.totals.rentalPlan.missing, 0);
    assert.equal(report.totals.rentalActual.known, 0);
    assert.ok(report.totals.rentalActual.missing);
    assert.equal(report.rows[0].details.find(r => r.label.startsWith('렌탈 예정')).date, schedule[i].dueDate);
  }
});
test('duplicate, invalid date and negative amount fail closed in every display', () => {
  for (const bad of [[...schedule, schedule[0]], [{ ...schedule[0], dueDate: '2026-02-30' }], [{ ...schedule[0], amount: -1 }]]) {
    const c = { ...contract(), payment_schedule: bad };
    assert.ok(plannedSchedule(c).error);
    assert.deepEqual(buildSchedule(c), []);
    assert.equal(nextDue(c), null);
    assert.equal(projectCashflow([c], [], [], '2026-10').totals.rentalPlan.known, 0);
  }
});
test('legacy defaults and partial overrides remain intact', () => {
  const c = customer({ payment_schedule: [{ no: 2, dueDate: '2026-03-05', amount: 700000 }] });
  assert.equal(buildSchedule(c)[0].dueDate, '2026-01-31');
  assert.equal(buildSchedule(c)[1].dueDate, '2026-03-05');
  assert.equal(buildSchedule(c)[2].amount, 1100000);
});

function harness({ authorized = true, loggedIn = true, conflict = false, current = contract(), dbError = false } = {}) {
  const writes = [], paths = [];
  const client = {
    auth: { getClaims: async () => ({ data: { claims: { sub: loggedIn ? 'admin' : undefined } } }) },
    from(table) {
      let patch, filters = {};
      const query = {
        select() { return query; },
        eq(k, v) { filters[k] = v; return query; },
        update(value) { patch = value; return query; },
        async maybeSingle() {
          if (table === 'admins') return { data: authorized ? { user_id: 'admin' } : null };
          if (patch) {
            writes.push({ table, patch, filters });
            if (dbError) return { error: { message: 'secret database failure' } };
            if (conflict) return { data: null };
            Object.assign(current, patch);
            current.updated_at = '2026-10-16T00:01:00Z';
            return { data: { id: current.id } };
          }
          return { data: { ...current } };
        },
      };
      return query;
    },
  };
  const { savePaymentSchedule } = loadSource('src/app/ph-console-8f27x/(app)/customers/actions.ts', {
    '@/lib/supabase/server': { createClient: async () => client },
    'next/cache': { revalidatePath: path => paths.push(path) },
    'next/navigation': { redirect() { throw Error('unexpected redirect'); } },
  });
  return { save: savePaymentSchedule, writes, paths, current };
}
test('save replaces one contract schedule only, preserves memo/receipt/defaults, retry cannot duplicate', async () => {
  const h = harness({ current: { ...contract(), payment_schedule: null, internal_memo: 'keep', receipt_ledger: null } });
  assert.deepEqual(await h.save('fixture-1', '2026-10-16T00:00:00Z', schedule), { ok: true });
  assert.deepEqual(Object.keys(h.writes[0].patch), ['payment_schedule']);
  assert.deepEqual(h.writes[0].filters, { id: 'fixture-1', updated_at: '2026-10-16T00:00:00Z' });
  assert.equal(h.current.internal_memo, 'keep');
  assert.equal(h.current.paid_count, 0);
  assert.equal(h.current.receipt_ledger, null);
  assert.ok((await h.save('fixture-1', '2026-10-16T00:00:00Z', schedule)).error);
  assert.deepEqual(await h.save('fixture-1', h.current.updated_at, schedule), { ok: true });
  assert.equal(h.current.payment_schedule.length, 3);
  assert.ok(h.paths.includes('/ph-console-8f27x/cashflow'));
});
test('untrusted input, unauthorized actors and stale pages cannot write', async () => {
  for (const options of [{ authorized: false }, { loggedIn: false }, { current: { ...contract(), updated_at: 'newer' } }]) {
    const h = harness(options);
    assert.ok((await h.save('fixture-1', '2026-10-16T00:00:00Z', schedule)).error);
    assert.equal(h.writes.length, 0);
  }
  for (const input of [[], [...schedule, schedule[0]], [{ ...schedule[0], amount: null }], [{ ...schedule[0], amount: 1.5 }]]) {
    const h = harness();
    assert.ok((await h.save('fixture-1', '2026-10-16T00:00:00Z', input)).error);
    assert.equal(h.writes.length, 0);
  }
});
test('concurrent update and DB failure never report success or leak DB error', async () => {
  for (const options of [{ conflict: true }, { dbError: true }]) {
    const h = harness(options);
    const result = await h.save('fixture-1', '2026-10-16T00:00:00Z', schedule);
    assert.ok(result.error);
    assert.ok(!result.error.includes('secret'));
    assert.equal(h.paths.length, 0);
  }
});
test('paid installments and contract length cannot be silently changed', async () => {
  const h = harness({ current: { ...contract(), paid_count: 1 } });
  assert.ok((await h.save('fixture-1', h.current.updated_at, [{ ...schedule[0], amount: 1 }, ...schedule.slice(1)])).error);
  assert.ok((await h.save('fixture-1', h.current.updated_at, schedule.slice(0, 2))).error);
  assert.equal(h.writes.length, 0);
});

test('rendered customer schedule shows exact third date/amount and VAT total without marking paid', () => {
  const mocks = { 'next/navigation': { useRouter: () => ({ refresh() {} }) } };
  const { PaymentScheduleEditor } = loadSource('src/components/admin/PaymentScheduleEditor.tsx', mocks);
  const { RentalPlanEditor } = loadSource('src/components/admin/RentalPlanEditor.tsx', mocks);
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null,
    React.createElement(RentalPlanEditor, { id: 'fixture-1', updatedAt: contract().updated_at, schedule: contract(), action() { throw Error('render must not save'); } }),
    React.createElement(PaymentScheduleEditor, { id: 'fixture-1', schedule: contract(), action() { throw Error('render must not pay'); } })));
  for (const text of ['2026-10-20', '2026-11-20', '2026-12-21', '4,583,334', '13,750,000', 'VAT 포함', '납부 0 / 3회차']) assert.ok(html.includes(text), text);
});

test('dashboard includes custom schedules with blank first date', async () => {
  const c = contract();
  let inbox;
  const client = {
    auth: { getClaims: async () => ({ data: { claims: { sub: 'admin' } } }) },
    from(table) {
      const q = {
        select() { return q; }, eq() { return q; }, order() { return q; }, limit() { return q; },
        maybeSingle: async () => ({ data: { user_id: 'admin' } }),
        then(resolve) { return Promise.resolve({ data: table === 'customers' ? [c] : [] }).then(resolve); },
      };
      return q;
    },
  };
  const payments = loadSource('src/lib/admin/payments.ts');
  const { default: Page } = loadSource('src/app/ph-console-8f27x/(app)/page.tsx', {
    '@/lib/supabase/server': { createClient: async () => client },
    '@/lib/admin/payments': { ...payments, todayISO: () => '2026-10-16' },
    './customers/actions': { setPaidCount() { throw Error('read must not pay'); } },
    '@/components/admin/PaymentInbox': { PaymentInbox({ items }) { inbox = items; return null; } },
  });
  renderToStaticMarkup(await Page());
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].dueDate, '2026-10-20');
  assert.equal(inbox[0].amount, 4583333);
  assert.equal(inbox[0].total, 3);
});
