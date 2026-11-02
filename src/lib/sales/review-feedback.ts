/** Sales-facing projection only. Never expose administrator notes, credit decisions or provider bodies. */
export type SalesSource={id:string;version:string;sha256:string};
export type SalesIssue={sourceId:string;field:string;state:'unknown'|'unreadable'|'conflict'|'missing';quote:string;locator:string;action:string;requirement?:{basis:'direct_lender'|'case_specific';ruleId:string;evidenceRef:string;verified:true}};
export type SalesFeedback={customerId:string;agentId:string;sourceSnapshot:string;sources:SalesSource[];status:'requested'|'running'|'needs_correction'|'reviewed'|'failed'|'cancelled';issues:SalesIssue[];revision:number;financialApproval:false};
const fields=new Set(['customer.name','purchase.total','rent.net','rent.vat','rent.total','duration','period','asset.model','asset.serial','asset.quantity']);
const actions={unknown:'자료에서 확인되지 않았습니다. 해당 위치의 내용이나 별도 근거를 확인해 주세요.',unreadable:'글자가 읽히지 않습니다. 선명한 파일로 교체해 주세요.',conflict:'자료 간 내용이 다릅니다. 근거를 비교하고 잘못된 자료를 수정해 주세요.',missing:'이 거래에 명시된 제출요건에 맞는 자료를 추가해 주세요.'};
/** DTO input must first pass server signature, current ownership and source checks. */
export function projectSalesFeedback(raw:SalesFeedback,current:{customerId:string;agentId:string;sourceSnapshot:string}){
 if(raw.customerId!==current.customerId||raw.agentId!==current.agentId||raw.financialApproval!==false||!Number.isSafeInteger(raw.revision)||raw.revision<1||!Array.isArray(raw.sources)||!Array.isArray(raw.issues)||raw.issues.length>100||!['requested','running','needs_correction','reviewed','failed','cancelled'].includes(raw.status))throw Error('invalid_feedback');
 const stale=raw.sourceSnapshot!==current.sourceSnapshot;
 if(stale)return {status:'stale' as const,revision:raw.revision,issues:[],financialApproval:false,automaticRetryAllowed:false};
 const issues=raw.issues.map(i=>{if(!raw.sources.some(s=>s.id===i.sourceId)||!fields.has(i.field)||!Object.hasOwn(actions,i.state)||typeof i.quote!=='string'||i.quote.length>2000||typeof i.locator!=='string'||i.locator.length>300)throw Error('invalid_feedback');if(i.state==='missing'&&(!i.requirement||i.requirement.verified!==true||!['direct_lender','case_specific'].includes(i.requirement.basis)||!i.requirement.ruleId||!i.requirement.evidenceRef))throw Error('invalid_feedback');return {sourceId:i.sourceId,field:i.field,state:i.state,quote:i.quote,locator:i.locator,action:actions[i.state]};});
 return {status:raw.status,revision:raw.revision,issues,financialApproval:false,automaticRetryAllowed:false};
}
