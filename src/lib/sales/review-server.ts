import type {SupabaseClient} from '@supabase/supabase-js';
import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {projectSalesFeedback,type SalesFeedback} from './review-feedback';
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
const canonical=(v:unknown):string=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
/** Local candidate: disabled until a separately approved, bounded RPC and deployment policy exist.
 * Uses current JWT/RLS, never a service-role client. RPC must recheck ownership, expiry,
 * revision, cancellation, source bytes pin and bounded approval before queueing. No model call here. */
export function createSalesReviewEndpoint(db:SupabaseClient,customerId:string,config:{enabled:boolean;feedbackKey?:string;automatic?:(ids:string[],execute:boolean,origin:string,signal:AbortSignal)=>Promise<Record<string,unknown>>}){
 return async(request:Request)=>{const headers={'Cache-Control':'no-store'};try{
  if(!uuid(customerId)||!['GET','POST'].includes(request.method))throw Error('invalid_request');
  const auth=await db.auth.getUser();if(auth.error||!auth.data.user)throw Error('forbidden');
  if(!config.enabled||!config.feedbackKey)throw Error('review_not_connected');
  let data:Record<string,unknown>={action:'read'};
  if(request.method==='POST'){
   if(request.headers.get('origin')!==new URL(request.url).origin)throw Error('forbidden');
   const text=await request.text();if(text.length>6000)throw Error('invalid_request');const v=JSON.parse(text);
   if(!v||!['request','cancel'].includes(v.action)||Object.keys(v).sort().join()!=='action,documentIds,idempotencyKey,revision,sourceSnapshot'||!Array.isArray(v.documentIds)||!v.documentIds.length||v.documentIds.length>8||v.documentIds.some((id:unknown)=>!uuid(id))||new Set(v.documentIds).size!==v.documentIds.length||!uuid(v.idempotencyKey)||!Number.isSafeInteger(v.revision)||v.revision<0||!/^[a-f0-9]{64}$/.test(v.sourceSnapshot))throw Error('invalid_request');data=v;
  }
  const r=await db.rpc('sales_review_feedback_v1',{p_customer:customerId,p_action:data.action,p_data:data.action==='read'?{}:data});
  if(r.error?.message==='forbidden')throw Error('forbidden');if(r.error||!r.data)throw Error('review_not_connected');
  const v=r.data;if(!uuid(v.agentId)||v.customerId!==customerId||typeof v.sourceSnapshot!=='string')throw Error('forbidden');
  // The limited RPC checks current session, direct assignment and pilot scope; no direct business-table read for sales.
  const again=await db.auth.getUser(),current=await db.rpc('sales_review_feedback_v1',{p_customer:customerId,p_action:'read',p_data:{}});
  if(again.error||again.data.user?.id!==auth.data.user.id||current.error||!current.data||current.data.agentId!==v.agentId||current.data.customerId!==customerId||current.data.sourceSnapshot!==v.sourceSnapshot)throw Error('forbidden');
  if(config.automatic&&data.action!=='cancel'){const result=await config.automatic(v.documentIds,data.action==='request',new URL(request.url).origin,request.signal);const latest=await db.rpc('sales_review_feedback_v1',{p_customer:customerId,p_action:'read',p_data:{}});if(latest.error||latest.data?.sourceSnapshot!==v.sourceSnapshot||latest.data?.agentId!==v.agentId)throw Error('forbidden');return Response.json({...result,sourceSnapshot:v.sourceSnapshot,revision:v.revision},{headers});}
  // Signed projection is separate from internal model receipts. Neither browser nor SQL claims a completed model run.
  if(!v.feedback){if(!['not_run','requested','running','failed','cancelled','unknown','stale'].includes(v.status)||!Number.isSafeInteger(v.revision))throw Error('invalid_feedback');return Response.json({status:v.status,sourceSnapshot:v.sourceSnapshot,revision:v.revision,issues:[],executionAllowed:false,requestAllowed:false,financialApproval:false},{headers});}
  if(typeof v.mac!=='string'||!/^[a-f0-9]{64}$/.test(v.mac))throw Error('feedback_unverified');
  const signed=createHmac('sha256',config.feedbackKey).update('sales-review-feedback-v1:'+canonical(v.feedback)).digest();if(!timingSafeEqual(Buffer.from(v.mac,'hex'),signed))throw Error('feedback_unverified');
  const result=projectSalesFeedback(v.feedback as SalesFeedback,v);
  return Response.json({...result,sourceSnapshot:v.sourceSnapshot,evidenceDigest:hash(canonical(v.feedback)),executionAllowed:false},{headers});
 }catch(e){const code=e instanceof Error&&['forbidden','invalid_request','review_not_connected','feedback_unverified','invalid_feedback'].includes(e.message)?e.message:'review_unavailable';return Response.json({code,financialApproval:false,automaticRetryAllowed:false},{status:code==='forbidden'?403:code==='invalid_request'?400:503,headers});}};
}
