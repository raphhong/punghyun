import type {SupabaseClient} from '@supabase/supabase-js';
import {actorSources} from './sources';
import {tenantScope,type TrustedTenantConfig} from './policy';
import {reviewSourceSnapshot} from './review';
import {TriageService,triageResponse,type TriagePorts} from './triage';
import type {TransactionPort} from './repository';

/** Server-only injected composition: no environment reads, model key or provider calls. */
export function createTriageOnlyRuntime(input:{db:SupabaseClient;projectRef:string;customerId:string;caseId:string;config:()=>Promise<TrustedTenantConfig>;store:TransactionPort}){
 const access:TriagePorts={async context(ids){
  const config=await input.config();
  if(input.projectRef!=='zatlumldeqhghhrsgtdq'||config.projectRef!==input.projectRef)throw Error('forbidden');
  const base=actorSources(input.db,config.tenantId,input.customerId,input.caseId);
  const auth=await base.scope();
  const scope=tenantScope(config,input.projectRef,auth.actorId,input.customerId,input.caseId);
  const sources=await base.sources(ids,auth);
  if(sources.some(s=>s.assetId!==null&&!config.customers[input.customerId]?.assetIds.includes(s.assetId)))throw Error('forbidden');
  const current=tenantScope(await input.config(),input.projectRef,(await base.scope()).actorId,input.customerId,input.caseId);
  if(JSON.stringify(scope)!==JSON.stringify(current))throw Error('context_changed');
  return {scope,sources,role:'admin'};
 }};
 const service=new TriageService(input.store,access);
 return {handle:(request:Request)=>triageResponse(request,service),service,
  /** Internal explicit preparation for human source review. Not an HTTP caller-supplied AI result. */
  async prepareHumanReview(ids:string[]){const c=await access.context(ids);return service.seed(ids,{status:'needs_review',mode:'not_run',financialApproval:false,sourceSnapshot:reviewSourceSnapshot(c.scope,c.sources),facts:[],supplements:c.sources.map(s=>({kind:'unknown',sourceId:s.id,field:''}))});}
 };
}
