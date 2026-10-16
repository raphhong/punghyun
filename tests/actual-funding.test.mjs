import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadSource, customer, movement } from './cashflow-loader.mjs';

const pure = loadSource('src/lib/admin/actual-funding.ts');
const id = '3c45f593-e483-467c-a1df-116a75af16e3';
const input = { cashDate: '2026-10-16', amount: 500000000, evidence: 'Confirmed bank transfer reference', confirmed: true };
function harness(options = {}) {
  const rows = [...(options.rows ?? [])], writes = [], paths = [];
  let privileged = 0;
  let profile = options.profile ?? null;
  const db = { from(table) {
    let value, opts;
    const query = {
      select() { return query; }, eq() { return query; }, order() { return query; },
      upsert(v, o) { value = v; opts = o; return query; },
      async maybeSingle() { return { data: profile, error: options.readError ? {} : null }; },
      async range(start, end) { return { data: options.readbackError && writes.length ? null : rows.slice(start, end + 1), error: options.readError ? {} : null }; },
      then(resolve, reject) { return Promise.resolve().then(() => {
        assert.ok(value); writes.push({ table, value, opts });
        assert.equal(opts.ignoreDuplicates, true);
        if (options.writeError) return { error: { message: 'secret' } };
        if (table === 'cashflow_profiles') { profile ??= value; return { data: null }; }
        assert.equal(opts.onConflict, 'source_reference');
        if (rows.some(r => r.source_reference === value.source_reference)) return { data: [] };
        rows.push({ id: 'row-1', ...value }); return { data: [{ id: 'row-1' }] };
      }).then(resolve, reject); },
    }; return query;
  } };
  const session = {
    auth: { getClaims: async () => ({ data: { claims: { sub: options.anonymous ? undefined : 'admin' } } }) },
    from(table) { const q = { select() { return q; }, eq() { return q; }, async maybeSingle() {
      return { data: (table === 'admins' ? options.nonadmin : options.noCustomer) ? null : { id, user_id: 'admin' }, error: options.authError ? {} : null };
    } }; return q; },
  };
  const actions = loadSource('src/app/ph-console-8f27x/(app)/customers/actual-funding-actions.ts', {
    '@/lib/supabase/server': { createClient: async () => session },
    '@/lib/supabase/admin': { createAdminClient: () => { privileged++; return db; } },
    'next/cache': { revalidatePath: path => paths.push(path) },
    '@/lib/admin/actual-funding': { ...pure, parseActualFunding: v => pure.parseActualFunding(v, '2026-10-16') },
  });
  return { ...actions, rows, writes, paths, privileged: () => privileged, profile: () => profile };
}

test('actual funding validates evidence, confirmation, real date, past/KST today and safe positive won', () => {
  assert.deepEqual(pure.parseActualFunding(input, '2026-10-16'), input);
  for (const patch of [{ cashDate: '2026-02-30' }, { cashDate: '2026-10-17' }, { cashDate: '1899-12-31' }, { amount: 0 }, { amount: -1 }, { amount: 1.2 }, { amount: Number.MAX_SAFE_INTEGER + 1 }, { amount: '500' }, { evidence: ' ' }, { evidence: 'a'.repeat(1001) }, { confirmed: false }]) {
    assert.equal(pure.parseActualFunding({ ...input, ...patch }, '2026-10-16'), null);
  }
});

test('authorization failures never instantiate privileged client or write', async () => {
  for (const options of [{ anonymous: true }, { nonadmin: true }, { authError: true }, { noCustomer: true }]) {
    const h = harness(options);
    assert.ok((await h.registerInitialFunding(id, input)).error);
    assert.equal(h.privileged(), 0); assert.equal(h.writes.length, 0);
  }
  const h = harness(); assert.ok((await h.registerInitialFunding('invalid', input)).error); assert.equal(h.privileged(), 0);
});

test('schema/read errors and existing actual records block all writes', async () => {
  for (const options of [{ readError: true }, { rows: [{ id: 'legacy', source_reference: 'legacy-transfer' }] }]) {
    const h = harness(options); assert.ok((await h.registerInitialFunding(id, input)).error); assert.equal(h.writes.length, 0);
  }
});

test('first registration creates actual movement once and leaves source unknown; retry is idempotent', async () => {
  const h = harness();
  assert.deepEqual(await h.registerInitialFunding(id, input), { ok: true, alreadyRecorded: false });
  assert.equal(h.rows.length, 1); assert.equal(h.rows[0].kind, 'funding_disbursement'); assert.equal(h.rows[0].basis, 'actual');
  assert.equal(h.profile().funding_type, null); assert.equal(h.profile().creditor_name, null);
  assert.equal(JSON.parse(h.rows[0].note).recorded_by, 'admin');
  assert.equal(h.paths.length, 3);
  assert.deepEqual(await h.registerInitialFunding(id, input), { ok: true, alreadyRecorded: true });
  assert.equal(h.writes.length, 2);
  assert.ok((await h.registerInitialFunding(id, { ...input, amount: 1 })).error);
  assert.ok(h.writes.every(w => ['cashflow_profiles', 'cashflow_movements'].includes(w.table)));
});

test('existing source and creditor survive registration', async () => {
  const profile = { customer_id: id, funding_type: 'securitized', creditor_name: 'Existing creditor' };
  const h = harness({ profile }); await h.registerInitialFunding(id, input);
  assert.deepEqual(h.profile(), profile);
});

test('concurrent same or changed values cannot append a second movement', async () => {
  for (const amount of [input.amount, 1]) {
    const h = harness(); const result = await Promise.all([h.registerInitialFunding(id, input), h.registerInitialFunding(id, { ...input, amount })]);
    assert.equal(h.rows.length, 1);
    assert.ok(result.some(r => r.ok));
    if (amount !== input.amount) assert.ok(result.some(r => r.error));
  }
});

test('write or readback failures never report success', async () => {
  for (const options of [{ writeError: true }, { readbackError: true }]) {
    const h = harness(options); assert.ok((await h.registerInitialFunding(id, input)).error);
  }
});

test('actual 500m is included with unknown source and no inferred rental receipts', async () => {
  const { projectCashflow } = loadSource('src/lib/admin/cashflow.ts');
  const h = harness(); await h.registerInitialFunding(id, input);
  const report = projectCashflow([customer({ id, paid_count: 0 })], [h.profile()], h.rows.map(r => movement(r)), '2026-10', '2026-10-16');
  assert.equal(report.totals.fundingActual.value, 500000000);
  assert.equal(report.totals.rentalActual.known, 0);
});

test('editor renders empty inputs, explicit confirmation, blocked state and readonly existing record', () => {
  const { ActualFundingEditor } = loadSource('src/components/admin/ActualFundingEditor.tsx', { 'next/navigation': { useRouter: () => ({ refresh() {} }) } });
  const render = state => renderToStaticMarkup(React.createElement(ActualFundingEditor, { id, state, action: () => { throw Error('render cannot write'); } }));
  const empty = render({ rows: [], fundingType: null, creditorName: null });
  assert.match(empty, /name="cashDate"/); assert.match(empty, /name="confirmed"/); assert.doesNotMatch(empty, /value="500000000"/);
  assert.doesNotMatch(render({ rows: [], error: 'blocked' }), /<form/);
  assert.doesNotMatch(render({ rows: [{ id: '1', cash_date: input.cashDate, amount: input.amount, note: null, source_reference: 'evidence' }] }), /<form/);
});
