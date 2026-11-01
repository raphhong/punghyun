import {createClient} from '@/lib/supabase/server';
import {handleSyntheticSmoke,smokeEnvironment} from '@/lib/admin/ai/synthetic-smoke';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=60;
async function handle(request:Request){
 if(!smokeEnvironment(process.env))return Response.json({code:'smoke_not_enabled'},{status:503,headers:{'Cache-Control':'no-store'}});
 try{const db=await createClient();return await handleSyntheticSmoke(request,{env:process.env,actor:async()=>{const r=await db.auth.getUser();if(r.error||!r.data.user)throw Error('unauthorized');return r.data.user.id;},rpc:async reserve=>{const r=await db.rpc('admin_ai_smoke_v92',{p_reserve:reserve});if(r.error){const code=['forbidden','invalid_request','smoke_expired','smoke_unavailable'].find(x=>x===r.error.message);throw Error(code??'smoke_unavailable');}return r.data;}});}catch{return Response.json({code:'smoke_unavailable',automaticRetryAllowed:false},{status:503,headers:{'Cache-Control':'no-store'}});}
}
export const GET=handle;
export const POST=handle;
