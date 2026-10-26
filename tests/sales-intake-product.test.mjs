import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadSource} from './cashflow-loader.mjs';
const lib=loadSource('src/lib/sales/intake-product.ts');
const url='https://example.test/s/20000000-0000-4000-8000-000000000001';
test('new customer entry requires explicit product; malformed queries do not select a product',async()=>{
  const {default:Page}=loadSource('src/app/sales/(portal)/new/page.tsx',{'../../actions':{createSalesCustomer:()=>{}},'@/components/admin/SubmitButton':{SubmitButton:({children})=>React.createElement('button',{},children)}});
  for(const product of [undefined,'bad',['short']]){const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({product})}));assert.ok(html.includes('/sales/new?product=short'));assert.ok(html.includes('/sales/new?product=standard'));assert.ok(!html.includes('<form'));}
  for(const product of ['standard','short']){const html=renderToStaticMarkup(await Page({searchParams:Promise.resolve({product})}));assert.ok(html.includes(`value="${product}"`));assert.ok(html.includes(`${lib.intakeProductLabels[product]} · 고객 등록`));}
});
test('selected product controls both customer link and copy message, without mixed general documents',()=>{
  const {ProductShare}=loadSource('src/components/sales/ProductShare.tsx');
  const standardMessage=`[풍현] 일반렌탈 서류 제출 안내\n${url}\n일반서류 예시`;
  const none=renderToStaticMarkup(React.createElement(ProductShare,{url,standardMessage}));assert.ok(!none.includes('textarea'));assert.ok(!none.includes('링크 복사'));
  for(const product of ['standard','short']){const html=renderToStaticMarkup(React.createElement(ProductShare,{url,standardMessage,initialProduct:product}));const target=product==='short'?`${url}/seven-day`:url;assert.ok(html.includes(`value="${target}"`));assert.ok(html.includes(`href="${target}"`));assert.ok(html.includes(product==='short'?'초단기렌탈 접수 안내':'일반서류 예시'));if(product==='short'){assert.ok(!html.includes('일반서류 예시'));assert.ok(html.includes('일괄 업로드하지 마세요'));}}
});
test('registration preserves sales ownership and customer fields; selection is navigation only',async()=>{
  for(const product of ['standard','short']){
    let inserted;let redirected;
    const {createSalesCustomer}=loadSource('src/app/sales/actions.ts',{
      'next/navigation':{redirect:value=>{redirected=value;}},'next/cache':{revalidatePath:()=>{}},
      '@/lib/sales/agent':{getSessionAgent:async()=>({agent:{id:'agent-fixture',status:'approved'}})},
      '@/lib/supabase/admin':{createAdminClient:()=>{throw Error('no privileged access');}},
      '@/lib/supabase/server':{createClient:async()=>({from:table=>{assert.equal(table,'customers');return{insert:row=>{inserted=row;return{select:()=>({single:async()=>({data:{id:'customer-fixture'}})})}}}}})}
    });
    const form=new FormData();form.set('intake_product',product);form.set('representative','Synthetic');await createSalesCustomer(form);
    assert.equal(inserted.sales_agent_id,'agent-fixture');assert.equal(inserted.representative,'Synthetic');assert.ok(!('intake_product' in inserted));assert.ok(!('product' in inserted));assert.equal(redirected,`/sales/customers/customer-fixture?product=${product}#customer-guide`);
  }
});
test('invalid product is rejected before any DB access',async()=>{
  const {createSalesCustomer}=loadSource('src/app/sales/actions.ts',{'@/lib/supabase/server':{},'@/lib/supabase/admin':{},'@/lib/sales/agent':{getSessionAgent:()=>{throw Error('unexpected access');}}});
  await assert.rejects(createSalesCustomer(new FormData()),/상품을 선택/);
});

test('general customer page retains token scoping and explicitly identifies the product',async()=>{
  const scopes=[];
  const q=table=>({select(){return this},eq(k,v){scopes.push([table,k,v]);return this},order(){return this},single:async()=>({data:{id:'fixture',hospital_name:'Synthetic',hospital_type:'corporation'}}),then(resolve){return Promise.resolve({data:[]}).then(resolve)}});
  const {default:Page}=loadSource('src/app/s/[token]/page.tsx',{
    '@/lib/supabase/admin':{createAdminClient:()=>({from:q})},
    '@/components/PublicDocUpload':{PublicDocUpload:()=>null},'@/components/DeviceManager':{DeviceManager:()=>null},
    './actions':{savePublicInfo:()=>{},addDevice:()=>{},saveDevice:()=>{},deleteDevice:()=>{},createDevicePhotoUrl:()=>{},recordDevicePhoto:()=>{},deleteDevicePhoto:()=>{}}
  });
  const html=renderToStaticMarkup(await Page({params:Promise.resolve({token:'synthetic-token'})}));
  assert.ok(html.includes('일반렌탈 · 스크리닝 정보 제출'));assert.ok(!html.includes('초단기렌탈 접수'));
  assert.ok(scopes.some(([table,k,v])=>table==='customers'&&k==='share_token'&&v==='synthetic-token'));
});

test('valid product never bypasses agent approval',async()=>{
  const {createSalesCustomer}=loadSource('src/app/sales/actions.ts',{'@/lib/supabase/server':{createClient:()=>{throw Error('unexpected DB access')}},'@/lib/supabase/admin':{},'@/lib/sales/agent':{getSessionAgent:async()=>({agent:{status:'pending'}})}});
  const form=new FormData();form.set('intake_product','short');await assert.rejects(createSalesCustomer(form),/승인된 영업자/);
});
