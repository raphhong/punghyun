import type {SupabaseClient} from '@supabase/supabase-js';
import type {TriageView} from './triage';
const codes=['forbidden','invalid_request','source_changed','context_changed','review_required','triage_conflict'] as const;
function safe(e:unknown){const message=e&&typeof e==='object'&&'message' in e?String(e.message):'';return codes.find(c=>c===message)??'triage_unavailable';}
function view(value:unknown):TriageView{
 if(!value||typeof value!=='object')throw Error('triage_unavailable');const v=value as Record<string,unknown>;
 if(v.assurance!=='user_annotation_metadata_only'||v.aiVerified!==false||v.sourceBytesVerified!==false||v.financialApproval!==false||typeof v.snapshot!=='string'||!/^[a-f0-9]{64}$/.test(v.snapshot)||!Number.isSafeInteger(v.revision)||Number(v.revision)<0||typeof v.stale!=='boolean'||!Array.isArray(v.tasks)||v.tasks.length>100)throw Error('triage_unavailable');
 for(const t of v.tasks)if(!t||typeof t.id!=='string'||!/^[a-f0-9]{64}$/.test(t.id)||!['internal','sales'].includes(t.owner)||typeof t.note!=='string'||t.note.length>500||t.kind!=='unknown'||t.field!==''||typeof t.sourceId!=='string'||typeof t.active!=='boolean')throw Error('triage_unavailable');
 return {snapshot:v.snapshot,revision:Number(v.revision),stale:v.stale,tasks:v.tasks.map(t=>({id:t.id,sourceId:t.sourceId,kind:t.kind,field:t.field,owner:t.owner,note:t.note,active:t.active}))};
}
/** Current-user JWT only. DB derives actor, assignment and metadata; no asserted byte/AI verification accepted. */
export function createTriageRpcRuntime(db:Pick<SupabaseClient,'rpc'>,customerId:string){
 async function call(action:'read'|'prepare'|'save',ids:unknown,input?:unknown){
  if(!Array.isArray(ids)||ids.length<1||ids.length>8||ids.some(id=>typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id))||new Set(ids).size!==ids.length)throw Error('invalid_request');
  try{const r=await db.rpc('admin_triage_'+action+'_v91',{p_customer:customerId,p_docs:ids,...(action==='save'?{p_input:input}:{})});if(r.error)throw Error(safe(r.error));return view(r.data);}catch(e){throw Error(safe(e));}
 }
 return {prepareHumanReview:(ids:string[])=>call('prepare',ids),async handle(request:Request){const headers={'Cache-Control':'no-store'};try{
  if(request.method!=='POST'||request.headers.get('origin')!==new URL(request.url).origin)throw Error('forbidden');
  const reader=request.body?.getReader();if(!reader)throw Error('invalid_request');let size=0,text='';const decoder=new TextDecoder();for(;;){const p=await reader.read();if(p.done)break;size+=p.value.byteLength;if(size>64000){await reader.cancel();throw Error('invalid_request');}text+=decoder.decode(p.value,{stream:true});}text+=decoder.decode();let b;try{b=JSON.parse(text);}catch{throw Error('invalid_request');}
  if(!b||!['read','save'].includes(b.action)||Object.keys(b).some(k=>!['action','documentIds','input'].includes(k))||(b.action==='read'&&b.input!==undefined))throw Error('invalid_request');
  return Response.json(await call(b.action,b.documentIds,b.input),{headers});
 }catch(e){const code=safe(e);return Response.json({code},{headers,status:code==='forbidden'?403:code==='invalid_request'?400:['source_changed','context_changed','triage_conflict'].includes(code)?409:503});}}
 };
}
