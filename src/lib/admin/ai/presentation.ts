import type {Result} from './review';
const text=(x:unknown,max=4000):x is string=>typeof x==='string'&&x.length<=max;
export function readReviewResult(value:unknown):Result{
 if(!value||typeof value!=='object')throw Error('invalid_review');const r=value as Result;
 if(r.status!=='needs_review'||!['mock','live','not_run'].includes(r.mode)||r.financialApproval!==false||!Array.isArray(r.facts)||r.facts.length>100||!Array.isArray(r.supplements)||r.supplements.length>500)throw Error('invalid_review');
 if(r.mode==='not_run'&&r.facts.length)throw Error('invalid_review');
 for(const f of r.facts)if(!f||typeof f!=='object'||!['field','value','quote','segment','unit','vat','period','sourceId','version','sha256','locator'].every(k=>text((f as unknown as Record<string,unknown>)[k]))||!f.sourceId||!f.version||!f.locator||!f.quote||!f.value||!/^[a-f0-9]{64}$/.test(f.sha256)||(f.assetId!==null&&!text(f.assetId,200)))throw Error('invalid_review');
 for(const s of r.supplements)if(!s||!['unknown','unreadable','conflict'].includes(s.kind)||!text(s.sourceId,200)||!text(s.field,200))throw Error('invalid_review');
 return r;
}
export function factCanApply(r:Result,f:Result['facts'][number]){return r.mode==='live'&&!r.supplements.some(s=>s.field===f.field&&(s.sourceId===''||s.sourceId===f.sourceId||s.kind==='conflict'&&r.facts.some(other=>other.sourceId===s.sourceId&&other.assetId===f.assetId)));}
/** Exact package binding only; never infer asset1/asset2 from array position. */
export function contractFactField(f:Result['facts'][number],fields:{key:string}[],bindings:{assetId:string;field:string;fieldKey:string}[],assetIds:string[]){
 if(f.field.startsWith('asset.')){if(!f.assetId||!assetIds.includes(f.assetId))throw Error('ai_mapping_required');const matches=bindings.filter(b=>b.assetId===f.assetId&&b.field===f.field.slice(6)&&fields.some(x=>x.key===b.fieldKey));if(matches.length!==1)throw Error('ai_mapping_required');return matches[0].fieldKey;}
 if(f.assetId!==null||!fields.some(x=>x.key===f.field))throw Error('ai_mapping_required');return f.field;
}
