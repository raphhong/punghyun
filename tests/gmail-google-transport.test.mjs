import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const js=ts.transpileModule(readFileSync(new URL('../src/lib/admin/gmail-google-transport.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {googleTransport}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const redirect='https://punghyun.vercel.app/api/integrations/gmail/oauth/callback';
test('fixed POST token exchange and GET profile; credentials never in URLs',async()=>{
  const calls=[];const t=googleTransport('test-client','test-secret',async(url,init)=>{
    calls.push([url,init]);assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');
    return Response.json(calls.length===1?{access_token:'test-access',refresh_token:'test-refresh',scope:'readonly-test',token_type:'Bearer'}:{emailAddress:'sol.hong@punghyun.com',historyId:'not-exported'});
  });
  await t.exchange('test-code','test-verifier',redirect);assert.equal(calls[0][0],'https://oauth2.googleapis.com/token');assert.equal(calls[0][1].method,'POST');
  assert.equal(calls[0][1].body.get('code_verifier'),'test-verifier');
  assert.deepEqual(await t.profile('test-access'),{emailAddress:'sol.hong@punghyun.com'});
  assert.equal(calls[1][1].headers.Authorization,'Bearer test-access');
  assert.ok(calls.every(([url])=>!url.includes('test-access')&&!url.includes('test-secret')));
});
test('bad endpoint configuration does not make requests',async()=>{
  const t=googleTransport('id','secret',()=>assert.fail());await assert.rejects(t.exchange('c','v','https://evil.test'));await assert.rejects(t.profile('a\r\nb'));
});
test('HTTP, oversized and malformed responses fail without raw provider diagnostics',async()=>{
  for(const result of [new Response('PRIVATE',{status:400}),new Response('x'.repeat(17000)),Response.json([]),Response.json({access_token:'x'})]){
    const t=googleTransport('id','secret',async()=>result);await assert.rejects(t.exchange('c','v',redirect));
  }
});
test('revocation uses POST body and fails closed on uncertain provider response',async()=>{
  const t=googleTransport('id','secret',async(url,init)=>{assert.equal(url,'https://oauth2.googleapis.com/revoke');assert.equal(init.method,'POST');assert.equal(init.body.get('token'),'SYNTHETIC');return new Response(null,{status:200});});
  await t.revoke('SYNTHETIC');
  await assert.rejects(googleTransport('id','secret',async()=>new Response(null,{status:503})).revoke('SYNTHETIC'));
});
test('offline refresh is a fixed POST with no password/browser and validates returned access',async()=>{
  const t=googleTransport('id','secret',async(url,init)=>{
    assert.equal(url,'https://oauth2.googleapis.com/token');assert.equal(init.body.get('grant_type'),'refresh_token');
    assert.equal(init.body.get('refresh_token'),'SYNTHETIC_REFRESH');
    return Response.json({access_token:'SYNTHETIC_ACCESS',token_type:'Bearer',expires_in:3600});
  });
  assert.deepEqual(await t.refresh('SYNTHETIC_REFRESH'),{accessToken:'SYNTHETIC_ACCESS',expiresIn:3600,rotatedRefreshToken:undefined});
});
test('revoked grant, expanded refresh scope and malformed expiry never produce usable access',async()=>{
  for(const r of [new Response('invalid_grant',{status:400}),Response.json({access_token:'x',token_type:'Bearer',expires_in:3600,scope:'https://mail.google.com/'}),Response.json({access_token:'x',token_type:'Bearer',expires_in:0})]){
    await assert.rejects(googleTransport('id','secret',async()=>r).refresh('SYNTHETIC_REFRESH'));
  }
});
