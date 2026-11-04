// Product transport tests only. No DB, policies, network or denied security-review work.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const cache=new Map();function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n.endsWith('.json')?require(path.resolve(path.dirname(file),n)):n.startsWith('.')?load(path.resolve(path.dirname(file),n)+'.ts'):require(n),m,m.exports);return m.exports;}
const {salesReviewReadiness}=load('src/lib/sales/review-readiness.ts');
const {normalSalesSources}=load('src/lib/sales/normal-review.ts');
const now=Date.now(),ceiling={dataClass:'customer',expiresAt:now+600000};
const budget=()=>({allocation_approved:true,allocation_expires_at:new Date(now+600000).toISOString(),policy_revision:2,owner_policy:{dataClass:'customer',active:true,expiresAt:now+600000,revision:2},max_calls:4,reserved_calls:3,max_microusd:2000000,reserved_microusd:1500000});
test('readiness reports real blockers without exposing policy hashes or customer data',()=>{
 const b=budget();assert.equal(salesReviewReadiness(b,ceiling,true,now).ready,true);
 b.owner_policy.dataClass='synthetic';b.max_calls=3;b.max_microusd=1500000;
 const r=salesReviewReadiness(b,{...ceiling,dataClass:'synthetic'},true,now);assert.equal(r.ready,false);assert.equal(r.reasons.length,2);assert(!JSON.stringify(r).includes('owner_policy'));
 assert.equal(salesReviewReadiness(budget(),ceiling,false,now).ready,false);
 const expired=budget();expired.allocation_expires_at='invalid';assert.equal(salesReviewReadiness(expired,ceiling,true,now).ready,false);
});
test('sales review denies different assigned customer even if RLS returns its row',async()=>{
 let storage=0;const db={auth:{getUser:async()=>({data:{user:{id:'actor'}}})},from:table=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:table==='sales_agents'?{id:'agent',status:'approved'}:{id:'customer',sales_agent_id:'other'}})};return q;}};
 await assert.rejects(normalSalesSources(db,()=>{storage++;throw Error('no');},'11111111-1111-4111-8111-111111111111'),/forbidden/);assert.equal(storage,0);
});
test('sales UI preserves upload flow, identifies requester, and uses sales readiness API',()=>{
 const panel=fs.readFileSync('src/components/sales/NormalReviewPanel.tsx','utf8');assert(panel.includes('고객 서류 AI 검수 요청'));assert(panel.includes('/api/sales/ai-review/readiness'));
 const page=fs.readFileSync('src/app/sales/(portal)/customers/[id]/page.tsx','utf8');assert(page.includes('operatorLabel={agent.name}'));assert(page.includes('SalesDocUpload'));
 for(const f of ['route.ts','consent/route.ts']){const route=fs.readFileSync('src/app/api/sales/customers/[id]/ai-review/'+f,'utf8');assert(route.includes("dataClass==='customer'"));assert(route.includes('extractAdminBusinessFields'));}
});

test('shared provider cap does not release exhausted app allocation or erase UNKNOWN reservations',()=>{
 const b=budget();b.max_calls=3;b.max_microusd=1500000;
 const before={reserved_calls:b.reserved_calls,reserved_microusd:b.reserved_microusd};
 assert.equal(salesReviewReadiness(b,ceiling,true,now).ready,false);
 // One local synthetic reservation slot; neither reserved counter is reset.
 b.max_calls=b.reserved_calls+1;b.max_microusd=b.reserved_microusd+500000;
 assert.equal(salesReviewReadiness(b,ceiling,true,now).ready,true);
 assert.deepEqual({reserved_calls:b.reserved_calls,reserved_microusd:b.reserved_microusd},before);
 b.reserved_calls++;b.reserved_microusd+=500000;
 assert.equal(salesReviewReadiness(b,ceiling,true,now).ready,false);
});
test('customer self-selected files need exact fresh preview consent without owner hash preselection',async()=>{
 const {normalConsentEndpoint,ownerPolicy,transmissionCeiling}=load('src/lib/sales/normal-consent.ts');
 const {sha,reviewSourceSnapshot}=load('src/lib/admin/ai/review.ts');
 let actor='sales-a',customer='customer-a',version='1',text='장비명: 합성 의료장비';let saved=0;
 const mime='application/pdf';
 const ceiling=transmissionCeiling({SALES_AI_TRANSMISSION_CEILING:JSON.stringify({dataClass:'customer',allowedMime:[mime],allowedCategories:['quote'],allowedHashes:[],expiresAt:Date.now()+600000})});assert(ceiling);
 const record={id:'policy',revision:1,policy:ownerPolicy({active:true,expiresAt:ceiling.expiresAt,allowedMime:[mime],allowedCategories:['quote'],maxDocuments:8},{id:'policy',revision:0,policy:null},ceiling)};
 const context=async()=>{const scope={actorId:actor,customerId:customer,caseId:customer,tenantId:'punghyun',revision:'assignment'};const bytes=Buffer.from(text),sources=[{id:'doc',bytes,version,sha256:sha(bytes),mime,customerId:customer,assetId:null}];return {scope,sources,snapshot:reviewSourceSnapshot(scope,sources),files:[{id:'doc',label:'합성.pdf',category:'quote'}]};};
 const extract=async s=>[{id:'line',sourceId:s.id,version:s.version,sha256:s.sha256,assetId:null,text,locator:'page 1'}];
 const endpoint=normalConsentEndpoint({context,ceiling,extract,store:{policy:async()=>record,register:async()=>{saved++;return 'grant';},revoke:async()=>{}}});
 const req=b=>new Request('https://local.test/consent',b?{method:'POST',headers:{origin:'https://local.test'},body:JSON.stringify(b)}:{});
 const p=await(await endpoint(req())).json();assert.equal(p.provider,'OpenAI API');assert.equal(saved,0);
 const b={confirmed:true,snapshot:p.snapshot,previewHash:p.previewHash,policyId:p.policyId,policyRevision:p.policyRevision};
 assert.equal((await endpoint(req(b))).status,200);
 for(const change of [()=>{customer='customer-b';},()=>{customer='customer-a';actor='sales-b';},()=>{actor='sales-a';version='2';},()=>{version='1';text='장비명: 합성 제조장비';}]){change();assert.equal((await endpoint(req(b))).status,409);}
 assert.equal(saved,1);
});
test('unreadable scanned customer document cannot become executable or whole visual',async()=>{
 const {inspectMixed}=load('src/lib/sales/normal-mixed.ts');const {sha}=load('src/lib/admin/ai/review.ts');
 const bytes=Buffer.from('synthetic scanned placeholder');const s={id:'scan',version:'1',sha256:sha(bytes),bytes,mime:'application/pdf',customerId:'synthetic'};
 const r=await inspectMixed({sources:[s]},false,Date.now()+60000,async()=>{throw Error('ocr_runtime_unavailable');});
 assert.equal(r.segments.length,0);assert.equal(r.manifest.visuals.length,0);assert.equal(r.manifest.unreadable.length,1);assert.equal(r.disclosures[0].mode,'unreadable');
});
test('monthly readiness uses DB monthly aggregate instead of exhausted lifetime pilot counters',()=>{
 const b=budget();b.max_calls=b.reserved_calls;b.max_microusd=b.reserved_microusd;
 assert.equal(salesReviewReadiness(b,ceiling,true,now,{mode:'monthly',limitMicrousd:200000000,usedMicrousd:1500000}).ready,true);
 for(const usage of [null,{}, {mode:'monthly',limitMicrousd:200000001,usedMicrousd:0},{mode:'monthly',limitMicrousd:200000000,usedMicrousd:199500001},{mode:'monthly',limitMicrousd:200000000,usedMicrousd:-1}])assert.equal(salesReviewReadiness(b,ceiling,true,now,usage).ready,false);
 assert.equal(salesReviewReadiness(b,ceiling,true,now,{mode:'legacy'}).ready,false);
 const r=JSON.stringify(salesReviewReadiness(b,ceiling,true,now,{mode:'monthly',limitMicrousd:200000000,usedMicrousd:1500000}));assert(!r.includes('1500000'));assert(!r.includes('200000000'));
});
