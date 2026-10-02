import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadSource, customer } from './cashflow-loader.mjs';
function setup({ uid = 'admin', admin = true, adminError = false, customerError = false, extraError = false, errorCode, throwQuery = false, count = 1, customerOverrides = {} } = {}) {
  const calls = [];
  const client = { auth: { getClaims: async () => ({ data: { claims: uid ? { sub: uid } : null } }) }, from(table) {
    calls.push(table);
    const query = { select: () => query, eq: () => query, order: () => query,
      maybeSingle: async () => ({ data: admin ? { user_id: uid } : null, error: adminError ? {} : null }),
      range: async (a, b) => {
        if (throwQuery && table !== 'customers') throw new Error('private connection detail');
        if ((table === 'customers' && customerError) || (table !== 'customers' && extraError)) return { data: null, error: { code: errorCode, message: "private error detail" } };
        return { error: null, data: table === 'customers' ? Array.from({ length: count }, (_, i) => customer({ ...customerOverrides, id: `c${i}` })).slice(a, b + 1) : [] };
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

test('unexecuted closed customers do not trigger source or missing-data warnings', async () => {
 const r=await setup({customerOverrides:{stage:'closed',funding_done:false,funding_done_date:null,paid_count:0}}).render({month:'2026-10'});
 assert.equal(r.props.report.rows.length,0); assert.deepEqual(r.props.warnings,[]);
 assert.ok(r.props.chartMonths.every(m=>m.rows.length===0));
});

test('a failed movement lookup cannot prove a closed customer has no history', async () => {
 const r=await setup({extraError:true,customerOverrides:{stage:'closed',funding_done:false,funding_done_date:null,paid_count:0}}).render({month:'2026-10'});
 assert.equal(r.props.report.rows.length,1); assert.ok(r.props.report.cumulative.missing);
 assert.ok(r.props.warnings.length); assert.ok(r.props.chartMonths.every(m=>m.rows.length===1));
});
test('nonadmin and failed permission lookup fail closed', async () => { for (const options of [{ admin: false }, { adminError: true }]) { const s = setup(options); const result = await s.render(); assert.equal(result.props.role, 'alert'); assert.deepEqual(s.calls, ['admins']); } });
test('customer failure shows error not zero report', async () => { const r = await setup({ customerError: true }).render(); assert.equal(r.props.role, 'alert'); assert.equal(r.props.report, undefined); });
test('missing extension tables warn and preserve uncertainty', async () => { const r = await setup({ extraError: true }).render(); assert.ok(r.props.warnings.length); assert.ok(r.props.report.totals.creditorActual.missing); });
test('pagination loads beyond 1000 records', async () => { const r = await setup({ count: 1001 }).render(); assert.equal(r.props.report.rows.length, 1001); });
test('malformed repeated month gets visible fallback warning', async () => { const r = await setup().render({ month: ['2026-02', '2026-03'] }); assert.match(r.props.warnings[0], /조회 월/); });

test('missing tables are distinguished from permission failures without raw error disclosure', async () => { for (const code of ['PGRST205','42501']) { const r=await setup({extraError:true,errorCode:code}).render(); assert.ok(r.props.warnings.some(w=>w.includes(code))); assert.ok(!JSON.stringify(r.props.warnings).includes('private error detail')); } });
test('connection exceptions remain safe visible diagnostics', async () => { const r=await setup({throwQuery:true}).render(); assert.ok(r.props.warnings.some(w=>w.includes('연결'))); assert.ok(!JSON.stringify(r.props.warnings).includes('private connection detail')); });
test('missing receipt column identified separately from cashflow extension', async () => { const r=await setup().render(); assert.ok(r.props.warnings.some(w=>w.includes('receipt_ledger'))); });
test('chart period and actual basis propagate', async () => { const r=await setup().render({month:'2026-11',range:'3',basis:'actual'}); assert.equal(r.props.chartMonths.length,3); assert.equal(r.props.chartMonths[0].month,'2026-09'); assert.equal(r.props.basis,'actual'); });
test('requests before the start month are clamped on the server', async () => { const r=await setup().render({month:'2025-01',range:'12',basis:'actual'}); assert.equal(r.props.month,'2026-09'); assert.deepEqual(r.props.chartMonths.map(m=>m.month),['2026-09']); assert.ok(r.props.warnings.length); });

test('cashflow navigation is hidden by default and requires explicit admin proof', () => {
 const {Sidebar}=loadSource('src/components/admin/Sidebar.tsx',{'next/navigation':{usePathname:()=>'/ph-console-8f27x',useSearchParams:()=>new URLSearchParams()}});
 for(const showCashflow of [undefined,false,true]) {
  const html=renderToStaticMarkup(React.createElement(Sidebar,{counts:{},showCashflow}));
  assert.equal(html.includes('/ph-console-8f27x/cashflow'),showCashflow===true);
 }
});
