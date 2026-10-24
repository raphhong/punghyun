import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const compile=name=>ts.transpileModule(readFileSync(new URL('../src/lib/admin/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const url=js=>'data:text/javascript;base64,'+Buffer.from(js).toString('base64');
const accountURL=url(compile('gmail-account-vault'));
const {accountVault}=await import(accountURL);
const {vaultStore}=await import(url(compile('gmail-vault-store').replace("'./gmail-account-vault'",JSON.stringify(accountURL))));
const context={owner:'test-owner',accountId:'sol_hong',mailbox:'sol.hong@punghyun.com',scope:'https://www.googleapis.com/auth/gmail.readonly'};
const vault=accountVault(Buffer.alloc(32,9),'synthetic');
test('save calls fixed RPC with encrypted envelope and exact account scope',async()=>{
  let call;const store=vaultStore(async(name,args)=>{call={name,args};return {data:null,error:null};},vault,['INBOX']);
  await store.secrets.save({...context,operation:'a'.repeat(64),refreshToken:'SYNTHETIC'});
  assert.equal(call.name,'gmail_vault_save');assert.equal(call.args.p_account,'sol_hong');
  assert.ok(!JSON.stringify(call).includes('SYNTHETIC'));assert.equal(vault.open(context,call.args.p_envelope),'SYNTHETIC');
});
test('disable and completion bind exact identity and generation',async()=>{
  const calls=[];const store=vaultStore(async(name,args)=>{calls.push({name,args});return {data:name==='gmail_vault_disable'?[{generation:2,envelope:vault.seal(context,'SYNTHETIC')}]:true,error:null};},vault,['INBOX']);
  assert.equal((await store.registry.disable(context)).generation,2);
  await store.registry.finishDisconnect(context,2,'revoked');assert.equal(calls[1].args.p_generation,2);assert.equal(calls[0].args.p_mailbox,context.mailbox);
});
test('store errors and concurrent generation changes cannot report success',async()=>{
  const store=vaultStore(async()=>({data:false,error:null}),vault,['INBOX']);
  await assert.rejects(store.registry.finishDisconnect(context,2,'revoked'));
  const broken=vaultStore(async()=>({data:null,error:'PRIVATE'}),vault,['INBOX']);
  await assert.rejects(broken.registry.disable(context),{message:'credential store unavailable'});
  assert.throws(()=>vaultStore(()=>assert.fail(),vault,[]));
});
