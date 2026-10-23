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
  const js = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true}}).outputText;
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
  const objects = new Map(), rows = new Map(), invalidations = [];
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
        maybeSingle: async () => ({data:table==='admins' ? (options.nonAdmin?null:{user_id:'test-admin'}) : options.noCustomer?null:{id:customer,hospital_name:'Synthetic test'},error:options.adminError&&table==='admins'?{message:'denied'}:null}),
        in: async (key,values) => ({data:[...rows.values()].filter(r=>r.customer_id===filters.customer_id&&values.includes(r[key]))}),
        upsert: async row => {if(options.saveFailure) return {error:{message:'save failed'}};rows.set(row.doc_key,row);return {error:null}},
      };
      return q;
    },
  };
  const mocks = {'@/lib/supabase/server':{createClient:async()=>supabase},'next/cache':{revalidatePath:p=>invalidations.push(p)}};
  return {actions:load('src/app/ph-console-8f27x/(app)/customers/other-document-actions.ts',mocks),objects,rows,invalidations,mocks};
}

test('every advertised extension has matching policy; Office/ZIP empty browser MIME supported',()=>{
  for(const [ext,mimes] of Object.entries(policy.OTHER_DOCUMENT_TYPES)) {
    assert.equal(policy.validateOtherDocument('업무.'+ext,100,mimes[0]),null);
    assert.equal(policy.validateOtherDocument('업무.'+ext.toUpperCase(),100,''),null);
    assert.ok(policy.OTHER_DOCUMENT_ACCEPT.includes('.'+ext));
  }
});
test('empty, oversized, executable, active SVG/HTML, MIME mismatch and path names rejected',()=>{
  for(const args of [['a.pdf',0,''],['a.pdf',20*1024*1024+1,''],['x.exe',1,''],['x.svg',1,''],['x.html',1,''],['x.pdf',1,'text/html'],['../x.pdf',1,'']]) assert.ok(policy.validateOtherDocument(...args));
});
test('Unicode original names roundtrip; cross-customer, cross-key and nested paths rejected',()=>{
  const key='other_document_12345678-1234-1234-1234-123456789abc';
  const p=paths.otherDocumentPath(customer,key,'계약 자료 (최종).DOCX');
  assert.equal(paths.otherDocumentFilename(p),'계약 자료 (최종).DOCX');
  assert.ok(paths.validOtherDocumentPath(customer,key,p));
  assert.equal(paths.validOtherDocumentPath('other',key,p),false);
  assert.equal(paths.validOtherDocumentPath(customer,'business_registration',p),false);
  assert.equal(paths.validOtherDocumentPath(customer,key,p+'/x'),false);
});
for (const option of ['anonymous','nonAdmin','adminError','noCustomer']) test('both actions deny '+option,async()=>{
  const h=harness({[option]:true});
  await assert.rejects(()=>h.actions.createOtherDocumentUpload(customer,'a.pdf',1,'application/pdf'));
  await assert.rejects(()=>h.actions.recordOtherDocumentUpload(customer,'bad','bad'));
  assert.equal(h.rows.size,0);
});
test('multi-upload, save, fresh read and ZIP download preserve files and names',async()=>{
  const h=harness();
  const payload=Buffer.from('synthetic non-production fixture');
  for(const name of ['계약.pdf','계약.pdf','자료.xlsx','자료.zip']) {
    const signed=await h.actions.createOtherDocumentUpload(customer,name,payload.length,'');
    assert.ok(signed.token);
    h.objects.set(signed.path,{size:payload.length,contentType:'application/octet-stream',blob:new Blob([payload])});
    assert.ok((await h.actions.recordOtherDocumentUpload(customer,signed.key,signed.path)).ok);
    assert.ok((await h.actions.recordOtherDocumentUpload(customer,signed.key,signed.path)).ok); // idempotent retry
  }
  assert.equal(h.rows.size,4);
  const reopened=JSON.parse(JSON.stringify([...h.rows.values()]));
  assert.ok(reopened.every(r=>r.category==='screening_2_other'&&!r.checked));
  assert.deepEqual(reopened.map(r=>paths.otherDocumentFilename(r.file_path)),['계약.pdf','계약.pdf','자료.xlsx','자료.zip']);
  const route=load('src/app/ph-console-8f27x/(app)/customers/[id]/download/route.ts',h.mocks);
  const response=await route.GET({nextUrl:new URL('http://localhost/download?keys='+[...h.rows.keys()].join(','))},{params:Promise.resolve({id:customer})});
  assert.equal(response.status,200);
  assert.equal(response.headers.get('Content-Type'),'application/zip');
  const zip=await localRequire('jszip').loadAsync(await response.arrayBuffer());
  assert.equal(Object.keys(zip.files).length,4);
  for(const f of Object.values(zip.files)) assert.deepEqual(await f.async('nodebuffer'),payload);
  assert.ok(zip.files['기타서류_계약.pdf']);
  assert.ok(zip.files['기타서류_계약 (1).pdf']);
});
test('missing objects, wrong path, actual oversized or invalid MIME cannot be recorded',async()=>{
  const h=harness();
  const signed=await h.actions.createOtherDocumentUpload(customer,'a.pdf',10,'application/pdf');
  assert.ok((await h.actions.recordOtherDocumentUpload(customer,signed.key,signed.path)).error);
  h.objects.set(signed.path,{size:21*1024*1024,contentType:'application/pdf'});
  assert.ok((await h.actions.recordOtherDocumentUpload(customer,signed.key,signed.path)).error);
  h.objects.set(signed.path,{size:10,contentType:'text/html'});
  assert.ok((await h.actions.recordOtherDocumentUpload(customer,signed.key,signed.path)).error);
  assert.ok((await h.actions.recordOtherDocumentUpload(customer,'business_registration',signed.path)).error);
  assert.equal(h.rows.size,0);
});
test('database failure does not report success',async()=>{
  const h=harness({saveFailure:true});
  const signed=await h.actions.createOtherDocumentUpload(customer,'a.pdf',10,'');
  h.objects.set(signed.path,{size:10,contentType:'application/pdf'});
  assert.equal((await h.actions.recordOtherDocumentUpload(customer,signed.key,signed.path)).error,'save failed');
  assert.equal(h.invalidations.length,0);
});
test('optional attachments never enter required docs and absence does not block next stage',()=>{
  for(const type of ['individual','corporate']) {
    assert.ok(pipeline.docsForType(pipeline.ALL_DOCS,type).every(d=>!d.key.startsWith(policy.OTHER_DOCUMENT_PREFIX)));
  }
  assert.equal(pipeline.nextStage('screening_2','manual'),'screening_3');
});
