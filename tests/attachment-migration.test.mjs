import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { loadSource } from './cashflow-loader.mjs';

// In-memory synthetic PostgreSQL only. No environment credentials, network,
// customer fixtures, uploads, or production database are used by this suite.
const sql = fs.readFileSync(new URL('../supabase/drafts/20261002_multiple_document_attachments.sql', import.meta.url), 'utf8');
const backfill = sql.split('-- BACKFILL BEGIN:')[1].split('\n').slice(1).join('\n').split('-- BACKFILL END')[0];
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const C = uid(101), OTHER = uid(102), OWN = uid(103);
const legacy = `${C}/business original.pdf`;

const baseline = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema storage;
grant usage on schema public, auth, storage to anon, authenticated, service_role;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create table public.admins (user_id uuid primary key);
create table public.sales_agents (id uuid primary key, user_id uuid, status text, ancestor_ids uuid[] not null default '{}');
create function public.is_admin(uid uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists (select 1 from public.admins a where a.user_id=uid);
$$;
create function public.customer_in_my_subtree(cust_agent uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select case when cust_agent is null then false else exists (
    select 1 from public.sales_agents sa, public.sales_agents me
    where sa.id=cust_agent and me.user_id=auth.uid() and me.status='approved'
      and (sa.id=me.id or me.id=any(sa.ancestor_ids))
  ) end;
$$;
create table public.customers (id uuid primary key, sales_agent_id uuid, share_token uuid not null default gen_random_uuid());
create table public.customer_documents (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id) on delete cascade,
  category text not null, doc_key text not null, checked boolean not null default false,
  file_path text, uploaded_at timestamptz, device_id uuid, unique(customer_id,doc_key)
);
alter table public.customers enable row level security;
alter table public.customer_documents enable row level security;
grant select, insert, update, delete on public.customers, public.customer_documents to authenticated, service_role;
create policy customers_admin on public.customers for all to authenticated using(public.is_admin(auth.uid())) with check(public.is_admin(auth.uid()));
create policy customers_agent on public.customers for select to authenticated using(public.customer_in_my_subtree(sales_agent_id));
create policy docs_admin on public.customer_documents for all to authenticated using(public.is_admin(auth.uid())) with check(public.is_admin(auth.uid()));
create policy docs_agent on public.customer_documents for select to authenticated using(exists(
  select 1 from public.customers c where c.id=customer_documents.customer_id and public.customer_in_my_subtree(c.sales_agent_id)
));
create table storage.buckets (id text primary key, name text, public boolean not null default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, metadata jsonb, unique(bucket_id,name));
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
create policy "authenticated read docs" on storage.objects for select to authenticated using(bucket_id='customer-docs');
create policy "authenticated write docs" on storage.objects for insert to authenticated with check(bucket_id='customer-docs');
create policy "authenticated update docs" on storage.objects for update to authenticated using(bucket_id='customer-docs');
create policy "authenticated delete docs" on storage.objects for delete to authenticated using(bucket_id='customer-docs');
insert into storage.buckets(id,name,public) values ('customer-docs','customer-docs',false), ('other','other',false);
insert into public.admins values('${uid(1)}');
insert into public.sales_agents(id,user_id,status,ancestor_ids) values
  ('${uid(201)}','${uid(2)}','approved','{}'),
  ('${uid(202)}','${uid(3)}','approved','{${uid(201)}}'),
  ('${uid(203)}','${uid(4)}','approved','{}'),
  ('${uid(204)}','${uid(5)}','pending','{}');
insert into public.customers(id,sales_agent_id) values ('${C}','${uid(202)}'), ('${OTHER}','${uid(203)}'), ('${OWN}','${uid(201)}');
insert into public.customer_documents(customer_id,category,doc_key,checked,file_path,uploaded_at,device_id) values
  ('${C}','screening_2','business_registration',false,'${legacy}','2026-01-02T03:04:05Z',null),
  ('${C}','screening_2','corporate_registration',true,null,null,null),
  ('${C}','inspection','purchase_intent',true,'${C}/internal.pdf',null,null),
  ('${C}','screening_3','device_photo_with_id',true,'${C}/device.jpg',null,'${uid(401)}'),
  ('${C}','screening_3','device_photo_old',false,'${C}/old-device.jpg',null,null),
  ('${C}','screening_3','damage_photos',true,'${C}/device-linked.jpg',null,'${uid(402)}'),
  ('${C}','screening_2','tax_payment_cert',false,'',null,null),
  ('${OTHER}','screening_2','business_registration',true,'${OTHER}/other.pdf',null,null),
  ('${OWN}','screening_2','business_registration',true,'${OWN}/own.pdf',null,null);
insert into storage.objects(bucket_id,name,metadata)
  select 'customer-docs',file_path,'{"unchanged":true}'::jsonb from public.customer_documents where file_path is not null and file_path<>'';
`;

async function fixture(t, migrate = true) {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(baseline);
  if (migrate) await db.exec(sql);
  return db;
}
const rows = async (db, query, params = []) => (await db.query(query, params)).rows;
async function asRole(db, role, user, query, params = []) {
  await db.exec('begin');
  try {
    await db.exec(`set local role ${role}`);
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [user ?? '']);
    const result = await db.query(query, params);
    await db.exec('commit');
    return result.rows;
  } catch (e) {
    await db.exec('rollback');
    throw e;
  }
}
async function add(db, n, overrides = {}) {
  const record = {
    id: uid(n), customer_id: C, doc_key: 'business_registration', category: 'screening_2',
    original_name: 'new.pdf', size_bytes: 10, content_type: 'application/pdf', source: 'admin', state: 'pending',
    ...overrides,
  };
  record.file_path ??= `${record.customer_id}/attachments/${record.id}.pdf`;
  const keys = Object.keys(record);
  await asRole(db, 'service_role', null,
    `insert into public.customer_document_attachments (${keys.join(',')}) values (${keys.map((_, i) => `$${i + 1}`).join(',')})`, Object.values(record));
  return record;
}

test('additive backfill preserves exact legacy rows, checklist state, objects, and token values', async t => {
  const db = await fixture(t, false);
  const docs = await rows(db, 'select * from public.customer_documents order by id');
  const objects = await rows(db, 'select * from storage.objects order by id');
  const customers = await rows(db, 'select * from public.customers order by id');
  await db.exec(sql);
  assert.deepEqual(await rows(db, 'select * from public.customer_documents order by id'), docs);
  assert.deepEqual(await rows(db, 'select * from storage.objects order by id'), objects);
  assert.deepEqual(await rows(db, 'select id,sales_agent_id,share_token from public.customers order by id'), customers);
  assert.equal((await rows(db, 'select * from public.customers where share_token_expires_at is not null')).length, 0);
  const migrated = await rows(db, 'select * from public.customer_document_attachments order by file_path');
  assert.equal(migrated.length, 4);
  assert.ok(migrated.every(a => a.source === 'legacy' && a.state === 'ready' && a.size_bytes === null && a.content_type === null));
  assert.ok(migrated.every(a => !a.doc_key.startsWith('device_photo_') && a.doc_key !== 'damage_photos'));
  const original = migrated.find(a => a.file_path === legacy);
  assert.equal(original.original_name, 'business original.pdf');
  assert.equal(original.uploaded_at.toISOString(), '2026-01-02T03:04:05.000Z');
  await assert.rejects(db.query(`insert into public.customer_documents(customer_id,doc_key,category) values($1,'business_registration','screening_2')`, [C]), /unique/i);
});

test('legacy trigger archives new pointers and retries without restoring tombstones or changing checked', async t => {
  const db = await fixture(t);
  const oldId = (await rows(db, 'select id from public.customer_document_attachments where file_path=$1', [legacy]))[0].id;
  await asRole(db, 'service_role', null, 'update public.customer_document_attachments set deleted_at=now() where id=$1', [oldId]);
  await asRole(db, 'authenticated', uid(1), `update public.customer_documents set file_path=$1 where customer_id=$2 and doc_key='business_registration'`, [`${C}/replacement.pdf`, C]);
  assert.equal((await rows(db, 'select * from public.customer_document_attachments where customer_id=$1 and doc_key=$2', [C, 'business_registration'])).length, 2);
  await asRole(db, 'authenticated', uid(1), `update public.customer_documents set file_path=$1 where customer_id=$2 and doc_key='business_registration'`, [legacy, C]);
  await db.exec(backfill);
  assert.ok((await rows(db, 'select deleted_at from public.customer_document_attachments where id=$1', [oldId]))[0].deleted_at);
  assert.equal((await rows(db, `select checked from public.customer_documents where customer_id=$1 and doc_key='business_registration'`, [C]))[0].checked, false);
  await asRole(db, 'authenticated', uid(1), `insert into public.customer_documents(customer_id,category,doc_key,file_path) values($1,'screening_2','medical_license',$2)`, [C, `${C}/license.pdf`]);
  assert.equal((await rows(db, `select count(*)::int as n from public.customer_document_attachments where doc_key='medical_license'`))[0].n, 1);
  await assert.rejects(asRole(db, 'authenticated', uid(1), `update public.customer_documents set file_path=$1 where customer_id=$2 and doc_key='medical_license'`, [legacy, C]), /different attachment/);
  await assert.rejects(asRole(db, 'service_role', null, `update public.customer_documents set file_path=$1 where customer_id=$2 and doc_key='medical_license'`, [`${C}/attachments/${uid(500)}.pdf`, C]), /legacy checklist/);
});

test('per-upload IDs/paths, identity, source scope, state, and retained customer FK are enforced', async t => {
  const db = await fixture(t);
  const a = await add(db, 301);
  const b = await add(db, 302); // Same document/name is a separate upload.
  assert.notEqual(a.file_path, b.file_path);
  await assert.rejects(add(db, 303, { file_path: a.file_path }), /unique|check/);
  await assert.rejects(add(db, 304, { file_path: `${OTHER}/attachments/${uid(304)}.pdf` }), /check/);
  await assert.rejects(add(db, 305, { source: 'sales', doc_key: 'purchase_intent', category: 'inspection' }), /check/);
  await assert.rejects(add(db, 306, { source: 'public', category: 'inspection' }), /check/);
  await assert.rejects(add(db, 307, { size_bytes: 20971521 }), /check/);
  await assert.rejects(add(db, 308, { size_bytes: null }), /check/);
  await assert.rejects(add(db, 309, { state: 'ready' }), /check/);
  await assert.rejects(asRole(db, 'service_role', null, 'update public.customer_document_attachments set file_path=$1 where id=$2', [`${C}/attachments/${uid(399)}.pdf`, a.id]), /immutable/);
  await asRole(db, 'service_role', null, `update public.customer_document_attachments set state='ready',uploaded_at=now() where id=$1`, [a.id]);
  await assert.rejects(asRole(db, 'service_role', null, `update public.customer_document_attachments set state='pending' where id=$1`, [a.id]), /cannot return/);
  await assert.rejects(db.query('delete from public.customers where id=$1', [C]), /foreign key/);
  await assert.rejects(asRole(db, 'service_role', null, 'delete from public.customer_document_attachments where id=$1', [a.id]), /permission denied/);
});

test('attachment RLS gives admins read and approved agents only shared subtree rows, with no client writes/anon access', async t => {
  const db = await fixture(t);
  await add(db, 310); // Pending rows are not shown to agents.
  const adminRows = await asRole(db, 'authenticated', uid(1), 'select * from public.customer_document_attachments');
  assert.equal(adminRows.length, 5);
  const agentRows = await asRole(db, 'authenticated', uid(2), 'select * from public.customer_document_attachments');
  assert.equal(agentRows.length, 2); // Own + child; internal purchase_intent excluded.
  assert.ok(agentRows.every(a => [C, OWN].includes(a.customer_id) && a.doc_key === 'business_registration'));
  assert.equal((await asRole(db, 'authenticated', uid(3), 'select * from public.customer_document_attachments')).length, 1);
  assert.equal((await asRole(db, 'authenticated', uid(4), 'select * from public.customer_document_attachments')).length, 1);
  assert.equal((await asRole(db, 'authenticated', uid(5), 'select * from public.customer_document_attachments')).length, 0);
  assert.equal((await asRole(db, 'authenticated', uid(999), 'select * from public.customer_document_attachments')).length, 0);
  await assert.rejects(asRole(db, 'anon', null, 'select * from public.customer_document_attachments'), /permission denied/);
  for (const operation of [
    'delete from public.customer_document_attachments',
    "update public.customer_document_attachments set deleted_at=now()",
    "insert into public.customer_document_attachments default values",
  ]) await assert.rejects(asRole(db, 'authenticated', uid(1), operation), /permission denied/);
  const policies = await rows(db, `select * from pg_policies where tablename='customer_document_attachments'`);
  assert.ok(policies.every(p => p.cmd === 'SELECT' && p.roles.join(',') === 'authenticated'));
});

test('Storage scope hides pending/removed/internal/unrelated files and fences immutable paths despite permissive policies', async t => {
  const db = await fixture(t);
  const a = await add(db, 320);
  await asRole(db, 'service_role', null, `insert into storage.objects(bucket_id,name) values('customer-docs',$1)`, [a.file_path]);
  let agent = await asRole(db, 'authenticated', uid(2), 'select name from storage.objects');
  assert.ok(agent.some(o => o.name === legacy));
  assert.ok(agent.some(o => o.name === `${C}/old-device.jpg`));
  assert.ok(!agent.some(o => [a.file_path, `${C}/internal.pdf`, `${OTHER}/other.pdf`].includes(o.name)));
  await asRole(db, 'service_role', null, `update public.customer_document_attachments set state='ready',uploaded_at=now() where id=$1`, [a.id]);
  agent = await asRole(db, 'authenticated', uid(2), 'select name from storage.objects');
  assert.ok(agent.some(o => o.name === a.file_path));
  // Simulate a future accidental permissive policy. Restrictive fences hold.
  await db.exec('create policy future_accidental_broad_policy on storage.objects for all to authenticated using(true) with check(true)');
  await assert.rejects(asRole(db, 'authenticated', uid(1), `insert into storage.objects(bucket_id,name) values('customer-docs',$1)`, [`${C}/attachments/${uid(999)}.pdf`]), /row-level security/);
  assert.equal((await asRole(db, 'authenticated', uid(1), 'delete from storage.objects where name=$1 returning name', [a.file_path])).length, 0);
  assert.equal((await asRole(db, 'authenticated', uid(1), `update storage.objects set metadata='{}' where name=$1 returning name`, [a.file_path])).length, 0);
  assert.equal((await asRole(db, 'authenticated', uid(1), 'delete from storage.objects where name=$1 returning name', [legacy])).length, 0);
  await asRole(db, 'service_role', null, 'update public.customer_document_attachments set deleted_at=now() where id=$1', [a.id]);
  assert.equal((await asRole(db, 'authenticated', uid(1), 'select name from storage.objects where name=$1', [a.file_path])).length, 0);
  assert.equal((await asRole(db, 'authenticated', uid(2), `select name from storage.objects where name like '%/internal.pdf' or name=$1`, [`${OTHER}/other.pdf`])).length, 0);
  await asRole(db, 'service_role', null, 'update public.customer_document_attachments set deleted_at=null where id=$1', [a.id]);
  assert.equal((await asRole(db, 'authenticated', uid(2), 'select name from storage.objects where name=$1', [a.file_path])).length, 1);
  assert.equal((await asRole(db, 'anon', null, 'select * from storage.objects')).length, 0);
});

test('bucket MIME and shared key/category allowlists match the application definitions', async t => {
  const db = await fixture(t);
  const { DOCUMENT_MIMES, MAX_DOCUMENT_BYTES } = loadSource('src/lib/documents/types.ts');
  const { ALL_DOCS, PURCHASE_INTENT_DOCS, TRANSACTION_DOCS } = loadSource('src/lib/admin/pipeline.ts');
  const [bucket] = await rows(db, `select * from storage.buckets where id='customer-docs'`);
  assert.equal(bucket.public, false);
  assert.equal(Number(bucket.file_size_limit), MAX_DOCUMENT_BYTES);
  assert.deepEqual(bucket.allowed_mime_types.sort(), [...new Set(Object.values(DOCUMENT_MIMES).flat())].sort());
  for (const d of ALL_DOCS) assert.equal((await rows(db, 'select public.customer_attachment_shared_category($1) as category', [d.key]))[0].category, d.category);
  for (const d of [...PURCHASE_INTENT_DOCS, ...TRANSACTION_DOCS]) assert.equal((await rows(db, 'select public.customer_attachment_shared_category($1) as category', [d.key]))[0].category, null);
  const functions = await rows(db, `select proname,proconfig,has_function_privilege('anon',oid,'EXECUTE') as anon_exec from pg_proc where pronamespace='public'::regnamespace and proname in ('archive_customer_document_pointer','guard_customer_attachment_identity','customer_document_object_is_retained','can_read_customer_document_object')`);
  assert.ok(functions.every(f => f.proconfig.includes('search_path=pg_catalog') && !f.anon_exec));
  const [trigger] = await rows(db, `select has_function_privilege('authenticated','public.archive_customer_document_pointer()','EXECUTE') as direct_exec`);
  assert.equal(trigger.direct_exec, false);
});

test('legacy device objects remain editable by admins; archived objects and anonymous calls remain fenced', async t => {
  const db = await fixture(t);
  assert.equal((await asRole(db, 'authenticated', uid(1), `update storage.objects set metadata='{"fixture":"edited"}' where name=$1 returning name`, [`${C}/device.jpg`])).length, 1);
  assert.equal((await asRole(db, 'authenticated', uid(2), 'delete from storage.objects where name=$1 returning name', [`${C}/device.jpg`])).length, 0);
  assert.equal((await asRole(db, 'authenticated', uid(1), 'delete from storage.objects where name=$1 returning name', [`${C}/device.jpg`])).length, 1);
  await asRole(db, 'service_role', null, 'update public.customer_document_attachments set deleted_at=now() where file_path=$1', [legacy]);
  assert.equal((await asRole(db, 'authenticated', uid(2), 'select id from public.customer_document_attachments where file_path=$1', [legacy])).length, 1);
  assert.equal((await asRole(db, 'authenticated', uid(2), 'select name from storage.objects where name=$1', [legacy])).length, 0);
  await assert.rejects(asRole(db, 'anon', null, 'select public.customer_document_object_is_retained($1)', [legacy]), /permission denied/);
  assert.equal((await rows(db, `select file_size_limit,allowed_mime_types from storage.buckets where id='other'`))[0].file_size_limit, null);
});

test('preflight aborts atomically on unknown/altered policies, duplicate aliases, public bucket, or occupied namespace', async () => {
  for (const [change, expectedError] of [
    ['create policy unexpected_policy on storage.objects for all to public using(true) with check(true)', /Unreviewed Storage policy inventory/],
    ['drop policy "authenticated read docs" on storage.objects; create policy "authenticated read docs" on storage.objects for select to authenticated using(true)', /Unreviewed Storage policy definition/],
    [`update storage.buckets set public=true where id='customer-docs'`, /must be private/],
    [`update public.customer_documents set file_path='${legacy}' where customer_id='${OTHER}'`, /shared by multiple document rows/],
    [`update public.customer_documents set file_path='${legacy}' where doc_key='device_photo_old'`, /shared by multiple document rows/],
    [`insert into storage.objects(bucket_id,name) values('customer-docs','${C}/attachments/occupied.pdf')`, /namespace already has objects/],
    ['alter table storage.objects disable row level security', /RLS must already be enabled/],
  ]) {
    const db = new PGlite();
    try {
      await db.exec(baseline);
      await db.exec(change);
      const before = await rows(db, 'select * from public.customer_documents order by id');
      await assert.rejects(db.exec(sql), expectedError);
      await db.exec('rollback');
      assert.equal((await rows(db, "select to_regclass('public.customer_document_attachments') as table_name"))[0].table_name, null);
      assert.deepEqual(await rows(db, 'select * from public.customer_documents order by id'), before);
      assert.equal((await rows(db, `select * from information_schema.columns where table_schema='public' and table_name='customers' and column_name='share_token_expires_at'`)).length, 0);
    } finally { await db.close(); }
  }
});
