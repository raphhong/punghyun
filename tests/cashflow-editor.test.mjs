import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadSource } from './cashflow-loader.mjs';

const customerId = '11111111-1111-4111-8111-111111111111';
const state = (movements = []) => ({ version: 'a'.repeat(32), snapshot: { customer: { first_payment_date: '2026-09-30', rental_months: 2, rental_price: 1100000, paid_count: 0, payment_schedule: null, receipt_ledger: null }, profile: null, movements } });
const movement = { id: '22222222-2222-4222-8222-222222222222', customer_id: customerId, kind: 'funding_disbursement', basis: 'actual', cash_date: '2026-09-20', cash_month: null, installment_no: null, amount: 1000000, source_reference: 'fixture-bank-reference', note: null };

function all(node, predicate) {
  if (node == null || typeof node === 'boolean') return [];
  if (Array.isArray(node)) return node.flatMap(child => all(child, predicate));
  if (typeof node !== 'object') return [];
  return [...(predicate(node) ? [node] : []), ...all(node.props?.children, predicate)];
}
function text(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(text).join('');
  return typeof node === 'object' ? text(node.props?.children) : String(node);
}
// A small dependency-free hook harness invokes the real component's event
// handlers. It covers persistence control flow; it does not replace browser QA.
function setup({ initialState = state(), save = async () => ({ ok: true, state: state() }), load = async () => ({ ok: true, state: state() }) } = {}) {
  const slots = []; let cursor = 0; let tree; const calls = []; const tasks = []; const timers = new Map(); let timerId = 0;
  const react = { ...React, useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; }, useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; }, useEffect() {}, useTransition() { return [false, task => { tasks.push(task()); }]; } };
  const { CashflowEditor } = loadSource('src/components/admin/CashflowEditor.tsx', { react, 'next/navigation': { useRouter: () => ({ refresh() {} }) } });
  const component = CashflowEditor({ customerId, initialResult: { ok: true, state: initialState }, saveAction: request => { calls.push(request); return save(request); }, loadAction: load });
  const previousWindow = globalThis.window;
  globalThis.window = { setTimeout(callback) { timers.set(++timerId, callback); return timerId; }, clearTimeout(id) { timers.delete(id); }, addEventListener() {}, removeEventListener() {} };
  const render = () => { cursor = 0; tree = component.type(component.props); return tree; };
  const button = label => { const matches = all(tree, node => node.type === 'button' && text(node).includes(label)); assert.equal(matches.length, 1, `button ${label}`); return matches[0]; };
  const field = label => { const node = all(tree, node => node.type === 'label' && text(node).startsWith(label))[0]; assert.ok(node, `label ${label}`); return all(node, node => ['input', 'select', 'textarea'].includes(node.type))[0]; };
  render();
  return { calls, render, tree: () => tree, button, field,
    click(label) { button(label).props.onClick(); render(); },
    set(label, value) { field(label).props.onChange({ target: { value } }); render(); },
    submit() { const form = all(tree, node => node.type === 'form')[0]; assert.ok(form); form.props.onSubmit({ preventDefault() {} }); render(); },
    async settle() { await Promise.all(tasks.splice(0)); render(); },
    timeout() { [...timers.values()].forEach(callback => callback()); render(); },
    cleanup() { globalThis.window = previousWindow; },
  };
}
function draftNew(s) {
  s.click('새 거래 등록'); s.set('거래 종류', 'funding_disbursement'); s.set('실제·예정 구분', 'actual'); s.set('실제 거래일', '2026-09-20'); s.set('금액', '1000000'); s.set('증빙 식별번호', 'fixture-bank-reference'); s.set('등록·수정 사유', '증빙 대조 등록');
}

test('finance load errors expose no editing form', () => {
  const { CashflowEditor } = loadSource('src/components/admin/CashflowEditor.tsx', { 'next/navigation': { useRouter: () => ({ refresh() {} }) } });
  const html = renderToStaticMarkup(React.createElement(CashflowEditor, { customerId, initialResult: { error: '관리자 권한 확인 실패', code: 'FORBIDDEN' } }));
  assert.match(html, /role="alert"/); assert.ok(!html.includes('<form')); assert.ok(!html.includes('<button'));
});

test('editing, review, back and cancel never save; final button is required', async () => {
  const s = setup(); try {
    draftNew(s); assert.equal(s.calls.length, 0); s.submit(); assert.equal(s.calls.length, 0);
    s.click('돌아가서 수정'); assert.equal(s.calls.length, 0); s.submit(); s.click('취소'); assert.equal(s.calls.length, 0);
    draftNew(s); s.submit(); s.click('검토한 변경 최종 저장'); await s.settle(); assert.equal(s.calls.length, 1); assert.match(text(s.tree()), /검토한 변경을 저장했습니다/);
  } finally { s.cleanup(); }
});

test('rapid double click is locked; UNCONFIRMED retries identical request object and id', async () => {
  let resolve; let run = 0;
  const s = setup({ save: () => ++run === 1 ? new Promise(done => { resolve = done; }) : Promise.resolve({ ok: true, state: state(), replayed: true }) });
  try {
    draftNew(s); s.submit(); const final = s.button('검토한 변경 최종 저장'); final.props.onClick(); final.props.onClick(); s.render();
    assert.equal(s.calls.length, 1); assert.equal(s.button('돌아가서 수정').props.disabled, true);
    resolve({ error: '확인되지 않음', code: 'UNCONFIRMED' }); await s.settle();
    assert.equal(s.button('돌아가서 수정').props.disabled, true); s.click('같은 요청으로 확인·재시도'); await s.settle();
    assert.equal(s.calls.length, 2); assert.equal(s.calls[0], s.calls[1]); assert.equal(s.calls[0].requestId, s.calls[1].requestId); assert.match(text(s.tree()), /중복 거래는 추가되지 않았습니다/);
  } finally { s.cleanup(); }
});

test('timeout allows only the same frozen request and late success cannot add a second event', async () => {
  const resolvers = [];
  const s = setup({ save: () => new Promise(resolve => resolvers.push(resolve)) });
  try {
    draftNew(s); s.submit(); s.click('검토한 변경 최종 저장'); s.timeout();
    assert.equal(s.button('취소').props.disabled, true); s.click('같은 요청으로 확인·재시도'); assert.equal(s.calls.length, 2); assert.equal(s.calls[0], s.calls[1]);
    resolvers[0]({ ok: true, state: state() }); resolvers[1]({ ok: true, state: state(), replayed: true }); await s.settle(); assert.equal(s.calls.length, 2); assert.match(text(s.tree()), /저장했습니다/);
  } finally { s.cleanup(); }
});

test('version conflict requires explicit reload and clears stale review', async () => {
  let loads = 0;
  const s = setup({ save: async () => ({ error: '다른 변경', code: 'CASHFLOW_CONFLICT' }), load: async () => { loads++; return { ok: true, state: { ...state(), version: 'b'.repeat(32) } }; } });
  try {
    draftNew(s); s.submit(); s.click('검토한 변경 최종 저장'); await s.settle(); assert.equal(s.button('검토한 변경 최종 저장').props.disabled, true);
    s.click('최신 원장 다시 불러오기'); await s.settle(); assert.equal(loads, 1); assert.equal(all(s.tree(), node => node.type === 'form').length, 0);
    draftNew(s); s.submit(); s.click('검토한 변경 최종 저장'); await s.settle(); assert.equal(s.calls[1].expectedVersion, 'b'.repeat(32)); assert.notEqual(s.calls[0].requestId, s.calls[1].requestId);
  } finally { s.cleanup(); }
});

test('correction preserves existing identity, source reference, kind and basis', async () => {
  const original = { ...movement, source_reference: '  fixture-bank-reference  ' };
  const s = setup({ initialState: state([original]) }); try {
    s.click('기존 거래 수정'); assert.equal(s.field('거래 종류').props.disabled, true); assert.equal(s.field('실제·예정 구분').props.disabled, true); assert.equal(s.field('증빙 식별번호').props.readOnly, true);
    s.set('금액', '999999'); s.set('등록·수정 사유', '정확한 금액 정정'); s.submit(); s.click('검토한 변경 최종 저장'); await s.settle();
    assert.equal(s.calls[0].change.id, movement.id); assert.equal(s.calls[0].change.source_reference, original.source_reference); assert.equal(s.calls[0].change.kind, movement.kind); assert.equal(s.calls[0].change.basis, movement.basis);
  } finally { s.cleanup(); }
});

test('schedule generation does not supply the contract total or save; final one-won edit is reviewed', async () => {
  const s = setup(); try {
    s.click('납부 일정·총액 편집'); assert.equal(s.field('계약 총액 직접 확인').props.value, ''); s.click('기본 일정 생성'); assert.equal(s.calls.length, 0); assert.equal(s.field('계약 총액 직접 확인').props.value, '');
    const last = all(s.tree(), node => node.type === 'input' && node.props['aria-label'] === '2회차 금액')[0]; last.props.onChange({ target: { value: '1099999' } }); s.render();
    s.set('계약 총액 직접 확인', '2199999'); s.set('등록·수정 사유', '계약 총액 1원 조정'); s.submit(); assert.equal(s.calls.length, 0); s.click('검토한 변경 최종 저장'); await s.settle();
    assert.equal(s.calls[0].change.payment_schedule[1].amount, 1099999); assert.equal(s.calls[0].change.expected_total, 2199999); assert.equal(s.calls[0].change.payment_schedule.length, 2);
  } finally { s.cleanup(); }
});

test('profile begins unclassified rather than defaulting to own funds', () => {
  const s = setup(); try { s.click('자금 구분 편집'); assert.equal(s.field('자금 구분').props.value, ''); } finally { s.cleanup(); }
});

test('legacy schedule and inbox have no paid_count mutation controls', () => {
  const { PaymentScheduleEditor } = loadSource('src/components/admin/PaymentScheduleEditor.tsx');
  const scheduleHtml = renderToStaticMarkup(React.createElement(PaymentScheduleEditor, { schedule: { ...state().snapshot.customer, paid_count: 1 } }));
  assert.ok(!scheduleHtml.includes('<button')); assert.match(scheduleHtml, /기존 납부 표시/); assert.match(scheduleHtml, /#cashflow-editor/);
  const { PaymentInbox } = loadSource('src/components/admin/PaymentInbox.tsx', { 'next/link': { __esModule: true, default: props => React.createElement('a', props) } });
  const inboxHtml = renderToStaticMarkup(React.createElement(PaymentInbox, { items: [{ id: customerId, hospitalName: '합성 테스트 고객', href: '/customers/fixture', no: 1, total: 2, dueDate: '2026-09-30', amount: 1100000, status: 'overdue', label: '연체' }] }));
  assert.ok(!inboxHtml.includes('<button')); assert.match(inboxHtml, /\/customers\/fixture#cashflow-editor/);
});


test('legacy receipt ledger prevents schedule and rental movement editing in the UI', () => {
  const initialState = state([{ ...movement, kind: 'rental_receipt', installment_no: 1 }]);
  initialState.snapshot.customer.receipt_ledger = { entries: [] };
  const s = setup({ initialState }); try {
    assert.equal(s.button('납부 일정·총액 편집').props.disabled, true);
    assert.equal(s.button('기존 거래 수정').props.disabled, true);
    s.click('새 거래 등록');
    assert.equal(all(s.field('거래 종류'), node => node.type === 'option' && node.props.value === 'rental_receipt')[0].props.disabled, true);
    assert.match(text(s.tree()), /두 원장을 합산하지 않습니다/);
  } finally { s.cleanup(); }
});

function dashboard({ admin = true, adminError = false, customers = [], receipts = [], receiptError = false } = {}) {
  const calls = [];
  const client = { auth: { getClaims: async () => ({ data: { claims: { sub: customerId } } }) }, from(table) {
    let selected; const result = { data: [], error: null };
    const query = { select(columns) { selected = columns; calls.push({ table, columns }); return query; }, eq() { return query; }, not() { return query; }, order() { return query; },
      maybeSingle: async () => ({ data: admin ? { user_id: customerId } : null, error: adminError ? {} : null }),
      limit: async () => result,
      range: async (from, to) => { calls.push({ table, from, to }); if (table === 'cashflow_movements' && receiptError) return { data: null, error: { message: 'private error detail' } }; return { data: (table === 'customers' ? customers : receipts).slice(from, to + 1), error: null }; },
      then: (resolve, reject) => Promise.resolve(selected === 'stage' ? { data: customers.map(row => ({ stage: row.stage })), error: null } : result).then(resolve, reject),
    }; return query;
  } };
  const Page = loadSource('src/app/ph-console-8f27x/(app)/page.tsx', { '@/lib/supabase/server': { createClient: async () => client }, '@/components/admin/PaymentInbox': { PaymentInbox: 'PaymentInbox' } }).default;
  return { calls, render: Page };
}
const scheduledCustomer = overrides => ({ id: customerId, hospital_name: '합성 테스트 고객', stage: 'operation', first_payment_date: '2026-09-20', rental_months: 1, rental_price: 100, paid_count: 0, ...overrides });

test('dashboard does not query receipts without explicit admin proof', async () => {
  for (const option of [{ admin: false }, { adminError: true }]) {
    const s = dashboard(option); const tree = await s.render();
    assert.ok(!s.calls.some(call => call.table === 'cashflow_movements')); assert.equal(all(tree, node => node.type === 'PaymentInbox').length, 0);
  }
});

test('dashboard paginates receipts, uses overridden schedules, and does not silently truncate late-page receipts', async () => {
  const receipts = Array.from({ length: 501 }, (_, index) => ({ ...movement, id: `fixture-${index}`, customer_id: index === 500 ? customerId : `other-${index}`, kind: 'rental_receipt', installment_no: 1, amount: 99 }));
  const s = dashboard({ customers: [scheduledCustomer({ payment_schedule: [{ no: 1, dueDate: '2026-09-21', amount: 99 }] })], receipts }); const tree = await s.render();
  assert.equal(all(tree, node => node.type === 'PaymentInbox')[0].props.items.length, 0);
  assert.ok(s.calls.some(call => call.table === 'cashflow_movements' && call.from === 500)); assert.ok(s.calls.some(call => call.table === 'customers' && call.columns === '*'));
});

test('dashboard fails closed on missing receipts and avoids source mixing for legacy ledgers', async () => {
  const failed = dashboard({ customers: [scheduledCustomer({})], receiptError: true }); const failedTree = await failed.render();
  assert.equal(all(failedTree, node => node.type === 'PaymentInbox').length, 0); assert.match(text(failedTree), /실제 수납 원장을 확인하지 못해/); assert.ok(!text(failedTree).includes('private error detail'));
  const legacy = dashboard({ customers: [scheduledCustomer({ receipt_ledger: { entries: [] } })], receipts: [{ ...movement, kind: 'rental_receipt', installment_no: 1, amount: 100 }] }); const legacyTree = await legacy.render();
  assert.equal(all(legacyTree, node => node.type === 'PaymentInbox')[0].props.items.length, 0); assert.match(text(legacyTree), /원장 대조가 필요/);
});


test('pre-RPC retry rejection after a timeout cannot unlock or discard the ambiguous original request', async () => {
  let resolveFirst; let run = 0;
  const s = setup({ save: () => ++run === 1 ? new Promise(resolve => { resolveFirst = resolve; }) : Promise.resolve({ error: '권한을 확인할 수 없습니다', code: 'FORBIDDEN' }) });
  try {
    draftNew(s); s.submit(); s.click('검토한 변경 최종 저장'); s.timeout(); s.click('같은 요청으로 확인·재시도');
    await new Promise(resolve => setImmediate(resolve)); s.render();
    assert.equal(s.button('취소').props.disabled, true); assert.equal(s.button('돌아가서 수정').props.disabled, true);
    assert.equal(s.calls[0], s.calls[1]); assert.match(text(s.tree()), /같은 요청으로 확인·재시도/);
    resolveFirst({ ok: true, state: state() }); await s.settle();
    assert.match(text(s.tree()), /검토한 변경을 저장했습니다/); assert.equal(s.button('새 거래 등록').props.disabled, false);
  } finally { s.cleanup(); }
});

test('legacy receipt schedules show unavailable status rather than inferred overdue or paid labels', () => {
  const { PaymentScheduleEditor } = loadSource('src/components/admin/PaymentScheduleEditor.tsx');
  const html = renderToStaticMarkup(React.createElement(PaymentScheduleEditor, { schedule: { ...state().snapshot.customer, paid_count: 0 }, hasLegacyLedger: true }));
  assert.match(html, /수납 상태 확인 불가/); assert.ok(!html.includes('연체')); assert.ok(!html.includes('원장 수납 충족'));
});


test('single timed-out attempt returning a conclusive conflict unlocks explicit reload', async () => {
  let resolveFirst; let loads = 0;
  const s = setup({ save: () => new Promise(resolve => { resolveFirst = resolve; }), load: async () => { loads++; return { ok: true, state: state() }; } });
  try {
    draftNew(s); s.submit(); s.click('검토한 변경 최종 저장'); s.timeout();
    assert.equal(s.button('취소').props.disabled, true);
    resolveFirst({ error: '다른 저장과 충돌했습니다', code: 'CASHFLOW_CONFLICT' }); await s.settle();
    assert.equal(s.button('검토한 변경 최종 저장').props.disabled, true);
    assert.equal(s.button('최신 원장 다시 불러오기').props.disabled, false);
    s.click('최신 원장 다시 불러오기'); await s.settle(); assert.equal(loads, 1); assert.equal(s.button('새 거래 등록').props.disabled, false);
  } finally { s.cleanup(); }
});

test('all timed-out attempts conclusively rejected can reload even if the original finishes last', async () => {
  let resolveFirst; let run = 0;
  const s = setup({ save: () => ++run === 1 ? new Promise(resolve => { resolveFirst = resolve; }) : Promise.resolve({ error: '권한 확인 실패', code: 'FORBIDDEN' }) });
  try {
    draftNew(s); s.submit(); s.click('검토한 변경 최종 저장'); s.timeout(); s.click('같은 요청으로 확인·재시도');
    await new Promise(resolve => setImmediate(resolve)); s.render(); assert.equal(s.button('취소').props.disabled, true);
    resolveFirst({ error: '다른 저장과 충돌했습니다', code: 'CASHFLOW_CONFLICT' }); await s.settle();
    assert.equal(s.button('최신 원장 다시 불러오기').props.disabled, false);
  } finally { s.cleanup(); }
});

test('lost network outcome remains frozen after a later pre-RPC rejection', async () => {
  let run = 0;
  const s = setup({ save: async () => ++run === 1 ? { error: '연결 결과 불명', code: 'UNCONFIRMED' } : { error: '설정 미완료', code: 'NOT_READY' } });
  try {
    draftNew(s); s.submit(); s.click('검토한 변경 최종 저장'); await s.settle(); s.click('같은 요청으로 확인·재시도'); await s.settle();
    assert.equal(s.button('취소').props.disabled, true); assert.equal(s.button('돌아가서 수정').props.disabled, true); assert.equal(s.calls[0], s.calls[1]);
  } finally { s.cleanup(); }
});


test('unavailable actual receipt source never labels scheduled rows as paid or overdue', () => {
  const { PaymentScheduleEditor } = loadSource('src/components/admin/PaymentScheduleEditor.tsx');
  for (const paid_count of [0, 1]) {
    const html = renderToStaticMarkup(React.createElement(PaymentScheduleEditor, { schedule: { ...state().snapshot.customer, paid_count, rental_receipts: [{ ...movement, kind: 'rental_receipt', installment_no: 2, amount: 1100000 }] }, receiptStatusUnavailable: true }));
    assert.match(html, /실제 수납 원장을 불러오지 못해/); assert.match(html, /수납 상태 확인 불가/);
    assert.ok(!html.includes('연체')); assert.ok(!html.includes('원장 수납 충족'));
    assert.equal((html.match(/수납 상태 확인 불가/g) ?? []).length, 2);
  }
});
