const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
const localRequire = Module.createRequire(path.join(root, 'package.json'));
const ts = localRequire('typescript');

function load(relative, mocks = {}) {
  const filename = path.join(root, relative);
  const source = fs.readFileSync(filename, 'utf8');
  const js = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX}}).outputText;
  const mod = {exports: {}};
  function req(name) {
    if (name in mocks) return mocks[name];
    if (name.startsWith('@/')) return load('src/'+name.slice(2)+'.ts', mocks);
    if (name.startsWith('./')) return load(path.relative(root,path.join(path.dirname(filename),name+'.ts')), mocks);
    return localRequire(name);
  }
  new Function('require','module','exports',js)(req, mod, mod.exports);
  return mod.exports;
}
const policy = load('src/lib/admin/other-documents.ts');
const paths = load('src/lib/admin/other-document-path.ts');
const pipeline = load('src/lib/admin/pipeline.ts');
const customer = 'a33b31b4-00c5-4c74-bfa9-8ec883cb705d';

function harness(options = {}) {
  const objects = new Map(), rows = new Map(), invalidations = []; let privilegedCalls = 0;
  const storage = {
    createSignedUploadUrl: async path => ({data:{path,token:'test-token'},error:null}),
    info: async path => ({data:objects.get(path) ?? null,error:objects.has(path)?null:{message:'missing'}}),
    download: async path => ({data:objects.get(path)?.blob,error:null}),
  };
  const supabase = {
    auth: {
      getUser: async () => ({data:{user:options.anonymous?null:{id:'test-admin'}},error:null}),
      getClaims: async () => ({data:{claims:{sub:'test-admin'}}}),
    },
    storage: {from: bucket => { assert.equal(bucket,'customer-docs'); return storage; }},
    from: table => {
      const filters = {};
      const q = {
        select(){return q}, eq(k,v){filters[k]=v;return q},
        maybeSingle: async () => ({data:table==='sales_agents' ? (options.noAgent ? null : {id:'agent-a',status:options.agentStatus ?? 'approved'}) : table==='admins' ? (options.nonAdmin?null:{user_id:'test-admin'}) : options.noCustomer?null:{id:customer,sales_agent_id:options.otherOwner ? 'agent-b' : 'agent-a',hospital_name:'Synthetic test'},error:options.adminError&&table==='admins'?{message:'denied'}:null}),
        in: async (key,values) => ({data:[...rows.values()].filter(r=>r.customer_id===filters.customer_id&&values.includes(r[key]))}),
        upsert: async row => {if(options.saveFailure) return {error:{message:'save failed'}};rows.set(row.doc_key,row);return {error:null}},
      };
      return q;
    },
  };
  const mocks = {'@/lib/supabase/server':{createClient:async()=>supabase},'@/lib/supabase/admin':{createAdminClient:()=>{privilegedCalls++;return supabase;}},'next/cache':{revalidatePath:p=>invalidations.push(p)}};
  return {actions:load('src/app/sales/other-document-actions.ts',mocks),objects,rows,invalidations,mocks,get privilegedCalls(){return privilegedCalls}};
}


for (const [name, options] of Object.entries({anonymous:{anonymous:true},noAgent:{noAgent:true},pending:{agentStatus:'pending'},rejected:{agentStatus:'rejected'},unrelated:{noCustomer:true},otherOwner:{otherOwner:true}})) {
  test('sales '+name+' cannot issue upload URL or save, even by direct action call',async()=>{
    const h=harness(options);
    await assert.rejects(()=>h.actions.salesCreateOtherDocumentUpload(customer,'a.pdf',10,''));
    await assert.rejects(()=>h.actions.salesRecordOtherDocumentUpload(customer,'bad','bad'));
    assert.equal(h.privilegedCalls,0);
    assert.equal(h.rows.size,0);
  });
}
test('approved assigned sales agent uploads five formats and can reopen the saved records',async()=>{
  const h=harness();
  for(const filename of ['문서.pdf','사진.png','계약.docx','정리.xlsx','자료.zip']) {
    const signed=await h.actions.salesCreateOtherDocumentUpload(customer,filename,20,'');
    assert.ok(signed.token);
    h.objects.set(signed.path,{size:20,contentType:'application/octet-stream'});
    assert.ok((await h.actions.salesRecordOtherDocumentUpload(customer,signed.key,signed.path)).ok);
  }
  const reopened=JSON.parse(JSON.stringify([...h.rows.values()]));
  assert.equal(reopened.length,5);
  assert.ok(reopened.every(r=>r.customer_id===customer&&r.category==='screening_2_other'&&!r.checked));
  assert.deepEqual(reopened.map(r=>paths.otherDocumentFilename(r.file_path)),['문서.pdf','사진.png','계약.docx','정리.xlsx','자료.zip']);
  assert.ok(h.invalidations.includes('/sales/customers/'+customer));
});
test('sales cannot attach another customer path, replace required docs, or save oversized objects',async()=>{
  const h=harness();
  const signed=await h.actions.salesCreateOtherDocumentUpload(customer,'a.pdf',10,'');
  assert.ok((await h.actions.salesRecordOtherDocumentUpload(customer,'business_registration',signed.path)).error);
  assert.ok((await h.actions.salesRecordOtherDocumentUpload(customer,signed.key,'other/'+signed.path)).error);
  h.objects.set(signed.path,{size:21*1024*1024,contentType:'application/pdf'});
  assert.ok((await h.actions.salesRecordOtherDocumentUpload(customer,signed.key,signed.path)).error);
  assert.equal(h.rows.size,0);
});
test('sales remains optional and shares the same unchanged required pipeline',()=>{
  assert.equal(pipeline.nextStage('screening_2','manual'),'screening_3');
  assert.ok(pipeline.ALL_DOCS.every(d=>!policy.isOtherDocument(d.key)));
});

test('real sales detail page renders the sales uploader only for its approved assigned agent',async()=>{
  const React=localRequire('react');
  const {renderToStaticMarkup}=localRequire('react-dom/server');
  const noop=()=>null;
  for(const own of [true,false]) {
    const h=harness();
    let receivedActions;
    const db={from:table=>{
      const q={select:()=>q,eq:()=>q,order:()=>q,
        maybeSingle:async()=>({data:{id:customer,sales_agent_id:own?'agent-a':'agent-b',stage:'screening_2',hospital_type:'individual'}}),
        then:(resolve)=>resolve({data:[]})};return q;
    }};
    const mocks={...h.mocks,
      '@/lib/supabase/server':{createClient:async()=>db},
      '@/lib/sales/agent':{getSessionAgent:async()=>({user:{id:'sales-user'},agent:{id:'agent-a',status:'approved'}})},
      'next/headers':{headers:async()=>new Map()},
      'next/navigation':{notFound:()=>{throw Error('not found')}},
      'next/link':({children})=>React.createElement('a',null,children),
      '@/components/admin/ShareLink':{ShareLink:noop},
      '@/components/admin/ShareMessage':{ShareMessage:noop},
      '@/components/sales/SalesDocUpload':{SalesDocUpload:noop},
      '@/components/DeviceManager':{DeviceManager:noop},
      '@/app/sales/actions':{},
      '@/app/sales/other-document-actions':h.actions,
      '@/components/admin/OtherDocumentUpload':{OtherDocumentUpload:props=>{
        receivedActions=props.actions;return React.createElement('button',null,'기타 서류 추가');
      }},
    };
    mocks['@/app/sales/actions']={updateSalesCustomer:()=>{},deleteSalesCustomer:()=>{}};
    const Page=load('src/app/sales/(portal)/customers/[id]/page.tsx',mocks).default;
    const html=renderToStaticMarkup(await Page({params:Promise.resolve({id:customer})}));
    assert.ok(html.includes('기타 서류 (선택)'));
    assert.ok(html.indexOf('2차 스크리닝 서류')<html.indexOf('기타 서류 (선택)'));
    assert.ok(html.indexOf('기타 서류 (선택)')<html.indexOf('3차 스크리닝 서류'));
    if(own) {
      assert.equal(receivedActions.createUpload,h.actions.salesCreateOtherDocumentUpload);
      assert.equal(receivedActions.recordUpload,h.actions.salesRecordOtherDocumentUpload);
      assert.ok(html.includes('기타 서류 추가'));
    } else {
      assert.equal(receivedActions,undefined);
      assert.ok(html.includes('본인 담당 고객에게만'));
    }
  }
});
