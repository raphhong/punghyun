import type {SupabaseClient} from '@supabase/supabase-js';
import {sha,reviewSourceSnapshot,type Source,type Scope} from './review';
import {sourceVersion} from './sources';
import {otherDocumentFilename} from '../other-document-path';
import type {NormalContext} from '../../sales/normal-review';
const uuid=(x:unknown):x is string=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(x);
export function adminReviewSources(db:SupabaseClient,storage:()=>SupabaseClient,customerId:string,selectedIds?:string[]){
 async function metadata(){
  if(!uuid(customerId))throw Error('invalid_request');
  const auth=await db.auth.getUser();if(auth.error||!auth.data.user)throw Error('forbidden');
  const admin=await db.from('admins').select('user_id').eq('user_id',auth.data.user.id).maybeSingle();
  if(admin.error||admin.data?.user_id!==auth.data.user.id)throw Error('forbidden');
  const customer=await db.from('customers').select('id,sales_agent_id').eq('id',customerId).maybeSingle();
  if(customer.error||!customer.data)throw Error('forbidden');
  const docs=await db.from('customer_documents').select('id,file_path,uploaded_at,device_id,category,doc_key').eq('customer_id',customerId).order('id');
  if(docs.error)throw Error('source_unavailable');
  const available=(docs.data??[]).filter(d=>d.file_path);
  if(selectedIds&&(selectedIds.length>8||new Set(selectedIds).size!==selectedIds.length||selectedIds.some(id=>!uuid(id)||!available.some(d=>d.id===id))))throw Error('source_changed');
  const rows=selectedIds?available.filter(d=>selectedIds.includes(d.id)):available;
  // The actor/assignment binding also invalidates results after reassignment.
  return {actor:auth.data.user.id,agent:admin.data.user_id,assignment:customer.data.sales_agent_id,rows};
 }
 return async():Promise<NormalContext>=>{
  const m=await metadata();if(m.rows.length>8)throw Error('document_selection_required');
  const sources:Source[]=[],excluded:{documentId:string;code:string}[]=[];
  for(const d of m.rows){
   if(typeof d.file_path!=='string'||!d.file_path.startsWith(customerId+'/')||d.file_path.split('/').some((part:string)=>part==='.'||part==='..')||/[\\%?#]/.test(d.file_path)||!d.uploaded_at)throw Error('source_changed');
   // These documents must never enter an automatic AI batch, even if upload itself is allowed.
   if(/rep_id|identity|id_card|resident|registration|passport|bank|account|health|medical|patient|신분|주민|여권|등본|통장|계좌|건강|진료/i.test(d.doc_key+' '+d.category)){excluded.push({documentId:d.id,code:'sensitive_document_not_sent'});continue;}
   if(JSON.stringify(m)!==JSON.stringify(await metadata()))throw Error('source_changed');
   const s=storage().storage.from('customer-docs');
   const info=await s.info(d.file_path);if(info.error||!info.data||typeof info.data.size!=='number'||info.data.size<1||info.data.size>8*1024*1024)throw Error('source_unavailable');
   const file=await s.download(d.file_path);if(file.error||!file.data||file.data.size>8*1024*1024)throw Error('source_unavailable');
   const bytes=new Uint8Array(await file.data.arrayBuffer()),hash=sha(bytes);
   sources.push({id:d.id,version:sourceVersion(d.uploaded_at,sha(d.file_path),hash),sha256:hash,bytes,customerId,assetId:d.device_id??null,mime:info.data.contentType??file.data.type});
  }
  const again=await metadata();if(JSON.stringify(m)!==JSON.stringify(again))throw Error('source_changed');
  const scope:Scope={actorId:m.actor,tenantId:'punghyun-admin-ai-v1',customerId,caseId:customerId,revision:sha(JSON.stringify([m.agent,m.assignment,m.rows]))};
  return {scope,sources,snapshot:reviewSourceSnapshot(scope,sources),excluded,files:m.rows.map(d=>({id:d.id,label:otherDocumentFilename(d.file_path),category:d.category}))};
 };
}
