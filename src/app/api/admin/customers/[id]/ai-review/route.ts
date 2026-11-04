import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {adminReviewSources} from '@/lib/admin/ai/admin-review-sources';
import {extractAdminBusinessFields} from '@/lib/admin/ai/admin-review-fields';
import {normalReviewEndpoint,normalSelectedIds} from '@/lib/sales/normal-review';
import {normalReviewRepository} from '@/lib/sales/normal-review-store';
import {transmissionCeiling} from '@/lib/sales/normal-consent';
export const dynamic='force-dynamic';export const runtime='nodejs';export const maxDuration=180;
async function handle(request:Request,{params}:{params:Promise<{id:string}>}){
 try{if(request.method==='POST'&&request.headers.get('origin')!==new URL(request.url).origin)throw Error('forbidden');const db=await createClient(),ids=await normalSelectedIds(request),id=(await params).id;
 const context=adminReviewSources(db,createAdminClient,id,ids);
 // Verify current administrator before creating the privileged repository client.
 await context();
 const ceiling=transmissionCeiling(process.env);if(ceiling)ceiling.allowWholeVisual=false;
 return normalReviewEndpoint({context,repository:normalReviewRepository(createAdminClient(),ceiling),apiKey:process.env.OPENAI_API_KEY,extract:extractAdminBusinessFields})(request);
 }catch(e){return Response.json({code:e instanceof Error&&e.message==='forbidden'?'forbidden':'review_unavailable',financialApproval:false},{status:409,headers:{'Cache-Control':'no-store'}});}
}
export const GET=handle;export const POST=handle;
