import {createClient} from '@/lib/supabase/server';
import {createSalesReviewProcessor} from '@/lib/sales/review-processor';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=180;
export async function POST(request:Request,{params}:{params:Promise<{requestId:string}>}){
 const {requestId}=await params;
 // No activation in Preview: queue execution policy and added RPC need separate approval.
 return createSalesReviewProcessor({db:await createClient(),env:process.env,enabled:false})(request,requestId);
}
