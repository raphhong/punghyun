import {createClient} from '@/lib/supabase/server';
import {bizmarketEndpoint} from '@/lib/admin/bizmarket/server';
export const dynamic='force-dynamic';
export const runtime='nodejs';
async function handle(request:Request,{params}:{params:Promise<{id:string}>}){return bizmarketEndpoint(await createClient(),(await params).id)(request);}
export const GET=handle;
export const POST=handle;
