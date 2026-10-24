import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const js=ts.transpileModule(readFileSync(new URL('../src/lib/admin/gmail-state-store.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {postgresStateStore}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('state adapter uses only fixed RPC and bound owner/binding parameters',async()=>{
  const calls=[];const row={owner:'owner',accountId:'sol_hong',bindingHash:'binding',verifier:'x'.repeat(64),expires:2000};
  const store=postgresStateStore(async(name,args)=>{calls.push([name,args]);return {error:null,data:[{owner_id:'owner',account_id:'sol_hong',binding_hash:'binding',verifier:row.verifier,expires_at:new Date(2000).toISOString()}]};});
  await store.put('hash',row);assert.equal(calls[0][0],'gmail_oauth_put');assert.equal(calls[0][1].p_owner,'owner');
  assert.deepEqual(await store.consume('hash','owner','binding',1000),row);assert.equal(calls[1][0],'gmail_oauth_consume');
});
test('bad RPC identity, expired state, missing rows and raw errors fail closed',async()=>{
  for(const data of [[],null,[{}],[{owner_id:'other'}],[{owner_id:'owner',binding_hash:'binding',verifier:'x'.repeat(64),expires_at:new Date(500).toISOString()}]]){
    assert.equal(await postgresStateStore(async()=>({data,error:null})).consume('hash','owner','binding',1000),null);
  }
  await assert.rejects(postgresStateStore(async()=>({data:null,error:'PRIVATE'})).consume('hash','owner','binding',1000),{message:'state unavailable'});
});
