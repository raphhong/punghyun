import {createClient} from '@/lib/supabase/server';
import {actorSources} from '@/lib/admin/ai/sources';
import {handleAttachmentReview} from '@/lib/admin/ai/attachment-review';
import {extractPdfText} from '@/lib/admin/ai/pdf-text';
import {smokeEnvironment} from '@/lib/admin/ai/synthetic-smoke';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=60;
async function handle(request:Request,{params}:{params:Promise<{id:string}>}){
 const headers={'Cache-Control':'no-store'};
 try{
  if(request.method==='POST'&&request.headers.get('origin')!==new URL(request.url).origin)return Response.json({code:'forbidden'},{status:403,headers});
  const {id}=await params;if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))return Response.json({code:'invalid_request'},{status:400,headers});
  const db=await createClient(),auth=await db.auth.getUser();if(auth.error||!auth.data.user)return Response.json({code:'unauthorized'},{status:401,headers});
  const sources=actorSources(db,'zatlumldeqhghhrsgtdq',id,'synthetic-attachment-v98');await sources.scope();
  if(!smokeEnvironment(process.env))return Response.json({status:'waiting_provider',mode:'disconnected',facts:[],supplements:[],financialApproval:false},{status:503,headers});
  return await handleAttachmentReview(request,{env:process.env,...sources,extract:extractPdfText,rpc:async(action,documentId,cap,receipt,mac)=>{
   try{
    const r=await db.rpc('admin_ai_attachment_v98',{p_customer:id,p_document:documentId,p_action:action,p_cap:cap??null,p_receipt:receipt??null,p_mac:mac??null});
    if(r.error){if(r.error.code==='PGRST202'||r.error.code==='42883')throw Error('attachment_not_configured');throw Error(['forbidden','source_changed','synthetic_source_required','budget_exhausted','attachment_expired'].includes(r.error.message)?r.error.message:'repository_unavailable');}
    return r.data;
   }catch(e){throw Error(e instanceof Error&&['forbidden','source_changed','synthetic_source_required','budget_exhausted','attachment_expired','attachment_not_configured'].includes(e.message)?e.message:'repository_unavailable');}
  }});
 }catch(e){const code=e instanceof Error&&e.message==='forbidden'?'forbidden':'repository_unavailable';return Response.json({code,financialApproval:false},{status:code==='forbidden'?403:503,headers});}
}
export const GET=handle;
export const POST=handle;
