import assert from 'node:assert/strict';
import test from 'node:test';
import { loadSource, customer } from './cashflow-loader.mjs';
function setup({ uid = 'admin', admin = true, adminError = false, customerError = false, extraError = false, errorCode, throwQuery = false, count = 1 } = {}) {
  const calls = [];
  const client = { auth: { getClaims: async () => ({ data: { claims: uid ? { sub: uid } : null } }) }, from(table) {
    calls.push(table);
    const query = { select: () => query, eq: () => query, order: () => query,
      maybeSingle: async () => ({ data: admin ? { user_id: uid } : null, error: adminError ? {} : null }),
      range: async (a, b) => {
        if (throwQuery && table !== 'customers') throw new Error('private connection detail');
        if ((table === 'customers' && customerError) || (table !== 'customers' && extraError)) return { data: null, error: { code: errorCode, message: "private error detail" } };
        return { error: null, data: table === 'customers' ? Array.from({ length: count }, (_, i) => customer({ id: `c${i}` })).slice(a, b + 1) : [] };
      } };
    return query;
  } };
  const Page = loadSource('src/app/ph-console-8f27x/(app)/cashflow/page.tsx', {
    '@/lib/supabase/server': { createClient: async () => client },
    'next/navigation': { redirect: target => { throw new Error(`REDIRECT:${target}`); } },
    '@/components/admin/CashflowDashboard': { CashflowDashboard: 'Dashboard' },
  }).default;
  return { calls, render: params => Page({ searchParams: Promise.resolve(params ?? { month: '2026-02' }) }) };
}
test('anonymous redirected before finance queries', async () => { const s = setup({ uid: null }); await assert.rejects(s.render(), /REDIRECT/); assert.equal(s.calls.length, 0); });
test('nonadmin and failed permission lookup fail closed', async () => { for (const options of [{ admin: false }, { adminError: true }]) { const s = setup(options); const result = await s.render(); assert.equal(result.props.role, 'alert'); assert.deepEqual(s.calls, ['admins']); } });
test('customer failure shows error not zero report', async () => { const r = await setup({ customerError: true }).render(); assert.equal(r.props.role, 'alert'); assert.equal(r.props.report, undefined); });
test('missing extension tables warn and preserve uncertainty', async () => { const r = await setup({ extraError: true }).render(); assert.ok(r.props.warnings.length); assert.ok(r.props.report.totals.creditorActual.missing); });
test('pagination loads beyond 1000 records', async () => { const r = await setup({ count: 1001 }).render(); assert.equal(r.props.report.rows.length, 1001); });
test('malformed repeated month gets visible fallback warning', async () => { const r = await setup().render({ month: ['2026-02', '2026-03'] }); assert.match(r.props.warnings[0], /조회 월/); });

test('missing tables are distinguished from permission failures without raw error disclosure', async () => { for (const code of ['PGRST205','42501']) { const r=await setup({extraError:true,errorCode:code}).render(); assert.ok(r.props.warnings.some(w=>w.includes(code))); assert.ok(!JSON.stringify(r.props.warnings).includes('private error detail')); } });
test('connection exceptions remain safe visible diagnostics', async () => { const r=await setup({throwQuery:true}).render(); assert.ok(r.props.warnings.some(w=>w.includes('연결'))); assert.ok(!JSON.stringify(r.props.warnings).includes('private connection detail')); });
test('missing receipt column identified separately from cashflow extension', async () => { const r=await setup().render(); assert.ok(r.props.warnings.some(w=>w.includes('receipt_ledger'))); });
test('chart period and actual basis propagate', async () => { const r=await setup().render({month:'2026-02',range:'3',basis:'actual'}); assert.equal(r.props.chartMonths.length,3); assert.equal(r.props.chartMonths[0].month,'2025-12'); assert.equal(r.props.basis,'actual'); });
