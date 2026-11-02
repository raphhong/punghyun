import type {SavedDocumentReview} from './workspace-review';
export type EvidenceRef={sourceId:string;version:string;sha256:string;locator:string;quote:string;value:string;field:string;unit:string;vat:string;period:string;assurance:'extracted_claim';assetId:string|null};
export type ImageEvidence={state:'available'|'unknown';slot:string;refs:EvidenceRef[];absent:string[];invalidFields?:{index:number;code:string;original:unknown}[]};
/** Receipts are verified by existing server handlers before entering this adapter. No inference of payment or title. */
export function imageEvidence(body:unknown,slot:string):ImageEvidence{
 const b=body as Record<string,unknown>;const unknown:ImageEvidence={state:'unknown',slot,refs:[],absent:[]};
 if(!b||b.receiptVerified!==true||!['observed','outcome_unknown'].includes(String(b.outcome)))return unknown;
 const a=b.approval as {images?:Array<{id:string;version:string;sha256:string;width:number;height:number}>};const r=(b.fieldReview??b.result) as {issues?:{index:number;code:string;original:unknown}[];verified?:boolean;applyAllowed?:boolean;readings?:Array<{imageId:string;field:string;raw:string;quote:string;box:number[]|null;status:string;unit:string;vat:string;period:string}>};
 if(!r)return unknown;if(!a?.images||r.verified!==false||r.applyAllowed!==false||!Array.isArray(r.readings))throw Error('invalid_image_receipt');
 const refs:EvidenceRef[]=[],absent:string[]=[];
 for(const f of r.readings){const pin=a.images.find(p=>p.id===f.imageId);if(!pin||!/^([a-f0-9]{64})$/.test(pin.sha256)||!pin.version)throw Error('invalid_image_source');if(f.status!=='readable'){absent.push(f.imageId+':'+f.field+':'+f.status);continue;}
 if(!Array.isArray(f.box)||f.box.length!==4||f.box.some(n=>!Number.isFinite(n)||n<0)||f.box[2]<=0||f.box[3]<=0||f.box[0]+f.box[2]>pin.width||f.box[1]+f.box[3]>pin.height||typeof f.raw!=='string'||typeof f.quote!=='string')throw Error('invalid_image_locator');
 refs.push({sourceId:pin.id,version:pin.version,sha256:pin.sha256,locator:'image-pixels:'+f.box.join(','),quote:f.quote,value:f.raw,field:f.field,unit:f.unit,vat:f.vat,period:f.period,assetId:null,assurance:'extracted_claim'});
 }return {state:'available',slot,refs,absent,invalidFields:r.issues??[]};
}
export function dealEvidence(rows:SavedDocumentReview[],images:ImageEvidence[]){
 const refs:EvidenceRef[]=[...rows.flatMap(r=>(r.result?.facts??[]).map(f=>({...f,assurance:'extracted_claim' as const}))),...images.flatMap(i=>i.refs)];
 const comparisons=[];const groups=new Map<string,EvidenceRef[]>();for(const ref of refs){const key=JSON.stringify([ref.field,ref.assetId]);groups.set(key,[...(groups.get(key)??[]),ref]);}for(const facts of groups.values()){if(new Set(facts.map(f=>f.sourceId)).size<2)continue;const first=facts[0],numeric=/total|net|vat|rate|duration|days|adjustment/.test(first.field),known=!numeric||facts.every(f=>[f.unit,f.vat,f.period].every(v=>!!v&&v!=='unknown'));const comparable=known&&facts.every(f=>f.unit===first.unit&&f.vat===first.vat&&f.period===first.period);comparisons.push({field:first.field,state:!comparable?'not_comparable':new Set(facts.map(f=>f.value)).size===1?'same_extraction':'potential_conflict',facts});}
 return {refs,comparisons,cashflow:{numbers:refs.filter(f=>['purchase.total','adjustment','rent.net','rent.vat','rent.total','rent.rate','period','duration','contract.days'].includes(f.field)),paymentEvidence:'unknown',plannedPaymentEvidence:'unknown',revenueEvidence:'unknown',internalTransfers:'unknown',question:'수치의 기간·단위·VAT를 원문과 확인하고 실제 지급·예정 지급·매출·내부이체를 구분할 근거가 필요합니다.'},rights:{identifiers:refs.filter(f=>['asset.model','asset.serial'].includes(f.field)),undertaking:'unknown',registry:'unknown',actualOwnership:'unknown',securityRelease:'unknown',question:'확약·등록·실소유·담보 해소는 각각 원문 근거가 필요합니다. 확약서나 서명만으로 해소·입금을 확정하지 않습니다.'},financialApproval:false,creditDecision:null,automaticApply:false};
}
