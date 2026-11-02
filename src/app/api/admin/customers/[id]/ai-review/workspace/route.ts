import {GET as documentGET} from '../route';
import {createClient} from '@/lib/supabase/server';
import {actorSources} from '@/lib/admin/ai/sources';
import {createVisionEndpoint} from '@/lib/admin/ai/vision-server';
import {configuredTriageRuntime} from '@/lib/admin/ai/triage-server';
import {loadSavedWorkspace,summarizeWorkspace} from '@/lib/admin/ai/workspace-review';
import {imageEvidence,dealEvidence} from '@/lib/admin/ai/deal-evidence';
export const dynamic='force-dynamic';export const runtime='nodejs';export const maxDuration=180;
/** Read-only composition. Authentication, byte/version and receipt checks remain in the existing handlers. */
export async function GET(request:Request,context:{params:Promise<{id:string}>}){const headers={'Cache-Control':'no-store','Pragma':'no-cache'};try{
 const {id}=await context.params,q=new URL(request.url).searchParams,docs=q.getAll('documentId'),slots=q.getAll('slot'),path=q.get('reviewPath')??'legacy';
 if(!/^[a-f0-9-]{36}$/i.test(id)||[...q.keys()].some(k=>!['documentId','slot','reviewPath'].includes(k))||q.getAll('reviewPath').length>1||!['legacy','registered','confirmed'].includes(path)||docs.length>8||slots.length>1||!docs.length&&!slots.length||new Set(docs).size!==docs.length||docs.some(d=>!/^[a-f0-9-]{36}$/i.test(d))||slots.some(s=>!/^vision-v118-[1-5]$/.test(s)))return Response.json({code:'invalid_request'},{status:400,headers});
 const db=await createClient(),sources=actorSources(db,'zatlumldeqhghhrsgtdq',id,'workspace-read'),scope=await sources.scope();
 const rows=docs.length?await loadSavedWorkspace(id,docs.map(d=>({id:d,label:'등록 자료'})),path as 'legacy'|'registered'|'confirmed',request.signal,async(input,init)=>documentGET(new Request(new URL(String(input),request.url),{...init,headers:request.headers}),context)):[];
 const images=[];for(const slot of slots){const url=new URL(request.url);url.search='?slot='+slot;const response=await createVisionEndpoint({db,env:process.env,customerId:id})(new Request(url,{headers:request.headers,signal:request.signal}));if(response.status===403)throw Error('forbidden');images.push(imageEvidence(response.ok?await response.json():null,slot));}
 // Existing notes are metadata-only user annotations, not verified replies or source facts.
 let annotations:unknown=null;if(docs.length){const runtime=configuredTriageRuntime(db,id);if(runtime){const url=new URL(request.url),r=await runtime.handle(new Request(url,{method:'POST',headers:{Origin:url.origin,'Content-Type':'application/json'},body:JSON.stringify({action:'read',documentIds:docs})}));if(r.status===403)throw Error('forbidden');if(r.ok){const v=await r.json();annotations={snapshot:v.snapshot,revision:v.revision,stale:v.stale,tasks:v.tasks,assurance:'user_annotation_metadata_only',author:'not_exposed_by_existing_store',replyVerified:false};}}}
 if(docs.length){const current=await sources.sources(docs,scope);for(const row of rows){const source=current.find(s=>s.id===row.document.id);if(!source||row.result?.facts.some(f=>f.version!==source.version||f.sha256!==source.sha256||f.assetId!==source.assetId))throw Error('source_changed');}}
 if(request.signal.aborted||JSON.stringify(await sources.scope())!==JSON.stringify(scope))throw Error('forbidden');
 return Response.json({rows,images,summary:summarizeWorkspace(rows),evidence:dealEvidence(rows,images),annotations,replyHistory:{state:'unknown',reason:'기존 메모는 사용자 작성정보이며 답장 원문·작성자·승인 지시는 확인되지 않았습니다.'},financialApproval:false,automaticApply:false},{headers});
 }catch(e){const forbidden=e instanceof Error&&e.message==='forbidden';return Response.json({code:forbidden?'forbidden':'workspace_unavailable',financialApproval:false},{status:forbidden?403:503,headers});}}
