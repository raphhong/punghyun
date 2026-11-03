import {salesModelFeedback} from './model-feedback';
import type {SupabaseClient} from '@supabase/supabase-js';
import {createBoundedReviewRuntime} from '../admin/ai/bounded-rpc';
import {readReviewResult} from '../admin/ai/presentation';
import type {Result} from '../admin/ai/review';
/** Current JWT and existing bounded approvals only. New uploads never inherit another file's release. */
export function salesAutomaticReview(input:{db:SupabaseClient;env:Record<string,string|undefined>;customerId:string;policyId:string;transport?:typeof fetch}){
 return async(ids:string[],execute:boolean,origin:string,signal:AbortSignal)=>{
  if(!Array.isArray(ids)||!ids.length||ids.length>8||new Set(ids).size!==ids.length)throw Error('invalid_request');
  const results:Result[]=[],ready:{id:string;binding:string}[]=[],blocked:{documentId:string;code:string}[]=[];
  const runtime=(id:string,expectedDocumentBinding?:string)=>createBoundedReviewRuntime({...input,expectedDocumentBinding,documentId:id,enabled:true,allowedDataClass:'synthetic',pilotPolicyId:input.policyId,access:'sales'});
  const url=(id:string)=>{const u=new URL('/api/sales-bounded-internal',origin);u.searchParams.set('documentId',id);return u;};
  const accept=(body:Record<string,unknown>)=>{if(body.receiptVerified!==true||body.persistedResult!==true)throw Error('review_pending');const result=readReviewResult(body);if(result.mode!=='live')throw Error('review_pending');results.push(result);};
  // Resolve every current document before dispatching any new request. No partial hidden paid batch.
  for(const id of ids){const response=await runtime(id)(new Request(url(id),{signal})),body=await response.json();
   if(!response.ok){blocked.push({documentId:id,code:['result_contract_unavailable','approval_required','source_changed','attachment_expired','budget_exhausted','provider_outcome_unknown','receipt_unverified'].includes(body.code)?body.code:'review_unavailable'});continue;}
   if(body.state==='ready'&&typeof body.documentBinding==='string'&&/^[a-f0-9]{64}$/.test(body.documentBinding)){ready.push({id,binding:body.documentBinding});continue;}
   if(body.state==='waiting_provider'){blocked.push({documentId:id,code:'waiting_provider'});continue;}accept(body);
  }
  if(execute&&blocked.length)throw Error('current_document_approval_required');
  if(execute)for(const item of ready){const run=runtime(item.id,item.binding),u=url(item.id);u.search='';const posted=await run(new Request(u,{method:'POST',headers:{origin:u.origin},body:JSON.stringify({documentIds:[item.id],key:'sales-'+item.binding}),signal}));if(!posted.ok)throw Error('review_pending');const loaded=await run(new Request(url(item.id),{signal}));if(!loaded.ok)throw Error('review_pending');accept(await loaded.json());}
  return {status:results.length?'needs_correction':'not_run',issues:salesModelFeedback(results,ids),documentStates:blocked,financialApproval:false,automaticRetryAllowed:false,executionAllowed:false,requestAllowed:!execute&&!blocked.length&&ready.length>0};
 };
}
