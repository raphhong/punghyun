import {createClient} from '@/lib/supabase/server';
import {createVisionEndpoint} from '@/lib/admin/ai/vision-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=90;
async function handle(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 return createVisionEndpoint({db:await createClient(),env:process.env,customerId:id})(request);
}
export const GET=handle;
export const POST=handle;
