import {decodeVisualContent} from './content-contract';
import {fields as reviewFields,type Result,type Source} from './review';
/** Model quotations over images are claims, not text-extractor matches. Every accepted field
 * remains unknown pending source review. Malformed fields are independently quarantined. */
export function documentVisionResult(raw:unknown,source:Source,pages:number,snapshot:string,reviewContract?:'document-review-v1'):Result{
 const r=raw as {status?:unknown;model?:unknown;output?:{type?:string;content?:{type?:string;text?:string}[]}[]};
 if(!r||r.status!=='completed'||r.model!=='gpt-5.4-2026-03-05'||!Array.isArray(r.output))throw Error('provider_outcome_unknown');
 const texts=r.output.flatMap(m=>m.type==='message'&&Array.isArray(m.content)?m.content.filter(c=>c.type==='output_text'&&typeof c.text==='string').map(c=>c.text!):[]);
 if(texts.length!==1)throw Error('provider_outcome_unknown');const body=JSON.parse(texts[0]);
 if(!body||Object.keys(body).sort().join()!==(reviewContract?'observations,readings':'readings')||!Array.isArray(body.readings)||body.readings.length>48)throw Error('provider_outcome_unknown');
 const facts:Result['facts']=[],supplements:Result['supplements']=[],seen=new Set<string>();
 for(const f of body.readings){
  if(!f||typeof f!=='object'||!reviewFields.includes(f.field)||Object.keys(f).sort().join()!=='field,page,period,quote,raw,status,unit,vat'||!['field','raw','quote','status','unit','vat','period'].every(k=>typeof f[k]==='string'&&f[k].length<=2000)||!Number.isSafeInteger(f.page)||f.page<1||f.page>pages||!['readable','unreadable','absent'].includes(f.status))continue;
  const id=f.field+':'+f.page;if(seen.has(id))throw Error('provider_outcome_unknown');seen.add(id);
  if(f.status!=='readable'){supplements.push({sourceId:source.id,field:f.field,kind:f.status==='unreadable'?'unreadable':'unknown'});continue;}
  if(!f.raw.trim()||!f.quote.trim()||!f.quote.includes(f.raw)){supplements.push({sourceId:source.id,field:f.field,kind:'unreadable'});continue;}
  facts.push({field:f.field,value:f.raw,quote:f.quote,segment:'visual-page:'+f.page,unit:f.unit,vat:f.vat,period:f.period,sourceId:source.id,version:source.version,sha256:source.sha256,assetId:source.assetId,locator:'page:'+f.page});
  supplements.push({sourceId:source.id,field:f.field,kind:'unknown'});
 }
 for(const field of reviewFields)if(!supplements.some(s=>s.field===field))supplements.push({sourceId:source.id,field,kind:'unknown'});
 const contentReview=reviewContract?decodeVisualContent(body.observations,source,pages):undefined;
 return {...(contentReview?{contentReview}:{}),status:'needs_review',mode:'live',facts,supplements,financialApproval:false,sourceSnapshot:snapshot};
}
