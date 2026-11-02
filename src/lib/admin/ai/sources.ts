import type {SupabaseClient} from '@supabase/supabase-js';
import {sha,type Scope,type Source} from './review';
/** A bytes snapshot, NOT a claim of immutable Storage object versioning. */
export function sourceVersion(uploadedAt:string,pathHash:string,bytesHash:string){
 const time=Date.parse(uploadedAt);
 if(!Number.isFinite(time)||![pathHash,bytesHash].every(v=>/^[a-f0-9]{64}$/.test(v)))throw Error('source_changed');
 return JSON.stringify([time,pathHash,bytesHash]);
}
/** Current actor only; no service-role client, URLs or keys in returned source metadata. */
export function actorSources(db:SupabaseClient,tenantId:string,customerId:string,caseId:string){
 if(!tenantId||!customerId||!caseId)throw Error('scope_configuration');
 async function scope():Promise<Scope>{
  try{
   const auth=await db.auth.getUser();if(auth.error||!auth.data.user)throw Error('forbidden');
   const admin=await db.from('admins').select('user_id').eq('user_id',auth.data.user.id).maybeSingle();
   const customer=await db.from('customers').select('id').eq('id',customerId).maybeSingle();
   if(admin.error||!admin.data||customer.error||!customer.data)throw Error('forbidden');
   return {actorId:auth.data.user.id,tenantId,customerId,caseId,revision:sha(JSON.stringify([auth.data.user.id,tenantId,customerId,caseId]))};
  }catch{throw Error('forbidden');}
 }
 return {scope,async sources(ids:string[],expected:Scope):Promise<Source[]>{
  try{
   if(!Array.isArray(ids)||ids.length<1||ids.length>8||new Set(ids).size!==ids.length)throw Error('source_changed');
   if(JSON.stringify(await scope())!==JSON.stringify(expected))throw Error('context_changed');
   const rows=await db.from('customer_documents').select('id,customer_id,device_id,file_path,uploaded_at').eq('customer_id',customerId).in('id',ids);
   if(rows.error||!rows.data||rows.data.length!==ids.length)throw Error('source_changed');
   const result:Source[]=[];
   for(const row of rows.data){
    if(!ids.includes(row.id)||row.customer_id!==customerId||typeof row.file_path!=='string'||!row.file_path||!row.uploaded_at)throw Error('source_changed');
    if(row.device_id){const device=await db.from('customer_devices').select('id').eq('id',row.device_id).eq('customer_id',customerId).maybeSingle();if(device.error||!device.data)throw Error('source_changed');}
    const blob=await db.storage.from('customer-docs').download(row.file_path);
    if(blob.error||!blob.data||blob.data.size>8*1024*1024)throw Error('source_unavailable');
    const bytes=new Uint8Array(await blob.data.arrayBuffer()),hash=sha(bytes);
    result.push({id:row.id,version:sourceVersion(row.uploaded_at,sha(row.file_path),hash),sha256:hash,bytes,customerId,assetId:row.device_id??null,mime:blob.data.type});
   }
   if(JSON.stringify(await scope())!==JSON.stringify(expected))throw Error('context_changed');
   return result;
  }catch(e){throw Error(e instanceof Error&&['forbidden','context_changed','source_changed'].includes(e.message)?e.message:'source_unavailable');}
 }};
}
