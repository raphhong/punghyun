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
    if (name.endsWith(".json")) return require(path.resolve(path.dirname(filename), name));
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

const customer='33333333-3333-4333-8333-333333333333';
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444'];
const keys=['national_tax_payment_cert','local_tax_payment_cert','tax_payment_cert'];
for(const channel of ['admin','sales']) {
 test(`${channel} selected tax sources stay independent, preserve legacy and invalidate replacement snapshot`,async()=>{
  const rows=keys.map((doc_key,i)=>({id:ids[i],doc_key,category:'screening_2',file_path:`${customer}/${doc_key}-1.pdf`,uploaded_at:'2026-11-04T00:00:00Z',device_id:null}));
  let authorized=true;
  const reads=[];
  const db={auth:{getUser:async()=>({data:{user:{id:'actor'}}})},from:table=>{
   const q={select:()=>q,eq:()=>q,order:async()=>({data:rows}),maybeSingle:async()=>({data:!authorized?null:table==='admins'?{user_id:'actor'}:table==='sales_agents'?{id:'agent',status:'approved'}:{id:customer,sales_agent_id:'agent'}})};return q;
  }};
  const storage=()=>({storage:{from:()=>({info:async()=>({data:{size:50,contentType:'application/pdf'}}),download:async path=>{reads.push(path);return {data:new Blob([`synthetic ${path}`],{type:'application/pdf'})};}})}});
  const factory=channel==='admin'?loadSource('src/lib/admin/ai/admin-review-sources.ts').adminReviewSources:loadSource('src/lib/sales/normal-review.ts').normalSalesSources;
  const selected=factory(db,storage,customer,ids.slice(0,2));
  const before=await selected();
  assert.deepEqual(before.sources.map(s=>s.id),ids.slice(0,2));
  assert.equal(before.excluded.length,0);
  assert.deepEqual(before.files.map(f=>f.id),ids.slice(0,2));
  for(let i=0;i<2;i++)assert.ok(before.files[i].label.includes(keys[i]));
  assert.ok(reads.every(path=>!path.endsWith('/tax_payment_cert-1.pdf')));
  rows[0]={...rows[0],file_path:`${customer}/${keys[0]}-2.pdf`,uploaded_at:'2026-11-04T01:00:00Z'};
  const after=await selected();
  assert.notEqual(after.snapshot,before.snapshot);
  assert.notEqual(after.sources[0].version,before.sources[0].version);
  assert.equal(after.sources[1].version,before.sources[1].version);
  const withLegacy=await factory(db,storage,customer,ids)();
  assert.deepEqual(withLegacy.sources.map(s=>s.id),ids);
  assert.equal(rows[2].file_path,`${customer}/tax_payment_cert-1.pdf`);
  authorized=false;const count=reads.length;
  await assert.rejects(selected,/forbidden/);assert.equal(reads.length,count);
 });
}

test('actual AI panel selects both tax IDs, removes one independently, and resets on file version change',async()=>{
 const React=require('react'); const state=[],refs=[];let cursor=0,refCursor=0;
 const Panel=loadSource('src/components/sales/NormalReviewPanel.tsx',{
  react:{...React,useState:initial=>{const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],value=>{state[i]=typeof value==='function'?value(state[i]):value;}];},useRef:initial=>{const i=refCursor++;return refs[i]??(refs[i]={current:initial});},useEffect:()=>{}},
 }).default;
 const documents=keys.map((label,i)=>({id:ids[i],label,version:'v1'}));
 const props={customerId:customer,documents,apiBase:'/api/admin/customers/synthetic/ai-review'};
 const walk=node=>Array.isArray(node)?node.flatMap(walk):node?.props?[node,...walk(node.props.children)]:[];
 const render=()=>{cursor=0;refCursor=0;const session=Panel(props);return walk(session.type(session.props));};
 const checkboxes=()=>render().filter(el=>el.type==='input'&&el.props.type==='checkbox');
 checkboxes()[0].props.onChange({target:{checked:true}});
 checkboxes()[1].props.onChange({target:{checked:true}});
 assert.deepEqual(state[0],ids.slice(0,2));
 assert.deepEqual(checkboxes().map(el=>el.props.checked),[true,true,false]);
 const calls=[];const originalFetch=globalThis.fetch;
 globalThis.fetch=async url=>{calls.push(String(url));return Response.json({financialApproval:false,issues:[],status:'not_reviewed'});};
 try{
  render().find(el=>el.type==='button'&&el.props.children==='저장된 결과 보기').props.onClick();
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(new URL(calls[0],'https://synthetic.test').searchParams.getAll('documentId'),ids.slice(0,2));
 }finally{globalThis.fetch=originalFetch;}
 checkboxes()[0].props.onChange({target:{checked:false}});
 assert.deepEqual(state[0],[ids[1]]);
 assert.deepEqual(checkboxes().map(el=>el.props.checked),[false,true,false]);
 const oldKey=Panel(props).key;
 const replaced=Panel({...props,documents:documents.map((d,i)=>i===0?{...d,version:'v2'}:d)});
 assert.notEqual(replaced.key,oldKey,'React remounts the session, clearing prior selection/consent');
});
