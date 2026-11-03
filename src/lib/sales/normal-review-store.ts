import {documentLimits,legacyDocumentLimits} from './document-limits';
import type {TransmissionCeiling} from './normal-consent';
import type {SupabaseClient} from '@supabase/supabase-js';
import {sha} from '../admin/ai/review';
import type {NormalContext,NormalGrant,NormalRepository} from './normal-review';
const scopeHash=(c:NormalContext)=>sha(JSON.stringify(c.scope));
/** Existing server-only client. Proposed tables are inaccessible to browser roles.
 * Schema absence is explicit; never fall back to local memory or synthetic review storage. */
export function normalReviewRepository(db:SupabaseClient,ceiling:TransmissionCeiling|null=null):NormalRepository{
 const query=(table:string,c:NormalContext)=>db.from(table).select('*').eq('actor_id',c.scope.actorId).eq('customer_id',c.scope.customerId).eq('snapshot',c.snapshot).eq('scope_hash',scopeHash(c));
 return {
  async grant(c){if(!ceiling||ceiling.expiresAt<=Date.now())return null;
   const b=await db.from('sales_ai_budgets').select('id,owner_policy,policy_revision').eq('singleton',true).single();if(b.error||!b.data)throw Error('storage_not_connected');const p=b.data.owner_policy;
   if(!p?.active||p.expiresAt<=Date.now()||p.revision!==b.data.policy_revision||p.dataClass!==ceiling.dataClass||c.sources.some(s=>!ceiling.allowedMime.includes(s.mime)||!p.allowedMime?.includes(s.mime)||p.dataClass==='synthetic'&&(!p.allowedHashes?.includes(s.sha256)||!ceiling.allowedHashes.includes(s.sha256)))||!c.files||c.files.some(f=>!ceiling.allowedCategories.includes(f.category)||!p.allowedCategories?.includes(f.category)))return null;
   const r=await query('sales_ai_transmission_grants',c).eq('policy_revision',b.data.policy_revision).eq('active',true).gt('expires_at',new Date().toISOString()).maybeSingle();if(r.error)throw Error('storage_not_connected');if(!r.data)return null;const d=r.data;if(d.release?.mixed?.visuals?.length&&(ceiling.dataClass!=='synthetic'||ceiling.allowWholeVisual!==true||p.allowWholeVisual!==true))return null;if(d.release?.mixed){try{documentLimits(d.release.visualLimits??legacyDocumentLimits,ceiling.visualLimits??legacyDocumentLimits);if(d.max_request_bytes>(ceiling.visualLimits??legacyDocumentLimits).maxRequestBytes)return null;}catch{return null;}}return {visualLimits:d.release?.visualLimits,mixed:d.release?.mixed,visual:d.release?.visual,id:d.id,release:d.release,model:d.model,maxOutputTokens:d.max_output_tokens,maxRequestBytes:d.max_request_bytes,timeoutMs:d.timeout_ms} as NormalGrant;},
  async hasPrevious(c){const r=await db.from('sales_ai_jobs').select('id').eq('actor_id',c.scope.actorId).eq('customer_id',c.scope.customerId).neq('snapshot',c.snapshot).limit(1);if(r.error)throw Error('storage_not_connected');return !!r.data?.length;},
  async current(c){const r=await query('sales_ai_jobs',c).maybeSingle();if(r.error)throw Error('storage_not_connected');return r.data?{id:r.data.id,status:r.data.status,result:r.data.result}:null;},
  async reserve(c,g,key,binding){const r=await db.rpc('sales_ai_reserve',{p_grant:g.id,p_actor:c.scope.actorId,p_customer:c.scope.customerId,p_snapshot:c.snapshot,p_scope:scopeHash(c),p_key:key,p_binding:binding});if(r.error)throw Error('storage_not_connected');return typeof r.data==='string'?r.data:null;},
  async finish(c,id,result,diagnostic){const r=await db.rpc('sales_ai_finish',{p_job:id,p_actor:c.scope.actorId,p_customer:c.scope.customerId,p_snapshot:c.snapshot,p_scope:scopeHash(c),p_result:result,p_diagnostic:diagnostic??null});if(r.error||r.data!==true)throw Error('storage_not_connected');}
 };
}
