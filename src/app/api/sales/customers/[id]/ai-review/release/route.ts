import {createClient} from '@/lib/supabase/server';
import {createReleaseRpcEndpoint,pilotConfiguration} from '@/lib/admin/ai/release-rpc';
export const dynamic='force-dynamic';export const runtime='nodejs';
async function handle(request:Request,{params}:{params:Promise<{id:string}>}){
 try{const pilot=pilotConfiguration(process.env);if(process.env.SALES_AI_REVIEW_ENABLED!=='bounded-sales-v1'||pilot?.dataClass!=='synthetic')throw Error('forbidden');
 const url=new URL(request.url),body=request.method==='POST'?await request.clone().json():null;const documentId=url.searchParams.get('document')??url.searchParams.get('documentId')??body?.documentId;
 if(typeof documentId!=='string'||!/^[a-f0-9-]{36}$/i.test(documentId))throw Error('forbidden');url.searchParams.delete('document');
 return createReleaseRpcEndpoint(await createClient(),(await params).id,documentId,pilot,undefined,'sales')(new Request(url,request));
 }catch{return Response.json({code:'review_not_connected',executionAllowed:false},{status:503,headers:{'Cache-Control':'no-store'}});}
}
export const GET=handle;export const POST=handle;
