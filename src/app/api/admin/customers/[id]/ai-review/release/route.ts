import {createClient} from '@/lib/supabase/server';
import {handleReleaseRoute} from '@/lib/admin/ai/release-rpc';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=180;
async function handle(request:Request,{params}:{params:Promise<{id:string}>}){
 try{return await handleReleaseRoute(request,(await params).id,await createClient(),process.env);}catch{return Response.json({code:'repository_unavailable',executionAllowed:false},{status:503,headers:{'Cache-Control':'no-store'}});}
}
export const GET=handle;
export const POST=handle;
