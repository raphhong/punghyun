import type {SupabaseClient} from '@supabase/supabase-js';
import {sha,type Scope,type Source} from '../admin/ai/review';
import {sourceVersion} from '../admin/ai/sources';
/** Current salesperson JWT and protected Storage only. No service client or admin session. */
export function salesReviewSources(db:SupabaseClient,customerId:string,caseId:string,ids:string[]){
 async function context(){const a=await db.auth.getUser();if(a.error||!a.data.user)throw Error('forbidden');const r=await db.rpc('sales_review_sources_v1',{p_customer:customerId,p_docs:ids});const c=r.data;if(r.error||!c||c.actor!==a.data.user.id||c.customer!==customerId||typeof c.tenant!=='string'||!c.tenant||!Array.isArray(c.sources)||c.sources.length!==ids.length)throw Error('forbidden');return c;}
 async function scope():Promise<Scope>{const c=await context();return {actorId:c.actor,tenantId:'zatlumldeqhghhrsgtdq',customerId,caseId,revision:sha(JSON.stringify([c.actor,'zatlumldeqhghhrsgtdq',customerId,caseId]))};}
 return {scope,async sources(requested:string[],expected:Scope):Promise<Source[]>{
  if(JSON.stringify([...requested].sort())!==JSON.stringify([...ids].sort())||JSON.stringify(await scope())!==JSON.stringify(expected))throw Error('context_changed');const c=await context(),out:Source[]=[];
  for(const row of c.sources){if(!Array.isArray(row)||row.length!==7||!requested.includes(row[0])||typeof row[2]!=='string'||!row[2]||!row[3]||!row[4]||!row[5])throw Error('source_changed');const r=await db.storage.from('customer-docs').download(row[2]);if(r.error||!r.data||r.data.size>8*1024*1024)throw Error('source_unavailable');const bytes=new Uint8Array(await r.data.arrayBuffer()),hash=sha(bytes);out.push({id:row[0],customerId,assetId:row[1]??null,version:sourceVersion(row[3],sha(row[2]),hash),sha256:hash,bytes,mime:r.data.type});}
  if(JSON.stringify(await context())!==JSON.stringify(c)||JSON.stringify(await scope())!==JSON.stringify(expected))throw Error('source_changed');return out;
 }};
}
