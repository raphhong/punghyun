import {salesAutomaticReview} from '@/lib/sales/review-automatic';
import {pilotConfiguration} from '@/lib/admin/ai/release-rpc';
import {createClient} from '@/lib/supabase/server';
import {createSalesReviewEndpoint} from '@/lib/sales/review-server';
export const dynamic='force-dynamic';export const runtime='nodejs';
/** Pending scoped RPC authorization. No environment flag can silently enable this unfinished deployment. */
async function handle(request:Request,{params}:{params:Promise<{id:string}>}){const db=await createClient(),id=(await params).id,pilot=pilotConfiguration(process.env);const enabled=process.env.SALES_AI_REVIEW_ENABLED==='bounded-sales-v1'&&pilot?.dataClass==='synthetic';return createSalesReviewEndpoint(db,id,{enabled,feedbackKey:process.env.OPENAI_API_KEY,...(enabled&&pilot?{automatic:salesAutomaticReview({db,env:process.env,customerId:id,policyId:pilot.id})}:{})})(request);}
export const GET=handle;export const POST=handle;
