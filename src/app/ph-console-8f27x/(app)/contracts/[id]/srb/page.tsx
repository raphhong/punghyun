import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SrbEditor } from '@/components/admin/srb/SrbEditor';
import type { Seed } from '@/lib/admin/srb/template';

export default async function Page({params}:{params:Promise<{id:string}>}){
  const {id}=await params;const db=await createClient();
  const {data:{user}}=await db.auth.getUser();if(!user)redirect('/ph-console-8f27x/login');
  const admin=await db.from('admins').select('user_id').eq('user_id',user.id).maybeSingle();
  if(admin.error||!admin.data)redirect('/sales');
  const [c,d]=await Promise.all([
    db.from('customers').select('id,hospital_name,representative,phone,email,hospital_type,contract_date,execution_amount,rental_price,rental_months').eq('id',id).maybeSingle(),
    db.from('customer_devices').select('model_name,quantity').eq('customer_id',id).order('sort_order'),
  ]);
  if(c.error||d.error)throw new Error('고객 또는 장비 정보를 불러오지 못했습니다.');
  if(!c.data)notFound();
  return <SrbEditor seed={{...c.data,devices:d.data||[]} as Seed}/>;
}
