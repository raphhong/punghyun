import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {normalConsentStore,ownerPolicy,transmissionCeiling} from '@/lib/sales/normal-consent';
export const dynamic='force-dynamic';export const runtime='nodejs';
async function handle(request:Request){const headers={'Cache-Control':'no-store'};try{
 const db=await createClient();const auth=await db.auth.getUser();if(auth.error||!auth.data.user)throw Error('forbidden');const actor=auth.data.user.id;
 const check=async()=>{const a=await db.auth.getUser();if(a.error||a.data.user?.id!==actor)throw Error('forbidden');const role=await db.from('admins').select('user_id').eq('user_id',actor).maybeSingle();if(role.error||!role.data)throw Error('forbidden');};await check();
 const store=normalConsentStore(createAdminClient()),record=await store.policy(),ceiling=transmissionCeiling(process.env);
 if(request.method==='GET')return Response.json({record,ceiling,model:'gpt-5.4-2026-03-05',reservationUsd:0.50,budgetEditable:false},{headers});
 if(request.method!=='POST'||request.headers.get('origin')!==new URL(request.url).origin)throw Error('forbidden');
 const text=await request.text();if(text.length>6000)throw Error('invalid_policy');const b=JSON.parse(text);if(b.revision!==record.revision)throw Error('policy_changed');
 const next=b.action==='revoke'&&record.policy?{...record.policy,revision:record.revision+1,active:false}:ceiling?ownerPolicy(b.policy,record,ceiling):null;
 if(!next)throw Error('transmission_policy_not_configured');await check();await store.savePolicy(record,next);await check();return Response.json({saved:true,record:await store.policy()},{headers});
 }catch(e){const code=e instanceof Error&&['forbidden','invalid_policy','policy_changed','storage_not_connected','transmission_policy_not_configured'].includes(e.message)?e.message:'policy_unavailable';return Response.json({code},{status:code==='forbidden'?403:409,headers});}}
export const GET=handle;export const POST=handle;
