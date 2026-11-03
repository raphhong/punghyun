import type {DocumentLimits} from './document-limits';
import {sha,type Segment} from '../admin/ai/review';
import type {NormalContext,NormalGrant} from './normal-review';
/** Organization policy is configured by the owner, not supplied by a salesperson.
 * Per-review consent pins a preview/version; it does NOT create or expand that policy. */
export type OwnerTransmissionPolicy={visualLimits?:DocumentLimits;allowWholeVisual?:boolean;id:string;revision:number;active:boolean;dataClass:'synthetic'|'customer';provider:'openai';model:string;expiresAt:number;allowedCategories?:string[];allowedHashes?:string[];allowedMime:string[];maxDocuments:number;maxOutputTokens:number;maxRequestBytes:number;timeoutMs:number};
export type ReviewConsent={actorId:string;customerId:string;snapshot:string;previewHash:string;policyId:string;policyRevision:number;confirmed:boolean;expiresAt:number};
export function textTransmissionPreview(c:NormalContext,segments:Segment[]){
 return sha(JSON.stringify([c.scope.actorId,c.scope.customerId,c.snapshot,segments.map(s=>[s.id,s.sourceId,s.version,s.sha256,s.locator,sha(s.text)])]));
}
/** Builds the server-owned pinned grant after a policy and the exact review preview agree.
 * Persistence is an installer/API concern, not an implicit write or a model call here.
 * Customers can consent within an owner policy; no fresh owner approval for every customer. */
export function buildTextTransmissionGrant(c:NormalContext,segments:Segment[],policy:OwnerTransmissionPolicy,consent:ReviewConsent,dataClass:OwnerTransmissionPolicy['dataClass'],grantId:string,now=Date.now()):NormalGrant{
 if(!policy.active||policy.provider!=='openai'||policy.expiresAt<=now||policy.dataClass!==dataClass||!policy.id||!Number.isSafeInteger(policy.revision)||policy.maxDocuments<1||policy.maxDocuments>8||c.sources.length<1||c.sources.length>policy.maxDocuments||c.sources.some(s=>!policy.allowedMime.includes(s.mime)))throw Error('transmission_policy_required');
 if(consent.confirmed!==true||consent.actorId!==c.scope.actorId||consent.customerId!==c.scope.customerId||consent.snapshot!==c.snapshot||consent.policyId!==policy.id||consent.policyRevision!==policy.revision||consent.expiresAt<=now||consent.previewHash!==textTransmissionPreview(c,segments))throw Error('current_preview_consent_required');
 if(policy.allowedHashes?.length&&c.sources.some(s=>!policy.allowedHashes!.includes(s.sha256)))throw Error('transmission_policy_required');
 if(policy.allowedCategories&&(!c.files||c.files.filter(f=>c.sources.some(s=>s.id===f.id)).some(f=>!policy.allowedCategories!.includes(f.category))))throw Error('transmission_policy_required');
 if(!segments.length||segments.some(s=>!c.sources.some(d=>d.id===s.sourceId&&d.version===s.version&&d.sha256===s.sha256)))throw Error('source_changed');
 return {id:grantId,model:policy.model,maxOutputTokens:policy.maxOutputTokens,maxRequestBytes:policy.maxRequestBytes,timeoutMs:policy.timeoutMs,release:{policyVersion:policy.id+':'+policy.revision,scopeHash:sha(JSON.stringify(c.scope)),expiresAt:Math.min(policy.expiresAt,consent.expiresAt),segments:segments.map(s=>({id:s.id,sourceId:s.sourceId,version:s.version,sha256:s.sha256,assetId:s.assetId??null,textHash:sha(s.text),ranges:[{start:0,end:Array.from(s.text).length}]}))}};
}
