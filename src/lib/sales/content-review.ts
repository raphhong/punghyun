import type {Source} from '../admin/ai/review';
import {extractDocument} from '../admin/ai/document-extraction';
import {firstPassContent,type ContentReview} from '../admin/ai/first-pass-content';
export type SalesContentBinding={customerId:string;sourceSnapshot:string;documentIds:string[]};
/** Whitelist public document observations, not internal workspace/underwriting content.
 * Sheet names can contain identifiers: expose only ordinal/cell coordinates to sales. */
export function publicContentReview(r:ContentReview):ContentReview{
 const sheetNames=new Map<string,number>();
 return {...r,findings:r.findings.map(f=>{
  const sheet=/^sheet:(\d+);name:([^;]*);cell:([A-Z]+\d+);part:value$/;
  let title=f.title;
  for(const ref of f.refs){const m=sheet.exec(ref.locator);if(m){let name:string;try{name=decodeURIComponent(m[2]);}catch{continue;}sheetNames.set(name,Number(m[1]));}}
  for(const [name,n] of sheetNames)if(title.startsWith(name+' · '))title='매출표 '+n+title.slice(name.length);
  return {kind:f.kind,title,detail:f.detail,next:f.next,requestOriginal:false as const,refs:f.refs.map(ref=>{const m=sheet.exec(ref.locator);return {sourceId:r.sourceId,version:r.version,sha256:r.sha256,locator:m?'시트 '+m[1]+' · 셀 '+m[3]:/^page:\d+$/.test(ref.locator)?ref.locator:'원문 위치 미확인',quote:/^(조회기간\s*[:：]?\s*)?\d{4}-\d{2}(\s*[~～]\s*\d{4}-\d{2})?$/.test(ref.quote)||ref.quote==='개인 합산 사업소득'?ref.quote:'원문에서 확인 필요'};})};})};
}
/** Wrap the existing sales result, never replace its session/scope/model gates.
 * No writes, model calls, history fallback, or admin client. Current bytes are re-read. */
export async function withSalesContentReview(response:Response,customerId:string,signal:AbortSignal,ports:{binding:()=>Promise<SalesContentBinding>;sources:(ids:string[])=>Promise<Source[]>}):Promise<Response>{
 if(!response.ok)return response;
 const body=await response.clone().json();if(body.financialApproval!==false||typeof body.sourceSnapshot!=='string')return response;
 if(body.status==='cancelled')return response;
 const headers={'Cache-Control':'no-store'};
 try{
  const before=await ports.binding();if(before.customerId!==customerId||before.sourceSnapshot!==body.sourceSnapshot||!Array.isArray(before.documentIds)||before.documentIds.length>8||new Set(before.documentIds).size!==before.documentIds.length)throw Error('source_changed');
  const sources=before.documentIds.length?await ports.sources(before.documentIds):[];
  if(sources.length!==before.documentIds.length||sources.some(s=>s.customerId!==customerId||!before.documentIds.includes(s.id)))throw Error('source_changed');
  const reviews:ContentReview[]=[];
  for(const source of sources){if(signal.aborted)throw Error('cancelled');try{reviews.push(publicContentReview(firstPassContent(source,await extractDocument(source,signal))));}catch(e){if(signal.aborted||e instanceof Error&&e.message==='source_changed')throw e;reviews.push(publicContentReview(firstPassContent(source,null)));}}
  if(signal.aborted||JSON.stringify(await ports.binding())!==JSON.stringify(before))throw Error('source_changed');
  return Response.json({...body,contentReview:{state:'current',sourceSnapshot:before.sourceSnapshot,reviews,assurance:'local_document_observation',persisted:false,modelCalled:false}}, {headers});
 }catch{
  // Do not return the earlier result if its source changed while composing current content.
  return Response.json({status:'stale',sourceSnapshot:body.sourceSnapshot,revision:body.revision,issues:[],financialApproval:false,requestAllowed:false,executionAllowed:false,contentReview:{state:'unavailable',reviews:[],persisted:false,modelCalled:false}}, {headers});
 }
}
