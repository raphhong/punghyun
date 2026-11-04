import {extractAdminBusinessFields} from '@/lib/admin/ai/admin-review-fields';
import {transmissionCeiling} from '@/lib/sales/normal-consent';
import {normalReviewEndpoint,normalSalesSources,normalSelectedIds} from '@/lib/sales/normal-review';
import {normalReviewRepository} from '@/lib/sales/normal-review-store';
import {createAdminClient} from '@/lib/supabase/admin';
import {withSalesContentReview} from '@/lib/sales/content-review';
import {salesReviewSources} from '@/lib/sales/review-sources';
import {salesAutomaticReview} from '@/lib/sales/review-automatic';
import {pilotConfiguration} from '@/lib/admin/ai/release-rpc';
import {createClient} from '@/lib/supabase/server';
import {createSalesReviewEndpoint} from '@/lib/sales/review-server';
export const dynamic='force-dynamic';export const runtime='nodejs';export const maxDuration=180;
/** Pending scoped RPC authorization. No environment flag can silently enable this unfinished deployment. */
async function handle(request:Request,{params}:{params:Promise<{id:string}>}){const db=await createClient(),id=(await params).id; if(process.env.SALES_AI_REVIEW_ENABLED==='normal-product-v1'){let ids:string[];try{ids=await normalSelectedIds(request);}catch{return Response.json({code:'document_selection_required',financialApproval:false},{status:400,headers:{'Cache-Control':'no-store'}});}const context=normalSalesSources(db,createAdminClient,id,ids);return normalReviewEndpoint({context,repository:normalReviewRepository(createAdminClient(),transmissionCeiling(process.env)),apiKey:process.env.OPENAI_API_KEY,...(transmissionCeiling(process.env)?.dataClass==='customer'?{extract:extractAdminBusinessFields}:{})})(request);} const pilot=pilotConfiguration(process.env);const enabled=process.env.SALES_AI_REVIEW_ENABLED==='bounded-sales-v1'&&pilot?.dataClass==='synthetic';const response=await createSalesReviewEndpoint(db,id,{enabled,feedbackKey:process.env.OPENAI_API_KEY,...(enabled&&pilot?{automatic:salesAutomaticReview({db,env:process.env,customerId:id,policyId:pilot.id})}:{})})(request);return withSalesContentReview(response,id,request.signal,{
 binding:async()=>{const r=await db.rpc('sales_review_feedback_v1',{p_customer:id,p_action:'read',p_data:{}});if(r.error||!r.data)throw Error('unavailable');return {customerId:r.data.customerId,sourceSnapshot:r.data.sourceSnapshot,documentIds:r.data.documentIds};},
 sources:async ids=>{const source=salesReviewSources(db,id,'sales-content-read',ids),scope=await source.scope();return source.sources(ids,scope);}
 });}
export const GET=handle;export const POST=handle;
