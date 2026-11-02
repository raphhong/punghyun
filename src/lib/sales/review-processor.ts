import type {SupabaseClient} from '@supabase/supabase-js';
import {createHmac} from 'node:crypto';
import {createBoundedReviewRuntime} from '../admin/ai/bounded-rpc';
import {actorSources} from '../admin/ai/sources';
import {canonicalAttachment} from '../admin/ai/attachment-review';
import {readReviewResult} from '../admin/ai/presentation';
import type {SalesFeedback,SalesIssue} from './review-feedback';
const uuid=(s:unknown):s is string=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s);
const allowed=new Set(['customer.name','purchase.total','rent.net','rent.vat','rent.total','period','asset.model','asset.serial','asset.quantity']);
/** Administrator-session processor: never impersonates the salesperson or changes JWT.
 * A sales request is NOT a release approval. The existing bounded runtime independently
 * requires the current administrator's source-bound release and atomic budget reservation.
 * No public/browser result is accepted as proof; only the runtime's freshly verified GET is used.
 */
export function createSalesReviewProcessor(input:{db:SupabaseClient;env:Record<string,string|undefined>;enabled:boolean;transport?:typeof fetch}){
 return async(request:Request,requestId:string)=>{
  const headers={'Cache-Control':'no-store'};
  try{
   if(!input.enabled||!input.env.OPENAI_API_KEY)throw Error('review_not_connected');
   if(request.method!=='POST'||request.headers.get('origin')!==new URL(request.url).origin||!uuid(requestId)||(await request.text()).trim()!=='{}')throw Error('forbidden');
   const auth=await input.db.auth.getUser();if(auth.error||!auth.data.user)throw Error('forbidden');
   const job=async()=>{const r=await input.db.rpc('admin_sales_review_job_v1',{p_request:requestId});if(r.error||!r.data)throw Error('forbidden');const v=r.data;if(!uuid(v.customerId)||!uuid(v.agentId)||!Array.isArray(v.documentIds)||!v.documentIds.length||v.documentIds.length>8||v.documentIds.some((id:unknown)=>!uuid(id))||!['requested','running','needs_correction','reviewed'].includes(v.status))throw Error('source_changed');return v;};
   const first=await job(),binding=canonicalAttachment(first),sources=actorSources(input.db,'zatlumldeqhghhrsgtdq',first.customerId,'sales-publication:'+requestId),scope=await sources.scope();
   const before=await sources.sources(first.documentIds,scope),results=[];
   for(const id of first.documentIds){
    if(canonicalAttachment(await job())!==binding)throw Error('source_changed');
    const runtime=createBoundedReviewRuntime({db:input.db,env:input.env,customerId:first.customerId,documentId:id,enabled:true,allowedDataClass:'synthetic',transport:input.transport});
    const url=new URL('/api/internal-bounded-review',request.url);url.searchParams.set('documentId',id);
    // Existing reservation is always queried before any dispatch. UNKNOWN is not retried.
    let response=await runtime(new Request(url,{signal:request.signal}));let body=await response.json();
    if(response.ok&&body.state==='ready'){
     url.search='';response=await runtime(new Request(url,{method:'POST',headers:{origin:url.origin,'Content-Type':'application/json'},body:JSON.stringify({documentIds:[id],key:'sales-'+requestId}),signal:request.signal}));body=await response.json();
     if(!response.ok)throw Error('review_pending');
     url.searchParams.set('documentId',id);response=await runtime(new Request(url,{signal:request.signal}));body=await response.json();
    }
    if(!response.ok||body.receiptVerified!==true||body.persistedResult!==true)throw Error('review_pending');
    // Runtime GET already authenticates receipt MAC, actor, release, original bytes and version.
    const {receiptVerified:_,persistedResult:__,usage:___,syntheticOnly:____,...raw}=body;void _;void __;void ___;void ____;
    const result=readReviewResult(raw);if(result.mode!=='live'||result.financialApproval!==false)throw Error('review_pending');results.push(result);
   }
   const after=await sources.sources(first.documentIds,scope);if(canonicalAttachment(before.map(s=>[s.id,s.version,s.sha256]))!==canonicalAttachment(after.map(s=>[s.id,s.version,s.sha256]))||canonicalAttachment(await job())!==binding)throw Error('source_changed');
   const facts=results.flatMap(r=>r.facts),issues:SalesIssue[]=[];
   for(const f of facts){if(!allowed.has(f.field))continue;const source=before.find(s=>s.id===f.sourceId);if(!source||source.sha256!==f.sha256||source.version!==f.version)throw Error('source_changed');
    const conflict=facts.some(g=>g.sourceId!==f.sourceId&&g.field===f.field&&g.assetId===f.assetId&&g.unit===f.unit&&g.vat===f.vat&&g.period===f.period&&g.value!==f.value);
    issues.push({sourceId:f.sourceId,field:f.field,state:conflict?'conflict':'unknown',quote:f.quote,locator:f.locator,action:''});
   }
   for(const s of results.flatMap(r=>r.supplements)){if(!allowed.has(s.field)||!before.some(source=>source.id===s.sourceId)||issues.some(i=>i.sourceId===s.sourceId&&i.field===s.field))continue;issues.push({sourceId:s.sourceId,field:s.field,state:s.kind,quote:'',locator:'',action:''});}
   if(issues.length>100)throw Error('review_pending');
   if(['needs_correction','reviewed'].includes(first.status))return Response.json({status:first.status,requestId,financialApproval:false,automaticRetryAllowed:false},{headers});
   const projection:SalesFeedback={customerId:first.customerId,agentId:first.agentId,sourceSnapshot:first.sourceSnapshot,sources:before.map(s=>({id:s.id,version:s.version,sha256:s.sha256})),status:'needs_correction',issues,revision:first.revision,financialApproval:false};
   const mac=createHmac('sha256',input.env.OPENAI_API_KEY).update('sales-review-feedback-v1:'+canonicalAttachment(projection)).digest('hex');
   const saved=await input.db.rpc('admin_sales_review_publish_v1',{p_request:requestId,p_projection:projection,p_mac:mac});if(saved.error)throw Error('source_changed');
   return Response.json({status:'needs_correction',requestId,financialApproval:false,automaticRetryAllowed:false},{headers});
  }catch(e){const code=e instanceof Error&&['forbidden','review_not_connected','review_pending','source_changed'].includes(e.message)?e.message:'review_unavailable';return Response.json({code,financialApproval:false,automaticRetryAllowed:false},{status:code==='forbidden'?403:code==='source_changed'?409:503,headers});}
 };
}
