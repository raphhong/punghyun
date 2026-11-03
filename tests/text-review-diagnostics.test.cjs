// Product transport tests only. No DB, policies, network or denied security-review work.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const cache=new Map();function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n.endsWith('.json')?require(path.resolve(path.dirname(file),n)):n.startsWith('.')?load(path.resolve(path.dirname(file),n)+'.ts'):require(n),m,m.exports);return m.exports;}
const {responsesTransport}=load('src/lib/admin/ai/openai.ts');
const {normalReviewEndpoint}=load('src/lib/sales/normal-review.ts');
const {sha,reviewSourceSnapshot}=load('src/lib/admin/ai/review.ts');
const segment={id:'s',sourceId:'d',version:'v1',sha256:sha('SYNTHETIC'),locator:'sheet:1;cell:A1',text:'SYNTHETIC'};
const config={approved:true,dataScope:'minimized_text',model:'gpt-5.4-2026-03-05',apiKey:'DO_NOT_LOG_KEY',maxOutputTokens:1000,maxRequestBytes:16000,timeoutMs:1000};
function envelope(raw){return {status:'completed',usage:{input_tokens:123,output_tokens:45,private:'DO_NOT_LOG_USAGE'},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(raw)}]}]};}
test('HTTP and usage survive output parsing failure without response text or secret',async()=>{let d={},calls=0;const m=responsesTransport({...config,diagnostic:e=>d={...d,...e}},async()=>{calls++;const x=envelope({});x.output[0].content[0].text='DO_NOT_LOG_RAW';return Response.json(x);});await assert.rejects(m.analyze([segment],new AbortController().signal),/provider_outcome_unknown/);assert.equal(calls,1);assert.equal(d.errorCode,'provider_output_json');assert.equal(d.httpStatus,200);assert.equal(d.inputTokens,123);assert.equal(d.outputTokens,45);assert(!JSON.stringify(d).includes('DO_NOT_LOG'));});
test('HTTP error, timeout, malformed envelope, missing usage and success are distinct',async()=>{for(const [response,code] of [[()=>new Response('DO_NOT_LOG_HTTP',{status:429}),'provider_http_error'],[()=>Response.json({status:'incomplete',usage:{input_tokens:2,output_tokens:1000}}),'provider_incomplete'],[()=>Response.json({status:'completed',output:[]}),'provider_envelope'],[()=>Response.json(envelope({facts:[]})),null]]){let d={};const m=responsesTransport({...config,diagnostic:e=>d={...d,...e}},async()=>response());if(code)await assert.rejects(m.analyze([segment],new AbortController().signal));else await m.analyze([segment],new AbortController().signal);assert.equal(d.errorCode??null,code);assert.equal(d.billingVerified,false);assert(!JSON.stringify(d).includes('DO_NOT_LOG'));}let d={};const m=responsesTransport({...config,timeoutMs:1,diagnostic:e=>d={...d,...e}},async(_u,o)=>new Promise((_ok,no)=>o.signal.addEventListener('abort',()=>no(Error('DO_NOT_LOG_NETWORK')))));await assert.rejects(m.analyze([segment],new AbortController().signal));assert.equal(d.errorCode,'provider_timeout');});
test('request limit records non-dispatch and never calls transport',async()=>{let calls=0,d={};const m=responsesTransport({...config,maxRequestBytes:1000,diagnostic:e=>d={...d,...e}},async()=>{calls++;throw Error();});await assert.rejects(m.analyze([segment],new AbortController().signal),/request_limit/);assert.equal(calls,0);assert.equal(d.dispatchAttempted,false);assert.equal(d.errorCode,'request_limit');});
test('endpoint persists safe validation failure, usage and UNKNOWN; retry does not dispatch',async()=>{const id='11111111-1111-4111-8111-111111111111',scope={actorId:'a',customerId:'c',caseId:'c',tenantId:'t',revision:'r'},sources=[{id,customerId:'c',version:'v1',sha256:sha('SYNTHETIC'),bytes:Buffer.from('SYNTHETIC'),mime:'text/plain',assetId:null}],ctx={scope,sources,snapshot:reviewSourceSnapshot(scope,sources)},s={...segment,sourceId:id};let job=null,calls=0,saved;
const grant={id:'g',model:config.model,maxOutputTokens:1000,maxRequestBytes:16000,timeoutMs:1000,release:{policyVersion:'v1',scopeHash:sha(JSON.stringify(scope)),expiresAt:Date.now()+60000,segments:[{id:'s',sourceId:id,version:'v1',sha256:s.sha256,assetId:null,textHash:sha(s.text),ranges:[{start:0,end:s.text.length}]}]}};
const repository={current:async()=>job,grant:async()=>grant,reserve:async()=>{if(job)return null;job={id:'j',status:'running',result:null};return 'j';},finish:async(_c,_j,result,d)=>{saved=d;job={id:'j',status:result?'completed':'unknown',result};}};
const model=c=>responsesTransport(c,async()=>{calls++;return Response.json(envelope({facts:[],observations:[{topic:'document_fact',citations:[{segment:'s',quote:'DO_NOT_LOG_INVALID_QUOTE'}]}]}));});
const handler=normalReviewEndpoint({context:async()=>ctx,repository,extract:async()=>[s],model,apiKey:'DO_NOT_LOG_KEY'});const post=()=>handler(new Request('https://local.test/review',{method:'POST',headers:{origin:'https://local.test'},body:JSON.stringify({action:'request',documentIds:[id],sourceSnapshot:ctx.snapshot,idempotencyKey:'22222222-2222-4222-8222-222222222222'})}));
assert.equal((await post()).status,409);assert.equal(job.status,'unknown');assert.equal(saved.errorCode,'content_citation');assert.equal(saved.stage,'result_validation');assert.equal(saved.inputTokens,123);assert.equal(saved.httpStatus,200);assert(!JSON.stringify(saved).includes('DO_NOT_LOG'));await post();assert.equal(calls,1);assert.equal(job.status,'unknown');
});
test('incomplete reasons are distinguished; partial valid JSON is never accepted or retried',async()=>{
 for(const [reason,code] of [['max_output_tokens','provider_output_limit'],['content_filter','provider_content_filter'],['DO_NOT_LOG_REASON','provider_incomplete']]){
  let calls=0,d={};const x=envelope({facts:[]});x.status='incomplete';x.incomplete_details={reason};x.usage={input_tokens:3061,output_tokens:1000,output_tokens_details:{reasoning_tokens:0},input_tokens_details:{cached_tokens:0}};
  const model=responsesTransport({...config,diagnostic:e=>d={...d,...e}},async()=>{calls++;return Response.json(x);});
  await assert.rejects(model.analyze([segment],new AbortController().signal),/provider_outcome_unknown/);
  assert.equal(calls,1);assert.equal(d.errorCode,code);assert.equal(d.providerStatus,'incomplete');assert.equal(d.incompleteReason,reason==='DO_NOT_LOG_REASON'?'unknown':reason);assert.equal(d.configuredOutputLimit,1000);assert.equal(d.reasoningTokens,0);assert.equal(d.cachedInputTokens,0);assert.equal(d.outputTextPresent,true);assert.equal(d.billingVerified,false);assert(!JSON.stringify(d).includes('DO_NOT_LOG'));
 }
});
test('failed, noncompleted and unknown status cannot be misclassified as output cap exhaustion',async()=>{
 for(const [status,code] of [['failed','provider_failed'],['queued','provider_not_completed'],['DO_NOT_LOG_STATUS','provider_not_completed']]){
  let d={};const model=responsesTransport({...config,diagnostic:e=>d={...d,...e}},async()=>Response.json({status,error:{message:'DO_NOT_LOG_ERROR'},usage:{output_tokens:1000}}));
  await assert.rejects(model.analyze([segment],new AbortController().signal));assert.equal(d.errorCode,code);assert.equal(d.incompleteReason,undefined);assert(!JSON.stringify(d).includes('DO_NOT_LOG'));
 }
});
test('malformed metadata is bounded and contains no response content',()=>{
 const {textEnvelopeDiagnostic}=load('src/lib/admin/ai/openai.ts');
 for(const input of [null,[],42,'DO_NOT_LOG'])assert.equal(textEnvelopeDiagnostic(input).providerStatus,'unknown');
 const d=textEnvelopeDiagnostic({status:'incomplete',incomplete_details:{reason:{secret:'DO_NOT_LOG'}},usage:{input_tokens:2,output_tokens:3,output_tokens_details:{reasoning_tokens:4},input_tokens_details:{cached_tokens:-1}},output:[null,{type:'message',content:[null,{type:'output_text',text:'DO_NOT_LOG_CONTENT'}]}]});
 assert.equal(d.reasoningTokens,undefined);assert.equal(d.cachedInputTokens,undefined);assert.equal(d.incompleteReason,'unknown');assert.equal(d.outputTextPresent,true);assert(!JSON.stringify(d).includes('DO_NOT_LOG'));
});
test('candidate 4000 cap needs explicit configuration; legacy trial remains 1000 with no implicit retry or reasoning change',async()=>{
 const {boundedSyntheticTrial,assertSyntheticTrialConfig}=load('src/lib/admin/ai/openai.ts');
 assert.equal(boundedSyntheticTrial('LOCAL_PLACEHOLDER').maxOutputTokens,1000);
 assert.throws(()=>assertSyntheticTrialConfig({...config,maxOutputTokens:4000}),/trial_configuration/);
 for(const limit of [1000,4000]){
  let sent,calls=0;const model=responsesTransport({...config,maxOutputTokens:limit},async(_url,request)=>{calls++;sent=JSON.parse(request.body);return Response.json(envelope({facts:[]}));});
  await model.analyze([segment],new AbortController().signal);assert.equal(sent.max_output_tokens,limit);assert.equal(sent.reasoning,undefined);assert.equal(sent.store,false);assert.equal(sent.background,false);assert.deepEqual(sent.tools,[]);assert.equal(calls,1);
 }
 assert.throws(()=>responsesTransport({...config,maxOutputTokens:4001}),/provider_configuration/);
});
