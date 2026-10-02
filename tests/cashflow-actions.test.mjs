import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadSource } from './cashflow-loader.mjs';
const actor='10000000-0000-4000-8000-000000000001';
const customerId='20000000-0000-4000-8000-000000000001';
const requestId='30000000-0000-4000-8000-000000000001';
const expectedVersion='a'.repeat(32);
const valid = () => ({customerId,requestId,expectedVersion,change:{operation:'movement',id:null,kind:'funding_disbursement',basis:'actual',cash_date:'2020-01-02',amount:100,installment_no:null,source_reference:'fixture-bank-1',note:'',reason:'기록 확인'}});
const {validateCashflowRequest}=loadSource('src/lib/admin/cashflow-write.ts');
function actions({uid=actor,claimError=null,admin={user_id:actor},adminError=null,throws=false,rpcError=null}={}){
 const calls=[];const refresh=[];
 const session={auth:{getClaims:async()=>{if(throws)throw Error('private');return {data:{claims:{sub:uid}},error:claimError};}},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:admin,error:adminError})})})})};
 const mod=loadSource('src/app/ph-console-8f27x/(app)/customers/cashflow-actions.ts',{
  'server-only':{},'next/cache':{revalidatePath:p=>refresh.push(p)},'@/lib/supabase/server':{createClient:async()=>session},
  '@/lib/supabase/admin':{createAdminClient:()=>{calls.push('client');return {rpc:async(name,args)=>{calls.push({name,args});return {error:rpcError,data:{version:'b'.repeat(32),snapshot:{customer:{},movements:[]}}};}};}}
 });return {...mod,calls,refresh};
}
process.env.NEXT_PUBLIC_SUPABASE_URL='https://fixture.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='test-only-not-a-credential';
for(const [name,options] of Object.entries({anonymous:{uid:null},salesperson:{admin:null},'membership-error':{adminError:{message:'private database diagnostic'}},'claims-error':{claimError:{message:'private'}},'lookup-throws':{throws:true}}))test(`${name}: direct read/write rejected before privileged client`,async()=>{const a=actions(options);assert.ok('error' in await a.saveCustomerCashflow(valid()));assert.ok('error' in await a.loadCustomerCashflow(customerId));assert.deepEqual(a.calls,[]);});
test('authenticated save invokes exactly one RPC and refreshes all dependent pages',async()=>{const a=actions();assert.equal((await a.saveCustomerCashflow(valid())).ok,true);assert.equal(a.calls.length,2);assert.equal(a.calls[1].name,'save_customer_cashflow');assert.equal(a.calls[1].args.p_actor,actor);assert.equal(a.calls[1].args.p_request,requestId);assert.ok(a.refresh.some(p=>p.endsWith('/cashflow')));assert.equal(a.refresh.length,4);});
test('invalid direct action never reaches RPC',async()=>{const a=actions();const v=valid();v.change.amount=-1;assert.equal((await a.saveCustomerCashflow(v)).code,'INVALID');assert.deepEqual(a.calls,[]);});
test('database diagnostics are never returned',async()=>{const a=actions({rpcError:{code:'XX000',message:'private address token customer'}});const r=await a.saveCustomerCashflow(valid());assert.equal(r.code,'UNCONFIRMED');assert.equal(JSON.stringify(r).includes('private'),false);assert.deepEqual(a.refresh,[]);});
test('conflicts have a safe actionable error',async()=>{const a=actions({rpcError:{code:'P0001',message:'CASHFLOW_CONFLICT'}});assert.equal((await a.saveCustomerCashflow(valid())).code,'CASHFLOW_CONFLICT');});
test('missing configuration is checked without exposing values',async()=>{const saved=process.env.SUPABASE_SERVICE_ROLE_KEY;delete process.env.SUPABASE_SERVICE_ROLE_KEY;try{const a=actions();assert.equal((await a.saveCustomerCashflow(valid())).code,'NOT_READY');assert.deepEqual(a.calls,[]);}finally{process.env.SUPABASE_SERVICE_ROLE_KEY=saved;}});
test('integer money and exact actual dates are mandatory',()=>{for(const amount of [-1,0,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'100']){const v=valid();v.change.amount=amount;assert.ok(validateCashflowRequest(v,'2026-01-01'));}for(const d of ['2025-02-29','2026-02-30','2027-01-01','2026-1-1']){const v=valid();v.change.cash_date=d;assert.ok(validateCashflowRequest(v,'2026-01-01'));}assert.equal(validateCashflowRequest(valid(),'2026-01-01'),null);});
test('schedule total preserves final one-won remainder',()=>{const v=valid();v.change={operation:'schedule',first_payment_date:'2025-01-20',rental_months:3,rental_price:333,expected_total:1000,payment_schedule:[{no:1,dueDate:'2025-01-20',amount:333},{no:2,dueDate:'2025-02-20',amount:333},{no:3,dueDate:'2025-03-21',amount:334}],reason:'일정 확인'};assert.equal(validateCashflowRequest(v,'2026-01-01'),null);v.change.expected_total=999;assert.ok(validateCashflowRequest(v,'2026-01-01'));v.change.expected_total=1000;v.change.payment_schedule[2].no=2;assert.ok(validateCashflowRequest(v,'2026-01-01'));});
test('past paid count is not a supported finance mutation',()=>{const v=valid();v.change={operation:'paid_count',count:3,reason:'납부 확인'};assert.ok(validateCashflowRequest(v,'2026-01-01'));});
