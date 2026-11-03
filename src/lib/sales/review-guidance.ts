import {contentActions,topics,type ContentTopic} from '../admin/ai/content-contract';
/** Presentation only: receipt authorization and execution eligibility remain server decisions. */
export type ReviewDocument={id:string;version:string;label:string};
export type ReviewIssue={sourceVersion?:string;sourceHash?:string;evidenceAssurance?:'text_match'|'visual_claim';sourceId:string;field:string;state:string;quote:string;locator:string;action:string;requirement?:{basis:'direct_lender'|'case_specific';ruleId:string;evidenceRef:string;verified:true}};
/** Supplied by the existing case requirement source, never inferred from an uploaded filename. */
export type CaseRequirements={customerId:string;customerType:string;recipient:string;verified:true;items:{id:string;customerType:string;recipient:string;title:string;why:string;content:string;sourceQuote:string;sourceRef:string;receivedDocumentIds:string[]}[]};
export function caseRequirementGuidance(customerId:string,documents:ReviewDocument[],context?:CaseRequirements){
 if(!context||context.customerId!==customerId||context.verified!==true||!context.customerType.trim()||!context.recipient.trim())return {message:'먼저 고객 유형과 자료 제출처를 확인하고, 이 거래에 적용되는 제출요건 원문을 연결해 주세요. NICE·비즈마켓 요건을 추정하지 않습니다.',items:[]};
 const items=context.items.filter(i=>i.customerType===context.customerType&&i.recipient===context.recipient&&i.id&&i.title&&i.why&&i.content&&i.sourceQuote&&i.sourceRef).map(i=>({...i,received:i.receivedDocumentIds.some(id=>documents.some(d=>d.id===id))}));
 return {message:items.length?`${context.customerType} · ${context.recipient} · 확인된 건별 제출요건`:'고객 유형과 제출처는 확인됐지만 적용할 제출요건 원문이 미확인입니다. 요구 목록을 먼저 확인해 주세요.',items};
}
const fields:Record<string,{label:string;why:string;content:string}>={
 'customer.name':{label:'고객명',why:'자료가 같은 거래 당사자의 것인지 대조합니다.',content:'상호·성명이 표시된 해당 원문 위치'},
 'purchase.total':{label:'매입 총액',why:'거래 금액과 VAT 포함 여부를 구분합니다.',content:'금액·통화·VAT 포함 여부가 함께 표시된 견적 또는 거래 근거'},
 'rent.net':{label:'임대료 공급가액',why:'공급가액·세액·합계가 서로 맞는지 대조합니다.',content:'공급가액·VAT·합계와 적용 기간이 표시된 금액 내역'},
 'rent.vat':{label:'임대료 VAT',why:'세액과 공급가액의 기준을 확인합니다. 세율을 임의로 가정하지 않습니다.',content:'세액·적용 기준·합계가 표시된 원문'},
 'rent.total':{label:'임대료 합계',why:'공급가액과 세액을 포함한 합계를 대조합니다.',content:'공급가액·세액·합계가 함께 표시된 원문'},
 duration:{label:'기간 길이',why:'기간 단위와 시작 기준이 같은지 확인합니다.',content:'일·월 등 단위와 시작·종료 기준이 표시된 부분'},
 period:{label:'적용 기간',why:'서로 다른 기간의 금액을 비교하지 않도록 합니다.',content:'해당 금액의 기준 연월 또는 시작·종료일'},
 'asset.model':{label:'장비 모델',why:'자료가 같은 장비를 가리키는지 대조합니다.',content:'모델명이 읽히는 명세 또는 명판 위치'},
 'asset.serial':{label:'장비 제조번호',why:'같은 모델의 서로 다른 장비를 구분합니다.',content:'제조번호가 읽히는 해당 장비 명판 또는 명세 위치'},
 'asset.quantity':{label:'장비 수량',why:'자료 간 수량과 단위가 일치하는지 확인합니다.',content:'장비별 수량·단위가 표시된 내역'},
};
export function reviewOverview(documents:ReviewDocument[],status?:string){
 if(!documents.length)return {title:'아직 받은 자료가 없습니다',message:'아래 자료 업로드 영역에서 가지고 있는 자료부터 추가해 주세요. 모든 자료를 갖춰야 시작하는 것은 아닙니다. 수신 자료가 없는 상태이며, 특정 필수서류가 부족하다고 판정한 것은 아닙니다.'};
 if(status==='stale')return {title:'자료가 바뀌어 이전 결과를 사용하지 않습니다',message:'새 파일 기준으로 전송 범위를 확인하고 재검수를 요청해 주세요. 기존 자료를 모두 다시 올릴 필요는 없습니다.'};
 if(status==='failed'||status==='unknown')return {title:'검수 결과 미확인',message:'파일은 등록되어 있습니다. 읽기·처리 실패를 자료 없음으로 처리하지 않습니다. 저장 상태를 먼저 조회하고, 결과 없이 반복 실행하지 마세요.'};
 return {title:`등록 자료 ${new Set(documents.map(d=>d.id)).size}건`,message:'가지고 있는 자료부터 검수할 수 있습니다. 이미 등록된 자료는 다시 요청하지 않고, 불일치·판독 불가·확인할 부분만 보완합니다. 전송 확인과 서버 실행 허용은 별도로 필요합니다.'};
}
export function reviewIssueGuidance(issue:ReviewIssue,documents:ReviewDocument[]){
 const topic=issue.field.startsWith('document.')?issue.field.slice(9):'';
 if(topics.includes(topic as ContentTopic))return {label:topic==='coverage_gap'?'조회 기간과 실제 내역':topic==='income_scope'?'소득의 귀속 범위':'문서 내용 대조',why:issue.evidenceAssurance==='visual_claim'?'이미지 판독 초안입니다. 인용은 모델의 판독 주장이며 원문 대조가 필요합니다.':'전송 승인된 현재 원문의 인용에 근거한 AI 검토입니다. 사실 확정이나 심사 승인이 아닙니다.',content:contentActions[topic as ContentTopic],state:topic==='document_fact'?'원문 기재사항 · 사실 확인 필요':'내용 확인 필요',next:(topic==='document_fact'||topic==='coverage_gap')&&issue.action?issue.action:contentActions[topic as ContentTopic],source:documents.find(d=>d.id===issue.sourceId)?.label??'현재 자료',quote:issue.quote,locator:issue.locator,evidence:'현재 원문 인용 · 페이지/셀 위치'+(issue.sourceVersion?' · 검수 버전 '+issue.sourceVersion:'')};
 const field=fields[issue.field]??{label:'확인 항목',why:'현재 자료에서 내용을 확정할 근거를 확인합니다.',content:'해당 항목이 표시된 원문 위치'};
 const requirement=issue.requirement;
 const missing=issue.state==='missing'&&requirement?.verified===true&&!!requirement.ruleId&&!!requirement.evidenceRef&&['direct_lender','case_specific'].includes(requirement.basis);
 const state=missing?'건별 제출요건 보완':issue.state==='conflict'?'내용 불일치':issue.state==='unreadable'?'판독 불가 · 미확인':'내용 미확인';
 const next=missing?'먼저 등록 자료에 해당 내용이 있는지 확인하고, 없을 때만 아래 요건에 맞는 자료를 추가해 주세요.':issue.state==='conflict'?'기존 자료의 서로 다른 내용을 비교하고 어느 것이 현재 기준인지 확인해 주세요. 잘못되거나 오래된 자료만 교체합니다.':issue.state==='unreadable'?'기존 파일의 해당 부분을 확대해 확인하고, 읽을 수 없다면 더 선명한 파일로 교체해 주세요.':'기존 자료의 해당 위치부터 확인해 주세요. 거기에 없다면 다른 보유 자료의 근거를 연결하고, 보유하지 않은 내용만 추가로 받아 주세요.';
 return {label:field.label,why:field.why,content:field.content,state,next,source:documents.find(d=>d.id===issue.sourceId)?.label??'현재 자료 묶음',quote:issue.quote,locator:issue.locator,evidence:missing?`${requirement.basis==='direct_lender'?'직접 금융사 요구':'이 거래의 개별 조건'} · ${requirement.ruleId} · ${requirement.evidenceRef}`:issue.quote||issue.locator?'아래 원문 인용·위치를 대조해 주세요.':'원문 근거 미확인 · 자료 부족으로 확정하지 않습니다.'};
}
