import {createAdminClient} from '@/lib/supabase/admin';
import {CUSTOMER_READ_FIELDS,customerReadPage} from '@/lib/admin/agent-read-gateway';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  return customerReadPage(request,{enabled:process.env.AGENT_READ_ENABLED,hash:process.env.AGENT_READ_TOKEN_SHA256,
    issued:process.env.AGENT_READ_ISSUED_AT,expires:process.env.AGENT_READ_EXPIRES_AT},async(after,limit)=>{
    let query=createAdminClient().from('customers').select(CUSTOMER_READ_FIELDS.join(',')).order('id',{ascending:true}).limit(limit);
    if(after)query=query.gt('id',after);
    const {data,error}=await query;if(error)throw new Error('read unavailable');return data;
  });
}
