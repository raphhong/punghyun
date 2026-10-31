import {ALL_DOCS,TRANSACTION_DOCS} from './pipeline';
/** Browser-local preparation only. No document approval, provider verification or outbound calls. */
export const contractFields=['customer','equipment','payoutGross','rentalBase','rentalVat','count','firstDate','payoutCondition','paymentCondition'] as const;
export type ContractField=typeof contractFields[number];
export const contractLabels:Record<ContractField,string>={customer:'고객',equipment:'장비',payoutGross:'VAT 포함 지급총액',rentalBase:'회차별 렌탈 공급가액',rentalVat:'회차별 렌탈 VAT',count:'납부 회차',firstDate:'첫 납부일',payoutCondition:'지급 조건',paymentCondition:'납부 조건'};
export type ImportedStandard={sha256:string;format:'text'|'pdf';body:string|null;slots:string[];status:'unverified';size:number};
export type FieldBinding={slot:string;field:ContractField;providerFieldId:string};
// Confirmed internal variant identifier; private full wording/provider binding still pending.
export const paymentChoices={expiry_once_bank_holiday_next_business_day:'만기 일시 납부 · 은행 휴일이면 다음 영업일'} as const;
export type PaymentChoice=keyof typeof paymentChoices;
export const sevenDayPolicy=Object.freeze({id:'seven-day-commercial-v2',product:'seven_day',sourceStatus:'awaiting_private_standard',summary:'보험·위약벌은 기준본 고정입니다. 전체 문구 확인 전입니다.',insurance:'추가 보험 가입·풍현 피보험자·질권 의무 없음',penalty:'10% · 공급가액(VAT 제외) 기준 · 시정 요구 5영업일',depositWon:0,lateDamagesAnnualPercent:7,payoutAfterConditionsBusinessDays:1,conditionsDeadlineBusinessDays:5,removalNoticeBusinessDays:2,customerSpecificExceptions:'unknown'});
export type ClauseException={kind:'insurance'|'penalty';proposal:string;reason:string};
export function prepareSevenDay(source:ImportedStandard,mappings:FieldBinding[],values:Record<ContractField,string>,templateId:string,payment:PaymentChoice,exceptions:ClauseException[]=[]){
 if(!Object.prototype.hasOwnProperty.call(paymentChoices,payment))throw Error('payment_required');
 // Policy-bearing placeholders cannot be relabeled as customer/amount inputs.
 if(source.slots.some(s=>/(insurance|penalty|cure|vatbasis|보험|위약|시정)/i.test(s)))throw Error('fixed_clause_mapping_forbidden');
 // No semantic relabeling: the private approved manifest must explicitly define aliases.
 if(source.slots.some(s=>!contractFields.includes(s as ContractField)))throw Error('standard_mapping_required');
 for(const m of mappings)if(m.slot!==m.field)throw Error('reserved_field_mapping');
 const kinds=new Set<string>();for(const e of exceptions){if(!['insurance','penalty'].includes(e.kind)||kinds.has(e.kind)||!e.reason.trim()||!e.proposal.trim()||e.reason.length>2000||e.proposal.length>5000||/[{}\x00-\x08]/.test(e.reason+e.proposal))throw Error('invalid_exception');kinds.add(e.kind);}
 const result=previewStandard(source,mappings,{...values,paymentCondition:paymentChoices[payment]},templateId);
 return {...result,render_allowed:false,inspectionStatus:'unknown',rightsStatus:'unknown',policyVersion:sevenDayPolicy.id,payment,approvalAllowed:false,sendAllowed:false,reviewState:exceptions.length?'exception_review_required':'standard_connection_required',comparison:exceptions.map(e=>({kind:e.kind,before:'비공개 기준본 전체 문구 확인 대기',proposed:e.proposal.trim(),reason:e.reason.trim(),sourceHash:source.sha256})),reviewBinding:JSON.stringify([sevenDayPolicy.id,source.sha256,templateId,payment,contractFields.map(f=>[f,f==='paymentCondition'?paymentChoices[payment]:values[f].trim()]),mappings.map(m=>[m.slot,m.field,m.providerFieldId]).sort((a,b)=>a[0].localeCompare(b[0])),exceptions.map(e=>[e.kind,e.proposal.trim(),e.reason.trim()]).sort((a,b)=>a[0].localeCompare(b[0]))])};
}
export async function importStandard(bytes:Uint8Array):Promise<ImportedStandard>{if(!bytes.length||bytes.length>5*1024*1024)throw Error('file_limit');const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes)))).map(n=>n.toString(16).padStart(2,'0')).join('');if(new TextDecoder().decode(bytes.slice(0,5))==='%PDF-')return {sha256,format:'pdf',body:null,slots:[],status:'unverified',size:bytes.length};let body:string;try{body=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw Error('unsupported_file');}if(body.length>50000||/[\x00-\x08]/.test(body)||!body.trim())throw Error('unsupported_file');const slots=[...new Set([...body.matchAll(/{{([a-zA-Z][a-zA-Z0-9_]{0,39})}}/g)].map(m=>m[1]))];if(slots.length>30||body.replace(/{{([a-zA-Z][a-zA-Z0-9_]{0,39})}}/g,'').match(/[{}]/))throw Error('invalid_placeholders');return {sha256,format:'text',body,slots,status:'unverified',size:bytes.length};}
export function previewStandard(source:ImportedStandard,mappings:FieldBinding[],values:Record<ContractField,string>,templateId:string){if(source.status!=='unverified'||!/^([a-f0-9]{64})$/.test(source.sha256))throw Error('invalid_source');if(templateId.length>150||/[\x00-\x1f]/.test(templateId))throw Error('invalid_mapping');const seen=new Set<string>();for(const m of mappings){if(!source.slots.includes(m.slot)||seen.has(m.slot)||!contractFields.includes(m.field)||typeof m.providerFieldId!=='string'||m.providerFieldId.length>150)throw Error('invalid_mapping');seen.add(m.slot);}for(const field of contractFields)if(typeof values[field]!=='string'||values[field].length>2000||/[{}\x00-\x08]/.test(values[field]))throw Error('invalid_value');if(source.format==='pdf')return {text:null,missing:[],status:'pdf_original_only' as const,sendAllowed:false};if(source.slots.some(s=>!seen.has(s)))throw Error('mapping_incomplete');const missing=mappings.filter(m=>!values[m.field].trim()).map(m=>m.slot);const text=source.body!.replace(/{{([a-zA-Z][a-zA-Z0-9_]{0,39})}}/g,(_,slot:string)=>values[mappings.find(m=>m.slot===slot)!.field].trim()||'[미확정]');return {text,missing,status:'unverified_preview' as const,sendAllowed:false};}

/** Read-only legacy-admin projection. Attachment presence is not evidence verification. */
export type ContractSourceCatalog={customerId:string;devices:{state:'ready'|'unavailable'|'too_many';items:{id:string;model:string|null;quantity:number|null}[]};documents:{state:'ready'|'unavailable'|'too_many';items:{id:string;key:string;label?:string;category:string;deviceId:string|null;uploadedAt:string|null;present:boolean}[]}};
export function projectContractSourceCatalog(customerId:string,devices:{data:unknown;error:unknown},documents:{data:unknown;error:unknown}):ContractSourceCatalog{
 const result:ContractSourceCatalog={customerId,devices:{state:'unavailable',items:[]},documents:{state:'unavailable',items:[]}};
 if(!devices.error&&Array.isArray(devices.data)){if(devices.data.length>100)result.devices.state='too_many';else if(devices.data.every(r=>r&&r.customer_id===customerId&&typeof r.id==='string'&&(typeof r.model_name==='string'||r.model_name===null))){result.devices={state:'ready',items:devices.data.map(r=>({id:r.id,model:r.model_name,quantity:Number.isSafeInteger(r.quantity)&&r.quantity>0?r.quantity:null}))};if(new Set(result.devices.items.map(r=>r.id)).size!==result.devices.items.length)result.devices={state:'unavailable',items:[]};}}
 if(!documents.error&&Array.isArray(documents.data)){if(documents.data.length>200)result.documents.state='too_many';else if(documents.data.every(r=>r&&r.customer_id===customerId&&typeof r.id==='string'&&typeof r.doc_key==='string'&&typeof r.category==='string')){result.documents={state:'ready',items:documents.data.map(r=>({id:r.id,key:r.doc_key,label:[...ALL_DOCS,...TRANSACTION_DOCS].find(d=>d.key===r.doc_key)?.label??'기타 제출자료',category:r.category,deviceId:typeof r.device_id==='string'?r.device_id:null,uploadedAt:typeof r.uploaded_at==='string'?r.uploaded_at:null,present:typeof r.file_path==='string'&&!!r.file_path}))};if(new Set(result.documents.items.map(r=>r.id)).size!==result.documents.items.length)result.documents={state:'unavailable',items:[]};}}
 return result;
}

/** A local manual acknowledgement, not a content-hash or server verification proof. */
export function documentAcknowledgmentSnapshot(catalog:ContractSourceCatalog|undefined,assets:{id:string}[],documentId:string):string|null{
 if(!catalog||catalog.documents.state!=='ready'||!catalog.customerId||!documentId||new Set(assets.map(a=>a.id)).size!==assets.length)return null;
 const matches=catalog.documents.items.filter(d=>d.id===documentId);if(matches.length!==1)return null;const doc=matches[0];
 if(doc.present!==true||doc.deviceId!==null&&!assets.some(a=>a.id===doc.deviceId)||doc.uploadedAt!==null&&typeof doc.uploadedAt!=='string')return null;
 return JSON.stringify(['manual-document-ack-v77',catalog.customerId,doc.id,doc.uploadedAt,doc.deviceId,doc.key,doc.category,assets.map(a=>a.id).sort()]);
}
export function resolveAcknowledgedDocument(catalog:ContractSourceCatalog|undefined,assets:{id:string}[],documentId:string,acknowledgment:string|null){
 const current=documentAcknowledgmentSnapshot(catalog,assets,documentId);if(!current||typeof acknowledgment!=='string'||acknowledgment!==current)return null;
 const doc=catalog!.documents.items.find(d=>d.id===documentId)!;return {ref:`admin-document:${doc.id}@${doc.uploadedAt??'unversioned'}`,assetId:doc.deviceId};
}
