import {createClient} from '@/lib/supabase/server';
import {redirect} from 'next/navigation';
import SyntheticSmokePanel from '@/components/admin/contract/SyntheticSmokePanel';
export const dynamic='force-dynamic';
export default async function Page(){const db=await createClient(),r=await db.auth.getUser();if(r.error||!r.data.user)redirect('/ph-console-8f27x/login');const a=await db.from('admins').select('user_id').eq('user_id',r.data.user.id).maybeSingle();if(a.error||!a.data)redirect('/ph-console-8f27x/login');return <SyntheticSmokePanel/>;}
