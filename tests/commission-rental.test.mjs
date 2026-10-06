import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadSource } from './cashflow-loader.mjs';

const today = '2026-10-02';
const payments = loadSource('src/lib/admin/payments.ts');
const { commissionRentalStatus } = loadSource('src/lib/admin/commission-rental.ts');
const customer = (extra = {}) => ({ id: 'c1', hospital_name: '합성 테스트 병원', stage: 'operation', sales_agent_id: 'a1', execution_amount: 10000, commission_rate: null, commission_paid: 50, first_payment_date: '2026-09-01', rental_months: 2, paid_count: 0, rental_price: 1000, ...extra });
const receipt = (extra = {}) => ({ id: 'r1', customer_id: 'c1', kind: 'rental_receipt', basis: 'actual', cash_date: '2026-09-20', amount: 1000, installment_no: 1, ...extra });
const status = (extra = {}, available = true) => commissionRentalStatus(customer(extra), today, available);

function all(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child => all(child, predicate));
  if (!node || typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...all(node.props?.children, predicate)];
}
function setup({ uid = 'admin', admin = true, adminError = false, adminThrows = false, claimsError = false, claimsThrows = false, customers = [customer()], receipts = [], failTable, failFrom = 0, throwTable } = {}) {
  const calls = [];
  const client = {
    auth: { getClaims: async () => {
      if (claimsThrows) throw new Error('private authentication detail');
      return { data: { claims: uid ? { sub: uid } : null }, error: claimsError ? {} : null };
    } },
    from(table) {
      const call = { table, filters: [] }; calls.push(call);
      const query = {
        select(columns) { call.columns = columns; return query; },
        eq(column, value) { call.filters.push([column, value]); return query; },
        in(column, values) { call.in = [column, values]; return query; },
        order(column) { call.order = column; return query; },
        async maybeSingle() {
          if (adminThrows) throw new Error('private permission detail');
          return { data: admin ? { user_id: uid } : null, error: adminError ? {} : null };
        },
        async range(from, to) {
          call.range = [from, to];
          if (table === throwTable) throw new Error('private connection detail');
          if (table === failTable && from >= failFrom) return { data: null, error: { message: 'private database detail' } };
          let rows = table === 'customers' ? customers : table === 'sales_agents' ? [{ id: 'a1', name: '합성 영업자', parent_id: null, commission_rate: 2 }] : receipts;
          for (const [column, value] of call.filters) rows = rows.filter(row => row[column] === value);
          if (call.in) rows = rows.filter(row => call.in[1].includes(row[call.in[0]]));
          return { data: rows.slice(from, to + 1), error: null };
        },
      };
      return query;
    },
  };
  const Page = loadSource('src/app/ph-console-8f27x/(app)/commissions/page.tsx', {
    '@/lib/supabase/server': { createClient: async () => client },
    '@/lib/admin/payments': { ...payments, todayISO: () => today },
    'next/navigation': { redirect(target) { throw new Error(`REDIRECT:${target}`); } },
    '@/components/admin/AgentRateInput': { AgentRateInput: 'AgentRateInput' },
    '@/components/admin/CommissionRow': { CommissionRow: 'CommissionRow' },
    './actions': { recordCommissionPayment() {}, setDealRate() {}, updateAgentCommissionRate() {} },
  }).default;
  return { calls, render: () => Page(), deals: tree => all(tree, node => node.type === 'CommissionRow').map(node => node.props.deal) };
}

test('actual receipt installments fully clear rental status even when paid_count is zero', () => {
  const result = status({ rental_receipts: [receipt(), receipt({ id: 'r2', installment_no: 2, amount: 700 })], payment_schedule: [{ no: 2, dueDate: '2026-10-01', amount: 700 }] });
  assert.equal(result.status, 'fully_paid');
  assert.match(result.detail, /수납 확인 2회/);
  assert.ok(!result.detail.includes('과거'));
});

test('partial receipts remain overdue until their own installment amount is covered', () => {
  const receipts = [receipt({ amount: 400 }), receipt({ id: 'r2', amount: 599 }), receipt({ id: 'r3', installment_no: 2 })];
  assert.equal(status({ rental_receipts: receipts }).status, 'overdue');
  assert.match(status({ rental_receipts: receipts }).detail, /수납 확인 1회/);
  assert.equal(status({ rental_receipts: [...receipts, receipt({ id: 'r4', amount: 1 })] }).status, 'fully_paid');
});

test('progress counts completed actual installments and preserves legacy labels separately', () => {
  const result = status({ first_payment_date: '2026-11-01', rental_months: 3, paid_count: 1, rental_receipts: [receipt({ installment_no: 2 })] });
  assert.equal(result.status, 'in_progress');
  assert.match(result.detail, /렌탈 2\/3/);
  assert.match(result.detail, /수납 확인 1회 · 과거 완납 표시 1회/);
  const fully = status({ paid_count: 1, rental_receipts: [receipt({ installment_no: 2 })] });
  assert.equal(fully.status, 'fully_paid');
  assert.match(fully.detail, /렌탈 완납 표시/);
  assert.match(status({ paid_count: 2 }).detail, /수납 확인 0회 · 과거 완납 표시 2회/);
});

test('overrides drive both amounts and due dates, including a later-numbered overdue row', () => {
  const extra = { payment_schedule: [{ no: 1, dueDate: '2026-11-01', amount: 1500 }], rental_receipts: [receipt()] };
  assert.equal(status(extra).status, 'overdue');
  assert.match(status(extra).detail, /연체 1일/);
  extra.rental_receipts.push(receipt({ id: 'r2', installment_no: 2 }));
  assert.equal(status(extra).status, 'in_progress');
  assert.match(status(extra).detail, /렌탈 1\/2/);
});

test('legacy ledgers, unavailable sources, and invalid schedules cannot claim paid or overdue', () => {
  for (const receipt_ledger of [{ entries: [], legacyPaidCount: 0 }, {}, [], false]) {
    assert.equal(status({ receipt_ledger, paid_count: 2 }).status, 'unknown');
  }
  assert.equal(status({ paid_count: 2 }, false).status, 'unknown');
  assert.equal(status({}, false).status, 'unknown');
  assert.equal(status({ payment_schedule: {} }).status, 'unknown');
  assert.equal(status({ first_payment_date: null }).status, 'unknown');
  assert.equal(status({ rental_price: null, rental_receipts: [receipt()] }).status, 'unknown');
  assert.equal(status({ rental_months: null }).status, 'none');
});

test('anonymous, nonadmins and permission lookup failures never query company finance', async () => {
  const anonymous = setup({ uid: null });
  await assert.rejects(anonymous.render(), /REDIRECT:.*login/);
  assert.deepEqual(anonymous.calls, []);
  for (const options of [{ admin: false }, { adminError: true }, { adminThrows: true }, { claimsError: true }, { claimsThrows: true }]) {
    const s = setup(options); const tree = await s.render();
    assert.equal(tree.props.role, 'alert');
    assert.ok(s.calls.every(call => call.table === 'admins'));
    assert.ok(!renderToStaticMarkup(tree).includes('private'));
  }
});

test('page scopes actual receipts per customer and leaves commission arithmetic unchanged', async () => {
  const s = setup({ customers: [customer(), customer({ id: 'c2' })], receipts: [receipt(), receipt({ id: 'r2', installment_no: 2 }), receipt({ id: 'ignored', customer_id: 'c2', basis: 'planned', amount: 99999 })] });
  const deals = s.deals(await s.render());
  assert.equal(deals[0].rentalStatus, 'fully_paid');
  assert.equal(deals[1].rentalStatus, 'overdue');
  assert.equal(deals[0].total, 200); assert.equal(deals[0].paid, 50); assert.equal(deals[0].appliedRate, 2);
  assert.equal(s.calls[0].table, 'admins');
  const query = s.calls.find(call => call.table === 'cashflow_movements');
  assert.deepEqual(query.filters, [['kind', 'rental_receipt'], ['basis', 'actual']]);
  assert.equal(query.order, 'id');
});

test('page receipt pagination loads beyond 500 rows before deciding completion', async () => {
  const receipts = [...Array.from({ length: 500 }, (_, i) => receipt({ id: `r${i}`, amount: 1 })), receipt({ id: 'last', amount: 500 })];
  const s = setup({ customers: [customer({ rental_months: 1 })], receipts });
  assert.equal(s.deals(await s.render())[0].rentalStatus, 'fully_paid');
  assert.deepEqual(s.calls.filter(call => call.table === 'cashflow_movements').map(call => call.range), [[0, 499], [500, 999]]);
});

test('later-page failure discards partial receipt evidence, including a seemingly completed customer', async () => {
  const receipts = Array.from({ length: 500 }, (_, i) => receipt({ id: `r${i}` }));
  const s = setup({ customers: [customer({ rental_months: 1 })], receipts, failTable: 'cashflow_movements', failFrom: 500 });
  const deal = s.deals(await s.render())[0];
  assert.equal(deal.rentalStatus, 'unknown'); assert.match(deal.rentalDetail, /원장 조회 불가/);
});

test('page legacy ledger and failed or thrown receipt queries display UNKNOWN', async () => {
  for (const options of [{ failTable: 'cashflow_movements' }, { throwTable: 'cashflow_movements' }, { customers: [customer({ receipt_ledger: { entries: [] }, paid_count: 2 })] }]) {
    const s = setup(options); const deal = s.deals(await s.render())[0];
    assert.equal(deal.rentalStatus, 'unknown'); assert.ok(!deal.rentalDetail.includes('연체')); assert.ok(!deal.rentalDetail.includes('완납'));
  }
});

test('customer or agent lookup failures return an alert instead of false zero commission totals', async () => {
  for (const failTable of ['customers', 'sales_agents']) {
    const s = setup({ failTable }); const tree = await s.render();
    assert.equal(tree.props.role, 'alert'); assert.deepEqual(s.deals(tree), []);
    assert.ok(!renderToStaticMarkup(tree).includes('private'));
  }
});

test('UNKNOWN is rendered with a neutral badge and explicit evidence caveat', () => {
  const { CommissionRow } = loadSource('src/components/admin/CommissionRow.tsx', {
    'next/navigation': { useRouter: () => ({ refresh() {} }) },
    'next/link': { __esModule: true, default: props => React.createElement('a', props) },
  });
  const html = renderToStaticMarkup(React.createElement(CommissionRow, { deal: { customerId: 'c1', hospitalName: '합성 고객', href: '/fixture', executionAmount: 0, overrideRate: null, appliedRate: 0, total: 0, paid: 0, rentalStatus: 'unknown', rentalDetail: '렌탈 확인 필요 · 수납 원장 조회 불가' }, recordAction() {}, rateAction() {} }));
  assert.match(html, /bg-navy-100 text-navy-500/);
  assert.match(html, /과거 완납 표시는 실제 수납 증빙이 아닙니다/);
  assert.ok(!html.includes('text-red-700'));
});
