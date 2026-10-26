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
test('new public action rejects customer/device/reuse spoofing before constructing privileged client',async()=>{
 let access=0,rpc=0;
 const action=loadSource('src/app/seven-day/actions.ts',{'@/lib/supabase/admin':{createAdminClient(){access++;return{rpc:async()=>{rpc++;return{data:{ok:true}}}}}},'@/lib/admin/short-rental-public-access':{shortRentalPublicAccess:async()=>{throw Error('no link')}}});
 for(const p of [{...fixture(),deviceId:other},{...fixture(),reuse:{...fixture().reuse,business:'unchanged'}},{...fixture(),confirmed:false}])assert.ok((await action.submitSevenDayIntake(id,null,p,'')).error);
 assert.equal(access,0);assert.equal(rpc,0);
 assert.deepEqual(await action.submitSevenDayIntake(id,null,fixture(),''),{ok:true});assert.equal(rpc,1);
});
test('existing link action binds to accessible customer devices and confirmed reusable statuses',async()=>{
 let rpc=0;
 const action=loadSource('src/app/seven-day/actions.ts',{'@/lib/supabase/admin':{createAdminClient(){throw Error('must not run')}},'@/lib/admin/short-rental-public-access':{shortRentalPublicAccess:async token=>{assert.equal(token,id);return{db:{rpc:async()=>{rpc++;return{data:{ok:true}}}},devices:[{id}],available:{business:true}}}}});
 assert.ok((await action.submitSevenDayIntake(other,id,{...fixture(),deviceId:other},'')).error);assert.equal(rpc,0);
 assert.deepEqual(await action.submitSevenDayIntake(other,id,{...fixture(),deviceId:id,reuse:{...fixture().reuse,business:'unchanged'}},''),{ok:true});
});
test('public page has no customer lookup or prior information on the anonymous route',()=>{
 const {SevenDayIntake}=loadSource('src/components/SevenDayIntake.tsx',{'@/app/seven-day/actions':{}});
 const html=renderToStaticMarkup(React.createElement(SevenDayIntake,{}));
 assert.ok(html.includes('3 검토 후 제출'));assert.ok(html.includes('기존 고객은 담당자가 전달한 전용 링크'));
 assert.ok(!html.includes('기존 장비 선택'));assert.ok(!html.includes('type="file"'));assert.ok(!html.includes('share_token'));
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
