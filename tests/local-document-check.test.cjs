const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
function loader(mocks={}){const cache=new Map();return function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n in mocks?mocks[n]:n.startsWith('@/')?load(path.resolve('src',n.slice(2))+'.ts'):n.endsWith('.json')?require(path.resolve(path.dirname(file),n)):n.startsWith('.')?load(path.resolve(path.dirname(file),n)+'.ts'):require(n),m,m.exports);return m.exports;};}
const inspect=loader()('src/lib/sales/local-document-check.ts').inspectLocalDocument;
test('local sensitive checks return presence states, never identity/account/address raw values',()=>{
 for(const [kind,text] of [['identity','주민등록증 성명: 합성고객 주민번호: 900101-1234567 발급: 합성구청장'],['registry','주민등록표 등본 주소: 합성주소 123 발급일: 2026-11-04'],['bank','합성은행 예금주: 합성고객 계좌번호: 123-456-789012']]){const r=inspect(kind,text),s=JSON.stringify(r);assert.equal(r.externalTransmission,false);assert.equal(r.status,'manual_review');for(const raw of ['합성고객','900101','123-456','합성주소','2026-11-04'])assert(!s.includes(raw));assert.equal(r.verifiedIdentity,false);assert.equal(r.verifiedAccount,false);}
 assert.equal(inspect('bank','주민등록증 성명: 합성고객').status,'unreadable');assert.equal(inspect('identity','').status,'unreadable');assert.throws(()=>inspect('other','text'));
});
test('local source path retains assigned salesperson authorization and business AI still excludes IDs',async()=>{
 const {localOnlySalesSources,normalSalesSources}=loader()('src/lib/sales/normal-review.ts');let reads=0;
 const db={auth:{getUser:async()=>({data:{user:{id:'actor'}}})},from:t=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:t==='sales_agents'?{id:'agent',status:'approved'}:{sales_agent_id:'other'}})};return q;}};
 await assert.rejects(localOnlySalesSources(db,()=>{reads++;},'11111111-1111-4111-8111-111111111111',['22222222-2222-4222-8222-222222222222'])(),/forbidden/);assert.equal(reads,0);
 const code=fs.readFileSync('src/lib/sales/normal-review.ts','utf8');assert(code.includes('selectedIds,false)'));assert.equal(typeof normalSalesSources,'function');
});
test('local route does not persist or expose OCR text; source replacement and origin fail closed',async()=>{
 let calls=0,changed=false;const context=async()=>({scope:{actorId:'actor',customerId:'synthetic'},snapshot:changed&&++calls>1?'new':'old',sources:[{id:'synthetic'}]});
 const load=loader({'@/lib/supabase/server':{createClient:async()=>({})},'@/lib/supabase/admin':{createAdminClient:()=>{throw Error('unexpected DB mutation');}},'@/lib/sales/normal-review':{localOnlySalesSources:()=>context},'@/lib/admin/ai/local-ocr-config':{localOcrEnabled:()=>true},'@/lib/admin/ai/local-ocr':{localDocumentOcr:()=>{}},'@/lib/admin/ai/document-extraction':{extractDocument:async()=>({segments:[{text:'합성은행 예금주: 합성고객 계좌번호: 123-456-789012'}]})}});
 const {POST}=load('src/app/api/sales/customers/[id]/local-document-check/route.ts');const req=(origin='https://local.test')=>new Request('https://local.test/api',{method:'POST',headers:{origin},body:JSON.stringify({kind:'bank',documentId:'synthetic'})});const params={params:Promise.resolve({id:'synthetic'})};
 const r=await POST(req(),params);assert.equal(r.status,200);assert(!JSON.stringify(await r.json()).includes('합성고객'));changed=true;calls=0;assert.equal((await POST(req(),params)).status,409);assert.equal((await POST(req('https://elsewhere.test'),params)).status,403);
 const code=fs.readFileSync('src/app/api/sales/customers/[id]/local-document-check/route.ts','utf8');for(const bad of ['responsesTransport','OPENAI_API_KEY','.insert(','.update(','.rpc('])assert(!code.includes(bad));
});
