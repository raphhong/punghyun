import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const source=readFileSync(new URL('../src/lib/admin/gmail-connect.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {beginConnect,finishConnect,GMAIL_SCOPE,CALLBACK,CONNECT_ORIGIN,BINDING_COOKIE,RESULT}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const hash=s=>createHash('sha256').update(s).digest('hex');
function fixture() {
  const rows=new Map(), saved=[]; let exchanges=0, now=1000000;
  const d={config:{enabled:true,ownerId:'owner-test',clientId:'synthetic-client'},
    identity:async()=>({id:'owner-test',email:'sol.hong@punghyun.com',verified:true}),now:()=>now,
    states:{put:async(k,v)=>rows.set(k,v),consume:async(k,owner,bindingHash,t)=>{
      const r=rows.get(k);if(!r||r.owner!==owner||r.bindingHash!==bindingHash||r.expires<=t)return null;
      rows.delete(k);return r;
    }},
    secrets:{save:async x=>{saved.push(x);}},
    exchange:async(code,verifier,redirect)=>{exchanges++;assert.equal(code,'synthetic-code');assert.equal(redirect,CALLBACK);assert.ok(verifier.length>=43);return {access_token:'SYNTHETIC_ACCESS',refresh_token:'SYNTHETIC_REFRESH',token_type:'Bearer',scope:GMAIL_SCOPE};},
    profile:async()=>({emailAddress:'sol.hong@punghyun.com'})};
  const start=(origin=CONNECT_ORIGIN)=>beginConnect(new Request(CONNECT_ORIGIN+'/api/integrations/gmail/connect',{method:'POST',headers:{origin}}),d);
  const callback=(state,cookie,extra='&code=synthetic-code')=>finishConnect(new Request(CALLBACK+'?state='+state+extra,{headers:{cookie}}),d);
  async function flow(){const r=await start();assert.equal(r.status,303);const url=new URL(r.headers.get('location'));return {url,state:url.searchParams.get('state'),cookie:r.headers.get('set-cookie').split(';')[0],response:r};}
  return {d,rows,saved,start,callback,flow,exchanges:()=>exchanges,advance:()=>{now+=600001;}};
}
test('full synthetic owner consent: exact readonly/offline, PKCE, private cookie, hashed state and single save',async()=>{
  const f=fixture(),s=await f.flow();
  assert.equal(s.url.origin,'https://accounts.google.com');assert.equal(s.url.searchParams.get('scope'),GMAIL_SCOPE);
  assert.equal(s.url.searchParams.get('access_type'),'offline');assert.equal(s.url.searchParams.get('code_challenge_method'),'S256');
  assert.match(s.response.headers.get('set-cookie'),/Secure; HttpOnly; SameSite=Lax/);
  assert.ok(f.rows.has(hash(s.state)));assert.ok(!f.rows.has(s.state));
  const pending=f.rows.get(hash(s.state));assert.equal(s.url.searchParams.get('code_challenge'),createHash('sha256').update(pending.verifier).digest('base64url'));
  const r=await f.callback(s.state,s.cookie);assert.equal(r.headers.get('location'),RESULT+'?result=connected');
  assert.equal(f.saved.length,1);assert.equal(f.saved[0].scope,GMAIL_SCOPE);
  assert.equal((await f.callback(s.state,s.cookie)).status,400);assert.equal(f.exchanges(),1);
});
test('anonymous, wrong owner, unverified account, wrong email fail before state creation',async()=>{
  for(const user of [null,{id:'other',email:'sol.hong@punghyun.com',verified:true},{id:'owner-test',email:'other@example.test',verified:true},{id:'owner-test',email:'sol.hong@punghyun.com',verified:false}]){
    const f=fixture();f.d.identity=async()=>user;assert.equal((await f.start()).status,401);assert.equal(f.rows.size,0);
  }
});
test('disabled or missing production adapters cannot start authorization',async()=>{
  for(const key of ['states','secrets','exchange','profile']){const f=fixture();delete f.d[key];assert.equal((await f.start()).status,503);}
  const f=fixture();f.d.config.enabled=false;assert.equal((await f.start()).status,503);
});
test('cross-site POST and wrong method rejected',async()=>{
  const f=fixture();assert.equal((await f.start('https://evil.test')).status,403);
  assert.equal((await beginConnect(new Request(CONNECT_ORIGIN+'/api/integrations/gmail/connect'),f.d)).status,405);
});
test('wrong binding, duplicate cookie and expired state cannot exchange',async()=>{
  const f=fixture(),s=await f.flow();
  assert.equal((await f.callback(s.state,BINDING_COOKIE+'='+'x'.repeat(43))).status,400);
  assert.equal((await f.callback(s.state,s.cookie+'; '+s.cookie)).status,400);
  f.advance();assert.equal((await f.callback(s.state,s.cookie)).status,400);assert.equal(f.exchanges(),0);
});
test('denial consumes state without exchange and clears binding',async()=>{
  const f=fixture(),s=await f.flow();const r=await f.callback(s.state,s.cookie,'&error=access_denied');
  assert.equal(r.headers.get('location'),RESULT+'?result=denied');assert.match(r.headers.get('set-cookie'),/Max-Age=0/);
  assert.equal((await f.callback(s.state,s.cookie)).status,400);assert.equal(f.exchanges(),0);
});
test('expanded scopes, wrong mailbox or missing refresh credential never store',async()=>{
  for(const change of ['scope','mailbox','refresh']){const f=fixture(),s=await f.flow();
    if(change==='mailbox')f.d.profile=async()=>({emailAddress:'other@example.test'});
    else {const exchange=f.d.exchange;f.d.exchange=async(...args)=>({...await exchange(...args),...(change==='scope'?{scope:GMAIL_SCOPE+' https://mail.google.com/'}:{refresh_token:''})});}
    const r=await f.callback(s.state,s.cookie);assert.equal(r.headers.get('location'),RESULT+'?result=failed');assert.equal(f.saved.length,0);
  }
});
test('concurrent duplicate callback performs one exchange',async()=>{
  const f=fixture(),s=await f.flow();await Promise.all([f.callback(s.state,s.cookie),f.callback(s.state,s.cookie)]);assert.equal(f.exchanges(),1);assert.equal(f.saved.length,1);
});
test('uncertain secret storage error does not replay or expose diagnostic',async()=>{
  const f=fixture(),s=await f.flow();let attempts=0;f.d.secrets.save=async()=>{attempts++;throw Error('PRIVATE_SECRET');};
  const r=await f.callback(s.state,s.cookie);assert.equal(r.headers.get('location'),RESULT+'?result=failed');assert.equal(await r.text(),'');
  await f.callback(s.state,s.cookie);assert.equal(attempts,1);
});
test('malformed/duplicated callback and redirect injection rejected',async()=>{
  const f=fixture(),s=await f.flow();for(const extra of ['&code=x&code=y','&code=x&next=https://evil.test']) assert.equal((await f.callback(s.state,s.cookie,extra)).status,400);
  assert.equal(f.exchanges(),0);
});
test('logout between start and callback prevents exchange',async()=>{
  const f=fixture(),s=await f.flow();f.d.identity=async()=>null;assert.equal((await f.callback(s.state,s.cookie)).status,401);assert.equal(f.exchanges(),0);
});
test('only initial mailbox is allowed by default; named extra account needs an explicit allowlist',async()=>{
  const f=fixture();const r=await beginConnect(new Request(CONNECT_ORIGIN+'/api/integrations/gmail/connect?account=synthetic_second',{method:'POST',headers:{origin:CONNECT_ORIGIN}}),f.d);
  assert.equal(r.status,403);assert.equal(f.rows.size,0);
});
test('account choice is bound to state and exact Google identity, not callback parameters',async()=>{
  const f=fixture();f.d.config.accounts=[{id:'sol_hong',email:'sol.hong@punghyun.com'},{id:'synthetic_second',email:'second@example.test'}];
  const r=await beginConnect(new Request(CONNECT_ORIGIN+'/api/integrations/gmail/connect?account=synthetic_second',{method:'POST',headers:{origin:CONNECT_ORIGIN}}),f.d);
  const url=new URL(r.headers.get('location')),state=url.searchParams.get('state'),cookie=r.headers.get('set-cookie').split(';')[0];
  assert.equal(url.searchParams.get('login_hint'),'second@example.test');assert.equal(f.rows.get(hash(state)).accountId,'synthetic_second');
  // Google choosing the original mailbox cannot silently fill another account's slot.
  assert.equal((await f.callback(state,cookie)).headers.get('location'),RESULT+'?result=failed');assert.equal(f.saved.length,0);
});
test('explicit synthetic second account saves into its own isolated identity',async()=>{
  const f=fixture();f.d.config.accounts=[{id:'synthetic_second',email:'second@example.test'}];f.d.profile=async()=>({emailAddress:'second@example.test'});
  const r=await beginConnect(new Request(CONNECT_ORIGIN+'/api/integrations/gmail/connect?account=synthetic_second',{method:'POST',headers:{origin:CONNECT_ORIGIN}}),f.d);
  const url=new URL(r.headers.get('location'));await f.callback(url.searchParams.get('state'),r.headers.get('set-cookie').split(';')[0]);
  assert.equal(f.saved[0].accountId,'synthetic_second');assert.equal(f.saved[0].mailbox,'second@example.test');
});
