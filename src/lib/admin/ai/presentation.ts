import {validateStoredContent} from './content-contract';
import type {Result} from './review';
const text=(x:unknown,max=4000):x is string=>typeof x==='string'&&x.length<=max;
export function readReviewResult(value:unknown):Result{
 if(!value||typeof value!=='object')throw Error('invalid_review');const r=value as Result;
 if(r.status!=='needs_review'||!['mock','live','not_run'].includes(r.mode)||r.financialApproval!==false||!Array.isArray(r.facts)||r.facts.length>100||!Array.isArray(r.supplements)||r.supplements.length>500)throw Error('invalid_review');
 if(r.extraction!==undefined&&(!r.extraction||!['ocr','xlsx','vision'].includes(r.extraction.kind)||r.extraction.reviewRequired!==true||!text(r.extraction.parserVersion,200)||!Array.isArray(r.extraction.warnings)||r.extraction.warnings.length>30||r.extraction.warnings.some(w=>!text(w,100))))throw Error('invalid_review');
 if(r.contentReview!==undefined)validateStoredContent(r.contentReview);
 if(r.mode==='not_run'&&r.facts.length)throw Error('invalid_review');
 for(const f of r.facts)if(!f||typeof f!=='object'||!['field','value','quote','segment','unit','vat','period','sourceId','version','sha256','locator'].every(k=>text((f as unknown as Record<string,unknown>)[k]))||!f.sourceId||!f.version||!f.locator||!f.quote||!f.value||!/^[a-f0-9]{64}$/.test(f.sha256)||(f.assetId!==null&&!text(f.assetId,200)))throw Error('invalid_review');
 for(const s of r.supplements)if(!s||!['unknown','unreadable','conflict'].includes(s.kind)||!text(s.sourceId,200)||!text(s.field,200))throw Error('invalid_review');
 return r;
}
export function factCanApply(r:Result,f:Result['facts'][number]){return r.financialApproval===false&&r.mode==='live'&&r.facts.some(value=>JSON.stringify(value)===JSON.stringify(f))&&!r.supplements.some(s=>s.field===f.field&&(s.sourceId===''||s.sourceId===f.sourceId||s.kind==='conflict'&&r.facts.some(other=>other.sourceId===s.sourceId&&other.assetId===f.assetId)));}
/** Exact package binding only; never infer asset1/asset2 from array position. */
export function contractFactField(f:Result['facts'][number],fields:{key:string}[],bindings:{assetId:string;field:string;fieldKey:string}[],assetIds:string[]){
 if(f.field.startsWith('asset.')){if(!f.assetId||!assetIds.includes(f.assetId))throw Error('ai_mapping_required');const matches=bindings.filter(b=>b.assetId===f.assetId&&b.field===f.field.slice(6)&&fields.some(x=>x.key===b.fieldKey));if(matches.length!==1)throw Error('ai_mapping_required');return matches[0].fieldKey;}
 if(f.assetId!==null||!fields.some(x=>x.key===f.field))throw Error('ai_mapping_required');return f.field;
}

/** Ask only when a human-entered value would actually change. A cancel preserves the old value. */
export function confirmFactReplacement(current:{value:string;state:string}|undefined,next:string,confirm:(message:string)=>boolean){
 if(typeof next!=='string'||!next.trim())throw Error('invalid_review');
 if(!current||!current.value.trim()||current.value===next)return true;
 return confirm('입력된 값과 AI가 읽은 값이 다릅니다.\n현재: '+current.value+'\nAI 추출: '+next+'\n원문을 확인한 값으로 바꾸시겠습니까?')===true;
}

export type RequirementNotice={state:string;responsibility:'sales'|'punghyun';requestUpload:boolean;ruleId:string;policyVersion:string;basisRef:string};
/** Display-only. This never confers permission or changes an evidence/contract state. */
export function readRequirementNotices(raw:unknown,snapshot:string|undefined):RequirementNotice[]{
 if(raw===undefined)return [];
 if(!raw||typeof raw!=='object'||!snapshot)throw Error('invalid_requirements');const p=raw as {sourceSnapshot?:string;items?:RequirementNotice[]};
 if(p.sourceSnapshot!==snapshot||!Array.isArray(p.items)||p.items.length>100)throw Error('invalid_requirements');
 const states=['not_required','applicability_unknown','present_needs_review','unreadable','inventory_unknown','missing_confirmed'];
 if(p.items.some(r=>!r||!states.includes(r.state)||!['sales','punghyun'].includes(r.responsibility)||typeof r.requestUpload!=='boolean'||r.requestUpload!==(r.state==='missing_confirmed')||![r.ruleId,r.policyVersion,r.basisRef].every(x=>typeof x==='string'&&!!x&&x.length<300)))throw Error('invalid_requirements');
 return p.items;
}
export function requirementMessage(r:RequirementNotice){return ({not_required:'이번 거래의 필수 자료가 아닙니다.',applicability_unknown:'이 거래에 필요한 자료인지 풍현에서 확인합니다.',present_needs_review:'이미 제출한 자료입니다. 내용을 확인합니다.',unreadable:'읽기 어려운 자료입니다. 풍현에서 원문을 확인합니다.',inventory_unknown:'자료 목록을 아직 확인하지 못했습니다. 다시 제출하지 않아도 됩니다.',missing_confirmed:'필수 자료가 확인되지 않았습니다. 담당자가 자료를 확보합니다.'} as Record<string,string>)[r.state];}

export function sourceLocatorLabel(locator:string){const m=/^sheet:([1-9][0-9]*);name:([^;]+);cell:([A-Z]+[1-9][0-9]*);part:value$/.exec(locator);if(!m)return locator;try{return '시트 '+m[1]+' · '+decodeURIComponent(m[2])+' · 셀 '+m[3];}catch{return locator;}}
