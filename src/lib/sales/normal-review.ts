import type {DocumentLimits} from './document-limits';
import {prepareMixedRequest,sendMixedRequest,type MixedManifest} from './normal-mixed';
import {prepareNormalVision,sendNormalVision} from './normal-vision';
import {otherDocumentFilename} from '../admin/other-document-path';
import type {WholeVisualApproval} from '../admin/ai/document-vision-input';
import type {SupabaseClient} from '@supabase/supabase-js';
import {sha,runReview,reviewSourceSnapshot,type Source,type Scope,type Result,type Ports} from '../admin/ai/review';
import {sourceVersion} from '../admin/ai/sources';
import {extractDocument} from '../admin/ai/document-extraction';
import {rangeMinimizer,type TextRelease} from '../admin/ai/minimization';
import {responsesTransport,textFailureCode,type TextDiagnostic,type ApprovedConfig} from '../admin/ai/openai';
import {contentContract} from '../admin/ai/content-contract';
import {salesModelFeedback} from './model-feedback';
import {readReviewResult} from '../admin/ai/presentation';

export type NormalContext={scope:Scope;sources:Source[];snapshot:string;files?:{id:string;label:string;category:string}[];excluded?:{documentId:string;code:string}[]};
export type NormalGrant={visualLimits?:DocumentLimits;mixed?:MixedManifest;visual?:WholeVisualApproval;id:string;release:TextRelease;model:string;maxOutputTokens:number;maxRequestBytes:number;timeoutMs:number};
export type NormalJob={id:string;status:'running'|'unknown'|'completed';result:Result|null};
/** Server-owned repository; never supplied by the browser. No synthetic-scope RPCs. */
export type NormalRepository={
 grant(c:NormalContext):Promise<NormalGrant|null>;
 current(c:NormalContext):Promise<NormalJob|null>;
 hasPrevious?(c:NormalContext):Promise<boolean>;
 reserve(c:NormalContext,g:NormalGrant,key:string,binding:string):Promise<string|null>;
 finish(c:NormalContext,id:string,result:Result|null,diagnostic?:unknown):Promise<void>;
};
const uuid=(x:unknown):x is string=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(x);
const headers={'Cache-Control':'no-store'};

/** Same JWT/RLS customer visibility as normal sales uploads. Privileged Storage only follows
 * a fresh successful JWT check; no new role, credential, arbitrary URL or browser path. */
export function normalSalesSources(db:SupabaseClient,storage:()=>SupabaseClient,customerId:string,selectedIds?:string[]){
 async function metadata(){
  if(!uuid(customerId))throw Error('invalid_request');
  const auth=await db.auth.getUser();if(auth.error||!auth.data.user)throw Error('forbidden');
  const agent=await db.from('sales_agents').select('id,status').eq('user_id',auth.data.user.id).maybeSingle();
  if(agent.error||agent.data?.status!=='approved')throw Error('forbidden');
  const customer=await db.from('customers').select('id,sales_agent_id').eq('id',customerId).maybeSingle();
  if(customer.error||!customer.data)throw Error('forbidden');
  const docs=await db.from('customer_documents').select('id,file_path,uploaded_at,device_id,category,doc_key').eq('customer_id',customerId).order('id');
  if(docs.error)throw Error('source_unavailable');
  const available=(docs.data??[]).filter(d=>d.file_path);
  if(selectedIds&&(selectedIds.length>8||new Set(selectedIds).size!==selectedIds.length||selectedIds.some(id=>!uuid(id)||!available.some(d=>d.id===id))))throw Error('source_changed');
  const rows=selectedIds?available.filter(d=>selectedIds.includes(d.id)):available;
  // The actor/assignment binding also invalidates results after reassignment.
  return {actor:auth.data.user.id,agent:agent.data.id,assignment:customer.data.sales_agent_id,rows};
 }
 return async():Promise<NormalContext>=>{
  const m=await metadata();if(m.rows.length>8)throw Error('document_selection_required');
  const sources:Source[]=[],excluded:{documentId:string;code:string}[]=[];
  for(const d of m.rows){
   if(typeof d.file_path!=='string'||!d.file_path.startsWith(customerId+'/')||!d.uploaded_at)throw Error('source_changed');
   // These documents must never enter an automatic AI batch, even if upload itself is allowed.
   if(/identity|id_card|resident|passport|신분|주민|여권/i.test(d.doc_key+' '+d.category)){excluded.push({documentId:d.id,code:'sensitive_document_not_sent'});continue;}
   const s=storage().storage.from('customer-docs');
   const info=await s.info(d.file_path);if(info.error||!info.data||typeof info.data.size!=='number'||info.data.size<1||info.data.size>8*1024*1024)throw Error('source_unavailable');
   const file=await s.download(d.file_path);if(file.error||!file.data||file.data.size>8*1024*1024)throw Error('source_unavailable');
   const bytes=new Uint8Array(await file.data.arrayBuffer()),hash=sha(bytes);
   sources.push({id:d.id,version:sourceVersion(d.uploaded_at,sha(d.file_path),hash),sha256:hash,bytes,customerId,assetId:d.device_id??null,mime:info.data.contentType??file.data.type});
  }
  const again=await metadata();if(JSON.stringify(m)!==JSON.stringify(again))throw Error('source_changed');
  const scope:Scope={actorId:m.actor,tenantId:'punghyun',customerId,caseId:customerId,revision:sha(JSON.stringify([m.agent,m.assignment,m.rows]))};
  return {scope,sources,snapshot:reviewSourceSnapshot(scope,sources),excluded,files:m.rows.map(d=>({id:d.id,label:otherDocumentFilename(d.file_path),category:d.category}))};
 };
}

export function normalReviewEndpoint(input:{context:()=>Promise<NormalContext>;repository:NormalRepository;apiKey?:string;model?:(config:ApprovedConfig)=>NonNullable<Ports['model']>;extract?:Ports['extract'];visualTransport?:typeof fetch}){
 return async(request:Request)=>{
  let job:string|null=null,context:NormalContext|null=null,diagnostic:unknown=null;
  try{
   if(!['GET','POST'].includes(request.method))throw Error('invalid_request');
   if(request.method==='POST'&&request.headers.get('origin')!==new URL(request.url).origin)throw Error('forbidden');
   context=await input.context();const original=context;
   const recheck=async()=>{const current=await input.context();if(JSON.stringify(current.scope)!==JSON.stringify(original.scope)||current.snapshot!==original.snapshot)throw Error('source_changed');return current;};
   const stored=await input.repository.current(context);
   const grant=await input.repository.grant(context);
   const base={documentIds:context.sources.map(s=>s.id),documentStates:context.excluded??[],sourceSnapshot:context.snapshot,revision:0,executionAllowed:false,financialApproval:false,automaticRetryAllowed:false};
   const show=(r:Result)=>({...base,status:'reviewed',issues:salesModelFeedback([r],context!.sources.map(s=>s.id)),requestAllowed:false,persistedResult:true,mode:r.mode});
   if(request.method==='GET'){
    const previous=await input.repository.hasPrevious?.(context)??false;await recheck();
    if(stored?.status==='completed'&&stored.result){const result=readReviewResult(stored.result);if(result.sourceSnapshot!==context.snapshot)throw Error('source_changed');return Response.json(show(result),{headers});}
    return Response.json({...base,status:stored?.status??(previous?'stale':'not_run'),issues:[],requestAllowed:!stored&&!!grant&&!!input.apiKey&&context.sources.length>0,blocker:stored?'request_already_reserved':!grant?'transmission_approval_required':!input.apiKey?'provider_not_configured':null},{headers});
   }
   const text=await request.text();if(text.length>6000)throw Error('invalid_request');const body=JSON.parse(text);
   if(body.action!=='request'||!uuid(body.idempotencyKey)||body.sourceSnapshot!==context.snapshot||!Array.isArray(body.documentIds)||JSON.stringify([...body.documentIds].sort())!==JSON.stringify(context.sources.map(s=>s.id).sort()))throw Error('source_changed');
   if(stored)throw Error('request_already_reserved');
   if(!grant)throw Error('transmission_approval_required');if(!input.apiKey)throw Error('provider_not_configured');
   const approvedCurrent=async()=>{const c=await recheck();const latest=await input.repository.grant(c);if(!latest||JSON.stringify(latest)!==JSON.stringify(grant))throw Error('transmission_approval_required');return c;};
   if(grant.mixed){
    if(grant.model!=='gpt-5.4-2026-03-05'||grant.timeoutMs<1||grant.timeoutMs>60000||grant.maxOutputTokens<1||grant.maxOutputTokens>4000)throw Error('visual_release_required');
    const prepared=await prepareMixedRequest(context,grant,input.extract?async s=>input.extract!(s):undefined);
    await approvedCurrent();if(request.signal.aborted)throw Error('cancelled');
    job=await input.repository.reserve(context,grant,body.idempotencyKey,prepared.binding);if(!job)throw Error('request_already_reserved');
    diagnostic={stage:'prepared',transmissions:prepared.transmissions,resources:prepared.resources};
    await approvedCurrent();const result=await sendMixedRequest(prepared,context,grant,input.apiKey,request.signal,input.visualTransport,v=>{diagnostic={transmissions:prepared.transmissions,resources:prepared.resources,...(v as Record<string,unknown>)};});
    await approvedCurrent();await input.repository.finish(context,job,result,diagnostic);await recheck();return Response.json(show(result),{headers});
   }
   if(grant.visual){
    if(context.sources.length!==1||grant.model!=='gpt-5.4-2026-03-05'||grant.maxOutputTokens!==4000||grant.timeoutMs<1||grant.timeoutMs>60000)throw Error('visual_release_required');
    const prepared=await prepareNormalVision(context.sources[0],grant.visual);
    await approvedCurrent();if(request.signal.aborted)throw Error('cancelled');
    job=await input.repository.reserve(context,grant,body.idempotencyKey,prepared.binding);if(!job)throw Error('request_already_reserved');
    await approvedCurrent();
    const result=await sendNormalVision({prepared,source:context.sources[0],snapshot:context.snapshot,key:input.apiKey,signal:request.signal,timeoutMs:grant.timeoutMs,transport:input.visualTransport,diagnostic:v=>{diagnostic=v;}});
    await approvedCurrent();await input.repository.finish(context,job,result,diagnostic);await recheck();
    return Response.json(show(result),{headers});
   }
   diagnostic={version:1,stage:'review_preparation',billingVerified:false};const recordText=(event:TextDiagnostic)=>{diagnostic={...(diagnostic as TextDiagnostic),...event};};
   const model=(input.model??responsesTransport)({approved:true,dataScope:'minimized_text',diagnostic:recordText,reviewContract:contentContract,apiKey:input.apiKey,model:grant.model,maxOutputTokens:grant.maxOutputTokens,maxRequestBytes:grant.maxRequestBytes,timeoutMs:grant.timeoutMs});
   const result=await runReview({scope:async()=>(await approvedCurrent()).scope,sources:async()=>(await approvedCurrent()).sources,
    extract:input.extract??(async s=>(await extractDocument(s,request.signal)).segments),minimize:rangeMinimizer(grant.release),model,
    reserve:async(binding,key)=>{await recheck();job=await input.repository.reserve(original,grant,key,binding);return !!job;},policyVersion:grant.release.policyVersion},context.sources.map(s=>s.id),body.idempotencyKey,request.signal);
   await approvedCurrent();if(!job)throw Error('source_unreadable');
   recordText({version:1,stage:'result_persistence',billingVerified:false});await input.repository.finish(context,job,result,{...(diagnostic as TextDiagnostic),stage:'completed'});await recheck();
   return Response.json(show(result),{headers});
  }catch(e){
   // Any dispatched/reserved uncertain result keeps its reservation. No automatic retry/refund.
   if(diagnostic&&(diagnostic as TextDiagnostic).version===1){const d=diagnostic as TextDiagnostic;diagnostic={...d,errorCode:d.errorCode??textFailureCode(e)};}
   if(job&&context)try{await input.repository.finish(context,job,null,diagnostic);}catch{}
   const allowed=['forbidden','invalid_request','source_changed','source_unavailable','source_unreadable','sensitive_document','document_selection_required','transmission_approval_required','provider_not_configured','request_already_reserved','provider_outcome_unknown','ocr_runtime_unavailable','unsupported_format','storage_not_connected','visual_release_required','invalid_image','unsupported_pdf','visual_input_limit','image_orientation_review_required','minimization_required','sensitive_text'];
   const code=e instanceof Error&&allowed.includes(e.message)?e.message:'review_unavailable';
   return Response.json({code,financialApproval:false,automaticRetryAllowed:false},{status:code==='forbidden'?403:code==='invalid_request'?400:409,headers});
  }
 };
}

export async function normalSelectedIds(request:Request):Promise<string[]>{const ids=request.method==='GET'?new URL(request.url).searchParams.getAll('documentId'):await(async()=>{const text=await request.clone().text();if(text.length>6000)throw Error('invalid_request');return JSON.parse(text).documentIds;})();if(!Array.isArray(ids)||ids.length<1||ids.length>8||ids.some(id=>!uuid(id))||new Set(ids).size!==ids.length)throw Error('document_selection_required');return ids;}
