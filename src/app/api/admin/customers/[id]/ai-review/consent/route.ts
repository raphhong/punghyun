import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {adminReviewSources} from '@/lib/admin/ai/admin-review-sources';
import {extractAdminBusinessFields} from '@/lib/admin/ai/admin-review-fields';
import {normalSelectedIds} from '@/lib/sales/normal-review';
import {normalConsentEndpoint,normalConsentStore,transmissionCeiling} from '@/lib/sales/normal-consent';
export const dynamic='force-dynamic';export const runtime='nodejs';export const maxDuration=180;
async function handle(request:Request,{params}:{params:Promise<{id:string}>}){
 try{if(request.method==='POST'&&request.headers.get('origin')!==new URL(request.url).origin)throw Error('forbidden');const db=await createClient(),ids=await normalSelectedIds(request),id=(await params).id;
 const context=adminReviewSources(db,createAdminClient,id,ids);await context();
 const ceiling=transmissionCeiling(process.env);if(ceiling)ceiling.allowWholeVisual=false;
 return normalConsentEndpoint({context,store:normalConsentStore(createAdminClient()),ceiling,extract:extractAdminBusinessFields})(request);
 }catch(e){return Response.json({code:e instanceof Error&&e.message==='forbidden'?'forbidden':'consent_unavailable',saved:false},{status:409,headers:{'Cache-Control':'no-store'}});}
}
export const GET=handle;export const POST=handle;
