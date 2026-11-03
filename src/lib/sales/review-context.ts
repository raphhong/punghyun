import {caseRequirementGuidance,type CaseRequirements,type ReviewDocument,type ReviewIssue} from './review-guidance';
export type HistoricalReview={id:string;customerId:string;sourceSnapshot:string;createdAt:string;documents:ReviewDocument[];issues:ReviewIssue[]};
export type ReviewContext={customerId:string;sourceSnapshot:string;requirements:{status:'available'|'not_connected'|'unavailable';value:CaseRequirements|null};history:{status:'available'|'not_connected'|'unavailable';entries:HistoricalReview[]};financialApproval:false};
/** Port for already-authorized, sales-public case records. No direct table or new RPC fallback. */
export type ReviewContextRepository={read:(customerId:string,sourceSnapshot:string)=>Promise<ReviewContext>};
export function parseReviewContext(value:unknown,customerId:string,sourceSnapshot:string):ReviewContext{
 const v=value as ReviewContext;
 if(!v||v.customerId!==customerId||v.sourceSnapshot!==sourceSnapshot||v.financialApproval!==false||!v.requirements||!v.history||!['available','not_connected','unavailable'].includes(v.requirements.status)||!['available','not_connected','unavailable'].includes(v.history.status)||!Array.isArray(v.history.entries))throw Error('context_unavailable');
 if(v.requirements.status==='available'){
  const c=v.requirements.value;if(!c||!Array.isArray(c.items)||c.items.length>100||c.customerId!==customerId||c.verified!==true||typeof c.customerType!=='string'||typeof c.recipient!=='string')throw Error('context_unavailable');
  for(const i of c.items)if(!i||!['id','customerType','recipient','title','why','content','sourceQuote','sourceRef'].every(k=>typeof i[k as keyof typeof i]==='string')||!Array.isArray(i.receivedDocumentIds)||!i.receivedDocumentIds.every(x=>typeof x==='string'))throw Error('context_unavailable');
  if(caseRequirementGuidance(customerId,[],c).items.length!==c.items.length)throw Error('context_unavailable');
 }
 if(v.history.entries.length>100)throw Error('context_unavailable');
 for(const e of v.history.entries){if(!e||e.customerId!==customerId||typeof e.id!=='string'||typeof e.sourceSnapshot!=='string'||!Number.isFinite(Date.parse(e.createdAt))||!Array.isArray(e.documents)||!Array.isArray(e.issues)||e.documents.length>20||e.issues.length>100)throw Error('context_unavailable');
  if(e.documents.some(d=>!d||![d.id,d.version,d.label].every(s=>typeof s==='string'&&s.length<2000))||e.issues.some(i=>!i||![i.sourceId,i.field,i.state,i.quote,i.locator,i.action].every(s=>typeof s==='string'&&s.length<4000)))throw Error('context_unavailable');
 }
 return {customerId,sourceSnapshot,financialApproval:false,requirements:{status:v.requirements.status,value:v.requirements.status==='available'&&v.requirements.value?{customerId,customerType:v.requirements.value.customerType,recipient:v.requirements.value.recipient,verified:true,items:v.requirements.value.items.map(i=>({id:i.id,customerType:i.customerType,recipient:i.recipient,title:i.title,why:i.why,content:i.content,sourceQuote:i.sourceQuote,sourceRef:i.sourceRef,receivedDocumentIds:[...i.receivedDocumentIds]}))}:null},history:{status:v.history.status,entries:v.history.status==='available'?v.history.entries.map(e=>({id:e.id,customerId,sourceSnapshot:e.sourceSnapshot,createdAt:e.createdAt,documents:e.documents.map(d=>({id:d.id,version:d.version,label:d.label})),issues:e.issues.map(i=>({sourceId:i.sourceId,field:i.field,state:i.state,quote:i.quote,locator:i.locator,action:i.action,...(i.requirement?.verified===true&&['direct_lender','case_specific'].includes(i.requirement.basis)&&typeof i.requirement.ruleId==='string'&&!!i.requirement.ruleId&&typeof i.requirement.evidenceRef==='string'&&!!i.requirement.evidenceRef?{requirement:{basis:i.requirement.basis,ruleId:i.requirement.ruleId,evidenceRef:i.requirement.evidenceRef,verified:true as const}}:{})}))})):[]}};
}
/** Existing GET remains the sole current-user gate. The production repository is deliberately
 * unconnected: current scoped RPC does not expose case requirements or historical results. */
export function createSalesReviewContextEndpoint(readCurrent:()=>Promise<Response>,customerId:string,repository?:ReviewContextRepository){
 return async()=>{const headers={'Cache-Control':'no-store'};const current=await readCurrent();if(!current.ok)return Response.json({code:'context_unavailable',financialApproval:false},{status:current.status,headers});
  try{const c=await current.json();if(c.financialApproval!==false||typeof c.sourceSnapshot!=='string')throw Error();
   const result=repository?parseReviewContext(await repository.read(customerId,c.sourceSnapshot),customerId,c.sourceSnapshot):{customerId,sourceSnapshot:c.sourceSnapshot,financialApproval:false,requirements:{status:'not_connected',value:null},history:{status:'not_connected',entries:[]}};
   return Response.json(result,{headers});
  }catch{return Response.json({code:'context_unavailable',financialApproval:false},{status:503,headers});}
 };
}
