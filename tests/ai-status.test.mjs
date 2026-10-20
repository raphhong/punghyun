import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import ts from 'typescript';
const src=readFileSync(new URL('../src/lib/admin/ai-status.ts',import.meta.url),'utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {handleStatus}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const now=Date.parse('2026-10-20T08:00:00Z');
const token='synthetic-test-only-credential-never-installed-000000';
const config={enabled:'true',tokenHash:createHash('sha256').update(token).digest('hex'),issuedAt:'2026-10-20T07:00:00Z',expiresAt:'2026-10-21T07:00:00Z'};
const id='12345678-1234-1234-1234-123456789abc';
const req=(query=`?id=${id}`,auth=`Bearer ${token}`,method='GET')=>new Request(`https://example.test/api/integrations/ai/status${query}`,{method,headers:{authorization:auth}});
const call=(r=req(),c=config,read=async()=>({id,stage:'closed',updated_at:'2026-10-20T00:00:00Z'}))=>handleStatus(r,c,read,now);
test('disabled, expired, future and over-30-day settings never query data',async()=>{
  for(const c of [{},{...config,enabled:'false'},{...config,issuedAt:undefined},{...config,expiresAt:'2026-10-20T08:00:00Z'},{...config,issuedAt:'2026-10-21T00:00:00Z'},{...config,expiresAt:'2027-01-01T00:00:00Z'},{...config,issuedAt:'2026-10-20'}]) {
    assert.equal((await call(req(),c,()=>assert.fail())).status,503);
  }
});
test('missing or incorrect bearer cannot read',async()=>{
  for(const auth of ['', 'Bearer short',`Bearer ${'x'.repeat(43)}`]) assert.equal((await call(req(undefined,auth),config,()=>assert.fail())).status,401);
});
test('writes and query widening are rejected before reading',async()=>{
  assert.equal((await call(req('','','POST'),config,()=>assert.fail())).status,405);
  for(const q of ['', '?id=bad',`?id=${id}&id=${id}`,`?id=${id}&table=customers`]) assert.equal((await call(req(q),config,()=>assert.fail())).status,400);
});
test('closed blocks; all nonclosed stages remain unapproved',async()=>{
  for(const stage of ['closed','intake','operation']) {
    const r=await call(req(),config,async actual=>{assert.equal(actual,id);return{id,stage,updated_at:'2026-10-20T00:00:00Z',email:'PRIVATE',memo:'PRIVATE'};});
    assert.equal(r.headers.get('cache-control'),'no-store');
    const b=await r.json(); assert.equal(b.business_closed,stage==='closed');
    assert.equal(b.cancel_pending,true); assert.equal(b.payment_evidence,'unknown');
    assert.equal(JSON.stringify(b).includes('PRIVATE'),false);
  }
});
test('missing record is not an active case',async()=>assert.equal((await call(req(),config,async()=>null)).status,404));
test('malformed or wrong-case backend values fail closed',async()=>{
  for(const value of [{id:'wrong',stage:'closed',updated_at:'2026-10-20T00:00:00Z'},{id,stage:'unknown',updated_at:'2026-10-20T00:00:00Z'},{id,stage:'closed',updated_at:'2026-10-20'}]) assert.equal((await call(req(),config,async()=>value)).status,503);
});
test('backend diagnostics are not disclosed',async()=>{
  const r=await call(req(),config,async()=>{throw Error('PRIVATE');});
  assert.deepEqual(await r.json(),{error:'status_unavailable'});
});
