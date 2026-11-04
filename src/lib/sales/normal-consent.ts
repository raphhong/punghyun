import {documentLimits,legacyDocumentLimits,type DocumentLimits} from './document-limits';
import {inspectMixed,mixedPreviewHash,prepareMixedRequest} from './normal-mixed';
import type {SupabaseClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {sha,type Segment} from '../admin/ai/review';
import {extractDocument} from '../admin/ai/document-extraction';
import {rangeMinimizer} from '../admin/ai/minimization';
import {buildTextTransmissionGrant,textTransmissionPreview,type OwnerTransmissionPolicy,type ReviewConsent} from './transmission-policy';
import type {NormalContext,NormalGrant} from './normal-review';
export type PolicyRecord={id:string;revision:number;policy:OwnerTransmissionPolicy|null};
export type TransmissionCeiling={maxTextOutputTokens?:number;visualLimits?:DocumentLimits;allowWholeVisual?:boolean;dataClass:'synthetic'|'customer';allowedMime:string[];allowedCategories:string[];allowedHashes:string[];expiresAt:number};
const sensitive=/identity|id_card|resident|passport|신분|주민|여권/i;
/** Trusted deployment config, not a user-editable claim. Missing config never authorizes data. */
export function transmissionCeiling(env:Record<string,string|undefined>):TransmissionCeiling|null{
 try{const c=JSON.parse(env.SALES_AI_TRANSMISSION_CEILING??'null');if(!c||!['synthetic','customer'].includes(c.dataClass)||!Number.isSafeInteger(c.expiresAt)||c.expiresAt<=Date.now()||!Array.isArray(c.allowedMime)||!c.allowedMime.length||c.allowedMime.some((x:unknown)=>!['image/png','image/jpeg','application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(String(x)))||!Array.isArray(c.allowedCategories)||!c.allowedCategories.length||c.allowedCategories.some((x:unknown)=>typeof x!=='string'||sensitive.test(x))||!Array.isArray(c.allowedHashes)||c.allowedHashes.some((x:unknown)=>typeof x!=='string'||!/^[a-f0-9]{64}$/.test(x))||c.dataClass==='synthetic'&&!c.allowedHashes.length)return null;if(c.allowWholeVisual!==undefined&&typeof c.allowWholeVisual!=='boolean'||c.allowWholeVisual===true&&c.dataClass!=='synthetic')return null;if(c.maxTextOutputTokens!==undefined&&(!Number.isSafeInteger(c.maxTextOutputTokens)||c.maxTextOutputTokens<1||c.maxTextOutputTokens>4000||c.dataClass!=='synthetic'))return null;if(c.visualLimits!==undefined)c.visualLimits=documentLimits(c.visualLimits);return c;}catch{return null;}
}
export function ownerPolicy(input:unknown,record:PolicyRecord,ceiling:TransmissionCeiling):OwnerTransmissionPolicy{
 const p=input as OwnerTransmissionPolicy;
 const textLimit=ceiling.maxTextOutputTokens===undefined?1000:ceiling.maxTextOutputTokens;
 if(!Number.isSafeInteger(textLimit)||textLimit<1||textLimit>4000||ceiling.maxTextOutputTokens!==undefined&&ceiling.dataClass!=='synthetic')throw Error('invalid_policy');
 if(!p||typeof p.active!=='boolean'||!Number.isSafeInteger(p.expiresAt)||p.expiresAt<=Date.now()||p.expiresAt>ceiling.expiresAt||!Array.isArray(p.allowedMime)||!p.allowedMime.length||p.allowedMime.some(x=>!ceiling.allowedMime.includes(x))||!Array.isArray(p.allowedCategories)||!p.allowedCategories.length||p.allowedCategories.some(x=>!ceiling.allowedCategories.includes(x))||!Number.isSafeInteger(p.maxDocuments)||p.maxDocuments<1||p.maxDocuments>8)throw Error('invalid_policy');
 if(p.allowWholeVisual===true&&(ceiling.allowWholeVisual!==true||ceiling.dataClass!=='synthetic'))throw Error('invalid_policy');
 return {visualLimits:ceiling.visualLimits??legacyDocumentLimits,allowWholeVisual:p.allowWholeVisual===true,id:record.id,revision:record.revision+1,active:p.active,dataClass:ceiling.dataClass,provider:'openai',model:'gpt-5.4-2026-03-05',expiresAt:p.expiresAt,allowedMime:[...new Set(p.allowedMime)],allowedCategories:[...new Set(p.allowedCategories)],allowedHashes:[...ceiling.allowedHashes],maxDocuments:p.maxDocuments,maxOutputTokens:p.allowWholeVisual===true?1000:textLimit,maxRequestBytes:p.allowWholeVisual===true?(ceiling.visualLimits??legacyDocumentLimits).maxRequestBytes:16000,timeoutMs:30000};
}
export function normalConsentStore(server:SupabaseClient){
 return {
  async policy():Promise<PolicyRecord>{const r=await server.from('sales_ai_budgets').select('id,policy_revision,owner_policy').eq('singleton',true).single();if(r.error||!r.data)throw Error('storage_not_connected');return {id:r.data.id,revision:r.data.policy_revision,policy:r.data.owner_policy};},
  async savePolicy(before:PolicyRecord,policy:OwnerTransmissionPolicy){const r=await server.from('sales_ai_budgets').update({owner_policy:policy,policy_revision:policy.revision}).eq('id',before.id).eq('policy_revision',before.revision).select('id').maybeSingle();if(r.error||!r.data)throw Error('policy_changed');},
  async register(c:NormalContext,record:PolicyRecord,grant:NormalGrant,consent:ReviewConsent){
   const row={id:grant.id,budget_id:record.id,policy_revision:record.revision,actor_id:c.scope.actorId,customer_id:c.scope.customerId,snapshot:c.snapshot,scope_hash:sha(JSON.stringify(c.scope)),active:true,expires_at:new Date(grant.release.expiresAt).toISOString(),release:{...grant.release,...(grant.mixed?{mixed:grant.mixed,visualLimits:grant.visualLimits}:{})},consent,model:grant.model,max_output_tokens:grant.maxOutputTokens,max_request_bytes:grant.maxRequestBytes,timeout_ms:grant.timeoutMs,reserve_microusd:500000};
   const saved=await server.from('sales_ai_transmission_grants').insert(row);if(saved.error){const existing=await server.from('sales_ai_transmission_grants').select('id,release,consent,active').eq('actor_id',row.actor_id).eq('customer_id',row.customer_id).eq('snapshot',row.snapshot).eq('scope_hash',row.scope_hash).eq('policy_revision',row.policy_revision).maybeSingle();if(existing.error||!existing.data?.active||existing.data.consent?.previewHash!==consent.previewHash||existing.data.release?.expiresAt<=Date.now())throw Error('consent_not_saved');return existing.data.id as string;}return grant.id;
  },
  async revoke(id:string,c:NormalContext){const r=await server.rpc('sales_ai_revoke_consent',{p_grant:id,p_actor:c.scope.actorId,p_customer:c.scope.customerId,p_snapshot:c.snapshot,p_scope:sha(JSON.stringify(c.scope))});if(r.error||r.data!==true)throw Error('consent_not_saved');}
 };
}
export type ConsentStore=ReturnType<typeof normalConsentStore>;
export async function consentPreview(c:NormalContext,record:PolicyRecord,ceiling:TransmissionCeiling,extract:(s:NormalContext['sources'][number])=>Promise<Segment[]>=async s=>(await extractDocument(s)).segments){
 const policy=record.policy;if(!policy||policy.revision!==record.revision||!policy.active||policy.expiresAt<=Date.now()||policy.dataClass!==ceiling.dataClass||policy.allowedMime.some(x=>!ceiling.allowedMime.includes(x))||policy.allowedCategories?.some(x=>!ceiling.allowedCategories.includes(x))||policy.allowedHashes?.some(x=>!ceiling.allowedHashes.includes(x)))throw Error('transmission_policy_required');
 if(policy.dataClass==='synthetic'&&(!policy.allowedHashes?.length||policy.allowedHashes.some(h=>!ceiling.allowedHashes.includes(h))))throw Error('transmission_policy_required');
 if(c.excluded?.length||c.sources.length<1||c.sources.length>policy.maxDocuments)throw Error('document_selection_required');
 if(c.sources.some(s=>!policy.allowedMime.includes(s.mime)||policy.allowedHashes?.length&&!policy.allowedHashes.includes(s.sha256)))throw Error('transmission_policy_required');
 if(!c.files||c.files.some(f=>!policy.allowedCategories?.includes(f.category)||sensitive.test(f.category)))throw Error('transmission_policy_required');
 if(policy.allowWholeVisual===true)documentLimits(policy.visualLimits??legacyDocumentLimits,ceiling.visualLimits??legacyDocumentLimits);
 const expiresAt=Math.min(policy.expiresAt,ceiling.expiresAt,Date.now()+3600000);
 const inspected=await inspectMixed(c,policy.allowWholeVisual===true&&ceiling.allowWholeVisual===true&&policy.dataClass==='synthetic',expiresAt,extract);
 const {segments,manifest,disclosures}=inspected;
 const mixed=manifest.visuals.length>0||manifest.unreadable.length>0;
 let executable=segments.length>0||manifest.visuals.length>0;
 let blockingReason:string|null=null;

 const consent:ReviewConsent={actorId:c.scope.actorId,customerId:c.scope.customerId,snapshot:c.snapshot,previewHash:mixed?mixedPreviewHash(c,segments,manifest):textTransmissionPreview(c,segments),policyId:policy.id,policyRevision:policy.revision,confirmed:true,expiresAt:Math.min(policy.expiresAt,ceiling.expiresAt,Date.now()+3600000)};
 let grant:NormalGrant;
 if(mixed){
  // Consent covers all current sources, including explicitly unreadable, untransmitted files.
  grant={id:randomUUID(),visualLimits:policy.visualLimits??legacyDocumentLimits,mixed:manifest,model:policy.model,maxOutputTokens:policy.maxOutputTokens,maxRequestBytes:policy.maxRequestBytes,timeoutMs:policy.timeoutMs,release:{policyVersion:policy.id+':'+policy.revision,scopeHash:sha(JSON.stringify(c.scope)),expiresAt:consent.expiresAt,segments:segments.map(s=>({id:s.id,sourceId:s.sourceId,version:s.version,sha256:s.sha256,assetId:s.assetId??null,textHash:sha(s.text),ranges:[{start:0,end:Array.from(s.text).length}]}))}};
 }else grant=buildTextTransmissionGrant(c,segments,policy,consent,ceiling.dataClass,randomUUID());

 // Detect sensitive identifiers BEFORE showing a transmission confirmation or calling model.
 await rangeMinimizer(grant.release)(segments,c.scope);
 if(mixed&&executable)try{await prepareMixedRequest(c,grant,extract);}catch(e){if(!(e instanceof Error)||e.message!=='visual_input_limit')throw e;executable=false;blockingReason=`선택한 자료가 요청/파일/페이지/픽셀 한도를 넘습니다(요청 최대 ${grant.maxRequestBytes}바이트). 전송하지 않으며 원본을 임의 축소·가림 처리하지 않습니다.`;}
 return {segments,consent,grant,view:{executable,blockingReason,disclosures,snapshot:c.snapshot,previewHash:consent.previewHash,policyId:policy.id,policyRevision:policy.revision,expiresAt:consent.expiresAt,provider:'OpenAI API',dataClass:policy.dataClass,files:c.files.map(f=>({...f,sha256:c.sources.find(s=>s.id===f.id)!.sha256,version:c.sources.find(s=>s.id===f.id)!.version})),segments:segments.map(s=>({id:s.id,sourceId:s.sourceId,locator:s.locator,text:s.text})),notice:manifest.visuals.length?'전체 이미지 또는 PDF의 모든 페이지를 OpenAI API에 전송합니다. 가림·자동 개인정보 삭제를 하지 않습니다. 현재는 별도 허용된 합성 원문만 가능합니다. 판독값·인용은 원문 확인이 필요합니다.': '표시된 텍스트만 OpenAI API로 보냅니다. 개인식별정보가 보이면 취소하고 자료를 수정하세요. 검수는 금융 승인이나 자료 완비 확인이 아닙니다.'}};
}
export function normalConsentEndpoint(input:{context:()=>Promise<NormalContext>;store:ConsentStore;ceiling:TransmissionCeiling|null;extract?:Parameters<typeof consentPreview>[3]}){
 return async(request:Request)=>{const headers={'Cache-Control':'no-store'};let registered:string|undefined,registeredContext:NormalContext|undefined;try{
  if(!input.ceiling)throw Error('transmission_policy_not_configured');
  if(!['GET','POST'].includes(request.method))throw Error('invalid_request');
  if(request.method==='POST'&&request.headers.get('origin')!==new URL(request.url).origin)throw Error('forbidden');
  const c=await input.context(),record=await input.store.policy(),preview=await consentPreview(c,record,input.ceiling,input.extract);
  const current=async()=>{const [again,policy]=await Promise.all([input.context(),input.store.policy()]);if(again.snapshot!==c.snapshot||JSON.stringify(again.scope)!==JSON.stringify(c.scope)||JSON.stringify(policy)!==JSON.stringify(record))throw Error('source_changed');};
  await current();if(request.method==='GET')return Response.json(preview.view,{headers});
  if(!preview.view.executable)throw Error('source_unreadable');
  const text=await request.text();if(text.length>6000)throw Error('invalid_request');const b=JSON.parse(text);
  if(b.confirmed!==true||b.snapshot!==c.snapshot||b.previewHash!==preview.consent.previewHash||b.policyId!==record.id||b.policyRevision!==record.revision)throw Error('current_preview_consent_required');
  registeredContext=c;registered=await input.store.register(c,record,preview.grant,preview.consent);await current();
  return Response.json({saved:true,snapshot:c.snapshot,policyRevision:record.revision,financialApproval:false},{headers});
 }catch(e){if(registered&&registeredContext)try{await input.store.revoke(registered,registeredContext);}catch{}const code=e instanceof Error&&['forbidden','source_changed','current_preview_consent_required','transmission_policy_required','transmission_policy_not_configured','document_selection_required','sensitive_text','source_unreadable','visual_input_limit','ocr_runtime_unavailable','unsupported_format','storage_not_connected','consent_not_saved'].includes(e.message)?e.message:'consent_unavailable';return Response.json({code,saved:false,financialApproval:false},{status:code==='forbidden'?403:409,headers});}};
}
