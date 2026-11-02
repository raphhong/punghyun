import type {SupabaseClient} from '@supabase/supabase-js';
import {actorSources} from './sources';
import {handleAttachmentReview,canonicalAttachment,type AttachmentPin,type AttachmentPorts,type BudgetPolicy} from './attachment-review';
import {rangeMinimizer,type TextRelease} from './minimization';
import {extractPdfText} from './pdf-text';
import {sha} from './review';
import {smokeEnvironment} from './synthetic-smoke';
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const hex=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const allowed=['forbidden','source_changed','context_changed','attachment_expired','budget_exhausted','budget_reconciliation_required','receipt_conflict','invalid_request','approval_required'];
function safe(e:unknown){const m=e&&typeof e==='object'&&'message' in e?String(e.message):'';return allowed.includes(m)?m:'repository_unavailable';}
type Authorization={id:string;actorId:string;dataClass:'synthetic'|'customer';policyHash:string;release:TextRelease;maxAttempts:1;reserveMicrousd:500000;budget?:BudgetPolicy};
/** No new credential, default activation, service-role client, or direct DB connection.
 * db must be the current request's server SSR JWT client. Registration selection is server-owned,
 * NOT body/query JSON. Customer-data configuration needs a separate explicit release approval.
 * DB receipts are untrusted; the reused handler verifies server MAC + current bytes before returning. */
export function createBoundedReviewRuntime(input:{db:SupabaseClient;env:Record<string,string|undefined>;customerId:string;documentId:string;approvalId?:string;enabled:boolean;allowedDataClass:'synthetic'|'customer';transport?:typeof fetch;pilotPolicyId?:string}){
 return async(request:Request)=>{
  const headers={'Cache-Control':'no-store','Pragma':'no-cache'};
  try{
   if(input.pilotPolicyId!==undefined&&!uuid(input.pilotPolicyId))throw Error('forbidden');
   if(input.enabled!==true||!smokeEnvironment(input.env))throw Error('forbidden');
   if(!['GET','POST'].includes(request.method)||request.method==='POST'&&request.headers.get('origin')!==new URL(request.url).origin||![input.customerId,input.documentId].every(uuid)||input.approvalId!==undefined&&!uuid(input.approvalId))throw Error('forbidden');
   const auth=await input.db.auth.getUser();if(auth.error||!uuid(auth.data?.user?.id))throw Error('forbidden');const actorId=auth.data.user.id;let resolvedApproval=input.approvalId??null;
   async function rpc(action:'read'|'reserve'|'finish',cap?:string,receipt?:unknown,mac?:string){
    try{const r=await input.db.rpc(input.pilotPolicyId?'admin_bounded_review_v113':'admin_bounded_review_v104',{p_customer:input.customerId,p_document:input.documentId,p_approval:resolvedApproval,p_action:action,p_cap:cap??null,p_receipt:receipt??null,p_mac:mac??null});if(r.error)throw Error(safe(r.error));return r.data;}catch(e){throw Error(safe(e));}
   }
   const raw=await rpc('read');if(!raw||typeof raw!=='object'||Object.keys(raw).sort().join()!=='authorization,slot')throw Error('repository_unavailable');
   const a=raw.authorization as Authorization,pin=raw.slot?.pin as AttachmentPin;
   if(!a||Object.keys(a).sort().join()!==(input.pilotPolicyId?'actorId,budget,dataClass,id,maxAttempts,policyHash,release,reserveMicrousd':'actorId,dataClass,id,maxAttempts,policyHash,release,reserveMicrousd')||!uuid(a.id)||(input.approvalId!==undefined&&a.id!==input.approvalId)||a.actorId!==actorId||a.dataClass!==input.allowedDataClass||!['synthetic','customer'].includes(a.dataClass)||a.maxAttempts!==1||a.reserveMicrousd!==500000||!hex(a.policyHash)||!pin||pin.customerId!==input.customerId||pin.documentId!==input.documentId||pin.tenantId!=='zatlumldeqhghhrsgtdq')throw Error('forbidden');
   if(input.pilotPolicyId&&(!a.budget||a.budget.id!==input.pilotPolicyId||Object.keys(a.budget).sort().join()!=='id,maxAttempts,maxMicrousd,revision'||a.budget.maxAttempts>100||a.budget.maxMicrousd>20000000||a.budget.maxMicrousd<500000||![a.budget.revision,a.budget.maxAttempts,a.budget.maxMicrousd].every(n=>Number.isSafeInteger(n)&&n>0)))throw Error('forbidden');
   resolvedApproval=a.id;
   const authorizationHash=sha(canonicalAttachment(a));
   const base=actorSources(input.db,'zatlumldeqhghhrsgtdq',input.customerId,'bounded-review:'+a.id);
   const minimize=rangeMinimizer(a.release);
   const ports:AttachmentPorts={env:input.env,...base,extract:extractPdfText,transport:input.transport,async rpc(action,documentId,cap,receipt,mac){
    if(documentId!==input.documentId)throw Error('forbidden');const r=await rpc(action,cap,receipt,mac);
    if(!r||Object.keys(r).sort().join()!=='authorization,slot'||sha(canonicalAttachment(r.authorization))!==authorizationHash)throw Error('context_changed');return r.slot;
   }};
   return handleAttachmentReview(request,ports,{budget:a.budget,selectedFields:a.release.selectedFields,policy:'bounded-review-v104:'+a.id+':'+a.policyHash,syntheticOnly:a.dataClass==='synthetic',pin,minimize:async(segments,scope)=>{
    const selected=await minimize(segments,scope);if(Buffer.byteLength(JSON.stringify(selected))>8000)throw Error('minimization_required');return selected;
   }});
  }catch(e){const code=safe(e);return Response.json({code,financialApproval:false,automaticRetryAllowed:false},{headers,status:code==='forbidden'?403:code==='invalid_request'?400:code==='budget_exhausted'?429:['source_changed','context_changed','attachment_expired','receipt_conflict'].includes(code)?409:503});}
 };
}
