import {contentActions,reconcileCoverage,monthlyCoverageProse,monthlyEvidenceFor} from '../admin/ai/content-contract';
import type {Result} from '../admin/ai/review';
type Issue={sourceVersion?:string;sourceHash?:string;evidenceAssurance?:'text_match'|'visual_claim';sourceId:string;field:string;state:'unknown'|'unreadable'|'conflict';quote:string;locator:string;action:string};
const priority={unknown:0,unreadable:1,conflict:2};
const action={unknown:'자료에서 확인되지 않았습니다. 기존 원문이나 다른 근거를 먼저 확인해 주세요.',unreadable:'판독이 어렵습니다. 해당 위치를 확인하고 필요한 부분만 선명하게 보완해 주세요.',conflict:'자료 간 내용 차이가 있습니다. 기간·단위·VAT 및 원문을 대조해 주세요.'};
/** Compose already verified model receipts into sales document feedback. No model/DB access. */
export function salesModelFeedback(results:Result[],documentIds:string[]):Issue[]{
 const facts=results.flatMap(r=>r.facts),issues:Issue[]=[];
 for(const f of facts){if(!documentIds.includes(f.sourceId))continue;
  const numeric=/total|net|vat|rate|quantity|days/.test(f.field),known=!numeric||[f.unit,f.vat,f.period].every(x=>!!x&&x!=='unknown');
  const conflict=known&&facts.some(g=>documentIds.includes(g.sourceId)&&g.sourceId!==f.sourceId&&g.field===f.field&&g.assetId===f.assetId&&g.unit===f.unit&&g.vat===f.vat&&g.period===f.period&&g.value!==f.value);
  issues.push({sourceVersion:f.version,sourceHash:f.sha256,sourceId:f.sourceId,field:f.field,state:conflict?'conflict':'unknown',quote:f.quote,locator:f.locator,action:conflict?action.conflict:'AI가 읽은 내용입니다. 사실 확인 완료가 아니며 원문·단위·기간을 대조해 주세요.'});
 }
 for(const s of results.flatMap(r=>r.supplements)){
  // Empty source means the model could not localize the uncertainty, not that it can be discarded.
  const ids=s.sourceId?[s.sourceId]:documentIds;
  for(const id of ids){if(!documentIds.includes(id))continue;
   const existing=issues.filter(i=>i.sourceId===id&&i.field===s.field);
   if(existing.length){for(const i of existing)if(priority[s.kind]>priority[i.state]){i.state=s.kind;i.action=action[s.kind];}}
   else issues.push({sourceId:id,field:s.field,state:s.kind,quote:'',locator:'',action:(s.sourceId?'':'관련 원문 위치 미확인. ')+action[s.kind]});
  }
 }
 for(const r of results)for(const o of reconcileCoverage(r.contentReview?.observations??[]))for(const e of o.evidence){if(!documentIds.includes(e.sourceId))continue;issues.push({sourceVersion:e.version,sourceHash:e.sha256,evidenceAssurance:e.assurance,sourceId:e.sourceId,field:'document.'+o.topic,state:'unknown',quote:e.quote,locator:e.locator,action:(e.assurance==='visual_claim'?'이미지 판독 초안 · 원문 확인 필요. ':'')+((o.topic==='coverage_gap'||o.topic==='document_fact'&&/^월별/.test(e.quote))?monthlyCoverageProse(monthlyEvidenceFor((r.contentReview?.observations??[]).flatMap(x=>x.evidence),e))??contentActions[o.topic]:contentActions[o.topic])});}
 return issues;
}
