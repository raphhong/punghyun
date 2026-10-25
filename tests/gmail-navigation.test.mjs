import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(file,mocks){
 const js=ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};new Function('require','module','exports',js)(id=>id in mocks?mocks[id]:require(id),module,module.exports);return module.exports;
}
const nav={usePathname:()=>'/ph-console-8f27x/customers',useSearchParams:()=>new URLSearchParams()};
const {Sidebar}=load('src/components/admin/Sidebar.tsx',{'next/link':{default:({children,...props})=>React.createElement('a',props,children)},'next/navigation':nav,'@/lib/admin/pipeline':{STAGES:[]},'@/lib/admin/config':{adminPath:(sub='')=>'/ph-console-8f27x'+(sub?'/'+sub:'')}});
const {AdminShell}=load('src/components/admin/AdminShell.tsx',{'./Sidebar':{Sidebar},'@/components/Logo':{LogoMark:()=>null},'@/app/ph-console-8f27x/login/actions':{signOut:()=>{}}});
test('owner navigation includes Gmail in both desktop and mobile drawer',()=>{
 const html=renderToStaticMarkup(React.createElement(AdminShell,{counts:{},canManageGmail:true},'content'));
 assert.equal((html.match(/href="https:\/\/punghyun.vercel.app\/ph-console-8f27x\/integrations\/gmail"/g)||[]).length,2);
 assert.match(html,/id="admin-navigation"/);assert.match(html,/aria-controls="admin-navigation"/);
});
test('non-owner navigation hides Gmail in both copies',()=>{
 const html=renderToStaticMarkup(React.createElement(AdminShell,{counts:{},canManageGmail:false},'content'));
 assert.ok(!html.includes('/integrations/gmail'));
});
test('server layout grants link only to exact owner UUID AND mailbox',async()=>{
 for(const [sub,email,expected] of [['874162eb-d569-448b-bc8b-cf103cf46c1c','sol.hong@punghyun.com',true],['different','sol.hong@punghyun.com',false],['874162eb-d569-448b-bc8b-cf103cf46c1c','other@example.com',false]]){
  const db={auth:{getClaims:async()=>({data:{claims:{sub,email}}})},from:table=>({select:()=>table==='admins'?{eq:()=>({maybeSingle:async()=>({data:{user_id:sub}})})}:Promise.resolve({data:[]})})};
  const {default:Layout}=load('src/app/ph-console-8f27x/(app)/layout.tsx',{'next/navigation':{redirect:()=>{throw Error('redirect')}},'@/lib/supabase/server':{createClient:async()=>db},'@/lib/admin/config':{ADMIN_BASE:'/ph-console-8f27x'},'@/lib/admin/pipeline':{STAGES:[]},'@/components/admin/AdminShell':{AdminShell}});
  assert.equal((await Layout({children:null})).props.canManageGmail,expected);
 }
});
