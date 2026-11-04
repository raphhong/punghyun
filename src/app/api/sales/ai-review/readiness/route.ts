import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';
import {transmissionCeiling} from '@/lib/sales/normal-consent';
import {salesReviewReadiness} from '@/lib/sales/review-readiness';
export const dynamic='force-dynamic';
export async function GET(){
 const headers={'Cache-Control':'no-store'};
 try{const db=await createClient(),auth=await db.auth.getUser();if(auth.error||!auth.data.user)throw Error('forbidden');
 const agent=await db.from('sales_agents').select('id,status').eq('user_id',auth.data.user.id).maybeSingle();if(agent.error||agent.data?.status!=='approved')throw Error('forbidden');
 const admin=createAdminClient();
 const r=await admin.from('sales_ai_budgets').select('allocation_approved,allocation_expires_at,policy_revision,owner_policy,max_calls,reserved_calls,max_microusd,reserved_microusd').eq('singleton',true).single();
 const monthly=await admin.rpc('sales_ai_monthly_usage');
 if(r.error||monthly.error)throw Error('unavailable');
 return Response.json(salesReviewReadiness(r.data,transmissionCeiling(process.env),!!process.env.OPENAI_API_KEY,Date.now(),monthly.data),{headers});
 }catch{return Response.json({ready:false,reasons:['검수 준비 상태를 확인하지 못했습니다. 담당자 권한과 연결 상태를 확인하세요.'],notice:'고객파일이나 AI 제공자를 호출하지 않았습니다.'},{status:403,headers});}
}
