import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const js=ts.transpileModule(readFileSync(new URL('../src/lib/admin/gmail-account-vault.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {accountVault,mailQuery,ingestKey,disconnectAccount,encryptedSink,reserveMail}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const a={owner:'test-owner',accountId:'sol_hong',mailbox:'sol.hong@punghyun.com',scope:'https://www.googleapis.com/auth/gmail.readonly'};
const b={...a,accountId:'synthetic_second',mailbox:'second@example.test'};
const vault=accountVault(Buffer.alloc(32,7),'test-key-only');
test('authenticated envelopes cannot be swapped between account, owner, email, key or scope',()=>{
  const e=vault.seal(a,'SYNTHETIC_ONLY');assert.equal(vault.open(a,e),'SYNTHETIC_ONLY');assert.ok(!JSON.stringify(e).includes('SYNTHETIC_ONLY'));
  for(const c of [b,{...a,owner:'other'},{...a,mailbox:'other@example.test'},{...a,scope:'https://mail.google.com/'}])assert.throws(()=>vault.open(c,e));
  assert.throws(()=>accountVault(Buffer.alloc(32,8),'test-key-only').open(a,e));
  assert.throws(()=>vault.open(a,{...e,tag:'x'.repeat(22)}));
  assert.notEqual(vault.seal(a,'same').iv,vault.seal(a,'same').iv);
});
test('source key partitions duplicate ingestion by owner/account/message/revision',()=>{
  assert.equal(ingestKey(a,'msg1','r1'),ingestKey(a,'msg1','r1'));
  assert.notEqual(ingestKey(a,'msg1','r1'),ingestKey(b,'msg1','r1'));
  assert.notEqual(ingestKey(a,'msg1','r1'),ingestKey(a,'msg1','r2'));
});
test('query requires explicit label/time bound and cannot inject arbitrary search',()=>{
  const scope={labelIds:['Label_business'],afterMs:1000000000,maxMessages:20};
  assert.equal(mailQuery(a,scope,1000000000).accountId,'sol_hong');
  for(const s of [{...scope,labelIds:[]},{...scope,labelIds:['x OR in:anywhere']},{...scope,afterMs:0},{...scope,maxMessages:21}])assert.throws(()=>mailQuery(a,s,1000000000));
});
test('disconnect stops account before revoke; repeat cannot revoke twice',async()=>{
  const events=[];let disabled=false;const deps={authorizedOwner:a.owner,approvedAccounts:[a.accountId],open:vault.open,
    registry:{disable:async c=>{assert.equal(c.accountId,a.accountId);if(disabled)return null;disabled=true;events.push('disable');return {generation:2,envelope:vault.seal(a,'SYNTHETIC_ONLY')};},finishDisconnect:async(c,g,r)=>{assert.equal(g,2);events.push(r);}},
    revoke:async()=>{events.push('revoke');}};
  assert.equal(await disconnectAccount(a,deps),'revoked');assert.equal(await disconnectAccount(a,deps),'already_disabled');
  assert.deepEqual(events,['disable','revoke','revoked']);
  await assert.rejects(disconnectAccount(b,deps));
});
test('uncertain revocation stays disabled and never reports success',async()=>{
  let result;const deps={authorizedOwner:a.owner,approvedAccounts:[a.accountId],open:vault.open,
    registry:{disable:async()=>({generation:2,envelope:vault.seal(a,'SYNTHETIC_ONLY')}),finishDisconnect:async(c,g,r)=>{result=r;}},revoke:async()=>{throw Error('PRIVATE');}};
  assert.equal(await disconnectAccount(a,deps),'revoke_unconfirmed');assert.equal(result,'revoke_unconfirmed');
});
test('storage sink passes only encrypted credential, exact account context and operation key',async()=>{
  let row;await encryptedSink(vault,async r=>{row=r;}).save({...a,operation:'a'.repeat(64),refreshToken:'SYNTHETIC_ONLY'});
  assert.ok(!JSON.stringify(row).includes('SYNTHETIC_ONLY'));assert.deepEqual(row.context,a);
  assert.equal(vault.open(a,row.envelope),'SYNTHETIC_ONLY');
});
test('reservation rejects cross-account sources and preserves account-local dedup',async()=>{
  const rows=new Set();const ledger={claim:async(c,g,key)=>{if(rows.has(key))return false;rows.add(key);return true;}};
  const source={mailbox:a.mailbox,messageId:'msg',revision:'r1',labelIds:['business'],dateMs:1000000000};
  const scope={labelIds:['business'],afterMs:1000000000,maxMessages:20};
  assert.equal(await reserveMail(a,source,scope,1,ledger,1000000000),true);
  assert.equal(await reserveMail(a,source,scope,1,ledger,1000000000),false);
  await assert.rejects(reserveMail(b,source,scope,1,ledger,1000000000));
  assert.equal(await reserveMail(b,{...source,mailbox:b.mailbox},scope,1,ledger,1000000000),true);
});
