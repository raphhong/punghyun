import {GET as readCurrent} from '../route';
import {createSalesReviewContextEndpoint} from '@/lib/sales/review-context';
export const dynamic='force-dynamic';
export const runtime='nodejs';
/** Read only. No history/requirements DB permission exists yet; report not_connected. */
export async function GET(request:Request,context:{params:Promise<{id:string}>}){
 const {id}=await context.params;
 return createSalesReviewContextEndpoint(()=>readCurrent(request,{params:Promise.resolve({id})}),id)();
}
