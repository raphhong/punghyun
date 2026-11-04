import {extractAdminBusinessFields} from '@/lib/admin/ai/admin-review-fields';
import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {normalSalesSources,normalSelectedIds} from '@/lib/sales/normal-review';
import {normalConsentEndpoint,normalConsentStore,transmissionCeiling} from '@/lib/sales/normal-consent';
export const dynamic='force-dynamic';export const runtime='nodejs';export const maxDuration=180;
async function handle(request:Request,{params}:{params:Promise<{id:string}>}){
 const headers={'Cache-Control':'no-store'};
 if(process.env.SALES_AI_REVIEW_ENABLED!=='normal-product-v1')return Response.json({code:'review_not_connected'},{status:503,headers});
 try{const id=(await params).id,ids=await normalSelectedIds(request),db=await createClient();return normalConsentEndpoint({context:normalSalesSources(db,createAdminClient,id,ids),store:normalConsentStore(createAdminClient()),ceiling:transmissionCeiling(process.env),...(transmissionCeiling(process.env)?.dataClass==='customer'?{extract:extractAdminBusinessFields}:{})})(request);}catch{return Response.json({code:'document_selection_required'},{status:400,headers});}
}
export const GET=handle;export const POST=handle;
