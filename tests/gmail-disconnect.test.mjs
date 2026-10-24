import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const js=ts.transpileModule(readFileSync(new URL('../src/lib/admin/gmail-disconnect.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {handleDisconnect}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const origin='https://punghyun.vercel.app';
const request=(account='sol_hong',from=origin)=>new Request(origin+'/api/integrations/gmail/disconnect?account='+account,{method:'POST',headers:{origin:from}});
test('authenticated owner can disable only specified connected account',async()=>{
  const calls=[];const d={enabled:true,ownerId:'owner',identity:async()=>({id:'owner',email:'sol.hong@punghyun.com',verified:true}),accounts:['sol_hong'],disconnect:async id=>{calls.push(id);return'revoked';}};
  assert.equal((await handleDisconnect(request(),d)).status,200);assert.deepEqual(calls,['sol_hong']);
  assert.equal((await handleDisconnect(request('other'),d)).status,403);
  assert.equal((await handleDisconnect(request('sol_hong','https://evil.test'),d)).status,403);
  assert.equal((await handleDisconnect(request(),{...d,enabled:false})).status,503);
  assert.equal((await handleDisconnect(request(),{...d,identity:async()=>null})).status,401);assert.equal(calls.length,1);
});
