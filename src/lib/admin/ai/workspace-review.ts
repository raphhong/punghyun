import {readReviewResult,readRequirementNotices,type RequirementNotice} from './presentation';
import type {Result} from './review';
export type ReviewDocument={id:string;label:string;filename?:string|null;uploadedAt?:string|null;deviceId?:string|null};
export type SavedDocumentReview={document:ReviewDocument;state:'read'|'not_run'|'unavailable'|'source_changed';result:Result|null;requirements:RequirementNotice[]};
export type Comparison={field:string;assetId:string|null;state:'same_extraction'|'potential_conflict'|'not_comparable';facts:Result['facts'];reason:string};
const labels:Record<string,string>={'customer.name':'고객명','asset.model':'장비 모델','asset.serial':'제조번호','purchase.total':'매입 총액','rent.net':'공급가액','rent.vat':'부가세','rent.total':'렌탈 총액','rent.rate':'요율','contract.date':'계약일','contract.days':'기간'};
export const reviewFieldLabel=(key:string)=>labels[key]??'확인 항목';
/** Read existing authenticated, source-revalidated receipts only; never dispatches a model. */
export async function loadSavedWorkspace(customerId:string,documents:ReviewDocument[],path:'legacy'|'registered'|'confirmed',signal:AbortSignal,transport:typeof fetch=fetch):Promise<SavedDocumentReview[]>{
 if(!customerId||!documents.length||documents.length>8||new Set(documents.map(d=>d.id)).size!==documents.length)throw Error('invalid_selection');
 const output:SavedDocumentReview[]=[];
 for(const document of documents){if(signal.aborted)throw Error('cancelled');const query=new URLSearchParams({documentId:document.id});if(path!=='legacy')query.set('reviewPath',path);
  const response=await transport('/api/admin/customers/'+encodeURIComponent(customerId)+'/ai-review?'+query,{method:'GET',cache:'no-store',signal});if(signal.aborted)throw Error('cancelled');if(response.status===401||response.status===403)throw Error('forbidden');
  let raw:unknown;try{raw=await response.json();}catch{output.push({document,state:'unavailable',result:null,requirements:[]});continue;}
  const b=raw as Record<string,unknown>;if(!b||typeof b!=='object'){output.push({document,state:'unavailable',result:null,requirements:[]});continue;}
  if(['source_changed','context_changed'].includes(String(b.code))){output.push({document,state:'source_changed',result:null,requirements:[]});continue;}
  if(response.ok&&(b.state==='ready'||b.status==='waiting_provider')){output.push({document,state:'not_run',result:null,requirements:[]});continue;}
  if(!response.ok||b.receiptVerified!==true||b.persistedResult!==true){output.push({document,state:'unavailable',result:null,requirements:[]});continue;}
  const result=readReviewResult(b);if(!result.sourceSnapshot||!result.facts.every(f=>f.sourceId===document.id)||result.supplements.some(s=>s.sourceId&&s.sourceId!==document.id))throw Error('invalid_source');
  output.push({document,state:result.mode==='not_run'?'not_run':'read',result,requirements:readRequirementNotices(b.requirements,result.sourceSnapshot)});
 }
 if(signal.aborted)throw Error('cancelled');return output;
}
/** Display-only comparison: same text is not verified truth; unknown dimensions never mean equal. */
export function summarizeWorkspace(rows:SavedDocumentReview[]){
 const groups=new Map<string,Result['facts']>();const duplicates=new Map<string,Set<string>>();
 for(const row of rows)for(const f of row.result?.facts??[]){const key=JSON.stringify([f.field,f.assetId]);const values=groups.get(key)??[];if(!values.some(x=>JSON.stringify(x)===JSON.stringify(f)))values.push(f);groups.set(key,values);const dk=JSON.stringify([f.sha256,f.assetId]);const ids=duplicates.get(dk)??new Set<string>();ids.add(f.sourceId);duplicates.set(dk,ids);}
 const comparisons:Comparison[]=[];
 for(const facts of groups.values()){if(new Set(facts.map(f=>f.sourceId)).size<2)continue;const sample=facts[0],sameMeaning=facts.every(f=>f.unit===sample.unit&&f.vat===sample.vat&&f.period===sample.period),needsDimensions=/total|net|vat|rate|days/.test(sample.field),known=!needsDimensions||facts.every(f=>[f.unit,f.vat,f.period].every(x=>!!x&&x!=='unknown'));
 const state=!sameMeaning||!known?'not_comparable':new Set(facts.map(f=>f.value)).size>1?'potential_conflict':'same_extraction';comparisons.push({field:sample.field,assetId:sample.assetId,state,facts,reason:state==='not_comparable'?'단위·VAT·기간이 다르거나 미확인이라 일치·불일치를 확정하지 않았습니다.':state==='potential_conflict'?'같은 비교 기준에서 읽은 값이 다릅니다. 오독 또는 거래 차이인지 원문을 확인합니다.':'읽은 문자열과 비교 기준이 같습니다. 사실 확인 완료는 아닙니다.'});}
 const rules=new Map<string,RequirementNotice[]>();for(const row of rows)for(const q of row.requirements){const key=JSON.stringify([q.ruleId,q.policyVersion,q.basisRef]);rules.set(key,[...(rules.get(key)??[]),q]);}const requirements=[...rules.values()].map(group=>new Set(group.map(q=>q.state)).size===1?group[0]:{...group[0],state:'inventory_unknown',responsibility:'punghyun' as const,requestUpload:false});
 const missing=requirements.filter(q=>q.state==='missing_confirmed'&&q.requestUpload);
 // No extracted values, names, bank details or raw quotations in the draft. Existing documents are not requested again.
 const draft=missing.length?'현재 필수로 확인된 미확보 자료의 보완 요청 초안입니다.\n'+missing.map((q,i)=>`${i+1}. 요건 ${q.ruleId} · ${q.responsibility==='sales'?'영업자 자료 확보':'풍현 확인'} · 기준 ${q.policyVersion}`).join('\n')+'\n이미 제출된 자료는 다시 보내지 말고 필요한 보완분만 보호 업로드 경로로 전달해 주세요. 담당자가 기존 답장과 확보 상태를 대조한 후 발송합니다.':'확정된 부족자료가 없어 자동 요청문을 만들지 않았습니다. 미확인·판독불가는 먼저 풍현에서 확인합니다.';
 return {comparisons,requirements,duplicateSources:[...duplicates.values()].filter(ids=>ids.size>1).map(ids=>[...ids]),draft,financialApproval:false as const,automaticApply:false as const};
}

export function sourceLocatorLabel(locator:string){const m=/^sheet:([1-9][0-9]*);name:([^;]+);cell:([A-Z]+[1-9][0-9]*);part:value$/.exec(locator);if(!m)return locator;try{return '시트 '+m[1]+' · '+decodeURIComponent(m[2])+' · 셀 '+m[3];}catch{return locator;}}
