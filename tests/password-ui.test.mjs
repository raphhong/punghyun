import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(file,mocks={}) {
 const js=ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};new Function('require','module','exports',js)(id=>id in mocks?mocks[id]:require(id),module,module.exports);return module.exports;
}
const {Field}=load('src/components/ui/Field.tsx',{'@/lib/cn':{cn:(...x)=>x.filter(Boolean).join(' ')}});
const {PasswordForm}=load('src/components/account/PasswordForm.tsx',{'@/components/ui/Field':{Field},'@/app/account/password-actions':{changePassword:()=>{throw Error('must not run during render');},sendPasswordNonce:()=>{throw Error('must not send during render');}}});
test('password form renders labelled masked empty fields with password-manager semantics',()=>{
 const html=renderToStaticMarkup(React.createElement(PasswordForm));
 assert.equal((html.match(/type="password"/g)||[]).length,3);
 assert.equal((html.match(/autoComplete="new-password"/g)||[]).length,2);
 assert.match(html,/autoComplete="current-password"/);
 for(const id of ['current-password','new-password','confirm-password']) {assert.ok(html.includes(`for="${id}"`));assert.ok(html.includes(`id="${id}"`));}
 assert.match(html,/role="status"/);assert.doesNotMatch(html,/value="|name="email"|name="userId"/);
});
test('both password pages check live session and redirect anonymous users to their own login',async()=>{
 for(const [file,login] of [['src/app/ph-console-8f27x/(app)/account/password/page.tsx','/ph-console-8f27x/login'],['src/app/sales/(portal)/account/password/page.tsx','/sales/login']]) {
  for(const user of [null,{id:'self'}]) {
   const {default:Page}=load(file,{'next/navigation':{redirect:path=>{throw Error(path);}},'@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user},error:null})}})},'@/components/account/PasswordForm':{PasswordForm},'@/lib/admin/config':{adminPath:sub=>'/ph-console-8f27x/'+sub}});
   if(!user) await assert.rejects(Page(),{message:login});
   else assert.match(renderToStaticMarkup(await Page()),/비밀번호 변경/);
  }
 }
});
