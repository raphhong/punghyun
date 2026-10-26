import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadSource} from './cashflow-loader.mjs';
const lib=loadSource('src/lib/admin/short-rental-intake.ts');
const id='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002';
const fixture=()=>({name:'Test only',phone:'010-0000-0000',company:'Synthetic',deviceId:null,model:'Equipment',quantity:1,identity:'SERIAL-X',condition:'Good',startDate:'2026-10-26',owner:'Owner confirmed',rights:'No third-party rights disclosed',resources:'Confirmed source',reuse:Object.fromEntries(lib.intakeChecks.map(([k])=>[k,'new'])),conditions:Object.fromEntries(lib.intakeConditions.map(([k])=>[k,'unknown'])),confirmed:true});
test('public intake validates bounded information without requiring files, legal consents or a fixed fee',()=>{
 assert.equal(lib.validIntake(fixture()),true);
 for(const patch of [{quantity:0},{quantity:1.5},{confirmed:false},{deviceId:'bad'},{phone:'<script>'},{startDate:'2026-02-30'},{rights:''},{name:'x'.repeat(101)}])assert.equal(lib.validIntake({...fixture(),...patch}),false);
 assert.equal(lib.reuseAllowed({...fixture(),reuse:{...fixture().reuse,business:'unchanged'}},{}),false);
 assert.equal(lib.reuseAllowed({...fixture(),reuse:{...fixture().reuse,business:'unchanged'}},{business:true}),true);
});
test('direct action rejects all tokenless submissions before privileged access',async()=>{
 let access=0,rpc=0;
 const action=loadSource('src/app/seven-day/actions.ts',{'@/lib/supabase/admin':{createAdminClient(){access++;return{rpc:async()=>{rpc++;return{data:{ok:true}}}}}},'@/lib/admin/short-rental-public-access':{shortRentalPublicAccess:async()=>{throw Error('no link')}}});
 for(const p of [{...fixture(),deviceId:other},{...fixture(),reuse:{...fixture().reuse,business:'unchanged'}},{...fixture(),confirmed:false}])assert.ok((await action.submitSevenDayIntake(id,null,p,'')).error);
 assert.equal(access,0);assert.equal(rpc,0);
 for(const token of [null,undefined,'','bad',{},42])assert.ok((await action.submitSevenDayIntake(id,token,fixture(),'')).error);
 assert.equal(access,0);assert.equal(rpc,0);
});
test('existing link action binds to accessible customer devices and confirmed reusable statuses',async()=>{
 let rpc=0;
 const action=loadSource('src/app/seven-day/actions.ts',{'@/lib/supabase/admin':{createAdminClient(){throw Error('must not run')}},'@/lib/admin/short-rental-public-access':{shortRentalPublicAccess:async token=>{assert.equal(token,id);return{db:{rpc:async(name,args)=>{assert.equal(name,'submit_short_rental_intake');assert.equal(args.p_token,id);assert.equal(args.p_request,other);rpc++;return{data:{ok:true}}}},devices:[{id}],available:{business:true}}}}});
 assert.ok((await action.submitSevenDayIntake(other,id,{...fixture(),deviceId:other},'')).error);assert.equal(rpc,0);
 assert.deepEqual(await action.submitSevenDayIntake(other,id,{...fixture(),deviceId:id,reuse:{...fixture().reuse,business:'unchanged'}},''),{ok:true});
});
test('customer form retains the token-scoped intake steps',()=>{
 const {SevenDayIntake}=loadSource('src/components/SevenDayIntake.tsx',{'@/app/seven-day/actions':{}});
 const html=renderToStaticMarkup(React.createElement(SevenDayIntake,{token:id}));
 assert.ok(html.includes('3 검토 후 제출'));assert.ok(html.includes('전용 링크에 연결된 고객의 접수'));
 assert.ok(html.includes('기존 장비 선택'));assert.ok(!html.includes('type="file"'));assert.ok(!html.includes('share_token'));
});
test('photo endpoints reject foreign devices, identity documents and arbitrary paths',async()=>{
 let storage=0;
 const actions=loadSource('src/app/seven-day/photo-actions.ts',{'@/lib/admin/short-rental-public-access':{shortRentalPublicAccess:async()=>({customer:{id},devices:[{id}],db:{storage:{from(){storage++;throw Error('unexpected')}}}})}});
 assert.ok((await actions.createSevenDayPhoto(id,other,'jpg')).error);
 assert.ok((await actions.createSevenDayPhoto(id,id,'pdf')).error);
 assert.ok((await actions.recordSevenDayPhoto(id,id,`${other}/seven-day/${id}/${id}.jpg`)).error);
 assert.ok((await actions.recordSevenDayPhoto(id,id,`${id}/seven-day/${id}/../secret.jpg`)).error);
 assert.equal(storage,0);
});
test('readiness fails closed and requests zero rows when intake schema is absent',async()=>{
 for(const failed of [true,false]){let rowsRequested=-1;const {shortRentalIntakeReady}=loadSource('src/lib/admin/short-rental-readiness.ts',{'server-only':{},'@/lib/supabase/admin':{createAdminClient:()=>({from(table){assert.equal(table,'short_rental_intakes');return{select(columns){assert.equal(columns,'request_id');return{limit:async n=>{rowsRequested=n;return{error:failed?{}:null}}}}}}})}});assert.equal(await shortRentalIntakeReady(),!failed);assert.equal(rowsRequested,0);}
});
test('token gateway scopes every data query and never treats missing contract schema as verified reuse',async()=>{
 let constructed=0;const scoped=[];
 const {shortRentalPublicAccess}=loadSource('src/lib/admin/short-rental-public-access.ts',{'server-only':{},'@/lib/supabase/admin':{createAdminClient:()=>{constructed++;return{from(table){const q={select(){return q},eq(column,value){scoped.push([table,column,value]);return q},not(){return q},order(){return table==='customer_devices'?Promise.resolve({data:[{id,model_name:'Own device',quantity:1}]}):q},limit(){return q},async maybeSingle(){return table==='customers'?{data:{id,hospital_name:'Own company',representative:'Own name',phone:'010-0000-0000'}}:{error:{code:'42P01'},data:null}}};return q}}}}});
 await assert.rejects(shortRentalPublicAccess('not-a-token'));assert.equal(constructed,0);
 const result=await shortRentalPublicAccess(other);assert.deepEqual(result.available,{business:false,identity:false,authority:false,account:false});
 assert.ok(scoped.some(([table,col,val])=>table==='customers'&&col==='share_token'&&val===other));
 for(const table of ['customer_devices','short_rentals'])assert.ok(scoped.some(([t,col,val])=>t===table&&col==='customer_id'&&val===id));
});
test('admin intake page blocks nonadmins before reading submitted customer data',async()=>{
 let requested=false;
 const {default:Page}=loadSource('src/app/ph-console-8f27x/(app)/seven-day-intakes/page.tsx',{'next/link':()=>null,'@/lib/supabase/server':{createClient:async()=>({auth:{getClaims:async()=>({data:{claims:{sub:id}}})},from(table){if(table==='short_rental_intakes')requested=true;const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:null})};return q}})}});
 const html=renderToStaticMarkup(await Page());assert.ok(html.includes('관리자만'));assert.equal(requested,false);
});


test('anonymous /seven-day is not found without database access or an intake form',()=>{
 const {default:Page}=loadSource('src/app/seven-day/page.tsx',{'next/navigation':{notFound(){throw Error('NOT_FOUND')}},'@/lib/supabase/admin':{createAdminClient(){throw Error('unexpected DB access')}}});
 assert.throws(()=>Page(),/NOT_FOUND/);
});
test('invalid and unknown customer tokens fail closed in the real gateway, action and page',async()=>{
 for(const token of ['bad',other]){
  let writes=0,queries=0;
  const mocks={'server-only':{},'next/navigation':{notFound(){throw Error('NOT_FOUND')}},'@/lib/supabase/admin':{createAdminClient:()=>({from(table){queries++;assert.equal(table,'customers');return{select(){return this},eq(k,v){assert.equal(k,'share_token');assert.equal(v,token);return this},maybeSingle:async()=>({data:null})}},rpc(){writes++;throw Error('unexpected write')}})}};
  const {submitSevenDayIntake}=loadSource('src/app/seven-day/actions.ts',mocks);
  assert.ok((await submitSevenDayIntake(id,token,fixture(),'')).error);
  const {default:Page}=loadSource('src/app/s/[token]/seven-day/page.tsx',{...mocks,'@/components/SevenDayIntake':{SevenDayIntake:()=>{throw Error('unexpected form')}},'@/components/SevenDayPhoto':{SevenDayPhoto:()=>null}});
  await assert.rejects(Page({params:Promise.resolve({token})}),/NOT_FOUND/);
  assert.equal(writes,0);assert.equal(queries,token==='bad'?0:2);
 }
});
test('valid customer page renders its scoped intake and photo continuation',async()=>{
 const {default:Page}=loadSource('src/app/s/[token]/seven-day/page.tsx',{
  '@/lib/admin/short-rental-public-access':{shortRentalPublicAccess:async token=>{assert.equal(token,id);return{customer:{representative:'Synthetic customer'},devices:[{id:other,model_name:'Synthetic device'}],available:{}}}},
  '@/components/SevenDayIntake':{SevenDayIntake:props=>{assert.equal(props.token,id);assert.equal(props.initial.name,'Synthetic customer');return React.createElement('form',{'data-test':'intake'});}},
  '@/components/SevenDayPhoto':{SevenDayPhoto:props=>{assert.equal(props.token,id);assert.equal(props.deviceId,other);return React.createElement('span',{},'photo continuation');}}
 });
 const html=renderToStaticMarkup(await Page({params:Promise.resolve({token:id})}));assert.ok(html.includes('data-test="intake"'));assert.ok(html.includes('photo continuation'));
});
test('general contact page keeps its consultation form without a public short-rental entry',()=>{
 const {default:Page}=loadSource('src/app/contact/page.tsx',{'@/components/ContactForm':{ContactForm:()=>React.createElement('form',{'data-test':'general-contact'})}});
 const html=renderToStaticMarkup(React.createElement(Page));assert.ok(html.includes('data-test="general-contact"'));assert.ok(!html.includes('/seven-day'));
});
test('general contact API still accepts valid enquiries with isolated mail transport',async()=>{
 const previous=process.env.RESEND_API_KEY,originalFetch=globalThis.fetch;
 let calls=0;
 try{
  process.env.RESEND_API_KEY='synthetic-test-key';
  globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'https://api.resend.com/emails');assert.ok(JSON.parse(options.body).subject.includes('Synthetic'));return{ok:true}};
  const {POST}=loadSource('src/app/api/contact/route.ts');
  const response=await POST(new Request('https://example.test/api/contact',{method:'POST',body:JSON.stringify({name:'Synthetic',phone:'010-0000-0000'})}));
  assert.equal(response.status,200);assert.equal((await response.json()).ok,true);assert.equal(calls,1);
 }finally{globalThis.fetch=originalFetch;if(previous===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=previous;}
});
