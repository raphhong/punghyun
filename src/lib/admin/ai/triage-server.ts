import {createTriageRpcRuntime} from './triage-rpc';
import type {SupabaseClient} from '@supabase/supabase-js';
import {createTriageDriver} from './triage-driver';
import {triageEnvironment} from './triage-environment';
import {createTriageOnlyRuntime} from './triage-runtime';
let store:ReturnType<typeof createTriageDriver>|undefined;
/** Private server configuration is read only after explicit Preview activation. */
export function configuredTriageRuntime(db:SupabaseClient,customerId:string){
 const settings=triageEnvironment(process.env);if(!settings){
  if(process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_GIT_COMMIT_REF!=='codex/standard-contract-preparation-v51'||process.env.NEXT_PUBLIC_SUPABASE_URL!=='https://zatlumldeqhghhrsgtdq.supabase.co')return null;
  return createTriageRpcRuntime(db,customerId);
 }
 const customer=settings.scope.customers[customerId];if(!customer)throw Error('forbidden');
 store??=createTriageDriver(settings.connection);
 return createTriageOnlyRuntime({db,projectRef:settings.scope.projectRef,customerId,caseId:customer.caseIds[0],config:async()=>{
  const now=triageEnvironment(process.env);if(!now)throw Error('forbidden');return now.scope;
 },store});
}
export async function prepareTriageRequest(request:Request,runtime:NonNullable<ReturnType<typeof configuredTriageRuntime>>){
 const headers={'Cache-Control':'no-store'};
 try{
  if(request.method!=='POST'||request.headers.get('origin')!==new URL(request.url).origin)throw Error('forbidden');
  const reader=request.body?.getReader();if(!reader)throw Error('invalid_request');let size=0,text='';const decoder=new TextDecoder();
  for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>64000){await reader.cancel();throw Error('invalid_request');}text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();
  let body;try{body=JSON.parse(text);}catch{throw Error('invalid_request');}
  if(!body||Object.keys(body).some(k=>k!=='documentIds')||!Array.isArray(body.documentIds)||!body.documentIds.length||body.documentIds.length>8||body.documentIds.some((id:unknown)=>typeof id!=='string'||!id||id.length>200))throw Error('invalid_request');
  return Response.json(await runtime.prepareHumanReview(body.documentIds),{headers});
 }catch(e){const code=e instanceof Error?e.message:'';return Response.json({code:['forbidden','invalid_request','source_changed','context_changed'].includes(code)?code:'triage_unavailable'},{status:code==='forbidden'?403:code==='invalid_request'?400:['source_changed','context_changed'].includes(code)?409:503,headers});}
}
