import type {SupabaseClient} from '@supabase/supabase-js';
import {actorSources} from './sources';import {parserAdapter} from './parser';import {responsesTransport,assertSyntheticTrialConfig,type ApprovedConfig} from './openai';import {schemaVersion,type Ports} from './review';
/** Explicit server composition. No environment reads, activation or secret persistence. */
export function connectedReviewPorts(input:{db:SupabaseClient;tenantId:string;customerId:string;caseId:string;python:string;parserScript:string;provider:ApprovedConfig;minimize:Ports['minimize'];reserve:Ports['reserve']}):Ports{return {...actorSources(input.db,input.tenantId,input.customerId,input.caseId),extract:parserAdapter(input.python,input.parserScript),minimize:input.minimize,reserve:input.reserve,model:responsesTransport(input.provider)};}

import {cachedExtraction,type FactCache} from './cache';
import {tenantScope,minimizedSynthetic,type TrustedTenantConfig,type SyntheticTextPolicy} from './policy';
/** Trusted config comes from the server registry. Missing mappings never default to a tenant. */
export function trustedReviewPorts(input:{db:SupabaseClient;projectRef:string;config:()=>Promise<TrustedTenantConfig>;customerId:string;caseId:string;python:string;parserScript:string;provider:ApprovedConfig;textPolicy:SyntheticTextPolicy;cache:FactCache;cacheTtlMs:number}):Ports{
 assertSyntheticTrialConfig(input.provider);let active:ReturnType<typeof actorSources>|null=null;
 const scope=async()=>{const config=await input.config();const base=actorSources(input.db,config.tenantId,input.customerId,input.caseId);const authenticated=await base.scope();const scoped=tenantScope(config,input.projectRef,authenticated.actorId,input.customerId,input.caseId);active=base;return scoped;};
 return {policyVersion:input.textPolicy.version+':'+input.provider.model,scope,async sources(ids,expected){if(JSON.stringify(await scope())!==JSON.stringify(expected)||!active)throw Error('context_changed');const base=active;const sources=await base.sources(ids,await base.scope());const config=await input.config();if(sources.some(s=>s.assetId!==null&&!config.customers[input.customerId]?.assetIds.includes(s.assetId)))throw Error('forbidden');if(JSON.stringify(await scope())!==JSON.stringify(expected))throw Error('context_changed');return sources;},extract:parserAdapter(input.python,input.parserScript),minimize:minimizedSynthetic(input.textPolicy),model:cachedExtraction(responsesTransport(input.provider),scope,input.cache,{version:schemaVersion+':'+input.textPolicy.version,modelVersion:input.provider.model,ttlMs:input.cacheTtlMs}),reserve:async()=>{throw Error('durable_repository_required');}};
}
import {reviewResponse} from './http';
import type {ReviewRepository} from './repository';
/** Deployable composition entrypoint after explicit server configuration. Existing route remains OFF. */
export function createTrustedReviewHandler(input:Parameters<typeof trustedReviewPorts>[0],repository:ReviewRepository,triage?:import('./triage').TriageService){const ports=trustedReviewPorts(input);return (request:Request)=>reviewResponse(request,ports,repository,triage?async(ids,result)=>{await triage.seed(ids,result);}:undefined);}

import {TriageService,triageResponse} from './triage';
import type {TransactionPort} from './repository';
/** One server-owned scope/source resolver for review and triage. actorSources validates admin membership.
 * The connection is a dedicated configured server executor, never a browser client or service-role fallback.
 */
export function createTrustedReviewAndTriageHandlers(input:Parameters<typeof trustedReviewPorts>[0],repository:ReviewRepository,store:TransactionPort){
 const ports=trustedReviewPorts(input);
 const triage=new TriageService(store,{async context(ids){const scope=await ports.scope();const sources=await ports.sources(ids,scope);return {scope,sources,role:'admin'};}});
 return {review:(request:Request)=>reviewResponse(request,ports,repository,async(ids,result)=>{await triage.seed(ids,result);}),triage:(request:Request)=>triageResponse(request,triage)};
}
