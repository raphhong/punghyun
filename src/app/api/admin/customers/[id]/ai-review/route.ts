import {createBoundedReviewEndpoint} from '@/lib/admin/ai/bounded-http';
import {createClient} from '@/lib/supabase/server';
import {actorSources} from '@/lib/admin/ai/sources';
import {handleAttachmentReview} from '@/lib/admin/ai/attachment-review';
import {extractPdfText} from '@/lib/admin/ai/pdf-text';
import {smokeEnvironment} from '@/lib/admin/ai/synthetic-smoke';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=180;
async function handle(request:Request,{params}:{params:Promise<{id:string}>}){
 const headers={'Cache-Control':'no-store'};
 try{
  if(request.method==='POST'&&request.headers.get('origin')!==new URL(request.url).origin)return Response.json({code:'forbidden'},{status:403,headers});
  const url=new URL(request.url),paths=url.searchParams.getAll('reviewPath');
  if(paths.length>1||paths.length===1&&paths[0]!=='registered')return Response.json({code:'invalid_request'},{status:400,headers});
  const registered=paths[0]==='registered';url.searchParams.delete('reviewPath');
  const forwarded=registered?new Request(url,request):request;
  const {id}=await params;if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))return Response.json({code:'invalid_request'},{status:400,headers});
  const db=await createClient(),auth=await db.auth.getUser();if(auth.error||!auth.data.user)return Response.json({code:'unauthorized'},{status:401,headers});
  const sources=actorSources(db,'zatlumldeqhghhrsgtdq',id,'synthetic-attachment-v98');await sources.scope();
  if(!smokeEnvironment(process.env))return Response.json({status:'waiting_provider',mode:'disconnected',facts:[],supplements:[],financialApproval:false},{status:503,headers});
  // Explicit path selection is not authorization. Only an active, source-bound DB registration authorizes the new path.
  // Never retry or fall back to the historical dispatcher when the registered path refuses a request.
  if(registered)return await createBoundedReviewEndpoint({db,env:process.env,customerId:id,enabled:true,allowedDataClass:'synthetic'})(forwarded);
  return await handleAttachmentReview(request,{env:process.env,...sources,extract:extractPdfText,observe:event=>console.info(JSON.stringify({kind:'attachment_trial_stage',...event})),rpc:async(action,documentId,cap,receipt,mac)=>{
   try{
    const r=await db.rpc('admin_ai_attachment_v101',{p_customer:id,p_document:documentId,p_action:action,p_cap:cap??null,p_receipt:receipt??null,p_mac:mac??null});
    if(r.error){if(r.error.code==='PGRST202'||r.error.code==='42883')throw Error('attachment_not_configured');throw Error(['forbidden','source_changed','synthetic_source_required','budget_exhausted','attachment_expired'].includes(r.error.message)?r.error.message:'repository_unavailable');}
    return r.data;
   }catch(e){throw Error(e instanceof Error&&['forbidden','source_changed','synthetic_source_required','budget_exhausted','attachment_expired','attachment_not_configured'].includes(e.message)?e.message:'repository_unavailable');}
  }});
 }catch(e){const code=e instanceof Error&&e.message==='forbidden'?'forbidden':'repository_unavailable';return Response.json({code,financialApproval:false},{status:code==='forbidden'?403:503,headers});}
}
export const GET=handle;
export const POST=handle;
