import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

// Compile the actual TypeScript modules in memory. All external I/O is mocked;
// these tests do not need credentials or touch customer data.
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const customerDir = "src/app/ph-console-8f27x/(app)/customers";
const componentStubs = new Proxy({}, { get: (_, name) => String(name) });

function loadSource(relative, mocks = {}) {
  const filename = path.resolve(root, relative);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const compiled = { exports: {} };
  const localRequire = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("@/components/")) return componentStubs;
    if (name.startsWith("@/") || name.startsWith(".")) {
      const base = name.startsWith("@/")
        ? path.join(root, "src", name.slice(2))
        : path.resolve(path.dirname(filename), name);
      const file = [base, `${base}.ts`, `${base}.tsx`].find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      assert.ok(file, `Cannot resolve ${name}`);
      return loadSource(file, mocks);
    }
    return require(name);
  };
  new Function("require", "module", "exports", source)(localRequire, compiled, compiled.exports);
  return compiled.exports;
}

const pipeline = loadSource("src/lib/admin/pipeline.ts");
const noop = () => {};
const actionStubs = new Proxy({}, {get: () => noop});

function query(data) {
  const result = { data, error: null };
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    order: () => builder,
    single: async () => result,
    maybeSingle: async () => result,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !node.props) return [];
  return [node, ...elements(node.props.children)];
}

// Exercise the deployed normal AI panel branch with synthetic page data.
process.env.SALES_AI_REVIEW_ENABLED = 'normal-product-v1';
const taxKeys = ['national_tax_payment_cert', 'local_tax_payment_cert'];
const legacy = pipeline.LEGACY_TAX_DOC.key;

test('individual and corporate requirements contain both taxes and never count legacy as either', () => {
  for (const type of ['individual', 'corporate', null]) {
    const required = pipeline.docsForType(pipeline.SCREENING_2_DOCS, type);
    for (const key of taxKeys) assert.ok(required.some(d => d.key === key));
    assert.ok(!required.some(d => d.key === legacy));
    assert.equal(new Set(required.map(d => d.key)).size, required.length);
  }
});

for (const channel of ['public', 'sales']) {
  test(`${channel}: distinct upload paths, replacement preserves other tax and legacy; authorization retained`, async () => {
    const rows = new Map([[legacy, {file_path:'synthetic/legacy.pdf'}]]);
    let authorized = true;
    const db = {
      from(table) {
        if (table === 'customers') return query(authorized ? {id:'synthetic'} : null);
        assert.equal(table, 'customer_documents');
        return {upsert: async (row, options) => {
          assert.equal(options.onConflict, 'customer_id,doc_key');
          rows.set(row.doc_key, row); return {error:null};
        }};
      },
      storage: {from: () => ({createSignedUploadUrl: async path => ({data:{path,token:'synthetic'}})})},
    };
    const actions = loadSource(channel === 'public' ? 'src/app/s/[token]/actions.ts' : 'src/app/sales/actions.ts', {
      '@/lib/supabase/admin': {createAdminClient: () => db},
      '@/lib/supabase/server': {createClient: async () => db},
      '@/lib/sales/agent': {getSessionAgent: async () => ({agent:{status:'approved'}})},
      'next/cache': {revalidatePath:noop}, 'next/navigation': {redirect:noop},
    });
    const create = channel === 'public' ? actions.createDocUploadUrl : actions.salesCreateDocUploadUrl;
    const record = channel === 'public' ? actions.recordDocUpload : actions.salesRecordDocUpload;
    const paths = await Promise.all(taxKeys.map(key => create('synthetic', key, 'synthetic.pdf')));
    assert.notEqual(paths[0].path, paths[1].path);
    for (let i=0; i<2; i++) assert.deepEqual(await record('synthetic',taxKeys[i],'screening_2',paths[i].path),{ok:true});
    for (const key of taxKeys) {
      const other = taxKeys.find(k => k !== key), before = rows.get(other);
      await record('synthetic',key,'screening_2',`synthetic/${key}-replacement.pdf`);
      assert.deepEqual(rows.get(other),before);
      assert.equal(rows.get(legacy).file_path,'synthetic/legacy.pdf');
    }
    authorized = false;
    const before = [...rows];
    assert.ok('error' in await create('synthetic',taxKeys[0],'denied.pdf'));
    assert.ok('error' in await record('synthetic',taxKeys[0],'screening_2','denied.pdf'));
    assert.deepEqual([...rows],before);
  });
}

for (const channel of ['public','sales','admin']) {
  for (const keys of [[],[legacy],[taxKeys[0]],[taxKeys[1]],[...taxKeys],[legacy,...taxKeys]]) {
    test(`${channel} renders separate slots and legacy only when present: ${keys.join(',') || 'empty'}`, async () => {
      const docs = keys.map(doc_key => ({id:`synthetic-${doc_key}`,doc_key,checked:true,uploaded_at:'2026-11-04T00:00:00Z',file_path:`synthetic/${doc_key}.pdf`}));
      const customer = {id:'synthetic',hospital_type:'individual',stage:'screening_2',source:'manual',share_token:'synthetic',sales_agent_id:'agent'};
      const db = {
        auth: {getUser: async () => ({data:{user:{id:'actor'}}})},
        from: table => query(table === 'customers' ? customer : table === 'customer_documents' ? docs : []),
        storage:{from:()=>({createSignedUrls:async paths=>({data:paths.map(path=>({path,signedUrl:`https://example.test/${path}?token=synthetic`}))})})},
      };
      const mocks = {
        '@/lib/supabase/server':{createClient:async()=>db}, '@/lib/supabase/admin':{createAdminClient:()=>db},
        '@/lib/sales/agent':{getSessionAgent:async()=>({agent:{id:'agent',status:'approved'}})},
        'next/headers':{headers:async()=>new Headers({host:'localhost:3000'})},
        'next/navigation':{notFound:()=>{throw Error('not found')},redirect:noop},'next/link':'a',
        '../actions':actionStubs,'./actions':actionStubs,
        '@/app/sales/actions':actionStubs,'@/app/sales/other-document-actions':actionStubs,
      };
      const filename = channel === 'public' ? 'src/app/s/[token]/page.tsx' : channel === 'sales' ? 'src/app/sales/(portal)/customers/[id]/page.tsx' : `${customerDir}/[id]/page.tsx`;
      const Page = loadSource(filename,mocks).default;
      const tree = await Page({params:Promise.resolve({id:'synthetic',token:'synthetic'}),searchParams:Promise.resolve({})});
      const all = elements(tree);
      if (channel !== 'public') {
        const review = all.find(el=>Array.isArray(el.props.documents));
        assert.ok(review, 'AI selection panel remains mounted');
        assert.deepEqual(review.props.documents.map(d=>d.id),docs.map(d=>d.id));
        for (const doc of docs) {
          const option = review.props.documents.find(d=>d.id===doc.id);
          assert.ok(option.label.includes(doc.doc_key));
          assert.ok(option.version.includes(doc.uploaded_at));
        }
      }
      const list = all.find(el => el.props.docs?.some(d=>d.key===taxKeys[0]));
      assert.ok(list);
      const slots = elements(list.type(list.props));
      for (const key of taxKeys) {
        const slot = slots.find(el=>el.props.docKey===key);
        assert.ok(slot);
        if (channel === 'admin') {
          const row = slots.find(el=>el.type==='li' && el.key===key);
          assert.equal(elements(row).some(el=>el.props.name==='checked'),!keys.includes(key));
          assert.equal(elements(row).filter(el=>el.type==='a').length,keys.includes(key)?2:0);
        } else assert.equal(slot.props.done ?? slot.props.hasFile,keys.includes(key));
      }
      assert.ok(!list.props.docs.some(d=>d.key===legacy));
      const old = all.find(el=>el.type==='LegacyTaxDocument');
      assert.equal(!!old.props.row,keys.includes(legacy));
      if (channel === 'admin') {
        const galleries = all.filter(el=>el.type==='DocGallery');
        const items = galleries.flatMap(el=>el.props.items);
        for (const key of keys) assert.ok(items.some(item=>item.key===key && !item.label.includes('_')));
      }
    });
  }
}

test('legacy attachment is read-only and uses the existing signed URL',()=>{
  const Legacy = loadSource('src/components/LegacyTaxDocument.tsx').LegacyTaxDocument;
  assert.equal(Legacy({signedMap:new Map()}),null);
  const tree = Legacy({row:{file_path:'synthetic/legacy.pdf'},signedMap:new Map([['synthetic/legacy.pdf','https://example.test/legacy?token=test']])});
  const all = elements(tree);
  assert.equal(all.filter(el=>el.type==='a').length,2);
  assert.ok(!all.some(el=>el.type==='input'||el.type==='button'));
});
