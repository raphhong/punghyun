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
