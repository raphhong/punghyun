import {documentRuntimeFromEnvironment,type DocumentRuntime} from './document-extraction';
import type {SupabaseClient} from '@supabase/supabase-js';
import {fields} from './review';
import {actorSources} from './sources';
import {createReleaseApprovalEndpoint,type ReleaseStore} from './release-approval';
import type {ReleaseRow} from './release-approval-store';
const uuid=(x:unknown):x is string=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(x);
const codes=['forbidden','not_found','approval_required','expired','source_changed','scope_exceeded','request_conflict','revision_conflict','revoked','confirmation_required','invalid_request'];
/** Current request SSR JWT only. No environment credentials or direct table writes. */
export function createReleaseRpcEndpoint(db:SupabaseClient,customerId:string,documentId:string,pilot?:{id:string;dataClass:'synthetic'|'customer'},documentRuntime?:DocumentRuntime){
 async function rpc(action:string,data:unknown={}){try{const r=await db.rpc(pilot?'admin_release_confirmation_v113':'admin_release_confirmation_v111',{p_customer:customerId,p_document:documentId,p_action:action,p_data:data});if(r.error)throw Error(codes.includes(r.error.message)?r.error.message:'repository_unavailable');return r.data;}catch(e){throw Error(e instanceof Error&&codes.includes(e.message)?e.message:'repository_unavailable');}}
 function row(raw:unknown):ReleaseRow|undefined{if(raw===null)return undefined;if(!raw||typeof raw!=='object')throw Error('repository_unavailable');const r=raw as ReleaseRow&{payload:unknown};if(!uuid(r.id)||r.customer!==customerId||!uuid(r.actor)||r.tenant!=='zatlumldeqhghhrsgtdq'||!['draft','confirmed_local','revoked'].includes(r.status)||!Number.isSafeInteger(r.revision)||!Number.isSafeInteger(r.expires)||typeof r.digest!=='string'||!/^[a-f0-9]{64}$/.test(r.digest)||!r.payload||typeof r.payload!=='object')throw Error('repository_unavailable');return {...r,payload:JSON.stringify(r.payload)};}
 const store:ReleaseStore={async get(id){return row(await rpc('get',{id}));},async latest(){return row(await rpc('latest'));},async create(r){const v=row(await rpc('create',{...r,payload:JSON.parse(r.payload)}));if(!v)throw Error('repository_unavailable');return v;},async change(id,revision,status){const v=row(await rpc(status==='revoked'?'revoke':'confirm',{id,revision,confirmed:true}));if(!v)throw Error('repository_unavailable');return v;},async history(id){const h=await rpc('history',{id});if(!Array.isArray(h)||h.length>3)throw Error('repository_unavailable');return h;}};
 const base=actorSources(db,'zatlumldeqhghhrsgtdq',customerId,'release-confirmation-v111');
 return createReleaseApprovalEndpoint({documentRuntime,allowedDataClass:pilot?.dataClass,store,authorize:async()=>({...await base.scope(),role:'admin',version:'release-confirmation-v111'}),source:async(id,scope)=>{
  if(id!==documentId)throw Error('forbidden');const envelope=await rpc('envelope'),t=envelope?.template;if(!uuid(envelope?.id)||!t||t.data_class!==(pilot?.dataClass??'synthetic')||pilot&&t.budget_policy_id!==pilot.id||t.customer_id!==customerId||t.document_id!==documentId||t.actor_id!==scope.actorId||!Array.isArray(t.allowed_fields)||!t.allowed_fields.length||t.allowed_fields.length>10||t.allowed_fields.some((f:unknown)=>!fields.includes(f as typeof fields[number])))throw Error('forbidden');const source=(await base.sources([id],{actorId:scope.actorId,tenantId:scope.tenantId,customerId:scope.customerId,caseId:scope.caseId,revision:scope.revision}))[0];if(source.sha256!==t.bytes_hash||source.version!==t.source_version||(source.assetId??null)!==(t.asset_id??null))throw Error('source_changed');
  // A display name is not evidence; never return a signed URL or Storage path.
  return {source,dataClass:pilot?.dataClass??'synthetic',filename:'등록 자료 · '+id.slice(0,8),envelopeId:envelope.id,allowedFields:t.allowed_fields};
 }},customerId);
}
export function releaseEnvironment(env:Record<string,string|undefined>){return env.VERCEL_PROJECT_ID==='prj_QsugyPN8WskIrGq5nnsZwzFHSdXB'&&env.VERCEL_ENV==='preview'&&env.VERCEL_GIT_COMMIT_REF==='codex/standard-contract-preparation-v51'&&env.NEXT_PUBLIC_SUPABASE_URL==='https://zatlumldeqhghhrsgtdq.supabase.co';}
/** Only non-secret environment identity is checked; missing RPC/envelope fails closed. */
export async function handleReleaseRoute(request:Request,customerId:string,db:SupabaseClient,env:Record<string,string|undefined>){
 try{if(!releaseEnvironment(env)||!uuid(customerId))throw Error('forbidden');const url=new URL(request.url);const doc=url.searchParams.get('document');if(url.searchParams.getAll('document').length!==1||!uuid(doc))throw Error('invalid_request');url.searchParams.delete('document');const forwarded=new Request(url,request);return await createReleaseRpcEndpoint(db,customerId,doc,pilotConfiguration(env),documentRuntimeFromEnvironment(env))(forwarded);}catch(e){const code=e instanceof Error&&codes.includes(e.message)?e.message:'repository_unavailable';return Response.json({code,executionAllowed:false},{status:code==='forbidden'?403:code==='invalid_request'?400:503,headers:{'Cache-Control':'no-store'}});}
}

/** Server-only configuration selects a DB policy; it never grants a customer/document scope. Missing/invalid values disable the pilot. */
export function pilotConfiguration(env:Record<string,string|undefined>):{id:string;dataClass:'synthetic'|'customer'}|undefined{
 if(env.AI_REVIEW_PILOT_ENABLED!=='bounded-v113')return undefined;
 if(!releaseEnvironment(env)||!uuid(env.AI_REVIEW_PILOT_POLICY_ID)||!['synthetic','customer'].includes(env.AI_REVIEW_PILOT_DATA_CLASS??''))throw Error('forbidden');
 return {id:env.AI_REVIEW_PILOT_POLICY_ID,dataClass:env.AI_REVIEW_PILOT_DATA_CLASS as 'synthetic'|'customer'};
}
