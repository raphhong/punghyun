import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { fakeDb, server, loadSource, CUSTOMER, OTHER, ID_A, ID_B, PDF } from './document-fixtures.mjs';
const helpers = server();
const metadata = id => ({ id, size: PDF.size, type: PDF.type });
async function upload(db, id = ID_A, source = 'admin', docKey = 'tax_payment_cert') {
  const signed = await helpers.beginDocumentUpload(db, CUSTOMER, docKey, '동명파일.pdf', metadata(id), source);
  assert.ok(!signed.error, signed.error);
  db.files.set(signed.path, PDF);
  const result = await helpers.finishDocumentUpload(db, CUSTOMER, docKey, 'screening_2', signed.path, id, source);
  assert.deepEqual(result, { ok: true });
  return signed;
}

test('two files and later append preserve same-name objects, legacy path and manual review state', async () => {
  const legacy = { id: 'legacy', customer_id: CUSTOMER, doc_key: 'tax_payment_cert', category: 'screening_2', file_path: `${CUSTOMER}/old.pdf`, checked: false };
  const db = fakeDb({ legacy: [legacy] });
  const [a, b] = await Promise.all([upload(db, ID_A), upload(db, ID_B)]);
  assert.notEqual(a.path, b.path);
  assert.deepEqual(db.rows.customer_documents, [legacy]);
  assert.equal(db.rows.customer_document_attachments.length, 2);
  const list = await helpers.listCustomerDocuments(db, CUSTOMER);
  assert.equal(list.filter(r => r.file_path).length, 3);
  assert.ok(list.every(r => r.checked === false));
  for (const row of db.rows.customer_document_attachments) {
    assert.equal(row.original_name, '동명파일.pdf');
    assert.equal(row.size_bytes, PDF.size);
    assert.equal(row.content_type, PDF.type);
    assert.match(row.sha256, /^[a-f0-9]{64}$/);
    assert.equal(row.source, 'admin');
  }
  assert.ok(db.calls.filter(c => c.sign).every(c => c.settings.upsert === false));
});

test('lost finalize response and concurrent retries persist one row per stable UUID', async () => {
  const db = fakeDb();
  const signed = await helpers.beginDocumentUpload(db, CUSTOMER, 'tax_payment_cert', '동명파일.pdf', metadata(ID_A), 'admin');
  db.files.set(signed.path, PDF);
  const complete = () => helpers.finishDocumentUpload(db, CUSTOMER, 'tax_payment_cert', 'screening_2', signed.path, ID_A, 'admin');
  assert.deepEqual(await Promise.all([complete(), complete(), complete()]), [{ ok: true }, { ok: true }, { ok: true }]);
  assert.deepEqual(await complete(), { ok: true });
  assert.equal(db.rows.customer_document_attachments.length, 1);
});

test('one failed file can retry without duplicating successful or overwriting existing uploads', async () => {
  const db = fakeDb();
  await upload(db, ID_A);
  const signed = await helpers.beginDocumentUpload(db, CUSTOMER, 'tax_payment_cert', '동명파일.pdf', metadata(ID_B), 'admin');
  assert.ok((await helpers.finishDocumentUpload(db, CUSTOMER, 'tax_payment_cert', 'screening_2', signed.path, ID_B, 'admin')).error);
  const retry = await helpers.beginDocumentUpload(db, CUSTOMER, 'tax_payment_cert', '동명파일.pdf', metadata(ID_B), 'admin');
  assert.equal(retry.path, signed.path);
  db.files.set(retry.path, PDF);
  assert.deepEqual(await helpers.finishDocumentUpload(db, CUSTOMER, 'tax_payment_cert', 'screening_2', retry.path, ID_B, 'admin'), { ok: true });
  assert.equal(db.rows.customer_document_attachments.length, 2);
});

test('soft removal targets exactly one ID, preserves all bytes, and restores legacy tombstones', async () => {
  const db = fakeDb(); const a = await upload(db, ID_A); await upload(db, ID_B);
  db.rows.customer_documents.push({ id: 'legacy', customer_id: CUSTOMER, doc_key: 'tax_payment_cert', file_path: a.path, checked: true });
  assert.deepEqual(await helpers.setDocumentRemoved(db, CUSTOMER, 'tax_payment_cert', ID_A, true, 'admin'), { ok: true });
  const listed = await helpers.listCustomerDocuments(db, CUSTOMER);
  assert.equal(listed.length, 2); assert.equal(listed.filter(r => !r.deleted_at).length, 1);
  assert.equal(db.files.size, 2);
  assert.deepEqual(await helpers.setDocumentRemoved(db, CUSTOMER, 'tax_payment_cert', ID_A, false, 'admin'), { ok: true });
  assert.equal((await helpers.listCustomerDocuments(db, CUSTOMER)).filter(r => !r.deleted_at).length, 2);
  assert.ok((await helpers.setDocumentRemoved(db, OTHER, 'tax_payment_cert', ID_A, true, 'admin')).error);
  await assert.rejects(() => helpers.assertNoRetainedAttachments(db, CUSTOMER), /보존/);
});

test('migration absent keeps old single-file read and blocks new uploads without legacy writes', async () => {
  const db = fakeDb({ missingAttachments: true, legacy: [{ id: 'legacy', customer_id: CUSTOMER, doc_key: 'tax_payment_cert', file_path: 'old.pdf' }] });
  assert.equal((await helpers.listCustomerDocuments(db, CUSTOMER)).length, 1);
  assert.match((await helpers.beginDocumentUpload(db, CUSTOMER, 'tax_payment_cert', 'file.pdf', metadata(ID_A), 'admin')).error, /준비/);
  assert.equal(db.rows.customer_documents[0].file_path, 'old.pdf');
});

test('metadata, actual bytes, MIME and file signatures are checked server-side', async () => {
  for (const [name, meta] of [['bad.exe', metadata(ID_A)], ['file.pdf', { ...metadata(ID_A), size: 21 * 1024 * 1024 }], ['file.pdf', { ...metadata(ID_A), type: 'text/html' }], ['../file.pdf', metadata(ID_A)]]) {
    const db = fakeDb(); assert.ok((await helpers.beginDocumentUpload(db, CUSTOMER, 'tax_payment_cert', name, meta, 'admin')).error); assert.equal(db.calls.length, 0);
  }
  for (const override of [{ size: PDF.size + 1 }, { contentType: 'text/html' }]) {
    const db = fakeDb({ infoOverride: override });
    const signed = await helpers.beginDocumentUpload(db, CUSTOMER, 'tax_payment_cert', 'file.pdf', metadata(ID_A), 'admin'); db.files.set(signed.path, PDF);
    assert.ok((await helpers.finishDocumentUpload(db, CUSTOMER, 'tax_payment_cert', 'screening_2', signed.path, ID_A, 'admin')).error);
    assert.equal(db.rows.customer_document_attachments[0].state, 'pending');
  }
  const db = fakeDb(); const invalid = new Blob(['not-a-real-pdf'], { type: 'application/pdf' });
  const signed = await helpers.beginDocumentUpload(db, CUSTOMER, 'tax_payment_cert', 'file.pdf', { id: ID_A, size: invalid.size, type: invalid.type }, 'admin'); db.files.set(signed.path, invalid);
  assert.match((await helpers.finishDocumentUpload(db, CUSTOMER, 'tax_payment_cert', 'screening_2', signed.path, ID_A, 'admin')).error, /내용/);
});

test('scope, document category and upload source cannot be changed during finalize/retry', async () => {
  const db = fakeDb(); const signed = await helpers.beginDocumentUpload(db, CUSTOMER, 'tax_payment_cert', 'file.pdf', metadata(ID_A), 'public'); db.files.set(signed.path, PDF);
  for (const args of [[OTHER, 'tax_payment_cert', 'screening_2', signed.path, ID_A, 'public'], [CUSTOMER, 'tax_payment_cert', 'contract', signed.path, ID_A, 'public'], [CUSTOMER, 'tax_payment_cert', 'screening_2', `${OTHER}/fake.pdf`, ID_A, 'public'], [CUSTOMER, 'tax_payment_cert', 'screening_2', signed.path, ID_A, 'sales']]) assert.ok((await helpers.finishDocumentUpload(db, ...args)).error);
  assert.ok((await helpers.beginDocumentUpload(db, CUSTOMER, 'tax_payment_cert', 'different.pdf', metadata(ID_A), 'public')).error);
  for (const source of ['sales', 'public']) assert.ok((await helpers.beginDocumentUpload(db, CUSTOMER, 'purchase_intent', 'file.pdf', metadata(ID_B), source)).error);
});

function actions(scope, db, options = {}) {
  const files = { admin: 'src/app/ph-console-8f27x/(app)/customers/actions.ts', sales: 'src/app/sales/actions.ts', public: 'src/app/s/[token]/actions.ts' };
  return loadSource(files[scope], {
    'server-only': {}, 'next/cache': { revalidatePath() {} }, 'next/navigation': { redirect() {} },
    '@/lib/supabase/server': { createClient: async () => db }, '@/lib/supabase/admin': { createAdminClient: () => db },
    '@/lib/sales/agent': { getSessionAgent: async () => ({ agent: options.unapproved ? { status: 'pending' } : { status: 'approved' } }) },
  });
}

for (const scope of ['admin', 'sales', 'public']) test(`${scope} supports append and reauthorizes finalization`, async () => {
  const db = fakeDb(); const api = actions(scope, db); const key = scope === 'public' ? 'fixture-token' : CUSTOMER;
  const begin = scope === 'sales' ? api.salesCreateDocUploadUrl : api.createDocUploadUrl;
  const finish = scope === 'sales' ? api.salesRecordDocUpload : api.recordDocUpload;
  for (const id of [ID_A, ID_B]) {
    const signed = await begin(key, 'tax_payment_cert', 'same.pdf', metadata(id)); assert.ok(!signed.error, signed.error);
    db.files.set(signed.path, PDF); assert.deepEqual(await finish(key, 'tax_payment_cert', 'screening_2', signed.path, id), { ok: true });
  }
  assert.equal(db.rows.customer_document_attachments.length, 2);
  db.rows.customers = []; assert.ok((await finish(key, 'tax_payment_cert', 'screening_2', db.rows.customer_document_attachments[0].file_path, ID_A)).error);
});

test('admin denial, outside sales subtree, pending sales and expired/revoked public tokens fail before storage access', async () => {
  const a = fakeDb({ admin: false }); assert.ok((await actions('admin', a).createDocUploadUrl(CUSTOMER, 'tax_payment_cert', 'file.pdf', metadata(ID_A))).error);
  const b = fakeDb(); assert.ok((await actions('sales', b).salesCreateDocUploadUrl(OTHER, 'tax_payment_cert', 'file.pdf', metadata(ID_A))).error);
  assert.ok((await actions('sales', b, { unapproved: true }).salesCreateDocUploadUrl(CUSTOMER, 'tax_payment_cert', 'file.pdf', metadata(ID_A))).error);
  for (const expiry of ['2000-01-01T00:00:00Z', 'invalid-date']) { const db = fakeDb({ expiry }); assert.ok((await actions('public', db).createDocUploadUrl('fixture-token', 'tax_payment_cert', 'file.pdf', metadata(ID_A))).error); assert.equal(db.calls.some(c => c.sign), false); }
  assert.equal(helpers.validShareTokenExpiry(null), true);
  assert.equal(helpers.validShareTokenExpiry('2099-01-01T00:00:00Z'), true);
  assert.ok((await actions('public', b).createDocUploadUrl('revoked', 'tax_payment_cert', 'file.pdf', metadata(ID_A))).error);
  assert.equal(a.calls.some(c => c.sign), false); assert.equal(b.calls.some(c => c.sign), false);
});

async function zipRoute(db, query) {
  const { GET } = loadSource('src/app/ph-console-8f27x/(app)/customers/[id]/download/route.ts', { 'server-only': {}, '@/lib/supabase/server': { createClient: async () => db } });
  return GET({ nextUrl: new URL(`https://app.example.test/download?${query}`) }, { params: Promise.resolve({ id: CUSTOMER }) });
}
test('ZIP key includes every attachment with same filename, selected IDs are exact, no silent partial archive', async () => {
  const db = fakeDb(); await upload(db, ID_A); const b = await upload(db, ID_B);
  let response = await zipRoute(db, 'keys=tax_payment_cert'); assert.equal(response.status, 200);
  const zip = await JSZip.loadAsync(await response.arrayBuffer()); assert.equal(Object.keys(zip.files).length, 2);
  assert.ok(Object.keys(zip.files).every(n => n.includes('동명파일')));
  response = await zipRoute(db, `ids=${ID_B}`); assert.equal(Object.keys((await JSZip.loadAsync(await response.arrayBuffer())).files).length, 1);
  db.files.delete(b.path); assert.equal((await zipRoute(db, 'keys=tax_payment_cert')).status, 502);
  assert.equal((await zipRoute(db, `ids=${ID_A},${OTHER}`)).status, 409);
});
test('ZIP fails closed for unauthenticated, non-admin and admin lookup errors', async () => {
  assert.equal((await zipRoute(fakeDb({ authenticated: false }), 'keys=tax_payment_cert')).status, 401);
  assert.equal((await zipRoute(fakeDb({ admin: false }), 'keys=tax_payment_cert')).status, 403);
  const db = fakeDb(); db.errors.set('admins:select', { message: 'database failure' }); assert.equal((await zipRoute(db, 'keys=tax_payment_cert')).status, 403);
});


test('document reads paginate beyond Supabase default row cap without dropping legacy or new rows', async () => {
  const legacy = Array.from({ length: 1105 }, (_, n) => ({ id: `legacy-${n}`, customer_id: CUSTOMER, doc_key: `device_photo_${n}`, file_path: `${CUSTOMER}/photo-${n}.jpg` }));
  const db = fakeDb({ legacy });
  assert.equal((await helpers.listCustomerDocuments(db, CUSTOMER)).length, 1105);
  assert.equal(db.calls.filter(c => c.table === 'customer_documents').length, 3);
});

test('device-photo record/delete endpoints cannot bypass retained checklist paths', async () => {
  for (const scope of ['admin', 'sales', 'public']) {
    const db = fakeDb(); const api = actions(scope, db); const context = scope === 'public' ? 'fixture-token' : CUSTOMER;
    const record = scope === 'sales' ? api.salesRecordDevicePhoto : api.recordDevicePhoto;
    const remove = scope === 'sales' ? api.salesDeleteDevicePhoto : api.deleteDevicePhoto;
    assert.ok((await record(context, ID_B, `${CUSTOMER}/attachments/${ID_A}.pdf`)).error);
    assert.ok((await remove(context, 'tax_payment_cert')).error);
    assert.equal(db.calls.filter(c => c.operation === 'delete').length, 0);
  }
});


test('ZIP never overwrites entries when real names already contain generated duplicate suffixes', async () => {
  const db = fakeDb(); await upload(db, ID_A); await upload(db, ID_B);
  db.rows.customer_document_attachments[0].original_name = 'A.pdf';
  db.rows.customer_document_attachments[1].original_name = 'A.pdf';
  const id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const path = `${CUSTOMER}/attachments/${id}.pdf`;
  db.rows.customer_document_attachments.push({ ...db.rows.customer_document_attachments[0], id, file_path: path, original_name: 'A (1).pdf' });
  db.files.set(path, new Blob(['%PDF-1.7 different'], { type: 'application/pdf' }));
  const response = await zipRoute(db, 'keys=tax_payment_cert'); assert.equal(response.status, 200);
  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  assert.equal(Object.keys(zip.files).length, 3);
  const contents = await Promise.all(Object.values(zip.files).map(file => file.async('string')));
  assert.equal(contents.filter(value => value.includes('different')).length, 1);
});
