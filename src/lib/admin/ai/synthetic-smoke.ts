import {boundedSyntheticTrial,responsesTransport} from './openai';
import {runReview,sha,type Source,type Segment} from './review';
export const smokeFixture=Object.freeze({id:'synthetic-consistent-v85',pdfHash:'8c3d6e1c7c1029f1256f8dfd25f256926606e58fe5864b3b805f11cf214d8f01',text:'Customer SYNTHETIC-ORG-A\nPurchase total 1000 KRW; VAT included; period 2026-11.'} as const);
type Reservation={permit:boolean;reserved:boolean;sameSession:boolean;usedAttempts:number;reservedMicrousd:number;expiresAt:string;assurance:string};
type Usage={inputTokens:number;outputTokens:number;cachedInputTokens:number;conservativeCostUsd:number};
export type SmokePorts={env:Record<string,string|undefined>;actor():Promise<string>;rpc(reserve:boolean):Promise<unknown>;transport?:typeof fetch;now?:()=>number};
const codes=['unauthorized','forbidden','invalid_request','smoke_not_enabled','provider_not_configured','smoke_expired','already_reserved','smoke_unavailable','provider_auth_failed','provider_outcome_unknown','smoke_validation_failed'] as const;
const safe=(e:unknown)=>codes.find(c=>e instanceof Error&&e.message===c)??'smoke_unavailable';
export function smokeEnvironment(e:SmokePorts['env']){return e.VERCEL_ENV==='preview'&&e.VERCEL_PROJECT_ID==='prj_QsugyPN8WskIrGq5nnsZwzFHSdXB'&&e.VERCEL_GIT_COMMIT_REF==='codex/standard-contract-preparation-v51'&&e.NEXT_PUBLIC_SUPABASE_URL==='https://zatlumldeqhghhrsgtdq.supabase.co'&&e.OPENAI_SYNTHETIC_SMOKE_ENABLED==='single-synthetic-v92';}
function reservation(raw:unknown,now:number):Reservation{
 if(!raw||typeof raw!=='object')throw Error('smoke_unavailable');const r=raw as Reservation;
 if(typeof r.permit!=='boolean'||typeof r.reserved!=='boolean'||typeof r.sameSession!=='boolean'||r.assurance!=='reservation_only_not_execution_proof'||![3,4].includes(r.usedAttempts)||r.reservedMicrousd!==(r.usedAttempts===3?1215360:1715360)||r.reserved!==(r.usedAttempts===4)||r.permit&&(!r.reserved||!r.sameSession)||!Number.isFinite(Date.parse(r.expiresAt)))throw Error('smoke_unavailable');
 if(Date.parse(r.expiresAt)<=now)throw Error('smoke_expired');return r;
}
async function boundedText(response:Response,max:number){const reader=response.body?.getReader();if(!reader)throw Error('provider_outcome_unknown');const decoder=new TextDecoder();let result='',bytes=0;for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>max){await reader.cancel();throw Error('provider_outcome_unknown');}result+=decoder.decode(part.value,{stream:true});}return result+decoder.decode();}
export async function handleSyntheticSmoke(request:Request,p:SmokePorts){const headers={'Cache-Control':'no-store','Pragma':'no-cache'};let consumed=false,authFailure=false;try{
 if(!smokeEnvironment(p.env))throw Error('smoke_not_enabled');
 if(!['GET','POST'].includes(request.method))throw Error('invalid_request');
 if(request.method==='POST'&&request.headers.get('origin')!==new URL(request.url).origin)throw Error('forbidden');
 const actor=await p.actor();if(!actor)throw Error('unauthorized');
 const now=()=>p.now?.()??Date.now();const read=async()=>reservation(await p.rpc(false),now());const initial=await read();
 if(request.method==='GET')return Response.json({state:initial.reserved?'reserved_outcome_not_persisted':p.env.OPENAI_API_KEY?'ready':'waiting_key',usedAttempts:initial.usedAttempts,reservedMicrousd:initial.reservedMicrousd,expiresAt:initial.expiresAt,financialApproval:false},{headers});
 const reader=request.body?.getReader();if(!reader)throw Error('invalid_request');let b='',n=0;for(;;){const x=await reader.read();if(x.done)break;n+=x.value.length;if(n>128){await reader.cancel();throw Error('invalid_request');}b+=new TextDecoder().decode(x.value);}let input;try{input=JSON.parse(b);}catch{throw Error('invalid_request');}if(!input||input.action!=='run_once'||Object.keys(input).length!==1)throw Error('invalid_request');
 if(initial.reserved)throw Error('already_reserved');if(!p.env.OPENAI_API_KEY)throw Error('provider_not_configured');if(request.signal.aborted)throw Error('invalid_request');
 let usage:Usage|undefined;let dispatchCount=0;
 const transport:typeof fetch=async(url,options)=>{
  if(dispatchCount++)throw Error('provider_outcome_unknown');if(await p.actor()!==actor)throw Error('forbidden');
  const state=await read();if(!state.reserved||!state.sameSession)throw Error('forbidden');
  const response=await (p.transport??fetch)(url,options);if(response.status===401){authFailure=true;await response.body?.cancel();throw Error('provider_auth_failed');}if(!response.ok){await response.body?.cancel();throw Error('provider_outcome_unknown');}
  const text=await boundedText(response,200000);let data;try{data=JSON.parse(text);}catch{throw Error('provider_outcome_unknown');}if(data?.model!=='gpt-5.4-2026-03-05')throw Error('provider_outcome_unknown');const u=data?.usage;
  if(!u||![u.input_tokens,u.output_tokens,u.input_tokens_details?.cached_tokens??0].every(x=>Number.isSafeInteger(x)&&x>=0)||u.input_tokens>20000||u.output_tokens>1000||(u.input_tokens_details?.cached_tokens??0)>u.input_tokens)throw Error('provider_outcome_unknown');
  usage={inputTokens:u.input_tokens,outputTokens:u.output_tokens,cachedInputTokens:u.input_tokens_details?.cached_tokens??0,conservativeCostUsd:(u.input_tokens*2.5+u.output_tokens*15)/1000000};
  return new Response(text,{status:200,headers:{'Content-Type':'application/json'}});
 };
 const source:Source={id:smokeFixture.id,version:'synthetic-v85-text-v1',bytes:Buffer.from(smokeFixture.text),sha256:sha(smokeFixture.text),mime:'text/plain',customerId:'SYNTHETIC-ORG-A',assetId:null};
 const segment:Segment={id:'synthetic-page-1',sourceId:source.id,version:source.version,sha256:source.sha256,locator:'page:1',text:smokeFixture.text};
 const scope={actorId:actor,tenantId:'synthetic-smoke-only',customerId:source.customerId,caseId:'fixed-one-shot',revision:'v92'};
 const result=await runReview({scope:async()=>{if(await p.actor()!==actor)throw Error('forbidden');return scope;},sources:async()=>[source],extract:async()=>[segment],minimize:async s=>s,model:responsesTransport(boundedSyntheticTrial(p.env.OPENAI_API_KEY),transport),reserve:async()=>{consumed=true;const r=reservation(await p.rpc(true),now());if(!r.permit)throw Error('already_reserved');return true;}},[source.id],'synthetic-one-shot-v92',request.signal);
 if(await p.actor()!==actor)throw Error('forbidden');const after=await read();if(!after.sameSession||!after.reserved)throw Error('forbidden');
 if(!usage||result.facts.length!==2||result.facts.filter(f=>f.field==='purchase.total').length!==1||result.facts.filter(f=>f.field==='customer.name').length!==1||!result.facts.some(f=>f.field==='purchase.total'&&f.value==='1000'&&f.unit==='KRW'&&f.vat==='inclusive'&&f.period==='2026-11')||!result.facts.some(f=>f.field==='customer.name'&&f.value==='SYNTHETIC-ORG-A')||result.facts.some(f=>!['purchase.total','customer.name'].includes(f.field))||result.supplements.some(s=>s.kind==='conflict'||['purchase.total','customer.name'].includes(s.field)))throw Error('smoke_validation_failed');
 return Response.json({state:'synthetic_transport_and_oracle_passed',result,usage,fixturePdfHash:smokeFixture.pdfHash,sourceMode:'fixed_preextracted_synthetic_text',persistedResult:false,financialApproval:false,usedAttempts:after.usedAttempts,reservedMicrousd:after.reservedMicrousd},{headers});
 }catch(e){let code=authFailure?'provider_auth_failed':safe(e);if(e instanceof Error&&['ai_schema','ai_citation','ai_numeric_citation'].includes(e.message))code='smoke_validation_failed';return Response.json({code,reservationMayBeConsumed:consumed,automaticRetryAllowed:false,financialApproval:false},{status:code==='unauthorized'?401:code==='forbidden'?403:code==='invalid_request'?400:['already_reserved','smoke_expired'].includes(code)?409:503,headers});}}
