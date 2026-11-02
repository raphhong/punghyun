import {createClient} from '@/lib/supabase/server';
import {createSalesReviewEndpoint} from '@/lib/sales/review-server';
export const dynamic='force-dynamic';export const runtime='nodejs';
/** Pending scoped RPC authorization. No environment flag can silently enable this unfinished deployment. */
async function handle(request:Request,{params}:{params:Promise<{id:string}>}){return createSalesReviewEndpoint(await createClient(),(await params).id,{enabled:false})(request);}
export const GET=handle;export const POST=handle;
