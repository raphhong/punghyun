import assert from 'node:assert/strict';
import test from 'node:test';
import { fakeDb, loadSource, CUSTOMER, ID_A, ID_B } from './document-fixtures.mjs';

const pipeline = loadSource('src/lib/admin/pipeline.ts');
const intent = pipeline.PURCHASE_INTENT_DOCS[0];
const componentStubs = new Proxy({}, { get: (_, name) => String(name) });
function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== 'object' || !node.props) return [];
  return [node, ...elements(node.props.children)];
}
async function renderCustomer(docs = [], hospitalType = 'individual', attachments = []) {
  const db = fakeDb({ legacy: docs, attachments, customers: [{ id: CUSTOMER, hospital_type: hospitalType, stage: 'contract', source: 'manual', share_token: 'fixture-token', sales_agent_id: null }] });
  const mocks = {
    'server-only': {}, '@/lib/supabase/server': { createClient: async () => db },
    'next/headers': { headers: async () => new Headers({ host: 'localhost:3000' }) },
    'next/navigation': { notFound() { throw Error('not found'); } }, 'next/link': 'a',
    "../cashflow-actions": { loadCustomerCashflow: async () => ({ error: "Synthetic fixture has no finance data" }), saveCustomerCashflow: async () => ({ error: "Not available in document fixture" }) },
    '../actions': new Proxy({}, { get: () => () => {} }),
  };
  for (const name of ['CollapsibleCard', 'PipelineStepper', 'AdminDocUpload', 'PaymentSchedule', 'BasicInfoForm', 'AutoSaveForm', 'DocGallery', 'ShareButton', 'MoneyInput', 'RentalIncomeTracker', 'PrintContractLinks']) mocks[`@/components/admin/${name}`] = componentStubs;
  mocks['@/components/DeviceManager'] = componentStubs;
  mocks['@/components/documents/AttachmentList'] = componentStubs;
  // Page-only test: preserve actual server data shaping, isolate interactive widgets.
  const { default: Page } = loadSource('src/app/ph-console-8f27x/(app)/customers/[id]/page.tsx', mocks);
  return { tree: await Page({ params: Promise.resolve({ id: CUSTOMER }) }), db };
}

test('purchase intent remains a unique optional admin-only document', () => {
  assert.deepEqual(intent, { key: 'purchase_intent', label: '매입의향서', category: 'inspection' });
  assert.equal(pipeline.PURCHASE_INTENT_DOCS.length, 1);
  for (const type of [null, 'individual', 'corporate']) assert.equal(pipeline.docsForType(pipeline.ALL_DOCS, type).some(doc => doc.key === intent.key), false);
  const all = [...pipeline.ALL_DOCS, ...pipeline.TRANSACTION_DOCS, ...pipeline.PURCHASE_INTENT_DOCS];
  assert.equal(new Set(all.map(doc => doc.key)).size, all.length);
});

for (const type of ['individual', 'corporate']) test(`admin keeps an open optional purchase-intent slot (${type})`, async () => {
  const { tree } = await renderCustomer([], type);
  const card = elements(tree).find(el => el.props.title === '매입의향서');
  assert.ok(card); assert.equal(card.props.open, true); assert.match(card.props.desc, /선택/);
  const list = card.props.children;
  const rows = elements(list.type(list.props));
  const upload = rows.find(el => el.type === 'AdminDocUpload');
  assert.equal(upload.props.customerId, CUSTOMER); assert.equal(upload.props.docKey, 'purchase_intent'); assert.equal(upload.props.category, 'inspection');
  assert.deepEqual(rows.find(el => el.type === 'AttachmentList').props.files, []);
});

for (const [ext, isImage] of [['pdf', false], ['png', true]]) test(`legacy ${ext} retains signed view/download data and Korean gallery label`, async () => {
  const file = `${CUSTOMER}/purchase_intent-1.${ext}`;
  const { tree } = await renderCustomer([{ id: ID_A, customer_id: CUSTOMER, doc_key: intent.key, file_path: file, checked: true }]);
  const nodes = elements(tree); const list = nodes.find(el => el.props.title === '매입의향서').props.children;
  const attachments = elements(list.type(list.props)).find(el => el.type === 'AttachmentList').props.files;
  assert.equal(attachments.length, 1); assert.equal(attachments[0].url, `https://storage.example.test/${file}?token=fixture`);
  assert.equal(attachments[0].attachmentId, undefined); // No unsafe pre-migration delete.
  const gallery = nodes.find(el => el.type === 'DocGallery');
  assert.deepEqual(gallery.props.items.map(({ key, docKey, label, isImage }) => ({ key, docKey, label, isImage })), [{ key: ID_A, docKey: intent.key, label: '매입의향서', isImage }]);
});

test('multiple purchase-intent attachments stay distinct in gallery and per-item list', async () => {
  const attachment = id => ({ id, customer_id: CUSTOMER, doc_key: intent.key, category: intent.category, file_path: `${CUSTOMER}/attachments/${id}.pdf`, original_name: '의향서.pdf', source: 'admin', size_bytes: 22, content_type: 'application/pdf', state: 'ready', deleted_at: null, created_at: '2026-10-02T00:00:00Z' });
  const { tree } = await renderCustomer([], 'individual', [attachment(ID_A), attachment(ID_B)]);
  const nodes = elements(tree); const gallery = nodes.find(el => el.type === 'DocGallery');
  assert.deepEqual(gallery.props.items.map(row => row.key), [ID_A, ID_B]);
  const list = nodes.find(el => el.props.title === '매입의향서').props.children;
  assert.equal(elements(list.type(list.props)).find(el => el.type === 'AttachmentList').props.files.length, 2);
});
