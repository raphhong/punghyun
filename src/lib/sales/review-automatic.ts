import type {SupabaseClient} from '@supabase/supabase-js';
import {createBoundedReviewRuntime} from '../admin/ai/bounded-rpc';
import {readReviewResult} from '../admin/ai/presentation';
/** Explicit server composition only. The actor remains the salesperson throughout.
 * Registered release, original bytes and shared durable budget are checked by the bounded runtime. */
export function salesAutomaticReview(input:{db:SupabaseClient;env:Record<string,string|undefined>;customerId:string;policyId:string;transport?:typeof fetch}){
 return async(ids:string[],execute:boolean,origin:string,signal:AbortSignal)=>{
  if(!Array.isArray(ids)||!ids.length||ids.length>8||new Set(ids).size!==ids.length)throw Error('invalid_request');
  const results=[],ready:string[]=[];
  for(const id of ids){const runtime=createBoundedReviewRuntime({...input,documentId:id,enabled:true,allowedDataClass:'synthetic',pilotPolicyId:input.policyId,access:'sales'});const u=new URL('/api/sales-bounded-internal',origin);u.searchParams.set('documentId',id);
   let response=await runtime(new Request(u,{signal})),body=await response.json();
   if(response.ok&&body.state==='ready'){ready.push(id);if(!execute)continue;u.search='';response=await runtime(new Request(u,{method:'POST',headers:{origin:u.origin},body:JSON.stringify({documentIds:[id],key:'sales-'+id}),signal}));body=await response.json();if(!response.ok)throw Error('review_pending');u.searchParams.set('documentId',id);response=await runtime(new Request(u,{signal}));body=await response.json();}
   if(!response.ok||body.receiptVerified!==true||body.persistedResult!==true)throw Error('review_pending');const result=readReviewResult(body);if(result.mode!=='live')throw Error('review_pending');results.push(result);
  }
  const facts=results.flatMap(r=>r.facts),issues=facts.map(f=>({sourceId:f.sourceId,field:f.field,state:facts.some(g=>g.sourceId!==f.sourceId&&g.field===f.field&&g.assetId===f.assetId&&g.unit===f.unit&&g.vat===f.vat&&g.period===f.period&&g.value!==f.value)?'conflict':'unknown',quote:f.quote,locator:f.locator,action:'AI가 읽은 내용입니다. 원문과 대조하고 다르거나 불명확한 자료를 수정해 주세요.'}));
  for(const s of results.flatMap(r=>r.supplements)){if(!ids.includes(s.sourceId)||issues.some(i=>i.sourceId===s.sourceId&&i.field===s.field))continue;issues.push({sourceId:s.sourceId,field:s.field,state:s.kind,quote:'',locator:'',action:s.kind==='unreadable'?'판독이 어렵습니다. 선명한 원문으로 교체해 주세요.':'자료에서 확인되지 않았습니다. 원문이나 다른 근거를 확인해 주세요.'});}
  return {status:results.length?'needs_correction':'not_run',issues,financialApproval:false,automaticRetryAllowed:false,executionAllowed:false,requestAllowed:!execute&&ready.length>0};
 };
}
